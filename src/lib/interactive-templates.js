// ═══════════════════════════════════════════════════════
// CATÁLOGO DE TEMPLATES INTERACTIVOS
// ═══════════════════════════════════════════════════════
// Cada template define:
//   - validate(config) → boolean
//   - defaultConfig → valores por defecto
//   - securityConstraints → límites antes de renderizar
//   - description → para el prompt del LLM
//
// El LLM solo genera configuración JSON que referencia
// estos templates. NO genera código ejecutable.
// ═══════════════════════════════════════════════════════

// ─── Constantes de seguridad ─────────────────────────
const MAX_FUNCTIONS = 5;
const MAX_SLIDERS = 4;
const MAX_VIEWPORT_RANGE = 100;
const MAX_DATA_POINTS = 20;

// ─── Template: Gráfica Estática ──────────────────────
export const GRAPH_STATIC = {
    type: 'graph_static',
    grades: [6, 7, 8, 9, 10, 11],
    description: 'Muestra gráfica(s) fija(s) para que el estudiante las interprete visualmente.',
    defaultConfig: {
        functions: ['x^2'],
        viewport: { xMin: -10, xMax: 10, yMin: -7, yMax: 7 },
        showRoots: true,
        showExtrema: true,
        labels: [],
    },
    validate(config) {
        if (!config.functions || !Array.isArray(config.functions)) return false;
        if (config.functions.length === 0 || config.functions.length > MAX_FUNCTIONS) return false;
        return config.functions.every(f => typeof f === 'string' && f.length < 200);
    },
    sanitize(config) {
        return {
            ...this.defaultConfig,
            ...config,
            functions: (config.functions || this.defaultConfig.functions).slice(0, MAX_FUNCTIONS),
            viewport: sanitizeViewport(config.viewport),
        };
    },
};

// ─── Template: Gráfica con Sliders ───────────────────
export const GRAPH_SLIDER = {
    type: 'graph_slider',
    grades: [9, 10, 11],
    description: 'Función con parámetros que el estudiante manipula con sliders interactivos. Los sliders cambian coeficientes y la gráfica se actualiza en tiempo real.',
    defaultConfig: {
        functions: ['a*x^2 + b'],
        variables: {
            a: { min: -5, max: 5, step: 0.5, default: 1, label: 'a' },
        },
        viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
        showRoots: true,
        showExtrema: true,
    },
    validate(config) {
        if (!config.functions || !Array.isArray(config.functions) || config.functions.length === 0) return false;
        if (!config.variables || typeof config.variables !== 'object') return false;
        const vars = Object.keys(config.variables);
        if (vars.length === 0 || vars.length > MAX_SLIDERS) return false;
        return vars.every(v => {
            const def = config.variables[v];
            return typeof def.min === 'number' && typeof def.max === 'number'
                && def.max > def.min && typeof def.step === 'number' && def.step > 0;
        });
    },
    sanitize(config) {
        const variables = {};
        for (const [k, v] of Object.entries(config.variables || {})) {
            if (Object.keys(variables).length >= MAX_SLIDERS) break;
            variables[k] = {
                min: clamp(v.min ?? -10, -50, 50),
                max: clamp(v.max ?? 10, -50, 50),
                step: clamp(v.step ?? 0.5, 0.01, 10),
                default: clamp(v.default ?? 1, v.min ?? -10, v.max ?? 10),
                label: String(v.label || k).slice(0, 30),
            };
        }
        return {
            ...this.defaultConfig,
            ...config,
            functions: (config.functions || this.defaultConfig.functions).slice(0, MAX_FUNCTIONS),
            variables,
            viewport: sanitizeViewport(config.viewport),
        };
    },
};

// ─── Template: Comparar Funciones ────────────────────
export const GRAPH_COMPARE = {
    type: 'graph_compare',
    grades: [8, 9, 10, 11],
    description: 'Muestra 2+ funciones en el mismo plano para que el estudiante compare (intersecciones, diferencias, comportamiento).',
    defaultConfig: {
        functions: ['x', 'x^2'],
        viewport: { xMin: -5, xMax: 5, yMin: -3, yMax: 10 },
        showRoots: true,
        showExtrema: false,
        functionLabels: ['f(x)', 'g(x)'],
    },
    validate(config) {
        if (!config.functions || config.functions.length < 2) return false;
        return config.functions.every(f => typeof f === 'string' && f.length < 200);
    },
    sanitize(config) {
        return {
            ...this.defaultConfig,
            ...config,
            functions: (config.functions || this.defaultConfig.functions).slice(0, MAX_FUNCTIONS),
            viewport: sanitizeViewport(config.viewport),
            functionLabels: (config.functionLabels || this.defaultConfig.functionLabels).slice(0, MAX_FUNCTIONS),
        };
    },
};

