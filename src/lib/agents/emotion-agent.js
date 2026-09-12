// ═══════════════════════════════════════════════════════
// EMOTION DETECTION AGENT — Detección de Estado Emocional
// ═══════════════════════════════════════════════════════
// Agente ligero que detecta el estado emocional del estudiante
// SIN consumir tokens de IA. Basado en heurísticas y patrones
// de texto que son comunes en estudiantes de bachillerato.
//
// Output: { emotion, confidence, signals }
// Emotions: positivo, neutro, confundido, frustrado, aburrido
//
// Se usa ANTES del Router para adaptar la estrategia del Tutor.
// ═══════════════════════════════════════════════════════

// Patrones de detección por emoción (sin IA, pura heurística)
const EMOTION_PATTERNS = {
    frustrado: {
        keywords: [
            'no entiendo', 'no puedo', 'me rindo', 'es imposible', 'odio',
            'no sirvo', 'no me sale', 'ya me cansé', 'estoy cansado',
            'esto es difícil', 'me da rabia', 'no sé nada', 'me rindo',
            'no lo logro', 'es muy difícil', 'ya no quiero', 'me estreso',
            'qué pereza', 'estoy perdido', 'no pillo', 'qué fastidio',
            'uff', 'ash', 'ayy', 'nooo', 'ya fue', 'que mamera',
            'me confundo', 'siempre me equivoco', 'soy malo en esto',
            'nunca voy a poder', 'qué gonorrea', 'qué chimba tan difícil'
        ],
        punctuation: /[!]{2,}|[?]{3,}/,
        capsRatio: 0.6,  // Si más del 60% está en mayúsculas
        weight: 3,
    },
    confundido: {
        keywords: [
            'no entiendo', 'cómo así', 'qué es eso', 'me confundo',
            'no me queda claro', 'y eso qué es', 'como se hace',
            'me explicas', 'me perdí', 'qué hago', 'por dónde empiezo',
            'cuál es la diferencia', 'no capto', 'no entendí',
            'y entonces', 'osea que', 'o sea', 'pero por qué',
            'eso cómo', 'y eso', 'no pillo', 'estoy confundido',
            'y eso para qué', 'me puedes repetir'
        ],
        questionMarks: 2,  // Si tiene 2+ signos de pregunta
        weight: 2,
    },
    positivo: {
        keywords: [
            'gracias', 'ya entendí', 'ahora sí', 'ya me quedó claro',
            'entendí', 'genial', 'claro', 'perfecto', 'excelente',
            'ya sé', 'fácil', 'listo', 'me gusta', 'chevere', 'bacano',
            'parcero gracias', 'oh ya', 'ah ya', 'sí sí', 'dale',
            'qué bien', 'lo logré', 'me salió', 'ya pude', 'bien',
            'cool', 'gracias profe', 'ya caché', 'vamos bien',
            'ya lo tengo', 'sí puedo', 'lo hice'
        ],
        emojis: /[😊🎉👍✅🙂😁💪🤩😃🥳]/,
        weight: 2,
    },
    aburrido: {
        keywords: [
            'aburrido', 'otra vez', 'siempre lo mismo', 'ya sé esto',
            'más de lo mismo', 'qué pereza', 'me aburre', 'fome',
            'meh', 'bah', 'zzzz', 'zzz', 'ya', 'ok', 'bueno',
            'dale pues', 'como sea', 'lo que sea', 'da igual',
            'tanto' , 'me da sueño'
        ],
        shortMessage: 3,  // Si el mensaje tiene 3 o menos palabras
        weight: 1,
    },
};

/**
 * Detecta el estado emocional del estudiante basándose en el texto del mensaje.
 * No consume tokens de IA — opera con heurísticas puras.
 *
 * @param {string} message — mensaje del estudiante
 * @param {object} context — contexto opcional
 * @param {number} context.attemptNumber — número de intento en la pregunta actual
 * @param {number} context.consecutiveErrors — errores consecutivos recientes
 * @param {number} context.timeSpentSeconds — tiempo en la pregunta actual
 * @returns {{ emotion: string, confidence: number, signals: string[], adaptations: object }}
 */
