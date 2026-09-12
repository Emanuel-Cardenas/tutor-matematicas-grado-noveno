'use client';
import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import MathEditor from '@/components/MathEditor';

/**
 * GRAPHING CALCULATOR
 * ===================
 * Calculadora gráfica de funciones para YedaTech.
 * Renderiza funciones matemáticas en un plano cartesiano interactivo.
 * 
 * Features:
 *  - Múltiples funciones simultáneas con colores distintos
 *  - Zoom con rueda del ratón y botones
 *  - Pan (arrastrar para desplazar)
 *  - Coordenadas al pasar el cursor
 *  - Detección de raíces, máximos/mínimos
 *  - Validación de expresiones
 *  - Templates de funciones comunes
 */

const GRAPH_COLORS = [
    '#ff6900', // naranja (YedaTech primary)
    '#3b82f6', // azul
    '#10b981', // verde
    '#ef4444', // rojo
    '#f59e0b', // amarillo
    '#8b5cf6', // morado
    '#06b6d4', // cyan
    '#ec4899', // pink
];

const FUNCTION_TEMPLATES = [
    { label: 'Lineal', expr: '2*x + 3' },
    { label: 'Cuadrática', expr: 'x^2' },
    { label: 'Cúbica', expr: 'x^3' },
    { label: 'Seno', expr: 'sin(x)' },
    { label: 'Coseno', expr: 'cos(x)' },
    { label: 'Tangente', expr: 'tan(x)' },
    { label: 'Raíz', expr: 'sqrt(x)' },
    { label: 'Absoluto', expr: 'abs(x)' },
    { label: 'Exponencial', expr: 'exp(x)' },
    { label: 'Logaritmo', expr: 'log(x)' },
    { label: 'Parábola inv.', expr: '-x^2 + 4' },
    { label: '1/x', expr: '1/x' },
];

/**
 * Parsea una expresión matemática en texto y la convierte a una función JS evaluable.
 * Soporta: +, -, *, /, ^, sin, cos, tan, asin, acos, atan, sqrt, cbrt, abs, log, ln, exp, pi, e
 *
 * Orden de transformaciones:
 *  1. Normalizar y limpiar
 *  2. Reemplazar ^ con ** (operador nativo JS, evita Math.pow() que se corrompe)
 *  3. Multiplicación implícita ANTES de reemplazar funciones
 *  4. Reemplazar nombres de funciones/constantes con Math.xxx
 */
function parseExpression(expr) {
    try {
        // Limpiar y normalizar
        let fn = expr.trim().toLowerCase();

        // Remover "y=" o "f(x)=" si existe
        fn = fn.replace(/^(y\s*=\s*|f\s*\(\s*x\s*\)\s*=\s*)/, '');

        if (!fn) return { error: 'Expresión vacía' };

        // PASO 1: Reemplazar ^ con ** (potencia nativa de JS)
        fn = fn.replace(/\^/g, '**');

        // PASO 2: Multiplicación implícita (ANTES de reemplazar funciones)
        // Necesitamos proteger nombres de funciones: sin, cos, tan, etc.
        // Estrategia: reemplazar funciones con tokens temporales, luego mult implícita, luego restaurar

        // Proteger funciones con tokens
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

        // Ahora aplicar multiplicación implícita de forma segura
        // Dígito seguido de x: 2x → 2*x
        fn = fn.replace(/(\d)(x)/g, '$1*$2');
        // Dígito seguido de (: 2( → 2*(
        fn = fn.replace(/(\d)(\()/g, '$1*$2');
        // Dígito seguido de §(token): 2sin → 2*sin
        fn = fn.replace(/(\d)(§)/g, '$1*$2');
        // ) seguido de dígito, x, ( o token: )(→ )*( , )x → )*x, )2 → )*2
        fn = fn.replace(/\)(\d)/g, ')*$1');
        fn = fn.replace(/\)(x)/g, ')*$1');
        fn = fn.replace(/\)(\()/g, ')*(');
        fn = fn.replace(/\)(§)/g, ')*$1');
        // x seguido de (: x( → x*(
        fn = fn.replace(/(x)(\()/g, '$1*$2');
        // x seguido de token: x sin → x*sin
        fn = fn.replace(/(x)(§)/g, '$1*$2');
        // ) seguido de token a letra
        fn = fn.replace(/\)([a-zA-Z])/g, ')*$1');

        // PASO 3: Restaurar tokens con Math.xxx
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

        // Reemplazar `e` standalone con Math.E (cuidado de no afectar otras palabras)
        fn = fn.replace(/(?<![a-zA-Z.])e(?![a-zA-Z0-9])/g, 'Math.E');

        let jsFn = fn;

        // Verificar que compila
        const testFn = new Function('x', `"use strict"; return (${jsFn});`);
        // Test con múltiples valores para asegurar que no es constante por error
        const testVal1 = testFn(1);
        const testVal2 = testFn(2);
        if (typeof testVal1 !== 'number' && typeof testVal2 !== 'number') {
            return { error: 'La expresión no produce un número' };
        }

        return {
            fn: new Function('x', `"use strict"; try { const r = (${jsFn}); return typeof r === 'number' ? r : NaN; } catch { return NaN; }`),
            displayExpr: expr.trim(),
            error: null,
        };
    } catch (e) {
        return { error: 'Expresión inválida: ' + (e.message || 'revisa la sintaxis') };
    }
}

