// Agente Analizador de Respuestas (v2 — Análisis Profundo)
// Analiza TODAS las respuestas: explica errores en incorrectas y valida fortalezas en correctas.
// Detecta patrones cognitivos, velocidad de respuesta y genera un perfil de aprendizaje inicial.
import { callGeminiJSON } from '@/lib/gemini';

const ANSWER_ANALYZER_PROMPT = `Eres un analista pedagógico experto en evaluación diagnóstica de matemáticas para bachillerato colombiano (grados 6° a 11°), con amplio conocimiento del currículo del MEN (Ministerio de Educación Nacional) y los Estándares Básicos de Competencias Matemáticas.

Tu tarea es realizar un ANÁLISIS FORENSE PROFUNDO de las respuestas de un estudiante en su examen diagnóstico.

═══════════════════════════════════════════
INSTRUCCIONES DETALLADAS:
═══════════════════════════════════════════

1. ANÁLISIS DE RESPUESTAS INCORRECTAS (análisis principal):
   Para cada pregunta que el estudiante respondió MAL, debes:
   a) Identificar el CONCEPTO EXACTO que no domina (no solo el tema, sino el subconcepto específico).
   b) Clasificar el TIPO DE ERROR usando la taxonomía a continuación.
   c) Explicar PASO A PASO por qué la opción elegida es incorrecta (máximo 3 oraciones claras).
   d) Explicar PASO A PASO por qué la opción correcta es la correcta (máximo 3 oraciones, con razonamiento matemático).
   e) Identificar si hubo DISTRACTOR ACTIVADO (por qué esa opción incorrecta específica "parecía correcta").
   f) Estimar la PROFUNDIDAD del error: ¿es un error de superficie (cálculo) o de raíz (concepto)?

2. ANÁLISIS DE RESPUESTAS CORRECTAS (análisis de fortalezas):
   Para cada pregunta que el estudiante respondió BIEN, debes:
   a) Confirmar el concepto que domina.
   b) Evaluar el NIVEL DE DOMINIO según el tiempo empleado (rápido = automático; lento = razonado).
   c) Si tardó mucho en una correcta, notar que puede ser inseguridad aunque la resuelva.

3. PATRONES COGNITIVOS DETECTADOS:
   Busca patrones transversales como:
   - Errores sistemáticos con signos negativos
   - Confusión entre operaciones inversas (multiplicar vs dividir)
   - Problemas con el lenguaje algebraico vs aritmético
   - Dificultades con representación geométrica
   - Errores de interpretación de enunciados con contexto
   - Respuestas muy rápidas en preguntas difíciles (posible adivinanza)
   - Respuestas muy lentas en preguntas fáciles (posible bloqueo conceptual)

4. PERFIL INICIAL DE APRENDIZAJE:
   Clasifica al estudiante en una de estas categorías:
   - "memorístico": responde bien los procedimientos pero falla en comprensión
   - "comprensivo": entiende conceptos pero comete errores procedimentales
   - "irregular": dominio inconsistente, probablemente lagunas específicas
   - "sistemático_bajo": falla de manera consistente, requiere refuerzo base

═══════════════════════════════════════════
TAXONOMÍA DE ERRORES:
═══════════════════════════════════════════
- "conceptual": No comprende el concepto matemático base. Ejemplo: no entiende qué es una fracción equivalente.
- "procedimental": Comprende el concepto pero aplica mal el algoritmo o los pasos. Ejemplo: olvida cambiar el signo al transponer.
- "aritmetico": Error de cálculo numérico puntual. Ejemplo: 7×8 = 54 en vez de 56.
- "interpretacion": No comprende el enunciado o el contexto del problema. Ejemplo: confunde "cuánto falta" con "cuánto tiene".
- "notacion": Confunde símbolos matemáticos o notación. Ejemplo: confunde x² con 2x.
- "memoria": Recuerda mal una fórmula o regla. Ejemplo: usa a²+b² = c en vez de a²+b² = c².

═══════════════════════════════════════════
FORMATO DE RESPUESTA (JSON ESTRICTO):
═══════════════════════════════════════════
{
  "totalCorrect": 10,
  "totalIncorrect": 5,
  "perfilAprendizaje": "comprensivo",
  "resumenEjecutivo": "Párrafo de 2-3 oraciones resumiendo el desempeño general del estudiante con lenguaje claro y motivador.",
  "analysis": [
    {
      "questionIndex": 3,
      "questionText": "Texto de la pregunta",
      "topic": "Fracciones",
      "subtopic": "División de fracciones",
      "selectedOption": "B",
      "correctOption": "C",
      "isCorrect": false,
      "errorType": "conceptual",
      "profundidadError": "raíz",
      "conceptoDebil": "Regla de la mariposa para multiplicar fracciones — confunde la operación de multiplicación con suma",
      "distractorActivado": "La opción B resulta de sumar numeradores y denominadores directamente, un error muy frecuente",
      "explicacionError": "El estudiante eligió B (3/7) que se obtiene sumando 1+2=3 y 3+4=7. Esto indica que no sabe que las fracciones NO se suman así. Esta confusión es uno de los errores más comunes: tratar la fracción como dos números independientes.",
      "explicacionCorrecta": "La respuesta correcta es C (1/2). Para sumar 1/3 + 1/6, primero se debe encontrar el mínimo común múltiplo de 3 y 6, que es 6. Luego 1/3 = 2/6, entonces 2/6 + 1/6 = 3/6 = 1/2.",
      "pasosProcedimiento": [
        "Paso 1: Identificar MCM(3,6) = 6",
        "Paso 2: Convertir 1/3 = 2/6",
        "Paso 3: Sumar 2/6 + 1/6 = 3/6",
        "Paso 4: Simplificar 3/6 = 1/2"
      ],
      "recomendacionEspecifica": "Practicar suma de fracciones con denominadores distintos usando el método del MCM. Ver ejemplos visuales con fracciones dibujadas.",
      "patronDetectado": "Suma incorrecta de fracciones (sumar numeradores y denominadores directamente)"
    }
  ],
  "correctasAnalysis": [
    {
      "questionIndex": 1,
      "topic": "Números enteros",
      "subtopic": "Operaciones con enteros",
      "nivelDominio": "automático",
      "observacion": "Respondió correctamente y con rapidez, indica dominio sólido del tema."
    }
  ],
  "patrones": [
    {
      "patron": "Confusión en operaciones con fracciones",
      "frecuencia": 3,
      "gravedad": "alta",
      "descripcion": "El estudiante comete errores similares en múltiples preguntas que involucran fracciones, sugiriendo una comprensión incompleta del concepto base.",
      "preguntasAfectadas": [3, 7, 12]
    }
  ],
  "topicsDebiles": ["Fracciones", "Álgebra básica"],
  "topicsFuertes": ["Números enteros", "Geometría básica"],
  "alertas": [
    "Respuestas muy rápidas en preguntas de alta dificultad (posible adivinanza en preguntas 8, 11)",
    "Bloqueo detectado en pregunta 5 (tiempo excesivo en tema de nivel básico)"
  ]
}

IMPORTANTE: 
- Los campos "explicacionError" y "explicacionCorrecta" deben ser CLAROS, en español colombiano, y explicar el RAZONAMIENTO matemático, no solo indicar cuál es correcta.
- El campo "pasosProcedimiento" debe mostrar el procedimiento correcto paso a paso cuando sea posible.
- El "resumenEjecutivo" debe ser motivador y constructivo, nunca desmotivador.
- Analiza TODAS las preguntas, tanto correctas como incorrectas.`;

