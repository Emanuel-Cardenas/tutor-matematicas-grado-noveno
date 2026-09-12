// Agente de Recomendaciones de Aprendizaje (v2 — Plan Pedagógico Personalizado)
// Genera un plan de estudio detallado, secuenciado y personalizado para el estudiante
// basado en el diagnóstico académico y el currículo MEN de Colombia.
import { callGeminiJSON } from '@/lib/gemini';

const RECOMMENDATIONS_PROMPT = `Eres un consejero pedagógico experto en diseño de planes de intervención educativa para estudiantes de bachillerato en Colombia. Tu especialidad es crear planes de estudio personalizados basados en diagnósticos académicos, con enfoque en el currículo MEN y el desarrollo de competencias matemáticas.

Tu tarea es generar un PLAN DE ESTUDIO PERSONALIZADO Y ACCIONABLE que el estudiante pueda seguir de manera autónoma o con apoyo del tutor.

═══════════════════════════════════════════
PRINCIPIOS PEDAGÓGICOS QUE DEBES APLICAR:
═══════════════════════════════════════════

1. SECUENCIACIÓN: Los temas deben estar ordenados de menor a mayor complejidad. Primero cerrar brechas de grados anteriores, luego nivelar el grado actual.

2. ANDAMIAJE: Cada recomendación debe construir sobre lo que el estudiante ya sabe (sus fortalezas).

3. ESPECIFICIDAD: Los ejercicios deben ser concretos y ejecutables, no genéricos. Ejemplo: NO "practica álgebra", SÍ "Resuelve 5 ecuaciones lineales donde la incógnita está a ambos lados: 2x+3 = x-1".

4. VARIEDAD METODOLÓGICA: Incluir diferentes tipos de actividades (procedimentales, conceptuales, de aplicación a contextos reales).

5. GAMIFICACIÓN: Incluir tips de cómo hacer el estudio más motivante y menos tedioso.

6. TIEMPO REALISTA: Los tiempos estimados deben ser alcanzables para un estudiante de bachillerato con otras materias.

═══════════════════════════════════════════
INSTRUCCIONES DETALLADAS:
═══════════════════════════════════════════

1. PLAN DE ESTUDIO GENERAL:
   - Duración total realista (considerando carga escolar normal)
   - Meta principal medible y alcanzable
   - Estructura semanal sugerida (cuántas horas por semana y cuándo)
   - Indicadores de progreso: ¿cómo sabrá el estudiante que está mejorando?

2. TEMAS POR PRIORIDAD:
   ALTA PRIORIDAD (bloqueantes): Temas sin los cuales no puede avanzar. Ejemplo: si no sabe fracciones, no puede aprender álgebra.
   MEDIA PRIORIDAD (nivelación): Temas del grado actual que necesita mejorar.
   BAJA PRIORIDAD (enriquecimiento): Temas donde ya tiene base pero puede profundizar.

   Para CADA tema de alta y media prioridad:
   - Nombre preciso del tema
   - Por qué es prioritario (causa raíz del error detectado)
   - Prerrequisito: qué debe saber ANTES de abordar este tema
   - Secuencia de aprendizaje sugerida (pasos concretos)
   - Ejercicios específicos (mínimo 3 ejemplos concretos con enunciados reales)
   - Tiempo estimado de práctica
   - Señal de éxito: cómo saber que lo dominó

3. ESTRATEGIA DE ESTUDIO PERSONALIZADA:
   - Método de estudio recomendado según el perfil del estudiante
   - Técnicas específicas para superar los errores detectados
   - Cómo usar el tutor de IA de manera efectiva

4. RECURSOS CONCRETOS:
   - Tipos de ejercicios recomendados
   - Estrategias de verificación (cómo comprobar sus propias respuestas)

5. CONSEJOS MOTIVACIONALES:
   - Tips personalizados basados en las fortalezas del estudiante
   - Cómo superar la frustración con los temas difíciles
   - Rutina de estudio sugerida

═══════════════════════════════════════════
FORMATO DE RESPUESTA (JSON ESTRICTO):
═══════════════════════════════════════════
{
  "planDeEstudio": {
    "resumen": "Descripción general del plan de 2-3 oraciones, personalizado para el perfil del estudiante.",
    "duracionEstimada": "6-8 semanas",
    "metaPrincipal": "Cerrar la brecha en álgebra básica y afianzar operaciones con fracciones para poder abordar los temas de 9° con éxito.",
    "estructuraSemanal": "3 sesiones de 30-40 minutos por semana: 2 para temas de alta prioridad y 1 para repaso y ejercicios mixtos.",
    "indicadoresProgreso": [
      "Resolver 5 ecuaciones lineales seguidas sin errores",
      "Sumar fracciones con denominadores diferentes sin usar calculadora",
      "Completar el 80% de las preguntas de práctica del tutor correctamente"
    ]
  },
  "temasPorPrioridad": {
    "alta": [
      {
        "tema": "Suma y resta de fracciones con denominadores distintos",
        "pensamiento": "Numérico",
        "razon": "Es el error más frecuente detectado (3 de 5 errores numéricos) y es prerrequisito para álgebra con fracciones.",
        "prerrequisito": "Manejo de múltiplos y mínimo común múltiplo (MCM)",
        "secuenciaAprendizaje": [
          "1. Revisar concepto de fracción equivalente (día 1)",
          "2. Practicar cálculo del MCM entre 2 y 3 denominadores (día 1-2)",
          "3. Aplicar MCM para homologar denominadores antes de sumar (día 2-3)",
          "4. Ejercicios mixtos suma y resta con verificación (día 3-4)"
        ],
        "ejerciciosRecomendados": [
          "Calcula: 1/3 + 1/4 (pista: MCM de 3 y 4 es 12)",
          "Calcula: 3/5 - 1/3 y verifica tu resultado convirtiéndolo a decimal",
          "Resuelve: 2/7 + 3/14 - 1/2 (tres fracciones con diferente denominador)",
          "Problema de contexto: Si comiste 1/4 de una pizza y tu amigo 1/3, ¿cuánto comieron en total?"
        ],
        "tiempoEstimado": "1.5 semanas (3-4 sesiones de práctica)",
        "senalExito": "Resolver 5 sumas/restas de fracciones consecutivas sin errores en menos de 3 minutos cada una"
      }
    ],
    "media": [
      {
        "tema": "Ecuaciones lineales de primer grado",
        "pensamiento": "Variacional",
        "razon": "El estudiante no domina la transpotación de términos ni la verificación de soluciones.",
        "prerrequisito": "Operaciones con números enteros y el concepto de variable",
        "secuenciaAprendizaje": [
          "1. Entender la variable como cantidad desconocida con ejemplos cotidianos",
          "2. Resolver ecuaciones simples: x + 5 = 12",
          "3. Ecuaciones con transpotación: 3x - 2 = 7",
          "4. Ecuaciones con la incógnita a ambos lados: 2x + 1 = x + 5"
        ],
        "ejerciciosRecomendados": [
          "Resuelve: x + 8 = 15 (¿qué número sumado a 8 da 15?)",
          "Resuelve: 4x = 28 (¿por cuánto multiplico para obtener 28?)",
          "Resuelve: 2x - 3 = 11 y verifica tu respuesta sustituyendo",
          "Problema: Un número multiplicado por 3 menos 5 es igual a 16. ¿Cuál es el número?"
        ],
        "tiempoEstimado": "2 semanas (4-6 sesiones)",
        "senalExito": "Plantear y resolver 3 problemas de contexto con ecuaciones lineales correctamente"
      }
    ],
    "baja": [
      {
        "tema": "Perímetro de figuras irregulares",
        "pensamiento": "Espacial y Métrico",
        "razon": "Solo un error en este tema, pero es importante afianzarlo para temas más avanzados de geometría.",
        "prerrequisito": "Operaciones básicas y reconocimiento de figuras geométricas",
        "secuenciaAprendizaje": [
          "1. Repasar qué es el perímetro (suma de todos los lados)",
          "2. Calcular perímetros de figuras con medidas dadas",
          "3. Problemas de aplicación (cercar un terreno, marcos de cuadros)"
        ],
        "ejerciciosRecomendados": [
          "Calcula el perímetro de un pentágono irregular con lados de 3, 5, 4, 6 y 2 cm",
          "Problema: ¿Cuánto alambre necesito para cercar un terreno rectangular de 15m × 8m?"
        ],
        "tiempoEstimado": "3-4 días (1-2 sesiones)",
        "senalExito": "Resolver 3 problemas de perímetro en contextos reales sin errores"
      }
    ]
  },
  "estrategia": [
    "Semana 1-2: Enfocarse SOLO en fracciones (tema de alta prioridad). No pasar a álgebra hasta tener sólidas las fracciones.",
    "Semana 3-4: Introducir álgebra básica (variables y ecuaciones simples), conectándolo con aritmética ya dominada.",
    "Semana 5-6: Ecuaciones lineales más complejas y problemas de contexto.",
    "Semana 7-8: Geometría y repaso general. Mini-examen de práctica para evaluar progreso.",
    "Siempre: Al inicio de cada sesión, repasar 5 minutos lo trabajado en la sesión anterior."
  ],
  "metodologiaEstudio": {
    "estilo": "comprensivo",
    "descripcion": "Para este perfil, se recomienda empezar cada tema con un ejemplo concreto y cotidiano antes de ir a la definición formal. Siempre verificar las respuestas sustituyendo los valores.",
    "tecnicasEspecificas": [
      "Método de la pregunta inversa: al terminar un ejercicio, formular la pregunta que llevaría a esa respuesta",
      "Dibujar o hacer esquemas antes de calcular (especialmente en geometría y problemas de contexto)",
      "Usar la calculadora SOLO para verificar, no para calcular (fortalecer el cálculo mental)"
    ]
  },
  "consejos": [
    "Tus bases en aritmética son sólidas — ¡eso es lo más difícil! El álgebra es solo aritmética con letras. Cada vez que veas una 'x', piensa que es un número que no conoces todavía.",
    "Dedica 30-40 minutos diarios, divididos en dos bloques de 15-20 min con un descanso. Es más efectivo que sesiones largas de 2 horas.",
    "Cuando te equivoques, pregúntale al tutor de IA '¿Por qué mi respuesta está mal?' en vez de solo ver la correcta. Eso acelera el aprendizaje.",
    "Lleva un cuaderno de errores: anota cada error que cometes y por qué te equivocaste. Revísalo cada semana."
  ],
  "mensajeFinal": "Párrafo motivador de 2-3 oraciones basado en las fortalezas reales del estudiante y las metas concretas del plan."
}

IMPORTANTE:
- Los ejercicios deben tener ENUNCIADOS COMPLETOS y concretos, no solo títulos.
- La "secuenciaAprendizaje" debe ser una guía paso a paso real, no solo listado de temas.
- Personaliza el lenguaje para un estudiante colombiano de bachillerato.
- El plan debe ser AMBICIOSO pero ALCANZABLE. No sobrecargues al estudiante.`;

