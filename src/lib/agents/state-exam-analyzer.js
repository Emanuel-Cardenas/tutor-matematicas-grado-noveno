// Agente Especializado de Análisis de Pruebas de Estado — Simulacro Saber 11
// Este agente genera un análisis COMPLETO y DETALLADO de un simulacro tipo ICFES.
// Se usa EXCLUSIVAMENTE en la ruta de pruebas de estado.
// NO reemplaza ni modifica los agentes del diagnóstico.
import { callGeminiJSON } from '@/lib/gemini';

const STATE_EXAM_ANALYZER_PROMPT = `Eres un analista experto en la Prueba de Matemáticas Saber 11 del ICFES (Instituto Colombiano para la Evaluación de la Educación). Tu especialidad es analizar resultados de simulacros para generar informes de alto nivel técnico y pedagógico.

═══════════════════════════════════════════
MARCO DE EVALUACIÓN OFICIAL ICFES — SABER 11
═══════════════════════════════════════════

1. COMPETENCIAS EVALUADAS (cómo piensa el estudiante):

   a) INTERPRETACIÓN Y REPRESENTACIÓN (IR) — ~34% del examen:
      Comprender y transformar información matemática entre diferentes formatos:
      tablas, gráficas, expresiones algebraicas, diagramas, lenguaje verbal.
      Reconocer significado de datos, relaciones, tendencias. Comunicar ideas
      matemáticas con claridad y traducir entre sistemas de representación.

   b) FORMULACIÓN Y EJECUCIÓN (FE) — ~43% del examen:
      Plantear, modelar y resolver problemas seleccionando estrategias y
      herramientas matemáticas. Traducir situaciones a lenguaje matemático,
      ejecutar procedimientos y verificar resultados. Integra planificación,
      toma de decisiones y aplicación técnica.

   c) ARGUMENTACIÓN (AR) — ~23% del examen:
      Validar, justificar o refutar procedimientos y resultados usando razones
      fundamentadas en conceptos y propiedades matemáticas. Detectar errores,
      comparar estrategias, usar lenguaje preciso para sustentar ideas.

2. COMPONENTES DE CONTENIDO (qué sabe el estudiante):

   a) NUMÉRICO-VARIACIONAL (NV) — Álgebra y Cálculo:
      Números, operaciones, patrones, variables, funciones, ecuaciones,
      proporcionalidad, variación lineal e inversa.

   b) GEOMÉTRICO-MÉTRICO (GM) — Geometría:
      Espacio, figuras, transformaciones, magnitudes (longitud, área, volumen),
      razones trigonométricas, ley de senos y cosenos.

   c) ALEATORIO (AL) — Estadística:
      Datos, tablas, gráficas, medidas de tendencia central y dispersión,
      probabilidad, combinatoria, muestreo, correlación.

3. NIVELES DE DESEMPEÑO ICFES (Puntaje 0-100):

   NIVEL 1 (0-35): Lee información puntual en tablas/gráficas. Compara datos
   simples sin operaciones. Reconoce promedio, moda, máximo, mínimo.

   NIVEL 2 (36-50): Compara y relaciona datos. Extrae información directa.
   Selecciona gráficas correspondientes. Manipulaciones aritméticas sencillas.
   Justifica con un único argumento.

   NIVEL 3 (51-70): Interpreta, señala errores, transforma entre registros.
   Manipulaciones algebraicas sencillas. Proporcionalidad, factores de conversión,
   áreas y desarrollos planos.

   NIVEL 4 (71-100): Resuelve problemas complejos. Modela con lenguaje algebraico.
   Manipula expresiones algebraicas con propiedades. Probabilidad, permutaciones.
   Justifica con múltiples conceptos formales.

4. TIPOS DE CONTENIDO:
   - GENÉRICO (Razonamiento Cuantitativo): Contenidos compartidos con otras pruebas.
     Estadística básica, aritmética, proporcionalidad, lectura de gráficas.
   - NO GENÉRICO: Contenidos exclusivos de Matemáticas.
     Trigonometría, funciones, cálculo, geometría avanzada, álgebra formal.

═══════════════════════════════════════════
INSTRUCCIONES DE ANÁLISIS:
═══════════════════════════════════════════

1. ANÁLISIS POR COMPETENCIA ICFES:
   Para cada competencia (IR, FE, AR):
   - Porcentaje de acierto
   - Estado: "crítico" (<40%), "en desarrollo" (40-60%), "adecuado" (60-80%), "avanzado" (>80%)
   - Preguntas correctas e incorrectas en esa competencia
   - Patrones de error observados
   - Interpretación pedagógica

2. ANÁLISIS POR COMPONENTE:
   Para cada componente (NV/Álgebra, GM/Geometría, AL/Estadística):
   - Porcentaje de acierto
   - Desglose genérico vs no genérico
   - Estado
   - Temas fuertes y débiles dentro del componente

3. ANÁLISIS INDIVIDUAL DE PREGUNTAS:
   Para CADA pregunta (correcta e incorrecta):
   - Competencia a la que pertenece (IR, FE, AR)
   - Componente (NV, GM, AL)
   - Si es genérico o no genérico
   - Si fue incorrecta: tipo de error, explicación detallada, respuesta correcta explicada
   - Si fue correcta: nivel de dominio (automático/razonado) según tiempo

4. PATRONES DE ERROR:
   Detecta patrones transversales como:
   - Errores sistemáticos en un componente
   - Confusiones recurrentes entre conceptos
   - Debilidad en una competencia específica
   - Problemas con contenido genérico vs no genérico
   - Preguntas respondidas demasiado rápido (posible adivinanza)
   - Preguntas con tiempo excesivo (posible bloqueo)

5. PUNTAJE ICFES ESTIMADO:
   Estima un puntaje en escala 0-100 basado en:
   - Porcentaje de acierto general
   - Dificultad de las preguntas acertadas
   - Distribución por competencia
   - Distribución por componente

6. RECOMENDACIONES ESPECÍFICAS SABER 11:
   - Por prioridad (alta/media/baja)
   - Enfocadas en mejorar el puntaje real del ICFES
   - Con ejercicios concretos tipo Saber 11
   - Estrategias de examen (manejo de tiempo, eliminación de distractores)

═══════════════════════════════════════════
FORMATO DE RESPUESTA (JSON ESTRICTO):
═══════════════════════════════════════════
{
  "resumenEjecutivo": "Párrafo de 3-5 oraciones resumiendo el desempeño global con terminología ICFES, lenguaje profesional y motivador.",
  "puntajeEstimadoICFES": 62,
  "nivelDesempenoICFES": {
    "nivel": 3,
    "nombre": "Satisfactorio",
    "rangoOficial": "51-70",
    "descripcion": "El estudiante selecciona e interpreta información, señala errores y realiza manipulaciones algebraicas sencillas para resolver problemas que involucran proporcionalidad y áreas."
  },
  "rendimientoPorCompetencia": {
    "interpretacionRepresentacion": {
      "porcentaje": 70,
      "estado": "adecuado",
      "preguntasTotal": 17,
      "preguntasCorrectas": 12,
      "descripcion": "Descripción detallada del desempeño en esta competencia con fortalezas y brechas.",
      "patrones": ["Buen manejo de lectura de gráficas", "Dificultad al traducir verbal → algebraico"],
      "preguntasDestacadas": [
        {"index": 1, "isCorrect": true, "nota": "Lectura directa de tabla"},
        {"index": 7, "isCorrect": false, "nota": "Confundió correlación con causalidad"}
      ]
    },
    "formulacionEjecucion": {
      "porcentaje": 55,
      "estado": "en desarrollo",
      "preguntasTotal": 21,
      "preguntasCorrectas": 12,
      "descripcion": "...",
      "patrones": ["..."],
      "preguntasDestacadas": [{"index": 11, "isCorrect": false, "nota": "..."}]
    },
    "argumentacion": {
      "porcentaje": 45,
      "estado": "en desarrollo",
      "preguntasTotal": 12,
      "preguntasCorrectas": 5,
      "descripcion": "...",
      "patrones": ["..."],
      "preguntasDestacadas": [{"index": 34, "isCorrect": false, "nota": "..."}]
    }
  },
  "rendimientoPorComponente": {
    "estadistica": {
      "porcentaje": 70,
      "estado": "adecuado",
      "preguntasTotal": 10,
      "preguntasCorrectas": 7,
      "descripcion": "...",
      "temasDebiles": ["Combinatoria", "Dispersión"],
      "temasFuertes": ["Lectura de gráficas", "Mediana", "Probabilidad básica"],
      "genericoVsNoGenerico": {"genericoPct": 80, "noGenericoPct": 50}
    },
    "geometria": {
      "porcentaje": 55,
      "estado": "en desarrollo",
      "preguntasTotal": 12,
      "preguntasCorrectas": 7,
      "descripcion": "...",
      "temasDebiles": ["Trigonometría", "Ley del coseno"],
      "temasFuertes": ["Área de rectángulos", "Perímetro"],
      "genericoVsNoGenerico": {"genericoPct": 80, "noGenericoPct": 40}
    },
    "algebraCalculo": {
      "porcentaje": 50,
      "estado": "en desarrollo",
      "preguntasTotal": 28,
      "preguntasCorrectas": 14,
      "descripcion": "...",
      "temasDebiles": ["Funciones cuadráticas", "Logaritmos", "Progresiones"],
      "temasFuertes": ["Ecuaciones lineales", "Proporcionalidad directa"],
      "genericoVsNoGenerico": {"genericoPct": 70, "noGenericoPct": 35}
    }
  },
  "analisisIndividual": [
    {
      "questionIndex": 1,
      "isCorrect": true,
      "competencia": "Interpretación y representación",
      "competenciaCode": "IR",
      "componente": "Estadística",
      "componenteCode": "AL",
      "esGenerico": true,
      "dificultad": "facil",
      "tiempoSegundos": 25,
      "nivelDominio": "automático",
      "observacion": "Respondió correctamente y con rapidez, indica dominio sólido de lectura de tablas."
    },
    {
      "questionIndex": 3,
      "isCorrect": false,
      "competencia": "Formulación y ejecución",
      "competenciaCode": "FE",
      "componente": "Estadística",
      "componenteCode": "AL",
      "esGenerico": true,
      "dificultad": "media",
      "tiempoSegundos": 45,
      "errorType": "procedimental",
      "selectedOption": "A",
      "correctOption": "B",
      "explicacionError": "El estudiante eligió A (110) sin ordenar los datos de menor a mayor. Para hallar la mediana, primero se ordenan: 95, 95, 110, 120, 130, 140, 150. La mediana es el valor central: 120.",
      "explicacionCorrecta": "Se ordenan los 7 datos: 95, 95, 110, 120, 130, 140, 150. Como hay un número impar de datos, la mediana es el dato central (posición 4): 120.",
      "conceptoDebil": "Procedimiento para calcular la mediana (requiere ordenamiento previo)",
      "distractorActivado": "La opción A (110) corresponde a uno de los datos originales que está en posición central SIN ordenar."
    }
  ],
  "patronesDeError": [
    {
      "patron": "Errores procedimentales en estadística",
      "frecuencia": 3,
      "gravedad": "media",
      "descripcion": "El estudiante comprende los conceptos estadísticos básicos pero omite pasos procedimentales clave (como ordenar datos antes de calcular la mediana).",
      "preguntasAfectadas": [3, 8, 9]
    }
  ],
  "fortalezasEspecificas": [
    "Lectura directa de tablas y gráficas de barras — componente base del Razonamiento Cuantitativo",
    "Cálculo de áreas y perímetros de figuras regulares",
    "Resolución de ecuaciones lineales simples y proporcionalidad directa"
  ],
  "debilidadesEspecificas": [
    "Contenido no genérico de Álgebra: funciones cuadráticas, logaritmos y progresiones",
    "Argumentación: dificultad para justificar con múltiples propiedades",
    "Trigonometría y ley del coseno"
  ],
  "tendenciasRespuesta": {
    "posiblesAdivinanzas": [
      {"index": 38, "tiempo": 4, "nota": "Respuesta en 4 segundos en pregunta de dificultad alta — posible adivinanza"}
    ],
    "bloqueos": [
      {"index": 20, "tiempo": 185, "nota": "Más de 3 minutos en ley del coseno — posible bloqueo conceptual"}
    ],
    "dominioAutomatico": [
      {"index": 1, "tiempo": 12, "nota": "Lectura de tabla resuelta en 12 segundos — dominio automático"}
    ],
    "observacionGeneral": "El estudiante muestra tiempos razonables en contenido genérico pero se ralentiza significativamente en contenido no genérico, especialmente en geometría avanzada y álgebra formal."
  },
  "recomendacionesSaber11": {
    "alta": [
      {
        "tema": "Funciones cuadráticas y sus gráficas",
        "componente": "Álgebra y Cálculo",
        "competencia": "Interpretación y representación",
        "razon": "3 errores en preguntas de funciones cuadráticas. Es contenido frecuente en Saber 11.",
        "ejercicios": [
          "Identifica vértice, concavidad y ceros de f(x) = -(x-2)² + 4 a partir de su gráfica",
          "Relaciona la ecuación f(x) = x² - 5x + 6 con su tabla de valores"
        ],
        "estrategiaExamen": "En el ICFES, las preguntas de funciones cuadráticas suelen dar la gráfica y pedir identificar la ecuación. Practica reconocer la concavidad (signo de 'a') y la posición del vértice."
      }
    ],
    "media": [
      {
        "tema": "Mediana y medidas de dispersión",
        "componente": "Estadística",
        "competencia": "Formulación y ejecución",
        "razon": "Error procedimental al no ordenar datos antes de calcular la mediana.",
        "ejercicios": [
          "Ordena y calcula la mediana de: 45, 32, 67, 21, 53, 67, 38",
          "Calcula el rango y la desviación estándar de un conjunto de 8 datos"
        ],
        "estrategiaExamen": "Siempre ordena los datos de menor a mayor ANTES de buscar la mediana. Si hay número par de datos, promedia los dos centrales."
      }
    ],
    "baja": [],
    "estrategiasGenerales": [
      "Dedica los primeros 5 minutos a las preguntas de contenido genérico (estadística básica, porcentajes, proporciones) — son las más rápidas de resolver.",
      "En preguntas de argumentación, descarta primero las opciones que incluyen afirmaciones absolutas ('siempre', 'nunca') — suelen ser falsas.",
      "Si no sabes una pregunta de trigonometría o logaritmos, márcala y vuelve al final. No pierdas más de 2 minutos por pregunta."
    ]
  },
  "comparacionDesempeno": {
    "promedioNacionalEstimado": 52,
    "posicionEstimada": "El puntaje estimado de 62 ubica al estudiante por encima del promedio nacional (~52 puntos), en el rango superior del Nivel 3.",
    "metaSiguiente": "Para alcanzar Nivel 4 (≥71 puntos), necesita mejorar principalmente en contenido no genérico de Álgebra y en la competencia de Argumentación."
  },
  "mensajeMotivador": "Frase personalizada de 2-3 oraciones basada en las fortalezas reales detectadas."
}

REGLAS IMPORTANTES:
1. Analiza TODAS las preguntas, correctas e incorrectas.
2. Las explicaciones de error deben ser CLARAS, en español colombiano, con razonamiento matemático paso a paso.
3. El resumen ejecutivo debe ser PROFESIONAL y MOTIVADOR.
4. Los ejercicios recomendados deben ser CONCRETOS tipo Saber 11, no genéricos.
5. La clasificación de competencia y componente debe basarse en las etiquetas/metadatos de cada pregunta cuando estén disponibles.
6. Si una pregunta no tiene metadatos de competencia/componente, infiere según el contenido.`;

