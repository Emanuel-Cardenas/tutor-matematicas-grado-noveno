'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * SpeechToText — Botón de micrófono que convierte voz a texto usando Web Speech API.
 * 
 * Props:
 *  - onTranscript: (text: string) => void — callback con el texto transcrito
 *  - onInterimResult: (text: string) => void — callback con resultados parciales (opcional)
 *  - disabled: boolean — deshabilitar el botón
 */
export default function SpeechToText({ onTranscript, onInterimResult, disabled = false }) {
    const [isListening, setIsListening] = useState(false);
    const [isSupported, setIsSupported] = useState(true);
    const [error, setError] = useState(null);
    const recognitionRef = useRef(null);
    const finalTranscriptRef = useRef('');

    useEffect(() => {
        // Verificar soporte del navegador
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            setIsSupported(false);
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-MX';
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
            let interim = '';
            let final = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    final += transcript;
                } else {
                    interim += transcript;
                }
            }

            if (final) {
                finalTranscriptRef.current += final;
            }

            // Mostrar resultado parcial mientras habla
            if (onInterimResult) {
                onInterimResult(finalTranscriptRef.current + interim);
            }
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            setIsListening(false);

            const errorMessages = {
                'no-speech': 'No se detectó voz. Intenta hablar más cerca del micrófono.',
                'audio-capture': 'No se encontró micrófono. Verifica que esté conectado.',
                'not-allowed': 'Permiso de micrófono denegado. Habilítalo en la configuración del navegador.',
                'network': 'Error de red. Verifica tu conexión a internet.',
                'aborted': null, // User cancelled, no error to show
            };

            const msg = errorMessages[event.error] || `Error de reconocimiento de voz: ${event.error}`;
            if (msg) setError(msg);

            setTimeout(() => setError(null), 5000);
        };

        recognition.onend = () => {
            setIsListening(false);
            // Enviar transcripción final si hay contenido
            if (finalTranscriptRef.current.trim()) {
                onTranscript(finalTranscriptRef.current.trim());
                finalTranscriptRef.current = '';
            }
        };

        recognitionRef.current = recognition;

        return () => {
            recognition.abort();
        };
    }, [onTranscript, onInterimResult]);

    const toggleListening = useCallback(() => {
        if (!recognitionRef.current) return;

        if (isListening) {
            recognitionRef.current.stop();
        } else {
            setError(null);
            finalTranscriptRef.current = '';
            try {
                recognitionRef.current.start();
                setIsListening(true);
            } catch (e) {
                console.error('Error starting speech recognition:', e);
                setError('No se pudo iniciar el reconocimiento de voz.');
                setTimeout(() => setError(null), 4000);
            }
        }
    }, [isListening]);

    if (!isSupported) {
        return (
            <button
                className="stt-btn stt-unsupported"
                title="Tu navegador no soporta reconocimiento de voz. Usa Chrome o Edge."
                disabled
            >
                🎤
            </button>
        );
    }

    return (
        <>
            <button
                className={`stt-btn ${isListening ? 'stt-listening' : ''}`}
                onClick={toggleListening}
                disabled={disabled}
                title={isListening ? 'Detener grabación' : 'Hablar con el micrófono'}
                type="button"
                id="speech-to-text-btn"
            >
                {isListening ? (
                    <span className="stt-recording-icon">
                        <span className="stt-pulse-ring"></span>
                        🎤
                    </span>
                ) : (
                    '🎤'
                )}
            </button>

            {error && (
                <div className="stt-error-toast">
                    <span>⚠️ {error}</span>
                </div>
            )}
        </>
    );
}