export async function learningRecommendationsAgent(diagnosis, schoolGrade) {
    // Extraer datos clave del diagnóstico para enriquecer el prompt
    const brechaGrados = diagnosis.nivelEsperado && diagnosis.nivelEstimado
        ? (diagnosis.nivelEsperado - diagnosis.nivelEstimado)
        : 0;

    const temasDebiles = [
        ...(diagnosis.temasConDificultad || []).map(t => t.tema),
    ].filter(Boolean).join(', ') || 'no especificados';

    const temasListas = [
        ...(diagnosis.temasDominados || []).map(t => t.tema),
    ].filter(Boolean).join(', ') || 'no especificados';

    const perfilEstudiante = diagnosis.perfilCognitivo?.estilo || diagnosis.perfilAprendizaje || 'irregular';

    const userMessage = `Genera un PLAN DE ESTUDIO PERSONALIZADO Y DETALLADO para un estudiante colombiano de grado ${schoolGrade}°.

══════════════════════════════════════
PERFIL DEL ESTUDIANTE:
══════════════════════════════════════
- Grado actual: ${schoolGrade}°
- Nivel estimado según diagnóstico: ${diagnosis.nivelEstimado || schoolGrade}° (equivalente)
- Nivel esperado para su grado: ${diagnosis.nivelEsperado || schoolGrade}°
- Brecha académica estimada: ${brechaGrados > 0 ? `${brechaGrados} grado(s) por debajo` : 'Al nivel esperado'}
- Perfil cognitivo: ${perfilEstudiante}
- Nivel ICFES estimado: ${diagnosis.nivelDesempenoICFES || 'No determinado'}
- Temas donde falla: ${temasDebiles}
- Temas que domina: ${temasListas}
- Fortalezas detectadas: ${(diagnosis.fortalezas || []).join('; ') || 'no especificadas'}
- Debilidades detectadas: ${(diagnosis.debilidades || []).join('; ') || 'no especificadas'}

══════════════════════════════════════
DIAGNÓSTICO COMPLETO:
══════════════════════════════════════
${JSON.stringify(diagnosis, null, 2)}

══════════════════════════════════════
INSTRUCCIONES ESPECÍFICAS:
══════════════════════════════════════
1. Prioriza los temas de ALTA PRIORIDAD que son bloqueantes (sin ellos no puede avanzar).
2. Los ejercicios deben ser CONCRETOS con enunciados completos, no solo títulos.
3. La secuencia de aprendizaje debe ser un camino claro paso a paso.
4. Considera la brecha de ${brechaGrados} grado(s): el plan debe cerrar esa brecha primero.
5. El plan debe ser realista para un estudiante de bachillerato con otras materias (máximo 3-4 horas semanales).
6. Los consejos deben basarse en las FORTALEZAS REALES del estudiante para motivarlo.
7. Genera mínimo 2 temas de alta prioridad, 2 de media y 1 de baja.`;

    const result = await callGeminiJSON(RECOMMENDATIONS_PROMPT, userMessage);

    if (!result) {
        return {
            planDeEstudio: {
                resumen: 'No se pudieron generar recomendaciones automáticas. Habla con tu tutor.',
                duracionEstimada: 'N/A',
                metaPrincipal: 'Revisar resultados con el tutor para un plan manual.',
                estructuraSemanal: '',
                indicadoresProgreso: [],
            },
            temasPorPrioridad: { alta: [], media: [], baja: [] },
            estrategia: ['Consultar con tu docente de matemáticas para un plan personalizado.'],
            metodologiaEstudio: { estilo: 'general', descripcion: '', tecnicasEspecificas: [] },
            consejos: ['Dedica tiempo diario a repasar los conceptos básicos.'],
            mensajeFinal: '¡Ya completaste el diagnóstico! Ese es el primer paso para mejorar.',
        };
    }

    return result;
}