// ─── Template: Recta Numérica ────────────────────────
export const NUMBER_LINE = {
    type: 'number_line',
    grades: [6, 7, 8],
    description: 'Recta numérica visual con puntos marcados para ubicar/comparar números (enteros, fracciones, decimales).',
    defaultConfig: {
        min: -10,
        max: 10,
        points: [{ value: 0, label: '0', color: '#ff6900' }],
        highlights: [],
    },
    validate(config) {
        if (typeof config.min !== 'number' || typeof config.max !== 'number') return false;
        if (config.max <= config.min) return false;
        return Array.isArray(config.points) && config.points.length > 0;
    },
    sanitize(config) {
        return {
            min: clamp(config.min ?? -10, -100, 100),
            max: clamp(config.max ?? 10, -100, 100),
            points: (config.points || []).slice(0, 10).map(p => ({
                value: typeof p.value === 'number' ? p.value : 0,
                label: String(p.label || p.value).slice(0, 20),
                color: p.color || '#ff6900',
            })),
            highlights: (config.highlights || []).slice(0, 5),
        };
    },
};

// ─── Template: Gráfico de Barras (Interpretación) ────
export const BAR_CHART = {
    type: 'bar_chart',
    grades: [6, 7, 8],
    description: 'Gráfico de barras para interpretar datos estadísticos (pensamiento aleatorio).',
    defaultConfig: {
        title: 'Datos',
        data: [
            { label: 'A', value: 10, color: '#ff6900' },
        ],
        xLabel: 'Categoría',
        yLabel: 'Frecuencia',
    },
    validate(config) {
        return Array.isArray(config.data) && config.data.length > 0 && config.data.length <= MAX_DATA_POINTS;
    },
    sanitize(config) {
        const COLORS = ['#ff6900', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];
        return {
            title: String(config.title || 'Datos').slice(0, 60),
            data: (config.data || []).slice(0, MAX_DATA_POINTS).map((d, i) => ({
                label: String(d.label || `Item ${i + 1}`).slice(0, 20),
                value: typeof d.value === 'number' ? d.value : 0,
                color: d.color || COLORS[i % COLORS.length],
            })),
            xLabel: String(config.xLabel || '').slice(0, 30),
            yLabel: String(config.yLabel || '').slice(0, 30),
        };
    },
};

// ─── Template: Punto en Plano Cartesiano ─────────────
export const COORDINATE_POINT = {
    type: 'coordinate_point',
    grades: [7, 8, 9],
    description: 'Plano cartesiano con puntos marcados para identificar coordenadas o cuadrantes.',
    defaultConfig: {
        viewport: { xMin: -10, xMax: 10, yMin: -10, yMax: 10 },
        points: [{ x: 0, y: 0, label: 'A', color: '#ff6900' }],
        showGrid: true,
    },
    validate(config) {
        return Array.isArray(config.points) && config.points.length > 0;
    },
    sanitize(config) {
        return {
            viewport: sanitizeViewport(config.viewport),
            points: (config.points || []).slice(0, 15).map(p => ({
                x: typeof p.x === 'number' ? p.x : 0,
                y: typeof p.y === 'number' ? p.y : 0,
                label: String(p.label || '').slice(0, 10),
                color: p.color || '#ff6900',
            })),
            showGrid: config.showGrid !== false,
        };
    },
};

