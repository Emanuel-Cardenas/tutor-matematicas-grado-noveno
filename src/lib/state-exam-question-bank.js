import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export const STATE_EXAM_BANK_DIRS = [
    path.resolve(process.cwd(), 'pruebas de estado'),
    path.resolve(process.cwd(), 'preguntas pruebas de estado'),
];

export function loadStateExamQuestionBank() {
    const bankDir = STATE_EXAM_BANK_DIRS.find(dir => fs.existsSync(dir));
    if (!bankDir) return [];

    const files = fs.readdirSync(bankDir)
        .filter(file => file.toLowerCase().endsWith('.json'))
        .sort((a, b) => a.localeCompare(b));

    const questions = [];
    const seen = new Set();

    for (const file of files) {
        const fullPath = path.join(bankDir, file);
        let data;

        try {
            data = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        } catch (error) {
            console.warn(`[STATE-EXAM-BANK] JSON invalido omitido: ${file}. ${error.message}`);
            continue;
        }

        const rawQuestions = Array.isArray(data)
            ? data
            : data.preguntas || data.questions || [];

        rawQuestions.forEach((rawQuestion, index) => {
            const normalized = normalizeStateExamQuestion(rawQuestion, file, index);
            if (!normalized) return;

            const signature = buildQuestionSignature(normalized.text);
            if (seen.has(signature)) return;
            seen.add(signature);
            questions.push(normalized);
        });
    }

    return questions;
}

function normalizeStateExamQuestion(question, sourceFile, index) {
    const text = buildQuestionText(question);
    const options = normalizeOptions(question.options || question.opciones);
    const correctOption = normalizeCorrectOption(question);

    if (!text || !options || !correctOption) {
        return null;
    }

    const materials = normalizeMaterials(question.materials || question.materiales || question.metadata);
    const difficulty = normalizeDifficulty(question.difficulty || question.dificultad || question.difficultyLevel);

    return {
        id: buildStableId(sourceFile, index, question),
        tipo: 'tradicional',
        text,
        options,
        correctOption,
        topic: question.topic || question.tema || inferTopic(text),
        subtopic: question.subtopic || question.subtema || '',
        difficulty,
        explanation: question.explanation || question.explicacion || question.respuesta?.explicacion || '',
        materials,
        metadata: {
            sourceFile,
            originalId: question.id || null,
            originalNumero: question.numero || null,
            competencia: question.competencia || question.metadata?.competencia || null,
            componente: question.componente || question.metadata?.componente || null,
        },
    };
}

function buildQuestionText(question) {
    if (question.text || question.content) {
        return String(question.text || question.content).trim();
    }

    const parts = [];
    if (Array.isArray(question.enunciado)) {
        parts.push(question.enunciado.join('\n\n'));
    } else if (question.enunciado) {
        parts.push(String(question.enunciado));
    }

    if (question.pregunta) {
        parts.push(String(question.pregunta));
    }

    return parts.join('\n\n').trim();
}

function normalizeOptions(optionsInput) {
    if (!optionsInput) return null;

    if (Array.isArray(optionsInput)) {
        const options = {};
        for (const option of optionsInput) {
            const key = String(option.id || option.key || option.letra || '').toUpperCase().trim();
            const value = option.texto || option.text || option.value;
            if (['A', 'B', 'C', 'D'].includes(key) && value) {
                options[key] = String(value);
            }
        }
        return hasFourOptions(options) ? options : null;
    }

    if (typeof optionsInput === 'object') {
        const options = {};
        for (const key of ['A', 'B', 'C', 'D']) {
            const value = optionsInput[key] || optionsInput[key.toLowerCase()];
            if (value) options[key] = String(value);
        }
        return hasFourOptions(options) ? options : null;
    }

    return null;
}

function normalizeCorrectOption(question) {
    const value = question.correctOption
        || question.correctAnswer
        || question.respuestaCorrecta
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
            if (item.tipo === 'tabla' || item.type === 'table') {
                tables.push({
                    titulo: item.titulo || item.title || '',
                    columnas: item.columnas || item.columns || [],
                    filas: item.filas || item.rows || [],
                });
            }

            if (item.tipo === 'chartjs' || item.type === 'chartjs') {
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

    return `json-${hash}`;
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
    if (/triangulo|rectangulo|circulo|area|perimetro|angulo|geometr/.test(lower)) return 'Geometria';
    if (/funcion|ecuacion|algebra|variable|expresion/.test(lower)) return 'Algebra';
    return 'Matematicas Saber 11';
}