/**
 * Analiza un simulacro completo de Pruebas de Estado Saber 11.
 * Genera un informe integral con análisis por competencias ICFES,
 * componentes, niveles de desempeño, patrones de error y recomendaciones.
 *
 * @param {object[]} questions — Preguntas del simulacro con texto, opciones, respuesta correcta, topic, metadata
 * @param {(string|null)[]} studentAnswers — Respuestas del estudiante (A/B/C/D o null)
 * @param {boolean[]} isCorrectArray — Array de verdad absoluta de correctas/incorrectas
 * @param {number[]} questionTimings — Tiempo en ms por pregunta
 * @param {number} totalTimeMs — Tiempo total del simulacro en ms
 * @returns {Promise<object>} — Análisis completo en formato JSON
 */
export async function stateExamAnalyzerAgent(questions, studentAnswers, isCorrectArray, questionTimings, totalTimeMs) {
    // Construir datos enriquecidos por pregunta
    const questionsWithAnswers = questions.map((q, i) => {
        const raw = studentAnswers[i] || null;
        const isCorrect = isCorrectArray && isCorrectArray.length > i ? isCorrectArray[i] : false;
        const timeMs = questionTimings[i] || 0;

        // Intentar extraer metadatos de competencia/componente del campo metadata o explanation
        let competencia = null;
        let componente = null;
        let esGenerico = null;

        try {
            const meta = JSON.parse(q.metadata || '{}');
            const explanation = meta.explanation || q.explanation || '';

            // Parsear etiquetas como "Interpretación y representación · Estadística genérica"
            if (explanation) {
                const parts = explanation.split('·').map(s => s.trim());
                if (parts.length >= 1) {
                    const compLower = parts[0].toLowerCase();
                    if (compLower.includes('interpretación') || compLower.includes('representación')) {
                        competencia = 'Interpretación y representación';
                    } else if (compLower.includes('formulación') || compLower.includes('ejecución')) {
                        competencia = 'Formulación y ejecución';
                    } else if (compLower.includes('argumentación')) {
                        competencia = 'Argumentación';
                    }
                }
                if (parts.length >= 2) {
                    const contLower = parts[1].toLowerCase();
                    if (contLower.includes('estadística') || contLower.includes('aleatorio')) {
                        componente = 'Estadística';
                    } else if (contLower.includes('geometría') || contLower.includes('métric')) {
                        componente = 'Geometría';
                    } else if (contLower.includes('álgebra') || contLower.includes('cálculo') || contLower.includes('variacional') || contLower.includes('numéric')) {
                        componente = 'Álgebra y Cálculo';
                    }
                    esGenerico = contLower.includes('genéric') && !contLower.includes('no genéric');
                }
            }
        } catch (e) {
            // metadata parse failed, continue without
        }

        // Fallback: inferir componente desde topic
        if (!componente && q.topic) {
            const topicLower = q.topic.toLowerCase();
            if (topicLower.includes('estadística') || topicLower.includes('probabilidad')) {
                componente = 'Estadística';
            } else if (topicLower.includes('geometría')) {
                componente = 'Geometría';
            } else if (topicLower.includes('álgebra') || topicLower.includes('función') || topicLower.includes('aritmética') || topicLower.includes('cálculo')) {
                componente = 'Álgebra y Cálculo';
            }
        }

        // Obtener texto de opciones para análisis
        let optionsText = null;
        if (q.options) {
            optionsText = Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join(' | ');
        }

        return {
            index: q.index || (i + 1),
            text: q.text,
            options: q.options || null,
            optionsText,
            correctOption: q.correctOption,
            correctOptionText: q.options && q.correctOption ? q.options[q.correctOption] : q.correctOption,
            selectedOption: raw,
            selectedOptionText: raw && q.options ? q.options[raw] : raw,
            isCorrect,
            topic: q.topic,
            difficulty: q.difficulty,
            competencia: competencia || 'No clasificada',
            componente: componente || 'No clasificado',
            esGenerico: esGenerico !== null ? esGenerico : null,
            timeMs,
            timeSeconds: Math.round(timeMs / 1000),
        };
    });

    // Estadísticas globales
    const totalQuestions = questionsWithAnswers.length;
    const totalCorrect = questionsWithAnswers.filter(q => q.isCorrect).length;
    const totalIncorrect = totalQuestions - totalCorrect;
    const porcentajeAcierto = Math.round((totalCorrect / totalQuestions) * 100);

    // Estadísticas por competencia
    const statsByCompetencia = {};
    const statsByComponente = {};
    questionsWithAnswers.forEach(q => {
        // Por competencia
        if (!statsByCompetencia[q.competencia]) {
            statsByCompetencia[q.competencia] = { total: 0, correct: 0 };
        }
        statsByCompetencia[q.competencia].total++;
        if (q.isCorrect) statsByCompetencia[q.competencia].correct++;

        // Por componente
        if (!statsByComponente[q.componente]) {
            statsByComponente[q.componente] = { total: 0, correct: 0 };
        }
        statsByComponente[q.componente].total++;
        if (q.isCorrect) statsByComponente[q.componente].correct++;
    });

    // Estadísticas de tiempo
    const validTimings = questionTimings.filter(t => t > 0);
    const avgTimeMs = validTimings.length > 0 ? validTimings.reduce((a, b) => a + b, 0) / validTimings.length : 0;
    const fastResponses = questionTimings.filter(t => t > 0 && t < 10000).length;
    const slowResponses = questionTimings.filter(t => t > 120000).length;

    let slowest = null, fastest = null;
    if (validTimings.length > 0) {
        let maxTime = 0, minTime = Infinity, maxIdx = 0, minIdx = 0;
        questionTimings.forEach((t, i) => {
            if (t > maxTime) { maxTime = t; maxIdx = i; }
            if (t > 0 && t < minTime) { minTime = t; minIdx = i; }
        });
        if (maxTime > 0) slowest = { index: maxIdx + 1, time: maxTime };
        if (minTime < Infinity) fastest = { index: minIdx + 1, time: minTime };
    }

    const userMessage = `Analiza el siguiente simulacro de Pruebas de Estado Saber 11 — Matemáticas.

══════════════════════════════════════
ESTADÍSTICAS GLOBALES:
══════════════════════════════════════
- Total de preguntas: ${totalQuestions}
- Respuestas correctas: ${totalCorrect} (${porcentajeAcierto}%)
- Respuestas incorrectas: ${totalIncorrect}
- Tiempo total: ${Math.round(totalTimeMs / 1000)} segundos (${Math.round(totalTimeMs / 60000)} minutos)
- Tiempo promedio por pregunta: ${Math.round(avgTimeMs / 1000)} segundos
- Respuestas apuradas (<10s): ${fastResponses}
- Respuestas con bloqueo (>2min): ${slowResponses}
- Pregunta más lenta: #${slowest?.index || '?'} (${Math.round((slowest?.time || 0) / 1000)}s)
- Pregunta más rápida: #${fastest?.index || '?'} (${Math.round((fastest?.time || 0) / 1000)}s)

══════════════════════════════════════
ESTADÍSTICAS POR COMPETENCIA:
══════════════════════════════════════
${Object.entries(statsByCompetencia).map(([comp, s]) =>
    `- ${comp}: ${s.correct}/${s.total} (${Math.round((s.correct / s.total) * 100)}%)`
).join('\n')}

══════════════════════════════════════
ESTADÍSTICAS POR COMPONENTE:
══════════════════════════════════════
${Object.entries(statsByComponente).map(([comp, s]) =>
    `- ${comp}: ${s.correct}/${s.total} (${Math.round((s.correct / s.total) * 100)}%)`
).join('\n')}

══════════════════════════════════════
PREGUNTAS Y RESPUESTAS DETALLADAS:
══════════════════════════════════════
${JSON.stringify(questionsWithAnswers, null, 2)}

══════════════════════════════════════
INSTRUCCIONES:
══════════════════════════════════════
1. Usa las etiquetas de competencia/componente ya clasificadas para cada pregunta.
2. Si una pregunta dice "No clasificada", infiere la competencia y componente según su contenido.
3. Para las preguntas INCORRECTAS: explica el error paso a paso y la solución correcta paso a paso.
4. Para las preguntas CORRECTAS: evalúa el nivel de dominio según el tiempo empleado.
5. Estima el puntaje ICFES en escala 0-100 considerando el porcentaje de acierto y la dificultad.
6. Las recomendaciones deben incluir ejercicios CONCRETOS tipo Saber 11.
7. El resumen ejecutivo debe ser profesional y motivador, con terminología ICFES.
8. Analiza TODAS las ${totalQuestions} preguntas en "analisisIndividual".`;

    const result = await callGeminiJSON(STATE_EXAM_ANALYZER_PROMPT, userMessage);

    if (!result) {
        return buildFallbackResult(questionsWithAnswers, totalCorrect, totalIncorrect, porcentajeAcierto, totalTimeMs, questionTimings);
    }

    // Asegurar que campos críticos existen con fallback
    return {
        resumenEjecutivo: result.resumenEjecutivo || 'Análisis completado.',
        puntajeEstimadoICFES: result.puntajeEstimadoICFES || Math.round(porcentajeAcierto * 0.85 + 15),
        nivelDesempenoICFES: result.nivelDesempenoICFES || inferNivelICFES(porcentajeAcierto),
        rendimientoPorCompetencia: result.rendimientoPorCompetencia || buildFallbackCompetencias(statsByCompetencia),
        rendimientoPorComponente: result.rendimientoPorComponente || buildFallbackComponentes(statsByComponente),
        analisisIndividual: result.analisisIndividual || [],
        patronesDeError: result.patronesDeError || [],
        fortalezasEspecificas: result.fortalezasEspecificas || [],
        debilidadesEspecificas: result.debilidadesEspecificas || [],
        tendenciasRespuesta: result.tendenciasRespuesta || { posiblesAdivinanzas: [], bloqueos: [], dominioAutomatico: [], observacionGeneral: '' },
        recomendacionesSaber11: result.recomendacionesSaber11 || { alta: [], media: [], baja: [], estrategiasGenerales: [] },
        comparacionDesempeno: result.comparacionDesempeno || { promedioNacionalEstimado: 52, posicionEstimada: '', metaSiguiente: '' },
        mensajeMotivador: result.mensajeMotivador || '¡Buen trabajo completando el simulacro!',
        // Datos crudos para backward compatibility
        totalCorrect,
        totalIncorrect,
        porcentajeAcierto,
        timeData: {
            totalTimeMs,
            avgTimeMs,
            slowest,
            fastest,
            slowQuestions: slowResponses,
            fastQuestions: fastResponses,
        },
    };
}