// ─── Template: Slider como Respuesta ─────────────────
// MEN: Pensamiento Numérico y Variacional — todos los grados
// Ejemplos: raíces cuadradas (8°), ecuaciones lineales (7°),
//           valor de funciones (9°), conversión de unidades (6°)
export const SLIDER_ANSWER = {
    type: 'slider_answer',
    grades: [6, 7, 8, 9, 10, 11],
    description: 'El estudiante mueve un slider para dar su respuesta numérica directamente. Ideal para: raíces cuadradas, despejar variables, evaluar funciones, conversiones numéricas.',
    defaultConfig: {
        min: 0,
        max: 20,
        step: 1,
        defaultValue: 5,
        unit: '',
        hint: '',
        correctValue: 7,
        tolerance: 0,
        label: 'Tu respuesta',
    },
    validate(config) {
        return typeof config.min === 'number'
            && typeof config.max === 'number'
            && config.max > config.min
            && typeof config.correctValue === 'number';
    },
    sanitize(config) {
        return {
            min: clamp(config.min ?? 0, -200, 200),
            max: clamp(config.max ?? 20, -200, 200),
            step: clamp(config.step ?? 1, 0.01, 50),
            defaultValue: clamp(config.defaultValue ?? (config.min + config.max) / 2, config.min ?? 0, config.max ?? 20),
            unit: String(config.unit || '').slice(0, 20),
            hint: String(config.hint || '').slice(0, 100),
            correctValue: typeof config.correctValue === 'number' ? config.correctValue : 0,
            tolerance: clamp(config.tolerance ?? 0, 0, 10),
            label: String(config.label || 'Tu respuesta').slice(0, 40),
        };
    },
};

// ─── Template: Input Numérico ────────────────────────
// MEN: Pensamiento Numérico y Variacional — grados 6-11
// Ejemplos: resolver ecuaciones (7°,9°), calcular áreas (6°,8°),
//           probabilidades (9°), derivadas (11°)
export const INPUT_NUMBER = {
    type: 'input_number',
    grades: [6, 7, 8, 9, 10, 11],
    description: 'El estudiante escribe el resultado numérico en un campo de texto. Ideal para: resolver ecuaciones paso a paso, calcular áreas/perímetros, probabilidades, operar con fracciones.',
    defaultConfig: {
        placeholder: 'Escribe tu respuesta',
        unit: '',
        hint: '',
        correctValue: 0,
        tolerance: 0,
        decimalPlaces: 0,
        context: '',
    },
    validate(config) {
        return typeof config.correctValue === 'number';
    },
    sanitize(config) {
        return {
            placeholder: String(config.placeholder || 'Escribe tu respuesta').slice(0, 60),
            unit: String(config.unit || '').slice(0, 20),
            hint: String(config.hint || '').slice(0, 120),
            correctValue: typeof config.correctValue === 'number' ? config.correctValue : 0,
            tolerance: clamp(config.tolerance ?? 0, 0, 10),
            decimalPlaces: clamp(config.decimalPlaces ?? 0, 0, 4),
            context: String(config.context || '').slice(0, 100),
        };
    },
};

// ─── Template: Drag & Drop para Ordenar ──────────────
// MEN: Pensamiento Numérico — grados 6, 7, 8
// Ejemplos: ordenar fracciones/decimales (6°), ordenar enteros (7°),
//           ordenar radicales (8°), ordenar expresiones algebraicas (8°,9°)
export const DRAG_SORT = {
    type: 'drag_sort',
    grades: [6, 7, 8, 9],
    description: 'El estudiante arrastra y suelta elementos para ordenarlos (de menor a mayor, de mayor a menor). Ideal para: ordenar fracciones, enteros negativos, radicales, expresiones algebraicas.',
    defaultConfig: {
        instruction: 'Ordena de menor a mayor',
        items: [],
        correctOrder: [],
        direction: 'asc',
    },
    validate(config) {
        return Array.isArray(config.items)
            && config.items.length >= 2
            && config.items.length <= 8
            && Array.isArray(config.correctOrder)
            && config.correctOrder.length === config.items.length;
    },
    sanitize(config) {
        const items = (config.items || []).slice(0, 8).map(item => String(item).slice(0, 40));
        const correctOrder = (config.correctOrder || []).slice(0, 8).map(idx => parseInt(idx));
        return {
            instruction: String(config.instruction || 'Ordena de menor a mayor').slice(0, 80),
            items,
            correctOrder,
            direction: config.direction === 'desc' ? 'desc' : 'asc',
        };
    },
};

