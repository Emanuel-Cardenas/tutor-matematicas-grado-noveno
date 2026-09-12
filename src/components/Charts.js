'use client';
import { useTheme } from 'next-themes';
import { useRef, useEffect, useState, useCallback } from 'react';

/**
 * MCKINSEY-STYLE CHART ENGINE — YedaTech
 * ========================================
 * Canvas2D native charts with premium animations.
 * Exports: BarChart, HorizontalBarChart, LineChart, RadarChart, DonutChart
 */

// ─── Shared palette ─────────────────────────────────────────
const MCKINSEY_COLORS = [
    '#2563eb', // Blue
    '#10b981', // Emerald
    '#f59e0b', // Amber
    '#ef4444', // Red
    '#8b5cf6', // Violet
    '#06b6d4', // Cyan
    '#ec4899', // Pink
    '#f97316', // Orange
];

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// ─── Easing ─────────────────────────────────────────────────
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// ─── useCanvas hook ─────────────────────────────────────────
function useCanvas(drawFn, deps = []) {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const animRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const [dims, setDims] = useState({ w: 0, h: 0 });
    const { resolvedTheme } = useTheme();
    const isLight = resolvedTheme === "light";
    const tc = {
        base: isLight ? "0,0,0": "255,255,255",
        inv: isLight ? "#ffffff" : "#1e1e2e"
    };

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const ro = new ResizeObserver(entries => {
            const { width, height } = entries[0].contentRect;
            setDims({ w: Math.floor(width), h: Math.floor(height) });
        });
        ro.observe(container);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || dims.w === 0) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = dims.w * dpr;
        canvas.height = dims.h * dpr;
        canvas.style.width = dims.w + 'px';
        canvas.style.height = dims.h + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        // Animate
        let start = null;
        const duration = 900;
        const tick = (ts) => {
            if (!start) start = ts;
            const elapsed = ts - start;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeOutCubic(progress);
            ctx.clearRect(0, 0, dims.w, dims.h);
            drawFn(ctx, dims.w, dims.h, easedProgress, tc);
            if (progress < 1) animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [dims, resolvedTheme, ...deps]);

    const handleMouseMove = useCallback((e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        setTooltip(prev => ({ ...prev, mouseX: x, mouseY: y }));
    }, []);

    const handleMouseLeave = useCallback(() => setTooltip(null), []);

    return { canvasRef, containerRef, tooltip, setTooltip, dims, handleMouseMove, handleMouseLeave };
}

// ─── Tooltip component ─────────────────────────────────────
function ChartTooltip({ tooltip }) {
    if (!tooltip?.text) return null;
    const left = Math.min(tooltip.mouseX + 12, (tooltip.maxX || 400) - 130);
    const top = tooltip.mouseY - 36;
    return (
        <div style={{
            position: 'absolute', left, top,
            padding: '6px 10px', borderRadius: '6px',
            background: 'rgba(0,0,0,0.85)', color: '#fff',
            fontSize: '0.72rem', fontWeight: 600,
            pointerEvents: 'none', zIndex: 10,
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            transition: 'left 0.08s, top 0.08s',
            backdropFilter: 'blur(8px)',
        }}>
            {tooltip.text}
        </div>
    );
}

