import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const DIAGNOSTIC_QUESTION_COUNT = 15;

export const DIAGNOSTIC_BANK_DIRS = [
    path.resolve(process.cwd(), 'prueba diagnostico'),
    path.resolve(process.cwd(), 'pruebas diagnostico'),
    path.resolve(process.cwd(), 'diagnostico preguntas'),
];

export function loadDiagnosticQuestionBank(schoolGrade) {
    const grade = normalizeGrade(schoolGrade);
    if (!grade) return [];

    const questions = [];
    const seen = new Set();

    for (const { file, data } of readDiagnosticFiles(grade)) {
        const rawQuestions = getRawQuestions(data);

        rawQuestions.forEach((rawQuestion, index) => {
            const normalized = normalizeDiagnosticQuestion(rawQuestion, file, index, grade);
            if (!normalized) return;

            const signature = buildQuestionSignature(normalized.text);
            if (seen.has(signature)) return;
            seen.add(signature);
            questions.push(normalized);
        });
    }

    return questions;
}

export function getDiagnosticQuestionBankSummary(schoolGrade) {
    const grade = normalizeGrade(schoolGrade);
    const summary = {
        grade,
        files: [],
        total: 0,
        valid: 0,
        missingAnswerKey: 0,
        invalidOptions: 0,
    };

    if (!grade) return summary;

    for (const { file, data } of readDiagnosticFiles(grade)) {
        const rawQuestions = getRawQuestions(data);
        const fileStats = {
            file,
            total: rawQuestions.length,
            valid: 0,
            missingAnswerKey: 0,
            invalidOptions: 0,
        };

        rawQuestions.forEach((rawQuestion, index) => {
            const text = buildQuestionText(rawQuestion);
            const options = normalizeOptions(rawQuestion.options || rawQuestion.opciones);
            const correctOption = normalizeCorrectOption(rawQuestion);

            if (!text || !options) {
                fileStats.invalidOptions++;
                return;
            }

            if (!correctOption) {
                fileStats.missingAnswerKey++;
                return;
            }

            if (normalizeDiagnosticQuestion(rawQuestion, file, index, grade)) {
                fileStats.valid++;
            }
        });

        summary.total += fileStats.total;
        summary.valid += fileStats.valid;
        summary.missingAnswerKey += fileStats.missingAnswerKey;
        summary.invalidOptions += fileStats.invalidOptions;
        summary.files.push(fileStats);
    }

    return summary;
}

export function selectDiagnosticQuestions(questions, count = DIAGNOSTIC_QUESTION_COUNT) {
    const shuffled = [...questions];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, Math.min(count, shuffled.length));
}

function readDiagnosticFiles(grade) {
    const bankDir = DIAGNOSTIC_BANK_DIRS.find(dir => fs.existsSync(dir));
    if (!bankDir) return [];

    return fs.readdirSync(bankDir)
        .filter(file => file.toLowerCase().endsWith('.json'))
        .filter(file => fileMatchesGrade(file, grade))
        .sort((a, b) => a.localeCompare(b))
        .flatMap(file => {
            try {
                const fullPath = path.join(bankDir, file);
                const data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
                return [{ file, data }];
            } catch (error) {
                console.warn(`[DIAGNOSTIC-BANK] JSON invalido omitido: ${file}. ${error.message}`);
                return [];
            }
        });
}

function normalizeDiagnosticQuestion(question, sourceFile, index, grade) {
    const text = buildQuestionText(question);
    const options = normalizeOptions(question.options || question.opciones);
    const correctOption = normalizeCorrectOption(question);

    if (!text || !options) return null;

    const materials = normalizeMaterials(question.materials || question.materiales || question.metadata);
    const difficulty = normalizeDifficulty(question.difficulty || question.dificultad || question.difficultyLevel);

    return {
        id: buildStableId(sourceFile, index, question),
        tipo: 'tradicional',
        text,
        options,
        correctOption,
        answerKeyMissing: !correctOption,
        topic: question.topic || question.tema || question.componente || inferTopic(text),
        subtopic: question.subtopic || question.subtema || question.competencia || '',
        difficulty,
        explanation: question.explanation || question.explicacion || question.respuesta?.explicacion || '',
        materials,
        schoolGrade: grade,
        metadata: {
            sourceFile,
            originalId: question.id || null,
            originalNumero: question.numero || null,
            tipoOriginal: question.tipo || null,
            competencia: question.competencia || question.metadata?.competencia || null,
            componente: question.componente || question.metadata?.componente || null,
        },
    };
}

function getRawQuestions(data) {
    if (Array.isArray(data)) return data;
    return data?.preguntas || data?.questions || [];
}

