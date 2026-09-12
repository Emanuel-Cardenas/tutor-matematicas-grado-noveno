import { callGeminiJSON } from '../gemini';
import { EVALUATOR_PROMPT } from '../prompts';

/**
 * Evaluador de respuestas mejorado.
 * PASO 1: Verificación simbólica local (sin LLM) para respuestas numéricas.
 * PASO 2: Si no puede decidir → LLM para evaluación semántica.
 *
 * @param {string} studentAnswer — respuesta del estudiante
 * @param {string} correctAnswer — respuesta correcta
 * @param {string} questionContent — enunciado de la pregunta
 * @param {object} context — contexto adicional (opcional)
 * @returns {{ correcto, tipo_error, concepto_debil, confianza, metodo }}
 */
export async function evaluatorAgent(studentAnswer, correctAnswer, questionContent, context = {}) {
    // ═══════════════════════════════════════
    // PASO 1: VERIFICACIÓN SIMBÓLICA LOCAL
    // ═══════════════════════════════════════
    const localResult = localSymbolicCheck(studentAnswer, correctAnswer);

    if (localResult.decided) {
        return {
            correcto: localResult.correcto,
            tipo_error: localResult.correcto ? 'none' : 'desconocido',
            concepto_debil: localResult.correcto ? 'none' : 'Verificar procedimiento',
            confianza: localResult.confianza,
            metodo: 'local_symbolic',
        };
    }

    // ═══════════════════════════════════════
    // PASO 2: EVALUACIÓN CON LLM
    // ═══════════════════════════════════════
    const topicInfo = context.topic ? `\nTema: ${context.topic}` : '';
    const gradeInfo = context.grade ? `\nGrado: ${context.grade}°` : '';

    const message = `
Pregunta: ${questionContent}
Respuesta correcta: ${correctAnswer}
Respuesta del estudiante: ${studentAnswer}${topicInfo}${gradeInfo}

Evalúa si la respuesta del estudiante es correcta. Acepta equivalencias matemáticas.
Si es opción múltiple (A/B/C/D), compara la letra seleccionada.
`;

    const result = await callGeminiJSON(EVALUATOR_PROMPT, message);

    if (!result) {
        return {
            correcto: false,
            tipo_error: 'interpretacion',
            concepto_debil: 'No se pudo evaluar la respuesta',
            confianza: 20,
            metodo: 'fallback',
        };
    }

    return {
        correcto: result.correcto || false,
        tipo_error: result.tipo_error || 'none',
        concepto_debil: result.concepto_debil || 'none',
        confianza: 75,
        metodo: 'llm',
    };
}

/**
 * Verificación simbólica local — compara respuestas sin LLM.
 * Maneja equivalencias numéricas, fracciones, opciones múltiples.
 */
function localSymbolicCheck(studentAnswer, correctAnswer) {
    if (!studentAnswer || !correctAnswer) {
        return { decided: false };
    }

    const student = normalizeAnswer(studentAnswer);
    const correct = normalizeAnswer(correctAnswer);

    // Comparación directa de texto normalizado
    if (student === correct) {
        return { decided: true, correcto: true, confianza: 99 };
    }

    // Opción múltiple: comparar solo la letra
    const studentOption = extractOption(studentAnswer);
    const correctOption = extractOption(correctAnswer);
    if (studentOption && correctOption) {
        return {
            decided: true,
            correcto: studentOption === correctOption,
            confianza: 99,
        };
    }

    // Comparar valores numéricos
    const studentNum = parseNumeric(student);
    const correctNum = parseNumeric(correct);
    if (studentNum !== null && correctNum !== null) {
        // Tolerancia para decimales
        const isEqual = Math.abs(studentNum - correctNum) < 0.0001;
        return {
            decided: true,
            correcto: isEqual,
            confianza: isEqual ? 95 : 90,
        };
    }

    // Comparar fracciones
    const studentFrac = parseFraction(student);
    const correctFrac = parseFraction(correct);
    if (studentFrac !== null && correctFrac !== null) {
        const isEqual = Math.abs(studentFrac - correctFrac) < 0.0001;
        return {
            decided: true,
            correcto: isEqual,
            confianza: isEqual ? 95 : 90,
        };
    }

    // Si el valor numérico de uno es fracción y otro es decimal
    if (studentNum !== null && correctFrac !== null) {
        return {
            decided: true,
            correcto: Math.abs(studentNum - correctFrac) < 0.0001,
            confianza: 90,
        };
    }
    if (studentFrac !== null && correctNum !== null) {
        return {
            decided: true,
            correcto: Math.abs(studentFrac - correctNum) < 0.0001,
            confianza: 90,
        };
    }

    // No puede decidir → delegar a LLM
    return { decided: false };
}

/**
 * Normaliza una respuesta: trim, lowercase, quita LaTeX decorativo.
 */
function normalizeAnswer(answer) {
    return answer
        .trim()
        .toLowerCase()
        .replace(/\$/g, '')                        // Quitar $
        .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '$1/$2')  // \frac{a}{b} → a/b
        .replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)')           // \sqrt{x} → sqrt(x)
        .replace(/\\cdot/g, '*')                   // \cdot → *
        .replace(/\\times/g, '*')                  // \times → *
        .replace(/\\div/g, '/')                    // \div → /
        .replace(/\\pi/g, 'pi')                    // \pi → pi
        .replace(/\s+/g, '')                       // Quitar espacios
        .replace(/,/g, '.');                       // Coma decimal → punto
}

/**
 * Extrae opción de respuesta múltiple (A, B, C, D).
 */
function extractOption(answer) {
    const clean = answer.trim().toUpperCase();
    // Solo la letra
    if (/^[ABCD]$/.test(clean)) return clean;
    // "A)" o "A." o "opción A"
    const match = clean.match(/(?:^|\bopci[oó]n\s+)([ABCD])\b/);
    return match ? match[1] : null;
}

/**
 * Intenta parsear un valor numérico, incluyendo expresiones simples.
 */
function parseNumeric(str) {
    // Directo
    const num = parseFloat(str);
    if (!isNaN(num) && isFinite(num)) return num;

    // pi
    if (str === 'pi' || str === 'π') return Math.PI;
    if (str === '2pi' || str === '2π') return 2 * Math.PI;

    // sqrt(n)
    const sqrtMatch = str.match(/^sqrt\((\d+(?:\.\d+)?)\)$/);
    if (sqrtMatch) return Math.sqrt(parseFloat(sqrtMatch[1]));

    return null;
}

/**
 * Parsea una fracción (a/b) y retorna su valor decimal.
 */
function parseFraction(str) {
    // Formato: a/b
    const fracMatch = str.match(/^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/);
    if (fracMatch) {
        const num = parseFloat(fracMatch[1]);
        const den = parseFloat(fracMatch[2]);
        if (den !== 0) return num / den;
    }
    return null;
}
