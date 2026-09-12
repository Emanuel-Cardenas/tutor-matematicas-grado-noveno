// Agente de Informe Grupal por Grado
// Consolida los reportes individuales de diagnóstico para generar un análisis grupal
// con recomendaciones pedagógicas accionables para el docente
import { callGeminiJSON } from '@/lib/gemini';

const GROUP_REPORT_PROMPT = `Eres un analista educativo experto en matemáticas, especializado en el currículo del Ministerio de Educación Nacional de Colombia (MEN).

Tu tarea es CONSOLIDAR los reportes individuales de diagnóstico de un grupo de estudiantes del mismo grado y generar un INFORME GRUPAL completo para el docente.

Los 4 PENSAMIENTOS MATEMÁTICOS MEN son:
1. Pensamiento Numérico y Variacional (incluye numeración, operaciones, variables, funciones, patrones, proporcionalidad)
2. Pensamiento Variacional (álgebra, patrones, funciones, ecuaciones)
3. Pensamiento Espacial y Métrico (espacio, figuras, transformaciones, medidas, razonamiento geométrico)
4. Pensamiento Aleatorio y Sistemas de Datos (representación de datos, tendencia central, dispersión, probabilidad, inferencia)

INSTRUCCIONES:
1. Recibes los diagnósticos individuales de TODOS los estudiantes del grado.
2. Analiza la información de forma agregada para identificar patrones grupales.
3. Genera un informe que le permita al docente entender rápidamente el estado del grupo SIN tener que revisar estudiante por estudiante.

El informe debe ser claro, accionable y orientado a la toma de decisiones pedagógicas.

FORMATO DE RESPUESTA (JSON):
{
  "diagnosticoGrupal": "Párrafo completo con el diagnóstico general del grupo. Describir el estado académico global, tendencias detectadas y nivel de preparación del grupo respecto a lo esperado para el grado según el MEN.",
  "nivelGeneralGrupo": {
    "estimado": 7,
    "esperado": 9,
    "brecha": "Descripción de la brecha entre lo que el grupo demuestra y lo esperado para el grado"
  },
  "rendimientoPorPensamiento": {
    "numerico": { "porcentaje": 65, "estado": "en desarrollo", "observacion": "Estado del grupo en pensamiento numérico, operaciones y números" },
    "variacional": { "porcentaje": 40, "estado": "critico", "observacion": "Estado del grupo en álgebra, patrones y funciones" },
    "espacialMetrico": { "porcentaje": 55, "estado": "en desarrollo", "observacion": "Estado del grupo en geometría, medidas y formas" },
    "aleatorio": { "porcentaje": 70, "estado": "adecuado", "observacion": "Estado del grupo en estadística y probabilidad" }
  },
  "temasMasDominados": [
    {
      "tema": "Nombre del tema",
      "eje": "Álgebra y Cálculo|Geometría|Estadística",
      "porcentajeDominio": 80,
      "comentario": "Por qué el grupo domina este tema"
    }
  ],
  "temasMenosDominados": [
    {
      "tema": "Nombre del tema",
      "eje": "Álgebra y Cálculo|Geometría|Estadística",
      "porcentajeDominio": 25,
      "comentario": "Por qué el grupo tiene dificultad y cómo afecta su aprendizaje"
    }
  ],
  "debilidadesColectivas": [
    {
      "debilidad": "Descripción de la debilidad grupal",
      "gravedad": "alta|media|baja",
      "estudiantesAfectados": "mayoría|mitad|algunos",
      "impactoAcademico": "Cómo impacta esta debilidad en el aprendizaje del grupo"
    }
  ],
  "patronesDeError": [
    {
      "patron": "Descripción del patrón de error recurrente",
      "tipo": "conceptual|procedimental|aritmetico|interpretacion",
      "frecuencia": "muy frecuente|frecuente|ocasional"
    }
  ],
  "recomendacionesPedagogicas": [
    {
      "prioridad": "alta|media|baja",
      "recomendacion": "Recomendación específica y accionable para el docente",
      "temaRelacionado": "Tema al que aplica",
      "estrategiaSugerida": "Cómo implementar la recomendación en el aula"
    }
  ],
  "planDeAccion": {
    "metaPrincipal": "Objetivo principal de mejora para el grupo",
    "fasesDeAccion": [
      {
        "fase": "Fase 1: Nombre descriptivo",
        "duracion": "2 semanas",
        "actividades": ["Actividad 1", "Actividad 2"],
        "temasACubrir": ["Tema 1", "Tema 2"]
      }
    ],
    "indicadoresDeExito": ["Indicador medible 1", "Indicador medible 2"]
  },
  "alertasDocente": [
    "Alerta o dato crítico que el docente debe conocer inmediatamente"
  ]
}`;