function fileMatchesGrade(file, grade) {
    const normalized = file.toLowerCase();
    const match = normalized.match(/grado\s*[_-]?\s*(\d{1,2})|grado(\d{1,2})|g(\d{1,2})\b/);
    if (!match) return false;
    const fileGrade = Number(match[1] || match[2] || match[3]);
    return fileGrade === grade;
}

function normalizeGrade(value) {
    const grade = Number(value);
    return grade === 9 ? grade : null;
}

function buildQuestionText(question) {
    const parts = [];

    if (question.text || question.content) {
        parts.push(normalizeTextFragment(question.text || question.content));
    }

    if (Array.isArray(question.enunciado)) {
        parts.push(...question.enunciado.map(normalizeTextFragment).filter(Boolean));
    } else if (question.enunciado) {
        parts.push(normalizeTextFragment(question.enunciado));
    }

    if (question.pregunta) {
        parts.push(normalizeTextFragment(question.pregunta));
    }

    return parts.join('\n\n').trim();
}

function normalizeTextFragment(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return String(value);
    if (value.texto || value.text || value.content) {
        return String(value.texto || value.text || value.content).trim();
    }
    return '';
}

function normalizeOptions(optionsInput) {
    if (!optionsInput) return null;

    if (Array.isArray(optionsInput)) {
        const options = {};
        for (const option of optionsInput) {
            const key = String(option.id || option.key || option.letra || '').toUpperCase().trim();
            const value = option.texto || option.text || option.value;
            if (['A', 'B', 'C', 'D'].includes(key) && value !== undefined && value !== null) {
                options[key] = String(value);
            }
        }
        return hasFourOptions(options) ? options : null;
    }

    if (typeof optionsInput === 'object') {
        const options = {};
        for (const key of ['A', 'B', 'C', 'D']) {
            const value = optionsInput[key] || optionsInput[key.toLowerCase()];
            if (value !== undefined && value !== null) options[key] = String(value);
        }
        return hasFourOptions(options) ? options : null;
    }

    return null;
}

function normalizeCorrectOption(question) {
    const value = question.correctOption
        || question.correctAnswer
        || question.respuestaCorrecta
        || question.clave
        || question.respuesta?.claveValidada
        || question.respuesta?.claveFuente;

    const normalized = String(value || '').toUpperCase().trim();
    return ['A', 'B', 'C', 'D'].includes(normalized) ? normalized : null;
}

function normalizeMaterials(input) {
    if (!input) return null;

    if (input.tables || input.charts || input.chartjsMaterials) {
        const tables = input.tables || [];
        const charts = input.charts || input.chartjsMaterials || [];
        return tables.length || charts.length ? { tables, charts } : null;
    }

    if (Array.isArray(input)) {
        const tables = [];
        const charts = [];

        for (const item of input) {
            const type = item.tipo || item.type;

            if (type === 'tabla' || type === 'table') {
                tables.push({
                    titulo: item.titulo || item.title || '',
                    columnas: item.columnas || item.columns || [],
                    filas: item.filas || item.rows || [],
                });
            }

            if (type === 'chartjs' || type === 'chart') {
                charts.push({
                    id: item.id || '',
                    descripcion: item.descripcion || item.description || '',
                    requires: item.requires || [],
                    config: item.config || {},
                });
            }
        }

        return tables.length || charts.length ? { tables, charts } : null;
    }

    return null;
}

function normalizeDifficulty(value) {
    if (typeof value === 'number') {
        if (value <= 2) return 'facil';
        if (value >= 4) return 'dificil';
        return 'media';
    }

    const normalized = String(value || '').toLowerCase().trim();
    if (['facil', 'media', 'dificil'].includes(normalized)) return normalized;
    if (normalized === 'easy') return 'facil';
    if (normalized === 'hard') return 'dificil';
    return 'media';
}

function hasFourOptions(options) {
    return Boolean(options.A && options.B && options.C && options.D);
}

function buildStableId(sourceFile, index, question) {
    const rawId = question.id || question.numero || index;
    const hash = crypto
        .createHash('sha1')
        .update(`${sourceFile}:${rawId}:${buildQuestionText(question)}`)
        .digest('hex')
        .slice(0, 16);

    return `diagnostic-json-${hash}`;
}

function buildQuestionSignature(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 300);
}

function inferTopic(text) {
    const lower = String(text || '').toLowerCase();
    if (/mediana|promedio|media|moda|frecuencia|probabilidad|tabla|graf/.test(lower)) return 'Estadistica';
    if (/triangulo|rectangulo|circulo|area|perimetro|angulo|geometr|volumen/.test(lower)) return 'Geometria';
    if (/funcion|ecuacion|algebra|variable|expresion|polinom/.test(lower)) return 'Algebra';
    if (/fraccion|decimal|porcentaje|proporcion|razon/.test(lower)) return 'Numerico';
    return 'Matematicas';
}