function inferNivelICFES(porcentaje) {
    if (porcentaje >= 71) return { nivel: 4, nombre: 'Avanzado', rangoOficial: '71-100', descripcion: 'Resuelve problemas complejos, modela con lenguaje algebraico, manipula expresiones con propiedades, y justifica con múltiples conceptos formales.' };
    if (porcentaje >= 51) return { nivel: 3, nombre: 'Satisfactorio', rangoOficial: '51-70', descripcion: 'Selecciona e interpreta información, señala errores y realiza manipulaciones algebraicas sencillas en contextos de proporcionalidad y áreas.' };
    if (porcentaje >= 36) return { nivel: 2, nombre: 'Mínimo', rangoOficial: '36-50', descripcion: 'Compara y relaciona datos, extrae información directa, realiza manipulaciones aritméticas sencillas y justifica con un único argumento.' };
    return { nivel: 1, nombre: 'Insuficiente', rangoOficial: '0-35', descripcion: 'Lee información puntual en tablas y gráficas, compara datos simples sin operaciones y reconoce promedio, moda, máximo y mínimo.' };
}

function buildFallbackCompetencias(stats) {
    const buildOne = (key, name) => {
        const s = stats[name] || { total: 0, correct: 0 };
        const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        return {
            porcentaje: pct,
            estado: pct >= 80 ? 'avanzado' : pct >= 60 ? 'adecuado' : pct >= 40 ? 'en desarrollo' : 'crítico',
            preguntasTotal: s.total,
            preguntasCorrectas: s.correct,
            descripcion: `${s.correct} de ${s.total} preguntas correctas.`,
            patrones: [],
            preguntasDestacadas: [],
        };
    };
    return {
        interpretacionRepresentacion: buildOne('ir', 'Interpretación y representación'),
        formulacionEjecucion: buildOne('fe', 'Formulación y ejecución'),
        argumentacion: buildOne('ar', 'Argumentación'),
    };
}