export function emotionAgent(message, context = {}) {
    if (!message || typeof message !== 'string') {
        return {
            emotion: 'neutro',
            confidence: 0,
            signals: [],
            adaptations: getAdaptations('neutro'),
        };
    }

    const text = message.toLowerCase().trim();
    const scores = { frustrado: 0, confundido: 0, positivo: 0, aburrido: 0, neutro: 0 };
    const signals = [];

    // ═══════════════════════════════════════
    // 1. DETECCIÓN POR KEYWORDS
    // ═══════════════════════════════════════
    for (const [emotion, config] of Object.entries(EMOTION_PATTERNS)) {
        for (const keyword of config.keywords) {
            if (text.includes(keyword)) {
                scores[emotion] += config.weight;
                signals.push(`keyword:"${keyword}" → ${emotion}`);
                break; // Solo contar una vez por emoción
            }
        }
    }

    // ═══════════════════════════════════════
    // 2. DETECCIÓN POR PATRONES DE TEXTO
    // ═══════════════════════════════════════

    // Múltiples signos de exclamación = frustración
    if (/!{2,}/.test(message)) {
        scores.frustrado += 1;
        signals.push('punctuation: múltiples "!"');
    }

    // Múltiples signos de interrogación = confusión
    const questionCount = (message.match(/\?/g) || []).length;
    if (questionCount >= 2) {
        scores.confundido += 1;
        signals.push(`punctuation: ${questionCount} signos "?"`);
    }

    // Texto en MAYÚSCULAS = frustración o énfasis
    const upperRatio = (message.match(/[A-ZÁÉÍÓÚÑ]/g) || []).length / Math.max(message.length, 1);
    if (upperRatio > 0.6 && message.length > 5) {
        scores.frustrado += 2;
        signals.push(`caps: ${Math.round(upperRatio * 100)}% mayúsculas`);
    }

    // Emojis positivos
    if (/[😊🎉👍✅🙂😁💪🤩😃🥳]/.test(message)) {
        scores.positivo += 2;
        signals.push('emoji positivo detectado');
    }

    // Emojis negativos
    if (/[😢😭😠😤😡🤬😫😩💀]/.test(message)) {
        scores.frustrado += 2;
        signals.push('emoji negativo detectado');
    }

    // Mensaje muy corto (1-3 palabras) sin contexto = posible aburrimiento
    const wordCount = text.split(/\s+/).length;
    if (wordCount <= 2 && !questionCount && scores.positivo === 0) {
        scores.aburrido += 1;
        signals.push(`mensaje corto: ${wordCount} palabras`);
    }

    // ═══════════════════════════════════════
    // 3. DETECCIÓN POR CONTEXTO (BEHAVIORAL)
    // ═══════════════════════════════════════

    if (context.attemptNumber && context.attemptNumber >= 4) {
        scores.frustrado += 2;
        signals.push(`contexto: ${context.attemptNumber} intentos en la misma pregunta`);
    }

    if (context.consecutiveErrors && context.consecutiveErrors >= 3) {
        scores.frustrado += 1;
        scores.confundido += 1;
        signals.push(`contexto: ${context.consecutiveErrors} errores consecutivos`);
    }

    if (context.timeSpentSeconds && context.timeSpentSeconds > 180) {
        scores.confundido += 1;
        signals.push(`contexto: ${Math.round(context.timeSpentSeconds / 60)}min en la pregunta`);
    }

    // ═══════════════════════════════════════
    // 4. DETERMINAR EMOCIÓN DOMINANTE
    // ═══════════════════════════════════════

    // Si ninguna emoción tiene score, es neutro
    const maxScore = Math.max(...Object.values(scores));
    if (maxScore === 0) {
        return {
            emotion: 'neutro',
            confidence: 50,
            signals: ['sin señales detectadas'],
            adaptations: getAdaptations('neutro'),
        };
    }

    // Encontrar la emoción con mayor score
    const dominantEmotion = Object.entries(scores)
        .sort(([, a], [, b]) => b - a)[0][0];

    // Calcular confianza (0-100)
    const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
    const confidence = Math.min(95, Math.round((maxScore / Math.max(totalScore, 1)) * 100));

    return {
        emotion: dominantEmotion,
        confidence,
        signals,
        adaptations: getAdaptations(dominantEmotion),
    };
}

/**
 * Genera adaptaciones pedagógicas según la emoción detectada.
 * Esta info se inyecta al contexto del Socratic Tutor.
 */
function getAdaptations(emotion) {
    const adaptations = {
        frustrado: {
            tono: 'empático y paciente',
            estrategia: 'Simplificar, dividir en pasos más pequeños, ofrecer ejemplo análogo sencillo',
            nivel: 'Reducir dificultad temporalmente, celebrar progreso parcial',
            frase_apertura: 'Entiendo que puede ser desafiante. Vamos paso a paso, sin prisa.',
            evitar: 'No presionar, no agregar complejidad, no preguntar "¿entendiste?"',
        },
        confundido: {
            tono: 'claro y directo',
            estrategia: 'Reformular la explicación de forma diferente, usar ejemplo concreto',
            nivel: 'Mantener dificultad pero cambiar enfoque explicativo',
            frase_apertura: 'Vamos a verlo de otra forma para que quede más claro.',
            evitar: 'No repetir la misma explicación, no asumir que ya sabe conceptos previos',
        },
        positivo: {
            tono: 'entusiasta y motivador',
            estrategia: 'Alabar el logro, ofrecer reto adicional, conectar con siguiente concepto',
            nivel: 'Puedes aumentar ligeramente la dificultad',
            frase_apertura: '¡Excelente trabajo! Estás avanzando muy bien.',
            evitar: 'No ser condescendiente, no frenar el momentum',
        },
        aburrido: {
            tono: 'dinámico y variado',
            estrategia: 'Cambiar el tipo de ejercicio, usar contexto colombiano interesante',
            nivel: 'Posiblemente necesita retos más altos o variados',
            frase_apertura: 'Probemos algo diferente que te resulte más interesante.',
            evitar: 'No repetir el mismo tipo de ejercicio, no dar explicaciones largas',
        },
        neutro: {
            tono: 'amigable y profesional',
            estrategia: 'Continuar con el flujo normal de la tutoría',
            nivel: 'Mantener nivel actual',
            frase_apertura: null,
            evitar: null,
        },
    };

    return adaptations[emotion] || adaptations.neutro;
}