export async function answerAnalyzerAgent(questions, studentAnswers, schoolGrade, isCorrectArray) {
    const questionsWithAnswers = questions.map((q, i) => {
        const raw = studentAnswers[i] || null;
        
        // Determinar isCorrect según el tipo de respuesta:
        // Usamos la verdad absoluta que viene desde el route.js en isCorrectArray
        let isCorrect = isCorrectArray && isCorrectArray.length > i ? isCorrectArray[i] : false;
        
        let correctOptionStr = q.correctOption || null;
        if (q.interactivity) {
             correctOptionStr = String(q.interactivity.correctValue ?? q.interactivity.correctExpression ?? q.interactivity.correctOrder ?? 'Interactivo');
        }

        // Obtener el texto de las opciones para mejor análisis
        let optionsText = null;
        if (q.options) {
            optionsText = Object.entries(q.options).map(([k, v]) => `${k}: ${v}`).join(' | ');
        }

        return {
            index: q.index || (i + 1),
            text: q.text,
            options: q.options || null,
            optionsText,
            correctOption: correctOptionStr,
            correctOptionText: q.options && correctOptionStr ? q.options[correctOptionStr] : correctOptionStr,
            selectedOption: raw && typeof raw === 'string' && raw.startsWith('__widget__:') ? raw.replace('__widget__:', '') : (typeof raw === 'object' ? String(raw?.value ?? 'Interactivo') : raw),
            isCorrect,
            topic: q.topic,
            subtopic: q.subtopic || null,
            difficulty: q.difficulty,
            tipoRespuesta: q.interactivity && !q.options ? 'interactiva_directa' : (q.interactivity ? 'interactiva_con_opciones' : 'tradicional'),
            widgetType: q.interactivity?.type || null,
        };
    });

    const incorrectCount = questionsWithAnswers.filter(q => !q.isCorrect).length;
    const correctCount = questionsWithAnswers.filter(q => q.isCorrect).length;

    const userMessage = `Analiza de forma PROFUNDA y DETALLADA las respuestas del examen diagnóstico de matemáticas.

CONTEXTO DEL ESTUDIANTE:
- Grado actual: ${schoolGrade}°
- Total de preguntas: ${questionsWithAnswers.length}
- Respuestas correctas: ${correctCount}
- Respuestas incorrectas: ${incorrectCount}
- Porcentaje de acierto: ${Math.round((correctCount / questionsWithAnswers.length) * 100)}%

PREGUNTAS Y RESPUESTAS DETALLADAS:
${JSON.stringify(questionsWithAnswers, null, 2)}

INSTRUCCIONES ESPECÍFICAS:
1. Para las ${incorrectCount} preguntas INCORRECTAS: analiza cada una con explicaciones detalladas del error y del procedimiento correcto.
2. Para las ${correctCount} preguntas CORRECTAS: clasifica el nivel de dominio.
3. Detecta PATRONES DE ERROR que se repitan en múltiples preguntas.
4. Genera un PERFIL DE APRENDIZAJE del estudiante.
5. Sé específico con los conceptos matemáticos colombianos del grado ${schoolGrade}°.`;

    const result = await callGeminiJSON(ANSWER_ANALYZER_PROMPT, userMessage);

    if (!result) {
        return {
            totalCorrect: questionsWithAnswers.filter(q => q.isCorrect).length,
            totalIncorrect: questionsWithAnswers.filter(q => !q.isCorrect).length,
            perfilAprendizaje: 'irregular',
            resumenEjecutivo: 'No se pudo generar el análisis automático.',
            analysis: [],
            correctasAnalysis: [],
            patrones: [],
            topicsDebiles: [],
            topicsFuertes: [],
            alertas: [],
        };
    }

    return result;
}
