// ═══════════════════════════════════════════════════════
// MATH PARSER — Motor de parsing de expresiones
// ═══════════════════════════════════════════════════════
// Extraído de GraphingCalculator para uso compartido.
// Convierte strings como "2*x^2 + sin(x)" en funciones
// JS evaluables de forma SEGURA (sin eval global).
// ═══════════════════════════════════════════════════════

/**
 * Parsea una expresión matemática en texto y la convierte a una función JS evaluable.
 * Soporta: +, -, *, /, ^, sin, cos, tan, asin, acos, atan, sqrt, cbrt, abs, log, ln, exp, pi, e
 * También soporta variables adicionales (para los sliders: a, b, c, etc.)
 *
 * @param {string} expr — expresión matemática
 * @param {string[]} extraVars — variables adicionales además de 'x' (ej: ['a', 'b'])
 * @returns {{ fn: Function|null, displayExpr: string, error: string|null }}
 */
export function parseExpression(expr, extraVars = []) {
    try {
        let fn = expr.trim();

        // Remover "y=", "f(x)=", "f(t)=" si existe
        fn = fn.replace(/^(y\s*=\s*|f\s*\(\s*[xt]\s*\)\s*=\s*|g\s*\(\s*[xt]\s*\)\s*=\s*|h\s*\(\s*[xt]\s*\)\s*=\s*)/i, '');

        if (!fn.trim()) return { fn: null, displayExpr: expr, error: 'Expresión vacía' };

        fn = fn.trim().toLowerCase();

        // Normalizar variable 't' a 'x' (el LLM a veces usa t para tiempo)
        // Solo si 't' no es parte de una función como tan, tanh, etc.
        fn = fn.replace(/(?<![a-z])t(?![a-z])/g, 'x');

        // Manejar pow(base, exp) → (base)**(exp)
        fn = fn.replace(/pow\s*\(([^,]+),\s*([^)]+)\)/g, '(($1)**($2))');

        // Normalizar ** ya existente (el LLM a veces usa Python syntax)
        // Proteger para no doblar conversión: x**2 no debe volverse x****2
        const hasPow = fn.includes('**');

        // PASO 1: Reemplazar ^ con ** (potencia nativa de JS)
        // Solo reemplazar ^ que no sea ya parte de **
        fn = fn.replace(/\^/g, '**');

        // Si había ** y también ^, ahora puede haber ****. Normalizamos:
        fn = fn.replace(/\*{3,}/g, '**');

        // Manejar - unario antes de variable: -x → -1*x, -x**2 → -1*x**2
        // Pero solo cuando no va precedido de un operador/número
        fn = fn.replace(/(^|[+\-*/,(])(-)(x)([^a-z]|$)/g, '$1(-1*$3)$4');

        // PASO 2: Proteger funciones con tokens
        const funcTokens = [
            ['asin', '§ASIN§'], ['acos', '§ACOS§'], ['atan', '§ATAN§'],
            ['sinh', '§SINH§'], ['cosh', '§COSH§'], ['tanh', '§TANH§'],
            ['sin', '§SIN§'], ['cos', '§COS§'], ['tan', '§TAN§'],
            ['sqrt', '§SQRT§'], ['cbrt', '§CBRT§'], ['abs', '§ABS§'],
            ['log', '§LOG§'], ['ln', '§LN§'], ['exp', '§EXP§'],
            ['pi', '§PI§'],
        ];

        for (const [name, token] of funcTokens) {
            fn = fn.replace(new RegExp('\\b' + name + '\\b', 'g'), token);
        }

        // PASO 3: Multiplicación implícita
        const allVars = ['x', ...extraVars];
        for (const v of allVars) {
            // Dígito seguido de variable: 2x → 2*x
            fn = fn.replace(new RegExp(`(\\d)(${v})`, 'g'), '$1*$2');
            // Variable seguida de paréntesis: x( → x*(
            fn = fn.replace(new RegExp(`(${v})(\\()`, 'g'), '$1*(');
            // Paréntesis cerrado seguido de variable: )x → )*x
            fn = fn.replace(new RegExp(`(\\))(${v})`, 'g'), ')*$2');
        }
        // Dígito seguido de paréntesis: 2( → 2*(
        fn = fn.replace(/(\d)(\()/g, '$1*(');
        // Dígito seguido de función token: 2sin → 2*sin
        fn = fn.replace(/(\d)(§)/g, '$1*$2');
        // Paréntesis cerrado + dígito: )2 → )*2
        fn = fn.replace(/\)(\d)/g, ')*$1');
        // Paréntesis cerrado + paréntesis abierto: )( → )*(
        fn = fn.replace(/\)(\()/g, ')*(');
        // Paréntesis cerrado + función token: )sin → )*sin
        fn = fn.replace(/\)(§)/g, ')*$1');

        // PASO 4: Restaurar tokens con Math.xxx
        const tokenToMath = {
            '§ASIN§': 'Math.asin', '§ACOS§': 'Math.acos', '§ATAN§': 'Math.atan',
            '§SINH§': 'Math.sinh', '§COSH§': 'Math.cosh', '§TANH§': 'Math.tanh',
            '§SIN§': 'Math.sin', '§COS§': 'Math.cos', '§TAN§': 'Math.tan',
            '§SQRT§': 'Math.sqrt', '§CBRT§': 'Math.cbrt', '§ABS§': 'Math.abs',
            '§LOG§': 'Math.log10', '§LN§': 'Math.log', '§EXP§': 'Math.exp',
            '§PI§': 'Math.PI',
        };

        for (const [token, mathFn] of Object.entries(tokenToMath)) {
            fn = fn.replaceAll(token, mathFn);
        }

        // Reemplazar `e` standalone con Math.E (pero not after dot or inside words)
        fn = fn.replace(/(?<![a-zA-Z.])e(?![a-zA-Z0-9])/g, 'Math.E');

        const jsFn = fn;

        // Construir args: (x, a, b, c, ...)
        const args = ['x', ...extraVars];

        // Verificar que compila
        const testFn = new Function(...args, `"use strict"; return (${jsFn});`);
        // Test con valor 1 para cada arg
        const testArgs = args.map(() => 1);
        testFn(...testArgs); // Just verify it doesn't throw

        const safeFn = new Function(
            ...args,
            `"use strict"; try { const r = (${jsFn}); return typeof r === 'number' ? r : NaN; } catch { return NaN; }`
        );

        return { fn: safeFn, displayExpr: expr.trim(), error: null };
    } catch (e) {
        console.warn('[MATH-PARSER] Error parsing:', expr, e.message);
        return { fn: null, displayExpr: expr, error: 'Expresión inválida: ' + (e.message || 'revisa la sintaxis') };
    }
}

