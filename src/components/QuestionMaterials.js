'use client';
import { useEffect, useRef, useState } from 'react';
import MathText from './MathText';

/**
 * QuestionMaterials — Renderiza materiales embebidos en preguntas de Pruebas de Estado.
 * 
 * Soporta:
 * - Tablas HTML estilizadas (desde metadata.tables)
 * - Gráficos Chart.js dinámicos (desde metadata.chartjsMaterials) con soporte para canvasShapesPlugin
 * 
 * @param {{ materials: { tables?: Array, charts?: Array } }} props
 */
export default function QuestionMaterials({ materials }) {
    if (!materials) return null;
    const { tables = [], charts = [] } = materials;
    if (tables.length === 0 && charts.length === 0) return null;

    return (
        <div className="question-materials" style={{ margin: '1rem 0', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {tables.map((table, i) => (
                <MaterialTable key={`table-${i}`} table={table} />
            ))}
            {charts.map((chart, i) => (
                <MaterialChart key={`chart-${chart.id || i}`} chart={chart} />
            ))}
        </div>
    );
}

// ══════════════════════════════════════════════════
// TABLAS
// ══════════════════════════════════════════════════

function MaterialTable({ table }) {
    const { titulo, columnas, filas } = table;

    // Detectar si la primera columna tiene prefijo "%" (indica que es header de fila)
    const hasRowHeaders = columnas.length > 0 && columnas[0]?.startsWith('%');
    const displayCols = columnas.map(c => c.replace(/^%\s*/, ''));

    return (
        <div style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            overflow: 'hidden',
            background: 'var(--bg-card)',
        }}>
            {titulo && (
                <div style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 105, 0, 0.06)',
                    borderBottom: '1px solid var(--border)',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                }}>
                    <MathText text={titulo} />
                </div>
            )}
            <div style={{ overflowX: 'auto' }}>
                <table style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem',
                }}>
                    <thead>
                        <tr>
                            {displayCols.map((col, i) => (
                                <th key={i} style={{
                                    padding: '0.6rem 0.85rem',
                                    textAlign: 'center',
                                    fontWeight: 700,
                                    fontSize: '0.82rem',
                                    color: 'var(--text-primary)',
                                    borderBottom: '2px solid var(--border)',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    whiteSpace: 'nowrap',
                                }}>
                                    <MathText text={col} />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filas.map((fila, rowIdx) => (
                            <tr key={rowIdx}>
                                {fila.map((celda, colIdx) => {
                                    const isRowHeader = hasRowHeaders && colIdx === 0;
                                    return (
                                        <td key={colIdx} style={{
                                            padding: '0.5rem 0.85rem',
                                            textAlign: 'center',
                                            borderBottom: '1px solid var(--border)',
                                            color: 'var(--text-primary)',
                                            fontWeight: isRowHeader ? 600 : 400,
                                            background: isRowHeader ? 'rgba(255, 255, 255, 0.02)' : 'transparent',
                                        }}>
                                            <MathText text={celda} />
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ══════════════════════════════════════════════════
// GRÁFICOS CHART.JS
// ══════════════════════════════════════════════════

function MaterialChart({ chart }) {
    const canvasRef = useRef(null);
    const chartInstanceRef = useRef(null);
    const [chartLoaded, setChartLoaded] = useState(false);

    useEffect(() => {
        let cancelled = false;

        async function loadAndRender() {
            // Importar Chart.js dinámicamente
            const ChartModule = await import('chart.js/auto');
            const Chart = ChartModule.default || ChartModule.Chart || ChartModule;

            if (cancelled || !canvasRef.current) return;

            // Destruir gráfico anterior si existe
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }

            // Clonar config para no mutar el original
            const config = JSON.parse(JSON.stringify(chart.config));

            // Registrar canvasShapesPlugin si es necesario
            const needsShapesPlugin = (chart.requires || []).includes('canvasShapesPlugin');
            const shapesPluginData = config.options?.plugins?.canvasShapesPlugin;

            if (needsShapesPlugin && shapesPluginData) {
                // Plugin inline para este gráfico
                const canvasShapesPlugin = {
                    id: 'canvasShapesPlugin',
                    afterDraw(chartInstance, args, pluginOptions) {
                        if (!pluginOptions || !Array.isArray(pluginOptions.shapes)) return;
                        const { ctx, scales } = chartInstance;
                        const xScale = scales.x;
                        const yScale = scales.y;
                        if (!xScale || !yScale) return;

                        const x = (value) => xScale.getPixelForValue(value);
                        const y = (value) => yScale.getPixelForValue(value);

                        function applyStyle(shape) {
                            ctx.lineWidth = shape.lineWidth ?? 1.5;
                            ctx.strokeStyle = shape.stroke ?? '#000000';
                            ctx.fillStyle = shape.fill ?? 'rgba(0,0,0,0)';
                            ctx.font = shape.font ?? '13px Arial';
                            ctx.textAlign = shape.textAlign ?? 'center';
                            ctx.textBaseline = shape.textBaseline ?? 'middle';
                        }

                        ctx.save();
                        for (const shape of pluginOptions.shapes) {
                            applyStyle(shape);

                            if (shape.type === 'text') {
                                ctx.fillStyle = shape.fill ?? '#e5e5e5';
                                ctx.fillText(shape.text, x(shape.x), y(shape.y));
                            }
                            if (shape.type === 'rectangle') {
                                const left = x(shape.x);
                                const top = y(shape.y + shape.height);
                                const width = x(shape.x + shape.width) - x(shape.x);
                                const height = y(shape.y) - y(shape.y + shape.height);
                                ctx.beginPath();
                                ctx.rect(left, top, width, height);
                                if (shape.fill && shape.fill !== 'transparent') ctx.fill();
                                ctx.stroke();
                            }
                            if (shape.type === 'line') {
                                ctx.beginPath();
                                ctx.moveTo(x(shape.x1), y(shape.y1));
                                ctx.lineTo(x(shape.x2), y(shape.y2));
                                ctx.stroke();
                            }
                            if (shape.type === 'polygon') {
                                ctx.beginPath();
                                (shape.points || []).forEach((p, i) => {
                                    const px = x(p[0]);
                                    const py = y(p[1]);
                                    if (i === 0) ctx.moveTo(px, py);
                                    else ctx.lineTo(px, py);
                                });
                                ctx.closePath();
                                if (shape.fill && shape.fill !== 'transparent') ctx.fill();
                                ctx.stroke();
                            }
                            if (shape.type === 'circle') {
                                const dx = Math.abs(x(shape.r) - x(0));
                                ctx.beginPath();
                                ctx.arc(x(shape.x), y(shape.y), dx, 0, Math.PI * 2);
                                if (shape.fill && shape.fill !== 'transparent') ctx.fill();
                                ctx.stroke();
                            }
                            if (shape.type === 'arc') {
                                const radius = Math.abs(x(shape.x + shape.r) - x(shape.x));
                                ctx.beginPath();
                                ctx.arc(
                                    x(shape.x),
                                    y(shape.y),
                                    radius,
                                    shape.startAngle ?? 0,
                                    shape.endAngle ?? Math.PI * 2,
                                    shape.anticlockwise === true
                                );
                                if (shape.closePath) ctx.closePath();
                                if (shape.fill && shape.fill !== 'transparent') ctx.fill();
                                ctx.stroke();
                            }
                            if (shape.type === 'ellipseArc') {
                                const radiusX = Math.abs(x(shape.x + shape.radiusX) - x(shape.x));
                                const radiusY = Math.abs(y(shape.y + shape.radiusY) - y(shape.y));
                                ctx.beginPath();
                                ctx.ellipse(
                                    x(shape.x),
                                    y(shape.y),
                                    radiusX,
                                    radiusY,
                                    shape.rotation ?? 0,
                                    shape.startAngle ?? 0,
                                    shape.endAngle ?? Math.PI * 2,
                                    shape.anticlockwise === true
                                );
                                if (shape.closePath) {
                                    if (Number.isFinite(shape.closeToX) && Number.isFinite(shape.closeToY)) {
                                        ctx.lineTo(x(shape.closeToX), y(shape.closeToY));
                                    }
                                    ctx.closePath();
                                }
                                if (shape.fill && shape.fill !== 'transparent') ctx.fill();
                                ctx.stroke();
                            }
                            if (shape.type === 'dimensionLine') {
                                const x1 = x(shape.x1);
                                const y1 = y(shape.y1);
                                const x2 = x(shape.x2);
                                const y2 = y(shape.y2);
                                ctx.beginPath();
                                ctx.moveTo(x1, y1);
                                ctx.lineTo(x2, y2);
                                ctx.stroke();

                                const angle = Math.atan2(y2 - y1, x2 - x1);
                                drawDimensionTick(ctx, x1, y1, angle);
                                drawDimensionTick(ctx, x2, y2, angle);

                                if (shape.label) {
                                    ctx.save();
                                    ctx.fillStyle = shape.labelFill ?? shape.stroke ?? '#e5e5e5';
                                    ctx.font = shape.font ?? '12px Arial';
                                    ctx.textAlign = 'center';
                                    ctx.textBaseline = 'middle';
                                    ctx.fillText(
                                        shape.label,
                                        (x1 + x2) / 2 + (shape.labelOffsetX || 0),
                                        (y1 + y2) / 2 + (shape.labelOffsetY || 0)
                                    );
                                    ctx.restore();
                                }
                            }
                            if (shape.type === 'tick') {
                                ctx.beginPath();
                                if (Number.isFinite(shape.y1) && Number.isFinite(shape.y2)) {
                                    ctx.moveTo(x(shape.x), y(shape.y1));
                                    ctx.lineTo(x(shape.x), y(shape.y2));
                                } else if (Number.isFinite(shape.x1) && Number.isFinite(shape.x2)) {
                                    ctx.moveTo(x(shape.x1), y(shape.y));
                                    ctx.lineTo(x(shape.x2), y(shape.y));
                                }
                                ctx.stroke();
                            }
                        }
                        ctx.restore();
                    }
                };

                config.plugins = [canvasShapesPlugin];
            }

            // Estilos para modo oscuro
            if (config.options?.scales) {
                const textColor = 'rgba(229, 231, 235, 0.85)';
                const gridColor = 'rgba(156, 163, 175, 0.18)';
                for (const [key, scale] of Object.entries(config.options.scales)) {
                    if (scale.ticks) {
                        scale.ticks.color = textColor;
                    } else {
                        scale.ticks = { color: textColor };
                    }
                    if (scale.grid) {
                        scale.grid.color = gridColor;
                    } else {
                        scale.grid = { color: gridColor };
                    }
                    if (scale.title) {
                        scale.title.color = textColor;
                    }
                }
            }

            // Color de datasets si no tienen colores definidos
            const brandColors = [
                'rgba(255, 105, 0, 0.75)',
                'rgba(59, 130, 246, 0.75)',
                'rgba(16, 185, 129, 0.75)',
                'rgba(245, 158, 11, 0.75)',
                'rgba(168, 85, 247, 0.75)',
            ];
            const brandBorders = [
                'rgb(255, 105, 0)',
                'rgb(59, 130, 246)',
                'rgb(16, 185, 129)',
                'rgb(245, 158, 11)',
                'rgb(168, 85, 247)',
            ];
            if (config.data?.datasets) {
                config.data.datasets.forEach((ds, i) => {
                    if (!ds.backgroundColor) {
                        ds.backgroundColor = brandColors[i % brandColors.length];
                    }
                    if (!ds.borderColor) {
                        ds.borderColor = brandBorders[i % brandBorders.length];
                    }
                });
            }

            // Plugin legend text color
            if (!config.options) config.options = {};
            if (!config.options.plugins) config.options.plugins = {};
            if (config.options.plugins.legend !== false && config.options.plugins.legend?.display !== false) {
                config.options.plugins.legend = {
                    ...config.options.plugins.legend,
                    labels: { color: 'rgba(229, 231, 235, 0.85)', ...(config.options.plugins.legend?.labels || {}) },
                };
            }

            try {
                chartInstanceRef.current = new Chart(canvasRef.current, config);
                setChartLoaded(true);
            } catch (err) {
                console.error('[QuestionMaterials] Error renderizando Chart.js:', err);
            }
        }

        loadAndRender();

        return () => {
            cancelled = true;
            if (chartInstanceRef.current) {
                chartInstanceRef.current.destroy();
                chartInstanceRef.current = null;
            }
        };
    }, [chart]);

    return (
        <div style={{
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
            padding: '1rem',
            position: 'relative',
        }}>
            {chart.descripcion && (
                <div style={{
                    fontSize: '0.78rem',
                    color: 'var(--text-muted)',
                    marginBottom: '0.5rem',
                    textAlign: 'center',
                    fontStyle: 'italic',
                }}>
                    {chart.descripcion}
                </div>
            )}
            <div style={{ position: 'relative', maxWidth: '500px', margin: '0 auto' }}>
                <canvas ref={canvasRef} />
            </div>
            {!chartLoaded && (
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '120px',
                    color: 'var(--text-muted)',
                    fontSize: '0.85rem',
                }}>
                    Cargando gráfico...
                </div>
            )}
        </div>
    );
}

function drawDimensionTick(ctx, px, py, angle) {
    const tickLength = 8;
    const perpendicular = angle + Math.PI / 2;
    const dx = Math.cos(perpendicular) * tickLength / 2;
    const dy = Math.sin(perpendicular) * tickLength / 2;
    ctx.beginPath();
    ctx.moveTo(px - dx, py - dy);
    ctx.lineTo(px + dx, py + dy);
    ctx.stroke();
}