// ─── Chart wrapper ──────────────────────────────────────────
function ChartWrapper({ title, subtitle, children, height = 220 }) {
    return (
        <div className="mck-chart-wrapper">
            {title && (
                <div className="mck-chart-header">
                    <div className="mck-chart-title">{title}</div>
                    {subtitle && <div className="mck-chart-subtitle">{subtitle}</div>}
                </div>
            )}
            <div style={{ position: 'relative', width: '100%', height }}>{children}</div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// BAR CHART
// ═══════════════════════════════════════════════════════════
export function BarChart({ data = [], title, subtitle, height = 220, showValues = true }) {
    const hitAreas = useRef([]);

    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!data.length) return;
        const pad = { top: 20, right: 15, bottom: 40, left: 40 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const maxVal = Math.max(...data.map(d => d.value), 1);
        const barW = Math.min(chartW / data.length * 0.6, 48);
        const gap = (chartW - barW * data.length) / (data.length + 1);
        const areas = [];

        // Grid lines
        ctx.strokeStyle = `rgba(${tc.base},0.06)`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillStyle = `rgba(${tc.base},0.3)`;
            ctx.font = `500 ${Math.max(9, Math.min(11, w * 0.025))}px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxVal * (1 - i / 4)), pad.left - 6, y + 3);
        }

        // Bars
        data.forEach((d, i) => {
            const x = pad.left + gap + i * (barW + gap);
            const barH = (d.value / maxVal) * chartH * progress;
            const y = pad.top + chartH - barH;
            const color = d.color || MCKINSEY_COLORS[i % MCKINSEY_COLORS.length];

            // Bar with gradient
            const grad = ctx.createLinearGradient(x, y, x, pad.top + chartH);
            grad.addColorStop(0, color);
            grad.addColorStop(1, color + '44');
            ctx.fillStyle = grad;
            ctx.beginPath();
            const r = Math.min(4, barW / 4);
            ctx.moveTo(x + r, y);
            ctx.lineTo(x + barW - r, y);
            ctx.quadraticCurveTo(x + barW, y, x + barW, y + r);
            ctx.lineTo(x + barW, pad.top + chartH);
            ctx.lineTo(x, pad.top + chartH);
            ctx.lineTo(x, y + r);
            ctx.quadraticCurveTo(x, y, x + r, y);
            ctx.fill();

            // Value label
            if (showValues && progress > 0.8) {
                ctx.fillStyle = `rgba(${tc.base},0.8)`;
                ctx.font = `700 ${Math.max(9, Math.min(11, w * 0.025))}px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.fillText(typeof d.value === 'number' ? (d.value % 1 === 0 ? d.value : d.value.toFixed(1)) : d.value, x + barW / 2, y - 6);
            }

            // X label
            ctx.fillStyle = `rgba(${tc.base},0.5)`;
            ctx.font = `500 ${Math.max(8, Math.min(10, w * 0.022))}px ${FONT}`;
            ctx.textAlign = 'center';
            const label = d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label;
            ctx.fillText(label, x + barW / 2, h - pad.bottom + 16);

            areas.push({ x, y, w: barW, h: barH, label: d.label, value: d.value });
        });
        hitAreas.current = areas;
    }, [data, showValues]);

    const { canvasRef, containerRef, tooltip, setTooltip, dims, handleMouseLeave } = useCanvas(draw, [data]);

    const handleMove = useCallback((e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = hitAreas.current.find(a => mx >= a.x && mx <= a.x + a.w && my >= a.y && my <= a.y + a.h);
        setTooltip(hit ? { text: `${hit.label}: ${hit.value}`, mouseX: mx, mouseY: my, maxX: dims.w } : null);
    }, [dims, setTooltip]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                <canvas ref={canvasRef} onMouseMove={handleMove} onMouseLeave={handleMouseLeave} style={{ cursor: tooltip?.text ? 'pointer' : 'default' }} />
                <ChartTooltip tooltip={tooltip} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// HORIZONTAL BAR CHART
// ═══════════════════════════════════════════════════════════
export function HorizontalBarChart({ data = [], title, subtitle, height, maxValue: propMax, showPercentage = true, unit = '%' }) {
    const computedHeight = height || Math.max(140, data.length * 36 + 30);

    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!data.length) return;
        const pad = { top: 8, right: 50, bottom: 8, left: Math.min(w * 0.3, 120) };
        const chartW = w - pad.left - pad.right;
        const barH = Math.min(20, (h - pad.top - pad.bottom) / data.length * 0.65);
        const gap = ((h - pad.top - pad.bottom) - barH * data.length) / (data.length + 1);
        const maxVal = propMax || Math.max(...data.map(d => d.value), 1);

        data.forEach((d, i) => {
            const y = pad.top + gap + i * (barH + gap);
            const barW = (d.value / maxVal) * chartW * progress;
            const color = d.color || (d.value / maxVal >= 0.65 ? '#10b981' : d.value / maxVal >= 0.35 ? '#f59e0b' : '#ef4444');

            // Track
            ctx.fillStyle = `rgba(${tc.base},0.04)`;
            ctx.beginPath();
            const r = barH / 2;
            ctx.roundRect(pad.left, y, chartW, barH, r);
            ctx.fill();

            // Bar
            if (barW > 2) {
                const grad = ctx.createLinearGradient(pad.left, 0, pad.left + barW, 0);
                grad.addColorStop(0, color + 'cc');
                grad.addColorStop(1, color);
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.roundRect(pad.left, y, barW, barH, r);
                ctx.fill();
            }

            // Label (left)
            ctx.fillStyle = `rgba(${tc.base},0.7)`;
            ctx.font = `500 ${Math.max(9, Math.min(11, w * 0.025))}px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const label = d.label.length > 16 ? d.label.slice(0, 15) + '…' : d.label;
            ctx.fillText(label, pad.left - 8, y + barH / 2);

            // Value (right)
            if (showPercentage && progress > 0.7) {
                ctx.fillStyle = color;
                ctx.font = `700 ${Math.max(10, Math.min(12, w * 0.028))}px ${FONT}`;
                ctx.textAlign = 'left';
                ctx.fillText(`${Math.round(d.value)}${unit}`, pad.left + barW + 8, y + barH / 2);
            }
        });
    }, [data, propMax, showPercentage, unit]);

    const { canvasRef, containerRef } = useCanvas(draw, [data]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={computedHeight}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <canvas ref={canvasRef} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// LINE CHART
// ═══════════════════════════════════════════════════════════
export function LineChart({ data = [], title, subtitle, height = 220, series, yLabel }) {
    const hitAreas = useRef([]);

    const draw = useCallback((ctx, w, h, progress, tc) => {
        // data: [{label, value}] or series: [{name, color, data: [{label, value}]}]
        const sets = series || [{ name: 'default', color: MCKINSEY_COLORS[0], data }];
        const allVals = sets.flatMap(s => (s.data || []).map(d => d.value));
        if (!allVals.length) return;

        const pad = { top: 25, right: 20, bottom: 35, left: 45 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const maxVal = Math.max(...allVals, 1) * 1.1;
        const minVal = Math.min(0, ...allVals);
        const range = maxVal - minVal || 1;
        const labels = (sets[0].data || data).map(d => d.label);
        const areas = [];

        // Grid
        ctx.strokeStyle = `rgba(${tc.base},0.06)`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillStyle = `rgba(${tc.base},0.3)`;
            ctx.font = `500 10px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxVal - (range * i / 4)), pad.left - 6, y + 3);
        }

        // X labels
        labels.forEach((lbl, i) => {
            const x = pad.left + (i / Math.max(labels.length - 1, 1)) * chartW;
            ctx.fillStyle = `rgba(${tc.base},0.4)`;
            ctx.font = `500 ${Math.max(8, Math.min(10, w * 0.022))}px ${FONT}`;
            ctx.textAlign = 'center';
            const short = lbl.length > 8 ? lbl.slice(0, 7) + '…' : lbl;
            ctx.fillText(short, x, h - pad.bottom + 16);
        });

        // Draw each series
        sets.forEach((s) => {
            const pts = (s.data || []).map((d, i) => ({
                x: pad.left + (i / Math.max((s.data || []).length - 1, 1)) * chartW,
                y: pad.top + chartH - ((d.value - minVal) / range) * chartH,
                label: d.label,
                value: d.value,
            }));

            if (!pts.length) return;
            const color = s.color || MCKINSEY_COLORS[0];

            // Area fill
            ctx.globalAlpha = 0.1 * progress;
            ctx.beginPath();
            ctx.moveTo(pts[0].x, pad.top + chartH);
            pts.forEach(p => ctx.lineTo(p.x, p.y + (1 - progress) * chartH));
            ctx.lineTo(pts[pts.length - 1].x, pad.top + chartH);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;

            // Line
            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            pts.forEach((p, i) => {
                const y = p.y + (1 - progress) * chartH;
                i === 0 ? ctx.moveTo(p.x, y) : ctx.lineTo(p.x, y);
            });
            ctx.stroke();

            // Points
            pts.forEach((p) => {
                const y = p.y + (1 - progress) * chartH;
                ctx.beginPath();
                ctx.arc(p.x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = tc.inv;
                ctx.fill();
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.stroke();
                areas.push({ x: p.x, y, r: 8, label: p.label, value: p.value, series: s.name });
            });
        });
        hitAreas.current = areas;
    }, [data, series]);

    const { canvasRef, containerRef, tooltip, setTooltip, dims, handleMouseLeave } = useCanvas(draw, [data, series]);

    const handleMove = useCallback((e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = hitAreas.current.find(a => Math.hypot(mx - a.x, my - a.y) < a.r);
        setTooltip(hit ? { text: `${hit.label}: ${hit.value}${hit.series !== 'default' ? ` (${hit.series})` : ''}`, mouseX: mx, mouseY: my, maxX: dims.w } : null);
    }, [dims, setTooltip]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                <canvas ref={canvasRef} onMouseMove={handleMove} onMouseLeave={handleMouseLeave} style={{ cursor: tooltip?.text ? 'pointer' : 'default' }} />
                <ChartTooltip tooltip={tooltip} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// RADAR CHART
// ═══════════════════════════════════════════════════════════
export function RadarChart({ data = [], title, subtitle, height = 260, maxValue = 100 }) {
    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!data.length) return;
        const cx = w / 2;
        const cy = h / 2;
        const radius = Math.min(cx, cy) - 40;
        const n = data.length;
        const angleStep = (Math.PI * 2) / n;
        const startAngle = -Math.PI / 2;

        // Concentric rings
        for (let ring = 1; ring <= 4; ring++) {
            const r = (radius / 4) * ring;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) {
                const angle = startAngle + i * angleStep;
                const x = cx + Math.cos(angle) * r;
                const y = cy + Math.sin(angle) * r;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.strokeStyle = `rgba(${tc.base},0.06)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Ring percentage labels
            if (ring === 4) {
                ctx.fillStyle = `rgba(${tc.base},0.2)`;
                ctx.font = `500 9px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.fillText(`${maxValue}`, cx, cy - r - 4);
            }
        }

        // Axis lines + labels
        data.forEach((d, i) => {
            const angle = startAngle + i * angleStep;
            const x = cx + Math.cos(angle) * radius;
            const y = cy + Math.sin(angle) * radius;

            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.lineTo(x, y);
            ctx.strokeStyle = `rgba(${tc.base},0.08)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Label
            const labelR = radius + 18;
            const lx = cx + Math.cos(angle) * labelR;
            const ly = cy + Math.sin(angle) * labelR;
            ctx.fillStyle = `rgba(${tc.base},0.6)`;
            ctx.font = `600 ${Math.max(9, Math.min(11, w * 0.025))}px ${FONT}`;
            ctx.textAlign = Math.abs(Math.cos(angle)) < 0.1 ? 'center' : Math.cos(angle) > 0 ? 'left' : 'right';
            ctx.textBaseline = Math.abs(Math.sin(angle)) < 0.1 ? 'middle' : Math.sin(angle) > 0 ? 'top' : 'bottom';
            const label = d.label.length > 14 ? d.label.slice(0, 13) + '…' : d.label;
            ctx.fillText(label, lx, ly);
        });

        // Data shape
        const points = data.map((d, i) => {
            const val = Math.min(d.value, maxValue);
            const r = (val / maxValue) * radius * progress;
            const angle = startAngle + i * angleStep;
            return { x: cx + Math.cos(angle) * r, y: cy + Math.sin(angle) * r };
        });

        // Fill
        ctx.beginPath();
        points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        const color = data[0]?.color || MCKINSEY_COLORS[0];
        ctx.fillStyle = color + '22';
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Points
        points.forEach((p, i) => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fillStyle = tc.inv;
            ctx.fill();
            ctx.strokeStyle = data[i]?.color || color;
            ctx.lineWidth = 2.5;
            ctx.stroke();

            // Value label
            if (progress > 0.85) {
                ctx.fillStyle = data[i]?.color || color;
                ctx.font = `700 10px ${FONT}`;
                ctx.textAlign = 'center';
                const val = typeof data[i].value === 'number' ? Math.round(data[i].value) : data[i].value;
                ctx.fillText(val, p.x, p.y - 10);
            }
        });
    }, [data, maxValue]);

    const { canvasRef, containerRef } = useCanvas(draw, [data]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <canvas ref={canvasRef} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// DONUT CHART
// ═══════════════════════════════════════════════════════════
export function DonutChart({ data = [], title, subtitle, height = 220, centerLabel, centerValue, thickness = 0.35 }) {
    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!data.length) return;
        const total = data.reduce((s, d) => s + d.value, 0);
        if (total === 0) return;
        const cx = w / 2;
        const cy = h / 2;
        const outerR = Math.min(cx, cy) - 25;
        const innerR = outerR * (1 - thickness);
        let startAngle = -Math.PI / 2;

        data.forEach((d, i) => {
            const sliceAngle = (d.value / total) * Math.PI * 2 * progress;
            const endAngle = startAngle + sliceAngle;
            const color = d.color || MCKINSEY_COLORS[i % MCKINSEY_COLORS.length];

            ctx.beginPath();
            ctx.arc(cx, cy, outerR, startAngle, endAngle);
            ctx.arc(cx, cy, innerR, endAngle, startAngle, true);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();

            // Slight gap between segments
            ctx.strokeStyle = tc.inv;
            ctx.lineWidth = 2;
            ctx.stroke();

            // Label line + text
            if (progress > 0.85 && sliceAngle > 0.15) {
                const midAngle = startAngle + sliceAngle / 2;
                const labelR = outerR + 14;
                const lx = cx + Math.cos(midAngle) * labelR;
                const ly = cy + Math.sin(midAngle) * labelR;

                ctx.fillStyle = `rgba(${tc.base},0.6)`;
                ctx.font = `500 ${Math.max(9, Math.min(11, w * 0.025))}px ${FONT}`;
                ctx.textAlign = Math.cos(midAngle) > 0 ? 'left' : 'right';
                ctx.textBaseline = 'middle';
                const pct = Math.round((d.value / total) * 100);
                ctx.fillText(`${d.label} ${pct}%`, lx, ly);
            }

            startAngle = endAngle;
        });

        // Center text
        if (centerValue !== undefined) {
            ctx.fillStyle = `rgba(${tc.base},0.9)`;
            ctx.font = `800 ${Math.max(18, Math.min(28, w * 0.07))}px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(centerValue, cx, cy - (centerLabel ? 8 : 0));

            if (centerLabel) {
                ctx.fillStyle = `rgba(${tc.base},0.4)`;
                ctx.font = `500 ${Math.max(9, Math.min(11, w * 0.025))}px ${FONT}`;
                ctx.fillText(centerLabel, cx, cy + 14);
            }
        }
    }, [data, centerLabel, centerValue, thickness]);

    const { canvasRef, containerRef } = useCanvas(draw, [data, centerValue]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <canvas ref={canvasRef} />
            </div>
        </ChartWrapper>
    );
}