export async function groupReportAgent(individualReports, grade) {
    if (!individualReports || individualReports.length === 0) {
        return null;
    }

    // Construir resumen de los reportes individuales (limitar a lo esencial para no exceder tokens)
    const reportSummaries = individualReports.map((report, i) => {
        const summary = {
            estudiante: report.studentName || `Estudiante ${i + 1}`,
            score: report.score,
            totalPreguntas: report.totalQuestions,
            porcentaje: report.totalQuestions > 0 ? Math.round((report.score / report.totalQuestions) * 100) : 0,
        };

        // Agregar diagnóstico IA si existe
        if (report.aiDiagnosis) {
            summary.diagnostico = {
                nivelEstimado: report.aiDiagnosis.nivelEstimado,
                temasDominados: (report.aiDiagnosis.temasDominados || []).map(t => t.tema),
                temasConDificultad: (report.aiDiagnosis.temasConDificultad || []).map(t => ({ tema: t.tema, nivel: t.nivel })),
                fortalezas: report.aiDiagnosis.fortalezas || [],
                debilidades: report.aiDiagnosis.debilidades || [],
                rendimientoPorCompetencia: report.aiDiagnosis.rendimientoPorCompetencia || report.aiDiagnosis.rendimientoPorPensamiento || null,
                rendimientoPorEje: report.aiDiagnosis.rendimientoPorEje || null,
            };
        }

        // Agregar análisis de errores si existe
        if (report.aiAnalysis) {
            summary.analisisErrores = {
                totalCorrectas: report.aiAnalysis.totalCorrect,
                totalIncorrectas: report.aiAnalysis.totalIncorrect,
                patrones: (report.aiAnalysis.patrones || []).map(p => ({ patron: p.patron, gravedad: p.gravedad })),
            };
        }

        // Agregar recomendaciones si existen
        if (report.aiRecommendations) {
            summary.temasAltaPrioridad = (report.aiRecommendations.temasPorPrioridad?.alta || []).map(t => t.tema);
        }

        return summary;
    });

    const userMessage = `Genera un informe grupal consolidado para el grado ${grade}° de bachillerato en Colombia.

TOTAL DE ESTUDIANTES CON DIAGNÓSTICO: ${reportSummaries.length}

REPORTES INDIVIDUALES:
${JSON.stringify(reportSummaries, null, 2)}

Analiza los datos de TODOS los estudiantes de forma agregada y genera el informe grupal completo.
Identifica tendencias, patrones y proporciona recomendaciones pedagógicas específicas para el docente.
Compara con lo esperado para grado ${grade}° según el currículo MEN de Colombia.`;

    const result = await callGeminiJSON(GROUP_REPORT_PROMPT, userMessage, {
        temperature: 0.4,
        max_tokens: 4096,
    });

    if (!result) {
        return {
            diagnosticoGrupal: 'No se pudo generar el análisis IA del grupo. Intente de nuevo más tarde.',
            nivelGeneralGrupo: { estimado: 0, esperado: grade, brecha: 'Sin datos' },
            rendimientoPorCompetencia: {
                interpretacionRepresentacion: { porcentaje: 0, estado: 'sin datos', observacion: '' },
                formulacionEjecucion: { porcentaje: 0, estado: 'sin datos', observacion: '' },
                argumentacion: { porcentaje: 0, estado: 'sin datos', observacion: '' },
            },
            rendimientoPorEje: {
                algebraCalculo: { porcentaje: 0, estado: 'sin datos', observacion: '' },
                geometria: { porcentaje: 0, estado: 'sin datos', observacion: '' },
                estadistica: { porcentaje: 0, estado: 'sin datos', observacion: '' },
            },
            temasMasDominados: [],
            temasMenosDominados: [],
            debilidadesColectivas: [],
            patronesDeError: [],
            recomendacionesPedagogicas: [],
            planDeAccion: { metaPrincipal: 'No disponible', fasesDeAccion: [], indicadoresDeExito: [] },
            alertasDocente: [],
        };
    }

    return result;
}
