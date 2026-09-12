// Agente de Diagnóstico Académico (v3 — Diagnóstico Institucional Profundo)
// Genera un diagnóstico clínico del estudiante alineado al ICFES y al MEN de Colombia.
// Analiza competencias ICFES, ejes de conocimiento, niveles de desempeño y perfil cognitivo.
import { callGeminiJSON } from '@/lib/gemini';
import { CURRICULO_MEN } from '@/lib/curriculo-men';

const ACADEMIC_DIAGNOSTIC_PROMPT = `Eres un diagnosticador académico de alto nivel, especializado en matemáticas y en el currículo del Ministerio de Educación Nacional de Colombia (MEN). Tienes experiencia en evaluación formativa, análisis de brechas de aprendizaje y diseño de planes de intervención pedagógica basados en los Estándares Básicos de Competencias y los Derechos Básicos de Aprendizaje (DBA).

Tu rol es generar un DIAGNÓSTICO ACADÉMICO CLÍNICO Y PROFUNDO del estudiante, como lo haría un psicopedagogo especialista, combinando los datos cuantitativos del examen con interpretación cualitativa basada en el MEN.

═══════════════════════════════════════════
MARCO TEÓRICO QUE DEBES USAR (ICFES + MEN):
═══════════════════════════════════════════

1. COMPETENCIAS ESPECÍFICAS ICFES (cómo piensa el estudiante):

   a) INTERPRETACIÓN Y REPRESENTACIÓN:
      Capacidad para comprender, transformar y expresar información matemática en
      diferentes formas (tablas, gráficas, expresiones algebraicas, diagramas, lenguaje verbal).
      Implica reconocer el significado de los datos y las relaciones que representan,
      y traducir entre distintos sistemas de representación sin perder el sentido.
      Un estudiante con esta competencia desarrollada puede: leer e interpretar
      gráficos/tablas/expresiones, identificar tendencias, representar una misma situación
      de múltiples maneras, detectar inconsistencias y comunicar ideas matemáticas con claridad.

   b) FORMULACIÓN Y EJECUCIÓN:
      Capacidad para plantear, modelar y resolver problemas seleccionando y aplicando
      procedimientos, estrategias y herramientas matemáticas de manera pertinente.
      Implica traducir una situación a lenguaje matemático (ecuaciones, operaciones,
      relaciones) y llevar a cabo los procesos para obtener una solución.
      Integra planificación, toma de decisiones y aplicación técnica.
      Un estudiante con esta competencia: plantea problemas en términos matemáticos,
      elige estrategias adecuadas, ejecuta procedimientos con precisión, verifica
      resultados y adapta métodos cuando la situación lo requiere.

   c) ARGUMENTACIÓN:
      Capacidad para validar, justificar o refutar procedimientos, resultados e
      interpretaciones usando razones fundamentadas en conceptos, propiedades,
      ejemplos o contraejemplos. Constituye manifestación del pensamiento crítico.
      Un estudiante con esta competencia: explica por qué un procedimiento funciona,
      detecta errores en soluciones propias o ajenas, compara estrategias y justifica
      su elección, identifica condiciones bajo las cuales un resultado es válido,
      y usa lenguaje matemático preciso para sustentar ideas.

2. EJES DE CONOCIMIENTOS BÁSICOS (qué sabe el estudiante):

   a) ÁLGEBRA Y CÁLCULO:
      Comprensión de los números y la numeración, significado del número, estructura
      del sistema de numeración; significado de las operaciones, comprensión de sus
      propiedades, efecto y relaciones entre ellas; uso de números y operaciones en
      resolución de problemas, reconocimiento de regularidades y patrones, identificación
      de variables, descripción de fenómenos de cambio y dependencia, y conceptos y
      procedimientos asociados a la variación directa, proporcionalidad, variación lineal
      en contextos aritméticos y geométricos, variación inversa y concepto de función.

   b) GEOMETRÍA:
      Construcción y manipulación de representaciones de objetos del espacio, relaciones
      entre estos y sus transformaciones; comprensión del espacio, desarrollo del
      pensamiento visual, análisis abstracto de figuras y formas en el plano y el espacio
      a través de la observación de patrones y regularidades, razonamiento geométrico,
      construcción de conceptos de magnitud (longitud, área, volumen, capacidad),
      comprensión de los procesos de conservación, estimación de magnitudes, apreciación
      del rango, comprensión de perímetro, área, superficie y volumen.

   c) ESTADÍSTICA:
      Representación, lectura e interpretación de datos en contexto; análisis de diversas
      formas de representación de información numérica, análisis cualitativo de
      regularidades, tendencias, tipos de crecimiento, formulación de inferencias y
      argumentos usando medidas de tendencia central y de dispersión; reconocimiento,
      descripción y análisis de eventos aleatorios.

3. DERECHOS BÁSICOS DE APRENDIZAJE (DBA):
   Competencias mínimas que el estudiante DEBE tener según su grado.

4. NIVELES DE DESEMPEÑO ICFES — Prueba de Matemáticas Saber 11°:

   NIVEL 1 — Puntaje 0 a 35:
   Descriptor general: El estudiante probablemente puede leer información puntual
   relacionada con situaciones cotidianas presentada en tablas o gráficas con escala
   explícita, cuadriculada o con líneas horizontales; pero puede tener dificultades
   para comparar distintos conjuntos de datos, involucrar diferentes variables o
   analizar situaciones alejadas de su vida diaria.
   Descriptores específicos:
   - Compara datos de dos variables presentados en una misma gráfica sin necesidad
     de hacer operaciones aritméticas.
   - Identifica valores o puntos representativos en diferentes tipos de registro
     a partir del significado que tienen en la situación.
   - Compara la probabilidad de eventos simples (casos favorables/casos posibles)
     cuando los casos posibles son los mismos en ambos eventos y en contextos
     similares a los presentados en el aula.
   - Toma decisiones sobre la veracidad o falsedad de una afirmación cuando esta
     se puede explicar verbalizando la lectura directa que se hace de la información.
   - Cambia gráficas de barras a tablas de doble entrada.
   - Reconoce e interpreta, según el contexto, el significado de promedio simple,
     moda, mayor, menor, máximo y mínimo.

   NIVEL 2 — Puntaje 36 a 50:
   Descriptor general: Además de lo descrito en el nivel anterior, el estudiante
   es capaz de hacer comparaciones y establecer relaciones entre los datos
   presentados, e identificar y extraer información local y global de manera
   directa, en contextos familiares o personales que involucran gráficas con escala
   explícita, cuadriculada o con líneas horizontales y otros formatos con poca
   información.
   Descriptores específicos:
   - Selecciona la gráfica (que puede ser de doble entrada) correspondiente a la
     información de una tabla, o a partir de verbalizaciones (características de
     crecimiento o decrecimiento deseadas), teniendo en cuenta la selección de
     la escala, el tipo de variable y el tipo de gráfica.
   - Compara información gráfica que requiere algunas manipulaciones aritméticas.
   - Reconoce errores ocurridos al realizar una transformación entre diferentes
     tipos de registro.
   - Reconoce desarrollos planos de una forma tridimensional y viceversa.
   - Compara la probabilidad de eventos simples en diversos contextos (casos
     favorables/casos posibles), incluso cuando los casos posibles de cada evento
     son diferentes.
   - Selecciona información necesaria para resolver problemas que involucran
     operaciones aritméticas.
   - Selecciona información necesaria para resolver problemas que involucran
     características medibles de figuras geométricas elementales (triángulos,
     cuadriláteros y circunferencias).
   - Cambia la escala cuando la transformación no es convencional.
   - Justifica afirmaciones utilizando planteamientos y operaciones aritméticas
     o algebraicas haciendo uso directo de un concepto, es decir, a partir de
     un único argumento.
   - Identifica información relevante cuando el tipo de registro contiene información
     de más de tres categorías.
   - Hace manipulaciones algebraicas sencillas (aritmética de términos semejantes).

   NIVEL 3 — Puntaje 51 a 70:
   Descriptor general: Además de lo descrito en los niveles anteriores, el estudiante
   selecciona e interpreta información, señala errores y hace distintos tipos de
   transformaciones y manipulaciones aritméticas y algebraicas sencillas; esto para
   enfrentarse a problemas que involucran el uso de conceptos de proporcionalidad,
   factores de conversión, áreas y desarrollos planos, en contextos laborales u
   ocupacionales, científicos y comunitarios o sociales.
   Descriptores específicos:
   - Selecciona la gráfica (que puede ser de doble entrada) correspondiente a
     la información de una tabla, o a partir de verbalizaciones (características
     de crecimiento o decrecimiento deseadas), teniendo en cuenta la selección
     de la escala, el tipo de variable y el tipo de gráfica.
   - Compara información gráfica que requiere algunas manipulaciones algebraicas.
   - Reconoce errores al realizar transformaciones entre tipos de registro.
   - Reconoce desarrollos planos tridimensionales.
   - Compara probabilidad de eventos simples en diversos contextos.
   - Selecciona información para resolver problemas con operaciones aritméticas.
   - Selecciona información para resolver problemas con características medibles
     de figuras geométricas elementales.
   - Cambia la escala cuando la transformación no es convencional.
   - Justifica afirmaciones usando planteamientos y operaciones aritméticas o
     algebraicas haciendo uso directo de un concepto.
   - Identifica información relevante con más de tres categorías.
   - Hace manipulaciones algebraicas sencillas.

   NIVEL 4 — Puntaje 71 a 100:
   Descriptor general: Además de lo descrito en los niveles anteriores, el estudiante
   resuelve problemas y justifica la veracidad o falsedad de afirmaciones que
   requieren el uso de conceptos de probabilidad, propiedades algebraicas, relaciones
   trigonométricas y características de funciones reales, en contextos principalmente
   matemáticos o científicos abstractos.
   Descriptores específicos:
   - Resuelve problemas que requieren interpretar información de subconjuntos de
     información que pueden requerir el uso de operaciones complejas (cálculos
     de porcentajes).
   - Resuelve problemas que requieren construir una representación auxiliar (gráficas
     y fórmulas) como paso intermedio para su solución.
   - Modela usando lenguaje algebraico información dada en lenguaje natural, tablas
     o representaciones geométricas.
   - Manipula expresiones algebraicas o aritméticas haciendo uso de las propiedades
     de las operaciones.
   - Modela fenómenos variacionales no explícitos haciendo uso de lenguaje simbólico
     o gráficas.
   - Reconoce en diferentes formatos el espacio muestral de un experimento aleatorio.
   - Resuelve problemas de conteo que requieren el uso de permutaciones.
   - Justifica si hay falta de información en una situación problema para tomar
     una decisión.
   - Toma decisiones sobre la veracidad o falsedad de una afirmación cuando requiere
     el uso de varias propiedades o conceptualizaciones formales.

═══════════════════════════════════════════
INSTRUCCIONES DETALLADAS:
═══════════════════════════════════════════

1. ANÁLISIS POR COMPETENCIA ICFES Y EJE DE CONOCIMIENTO:
   - Califica el desempeño en cada COMPETENCIA (Interpretación/representación, Formulación/ejecución, Argumentación)
     y en cada EJE DE CONOCIMIENTO (Álgebra y cálculo, Geometría, Estadística).
   - Clasifica cada dimensión en: "crítico" (<40%), "en desarrollo" (40-60%), "adecuado" (60-80%), "avanzado" (>80%).
   - Explica qué implica el estado de cada competencia/eje para el aprendizaje del estudiante.

2. DIAGNÓSTICO DE BRECHA ACADÉMICA:
   - Determina el NIVEL REAL del estudiante vs el NIVEL ESPERADO para su grado.
   - Cuantifica la brecha en grados (Ej: "Domina contenidos de grado 7° cuando está en 9°").
   - Explica las implicaciones de esta brecha para su rendimiento escolar futuro.

3. TEMAS DOMINADOS (fortalezas):
   - Lista con especificidad los temas donde el estudiante demuestra dominio.
   - Para cada tema: qué pensamiento matemático corresponde, nivel de dominio (alto/medio) y evidencia de por qué se considera dominado.
   - Usa este formato: "Domina X porque en las preguntas Y y Z respondió correctamente incluso en variantes..."

4. TEMAS CON DIFICULTAD (brechas):
   - Lista ordenada por severidad (crítico primero).
   - Para cada tema: pensamiento matemático, nivel de dificultad, descripción del tipo de error dominante, y qué DBA específico no ha alcanzado.
   - Especifica si la dificultad es ESTRUCTURAL (afecta múltiples temas relacionados) o PUNTUAL (aislada).

5. PERFIL COGNITIVO:
   - Fortalezas cognitivas detectadas (Ej: buen razonamiento espacial, facilidad con patrones).
   - Estilos de error predominantes (Ej: errores procedimentales vs conceptuales).
   - Comportamiento temporal: ¿el tiempo de respuesta revela confianza, bloqueo o adivinanza?

6. DIAGNÓSTICO GENERAL:
   Un párrafo rico y preciso (mínimo 150 palabras) que integre TODO lo anterior:
   - Perfil general del estudiante
   - Fortalezas identificadas
   - Brechas más críticas
   - Nivel según escala ICFES estimado
   - Implicaciones pedagógicas
   - Mensaje motivador al final

7. DBAs PRIORITARIOS:
   Lista los Derechos Básicos de Aprendizaje específicos que el estudiante debe reforzar, con referencia al grado en que debieron haberse alcanzado.

═══════════════════════════════════════════
FORMATO DE RESPUESTA (JSON ESTRICTO):
═══════════════════════════════════════════
{
  "nivelEstimado": 7,
  "nivelEsperado": 9,
  "nivelDesempenoICFES": "Nivel 2 — Mínimo",
  "brechaAcademica": "El estudiante demuestra dominio de contenidos equivalentes a grado 7°, presentando una brecha de aproximadamente 2 años académicos frente a lo esperado para grado 9°. Esta brecha es principalmente en el pensamiento variacional (álgebra) y parcialmente en el pensamiento numérico para operaciones con racionales.",
  "rendimientoPorCompetencia": {
    "interpretacionRepresentacion": {
      "porcentaje": 75,
      "estado": "adecuado",
      "descripcion": "El estudiante lee e interpreta gráficas básicas y tablas correctamente, identifica tendencias, pero tiene dificultades al traducir entre representaciones simbólicas y gráficas en contextos complejos.",
      "evidencias": ["Interpreta gráficos de barras correctamente", "Lee tablas de frecuencia"],
      "brechas": ["Dificultad al pasar de expresión verbal a algebraica"]
    },
    "formulacionEjecucion": {
      "porcentaje": 35,
      "estado": "crítico",
      "descripcion": "Presenta dificultades para plantear modelos matemáticos a partir de situaciones. Ejecuta operaciones básicas pero no selecciona estrategias adecuadas ante problemas de varios pasos.",
      "evidencias": ["Resuelve operaciones directas simples"],
      "brechas": ["No modela situaciones con variables", "No verifica coherencia de resultados"]
    },
    "argumentacion": {
      "porcentaje": 60,
      "estado": "en desarrollo",
      "descripcion": "Puede justificar procedimientos sencillos usando un único argumento, pero tiene dificultades para refutar afirmaciones o justificar usando varias propiedades.",
      "evidencias": ["Justifica pasos en operaciones aritméticas básicas"],
      "brechas": ["No detecta errores en soluciones ajenas", "No argumenta con múltiples propiedades"]
    }
  },
  "rendimientoPorEje": {
    "algebraCalculo": {
      "porcentaje": 35,
      "estado": "crítico",
      "descripcion": "Presenta dificultades fundamentales en álgebra: no comprende el concepto de variable ni puede resolver ecuaciones de primer grado. Falla en patrones y regularidades.",
      "temasEvaluados": ["Ecuaciones lineales", "Expresiones algebraicas"],
      "temasDebiles": ["Expresiones algebraicas", "Ecuaciones lineales", "Concepto de función"]
    },
    "geometria": {
      "porcentaje": 60,
      "estado": "en desarrollo",
      "descripcion": "Reconoce figuras geométricas básicas y calcula áreas de rectángulos, pero falla en perímetros de figuras irregulares, volúmenes y razonamiento geométrico abstracto.",
      "temasEvaluados": ["Figuras geométricas", "Área y perímetro"],
      "temasDebiles": ["Perímetro de figuras irregulares", "Teorema de Pitágoras", "Volumen"]
    },
    "estadistica": {
      "porcentaje": 70,
      "estado": "adecuado",
      "descripcion": "Lee e interpreta gráficas estadísticas básicas. Tiene bases en probabilidad elemental y medidas de tendencia central.",
      "temasEvaluados": ["Lectura de gráficas", "Probabilidad básica", "Media y moda"],
      "temasDebiles": []
    }
  },
  "temasDominados": [
    {
      "tema": "Operaciones con números enteros",
      "pensamiento": "Numérico",
      "nivel": "alto",
      "dba": "DBA 1 Grado 6°",
      "comentario": "Respondió correctamente 3 de 3 preguntas sobre operaciones con enteros, incluyendo una con doble negación, lo que confirma dominio sólido y automatizado."
    }
  ],
  "temasConDificultad": [
    {
      "tema": "Expresiones algebraicas y ecuaciones lineales",
      "pensamiento": "Variacional",
      "nivel": "critico",
      "dba": "DBA 3 Grado 8°",
      "tipoError": "conceptual",
      "esEstructural": true,
      "comentario": "Falló en todas las preguntas de álgebra. No comprende el concepto de variable como cantidad desconocida. Esto afecta también su capacidad para resolver problemas contextualizados con incógnitas."
    }
  ],
  "fortalezas": [
    "Razonamiento aritmético con números positivos fluido y automático",
    "Buena lectura e interpretación de gráficas estadísticas simples",
    "Comprensión de proporciones directas en contextos cotidianos"
  ],
  "debilidades": [
    "No comprende el lenguaje algebraico (variables, expresiones, ecuaciones)",
    "Confusión entre operaciones inversas en fracciones (suma vs multiplicación)",
    "Dificultad en problemas que requieren modelar situaciones matemáticamente"
  ],
  "perfilCognitivo": {
    "estilo": "comprensivo",
    "descripcion": "El estudiante tiende a resolver bien lo que es concreto y operativo, pero falla cuando se requiere abstracción algebraica o generalización de patrones.",
    "comportamientoTemporal": "Responde rápido en aritmética (automatismo) pero se bloquea en álgebra (tiempo excesivo o respuestas rápidas que sugieren adivinanza)."
  },
  "diagnosticoGeneral": "Párrafo extenso y detallado (mínimo 150 palabras) integrando todo el diagnóstico académico del estudiante con referencia explícita al currículo MEN, sus brechas, sus fortalezas, el nivel ICFES estimado y una orientación pedagógica motivadora.",
  "observacionesTiempo": "Análisis detallado del comportamiento temporal: velocidad en temas fáciles vs difíciles, preguntas donde tardó demasiado o respondió demasiado rápido, y qué revela esto sobre el estado emocional y cognitivo del estudiante frente al examen.",
  "dbasPrioritarios": [
    "DBA 3 Grado 7°: Resuelvo y formulo problemas en situaciones de variación proporcional.",
    "DBA 1 Grado 8°: Identifico y uso variables, expresiones algebraicas y propiedades de los números para resolver ecuaciones lineales."
  ],
  "mensajeMotivador": "Frase personalizada de aliento basada en las fortalezas reales detectadas, máximo 2 oraciones."
}`;

