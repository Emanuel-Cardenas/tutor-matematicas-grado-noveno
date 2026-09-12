// ═══════════════════════════════════════════════════════
// CURRÍCULO MEN — Ministerio de Educación Nacional de Colombia
// ═══════════════════════════════════════════════════════
// Extraído del documento oficial:
// "Arquitectura Curricular de las Matemáticas en la Educación
//  Básica Secundaria y Media en Colombia" (MEN)
//
// Fuentes:
// - Lineamientos Curriculares (1998)
// - Estándares Básicos de Competencias (2006)
// - Derechos Básicos de Aprendizaje DBA V2 (2016)
//
// Esta aplicación está delimitada exclusivamente a grado noveno.
// Este archivo es la FUENTE ÚNICA de verdad para el currículo.
// Importar desde aquí en todos los agentes que lo necesiten.
// ═══════════════════════════════════════════════════════

export const CURRICULO_MEN = {
  9: {
    nombre: "Noveno - Funciones, Sistemas de Ecuaciones y Geometría Demostrativa",
    pensamientoNumerico: [
      "Propiedades de los números reales",
      "Operaciones con radicales",
      "Racionalización de denominadores",
      "Notación científica"
    ],
    pensamientoVariacional: [
      "Función lineal: pendiente, intercepto, gráfica",
      "Función cuadrática: vértice, raíces, gráfica (parábola)",
      "Sistemas de ecuaciones lineales 2×2: método de sustitución",
      "Sistemas de ecuaciones lineales 2×2: método de igualación",
      "Sistemas de ecuaciones lineales 2×2: método de eliminación (reducción)",
      "Sistemas de ecuaciones lineales 2×2: método gráfico",
      "Ecuaciones cuadráticas: fórmula general, factorización",
      "Lenguaje algebraico para poner a prueba conjeturas"
    ],
    pensamientoEspacialMetrico: [
      "Teorema de Tales y proporcionalidad de segmentos",
      "Semejanza de triángulos y figuras planas",
      "Congruencia de figuras",
      "Demostraciones geométricas sencillas",
      "Medidas indirectas usando semejanza"
    ],
    pensamientoAleatorio: [
      "Probabilidad de eventos simples",
      "Eventos independientes y dependientes",
      "Principio de conteo (multiplicación)",
      "Permutaciones básicas",
      "Espacio muestral de un experimento",
      "Interpretación crítica de información estadística"
    ],
    competenciaTransversal: "Resolver problemas de optimización mediante modelos funcionales"
  }
};

/**
 * Obtiene el currículo de grado noveno (único grado soportado).
 * @returns {object} — datos del currículo
 */
export function getCurriculo() {
    return CURRICULO_MEN[9];
}