// ─── Legend component ───────────────────────────────────────
export function ChartLegend({ items = [] }) {
    return (
        <div className="mck-chart-legend">
            {items.map((item, i) => (
                <div key={i} className="mck-legend-item">
                    <span className="mck-legend-dot" style={{ background: item.color || MCKINSEY_COLORS[i % MCKINSEY_COLORS.length] }} />
                    <span className="mck-legend-text">{item.label}</span>
                </div>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// GAUGE CHART (semicircular speedometer)
// ═══════════════════════════════════════════════════════════
export function GaugeChart({ value = 0, maxValue = 100, title, subtitle, height = 180, label, thresholds }) {
    const draw = useCallback((ctx, w, h, progress, tc) => {
        const cx = w / 2;
        const cy = h * 0.7;
        const radius = Math.min(cx, cy) - 20;
        const startA = Math.PI;
        const endA = 2 * Math.PI;
        const pct = Math.min(value, maxValue) / maxValue;

        // Track
        ctx.beginPath();
        ctx.arc(cx, cy, radius, startA, endA);
        ctx.lineWidth = radius * 0.2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(${tc.base},0.06)`;
        ctx.stroke();

        // Color zones if thresholds
        const zones = thresholds || [
            { pct: 0.35, color: '#ef4444' },
            { pct: 0.65, color: '#f59e0b' },
            { pct: 1.0, color: '#10b981' },
        ];

        let currentColor = zones[zones.length - 1].color;
        for (const z of zones) {
            if (pct <= z.pct) { currentColor = z.color; break; }
        }

        // Filled arc
        const fillEnd = startA + Math.PI * pct * progress;
        if (pct > 0) {
            const grad = ctx.createLinearGradient(cx - radius, cy, cx + radius, cy);
            grad.addColorStop(0, currentColor + '88');
            grad.addColorStop(1, currentColor);
            ctx.beginPath();
            ctx.arc(cx, cy, radius, startA, fillEnd);
            ctx.lineWidth = radius * 0.2;
            ctx.lineCap = 'round';
            ctx.strokeStyle = grad;
            ctx.stroke();
        }

        // Value text
        if (progress > 0.5) {
            ctx.fillStyle = currentColor;
            ctx.font = `800 ${Math.max(20, Math.min(36, w * 0.09))}px ${FONT}`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(Math.round(value * progress), cx, cy - 4);

            if (label) {
                ctx.fillStyle = `rgba(${tc.base},0.4)`;
                ctx.font = `500 ${Math.max(9, Math.min(12, w * 0.03))}px ${FONT}`;
                ctx.fillText(label, cx, cy + 18);
            }
        }

        // Min/Max labels
        ctx.fillStyle = `rgba(${tc.base},0.25)`;
        ctx.font = `500 9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText('0', cx - radius, cy + 14);
        ctx.fillText(maxValue.toString(), cx + radius, cy + 14);
    }, [value, maxValue, label, thresholds]);

    const { canvasRef, containerRef } = useCanvas(draw, [value]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <canvas ref={canvasRef} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// HEATMAP CHART
// ═══════════════════════════════════════════════════════════
export function HeatmapChart({ data = [], rows = [], cols = [], title, subtitle, height = 200, colorScale }) {
    // data: 2D array [row][col] or flat array {row, col, value}
    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!rows.length || !cols.length) return;
        const pad = { top: 8, right: 8, bottom: 30, left: Math.min(w * 0.25, 100) };
        const gridW = w - pad.left - pad.right;
        const gridH = h - pad.top - pad.bottom;
        const cellW = gridW / cols.length;
        const cellH = gridH / rows.length;
        const maxVal = Math.max(...data.flat(), 1);

        const getColor = (val) => {
            if (colorScale) return colorScale(val / maxVal);
            const ratio = val / maxVal;
            if (ratio >= 0.7) return '#10b981';
            if (ratio >= 0.4) return '#f59e0b';
            return '#ef4444';
        };

        rows.forEach((row, ri) => {
            // Row label
            ctx.fillStyle = `rgba(${tc.base},0.6)`;
            ctx.font = `500 ${Math.max(8, Math.min(10, w * 0.022))}px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const label = row.length > 14 ? row.slice(0, 13) + '…' : row;
            ctx.fillText(label, pad.left - 6, pad.top + ri * cellH + cellH / 2);

            cols.forEach((col, ci) => {
                const val = Array.isArray(data[ri]) ? (data[ri][ci] || 0) : 0;
                const x = pad.left + ci * cellW;
                const y = pad.top + ri * cellH;
                const color = getColor(val);
                const alpha = 0.2 + (val / maxVal) * 0.8;

                ctx.fillStyle = color + Math.round(alpha * progress * 255).toString(16).padStart(2, '0');
                ctx.beginPath();
                ctx.roundRect(x + 1, y + 1, cellW - 2, cellH - 2, 3);
                ctx.fill();

                // Value in cell
                if (progress > 0.7 && cellW > 24) {
                    ctx.fillStyle = alpha > 0.6 ? `rgba(${tc.base},0.9)` : `rgba(${tc.base},0.5)`;
                    ctx.font = `700 ${Math.max(8, Math.min(11, cellW * 0.35))}px ${FONT}`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(Math.round(val), x + cellW / 2, y + cellH / 2);
                }
            });
        });

        // Column labels
        cols.forEach((col, ci) => {
            ctx.fillStyle = `rgba(${tc.base},0.5)`;
            ctx.font = `500 ${Math.max(7, Math.min(9, w * 0.02))}px ${FONT}`;
            ctx.textAlign = 'center';
            const label = col.length > 8 ? col.slice(0, 7) + '…' : col;
            ctx.fillText(label, pad.left + ci * cellW + cellW / 2, h - pad.bottom + 14);
        });
    }, [data, rows, cols, colorScale]);

    const { canvasRef, containerRef } = useCanvas(draw, [data]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <canvas ref={canvasRef} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// STACKED BAR CHART
// ═══════════════════════════════════════════════════════════
export function StackedBarChart({ data = [], categories = [], title, subtitle, height = 220 }) {
    // data: [{label, values: [v1, v2, ...]}], categories: [{name, color}]
    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!data.length || !categories.length) return;
        const pad = { top: 20, right: 15, bottom: 40, left: 40 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const maxVal = Math.max(...data.map(d => d.values.reduce((s, v) => s + v, 0)), 1);
        const barW = Math.min(chartW / data.length * 0.6, 48);
        const gap = (chartW - barW * data.length) / (data.length + 1);

        // Grid
        ctx.strokeStyle = `rgba(${tc.base},0.06)`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillStyle = `rgba(${tc.base},0.25)`;
            ctx.font = `500 9px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxVal * (1 - i / 4)), pad.left - 6, y + 3);
        }

        data.forEach((d, i) => {
            const x = pad.left + gap + i * (barW + gap);
            let cumY = pad.top + chartH;

            d.values.forEach((val, vi) => {
                const segH = (val / maxVal) * chartH * progress;
                cumY -= segH;
                const color = categories[vi]?.color || MCKINSEY_COLORS[vi % MCKINSEY_COLORS.length];

                ctx.fillStyle = color;
                ctx.beginPath();
                if (vi === d.values.length - 1) {
                    const r = Math.min(3, barW / 5);
                    ctx.moveTo(x + r, cumY);
                    ctx.lineTo(x + barW - r, cumY);
                    ctx.quadraticCurveTo(x + barW, cumY, x + barW, cumY + r);
                    ctx.lineTo(x + barW, cumY + segH);
                    ctx.lineTo(x, cumY + segH);
                    ctx.lineTo(x, cumY + r);
                    ctx.quadraticCurveTo(x, cumY, x + r, cumY);
                } else {
                    ctx.rect(x, cumY, barW, segH);
                }
                ctx.fill();
            });

            // X label
            ctx.fillStyle = `rgba(${tc.base},0.5)`;
            ctx.font = `500 ${Math.max(8, Math.min(10, w * 0.022))}px ${FONT}`;
            ctx.textAlign = 'center';
            const label = d.label.length > 10 ? d.label.slice(0, 9) + '…' : d.label;
            ctx.fillText(label, x + barW / 2, h - pad.bottom + 16);
        });
    }, [data, categories]);

    const { canvasRef, containerRef } = useCanvas(draw, [data]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
                <canvas ref={canvasRef} />
            </div>
        </ChartWrapper>
    );
}

// ═══════════════════════════════════════════════════════════
// PROGRESS RING (small inline)
// ═══════════════════════════════════════════════════════════
export function ProgressRing({ value = 0, maxValue = 100, size = 64, color, label, showValue = true }) {
    const canvasRef = useRef(null);
    const animRef = useRef(null);
    const { resolvedTheme } = useTheme();
    const tc = { base: resolvedTheme === 'light' ? '0,0,0' : '255,255,255' };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = size * dpr;
        canvas.height = size * dpr;
        canvas.style.width = size + 'px';
        canvas.style.height = size + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);

        const pct = Math.min(value, maxValue) / maxValue;
        const ringColor = color || (pct >= 0.7 ? '#10b981' : pct >= 0.4 ? '#f59e0b' : '#ef4444');
        const lw = size * 0.12;

        let start = null;
        const tick = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / 800, 1);
            const ep = easeOutCubic(p);
            ctx.clearRect(0, 0, size, size);

            // Track
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - lw, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(${tc.base},0.06)`;
            ctx.lineWidth = lw;
            ctx.stroke();

            // Arc
            ctx.beginPath();
            ctx.arc(size / 2, size / 2, size / 2 - lw, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * pct * ep);
            ctx.strokeStyle = ringColor;
            ctx.lineWidth = lw;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Center text
            if (showValue && ep > 0.4) {
                ctx.fillStyle = `rgba(${tc.base},0.9)`;
                ctx.font = `800 ${Math.max(10, size * 0.28)}px ${FONT}`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(Math.round(value * ep), size / 2, size / 2);
            }

            if (p < 1) animRef.current = requestAnimationFrame(tick);
        };
        animRef.current = requestAnimationFrame(tick);
        return () => { if (animRef.current) cancelAnimationFrame(animRef.current); };
    }, [value, maxValue, size, color, showValue, resolvedTheme]);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
            <canvas ref={canvasRef} />
            {label && <div style={{ fontSize: '0.7rem', color: `rgba(${tc.base},0.5)`, fontWeight: 500, textAlign: 'center' }}>{label}</div>}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════
// SCATTER CHART (time vs score analysis)
// ═══════════════════════════════════════════════════════════
export function ScatterChart({ data = [], title, subtitle, height = 220, xLabel = 'X', yLabel = 'Y' }) {
    const hitAreas = useRef([]);

    const draw = useCallback((ctx, w, h, progress, tc) => {
        if (!data.length) return;
        const pad = { top: 20, right: 20, bottom: 35, left: 45 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;
        const maxX = Math.max(...data.map(d => d.x), 1) * 1.1;
        const maxY = Math.max(...data.map(d => d.y), 1) * 1.1;
        const areas = [];

        // Grid
        ctx.strokeStyle = `rgba(${tc.base},0.06)`;
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.top + (chartH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(w - pad.right, y); ctx.stroke();
            ctx.fillStyle = `rgba(${tc.base},0.25)`;
            ctx.font = `500 9px ${FONT}`;
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(maxY * (1 - i / 4)), pad.left - 6, y + 3);
        }

        // Axis labels
        ctx.fillStyle = `rgba(${tc.base},0.35)`;
        ctx.font = `500 9px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(xLabel, w / 2, h - 4);
        ctx.save();
        ctx.translate(10, h / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();

        // Points
        data.forEach((d) => {
            const px = pad.left + (d.x / maxX) * chartW;
            const py = pad.top + chartH - (d.y / maxY) * chartH;
            const animPy = py + (1 - progress) * chartH;
            const color = d.color || (d.y / maxY >= 0.6 ? '#10b981' : d.y / maxY >= 0.3 ? '#f59e0b' : '#ef4444');
            const r = d.size || 5;

            ctx.globalAlpha = 0.2 * progress;
            ctx.beginPath();
            ctx.arc(px, animPy, r + 4, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();

            ctx.globalAlpha = progress;
            ctx.beginPath();
            ctx.arc(px, animPy, r, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            ctx.globalAlpha = 1;

            areas.push({ x: px, y: animPy, r: r + 4, label: d.label || '', xVal: d.x, yVal: d.y });
        });
        hitAreas.current = areas;
    }, [data, xLabel, yLabel]);

    const { canvasRef, containerRef, tooltip, setTooltip, dims, handleMouseLeave } = useCanvas(draw, [data]);

    const handleMove = useCallback((e) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const hit = hitAreas.current.find(a => Math.hypot(mx - a.x, my - a.y) < a.r);
        setTooltip(hit ? { text: `${hit.label}: ${xLabel}=${hit.xVal}, ${yLabel}=${hit.yVal}`, mouseX: mx, mouseY: my, maxX: dims.w } : null);
    }, [dims, setTooltip, xLabel, yLabel]);

    return (
        <ChartWrapper title={title} subtitle={subtitle} height={height}>
            <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
                <canvas ref={canvasRef} onMouseMove={handleMove} onMouseLeave={handleMouseLeave} style={{ cursor: tooltip?.text ? 'pointer' : 'default' }} />
                <ChartTooltip tooltip={tooltip} />
            </div>
        </ChartWrapper>
    );
}