/**
 * Encuentra raíces aproximadas de f(x) = 0 en el rango dado.
 */
export function findRoots(fn, xMin, xMax, steps = 500) {
    const roots = [];
    const dx = (xMax - xMin) / steps;
    let prevY = fn(xMin);

    for (let i = 1; i <= steps; i++) {
        const x = xMin + i * dx;
        const y = fn(x);

        if (prevY * y < 0 && isFinite(prevY) && isFinite(y)) {
            let lo = x - dx, hi = x;
            for (let j = 0; j < 20; j++) {
                const mid = (lo + hi) / 2;
                if (fn(mid) * fn(lo) < 0) hi = mid;
                else lo = mid;
            }
            const root = (lo + hi) / 2;
            if (!roots.some(r => Math.abs(r - root) < dx * 2)) {
                roots.push(root);
            }
        }

        if (Math.abs(y) < 1e-10 && isFinite(y)) {
            if (!roots.some(r => Math.abs(r - x) < dx * 2)) {
                roots.push(x);
            }
        }

        prevY = y;
    }

    return roots.slice(0, 10);
}

/**
 * Encuentra máximos y mínimos locales aproximados.
 */
export function findExtrema(fn, xMin, xMax, steps = 500) {
    const extrema = [];
    const dx = (xMax - xMin) / steps;

    for (let i = 1; i < steps - 1; i++) {
        const xPrev = xMin + (i - 1) * dx;
        const xCurr = xMin + i * dx;
        const xNext = xMin + (i + 1) * dx;
        const yPrev = fn(xPrev);
        const yCurr = fn(xCurr);
        const yNext = fn(xNext);

        if (!isFinite(yPrev) || !isFinite(yCurr) || !isFinite(yNext)) continue;

        if (yCurr > yPrev && yCurr > yNext) {
            extrema.push({ x: xCurr, y: yCurr, type: 'max' });
        } else if (yCurr < yPrev && yCurr < yNext) {
            extrema.push({ x: xCurr, y: yCurr, type: 'min' });
        }
    }

    return extrema.slice(0, 10);
}
