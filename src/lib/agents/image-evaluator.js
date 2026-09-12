import { callGeminiVision } from '../gemini';

/**
 * IMAGE EVALUATOR AGENT
 * =====================
 * Agente especializado del sistema multi-agente YedaTech.
 * 
 * Responsabilidad: Evaluar ejercicios resueltos a mano por estudiantes.
 * - Analiza el procedimiento paso a paso
 * - Identifica errores conceptuales y de cálculo  
 * - Genera retroalimentación pedagógica
 * - Sugiere correcciones específicas
 * 
 * Input: imagen base64 + contexto del ejercicio actual
 * Output: evaluación estructurada con pasos analizados
 */

const IMAGE_EVALUATOR_PROMPT = `Eres un agente evaluador educativo especializado en matemáticas del sistema YedaTech. Tu rol es analizar imágenes de ejercicios resueltos a mano por estudiantes y dar retroalimentación pedagógica detallada.

## TU TAREA:
Examina la imagen y evalúa la solución del estudiante paso a paso.

## INSTRUCCIONES DETALLADAS:

### 1. TRANSCRIPCIÓN
- Transcribe TODO el contenido visible: ejercicio planteado, operaciones, respuesta final.
- Usa notación LaTeX para expresiones matemáticas (formato $...$).
- Si hay texto escrito a mano, transcríbelo lo más fielmente posible.

### 2. IDENTIFICACIÓN DEL PROBLEMA
- Determina qué tipo de ejercicio es (ecuación, geometría, aritmética, álgebra, etc.)
- Identifica el tema matemático específico.

### 3. ANÁLISIS PASO A PASO
- Desglosa la solución del estudiante en pasos lógicos.
- Para CADA paso, evalúa si es correcto o incorrecto.
- Si un paso es incorrecto, identifica exactamente qué salió mal.

### 4. CLASIFICACIÓN DE ERRORES
Clasifica cada error encontrado como:
- **calculo**: Error aritmético (suma, resta, multiplicación, división incorrecta)
- **procedimiento**: Aplicó mal un método o saltó pasos necesarios
- **conceptual**: No entiende el concepto subyacente
- **signo**: Error con signos positivos/negativos
- **algebraico**: Error al manipular expresiones algebraicas
- **notacion**: Notación incorrecta pero el concepto es correcto

### 5. RETROALIMENTACIÓN
- Sé claro, específico y amable.
- Para cada error, explica POR QUÉ está mal y CÓMO debería ser.
- Usa lenguaje socrático: formula preguntas que guíen al estudiante.
- El idioma es ESPAÑOL.

## FORMATO DE RESPUESTA (JSON estricto):
{
  "tipo": "ejercicio_resuelto|ejercicio_sin_resolver|ecuacion|grafico|tabla|texto|mixto|no_matematico",
  "contenido_extraido": "Transcripción completa del contenido visible",
  "tema_detectado": "Álgebra|Geometría|Aritmética|Cálculo|Trigonometría|Estadística|etc",
  "descripcion": "Descripción breve de lo que se ve en la imagen",
  "es_ejercicio": true,
  "es_ejercicio_resuelto": true,
  "ejercicio_formateado": "Enunciado del ejercicio identificado, formateado claramente",
  "evaluacion": {
    "es_correcto": false,
    "respuesta_estudiante": "La respuesta final que dio el estudiante",
    "respuesta_correcta": "La respuesta correcta del ejercicio",
    "veredicto": "Resumen general de la evaluación en 2-3 oraciones",
    "pasos_analizados": [
      {
        "numero": 1,
        "descripcion": "Qué hizo el estudiante en este paso",
        "expresion": "Expresión matemática del paso (LaTeX)",
        "correcto": true,
        "error": null,
        "tipo_error": null,
        "correccion": null
      },
      {
        "numero": 2,
        "descripcion": "Qué hizo el estudiante en este paso",
        "expresion": "Expresión matemática del paso",
        "correcto": false,
        "error": "Descripción precisa del error",
        "tipo_error": "calculo|procedimiento|conceptual|signo|algebraico|notacion",
        "correccion": "Cómo debería ser este paso correctamente"
      }
    ],
    "tipos_errores_encontrados": ["calculo", "signo"],
    "sugerencias": [
      "Sugerencia pedagógica 1 para mejorar",
      "Sugerencia pedagógica 2"
    ],
    "pregunta_guia": "¿Qué pasa si revisas el signo en el paso 2? ¿Cómo afecta al resultado?"
  }
}

## REGLAS CRÍTICAS:
- Responde SOLO en JSON válido, sin markdown, sin bloques de código.
- Si la imagen NO contiene un ejercicio resuelto, establece "es_ejercicio_resuelto": false y el campo "evaluacion" como null.
- Si no puedes leer algo, indícalo explícitamente en la transcripción.
- Sé JUSTO: si la solución es correcta, reconócelo con entusiasmo.
- Sé PRECISO: no inventes errores que no existan.
- Siempre incluye la pregunta_guia para mantener el enfoque socrático.`;

