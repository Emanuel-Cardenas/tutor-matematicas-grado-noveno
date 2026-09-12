import { callGeminiVision } from '../gemini';
import { imageEvaluatorAgent } from './image-evaluator';

/**
 * IMAGE ANALYZER AGENT (v2)
 * =========================
 * Agente del sistema multi-agente YedaTech.
 * 
 * Responsabilidad: Analizar imágenes y extraer contenido educativo.
 * Si detecta un ejercicio resuelto, delega al Image Evaluator Agent
 * para evaluación detallada paso a paso.
 * 
 * Flujo:
 * 1. Clasificar imagen (¿qué hay? ¿es ejercicio resuelto?)
 * 2. Si es ejercicio resuelto → delegar a imageEvaluatorAgent
 * 3. Si es otro contenido → extraer y formatear
 */

const IMAGE_ANALYZER_PROMPT = `Eres un asistente educativo especializado en analizar imágenes de contenido académico, especialmente matemáticas.

TU TAREA:
Analiza la imagen proporcionada y extrae todo el contenido relevante.

INSTRUCCIONES:
1. Si la imagen contiene texto escrito a mano o impreso, transcríbelo con precisión.
2. Si contiene ecuaciones o expresiones matemáticas, transcríbelas usando notación LaTeX (envueltas en $...$).
3. Si contiene gráficos, diagramas o figuras geométricas, descríbelos en detalle.
4. Si contiene un ejercicio o problema, identifícalo claramente.
5. Si contiene una tabla de datos, transcríbela.
6. DETERMINA si la imagen muestra un ejercicio que YA FUE RESUELTO por el estudiante (con procedimiento/respuesta visible).

FORMATO DE RESPUESTA (JSON estricto):
{
  "tipo": "ejercicio_resuelto|ejercicio|ecuacion|grafico|tabla|texto|mixto|no_matematico",
  "contenido_extraido": "Transcripción completa del contenido visible en la imagen",
  "descripcion": "Descripción breve de lo que se ve en la imagen",
  "es_ejercicio": true/false,
  "es_ejercicio_resuelto": true/false,
  "ejercicio_formateado": "Si es un ejercicio, formatearlo de manera clara. Si no, null."
}

IMPORTANTE:
- Responde SOLO en JSON válido, sin markdown, sin bloques de código.
- Si la imagen no tiene contenido matemático o educativo, indica tipo "no_matematico".
- Sé muy preciso con las ecuaciones y números.
- Un "ejercicio_resuelto" es cuando se VE tanto el problema como los pasos de solución o la respuesta del estudiante.
- Usa español para las descripciones.`;

/**
 * Analiza una imagen usando Gemini Vision.
 * Si detecta un ejercicio resuelto, delega al Image Evaluator Agent
 * para evaluación pedagógica detallada.
 * 
 * @param {string} base64Image — imagen en base64 (sin el prefijo data:...)
 * @param {string} mimeType — tipo MIME de la imagen (ej: image/jpeg)
 * @param {object} context — contexto opcional del ejercicio actual
 * @returns {object} resultado del análisis (con evaluación si aplica)
 */
export async function imageAnalyzerAgent(base64Image, mimeType, context = {}) {
    try {
        const result = await callGeminiVision(
            IMAGE_ANALYZER_PROMPT,
            'Analiza esta imagen y extrae todo su contenido educativo/matemático.',
            base64Image,
            mimeType
        );

        if (!result) {
            return {
                tipo: 'error',
                contenido_extraido: '',
                descripcion: 'No se pudo analizar la imagen.',
                es_ejercicio: false,
                es_ejercicio_resuelto: false,
                ejercicio_formateado: null,
                evaluacion: null,
            };
        }

        // Parsear JSON
        let parsed = parseJSON(result);

        if (!parsed) {
            return {
                tipo: 'texto',
                contenido_extraido: result,
                descripcion: 'Contenido extraído de la imagen.',
                es_ejercicio: false,
                es_ejercicio_resuelto: false,
                ejercicio_formateado: null,
                evaluacion: null,
            };
        }

        // Si detectó un ejercicio resuelto, delegar al evaluador especializado
        if (parsed.es_ejercicio_resuelto || parsed.tipo === 'ejercicio_resuelto') {
            console.log('[ImageAnalyzer] Ejercicio resuelto detectado → delegando a ImageEvaluator');

            try {
                const evaluation = await imageEvaluatorAgent(base64Image, mimeType, context);

                // Combinar el análisis básico con la evaluación detallada
                return {
                    ...parsed,
                    es_ejercicio_resuelto: true,
                    tema_detectado: evaluation.tema_detectado || null,
                    evaluacion: evaluation.evaluacion || null,
                    // Si el evaluador extrajo mejor contenido, usarlo
                    contenido_extraido: evaluation.contenido_extraido || parsed.contenido_extraido,
                    ejercicio_formateado: evaluation.ejercicio_formateado || parsed.ejercicio_formateado,
                };
            } catch (evalError) {
                console.error('[ImageAnalyzer] Error en evaluador:', evalError);
                // Devolver análisis básico sin evaluación detallada
                return {
                    ...parsed,
                    evaluacion: null,
                };
            }
        }

        // Devolver análisis básico para imágenes sin ejercicio resuelto
        return {
            ...parsed,
            evaluacion: null,
        };

    } catch (error) {
        console.error('Error en imageAnalyzerAgent:', error);
        return {
            tipo: 'error',
            contenido_extraido: '',
            descripcion: 'Error al procesar la imagen: ' + error.message,
            es_ejercicio: false,
            es_ejercicio_resuelto: false,
            ejercicio_formateado: null,
            evaluacion: null,
        };
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

    try {
        return JSON.parse(cleaned);
    } catch { }

    try {
        const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
        if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch { }

    return null;
}