/**
 * Encuentra raíces aproximadas de f(x) = 0 en el rango visible.
 */
function findRoots(fn, xMin, xMax, steps = 500) {
    const roots = [];
    const dx = (xMax - xMin) / steps;
    let prevY = fn(xMin);

    for (let i = 1; i <= steps; i++) {
        const x = xMin + i * dx;
        const y = fn(x);

        // Cambio de signo → raíz entre prev y current
        if (prevY * y < 0 && isFinite(prevY) && isFinite(y)) {
            // Bisección rápida para refinar
            let lo = x - dx, hi = x;
            for (let j = 0; j < 20; j++) {
                const mid = (lo + hi) / 2;
                if (fn(mid) * fn(lo) < 0) hi = mid;
                else lo = mid;
            }
            const root = (lo + hi) / 2;
            // Evitar duplicados
            if (!roots.some(r => Math.abs(r - root) < dx * 2)) {
                roots.push(root);
            }
        }

        // Valor muy cercano a cero
        if (Math.abs(y) < 1e-10 && isFinite(y)) {
            if (!roots.some(r => Math.abs(r - x) < dx * 2)) {
                roots.push(x);
            }
        }

        prevY = y;
    }

    return roots.slice(0, 10); // Limitar a 10 raíces
}

/**
 * Encuentra máximos y mínimos locales aproximados.
 */
