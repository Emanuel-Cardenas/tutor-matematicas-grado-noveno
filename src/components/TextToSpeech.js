'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * TextToSpeech — Botón de lectura en voz alta usando Web Speech API.
 * Limpia LaTeX y convierte expresiones matemáticas a texto legible en español.
 * 
 * Props:
 *  - text: string con el contenido a leer (puede incluir LaTeX $...$)
 *  - size: 'sm' | 'md' (default: 'sm')
 */
export default function TextToSpeech({ text, size = 'sm' }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [showControls, setShowControls] = useState(false);
    const utteranceRef = useRef(null);

    const SPEEDS = [0.75, 1, 1.25, 1.5];

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            window.speechSynthesis?.cancel();
        };
    }, []);

    // Monitor end of speech
    useEffect(() => {
        const checkSpeaking = setInterval(() => {
            if (isPlaying && !window.speechSynthesis?.speaking && !window.speechSynthesis?.pending) {
                setIsPlaying(false);
                setIsPaused(false);
            }
        }, 200);
        return () => clearInterval(checkSpeaking);
    }, [isPlaying]);

    /**
     * Convert LaTeX-formatted text to readable Spanish.
     */
    const cleanTextForSpeech = useCallback((rawText) => {
        if (!rawText) return '';
        let s = String(rawText);

        // Remove markdown bold/italic
        s = s.replace(/\*\*([^*]+)\*\*/g, '$1');
        s = s.replace(/\*([^*]+)\*/g, '$1');
        s = s.replace(/__([^_]+)__/g, '$1');
        s = s.replace(/_([^_]+)_/g, '$1');

        // Process LaTeX expressions
        // Display math $$...$$
        s = s.replace(/\$\$([^$]+)\$\$/g, (_, latex) => ' ' + latexToSpanish(latex) + ' ');
        // Inline math $...$
        s = s.replace(/\$([^$]+)\$/g, (_, latex) => ' ' + latexToSpanish(latex) + ' ');
        // \[...\] and \(...\)
        s = s.replace(/\\\[([^\]]+)\\\]/g, (_, latex) => ' ' + latexToSpanish(latex) + ' ');
        s = s.replace(/\\\(([^)]+)\\\)/g, (_, latex) => ' ' + latexToSpanish(latex) + ' ');

        // Clean up extra spaces
        s = s.replace(/\s+/g, ' ').trim();

        return s;
    }, []);

    /**
     * Convert a LaTeX expression to spoken Spanish.
     */
    function latexToSpanish(latex) {
        if (!latex) return '';
        let s = latex.trim();

        // Fractions: \frac{a}{b} → "a sobre b"
        s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, (_, num, den) => {
            const n = latexToSpanish(num);
            const d = latexToSpanish(den);
            // Common fractions
            if (n === '1' && d === '2') return 'un medio';
            if (n === '1' && d === '3') return 'un tercio';
            if (n === '1' && d === '4') return 'un cuarto';
            if (n === '2' && d === '3') return 'dos tercios';
            if (n === '3' && d === '4') return 'tres cuartos';
            return `${n} sobre ${d}`;
        });

        // Square root: \sqrt{x} → "raíz cuadrada de x"
        s = s.replace(/\\sqrt\[(\d+)\]\{([^}]+)\}/g, (_, n, content) => `raíz ${n} de ${latexToSpanish(content)}`);
        s = s.replace(/\\sqrt\{([^}]+)\}/g, (_, content) => `raíz cuadrada de ${latexToSpanish(content)}`);

        // Powers: x^{2}, x^2 → "x al cuadrado"
        s = s.replace(/([a-zA-Z0-9]+)\^\{2\}/g, '$1 al cuadrado');
        s = s.replace(/([a-zA-Z0-9]+)\^2/g, '$1 al cuadrado');
        s = s.replace(/([a-zA-Z0-9]+)\^\{3\}/g, '$1 al cubo');
        s = s.replace(/([a-zA-Z0-9]+)\^3/g, '$1 al cubo');
        s = s.replace(/([a-zA-Z0-9]+)\^\{([^}]+)\}/g, (_, base, exp) => `${base} elevado a ${latexToSpanish(exp)}`);
        s = s.replace(/([a-zA-Z0-9]+)\^([a-zA-Z0-9])/g, '$1 elevado a $2');

        // Subscripts
        s = s.replace(/([a-zA-Z])_\{([^}]+)\}/g, '$1 sub $2');
        s = s.replace(/([a-zA-Z])_([a-zA-Z0-9])/g, '$1 sub $2');

        // Trigonometric functions
        s = s.replace(/\\sin/g, 'seno de');
        s = s.replace(/\\cos/g, 'coseno de');
        s = s.replace(/\\tan/g, 'tangente de');
        s = s.replace(/\\cot/g, 'cotangente de');
        s = s.replace(/\\sec/g, 'secante de');
        s = s.replace(/\\csc/g, 'cosecante de');

        // Logarithms
        s = s.replace(/\\log/g, 'logaritmo de');
        s = s.replace(/\\ln/g, 'logaritmo natural de');

        // Limits
        s = s.replace(/\\lim_\{([^}]+)\}/g, (_, sub) => `límite cuando ${latexToSpanish(sub)} de`);
        s = s.replace(/\\lim/g, 'límite de');

        // Integrals
        s = s.replace(/\\int_\{([^}]+)\}\^\{([^}]+)\}/g, (_, a, b) => `integral de ${latexToSpanish(a)} a ${latexToSpanish(b)} de`);
        s = s.replace(/\\int/g, 'integral de');

        // Summations
        s = s.replace(/\\sum_\{([^}]+)\}\^\{([^}]+)\}/g, (_, a, b) => `sumatoria desde ${latexToSpanish(a)} hasta ${latexToSpanish(b)} de`);
        s = s.replace(/\\sum/g, 'sumatoria de');

        // Derivatives
        s = s.replace(/\\frac\{d\}\{dx\}/g, 'la derivada con respecto a x de');
        s = s.replace(/f'\(x\)/g, 'f prima de x');

        // Greek letters
        s = s.replace(/\\alpha/g, 'alfa');
        s = s.replace(/\\beta/g, 'beta');
        s = s.replace(/\\gamma/g, 'gamma');
        s = s.replace(/\\delta/g, 'delta');
        s = s.replace(/\\theta/g, 'theta');
        s = s.replace(/\\pi/g, 'pi');
        s = s.replace(/\\sigma/g, 'sigma');
        s = s.replace(/\\omega/g, 'omega');
        s = s.replace(/\\phi/g, 'fi');
        s = s.replace(/\\lambda/g, 'lambda');
        s = s.replace(/\\mu/g, 'mu');

        // Operators
        s = s.replace(/\\times/g, ' por ');
        s = s.replace(/\\cdot/g, ' por ');
        s = s.replace(/\\div/g, ' entre ');
        s = s.replace(/\\pm/g, ' más menos ');
        s = s.replace(/\\leq/g, ' menor o igual que ');
        s = s.replace(/\\geq/g, ' mayor o igual que ');
        s = s.replace(/\\neq/g, ' diferente de ');
        s = s.replace(/\\approx/g, ' aproximadamente ');
        s = s.replace(/\\infty/g, 'infinito');

        // Sets
        s = s.replace(/\\mathbb\{R\}/g, 'los números reales');
        s = s.replace(/\\mathbb\{Z\}/g, 'los números enteros');
        s = s.replace(/\\mathbb\{N\}/g, 'los números naturales');
        s = s.replace(/\\mathbb\{Q\}/g, 'los números racionales');

        // Angle
        s = s.replace(/\\angle/g, 'ángulo');

        // Clean remaining LaTeX commands
        s = s.replace(/\\text\{([^}]+)\}/g, '$1');
        s = s.replace(/\\mathrm\{([^}]+)\}/g, '$1');
        s = s.replace(/\\left/g, '');
        s = s.replace(/\\right/g, '');
        s = s.replace(/\\begin\{[^}]+\}/g, '');
        s = s.replace(/\\end\{[^}]+\}/g, '');
        s = s.replace(/\\\\/g, ', ');

        // Clean remaining backslashes and braces
        s = s.replace(/\\[a-zA-Z]+/g, ' ');
        s = s.replace(/[{}]/g, '');

        // Math symbols to words
        s = s.replace(/=/g, ' igual a ');
        s = s.replace(/\+/g, ' más ');
        s = s.replace(/-/g, ' menos ');
        s = s.replace(/\*/g, ' por ');
        s = s.replace(/\//g, ' entre ');
        s = s.replace(/</g, ' menor que ');
        s = s.replace(/>/g, ' mayor que ');
        s = s.replace(/°/g, ' grados ');

        // Clean multiple spaces
        s = s.replace(/\s+/g, ' ').trim();
        return s;
    }

    const handlePlay = useCallback(() => {
        if (!('speechSynthesis' in window)) {
            alert('Tu navegador no soporta la lectura en voz alta.');
            return;
        }

        if (isPaused) {
            window.speechSynthesis.resume();
            setIsPaused(false);
            setIsPlaying(true);
            return;
        }

        // Cancel any previous speech
        window.speechSynthesis.cancel();

        const cleanText = cleanTextForSpeech(text);
        if (!cleanText) return;

        const utterance = new SpeechSynthesisUtterance(cleanText);
        utterance.lang = 'es-MX';
        utterance.rate = speed;
        utterance.pitch = 1;

        // Try to find a Spanish voice
        const voices = window.speechSynthesis.getVoices();
        const spanishVoice = voices.find(v => v.lang.startsWith('es')) ||
                             voices.find(v => v.lang.includes('es'));
        if (spanishVoice) utterance.voice = spanishVoice;

        utterance.onend = () => {
            setIsPlaying(false);
            setIsPaused(false);
        };
        utterance.onerror = () => {
            setIsPlaying(false);
            setIsPaused(false);
        };

        utteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
        setIsPaused(false);
    }, [text, speed, isPaused, cleanTextForSpeech]);

    const handlePause = useCallback(() => {
        window.speechSynthesis.pause();
        setIsPaused(true);
    }, []);

    const handleStop = useCallback(() => {
        window.speechSynthesis.cancel();
        setIsPlaying(false);
        setIsPaused(false);
    }, []);

    const cycleSpeed = useCallback(() => {
        setSpeed(prev => {
            const idx = SPEEDS.indexOf(prev);
            const next = SPEEDS[(idx + 1) % SPEEDS.length];
            // If currently speaking, restart with new speed
            if (isPlaying) {
                window.speechSynthesis.cancel();
                setTimeout(() => {
                    const cleanText = cleanTextForSpeech(text);
                    const utterance = new SpeechSynthesisUtterance(cleanText);
                    utterance.lang = 'es-MX';
                    utterance.rate = next;
                    const voices = window.speechSynthesis.getVoices();
                    const spanishVoice = voices.find(v => v.lang.startsWith('es'));
                    if (spanishVoice) utterance.voice = spanishVoice;
                    utterance.onend = () => { setIsPlaying(false); setIsPaused(false); };
                    window.speechSynthesis.speak(utterance);
                }, 100);
            }
            return next;
        });
    }, [isPlaying, text, cleanTextForSpeech]);

    if (!text) return null;

    const btnClass = size === 'md' ? 'tts-btn tts-btn-md' : 'tts-btn';

    return (
        <span className="tts-container" onMouseLeave={() => !isPlaying && setShowControls(false)}>
            {/* Main play button */}
            <button
                className={`${btnClass} ${isPlaying ? 'tts-playing' : ''}`}
                onClick={() => {
                    if (isPlaying && !isPaused) {
                        handlePause();
                    } else {
                        handlePlay();
                    }
                    setShowControls(true);
                }}
                title={isPlaying ? (isPaused ? 'Continuar' : 'Pausar') : 'Leer en voz alta'}
            >
                {isPlaying ? (isPaused ? '▶' : '⏸') : '🔊'}
            </button>

            {/* Expanded controls */}
            {showControls && (isPlaying || isPaused) && (
                <span className="tts-controls">
                    <button className="tts-ctrl-btn" onClick={handleStop} title="Detener">⏹</button>
                    <button className="tts-ctrl-btn tts-speed-btn" onClick={cycleSpeed} title="Velocidad">
                        {speed}x
                    </button>
                </span>
            )}
        </span>
    );
}
