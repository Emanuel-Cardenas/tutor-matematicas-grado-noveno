// Agente 4: Generador de Reportes para el Profesor
// Consolida resultados de TODOS los estudiantes sobre un contenido específico
import { callGeminiJSON } from '@/lib/gemini';

const CONTENT_REPORT_PROMPT = `Eres un analista educativo experto. Tu tarea es generar un INFORME GRUPAL del rendimiento de los estudiantes sobre un contenido específico subido por el profesor.

INSTRUCCIONES:
1. Analiza los resultados de TODOS los estudiantes sobre el contenido.
2. Identifica patrones grupales: conceptos más/menos dominados.
3. Genera recomendaciones pedagógicas específicas al material.
4. El informe debe ser accionable para el profesor.

FORMATO JSON:
{
  "resumenEjecutivo": "Párrafo con el diagnóstico general del grupo sobre este contenido",
  "estadisticas": {
    "totalEstudiantes": 0,
    "promedioScore": 0,
    "scoreMaximo": 0,
    "scoreMinimo": 0,
    "desviacionEstandar": 0
  },
  "conceptosMasDominados": [
    {"concepto": "Nombre", "porcentajeDominio": 80, "comentario": "..."}
  ],
  "conceptosMenosDominados": [
    {"concepto": "Nombre", "porcentajeDominio": 25, "comentario": "..."}
  ],
  "patronesDeError": [
    {"patron": "Descripción", "tipo": "conceptual|procedimental", "frecuencia": "muy frecuente|frecuente|ocasional"}
  ],
  "recomendacionesPedagogicas": [
    {
      "prioridad": "alta|media|baja",
      "recomendacion": "Recomendación específica",
      "estrategiaSugerida": "Cómo implementarla"
    }
  ],
  "estudiantesEnRiesgo": [
    {"nombre": "Nombre", "score": 20, "conceptosCriticos": ["concepto1"]}
  ],
  "alertasDocente": ["Alerta importante"]
}`;

export async function contentReportAgent(studentResults, contentTitle, contentTopic, schoolGrade) {
    if (!studentResults || studentResults.length === 0) {
        return null;
    }

    const summaries = studentResults.map(r => ({
        nombre: r.studentName || 'Estudiante',
        intento: r.attemptNumber || 1,
        score: r.score,
        total: r.totalQuestions,
        porcentaje: r.percentage,
        diagnostico: r.aiDiagnosis ? (typeof r.aiDiagnosis === 'string' ? JSON.parse(r.aiDiagnosis) : r.aiDiagnosis) : null,
    }));

    const userMessage = `Genera un informe grupal para el profesor sobre el rendimiento de ${summaries.length} estudiantes en el contenido "${contentTitle}" (tema: ${contentTopic}) para grado ${schoolGrade}°.

RESULTADOS INDIVIDUALES:
${JSON.stringify(summaries, null, 2)}

Analiza patrones, identifica conceptos problemáticos y genera recomendaciones pedagógicas específicas al material.`;

    console.log(`[CONTENT-REPORT] Generando reporte grupal: ${summaries.length} estudiantes...`);

    const result = await callGeminiJSON(CONTENT_REPORT_PROMPT, userMessage, {
        temperature: 0.4,
        max_tokens: 4096,
    });

    if (!result) {
        const scores = summaries.map(s => s.porcentaje);
        return {
            resumenEjecutivo: 'No se pudo generar el análisis IA. Intente de nuevo.',
            estadisticas: {
                totalEstudiantes: summaries.length,
                promedioScore: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
                scoreMaximo: Math.max(...scores),
                scoreMinimo: Math.min(...scores),
            },
            conceptosMasDominados: [],
            conceptosMenosDominados: [],
            patronesDeError: [],
            recomendacionesPedagogicas: [],
            estudiantesEnRiesgo: [],
            alertasDocente: [],
        };
    }

    console.log(`[CONTENT-REPORT] Reporte generado exitosamente`);
    return result;
}