function findExtrema(fn, xMin, xMax, steps = 500) {
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

export default function GraphingCalculator() {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Funciones registradas: { id, expr, displayExpr, fn, color, visible }
    const [functions, setFunctions] = useState([]);
    const [inputExpr, setInputExpr] = useState(''); // LaTeX para mostrar visualmente en el input
    const [inputAscii, setInputAscii] = useState(''); // ASCII math para parsear
    const [inputError, setInputError] = useState(null);

    // Viewport del gráfico
    const [viewport, setViewport] = useState({ xMin: -10, xMax: 10, yMin: -7, yMax: 7 });
    const [isPanning, setIsPanning] = useState(false);
    const panStart = useRef(null);

    // Cursor
    const [cursorPos, setCursorPos] = useState(null); // {x, y} en coordenadas matemáticas
    const [showPoints, setShowPoints] = useState(true);
    const [showTemplates, setShowTemplates] = useState(false);

    // Unique ID counter
    const idCounter = useRef(0);

    // ─── Draw Graph ──────────────────────────────────────────
    const drawGraph = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const { xMin, xMax, yMin, yMax } = viewport;
        const xRange = xMax - xMin;
        const yRange = yMax - yMin;

        // Transform: math coords → pixel coords
        const toPixelX = (x) => ((x - xMin) / xRange) * w;
        const toPixelY = (y) => h - ((y - yMin) / yRange) * h;
        const toMathX = (px) => xMin + (px / w) * xRange;
        const toMathY = (py) => yMax - (py / h) * yRange;

        // ── Background ──
        ctx.fillStyle = '#0f0f0f';
        ctx.fillRect(0, 0, w, h);

        // ── Grid lines ──
        const gridStep = getGridStep(xRange);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;

        // Vertical grid
        const xStart = Math.ceil(xMin / gridStep) * gridStep;
        for (let x = xStart; x <= xMax; x += gridStep) {
            const px = toPixelX(x);
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
        }

        // Horizontal grid
        const yGridStep = getGridStep(yRange);
        const yStart = Math.ceil(yMin / yGridStep) * yGridStep;
        for (let y = yStart; y <= yMax; y += yGridStep) {
            const py = toPixelY(y);
            ctx.beginPath();
            ctx.moveTo(0, py);
            ctx.lineTo(w, py);
            ctx.stroke();
        }

        // ── Axes ──
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;

        // X axis
        if (yMin <= 0 && yMax >= 0) {
            const axisY = toPixelY(0);
            ctx.beginPath();
            ctx.moveTo(0, axisY);
            ctx.lineTo(w, axisY);
            ctx.stroke();
        }

        // Y axis
        if (xMin <= 0 && xMax >= 0) {
            const axisX = toPixelX(0);
            ctx.beginPath();
            ctx.moveTo(axisX, 0);
            ctx.lineTo(axisX, h);
            ctx.stroke();
        }

        // ── Axis labels ──
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        // X axis labels
        for (let x = xStart; x <= xMax; x += gridStep) {
            if (Math.abs(x) < gridStep / 100) continue; // Skip 0
            const px = toPixelX(x);
            const labelY = yMin <= 0 && yMax >= 0 ? toPixelY(0) + 4 : h - 14;
            ctx.fillText(formatAxisLabel(x), px, labelY);
        }

        // Y axis labels
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = yStart; y <= yMax; y += yGridStep) {
            if (Math.abs(y) < yGridStep / 100) continue;
            const py = toPixelY(y);
            const labelX = xMin <= 0 && xMax >= 0 ? toPixelX(0) - 4 : 30;
            ctx.fillText(formatAxisLabel(y), labelX, py);
        }

        // Origin label
        if (xMin <= 0 && xMax >= 0 && yMin <= 0 && yMax >= 0) {
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            ctx.fillText('0', toPixelX(0) - 4, toPixelY(0) + 4);
        }

        // ── Draw functions ──
        functions.forEach((f) => {
            if (!f.visible || !f.fn) return;

            ctx.beginPath();
            ctx.strokeStyle = f.color;
            ctx.lineWidth = 2;
            ctx.lineJoin = 'round';

            let moved = false;
            const step = xRange / w; // One sample per pixel

            for (let px = 0; px <= w; px++) {
                const x = toMathX(px);
                const y = f.fn(x);

                if (!isFinite(y) || Math.abs(y) > yRange * 100) {
                    moved = false;
                    continue;
                }

                const py = toPixelY(y);

                if (!moved) {
                    ctx.moveTo(px, py);
                    moved = true;
                } else {
                    ctx.lineTo(px, py);
                }
            }
            ctx.stroke();

            // ── Special points ──
            if (showPoints) {
                // Roots
                const roots = findRoots(f.fn, xMin, xMax);
                roots.forEach(rx => {
                    const px = toPixelX(rx);
                    const py = toPixelY(0);
                    drawPoint(ctx, px, py, f.color, 5);
                    ctx.fillStyle = f.color;
                    ctx.font = '9px Inter, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(`(${formatNum(rx)}, 0)`, px, py - 7);
                });

                // Extrema
                const extrema = findExtrema(f.fn, xMin, xMax);
                extrema.forEach(ext => {
                    const px = toPixelX(ext.x);
                    const py = toPixelY(ext.y);
                    if (px >= 0 && px <= w && py >= 0 && py <= h) {
                        drawPoint(ctx, px, py, ext.type === 'max' ? '#22c55e' : '#f59e0b', 4);
                        ctx.fillStyle = ext.type === 'max' ? '#22c55e' : '#f59e0b';
                        ctx.font = '9px Inter, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = ext.type === 'max' ? 'bottom' : 'top';
                        const label = `${ext.type === 'max' ? '▲' : '▼'} (${formatNum(ext.x)}, ${formatNum(ext.y)})`;
                        ctx.fillText(label, px, py + (ext.type === 'max' ? -7 : 7));
                    }
                });
            }
        });

        // ── Cursor crosshair ──
        if (cursorPos) {
            const cpx = toPixelX(cursorPos.x);
            const cpy = toPixelY(cursorPos.y);

            // Crosshair lines
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(cpx, 0);
            ctx.lineTo(cpx, h);
            ctx.moveTo(0, cpy);
            ctx.lineTo(w, cpy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Coordinate label
            ctx.fillStyle = 'rgba(255,255,255,0.85)';
            ctx.font = '11px "Courier New", monospace';
            ctx.textAlign = cpx > w - 120 ? 'right' : 'left';
            ctx.textBaseline = 'bottom';
            ctx.fillText(
                `(${formatNum(cursorPos.x)}, ${formatNum(cursorPos.y)})`,
                cpx + (cpx > w - 120 ? -8 : 8),
                cpy - 6
            );

            // Points on each function at cursor x
            functions.forEach(f => {
                if (!f.visible || !f.fn) return;
                const y = f.fn(cursorPos.x);
                if (isFinite(y) && Math.abs(y) < yRange * 10) {
                    const fpx = toPixelX(cursorPos.x);
                    const fpy = toPixelY(y);
                    drawPoint(ctx, fpx, fpy, f.color, 4);
                }
            });
        }
    }, [functions, viewport, cursorPos, showPoints]);

    // ─── Helpers ─────────────────────────────────────────────
    function drawPoint(ctx, x, y, color, r) {
        ctx.beginPath();
        ctx.fillStyle = color;
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    function getGridStep(range) {
        const raw = range / 10;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        const norm = raw / mag;
        if (norm <= 1.5) return mag;
        if (norm <= 3.5) return 2 * mag;
        if (norm <= 7.5) return 5 * mag;
        return 10 * mag;
    }

    function formatAxisLabel(v) {
        if (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0)) return v.toExponential(1);
        if (Number.isInteger(v)) return v.toString();
        return v.toFixed(2);
    }

    function formatNum(v) {
        if (Math.abs(v) < 0.005) return '0';
        if (Number.isInteger(v)) return v.toString();
        return v.toFixed(2);
    }

    // ─── Redraw on state change ──────────────────────────────
    useEffect(() => {
        if (isOpen) drawGraph();
    }, [isOpen, isFullscreen, functions, viewport, cursorPos, showPoints, drawGraph]);

    // Resize observer
    useEffect(() => {
        if (!isOpen || !containerRef.current) return;
        const ro = new ResizeObserver(() => drawGraph());
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [isOpen, drawGraph]);

    // ─── Add function ────────────────────────────────────────
    const addFunction = useCallback((expr, ascii = null) => {
        const exprToParse = ascii || expr || inputAscii || inputExpr;
        const display = expr || inputExpr;
        if (!exprToParse.trim() && !display.trim()) return;

        const result = parseExpression(exprToParse);
        if (result.error) {
            setInputError(result.error);
            setTimeout(() => setInputError(null), 3000);
            return;
        }

        setFunctions(prev => [...prev, {
            id: idCounter.current++,
            expr: exprToParse.trim(),
            displayExpr: display || result.displayExpr,
            fn: result.fn,
            color: GRAPH_COLORS[prev.length % GRAPH_COLORS.length],
            visible: true,
        }]);
        setInputExpr('');
        setInputAscii('');
        setInputError(null);
    }, [inputExpr, inputAscii]);

    const removeFunction = useCallback((id) => {
        setFunctions(prev => prev.filter(f => f.id !== id));
    }, []);

    const toggleFunction = useCallback((id) => {
        setFunctions(prev => prev.map(f => f.id === id ? { ...f, visible: !f.visible } : f));
    }, []);

    // ─── Zoom ────────────────────────────────────────────────
    const handleZoom = useCallback((factor, centerX, centerY) => {
        setViewport(prev => {
            const cx = centerX ?? (prev.xMin + prev.xMax) / 2;
            const cy = centerY ?? (prev.yMin + prev.yMax) / 2;
            const xRange = (prev.xMax - prev.xMin) * factor;
            const yRange = (prev.yMax - prev.yMin) * factor;
            return {
                xMin: cx - xRange / 2,
                xMax: cx + xRange / 2,
                yMin: cy - yRange / 2,
                yMax: cy + yRange / 2,
            };
        });
    }, []);

    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const { xMin, xMax, yMin, yMax } = viewport;
        const mx = xMin + (px / rect.width) * (xMax - xMin);
        const my = yMax - (py / rect.height) * (yMax - yMin);
        const factor = e.deltaY > 0 ? 1.15 : 0.87;
        handleZoom(factor, mx, my);
    }, [viewport, handleZoom]);

    // ─── Pan ─────────────────────────────────────────────────
    const handlePanStart = useCallback((e) => {
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        setIsPanning(true);
        panStart.current = { x: clientX, y: clientY, vp: { ...viewport } };
    }, [viewport]);

    const handlePanMove = useCallback((e) => {
        if (!isPanning || !panStart.current) return;
        const clientX = e.clientX ?? e.touches?.[0]?.clientX;
        const clientY = e.clientY ?? e.touches?.[0]?.clientY;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dx = clientX - panStart.current.x;
        const dy = clientY - panStart.current.y;
        const vp = panStart.current.vp;
        const xShift = -(dx / rect.width) * (vp.xMax - vp.xMin);
        const yShift = (dy / rect.height) * (vp.yMax - vp.yMin);
        setViewport({
            xMin: vp.xMin + xShift,
            xMax: vp.xMax + xShift,
            yMin: vp.yMin + yShift,
            yMax: vp.yMax + yShift,
        });
    }, [isPanning]);

    const handlePanEnd = useCallback(() => {
        setIsPanning(false);
        panStart.current = null;
    }, []);

    // ─── Cursor tracking ─────────────────────────────────────
    const handleMouseMove = useCallback((e) => {
        if (isPanning) {
            handlePanMove(e);
            return;
        }
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        const { xMin, xMax, yMin, yMax } = viewport;
        setCursorPos({
            x: xMin + (px / rect.width) * (xMax - xMin),
            y: yMax - (py / rect.height) * (yMax - yMin),
        });
    }, [viewport, isPanning, handlePanMove]);

    const handleMouseLeave = useCallback(() => {
        setCursorPos(null);
    }, []);

    // ─── Reset view ──────────────────────────────────────────
    const resetView = useCallback(() => {
        setViewport({ xMin: -10, xMax: 10, yMin: -7, yMax: 7 });
    }, []);

    // ─── Clear all (full reset) ──────────────────────────────
    const clearAll = useCallback(() => {
        setFunctions([]);
        setInputExpr('');
        setInputAscii('');
        setInputError(null);
        setViewport({ xMin: -10, xMax: 10, yMin: -7, yMax: 7 });
        setCursorPos(null);
    }, []);

    // ─── Key handler ─────────────────────────────────────────
    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addFunction();
        }
    }, [addFunction]);

    // ─── FAB (closed) ────────────────────────────────────────
    if (!isOpen) {
        return (
            <button
                className="gcalc-fab"
                onClick={() => setIsOpen(true)}
                title="Calculadora Gráfica"
                id="graphing-calc-fab"
            >
                <span className="gcalc-fab-icon">📈</span>
            </button>
        );
    }

    return (
        <div className={`gcalc-panel ${isFullscreen ? 'gcalc-fullscreen' : ''}`} id="graphing-calculator">
            {/* Header */}
            <div className="gcalc-header">
                <div className="gcalc-header-left">
                    <span className="gcalc-title">📈 Gráfica de Funciones</span>
                    <span className="gcalc-fn-count">{functions.filter(f => f.visible).length} funciones</span>
                </div>
                <div className="gcalc-header-actions">
                    <button
                        className={`gcalc-icon-btn ${showPoints ? 'gcalc-btn-active' : ''}`}
                        onClick={() => setShowPoints(!showPoints)}
                        title={showPoints ? 'Ocultar puntos especiales' : 'Mostrar puntos especiales'}
                    >📍</button>
                    <button className="gcalc-icon-btn" onClick={resetView} title="Centrar vista">🔄</button>
                    <button
                        className="gcalc-icon-btn gcalc-clear-btn"
                        onClick={clearAll}
                        title="Limpiar todo (eliminar funciones y resetear)"
                        disabled={functions.length === 0}
                    >🗑</button>
                    <button className="gcalc-icon-btn" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Reducir' : 'Pantalla completa'}>
                        {isFullscreen ? '⊡' : '⊞'}
                    </button>
                    <button className="gcalc-icon-btn gcalc-close-btn" onClick={() => { setIsOpen(false); setIsFullscreen(false); }} title="Cerrar">✕</button>
                </div>
            </div>

            {/* Input bar */}
            <div className="gcalc-input-bar">
                <div className="gcalc-input-wrapper" style={{ display: 'flex', alignItems: 'center' }}>
                    <span className="gcalc-input-prefix">f(x) =</span>
                    <MathEditor
                        className="gcalc-input math-input-mode"
                        value={inputExpr}
                        onChange={(latex, ascii) => { setInputExpr(latex); setInputAscii(ascii); setInputError(null); }}
                        onEnter={() => addFunction()}
                        placeholder="x^2, \sin(x), \frac{2}{x}..."
                    />
                    <button
                        className="gcalc-add-btn"
                        onClick={() => addFunction()}
                        disabled={!inputExpr.trim()}
                        title="Graficar función"
                    >Graficar</button>
                </div>
                {inputError && (
                    <div className="gcalc-error">{inputError}</div>
                )}
                <button
                    className="gcalc-templates-toggle"
                    onClick={() => setShowTemplates(!showTemplates)}
                >
                    {showTemplates ? '▴ Ocultar plantillas' : '▾ Plantillas'}
                </button>
            </div>

            {/* Templates */}
            {showTemplates && (
                <div className="gcalc-templates">
                    {FUNCTION_TEMPLATES.map((t, i) => (
                        <button
                            key={i}
                            className="gcalc-template-btn"
                            onClick={() => { addFunction(t.expr); setShowTemplates(false); }}
                            title={`Graficar ${t.expr}`}
                        >
                            <span className="gcalc-template-label">{t.label}</span>
                            <span className="gcalc-template-expr">{t.expr}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* Function list */}
            {functions.length > 0 && (
                <div className="gcalc-fn-list">
                    {functions.map((f) => (
                        <div key={f.id} className={`gcalc-fn-item ${!f.visible ? 'gcalc-fn-hidden' : ''}`}>
                            <div
                                className="gcalc-fn-color"
                                style={{ background: f.color }}
                                onClick={() => toggleFunction(f.id)}
                                title={f.visible ? 'Ocultar' : 'Mostrar'}
                            />
                            <span className="gcalc-fn-expr" onClick={() => toggleFunction(f.id)}>
                                f(x) = <math-field readonly style={{ border: 'none', background: 'transparent', color: 'inherit', padding: 0, margin: 0 }}>{f.displayExpr}</math-field>
                            </span>
                            <button className="gcalc-fn-remove" onClick={() => removeFunction(f.id)} title="Eliminar">✕</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Canvas */}
            <div className="gcalc-canvas-container" ref={containerRef}>
                <canvas
                    ref={canvasRef}
                    className="gcalc-canvas"
                    onWheel={handleWheel}
                    onMouseDown={handlePanStart}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handlePanEnd}
                    onMouseLeave={(e) => { handlePanEnd(); handleMouseLeave(); }}
                    onTouchStart={handlePanStart}
                    onTouchMove={handlePanMove}
                    onTouchEnd={handlePanEnd}
                    style={{ cursor: isPanning ? 'grabbing' : 'crosshair' }}
                />

                {/* Zoom controls */}
                <div className="gcalc-zoom-controls">
                    <button className="gcalc-zoom-btn" onClick={() => handleZoom(0.75)} title="Acercar">+</button>
                    <button className="gcalc-zoom-btn" onClick={() => handleZoom(1.35)} title="Alejar">−</button>
                </div>

                {/* Empty state */}
                {functions.length === 0 && (
                    <div className="gcalc-empty-state">
                        <div className="gcalc-empty-icon">📊</div>
                        <div className="gcalc-empty-text">Ingresa una función para graficarla</div>
                        <div className="gcalc-empty-hint">Ejemplo: x^2, sin(x), 2*x+3</div>
                    </div>
                )}
            </div>
        </div>
    );
}