export async function academicDiagnosticAgent(analysisResult, schoolGrade, timeData) {
  const grade = parseInt(schoolGrade);
  const curriculo = CURRICULO_MEN[grade];

  // Construir contexto del currículo para el grado
  let curriculoContext = '';
  if (curriculo) {
    curriculoContext = `
CURRÍCULO MEN PARA GRADO ${grade}° — ${curriculo.nombre}:
- Competencia transversal: "${curriculo.competenciaTransversal}"

EJE 1 — ÁLGEBRA Y CÁLCULO (agrupa Pensamiento Numérico + Variacional):
  · Numérico: ${curriculo.pensamientoNumerico.join(', ')}
  · Variacional: ${curriculo.pensamientoVariacional.join(', ')}

EJE 2 — GEOMETRÍA (agrupa Pensamiento Espacial y Métrico):
  · ${curriculo.pensamientoEspacialMetrico.join(', ')}

EJE 3 — ESTADÍSTICA (agrupa Pensamiento Aleatorio):
  · ${curriculo.pensamientoAleatorio.join(', ')}`;
  }

  // Calcular estadísticas de tiempo para contexto
  const tiempoTotalSeg = Math.round((timeData.totalTimeMs || 0) / 1000);
  const tiempoPromedioSeg = Math.round((timeData.avgTimeMs || 0) / 1000);
  const tiempoTotal = tiempoTotalSeg >= 60
    ? `${Math.floor(tiempoTotalSeg / 60)} min ${tiempoTotalSeg % 60} seg`
    : `${tiempoTotalSeg} segundos`;

  // Extraer datos relevantes del análisis para el prompt
  const totalPreguntas = (analysisResult.totalCorrect || 0) + (analysisResult.totalIncorrect || 0);
  const porcentajeAcierto = totalPreguntas > 0
    ? Math.round((analysisResult.totalCorrect / totalPreguntas) * 100)
    : 0;

  const userMessage = `Genera un DIAGNÓSTICO ACADÉMICO PROFUNDO E INSTITUCIONAL para un estudiante colombiano.

══════════════════════════════════════
DATOS DEL ESTUDIANTE:
══════════════════════════════════════
- Grado actual: ${schoolGrade}°
- Preguntas respondidas: ${totalPreguntas}
- Respuestas correctas: ${analysisResult.totalCorrect || 0} (${porcentajeAcierto}%)
- Respuestas incorrectas: ${analysisResult.totalIncorrect || 0}
- Perfil de aprendizaje (análisis previo): ${analysisResult.perfilAprendizaje || 'no determinado'}
${curriculoContext}

══════════════════════════════════════
DATOS DE TIEMPO DEL EXAMEN:
══════════════════════════════════════
- Tiempo total del examen: ${tiempoTotal}
- Tiempo promedio por pregunta: ${tiempoPromedioSeg} segundos
- Pregunta donde más tardó: #${timeData.slowest?.index || '?'} (${Math.round((timeData.slowest?.time || 0) / 1000)} seg)
- Pregunta donde menos tardó: #${timeData.fastest?.index || '?'} (${Math.round((timeData.fastest?.time || 0) / 1000)} seg)
- Preguntas que tomaron más de 60 segundos: ${timeData.slowQuestions || 0}
- Preguntas respondidas en menos de 5 segundos: ${timeData.fastQuestions || 0}
- Observación temporal: ${timeData.fastQuestions > 3 ? '⚠️ Múltiples respuestas muy rápidas (posible adivinanza)' : 'Tiempos de respuesta razonables'}

══════════════════════════════════════
ANÁLISIS DE ERRORES (del agente analizador):
══════════════════════════════════════
${JSON.stringify(analysisResult, null, 2)}

══════════════════════════════════════
INSTRUCCIONES ESPECÍFICAS:
══════════════════════════════════════
1. Usa el currículo MEN del grado ${schoolGrade}° para determinar qué temas debería dominar y cuáles domina realmente.
2. Clasifica el rendimiento por COMPETENCIA ICFES (Interpretación/representación, Formulación/ejecución, Argumentación)
   Y por EJE DE CONOCIMIENTO (Álgebra y cálculo, Geometría, Estadística) basándote en los temas de las preguntas.
3. El "diagnosticoGeneral" debe tener MÍNIMO 150 palabras, ser preciso y usar terminología pedagógica del ICFES y MEN.
4. Los "dbasPrioritarios" deben ser DBA reales y específicos que el estudiante aún no ha alcanzado.
5. El "mensajeMotivador" debe basarse en las fortalezas REALES detectadas.
6. Estima el nivel de desempeño según la escala OFICIAL del ICFES Saber 11 (Nivel 1 a 4) con su descripción completa.
7. En el diagnosticoGeneral menciona explícitamente qué competencias ICFES están más débiles y qué ejes de conocimiento
   requieren mayor intervención, con orientación pedagógica concreta.`;

  const result = await callGeminiJSON(ACADEMIC_DIAGNOSTIC_PROMPT, userMessage);

  if (!result) {
    return {
      nivelEstimado: grade,
      nivelEsperado: grade,
      nivelDesempenoICFES: 'No determinado',
      brechaAcademica: 'No se pudo generar el diagnóstico automático. Contacta a tu docente para un diagnóstico manual.',
      rendimientoPorCompetencia: {
        interpretacionRepresentacion: { porcentaje: 0, estado: 'sin datos', descripcion: '', evidencias: [], brechas: [] },
        formulacionEjecucion: { porcentaje: 0, estado: 'sin datos', descripcion: '', evidencias: [], brechas: [] },
        argumentacion: { porcentaje: 0, estado: 'sin datos', descripcion: '', evidencias: [], brechas: [] },
      },
      rendimientoPorEje: {
        algebraCalculo: { porcentaje: 0, estado: 'sin datos', descripcion: '', temasEvaluados: [], temasDebiles: [] },
        geometria: { porcentaje: 0, estado: 'sin datos', descripcion: '', temasEvaluados: [], temasDebiles: [] },
        estadistica: { porcentaje: 0, estado: 'sin datos', descripcion: '', temasEvaluados: [], temasDebiles: [] },
      },
      temasDominados: [],
      temasConDificultad: [],
      fortalezas: [],
      debilidades: [],
      perfilCognitivo: { estilo: 'irregular', descripcion: '', comportamientoTemporal: '' },
      diagnosticoGeneral: 'Diagnóstico no disponible. Por favor, inicia sesión de tutoría para obtener retroalimentación personalizada.',
      observacionesTiempo: '',
      dbasPrioritarios: [],
      mensajeMotivador: '¡Ya completaste el diagnóstico! Eso ya es un gran paso. Tu tutor está listo para ayudarte a mejorar.',
    };
  }

  return result;
}