// ─── Template: Completar Expresión ───────────────────
// MEN: Pensamiento Variacional — grados 7, 8, 9, 10
// Ejemplos: factorización (8°), productos notables (8°),
//           sistema de ecuaciones (9°), identidades trig (10°)
export const FILL_EXPRESSION = {
    type: 'fill_expression',
    grades: [7, 8, 9, 10, 11],
    description: 'El estudiante llena los espacios en blanco de una expresión algebraica. Ideal para: factorización, productos notables, completar identidades, resolver sistemas.',
    defaultConfig: {
        expressionTemplate: '(x + ___)(x - ___) = x² - ___',
        blanks: [],
        hint: '',
        context: '',
    },
    validate(config) {
        return typeof config.expressionTemplate === 'string'
            && Array.isArray(config.blanks)
            && config.blanks.length >= 1
            && config.blanks.every(b => typeof b.correctValue !== 'undefined');
    },
    sanitize(config) {
        return {
            expressionTemplate: String(config.expressionTemplate || '').slice(0, 200),
            blanks: (config.blanks || []).slice(0, 6).map((b, i) => ({
                id: i,
                placeholder: String(b.placeholder || '?').slice(0, 10),
                correctValue: String(b.correctValue ?? '').slice(0, 20),
                tolerance: typeof b.tolerance === 'number' ? b.tolerance : 0,
            })),
            hint: String(config.hint || '').slice(0, 120),
            context: String(config.context || '').slice(0, 100),
        };
    },
};

// ═══════════════════════════════════════════════════════
// REGISTRY — Mapeo tipo → template
// ═══════════════════════════════════════════════════════

export const TEMPLATE_REGISTRY = {
    graph_static: GRAPH_STATIC,
    graph_slider: GRAPH_SLIDER,
    graph_compare: GRAPH_COMPARE,
    number_line: NUMBER_LINE,
    bar_chart: BAR_CHART,
    coordinate_point: COORDINATE_POINT,
    slider_answer: SLIDER_ANSWER,
    input_number: INPUT_NUMBER,
    drag_sort: DRAG_SORT,
    fill_expression: FILL_EXPRESSION,
};

/**
 * Valida y sanitiza la config interactiva generada por el LLM.
 * Retorna null si es inválida (fallback a pregunta tradicional).
 */
export function validateAndSanitize(interactivity) {
    if (!interactivity || typeof interactivity !== 'object') return null;
    const { type, ...config } = interactivity;

    // Tipos de gráficas desactivados temporalmente — requieren parser exacto
    // y producen errores frecuentes. Se usan widgets más confiables.
    const BLOCKED_TYPES = ['graph_static', 'graph_slider', 'graph_compare'];
    if (BLOCKED_TYPES.includes(type)) {
        console.warn(`[INTERACTIVE] Tipo ${type} bloqueado (parser inestable), descartando`);
        return null;
    }

    const template = TEMPLATE_REGISTRY[type];
    if (!template) {
        console.warn(`[INTERACTIVE] Template desconocido: ${type}, fallback a tradicional`);
        return null;
    }
    if (!template.validate(config)) {
        console.warn(`[INTERACTIVE] Config inválida para ${type}, intentando sanitizar...`);
    }
    try {
        return { type, ...template.sanitize(config) };
    } catch (err) {
        console.error(`[INTERACTIVE] Error sanitizando ${type}:`, err);
        return null;
    }
}

/**
 * Retorna templates disponibles para un grado dado (para el prompt del LLM).
 */
export function getTemplatesForGrade(grade) {
    return Object.values(TEMPLATE_REGISTRY)
        .filter(t => t.grades.includes(grade))
        .map(t => ({ type: t.type, description: t.description }));
}

// ─── Helpers ─────────────────────────────────────────
function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function sanitizeViewport(vp) {
    if (!vp || typeof vp !== 'object') return { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
    return {
        xMin: clamp(vp.xMin ?? -10, -MAX_VIEWPORT_RANGE, MAX_VIEWPORT_RANGE),
        xMax: clamp(vp.xMax ?? 10, -MAX_VIEWPORT_RANGE, MAX_VIEWPORT_RANGE),
        yMin: clamp(vp.yMin ?? -7, -MAX_VIEWPORT_RANGE, MAX_VIEWPORT_RANGE),
        yMax: clamp(vp.yMax ?? 7, -MAX_VIEWPORT_RANGE, MAX_VIEWPORT_RANGE),
    };
}
