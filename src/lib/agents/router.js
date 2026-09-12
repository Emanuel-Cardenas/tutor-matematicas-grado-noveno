import { callGeminiJSON } from '../gemini';
import { ROUTER_PROMPT } from '../prompts';
import { emotionAgent } from './emotion-agent';

/**
 * Router Agent mejorado.
 * 
 * 1. Detecta emoción del estudiante (sin IA)
 * 2. Clasifica intención del mensaje (con IA)
 * 3. Combina ambas señales para contexto enriquecido
 *
 * @param {string} studentMessage — mensaje del estudiante
 * @param {object} context — contexto de la sesión
 * @returns {{ intencion, requiere_evaluacion, contexto, emotion }}
 */
export async function routerAgent(studentMessage, context) {
    // ═══════════════════════════════════════
    // PASO 1: DETECCIÓN EMOCIONAL (sin IA)
    // ═══════════════════════════════════════
    const emotionResult = emotionAgent(studentMessage, {
        attemptNumber: context.attemptNumber || 0,
        consecutiveErrors: context.consecutiveErrors || 0,
        timeSpentSeconds: context.timeSpentSeconds || 0,
    });

    // ═══════════════════════════════════════
    // PASO 2: CLASIFICACIÓN DE INTENCIÓN (IA)
    // ═══════════════════════════════════════
    const enrichedMessage = `
Mensaje del estudiante: "${studentMessage}"
Contexto: Nivel ${context.level}, Tema: ${context.topic || 'no definido'}
Está en medio de un ejercicio: ${context.hasActiveQuestion ? 'sí' : 'no'}
Estado emocional detectado: ${emotionResult.emotion} (confianza: ${emotionResult.confidence}%)
  `;

    const result = await callGeminiJSON(ROUTER_ENHANCED_PROMPT, enrichedMessage);

    if (!result) {
        return {
            intencion: 'resolver_ejercicio',
            requiere_evaluacion: true,
            contexto: 'fallback por error de parsing',
            emotion: emotionResult,
        };
    }

    return {
        ...result,
        emotion: emotionResult,
    };
}

// ═══════════════════════════════════════
// PROMPT MEJORADO
// ═══════════════════════════════════════
const ROUTER_ENHANCED_PROMPT = [
    "Eres un agente router inteligente para un tutor de matemáticas en Colombia.",
    "Recibes mensajes del estudiante y debes clasificar la intención Y prioridad.",
    "",
    "INTENCIONES POSIBLES:",
    "- \"resolver_ejercicio\": El estudiante está intentando resolver o presentar una respuesta",
    "- \"pedir_ayuda\": Pide explicación, un ejemplo, o no entiende algo",
    "- \"pedir_explicacion\": Quiere que le expliquen un concepto o paso específico",
    "- \"nuevo_tema\": Quiere cambiar de tema o ver algo diferente",
    "- \"revisar_error\": Quiere entender por qué se equivocó antes",
    "- \"cambiar_dificultad\": Quiere que sea más fácil o más difícil",
    "- \"frustración\": Está frustrado, quiere rendirse o expresa negatividad",
    "- \"celebración\": Está contento con su progreso, celebra",
    "- \"saludo\": Saludo o despedida",
    "- \"otro\": Mensaje no relacionado con las categorías anteriores",
    "",
    "EJEMPLOS:",
    "\"no entiendo nada, me rindo\" → frustración",
    "\"¿me puedes explicar eso otra vez?\" → pedir_explicacion",
    "\"la respuesta es 42\" → resolver_ejercicio",
    "\"quiero algo más fácil\" → cambiar_dificultad",
    "\"¿por qué mi respuesta estaba mal?\" → revisar_error",
    "\"hola\" → saludo",
    "\"¡ya entendí! ¡genial!\" → celebración",
    "\"veamos trigonometría\" → nuevo_tema",
    "",
    "Responde SOLO en JSON válido:",
    "{\"intencion\": \"<intent>\", \"requiere_evaluacion\": true/false, \"contexto\": \"descripción breve\", \"urgencia\": \"alta|media|baja\"}",
].join("\n");