/**
 * Evalúa un ejercicio resuelto a mano desde una imagen.
 * 
 * @param {string} base64Image — imagen en base64 (sin prefijo data:...)
 * @param {string} mimeType — tipo MIME (image/jpeg, image/png, etc.)
 * @param {object} context — contexto opcional del ejercicio actual
 * @param {string} context.currentQuestion — enunciado de la pregunta activa
 * @param {string} context.correctAnswer — respuesta correcta esperada
 * @param {string} context.topic — tema matemático actual
 * @param {number} context.studentLevel — nivel del estudiante (1-10)
 * @returns {object} resultado de la evaluación estructurada
 */
export async function imageEvaluatorAgent(base64Image, mimeType, context = {}) {
    try {
        // Construir mensaje contextualizado si hay ejercicio activo
        let userMessage = 'Analiza esta imagen de un ejercicio resuelto por un estudiante y evalúa su solución paso a paso.';

        if (context.currentQuestion) {
            userMessage += `\n\nCONTEXTO DEL EJERCICIO ACTUAL:`;
            userMessage += `\n- Ejercicio planteado: ${context.currentQuestion}`;
            if (context.correctAnswer) {
                userMessage += `\n- Respuesta correcta esperada: ${context.correctAnswer}`;
            }
            if (context.topic) {
                userMessage += `\n- Tema: ${context.topic}`;
            }
            if (context.studentLevel) {
                userMessage += `\n- Nivel del estudiante: ${context.studentLevel}/10`;
            }
            userMessage += `\n\nUsa este contexto para una evaluación más precisa.`;
        }

        const result = await callGeminiVision(
            IMAGE_EVALUATOR_PROMPT,
            userMessage,
            base64Image,
            mimeType
        );

        if (!result) {
            return createErrorResult('No se pudo analizar la imagen.');
        }

        // Parsear JSON de la respuesta
        const parsed = parseJSON(result);

        if (parsed) {
            // Validar estructura mínima
            return normalizeResult(parsed);
        }

        // Si no se pudo parsear, devolver como texto
        return {
            tipo: 'texto',
            contenido_extraido: result,
            descripcion: 'Contenido extraído pero no se pudo estructurar.',
            es_ejercicio: false,
            es_ejercicio_resuelto: false,
            ejercicio_formateado: null,
            evaluacion: null,
        };

    } catch (error) {
        console.error('Error en imageEvaluatorAgent:', error);
        return createErrorResult('Error al procesar la imagen: ' + error.message);
    }
}

/**
 * Parsea JSON con múltiples intentos de limpieza.
 */
function parseJSON(text) {
    const cleaned = text
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/, '')
        .trim();

    // Intento 1: directo
    try {
        return JSON.parse(cleaned);
    } catch { }

    // Intento 2: extraer objeto JSON
    try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch { }

    return null;
}

/**
 * Normaliza el resultado para garantizar la estructura esperada.
 */
function normalizeResult(parsed) {
    return {
        tipo: parsed.tipo || 'texto',
        contenido_extraido: parsed.contenido_extraido || '',
        tema_detectado: parsed.tema_detectado || null,
        descripcion: parsed.descripcion || '',
        es_ejercicio: parsed.es_ejercicio ?? false,
        es_ejercicio_resuelto: parsed.es_ejercicio_resuelto ?? false,
        ejercicio_formateado: parsed.ejercicio_formateado || null,
        evaluacion: parsed.evaluacion ? {
            es_correcto: parsed.evaluacion.es_correcto ?? null,
            respuesta_estudiante: parsed.evaluacion.respuesta_estudiante || null,
            respuesta_correcta: parsed.evaluacion.respuesta_correcta || null,
            veredicto: parsed.evaluacion.veredicto || '',
            pasos_analizados: (parsed.evaluacion.pasos_analizados || []).map((p, i) => ({
                numero: p.numero || i + 1,
                descripcion: p.descripcion || '',
                expresion: p.expresion || '',
                correcto: p.correcto ?? true,
                error: p.error || null,
                tipo_error: p.tipo_error || null,
                correccion: p.correccion || null,
            })),
            tipos_errores_encontrados: parsed.evaluacion.tipos_errores_encontrados || [],
            sugerencias: parsed.evaluacion.sugerencias || [],
            pregunta_guia: parsed.evaluacion.pregunta_guia || null,
        } : null,
    };
}

/**
 * Crea un resultado de error estandarizado.
 */
function createErrorResult(message) {
    return {
        tipo: 'error',
        contenido_extraido: '',
        tema_detectado: null,
        descripcion: message,
        es_ejercicio: false,
        es_ejercicio_resuelto: false,
        ejercicio_formateado: null,
        evaluacion: null,
    };
}
