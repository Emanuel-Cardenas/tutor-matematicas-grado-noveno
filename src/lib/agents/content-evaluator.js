// Agente 3: Evaluador de Respuestas sobre Contenido del Profesor
// Analiza el desempeño del estudiante sobre preguntas generadas del documento
import { callGeminiJSON } from '@/lib/gemini';

const CONTENT_EVALUATOR_PROMPT = `Eres un evaluador educativo experto en matemáticas. Tu tarea es analizar el desempeño de un estudiante sobre un examen generado a partir del contenido de un documento del profesor.

INSTRUCCIONES:
1. Revisa cada respuesta del estudiante y compárala con la correcta.
2. Para cada error, identifica:
   - El tipo de error (conceptual, procedimental, aritmético, interpretación)
   - El concepto del documento que no domina
   - Una explicación breve del error cometido
3. Genera un diagnóstico general vinculado al contenido del documento.

FORMATO JSON:
{
  "resumenGeneral": "Párrafo describiendo el desempeño global del estudiante sobre este contenido",
  "conceptosDominados": [
    {"concepto": "Nombre", "evidencia": "Por qué se considera dominado"}
  ],
  "conceptosConDificultad": [
    {"concepto": "Nombre", "nivel": "moderado|critico", "explicacion": "Qué demuestra la dificultad"}
  ],
  "analisisErrores": [
    {
      "preguntaIndex": 1,
      "tipoError": "conceptual|procedimental|aritmetico|interpretacion",
      "conceptoRelacionado": "Concepto del documento",
      "explicacionError": "Qué hizo mal el estudiante",
      "explicacionCorrecta": "Procedimiento correcto"
    }
  ],
  "recomendaciones": [
    "Recomendación específica de estudio vinculada al documento"
  ],
  "nivelDominio": "alto|medio|bajo|muy bajo",
  "porcentajeEstimadoComprension": 65
}`;

export async function contentEvaluatorAgent(questions, studentAnswers, documentTitle, schoolGrade) {
    // Construir detalle de respuestas
    const answerDetails = questions.map((q, i) => {
        const selected = studentAnswers[i] || null;
        const isCorrect = selected && selected.toUpperCase() === (q.correctOption || '').toUpperCase();
        return {
            index: i + 1,
            pregunta: q.text?.substring(0, 200),
            tema: q.topic,
            conceptoRelacionado: q.conceptRelated || q.conceptoRelacionado || '',
            dificultad: q.difficulty,
            respuestaEstudiante: selected,
            respuestaCorrecta: q.correctOption,
            esCorrecta: isCorrect,
        };
    });

    const totalCorrect = answerDetails.filter(a => a.esCorrecta).length;
    const percentage = Math.round((totalCorrect / questions.length) * 100);

    const userMessage = `Evalúa el desempeño de un estudiante de grado ${schoolGrade}° sobre un examen del contenido "${documentTitle}".

RESULTADO: ${totalCorrect}/${questions.length} correctas (${percentage}%)

DETALLE DE RESPUESTAS:
${JSON.stringify(answerDetails, null, 2)}

Analiza los errores, identifica patrones y genera un diagnóstico vinculado al contenido del documento.`;

    console.log(`[CONTENT-EVAL] Evaluando ${questions.length} respuestas (${percentage}% acierto)...`);

    const result = await callGeminiJSON(CONTENT_EVALUATOR_PROMPT, userMessage, {
        temperature: 0.3,
        max_tokens: 4096,
    });

    if (!result) {
        return {
            resumenGeneral: `El estudiante obtuvo ${totalCorrect}/${questions.length} (${percentage}%).`,
            conceptosDominados: [],
            conceptosConDificultad: [],
            analisisErrores: [],
            recomendaciones: ['Revisar el material del profesor'],
            nivelDominio: percentage >= 70 ? 'alto' : percentage >= 40 ? 'medio' : 'bajo',
            porcentajeEstimadoComprension: percentage,
        };
    }

    console.log(`[CONTENT-EVAL] Evaluación completada`);
    return result;
}
