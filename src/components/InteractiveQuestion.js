'use client';
import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import MathText from '@/components/MathText';
import { parseExpression, findRoots, findExtrema } from '@/lib/math-parser';

// ═══════════════════════════════════════════════════════
// INTERACTIVE QUESTION — Renderizador de preguntas interactivas
// ═══════════════════════════════════════════════════════
// Renderiza visualizaciones matemáticas basadas en config declarativa.
// NO ejecuta código arbitrario del LLM — solo interpreta JSON seguro.
//
// v3: 4 nuevos widgets con input directo del estudiante:
//   slider_answer, input_number, drag_sort, fill_expression
// Todos alineados al currículo MEN por grado.
// ═══════════════════════════════════════════════════════

const GRAPH_COLORS = ['#ff6900', '#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

export default function InteractiveQuestion({ question, onInteractiveAnswer, currentAnswer }) {
    if (!question || !question.interactivity) return null;

    const { type } = question.interactivity;

    switch (type) {
        case 'graph_static':
            return <GraphWidget config={question.interactivity} />;
        case 'graph_slider':
            return <GraphSliderWidget config={question.interactivity} />;
        case 'graph_compare':
            return <GraphWidget config={question.interactivity} isCompare />;
        case 'number_line':
            return <NumberLineWidget config={question.interactivity} />;
        case 'bar_chart':
            return <BarChartWidget config={question.interactivity} />;
        case 'coordinate_point':
            return <CoordinatePointWidget config={question.interactivity} />;
        // ── Nuevos widgets con input directo ──
        case 'slider_answer':
            return <SliderAnswerWidget config={question.interactivity} onAnswer={onInteractiveAnswer} savedAnswer={currentAnswer} />;
        case 'input_number':
            return <InputNumberWidget config={question.interactivity} onAnswer={onInteractiveAnswer} savedAnswer={currentAnswer} />;
        case 'drag_sort':
            return <DragSortWidget config={question.interactivity} onAnswer={onInteractiveAnswer} savedAnswer={currentAnswer} />;
        case 'fill_expression':
            return <FillExpressionWidget config={question.interactivity} onAnswer={onInteractiveAnswer} savedAnswer={currentAnswer} />;
        default:
            return null;
    }
}

// ═══════════════════════════════════════════════════════
// AUTO-VIEWPORT — Calcula viewport óptimo para las funciones
// ═══════════════════════════════════════════════════════

/**
 * Evalúa las funciones en el rango X dado y calcula un viewport Y
 * que realmente contenga las curvas. Si el viewport del LLM es
 * incorrecto (las curvas no son visibles), lo reemplaza.
 */
function computeAutoViewport(parsedFunctions, configViewport, sliderVars = {}) {
    const vp = configViewport || { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
    const { xMin, xMax } = vp;

    if (parsedFunctions.length === 0 || parsedFunctions.every(f => !f.fn)) {
        return vp;
    }

    // Sample all functions across the x range
    const samples = 200;
    let allYValues = [];
    let visibleInOriginal = 0;

    for (const f of parsedFunctions) {
        if (!f.fn) continue;
        for (let i = 0; i <= samples; i++) {
            const x = xMin + (i / samples) * (xMax - xMin);
            try {
                const args = [x, ...Object.values(sliderVars)];
                const y = f.fn(...args);
                if (isFinite(y) && !isNaN(y) && Math.abs(y) < 1e12) {
                    allYValues.push(y);
                    if (y >= vp.yMin && y <= vp.yMax) {
                        visibleInOriginal++;
                    }
                }
            } catch { /* skip */ }
        }
    }

    if (allYValues.length === 0) return vp;

    // If more than 20% of sampled points are visible in the original viewport,
    // it's probably fine — keep the LLM's viewport
    const visibleRatio = visibleInOriginal / allYValues.length;
    if (visibleRatio > 0.2) {
        return vp;
    }

    // Auto-compute a viewport that fits all function values
    allYValues.sort((a, b) => a - b);

    // Use 5th and 95th percentile to avoid outliers from asymptotes
    const p5 = allYValues[Math.floor(allYValues.length * 0.05)];
    const p95 = allYValues[Math.floor(allYValues.length * 0.95)];

    const yRange = p95 - p5;
    const padding = yRange * 0.15; // 15% padding

    const autoYMin = Math.floor((p5 - padding) * 10) / 10;
    const autoYMax = Math.ceil((p95 + padding) * 10) / 10;

    // Ensure we have a reasonable range (not zero)
    const finalYMin = autoYMin === autoYMax ? autoYMin - 5 : autoYMin;
    const finalYMax = autoYMin === autoYMax ? autoYMax + 5 : autoYMax;

    console.log(`[IQ] Auto-viewport: LLM yMin=${vp.yMin} yMax=${vp.yMax} → auto yMin=${finalYMin} yMax=${finalYMax} (${visibleRatio.toFixed(2)} visible ratio)`);

    return { xMin, xMax, yMin: finalYMin, yMax: finalYMax };
}


// ═══════════════════════════════════════════════════════
// GRAPH WIDGET — Gráfica estática o comparativa
// ═══════════════════════════════════════════════════════

function GraphWidget({ config, isCompare = false, sliderVars = {} }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    const configViewport = config.viewport || { xMin: -10, xMax: 10, yMin: -7, yMax: 7 };
    const showRoots = config.showRoots !== false;
    const showExtrema = config.showExtrema !== false;
    const labels = config.functionLabels || [];

    // Parse functions with slider variables
    const parsedFunctions = useMemo(() => {
        const extraVars = Object.keys(sliderVars);
        return (config.functions || []).map((expr, i) => {
            const result = parseExpression(expr, extraVars);
            if (result.error) {
                console.warn(`[IQ] Error parsing "${expr}":`, result.error);
            }
            return {
                expr,
                fn: result.fn,
                color: GRAPH_COLORS[i % GRAPH_COLORS.length],
                label: labels[i] || `f${i + 1}(x)`,
                error: result.error,
            };
        });
    }, [config.functions, sliderVars, labels]);

    // Auto-compute viewport if LLM's viewport doesn't show the functions
    const viewport = useMemo(() => {
        return computeAutoViewport(parsedFunctions, configViewport, sliderVars);
    }, [parsedFunctions, configViewport, sliderVars]);

    const drawGraph = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;

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

        if (xRange === 0 || yRange === 0) return;

        const toPixelX = (x) => ((x - xMin) / xRange) * w;
        const toPixelY = (y) => h - ((y - yMin) / yRange) * h;

        // Background
        ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Grid
        const gridStep = getGridStep(xRange);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;

        const xStart = Math.ceil(xMin / gridStep) * gridStep;
        for (let x = xStart; x <= xMax; x += gridStep) {
            const px = toPixelX(x);
            ctx.beginPath(); ctx.moveTo(px, 0); ctx.lineTo(px, h); ctx.stroke();
        }

        const yGridStep = getGridStep(yRange);
        const yStart = Math.ceil(yMin / yGridStep) * yGridStep;
        for (let y = yStart; y <= yMax; y += yGridStep) {
            const py = toPixelY(y);
            ctx.beginPath(); ctx.moveTo(0, py); ctx.lineTo(w, py); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        if (yMin <= 0 && yMax >= 0) {
            const axisY = toPixelY(0);
            ctx.beginPath(); ctx.moveTo(0, axisY); ctx.lineTo(w, axisY); ctx.stroke();
        }
        if (xMin <= 0 && xMax >= 0) {
            const axisX = toPixelX(0);
            ctx.beginPath(); ctx.moveTo(axisX, 0); ctx.lineTo(axisX, h); ctx.stroke();
        }

        // Axis labels
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let x = xStart; x <= xMax; x += gridStep) {
            if (Math.abs(x) < gridStep / 100) continue;
            const labelY = yMin <= 0 && yMax >= 0 ? Math.min(toPixelY(0) + 4, h - 14) : h - 14;
            ctx.fillText(formatAxisLabel(x), toPixelX(x), labelY);
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = yStart; y <= yMax; y += yGridStep) {
            if (Math.abs(y) < yGridStep / 100) continue;
            const labelX = xMin <= 0 && xMax >= 0 ? Math.max(toPixelX(0) - 4, 35) : 35;
            ctx.fillText(formatAxisLabel(y), labelX, toPixelY(y));
        }

        // Draw functions
        parsedFunctions.forEach((f) => {
            if (!f.fn) return;

            // Create bound function with slider values
            const evalFn = (x) => {
                try {
                    const args = [x, ...Object.values(sliderVars)];
                    return f.fn(...args);
                } catch { return NaN; }
            };

            ctx.beginPath();
            ctx.strokeStyle = f.color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';

            let moved = false;
            const pixelStep = Math.max(1, Math.floor(w / 800)); // Adaptive resolution
            for (let px = 0; px <= w; px += pixelStep) {
                const x = xMin + (px / w) * xRange;
                const y = evalFn(x);

                // Allow rendering even outside viewport (clip naturally via canvas)
                if (!isFinite(y) || isNaN(y)) { moved = false; continue; }

                // Skip discontinuities (large jumps between consecutive points)
                const py = toPixelY(y);
                if (py < -h * 2 || py > h * 3) { moved = false; continue; }

                if (!moved) { ctx.moveTo(px, py); moved = true; }
                else { ctx.lineTo(px, py); }
            }
            ctx.stroke();

            // Roots (only within visible viewport)
            if (showRoots) {
                try {
                    const roots = findRoots(evalFn, xMin, xMax);
                    roots.forEach((rx) => {
                        if (0 >= yMin && 0 <= yMax) { // Only show root markers if y=0 is visible
                            const rpx = toPixelX(rx);
                            const rpy = toPixelY(0);
                            drawPoint(ctx, rpx, rpy, f.color, 5);
                            ctx.fillStyle = f.color;
                            ctx.font = '9px Inter, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = 'bottom';
                            ctx.fillText(`(${formatNum(rx)}, 0)`, rpx, rpy - 7);
                        }
                    });
                } catch { /* skip */ }
            }

            // Extrema
            if (showExtrema) {
                try {
                    const extrema = findExtrema(evalFn, xMin, xMax);
                    extrema.forEach((ext) => {
                        const epx = toPixelX(ext.x);
                        const epy = toPixelY(ext.y);
                        if (epx >= 0 && epx <= w && epy >= 0 && epy <= h) {
                            drawPoint(ctx, epx, epy, ext.type === 'max' ? '#22c55e' : '#f59e0b', 4);
                            ctx.fillStyle = ext.type === 'max' ? '#22c55e' : '#f59e0b';
                            ctx.font = '9px Inter, sans-serif';
                            ctx.textAlign = 'center';
                            ctx.textBaseline = ext.type === 'max' ? 'bottom' : 'top';
                            ctx.fillText(`${ext.type === 'max' ? '▲' : '▼'} (${formatNum(ext.x)}, ${formatNum(ext.y)})`, epx, epy + (ext.type === 'max' ? -7 : 7));
                        }
                    });
                } catch { /* skip */ }
            }
        });

        // Legend
        if (isCompare || parsedFunctions.length > 1) {
            // Semi-transparent background for legend
            const legendPadding = 6;
            const legendLineH = 16;
            const legendH = parsedFunctions.length * legendLineH + legendPadding * 2;
            const legendW = 160;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
            ctx.beginPath();
            ctx.roundRect(6, 6, legendW, legendH, 6);
            ctx.fill();

            let legendY = 6 + legendPadding + 8;
            parsedFunctions.forEach((f) => {
                // Color line
                ctx.strokeStyle = f.color;
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(14, legendY);
                ctx.lineTo(30, legendY);
                ctx.stroke();

                // Label text
                ctx.fillStyle = 'rgba(255,255,255,0.9)';
                ctx.font = '10px Inter, sans-serif';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                ctx.fillText(f.label || f.expr, 36, legendY);
                legendY += legendLineH;
            });
        }

        // Error indicator if no functions rendered
        if (parsedFunctions.every(f => !f.fn)) {
            ctx.fillStyle = 'rgba(239,68,68,0.8)';
            ctx.font = '12px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚠ No se pudieron graficar las funciones', w / 2, h / 2);
        }
    }, [parsedFunctions, viewport, sliderVars, showRoots, showExtrema, isCompare]);

    useEffect(() => { drawGraph(); }, [drawGraph]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => drawGraph());
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [drawGraph]);

    return (
        <div className="iq-container">
            <div className="iq-graph-area" ref={containerRef}>
                <canvas ref={canvasRef} className="iq-canvas" />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// GRAPH + SLIDER WIDGET
// ═══════════════════════════════════════════════════════

function GraphSliderWidget({ config }) {
    const variables = config.variables || {};
    const [values, setValues] = useState(() => {
        const initial = {};
        for (const [key, def] of Object.entries(variables)) {
            initial[key] = def.default ?? (def.min + def.max) / 2;
        }
        return initial;
    });

    const handleSliderChange = useCallback((varName, newValue) => {
        setValues(prev => ({ ...prev, [varName]: parseFloat(newValue) }));
    }, []);

    return (
        <div className="iq-container">
            <GraphWidget config={config} sliderVars={values} />
            <div className="iq-sliders">
                {Object.entries(variables).map(([varName, def]) => (
                    <div key={varName} className="iq-slider-row">
                        <label className="iq-slider-label">
                            <MathText text={`$${def.label || varName}$`} />
                        </label>
                        <input
                            type="range"
                            className="iq-slider-input"
                            min={def.min}
                            max={def.max}
                            step={def.step || 0.1}
                            value={values[varName]}
                            onChange={(e) => handleSliderChange(varName, e.target.value)}
                        />
                        <span className="iq-slider-value">{values[varName].toFixed(2)}</span>
                    </div>
                ))}
            </div>
            <p className="iq-instruction">🎛️ Mueve los controles para explorar cómo cambia la gráfica</p>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// NUMBER LINE WIDGET
// ═══════════════════════════════════════════════════════

function NumberLineWidget({ config }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const { min, max, points = [] } = config;

    const drawLine = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const padding = 40;
        const lineY = h / 2;
        const lineStart = padding;
        const lineEnd = w - padding;
        const lineWidth = lineEnd - lineStart;
        const range = max - min;

        if (range === 0) return;
        const toX = (val) => lineStart + ((val - min) / range) * lineWidth;

        // Background
        ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Main line
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(lineEnd, lineY);
        ctx.stroke();

        // Arrows
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath();
        ctx.moveTo(lineStart, lineY);
        ctx.lineTo(lineStart + 8, lineY - 5);
        ctx.lineTo(lineStart + 8, lineY + 5);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(lineEnd, lineY);
        ctx.lineTo(lineEnd - 8, lineY - 5);
        ctx.lineTo(lineEnd - 8, lineY + 5);
        ctx.fill();

        // Tick marks
        const step = getGridStep(range);
        const tickStart = Math.ceil(min / step) * step;
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let v = tickStart; v <= max; v += step) {
            const x = toX(v);
            ctx.beginPath();
            ctx.moveTo(x, lineY - 6);
            ctx.lineTo(x, lineY + 6);
            ctx.stroke();
            ctx.fillText(formatAxisLabel(v), x, lineY + 10);
        }

        // 0 marker if visible
        if (min < 0 && max > 0) {
            const zX = toX(0);
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(zX, lineY - 10);
            ctx.lineTo(zX, lineY + 10);
            ctx.stroke();
        }

        // Points
        points.forEach((p) => {
            const x = toX(p.value);
            const color = p.color || '#ff6900';

            // Glow effect
            const gradient = ctx.createRadialGradient(x, lineY, 0, x, lineY, 16);
            gradient.addColorStop(0, color + '40');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(x - 16, lineY - 16, 32, 32);

            // Circle
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(x, lineY, 8, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 11px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.label || '', x, lineY);

            // Value below
            ctx.fillStyle = color;
            ctx.font = '9px Inter, sans-serif';
            ctx.textBaseline = 'top';
            ctx.fillText(String(p.value), x, lineY + 18);
        });
    }, [min, max, points]);

    useEffect(() => { drawLine(); }, [drawLine]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => drawLine());
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [drawLine]);

    return (
        <div className="iq-container">
            <div className="iq-numberline-area" ref={containerRef}>
                <canvas ref={canvasRef} className="iq-canvas" />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// BAR CHART WIDGET
// ═══════════════════════════════════════════════════════

function BarChartWidget({ config }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const { title, data = [], xLabel, yLabel } = config;

    const drawChart = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';

        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const w = rect.width;
        const h = rect.height;
        const padding = { top: 35, right: 20, bottom: 50, left: 50 };
        const chartW = w - padding.left - padding.right;
        const chartH = h - padding.top - padding.bottom;

        // Background
        ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Title
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(title || 'Datos', w / 2, 8);

        if (data.length === 0) return;

        const maxVal = Math.max(...data.map(d => d.value)) * 1.15;
        const barWidth = Math.min(60, chartW / data.length * 0.7);
        const barGap = (chartW - barWidth * data.length) / (data.length + 1);

        // Y-axis gridlines
        const ySteps = 5;
        for (let i = 0; i <= ySteps; i++) {
            const val = (maxVal / ySteps) * i;
            const y = padding.top + chartH - (val / maxVal) * chartH;

            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(w - padding.right, y);
            ctx.stroke();

            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.font = '9px Inter, sans-serif';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(val).toString(), padding.left - 5, y);
        }

        // Bars with gradient
        data.forEach((d, i) => {
            const x = padding.left + barGap + i * (barWidth + barGap);
            const barH = (d.value / maxVal) * chartH;
            const y = padding.top + chartH - barH;
            const color = d.color || GRAPH_COLORS[i % GRAPH_COLORS.length];

            // Gradient fill
            const grad = ctx.createLinearGradient(x, y, x, padding.top + chartH);
            grad.addColorStop(0, color);
            grad.addColorStop(1, color + '80');
            ctx.fillStyle = grad;

            // Bar with rounded top
            ctx.beginPath();
            const radius = Math.min(4, barWidth / 4);
            ctx.moveTo(x, padding.top + chartH);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.lineTo(x + barWidth - radius, y);
            ctx.quadraticCurveTo(x + barWidth, y, x + barWidth, y + radius);
            ctx.lineTo(x + barWidth, padding.top + chartH);
            ctx.fill();

            // Value on top
            ctx.fillStyle = 'rgba(255,255,255,0.95)';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(d.value.toString(), x + barWidth / 2, y - 4);

            // Label
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = '9px Inter, sans-serif';
            ctx.textBaseline = 'top';
            const labelText = d.label.length > 10 ? d.label.substring(0, 9) + '…' : d.label;
            ctx.fillText(labelText, x + barWidth / 2, padding.top + chartH + 6);
        });

        // Axis labels
        if (xLabel) {
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(xLabel, w / 2, h - 12);
        }
        if (yLabel) {
            ctx.save();
            ctx.translate(12, h / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = 'rgba(255,255,255,0.5)';
            ctx.font = '10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(yLabel, 0, 0);
            ctx.restore();
        }
    }, [title, data, xLabel, yLabel]);

    useEffect(() => { drawChart(); }, [drawChart]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => drawChart());
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [drawChart]);

    return (
        <div className="iq-container">
            <div className="iq-graph-area" ref={containerRef}>
                <canvas ref={canvasRef} className="iq-canvas" />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// COORDINATE POINT WIDGET
// ═══════════════════════════════════════════════════════

function CoordinatePointWidget({ config }) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Auto-compute viewport to contain all points
    const viewport = useMemo(() => {
        const vp = config.viewport || { xMin: -10, xMax: 10, yMin: -10, yMax: 10 };
        const pts = config.points || [];
        if (pts.length === 0) return vp;

        // Check if all points are within the viewport
        const allInside = pts.every(p =>
            p.x >= vp.xMin && p.x <= vp.xMax && p.y >= vp.yMin && p.y <= vp.yMax
        );
        if (allInside) return vp;

        // Auto-expand to fit points
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        const minX = Math.min(...xs, vp.xMin);
        const maxX = Math.max(...xs, vp.xMax);
        const minY = Math.min(...ys, vp.yMin);
        const maxY = Math.max(...ys, vp.yMax);
        const padX = (maxX - minX) * 0.2 || 2;
        const padY = (maxY - minY) * 0.2 || 2;
        return { xMin: minX - padX, xMax: maxX + padX, yMin: minY - padY, yMax: maxY + padY };
    }, [config.viewport, config.points]);

    const { points = [] } = config;

    const drawPlane = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        const rect = container.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
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
        if (xRange === 0 || yRange === 0) return;

        const toPixelX = (x) => ((x - xMin) / xRange) * w;
        const toPixelY = (y) => h - ((y - yMin) / yRange) * h;

        // Background
        ctx.fillStyle = 'rgba(15, 15, 15, 0.85)';
        ctx.fillRect(0, 0, w, h);

        // Grid
        const gridStep = getGridStep(xRange);
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 0.5;
        const xStart = Math.ceil(xMin / gridStep) * gridStep;
        for (let x = xStart; x <= xMax; x += gridStep) {
            ctx.beginPath(); ctx.moveTo(toPixelX(x), 0); ctx.lineTo(toPixelX(x), h); ctx.stroke();
        }
        const yGridStep = getGridStep(yRange);
        const yStart = Math.ceil(yMin / yGridStep) * yGridStep;
        for (let y = yStart; y <= yMax; y += yGridStep) {
            ctx.beginPath(); ctx.moveTo(0, toPixelY(y)); ctx.lineTo(w, toPixelY(y)); ctx.stroke();
        }

        // Axes
        ctx.strokeStyle = 'rgba(255,255,255,0.35)';
        ctx.lineWidth = 1.5;
        if (yMin <= 0 && yMax >= 0) {
            const ay = toPixelY(0);
            ctx.beginPath(); ctx.moveTo(0, ay); ctx.lineTo(w, ay); ctx.stroke();
        }
        if (xMin <= 0 && xMax >= 0) {
            const ax = toPixelX(0);
            ctx.beginPath(); ctx.moveTo(ax, 0); ctx.lineTo(ax, h); ctx.stroke();
        }

        // Labels
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let x = xStart; x <= xMax; x += gridStep) {
            if (Math.abs(x) < gridStep / 100) continue;
            const ly = yMin <= 0 && yMax >= 0 ? Math.min(toPixelY(0) + 4, h - 14) : h - 14;
            ctx.fillText(formatAxisLabel(x), toPixelX(x), ly);
        }
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        for (let y = yStart; y <= yMax; y += yGridStep) {
            if (Math.abs(y) < yGridStep / 100) continue;
            const lx = xMin <= 0 && xMax >= 0 ? Math.max(toPixelX(0) - 4, 35) : 35;
            ctx.fillText(formatAxisLabel(y), lx, toPixelY(y));
        }

        // Points
        points.forEach((p) => {
            const px = toPixelX(p.x);
            const py = toPixelY(p.y);
            const color = p.color || '#ff6900';

            // Dashed guide lines
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = color + '60';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if (yMin <= 0 && yMax >= 0) { ctx.moveTo(px, toPixelY(0)); ctx.lineTo(px, py); }
            if (xMin <= 0 && xMax >= 0) { ctx.moveTo(toPixelX(0), py); ctx.lineTo(px, py); }
            ctx.stroke();
            ctx.setLineDash([]);

            // Glow effect
            const gradient = ctx.createRadialGradient(px, py, 0, px, py, 18);
            gradient.addColorStop(0, color + '30');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.fillRect(px - 18, py - 18, 36, 36);

            // Point
            ctx.beginPath();
            ctx.fillStyle = color;
            ctx.arc(px, py, 7, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = 1.5;
            ctx.stroke();

            // Label inside
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 10px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.label || '', px, py);

            // Coordinate above
            ctx.fillStyle = color;
            ctx.font = '9px Inter, sans-serif';
            ctx.textBaseline = 'bottom';
            ctx.fillText(`(${p.x}, ${p.y})`, px, py - 11);
        });

        // Quadrant labels
        if (xMin < 0 && xMax > 0 && yMin < 0 && yMax > 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.font = 'bold 16px Inter, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const cx0 = toPixelX(0), cy0 = toPixelY(0);
            ctx.fillText('I', (cx0 + w) / 2, cy0 / 2);
            ctx.fillText('II', cx0 / 2, cy0 / 2);
            ctx.fillText('III', cx0 / 2, (cy0 + h) / 2);
            ctx.fillText('IV', (cx0 + w) / 2, (cy0 + h) / 2);
        }
    }, [viewport, points]);

    useEffect(() => { drawPlane(); }, [drawPlane]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(() => drawPlane());
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, [drawPlane]);

    return (
        <div className="iq-container">
            <div className="iq-graph-area" ref={containerRef}>
                <canvas ref={canvasRef} className="iq-canvas" />
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// SLIDER ANSWER WIDGET — El slider ES la respuesta
// MEN: Pensamiento Numérico y Variacional, todos los grados
// ═══════════════════════════════════════════════════════

function SliderAnswerWidget({ config, onAnswer, savedAnswer }) {
    const { min, max, step, defaultValue, unit, hint, correctValue, tolerance, label } = config;
    const [value, setValue] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'slider_answer' && savedAnswer.value !== undefined) return Number(savedAnswer.value);
        return Number(defaultValue ?? (min + max) / 2);
    });
    const [feedback, setFeedback] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'slider_answer') return savedAnswer.isCorrect ? 'correct' : null;
        return null;
    }); // null | 'correct' | 'incorrect'

    const isCorrect = (v) => Math.abs(v - correctValue) <= (tolerance || 0);

    const handleChange = (e) => {
        const v = parseFloat(e.target.value);
        setValue(v);
        setFeedback(null);
        if (onAnswer) onAnswer({ value: v, isCorrect: isCorrect(v), type: 'slider_answer' });
    };

    const handleCheck = () => {
        setFeedback(isCorrect(value) ? 'correct' : 'incorrect');
    };

    const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;

    return (
        <div className="iq-container" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                🎛️ {label || 'Mueve el slider para dar tu respuesta'}
            </div>

            {/* Slider visual */}
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
                <input
                    type="range"
                    min={min}
                    max={max}
                    step={step}
                    value={value}
                    onChange={handleChange}
                    style={{
                        width: '100%',
                        accentColor: feedback === 'correct' ? '#10b981' : feedback === 'incorrect' ? '#ef4444' : '#ff6900',
                        height: '6px',
                        cursor: 'pointer',
                    }}
                />
                <div style={{
                    textAlign: 'center',
                    marginTop: '0.75rem',
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: feedback === 'correct' ? '#10b981' : feedback === 'incorrect' ? '#ef4444' : '#ff6900',
                    fontFamily: 'monospace',
                    transition: 'color 0.2s',
                }}>
                    {Number.isInteger(step) ? value : value.toFixed(2)}{unit ? ` ${unit}` : ''}
                </div>
            </div>

            {/* Escala */}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                <span>{min}{unit}</span>
                <span>{((min + max) / 2).toFixed(step < 1 ? 1 : 0)}{unit}</span>
                <span>{max}{unit}</span>
            </div>

            <button
                onClick={handleCheck}
                style={{
                    width: '100%',
                    padding: '0.6rem',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    background: 'var(--accent-primary)',
                    color: '#fff',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                }}
            >
                Verificar mi respuesta
            </button>

            {/* Feedback */}
            {feedback && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: feedback === 'correct' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${feedback === 'correct' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: '0.85rem',
                    color: feedback === 'correct' ? '#10b981' : '#ef4444',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                }}>
                    {feedback === 'correct' ? '✅ ¡Correcto!' : `❌ Intenta de nuevo. ${hint || ''}`}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// INPUT NUMBER WIDGET — El estudiante escribe la respuesta numérica
// MEN: Pensamiento Numérico y Variacional, todos los grados
// ═══════════════════════════════════════════════════════

function InputNumberWidget({ config, onAnswer, savedAnswer }) {
    const { placeholder, unit, hint, correctValue, tolerance, decimalPlaces, context } = config;
    const [inputVal, setInputVal] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'input_number' && savedAnswer.value !== undefined) return String(savedAnswer.value);
        return '';
    });
    const [feedback, setFeedback] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'input_number') return savedAnswer.isCorrect ? 'correct' : (savedAnswer.pending ? null : 'checked');
        return null;
    }); // null | 'correct' | 'checked'
    const [attempts, setAttempts] = useState(0);

    // Tolerancia más generosa: al menos ±5% del valor correcto, o el valor de tolerance
    const effectiveTolerance = Math.max(
        tolerance || 0,
        Math.abs(correctValue) * 0.05,  // 5% del valor
        0.5                              // mínimo absoluto de 0.5
    );

    const isCorrect = (v) => {
        const num = parseFloat(v);
        if (isNaN(num)) return false;
        return Math.abs(num - correctValue) <= effectiveTolerance;
    };

    const handleCheck = () => {
        if (!inputVal.trim()) return;
        const correct = isCorrect(inputVal);
        setFeedback(correct ? 'correct' : 'checked');
        setAttempts(a => a + 1);
        if (onAnswer) onAnswer({ value: parseFloat(inputVal), isCorrect: correct, type: 'input_number' });
    };

    // Registrar respuesta en CADA cambio del input
    const handleChange = (e) => {
        const v = e.target.value;
        setInputVal(v);
        setFeedback(null);
        if (v.trim() && onAnswer) {
            onAnswer({ value: parseFloat(v) || 0, isCorrect: isCorrect(v), type: 'input_number', pending: true });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleCheck();
    };

    return (
        <div className="iq-container" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                ✏️ Escribe tu respuesta — puedes intentar cuantas veces quieras
            </div>

            {context && (
                <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,105,0,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    <MathText text={context} />
                </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                <input
                    type="number"
                    step={Math.pow(10, -(decimalPlaces || 2))}
                    value={inputVal}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder || 'Escribe tu respuesta'}
                    style={{
                        flex: 1,
                        padding: '0.6rem 0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: `2px solid ${feedback === 'correct' ? '#10b981' : 'var(--border-color)'}`,
                        background: 'var(--bg-input)',
                        color: 'var(--text-primary)',
                        fontSize: '1.1rem',
                        fontFamily: 'monospace',
                        outline: 'none',
                        transition: 'border-color 0.2s',
                    }}
                />
                {unit && <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{unit}</span>}
                <button
                    onClick={handleCheck}
                    disabled={!inputVal.trim()}
                    style={{
                        padding: '0.6rem 1rem',
                        borderRadius: 'var(--radius-md)',
                        border: 'none',
                        background: inputVal.trim() ? 'var(--accent-primary)' : 'var(--bg-input)',
                        color: inputVal.trim() ? '#fff' : 'var(--text-muted)',
                        fontWeight: 600,
                        cursor: inputVal.trim() ? 'pointer' : 'not-allowed',
                        fontSize: '0.85rem',
                        whiteSpace: 'nowrap',
                    }}
                >
                    ✓ Verificar
                </button>
            </div>

            {hint && !feedback && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginBottom: '0.5rem' }}>
                    💡 {hint}
                </div>
            )}

            {feedback === 'correct' && (
                <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(16,185,129,0.12)',
                    border: '1px solid rgba(16,185,129,0.3)',
                    fontSize: '0.85rem',
                    color: '#10b981',
                }}>
                    ✅ ¡Correcto! Muy bien.
                </div>
            )}

            {feedback === 'checked' && (
                <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(59,130,246,0.08)',
                    border: '1px solid rgba(59,130,246,0.2)',
                    fontSize: '0.85rem',
                    color: 'var(--text-secondary)',
                }}>
                    📝 Respuesta guardada. {attempts >= 2 ? hint ? `💡 Pista: ${hint}` : '' : 'Puedes seguir intentando o continuar con la siguiente pregunta.'}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// DRAG SORT WIDGET — Arrastrar para ordenar