function buildFallbackComponentes(stats) {
    const buildOne = (name) => {
        const s = stats[name] || { total: 0, correct: 0 };
        const pct = s.total > 0 ? Math.round((s.correct / s.total) * 100) : 0;
        return {
            porcentaje: pct,
            estado: pct >= 80 ? 'avanzado' : pct >= 60 ? 'adecuado' : pct >= 40 ? 'en desarrollo' : 'crítico',
            preguntasTotal: s.total,
            preguntasCorrectas: s.correct,
            descripcion: `${s.correct} de ${s.total} preguntas correctas.`,
            temasDebiles: [],
            temasFuertes: [],
            genericoVsNoGenerico: { genericoPct: 0, noGenericoPct: 0 },
        };
    };
    return {
        estadistica: buildOne('Estadística'),
        geometria: buildOne('Geometría'),
        algebraCalculo: buildOne('Álgebra y Cálculo'),
    };
}

function buildFallbackResult(questions, totalCorrect, totalIncorrect, porcentaje, totalTimeMs, timings) {
    const validTimings = timings.filter(t => t > 0);
    const avgTimeMs = validTimings.length > 0 ? validTimings.reduce((a, b) => a + b, 0) / validTimings.length : 0;

    return {
        resumenEjecutivo: 'El análisis automático no pudo generarse en este momento. Los datos cuantitativos están disponibles.',
        puntajeEstimadoICFES: Math.round(porcentaje * 0.85 + 15),
        nivelDesempenoICFES: inferNivelICFES(porcentaje),
        rendimientoPorCompetencia: {
            interpretacionRepresentacion: { porcentaje: 0, estado: 'sin datos', preguntasTotal: 0, preguntasCorrectas: 0, descripcion: '', patrones: [], preguntasDestacadas: [] },
            formulacionEjecucion: { porcentaje: 0, estado: 'sin datos', preguntasTotal: 0, preguntasCorrectas: 0, descripcion: '', patrones: [], preguntasDestacadas: [] },
            argumentacion: { porcentaje: 0, estado: 'sin datos', preguntasTotal: 0, preguntasCorrectas: 0, descripcion: '', patrones: [], preguntasDestacadas: [] },
        },
        rendimientoPorComponente: {
            estadistica: { porcentaje: 0, estado: 'sin datos', preguntasTotal: 0, preguntasCorrectas: 0, descripcion: '', temasDebiles: [], temasFuertes: [], genericoVsNoGenerico: { genericoPct: 0, noGenericoPct: 0 } },
            geometria: { porcentaje: 0, estado: 'sin datos', preguntasTotal: 0, preguntasCorrectas: 0, descripcion: '', temasDebiles: [], temasFuertes: [], genericoVsNoGenerico: { genericoPct: 0, noGenericoPct: 0 } },
            algebraCalculo: { porcentaje: 0, estado: 'sin datos', preguntasTotal: 0, preguntasCorrectas: 0, descripcion: '', temasDebiles: [], temasFuertes: [], genericoVsNoGenerico: { genericoPct: 0, noGenericoPct: 0 } },
        },
        analisisIndividual: [],
        patronesDeError: [],
        fortalezasEspecificas: [],
        debilidadesEspecificas: [],
        tendenciasRespuesta: { posiblesAdivinanzas: [], bloqueos: [], dominioAutomatico: [], observacionGeneral: '' },
        recomendacionesSaber11: { alta: [], media: [], baja: [], estrategiasGenerales: [] },
        comparacionDesempeno: { promedioNacionalEstimado: 52, posicionEstimada: '', metaSiguiente: '' },
        mensajeMotivador: '¡Completaste el simulacro! Eso ya es un gran paso.',
        totalCorrect,
        totalIncorrect,
        porcentajeAcierto: porcentaje,
        timeData: {
            totalTimeMs,
            avgTimeMs,
            slowest: null,
            fastest: null,
            slowQuestions: 0,
            fastQuestions: 0,
        },
    };
}
