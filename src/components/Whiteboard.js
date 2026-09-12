'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * WHITEBOARD v2 — Pizarra Interactiva Mejorada
 * =============================================
 * Herramientas:
 *  - Pen (lápiz con suavizado Bézier + sensibilidad a presión)
 *  - Eraser (borrador con tamaño configurable + cursor visual)
 *  - Line (recta)
 *  - Rectangle (rectángulo)
 *  - Circle (círculo/elipse)
 *  - Grid (plano cartesiano)
 * 
 * Props:
 *  - onAnalyze: (base64: string) => void — callback para enviar la pizarra al chat
 *  - analyzing: boolean — si el análisis está en progreso
 */
export default function Whiteboard({ onAnalyze, analyzing = false }) {
    const [isOpen, setIsOpen] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const canvasRef = useRef(null);
    const previewCanvasRef = useRef(null);
    const containerRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [tool, setTool] = useState('pen');
    const [color, setColor] = useState('#ffffff');
    const [lineWidth, setLineWidth] = useState(3);
    const [eraserSize, setEraserSize] = useState(20);
    const [strokes, setStrokes] = useState([]);
    const [currentStroke, setCurrentStroke] = useState([]);
    const [shapeStart, setShapeStart] = useState(null);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [showEraserSlider, setShowEraserSlider] = useState(false);
    const lastPoint = useRef(null);
    const dprRef = useRef(1);

    const COLORS = [
        { value: '#ffffff', label: 'Blanco' },
        { value: '#ff6900', label: 'Naranja' },
        { value: '#10b981', label: 'Verde' },
        { value: '#3b82f6', label: 'Azul' },
        { value: '#ef4444', label: 'Rojo' },
        { value: '#f59e0b', label: 'Amarillo' },
        { value: '#8b5cf6', label: 'Morado' },
        { value: '#06b6d4', label: 'Cyan' },
    ];

    const LINE_WIDTHS = [
        { value: 2, label: 'Fino' },
        { value: 4, label: 'Medio' },
        { value: 8, label: 'Grueso' },
    ];

    const SHAPE_TOOLS = [
        { value: 'line', label: 'Recta', icon: '╱' },
        { value: 'rectangle', label: 'Rectángulo', icon: '▭' },
        { value: 'circle', label: 'Círculo', icon: '◯' },
        { value: 'triangle', label: 'Triángulo', icon: '△' },
        { value: 'diamond', label: 'Rombo', icon: '◇' },
        { value: 'arrow', label: 'Flecha', icon: '→' },
        { value: 'grid', label: 'Plano cartesiano', icon: '📐' },
    ];

    const isShapeTool = ['line', 'rectangle', 'circle', 'triangle', 'diamond', 'arrow'].includes(tool);

    // ─── Resize Canvas ───────────────────────────────────────
    useEffect(() => {
        if (!isOpen || !canvasRef.current || !containerRef.current) return;

        const resizeCanvas = () => {
            const canvas = canvasRef.current;
            const preview = previewCanvasRef.current;
            const container = containerRef.current;
            if (!canvas || !container) return;
            const rect = container.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            dprRef.current = dpr;

            // Main canvas
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            canvas.style.width = rect.width + 'px';
            canvas.style.height = rect.height + 'px';
            const ctx = canvas.getContext('2d');
            ctx.scale(dpr, dpr);
            redrawAllStrokes(ctx, strokes);

            // Preview canvas (for shapes)
            if (preview) {
                preview.width = rect.width * dpr;
                preview.height = rect.height * dpr;
                preview.style.width = rect.width + 'px';
                preview.style.height = rect.height + 'px';
                const pCtx = preview.getContext('2d');
                pCtx.scale(dpr, dpr);
            }
        };

        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        return () => window.removeEventListener('resize', resizeCanvas);
    }, [isOpen, isFullscreen, strokes]);

    // ─── Redraw all strokes ──────────────────────────────────
    const redrawAllStrokes = useCallback((ctx, allStrokes) => {
        if (!ctx || !canvasRef.current) return;
        const canvas = canvasRef.current;
        const dpr = dprRef.current;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

        allStrokes.forEach(stroke => {
            if (stroke.type === 'shape') {
                drawShape(ctx, stroke);
                return;
            }

            // Draw freehand stroke with Bézier smoothing
            if (stroke.points.length < 2) return;
            ctx.beginPath();
            ctx.strokeStyle = stroke.color;
            ctx.lineWidth = stroke.width;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalCompositeOperation = stroke.eraser ? 'destination-out' : 'source-over';

            if (stroke.points.length === 2) {
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                ctx.lineTo(stroke.points[1].x, stroke.points[1].y);
            } else {
                // Smoothed Bézier curve
                ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
                for (let i = 1; i < stroke.points.length - 1; i++) {
                    const midX = (stroke.points[i].x + stroke.points[i + 1].x) / 2;
                    const midY = (stroke.points[i].y + stroke.points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(stroke.points[i].x, stroke.points[i].y, midX, midY);
                }
                // Last segment
                const last = stroke.points[stroke.points.length - 1];
                const prev = stroke.points[stroke.points.length - 2];
                ctx.quadraticCurveTo(prev.x, prev.y, last.x, last.y);
            }
            ctx.stroke();
        });
        ctx.globalCompositeOperation = 'source-over';
    }, []);

    // ─── Draw shape helper ───────────────────────────────────
    const drawShape = useCallback((ctx, shape) => {
        ctx.beginPath();
        ctx.strokeStyle = shape.color;
        ctx.lineWidth = shape.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = 'source-over';

        const { shapeType, start, end } = shape;
        if (shapeType === 'line') {
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
        } else if (shapeType === 'rectangle') {
            ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else if (shapeType === 'circle') {
            const rx = Math.abs(end.x - start.x) / 2;
            const ry = Math.abs(end.y - start.y) / 2;
            const cx = (start.x + end.x) / 2;
            const cy = (start.y + end.y) / 2;
            ctx.ellipse(cx, cy, rx || 1, ry || 1, 0, 0, Math.PI * 2);
        } else if (shapeType === 'triangle') {
            const midX = (start.x + end.x) / 2;
            ctx.moveTo(midX, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.lineTo(start.x, end.y);
            ctx.closePath();
        } else if (shapeType === 'diamond') {
            const cx = (start.x + end.x) / 2;
            const cy = (start.y + end.y) / 2;
            ctx.moveTo(cx, start.y);
            ctx.lineTo(end.x, cy);
            ctx.lineTo(cx, end.y);
            ctx.lineTo(start.x, cy);
            ctx.closePath();
        } else if (shapeType === 'arrow') {
            // Line
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            // Arrowhead
            const angle = Math.atan2(end.y - start.y, end.x - start.x);
            const headLen = Math.max(12, shape.width * 4);
            ctx.lineTo(
                end.x - headLen * Math.cos(angle - Math.PI / 6),
                end.y - headLen * Math.sin(angle - Math.PI / 6)
            );
            ctx.moveTo(end.x, end.y);
            ctx.lineTo(
                end.x - headLen * Math.cos(angle + Math.PI / 6),
                end.y - headLen * Math.sin(angle + Math.PI / 6)
            );
        }
        ctx.stroke();
    }, []);

    // ─── Draw cartesian grid ─────────────────────────────────
    const drawGrid = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const dpr = dprRef.current;
        const w = canvas.width / dpr;
        const h = canvas.height / dpr;
        const cx = Math.round(w / 2);
        const cy = Math.round(h / 2);
        const step = 30;

        // Grid lines
        const gridStroke = {
            type: 'freehand',
            points: [],
            color: 'rgba(255,255,255,0.06)',
            width: 0.5,
            eraser: false,
            isGrid: true,
        };

        // Build grid as shapes
        const gridShapes = [];

        // Vertical grid lines
        for (let x = cx % step; x < w; x += step) {
            gridShapes.push({
                type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.06)',
                width: 0.5, start: { x, y: 0 }, end: { x, y: h },
            });
        }
        // Horizontal grid lines
        for (let y = cy % step; y < h; y += step) {
            gridShapes.push({
                type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.06)',
                width: 0.5, start: { x: 0, y }, end: { x: w, y },
            });
        }

        // X axis
        gridShapes.push({
            type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.4)',
            width: 1.5, start: { x: 0, y: cy }, end: { x: w, y: cy },
        });
        // Y axis
        gridShapes.push({
            type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.4)',
            width: 1.5, start: { x: cx, y: 0 }, end: { x: cx, y: h },
        });

        // Arrow heads for X axis
        gridShapes.push({
            type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.4)',
            width: 1.5, start: { x: w - 8, y: cy - 5 }, end: { x: w, y: cy },
        });
        gridShapes.push({
            type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.4)',
            width: 1.5, start: { x: w - 8, y: cy + 5 }, end: { x: w, y: cy },
        });
        // Arrow heads for Y axis
        gridShapes.push({
            type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.4)',
            width: 1.5, start: { x: cx - 5, y: 8 }, end: { x: cx, y: 0 },
        });
        gridShapes.push({
            type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.4)',
            width: 1.5, start: { x: cx + 5, y: 8 }, end: { x: cx, y: 0 },
        });

        // Tick marks and labels
        const tickShapes = [];
        for (let x = cx + step; x < w - 10; x += step) {
            tickShapes.push({
                type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.3)',
                width: 1, start: { x, y: cy - 3 }, end: { x, y: cy + 3 },
            });
        }
        for (let x = cx - step; x > 10; x -= step) {
            tickShapes.push({
                type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.3)',
                width: 1, start: { x, y: cy - 3 }, end: { x, y: cy + 3 },
            });
        }
        for (let y = cy + step; y < h - 10; y += step) {
            tickShapes.push({
                type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.3)',
                width: 1, start: { x: cx - 3, y }, end: { x: cx + 3, y },
            });
        }
        for (let y = cy - step; y > 10; y -= step) {
            tickShapes.push({
                type: 'shape', shapeType: 'line', color: 'rgba(255,255,255,0.3)',
                width: 1, start: { x: cx - 3, y }, end: { x: cx + 3, y },
            });
        }

        setStrokes(prev => [...prev, ...gridShapes, ...tickShapes]);
    }, []);

    // ─── Get position from pointer event ─────────────────────
    const getPos = useCallback((e) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        const clientX = e.clientX ?? (e.touches?.[0]?.clientX || 0);
        const clientY = e.clientY ?? (e.touches?.[0]?.clientY || 0);
        return {
            x: clientX - rect.left,
            y: clientY - rect.top,
            pressure: e.pressure ?? 0.5,
        };
    }, []);

    // ─── Start drawing ───────────────────────────────────────
    const startDrawing = useCallback((e) => {
        e.preventDefault();
        const pos = getPos(e);
        setIsDrawing(true);
        setCursorPos(pos);

        if (isShapeTool) {
            setShapeStart(pos);
        } else {
            lastPoint.current = pos;
            setCurrentStroke([pos]);
        }
    }, [getPos, isShapeTool]);

    // ─── Draw / drag ─────────────────────────────────────────
    const draw = useCallback((e) => {
        e.preventDefault();
        const pos = getPos(e);
        setCursorPos(pos);

        if (!isDrawing) return;

        if (isShapeTool && shapeStart) {
            // Draw preview on the preview canvas
            const preview = previewCanvasRef.current;
            if (!preview) return;
            const pCtx = preview.getContext('2d');
            const dpr = dprRef.current;
            pCtx.clearRect(0, 0, preview.width / dpr, preview.height / dpr);

            drawShape(pCtx, {
                shapeType: tool,
                start: shapeStart,
                end: pos,
                color,
                width: lineWidth,
            });
            return;
        }

        // Freehand drawing with Bézier smoothing
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !lastPoint.current) return;

        // Pressure-sensitive width
        const pressureWidth = tool === 'eraser'
            ? eraserSize
            : lineWidth * (0.5 + pos.pressure);

        ctx.beginPath();
        ctx.strokeStyle = tool === 'eraser' ? '#1a1a1a' : color;
        ctx.lineWidth = pressureWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';

        // Bézier smoothing
        const midX = (lastPoint.current.x + pos.x) / 2;
        const midY = (lastPoint.current.y + pos.y) / 2;
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.quadraticCurveTo(lastPoint.current.x, lastPoint.current.y, midX, midY);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';

        lastPoint.current = pos;
        setCurrentStroke(prev => [...prev, { ...pos, width: pressureWidth }]);
    }, [isDrawing, color, lineWidth, eraserSize, tool, getPos, isShapeTool, shapeStart, drawShape]);

    // ─── Stop drawing ────────────────────────────────────────
    const stopDrawing = useCallback(() => {
        if (!isDrawing) return;
        setIsDrawing(false);

        if (isShapeTool && shapeStart) {
            const pos = cursorPos;
            // Clear preview
            const preview = previewCanvasRef.current;
            if (preview) {
                const pCtx = preview.getContext('2d');
                const dpr = dprRef.current;
                pCtx.clearRect(0, 0, preview.width / dpr, preview.height / dpr);
            }
            // Add shape to strokes
            if (Math.abs(pos.x - shapeStart.x) > 2 || Math.abs(pos.y - shapeStart.y) > 2) {
                const newShape = {
                    type: 'shape',
                    shapeType: tool,
                    start: shapeStart,
                    end: pos,
                    color,
                    width: lineWidth,
                };
                setStrokes(prev => {
                    const updated = [...prev, newShape];
                    const ctx = canvasRef.current?.getContext('2d');
                    if (ctx) redrawAllStrokes(ctx, updated);
                    return updated;
                });
            }
            setShapeStart(null);
        } else {
            // Freehand stroke
            if (currentStroke.length > 1) {
                setStrokes(prev => [...prev, {
                    type: 'freehand',
                    points: currentStroke,
                    color: tool === 'eraser' ? '#1a1a1a' : color,
                    width: tool === 'eraser' ? eraserSize : lineWidth,
                    eraser: tool === 'eraser',
                }]);
            }
            setCurrentStroke([]);
            lastPoint.current = null;
        }
    }, [isDrawing, currentStroke, color, lineWidth, eraserSize, tool, isShapeTool, shapeStart, cursorPos, redrawAllStrokes]);

    // ─── Undo ────────────────────────────────────────────────
    const handleUndo = useCallback(() => {
        setStrokes(prev => {
            const newStrokes = prev.slice(0, -1);
            const ctx = canvasRef.current?.getContext('2d');
            if (ctx) redrawAllStrokes(ctx, newStrokes);
            return newStrokes;
        });
    }, [redrawAllStrokes]);

    // ─── Clear ───────────────────────────────────────────────
    const handleClear = useCallback(() => {
        setStrokes([]);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx && canvasRef.current) {
            const dpr = dprRef.current;
            ctx.clearRect(0, 0, canvasRef.current.width / dpr, canvasRef.current.height / dpr);
        }
    }, []);

    // ─── Save as PNG ─────────────────────────────────────────
    const handleSave = useCallback(() => {
        const dataUrl = getCanvasDataUrl();
        if (!dataUrl) return;
        const link = document.createElement('a');
        link.download = `yedatech-pizarra-${Date.now()}.png`;
        link.href = dataUrl;
        link.click();
    }, [strokes, redrawAllStrokes]);

    // ─── Get canvas as data URL (with bg) ────────────────────
    const getCanvasDataUrl = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        const dpr = dprRef.current;
        tempCtx.scale(dpr, dpr);
        tempCtx.fillStyle = '#1a1a1a';
        tempCtx.fillRect(0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
        redrawAllStrokes(tempCtx, strokes);
        return tempCanvas.toDataURL('image/png');
    }, [strokes, redrawAllStrokes]);

    // ─── Analyze whiteboard → send to chat ───────────────────
    const handleAnalyze = useCallback(() => {
        if (!onAnalyze || strokes.length === 0) return;
        const dataUrl = getCanvasDataUrl();
        if (!dataUrl) return;
        // Extract base64 part
        const base64 = dataUrl.split(',')[1];
        onAnalyze({
            base64,
            mimeType: 'image/png',
            preview: dataUrl,
            name: 'pizarra-yedatech.png',
        });
    }, [onAnalyze, strokes, getCanvasDataUrl]);

    // ─── Cursor style ────────────────────────────────────────
    const getCursorStyle = () => {
        if (tool === 'eraser') return 'none';
        if (isShapeTool) return 'crosshair';
        return 'crosshair';
    };

    // ─── Toggle eraser slider ────────────────────────────────
    useEffect(() => {
        setShowEraserSlider(tool === 'eraser');
    }, [tool]);

    // ─── FAB (closed state) ──────────────────────────────────
    if (!isOpen) {
        return (
            <button
                className="wb-fab"
                onClick={() => setIsOpen(true)}
                title="Pizarra Interactiva"
                id="wb-fab"
            >
                <span className="wb-fab-icon">🎨</span>
            </button>
        );
    }

    // ─── Panel (open state) ──────────────────────────────────
    return (
        <div className={`wb-panel ${isFullscreen ? 'wb-fullscreen' : ''}`} id="interactive-whiteboard">
            {/* Header */}
            <div className="wb-header">
                <span className="wb-title">🎨 Pizarra</span>
                <div className="wb-header-actions">
                    <button className="wb-icon-btn" onClick={handleUndo} title="Deshacer" disabled={strokes.length === 0}>↩</button>
                    <button className="wb-icon-btn" onClick={handleClear} title="Limpiar todo">🗑</button>
                    <button className="wb-icon-btn" onClick={handleSave} title="Guardar PNG">💾</button>
                    {onAnalyze && (
                        <button
                            className={`wb-icon-btn wb-analyze-btn ${analyzing ? 'wb-analyzing' : ''}`}
                            onClick={handleAnalyze}
                            title="Analizar con IA"
                            disabled={strokes.length === 0 || analyzing}
                        >
                            {analyzing ? '⏳' : '🔍'}
                        </button>
                    )}
                    <button className="wb-icon-btn" onClick={() => setIsFullscreen(!isFullscreen)} title={isFullscreen ? 'Reducir' : 'Pantalla completa'}>
                        {isFullscreen ? '⊡' : '⊞'}
                    </button>
                    <button className="wb-icon-btn wb-close-btn" onClick={() => { setIsOpen(false); setIsFullscreen(false); }} title="Cerrar">✕</button>
                </div>
            </div>

            {/* Toolbar */}
            <div className="wb-toolbar">
                {/* Drawing tools */}
                <div className="wb-tool-group">
                    <button
                        className={`wb-tool-btn ${tool === 'pen' ? 'wb-tool-active' : ''}`}
                        onClick={() => setTool('pen')}
                        title="Lápiz"
                    >✏️</button>
                    <button
                        className={`wb-tool-btn ${tool === 'eraser' ? 'wb-tool-active' : ''}`}
                        onClick={() => setTool('eraser')}
                        title="Borrador"
                    >🧹</button>
                </div>

                <div className="wb-separator" />

                {/* Shape tools */}
                <div className="wb-tool-group">
                    {SHAPE_TOOLS.map(s => (
                        <button
                            key={s.value}
                            className={`wb-tool-btn wb-shape-btn ${tool === s.value ? 'wb-tool-active' : ''}`}
                            onClick={() => {
                                if (s.value === 'grid') {
                                    drawGrid();
                                    setTool('pen');
                                } else {
                                    setTool(s.value);
                                }
                            }}
                            title={s.label}
                        >{s.icon}</button>
                    ))}
                </div>

                <div className="wb-separator" />

                {/* Colors */}
                <div className="wb-tool-group wb-colors">
                    {COLORS.map(c => (
                        <button
                            key={c.value}
                            className={`wb-color-btn ${color === c.value ? 'wb-color-active' : ''}`}
                            style={{ background: c.value }}
                            onClick={() => { setColor(c.value); if (tool === 'eraser') setTool('pen'); }}
                            title={c.label}
                        />
                    ))}
                </div>

                <div className="wb-separator" />

                {/* Line widths */}
                <div className="wb-tool-group">
                    {LINE_WIDTHS.map(w => (
                        <button
                            key={w.value}
                            className={`wb-width-btn ${lineWidth === w.value ? 'wb-width-active' : ''}`}
                            onClick={() => setLineWidth(w.value)}
                            title={w.label}
                        >
                            <span className="wb-width-dot" style={{ width: w.value * 2, height: w.value * 2 }} />
                        </button>
                    ))}
                </div>
            </div>

            {/* Eraser size slider */}
            {showEraserSlider && (
                <div className="wb-eraser-slider-container">
                    <span className="wb-eraser-label">🧹 Tamaño: {eraserSize}px</span>
                    <input
                        type="range"
                        className="wb-eraser-slider"
                        min="5"
                        max="80"
                        value={eraserSize}
                        onChange={(e) => setEraserSize(Number(e.target.value))}
                    />
                </div>
            )}

            {/* Canvas */}
            <div className="wb-canvas-container" ref={containerRef}>
                <canvas
                    ref={canvasRef}
                    className="wb-canvas"
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    style={{ cursor: getCursorStyle(), touchAction: 'none' }}
                />
                {/* Preview canvas for shapes */}
                <canvas
                    ref={previewCanvasRef}
                    className="wb-canvas wb-canvas-preview"
                    style={{ pointerEvents: 'none' }}
                />

                {/* Eraser cursor */}
                {tool === 'eraser' && (
                    <div
                        className="wb-eraser-cursor"
                        style={{
                            width: eraserSize,
                            height: eraserSize,
                            left: cursorPos.x - eraserSize / 2,
                            top: cursorPos.y - eraserSize / 2,
                        }}
                    />
                )}
            </div>
        </div>
    );
}