// MEN: Pensamiento Numérico — ordenar fracciones, enteros, radicales
// ═══════════════════════════════════════════════════════

function DragSortWidget({ config, onAnswer, savedAnswer }) {
    const { instruction, items, correctOrder, direction } = config;
    const [order, setOrder] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'drag_sort' && Array.isArray(savedAnswer.order)) return savedAnswer.order;
        return items.map((_, i) => i);
    });
    const [dragging, setDragging] = useState(null);
    const [dragOver, setDragOver] = useState(null);
    const [feedback, setFeedback] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'drag_sort') return savedAnswer.isCorrect ? 'correct' : null;
        return null;
    });

    const isOrderCorrect = (ord) => {
        return correctOrder.every((correctIdx, pos) => ord[pos] === correctIdx);
    };

    const handleDragStart = (idx) => setDragging(idx);
    const handleDragOver = (e, idx) => { e.preventDefault(); setDragOver(idx); };

    const handleDrop = (e, targetPos) => {
        e.preventDefault();
        if (dragging === null || dragging === targetPos) { setDragging(null); setDragOver(null); return; }
        const newOrder = [...order];
        const [moved] = newOrder.splice(dragging, 1);
        newOrder.splice(targetPos, 0, moved);
        setOrder(newOrder);
        setDragging(null);
        setDragOver(null);
        setFeedback(null);
        if (onAnswer) onAnswer({ order: newOrder, isCorrect: isOrderCorrect(newOrder), type: 'drag_sort' });
    };

    const handleCheck = () => {
        const correct = isOrderCorrect(order);
        setFeedback(correct ? 'correct' : 'incorrect');
        if (onAnswer) onAnswer({ order, isCorrect: correct, type: 'drag_sort' });
    };

    const handleReset = () => { setOrder(items.map((_, i) => i)); setFeedback(null); };

    return (
        <div className="iq-container" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                ↕️ {instruction || 'Arrastra los elementos para ordenarlos'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '1rem' }}>
                {order.map((itemIdx, pos) => (
                    <div
                        key={`drag-${itemIdx}`}
                        draggable
                        onDragStart={() => handleDragStart(pos)}
                        onDragOver={(e) => handleDragOver(e, pos)}
                        onDrop={(e) => handleDrop(e, pos)}
                        onDragEnd={() => { setDragging(null); setDragOver(null); }}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.75rem',
                            padding: '0.65rem 1rem',
                            borderRadius: 'var(--radius-md)',
                            border: dragOver === pos
                                ? '2px solid var(--accent-primary)'
                                : feedback === 'correct' ? '2px solid #10b981'
                                : '1px solid var(--border-color)',
                            background: dragging === pos
                                ? 'rgba(255,105,0,0.15)'
                                : dragOver === pos ? 'rgba(255,105,0,0.08)' : 'var(--bg-input)',
                            cursor: 'grab',
                            transition: 'all 0.15s ease',
                            opacity: dragging === pos ? 0.5 : 1,
                            userSelect: 'none',
                        }}
                    >
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', minWidth: 20 }}>
                            {pos + 1}.
                        </span>
                        <span style={{ flex: 1, fontSize: '1rem', fontWeight: 500 }}>
                            <MathText text={items[itemIdx]} />
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: '1rem' }}>⠿</span>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                    onClick={handleCheck}
                    style={{ flex: 1, padding: '0.6rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                >
                    ✓ Verificar orden
                </button>
                <button
                    onClick={handleReset}
                    style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                    ↺
                </button>
            </div>

            {feedback && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: feedback === 'correct' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${feedback === 'correct' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: '0.85rem',
                    color: feedback === 'correct' ? '#10b981' : '#ef4444',
                }}>
                    {feedback === 'correct' ? '✅ ¡Orden correcto!' : '❌ El orden no es correcto. Arrastra de nuevo.'}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// FILL EXPRESSION WIDGET — Completar expresiones algebraicas
// MEN: Pensamiento Variacional — factorización, productos notables, identidades
// ═══════════════════════════════════════════════════════

function FillExpressionWidget({ config, onAnswer, savedAnswer }) {
    const { expressionTemplate, blanks, hint, context } = config;
    const [values, setValues] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'fill_expression' && savedAnswer.values) return savedAnswer.values;
        return Object.fromEntries((blanks || []).map((b, i) => [i, '']));
    });
    const [feedback, setFeedback] = useState(() => {
        if (savedAnswer && savedAnswer.type === 'fill_expression') return savedAnswer.isCorrect ? 'correct' : null;
        return null;
    });

    const isAllCorrect = (vals) => {
        return (blanks || []).every((blank, i) => {
            const userVal = String(vals[i] || '').trim();
            const correct = String(blank.correctValue).trim();
            const tol = blank.tolerance || 0;
            if (tol > 0) {
                const numUser = parseFloat(userVal);
                const numCorrect = parseFloat(correct);
                return !isNaN(numUser) && Math.abs(numUser - numCorrect) <= tol;
            }
            return userVal.toLowerCase() === correct.toLowerCase();
        });
    };

    const handleChange = (idx, val) => {
        const newVals = { ...values, [idx]: val };
        setValues(newVals);
        setFeedback(null);
        if (onAnswer) onAnswer({ values: newVals, isCorrect: isAllCorrect(newVals), type: 'fill_expression' });
    };

    const handleCheck = () => {
        const correct = isAllCorrect(values);
        setFeedback(correct ? 'correct' : 'incorrect');
        if (onAnswer) onAnswer({ values, isCorrect: correct, type: 'fill_expression' });
    };

    // Renderizar la expresión con inputs en los ___
    const renderExpression = () => {
        const parts = expressionTemplate.split('___');
        return parts.map((part, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap' }}>
                <MathText text={part} />
                {i < blanks.length && (
                    <input
                        type="text"
                        value={values[i] || ''}
                        onChange={(e) => handleChange(i, e.target.value)}
                        placeholder={blanks[i]?.placeholder || '?'}
                        style={{
                            display: 'inline-block',
                            width: `${Math.max(2, (values[i]?.length || blanks[i]?.placeholder?.length || 1) + 1)}ch`,
                            minWidth: '2.5rem',
                            padding: '0.15rem 0.3rem',
                            margin: '0 0.2rem',
                            borderRadius: '6px',
                            border: `2px solid ${feedback === 'correct' ? '#10b981' : feedback === 'incorrect' ? '#ef4444' : 'var(--accent-primary)'}`,
                            background: 'var(--bg-input)',
                            color: 'var(--text-primary)',
                            fontSize: '1rem',
                            fontFamily: 'monospace',
                            fontWeight: 700,
                            textAlign: 'center',
                            outline: 'none',
                            transition: 'border-color 0.2s',
                        }}
                    />
                )}
            </span>
        ));
    };

    return (
        <div className="iq-container" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                📝 Completa los espacios en blanco de la expresión
            </div>

            {context && (
                <div style={{ marginBottom: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,105,0,0.08)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <MathText text={context} />
                </div>
            )}

            <div style={{
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
                background: 'var(--bg-input)',
                fontSize: '1.1rem',
                lineHeight: 2.2,
                marginBottom: '1rem',
                flexWrap: 'wrap',
                display: 'flex',
                alignItems: 'center',
            }}>
                {renderExpression()}
            </div>

            <button
                onClick={handleCheck}
                style={{ width: '100%', padding: '0.6rem', borderRadius: 'var(--radius-md)', border: 'none', background: 'var(--accent-primary)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
            >
                ✓ Verificar expresión
            </button>

            {feedback && (
                <div style={{
                    marginTop: '0.75rem',
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-sm)',
                    background: feedback === 'correct' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)',
                    border: `1px solid ${feedback === 'correct' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    fontSize: '0.85rem',
                    color: feedback === 'correct' ? '#10b981' : '#ef4444',
                }}>
                    {feedback === 'correct' ? '✅ ¡Expresión correcta!' : `❌ Revisa tus respuestas. ${hint || ''}`}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════
// Shared helpers
// ═══════════════════════════════════════════════════════

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
    if (range <= 0) return 1;
    const raw = range / 10;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    if (norm <= 1.5) return mag;
    if (norm <= 3.5) return 2 * mag;
    if (norm <= 7.5) return 5 * mag;
    return 10 * mag;
}

function formatAxisLabel(v) {
    if (Math.abs(v) >= 10000) return v.toExponential(1);
    if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
    if (Math.abs(v) < 0.01 && v !== 0) return v.toExponential(1);
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(1);
}

function formatNum(v) {
    if (Math.abs(v) < 0.005) return '0';
    if (Number.isInteger(v)) return v.toString();
    return v.toFixed(2);
}
