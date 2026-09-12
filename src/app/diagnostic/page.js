'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import MathText from '@/components/MathText';
import QuestionMaterials from '@/components/QuestionMaterials';
import ScientificCalculator from '@/components/ScientificCalculator';
import GraphingCalculator from '@/components/GraphingCalculator';
import Whiteboard from '@/components/Whiteboard';
import TextToSpeech from '@/components/TextToSpeech';
import { GaugeChart, DonutChart, RadarChart, BarChart, HorizontalBarChart, ScatterChart, ProgressRing, ChartLegend } from '@/components/Charts';
import InteractiveQuestion from '@/components/InteractiveQuestion';

export default function DiagnosticPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Estados del flujo
    const [phase, setPhase] = useState('loading'); // loading, grade, generating, exam, processing, results, already-done
    const [schoolGrade, setSchoolGrade] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [expandedQ, setExpandedQ] = useState(null);

    // Timer acumulativo (Seguro contra interrupciones)
    const [timings, setTimings] = useState([]);
    const [totalElapsed, setTotalElapsed] = useState(0);
    const [questionElapsed, setQuestionElapsed] = useState(0);
    const timerRef = useRef(null);
    const lastTickRef = useRef(null);
    const questionElapsedRef = useRef(0);
    const totalElapsedRef = useRef(0);

    const getStorageKey = useCallback(() => {
        return session?.user?.id ? `yedatech_diagnostic_state_${session.user.id}` : null;
    }, [session]);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (session) checkExisting();
    }, [session]);

    // Timer global acumulativo
    useEffect(() => {
        if (phase === 'exam') {
            lastTickRef.current = Date.now();
            timerRef.current = setInterval(() => {
                const now = Date.now();
                const delta = now - (lastTickRef.current || now);
                lastTickRef.current = now;
                
                questionElapsedRef.current += delta;
                totalElapsedRef.current += delta;
                
                setTotalElapsed(totalElapsedRef.current);
                setQuestionElapsed(questionElapsedRef.current);
            }, 100);
        } else {
            lastTickRef.current = null;
        }
        return () => clearInterval(timerRef.current);
    }, [phase]);

    // Autoguardado: en cada cambio de estado relevante
    useEffect(() => {
        if (phase === 'exam' && questions.length > 0) {
            const key = getStorageKey();
            if (key) {
                localStorage.setItem(key, JSON.stringify({
                    phase,
                    schoolGrade,
                    questions,
                    currentIndex,
                    answers,
                    timings,
                    totalElapsed: totalElapsedRef.current,
                    questionElapsed: questionElapsedRef.current,
                    savedAt: Date.now(),
                }));
            }
        }
    }, [phase, schoolGrade, questions, currentIndex, answers, timings, getStorageKey]);

    // Guardado garantizado al cerrar/cambiar pestaña
    useEffect(() => {
        const saveNow = () => {
            if (phase === 'exam' && questions.length > 0) {
                const key = getStorageKey();
                if (key) {
                    localStorage.setItem(key, JSON.stringify({
                        phase,
                        schoolGrade,
                        questions,
                        currentIndex,
                        answers,
                        timings,
                        totalElapsed: totalElapsedRef.current,
                        questionElapsed: questionElapsedRef.current,
                        savedAt: Date.now(),
                    }));
                }
            }
        };

        // Guardar al cerrar pestaña o navegar fuera
        window.addEventListener('beforeunload', saveNow);
        // pagehide cubre iOS Safari donde beforeunload no siempre dispara
        window.addEventListener('pagehide', saveNow);
        // Guardar al cambiar de pestaña (visibilidad oculta)
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') saveNow();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('beforeunload', saveNow);
            window.removeEventListener('pagehide', saveNow);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [phase, schoolGrade, questions, currentIndex, answers, timings, getStorageKey]);

    const checkExisting = async () => {
        // ──────────────────────────────────────────────────────────
        // PRIORIDAD 1: Revisar localStorage para examen en progreso
        // (Esto resuelve el bug del retake: el API devuelve
        //  completed=true por el resultado anterior, pero si hay un
        //  examen en curso en localStorage, lo restauramos primero.)
        // ──────────────────────────────────────────────────────────
        const key = session?.user?.id ? `yedatech_diagnostic_state_${session.user.id}` : null;
        if (key) {
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    // Solo restaurar si los datos son recientes (< 24h) y el examen tiene preguntas
                    const isRecent = parsed.savedAt && (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000);
                    if (parsed.phase === 'exam' && parsed.questions?.length > 0 && isRecent) {
                        console.log('[PERSISTENCE] Restaurando examen en progreso desde localStorage...');
                        setQuestions(parsed.questions);
                        setAnswers(parsed.answers || {});
                        setCurrentIndex(parsed.currentIndex || 0);
                        setSchoolGrade(parsed.schoolGrade);
                        setTimings(parsed.timings || []);
                        questionElapsedRef.current = parsed.questionElapsed || 0;
                        totalElapsedRef.current = parsed.totalElapsed || 0;
                        setTotalElapsed(totalElapsedRef.current);
                        setQuestionElapsed(questionElapsedRef.current);
                        setPhase('exam');
                        return; // Salir sin llamar al API
                    }
                } catch (e) {
                    console.error('[PERSISTENCE] Error restaurando progreso:', e);
                    localStorage.removeItem(key); // Limpiar datos corruptos
                }
            }
        }

        // ──────────────────────────────────────────────────────────
        // PRIORIDAD 2: Consultar API para diagnóstico completado
        // ──────────────────────────────────────────────────────────
        try {
            const res = await fetch('/api/diagnostic');
            const data = await res.json();
            if (data.completed) {
                setResult(data.result);
                if (data.result?.schoolGrade) {
                    setSchoolGrade(data.result.schoolGrade);
                }
                setPhase('already-done');
            } else {
                setPhase('grade');
            }
        } catch (e) {
            console.error('[DIAGNOSTIC] Error verificando estado:', e);
            setPhase('grade');
        }
    };

    const handleGenerateExam = async () => {
        if (!schoolGrade) return;
        setPhase('generating');
        setError('');

        try {
            const res = await fetch('/api/diagnostic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate', schoolGrade }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al generar examen');

            setQuestions(data.questions);
            setAnswers({});
            setTimings(new Array(data.questions.length).fill(0));
            questionElapsedRef.current = 0;
            totalElapsedRef.current = 0;
            setTotalElapsed(0);
            setQuestionElapsed(0);
            setCurrentIndex(0);
            setPhase('exam');
        } catch (e) {
            setError(e.message);
            setPhase('grade');
        }
    };

    const handleSelectOption = (option) => {
        setAnswers({ ...answers, [currentIndex]: option });
    };

    // Para widgets directos (slider_answer, input_number, drag_sort, fill_expression)
    // Guardamos la respuesta como un objeto {value, isCorrect, type}
    const handleInteractiveAnswer = useCallback((answerData) => {
        setAnswers(prev => ({ ...prev, [currentIndex]: answerData }));
    }, [currentIndex]);

    const recordTime = useCallback((index) => {
        setTimings(prev => {
            const newTimings = [...prev];
            newTimings[index] = (newTimings[index] || 0) + questionElapsedRef.current;
            return newTimings;
        });
        questionElapsedRef.current = 0;
        setQuestionElapsed(0);
    }, []);

    const handleNext = () => {
        recordTime(currentIndex);
        if (currentIndex < questions.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    };

    const handlePrev = () => {
        recordTime(currentIndex);
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    const handleJumpTo = (idx) => {
        recordTime(currentIndex);
        setCurrentIndex(idx);
    };

    const handleSubmit = async () => {
        recordTime(currentIndex);
        setPhase('processing');

        const totalTimeMs = totalElapsedRef.current;
        // Normalizar respuestas: widgets directos (objetos {value, isCorrect, type})
        // se envían tal cual — el servidor los maneja por su propiedad `type`
        const answerList = questions.map((_, i) => answers[i] ?? null);

        try {
            const res = await fetch('/api/diagnostic', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'submit',
                    schoolGrade,
                    questions,
                    answers: answerList,
                    timings,
                    totalTimeMs,
                }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al procesar');

            const key = getStorageKey();
            if (key) localStorage.removeItem(key);

            setResult(data);
            setPhase('results');
        } catch (e) {
            setError(e.message);
            setPhase('exam');
        }
    };

    const handleRetake = async () => {
        // Usar el grado del diagnóstico anterior o el que seleccionó
        const gradeToUse = result?.schoolGrade || schoolGrade || session?.user?.schoolGrade;
        if (gradeToUse) {
            setSchoolGrade(gradeToUse);
        }
        // Limpiar estado para nuevo examen sin borrar historial
        setResult(null);
        setQuestions([]);
        setCurrentIndex(0);
        setAnswers({});
        setTimings([]);
        questionElapsedRef.current = 0;
        totalElapsedRef.current = 0;
        setTotalElapsed(0);
        setQuestionElapsed(0);
        setError('');
        
        const key = getStorageKey();
        if (key) localStorage.removeItem(key);
        setPhase(gradeToUse ? 'generating' : 'grade');

        // Si ya tenemos grado, generar directamente
        if (gradeToUse) {
            try {
                const res = await fetch('/api/diagnostic', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'generate', schoolGrade: gradeToUse }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Error al generar');
                setQuestions(data.questions);
                setTimings(new Array(data.questions.length).fill(0));
                questionElapsedRef.current = 0;
                totalElapsedRef.current = 0;
                setTotalElapsed(0);
                setQuestionElapsed(0);
                setPhase('exam');
            } catch (e) {
                setError(e.message);
                setPhase('grade');
            }
        }
    };

    const formatTime = (ms) => {
        const totalSec = Math.floor(ms / 1000);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        return `${min}:${sec.toString().padStart(2, '0')}`;
    };

    const formatAnswerString = (str) => {
        if (!str && str !== 0) return '-';
        const val = String(str);
        if (val.startsWith('__widget__:')) return val.replace('__widget__:', '');
        if (val.includes('__widget')) return 'Interactivo';
        return val;
    };

    if (status === 'loading' || phase === 'loading') {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando...</p>
            </div>
        );
    }

    // === FASE: SELECCION DE GRADO ===
    if (phase === 'grade') {
        return (
            <div className="app-container">
                <NavBar />
                <main className="main-content">
                    <div style={{ maxWidth: 600, margin: '2rem auto', textAlign: 'center' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Evaluacion Diagnostica Inteligente
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', fontSize: '0.9rem' }}>
                            Esta evaluacion esta disenada para estudiantes de grado noveno. Confirma para generar tu examen personalizado.
                        </p>

                        {error && (
                            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', borderColor: 'rgba(239,68,68,0.3)' }}>
                                <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{error}</p>
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', maxWidth: 200, margin: '0 auto 2rem' }}>
                            {[9].map(grade => (
                                <button
                                    key={grade}
                                    onClick={() => setSchoolGrade(grade)}
                                    className="card"
                                    style={{
                                        padding: '1.5rem 1rem',
                                        cursor: 'pointer',
                                        border: schoolGrade === grade ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        background: schoolGrade === grade ? 'rgba(255,105,0,0.15)' : 'var(--bg-card)',
                                        transition: 'all 0.2s ease',
                                        textAlign: 'center',
                                    }}
                                >
                                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: schoolGrade === grade ? 'var(--accent-primary)' : 'var(--text-primary)' }}>
                                        {grade}°
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        Noveno
                                    </div>
                                </button>
                            ))}
                        </div>

                        <button
                            className="btn btn-primary btn-lg"
                            onClick={handleGenerateExam}
                            disabled={!schoolGrade}
                            style={{ width: '100%', padding: '0.875rem' }}
                        >
                            Generar Mi Examen Personalizado
                        </button>
                    </div>
                </main>
            </div>
        );
    }

    // === FASE: GENERANDO ===
    if (phase === 'generating') {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text" style={{ fontSize: '1rem', fontWeight: 600 }}>
                    Cargando tu examen personalizado...
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Preparando 15 preguntas para tu evaluación diagnóstica personalizada.
                </p>
            </div>
        );
    }

    // === FASE: EXAMEN CON TIMER ===
    if (phase === 'exam' && questions.length > 0) {
        const currentQ = questions[currentIndex];
        const progress = ((currentIndex + 1) / questions.length) * 100;
        // Contar preguntas respondidas:
        // - Tradicionales/visuales: deben tener respuesta string (A/B/C/D)
        // - Directas (slider, input, drag, fill): se cuentan como respondidas
        //   en cuanto el usuario interactúa (tienen un objeto en answers[i])
        const answeredCount = questions.filter((q, i) => {
            const ans = answers[i];
            if (ans === undefined || ans === null || ans === '') return false;
            return true; // string o objeto
        }).length;
        // Para enviar, se requiere haber visto y respondido todas las preguntas
        // con opciones A/B/C/D. Las directas son opcionales (el estudiante puede
        // no haberlas "verificado" pero sí haber interactuado).
        const requiredAnswered = questions.filter((q, i) => {
            if (!q.options) return false; // directas: no bloquean
            return !answers[i]; // tradicionales/visuales sin respuesta
        }).length;
        const allAnswered = requiredAnswered === 0;

        return (
            <div className="app-container">
                <NavBar />
                <main className="main-content">
                    <div style={{ maxWidth: 700, margin: '0 auto' }}>
                        {/* Timer y progreso */}
                        <div className="card" style={{ padding: '1rem', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tiempo Total</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: 'var(--accent-primary)' }}>
                                        {formatTime(totalElapsed)}
                                    </div>
                                </div>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Esta Pregunta</div>
                                    <div style={{ fontSize: '1.25rem', fontWeight: 700, fontFamily: 'monospace', color: questionElapsed > 60000 ? '#ef4444' : 'var(--text-primary)' }}>
                                        {formatTime(questionElapsed)}
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>
                                    {answeredCount}/{questions.length} respondidas
                                </div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                    Grado {schoolGrade}°
                                </div>
                            </div>
                        </div>

                        {/* Barra de progreso */}
                        <div className="diagnostic-progress" style={{ marginBottom: '1rem' }}>
                            <div className="progress-text">
                                Pregunta {currentIndex + 1} de {questions.length}
                                <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                                    | {currentQ.topic} • {currentQ.difficulty}
                                </span>
                            </div>
                            <div className="progress-bar-bg">
                                <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>

                        {/* Pregunta */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600, textTransform: 'uppercase' }}>
                                    {currentQ.topic} • Dificultad: {currentQ.difficulty}
                                    {currentQ.tipo === 'interactiva' && (
                                        <span className="iq-badge">🎛️ Interactiva</span>
                                    )}
                                </div>
                                <TextToSpeech text={currentQ.text} size="md" />
                            </div>
                            <div style={{ fontSize: '1rem', fontWeight: 500, lineHeight: 1.6, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                                <MathText text={currentQ.text} />
                                {currentQ.materials && (
                                    <QuestionMaterials materials={currentQ.materials} />
                                )}
                            </div>

                            {/* Visualización interactiva (solo para preguntas interactivas) */}
                            {currentQ.tipo === 'interactiva' && currentQ.interactivity && (
                                <InteractiveQuestion question={currentQ} onInteractiveAnswer={handleInteractiveAnswer} currentAnswer={answers[currentIndex]} />
                            )}

                            {/* Opciones A/B/C/D — solo si la pregunta las tiene (no para widgets directos) */}
                            {currentQ.options && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {Object.entries(currentQ.options).map(([key, value]) => {
                                    const isSelected = answers[currentIndex] === key;
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleSelectOption(key)}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '0.75rem',
                                                padding: '0.875rem 1rem',
                                                borderRadius: 'var(--radius-md)',
                                                border: isSelected ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                background: isSelected ? 'rgba(255,105,0,0.12)' : 'var(--bg-input)',
                                                cursor: 'pointer',
                                                textAlign: 'left',
                                                transition: 'all 0.15s ease',
                                                color: 'var(--text-primary)',
                                                fontSize: '0.9rem',
                                            }}
                                        >
                                            <span style={{
                                                display: 'inline-flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                width: 28,
                                                height: 28,
                                                borderRadius: '50%',
                                                background: isSelected ? 'var(--accent-primary)' : 'var(--bg-card)',
                                                color: isSelected ? '#fff' : 'var(--text-secondary)',
                                                fontWeight: 700,
                                                fontSize: '0.8rem',
                                                flexShrink: 0,
                                            }}>
                                                {key}
                                            </span>
                                            <span><MathText text={value} /></span>
                                        </button>
                                    );
                                })}
                            </div>
                            )}

                            {/* Para widgets directos: solo mensaje informativo mínimo */}
                            {!currentQ.options && currentQ.tipo === 'interactiva' && (
                                <div style={{
                                    marginTop: '0.25rem',
                                    padding: '0.4rem 0.75rem',
                                    borderRadius: 'var(--radius-sm)',
                                    background: answers[currentIndex]?.isCorrect
                                        ? 'rgba(16,185,129,0.06)'
                                        : 'rgba(255,105,0,0.04)',
                                    fontSize: '0.78rem',
                                    color: 'var(--text-muted)',
                                }}>
                                    {answers[currentIndex]?.isCorrect
                                        ? '✅ ¡Correcto! Ya puedes continuar.'
                                        : answers[currentIndex]
                                        ? '📝 Respuesta guardada — puedes continuar o seguir intentando.'
                                        : '👆 Usa el campo de arriba para responder esta pregunta.'}
                                </div>
                            )}
                        </div>


                        {/* Navegacion */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <button className="btn btn-ghost btn-sm" onClick={handlePrev} disabled={currentIndex === 0}>
                                ← Anterior
                            </button>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {currentIndex < questions.length - 1 ? (
                                    <button className="btn btn-primary btn-sm" onClick={handleNext}>
                                        Siguiente →
                                    </button>
                                ) : (
                                    <button
                                        className="btn btn-success btn-sm"
                                        onClick={handleSubmit}
                                        disabled={!allAnswered}
                                        style={{ background: allAnswered ? '#10b981' : undefined }}
                                    >
                                        Enviar Examen
                                    </button>
                                )}
                            </div>
                        </div>


                        {/* Mapa de preguntas */}
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'center', flexWrap: 'wrap' }}>
                            {questions.map((_, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleJumpTo(i)}
                                    style={{
                                        width: 30,
                                        height: 30,
                                        borderRadius: '6px',
                                        border: i === currentIndex ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        background: answers[i]
                                            ? 'rgba(255,105,0,0.25)'
                                            : 'var(--bg-input)',
                                        color: i === currentIndex ? 'var(--accent-primary)' : answers[i] ? 'var(--text-primary)' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontSize: '0.7rem',
                                        fontWeight: 600,
                                    }}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                    </div>
                    <ScientificCalculator />
                    <GraphingCalculator />
                    <Whiteboard />
                </main>
            </div>
        );
    }

    // === FASE: PROCESANDO ===
    if (phase === 'processing') {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text" style={{ fontSize: '1rem', fontWeight: 600 }}>
                    Analizando tus respuestas...
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem', maxWidth: 400, textAlign: 'center', lineHeight: 1.6 }}>
                    Nuestros agentes de IA estan evaluando cada respuesta, detectando patrones de error y generando tu diagnostico personalizado.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <div>🔍 Agente Analizador: evaluando respuestas...</div>
                    <div>🧠 Agente Diagnostico: generando diagnostico...</div>
                    <div>📚 Agente de Recomendaciones: creando plan de estudio...</div>
                </div>
            </div>
        );
    }

    // === FASE: RESULTADOS / YA COMPLETADO ===
    if (phase === 'results' || phase === 'already-done') {
        const r = result;
        if (!r) return null;

        const score = r.score || 0;
        const total = r.total || r.totalQuestions || 15;
        const pct = r.percentage || Math.round((score / total) * 100);
        const analysis = r.analysis || r.aiAnalysis || {};
        const diagnosis = r.diagnosis || r.aiDiagnosis || {};
        const recommendations = r.recommendations || r.aiRecommendations || {};
        const answersData = r.answers || [];
        const timeData = r.timeData || {};

        // Calcular racha correcta más larga
        let maxStreak = 0, curStreak = 0;
        answersData.forEach(a => {
            if (a.isCorrect) { curStreak++; maxStreak = Math.max(maxStreak, curStreak); }
            else { curStreak = 0; }
        });
        // Stats velocidad
        const withTime = answersData.filter(a => a.timeSpentMs > 0);
        const fastCount = withTime.filter(a => a.timeSpentMs < 10000).length;
        const slowCount = withTime.filter(a => a.timeSpentMs > 60000).length;
        // Stats dificultad
        const diffStats = {};
        answersData.forEach(a => {
            const d = a.difficulty || 'media';
            if (!diffStats[d]) diffStats[d] = { correct: 0, total: 0 };
            diffStats[d].total++;
            if (a.isCorrect) diffStats[d].correct++;
        });

        return (
            <div className="app-container">
                <NavBar />
                <main className="main-content">
                    <div className="layout-main-sidebar">
                        {/* Header de resultados - spans full width */}
                        <div className="full-span card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '0.5rem', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(255,105,0,0.08) 100%)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                                <div style={{ fontSize: '4rem' }}>
                                    {pct >= 80 ? '🏆' : pct >= 60 ? '👍' : pct >= 40 ? '📊' : '💪'}
                                </div>
                                <div>
                                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                                        Reporte de Evaluacion
                                    </h1>
                                    <div style={{ fontSize: '2.5rem', fontWeight: 800, color: pct >= 60 ? '#10b981' : pct >= 40 ? 'var(--accent-primary)' : '#ef4444' }}>
                                        {score}/{total}
                                    </div>
                                    <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                        {pct}% de acierto • Nivel asignado: {r.assignedLevel || 1}
                                        {r.schoolGrade && ` • Grado ${r.schoolGrade}°`}
                                    </div>
                                    {timeData.totalTimeMs && (
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                            Tiempo total: {formatTime(timeData.totalTimeMs)}
                                            {timeData.avgTimeMs && ` • Promedio por pregunta: ${Math.round(timeData.avgTimeMs / 1000)}s`}
                                        </div>
                                    )}
                                </div>
                                {/* Score ring visual */}
                                <div style={{ width: 100, height: 100, borderRadius: '50%', background: `conic-gradient(${pct >= 60 ? '#10b981' : pct >= 40 ? '#ff6900' : '#ef4444'} ${pct * 3.6}deg, var(--bg-input) 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1.2rem', color: pct >= 60 ? '#10b981' : pct >= 40 ? '#ff6900' : '#ef4444' }}>
                                        {pct}%
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ═══════ MCKINSEY VISUAL DASHBOARD ═══════ */}
                        <div className="mck-chart-section animate-slide-up" style={{ gridColumn: '1 / -1' }}>

                            {/* Gauge: Score principal */}
                            <div className="mck-chart-card">
                                <GaugeChart
                                    value={pct}
                                    maxValue={100}
                                    title="Precisión General"
                                    subtitle={`${score}/${total} respuestas correctas`}
                                    label="% Acierto"
                                    height={180}
                                />
                            </div>

                            {/* Donut: Aciertos vs Errores */}
                            <div className="mck-chart-card">
                                <DonutChart
                                    data={[
                                        { label: 'Correctas', value: score, color: '#10b981' },
                                        { label: 'Incorrectas', value: total - score, color: '#ef4444' },
                                    ]}
                                    title="Distribución de Respuestas"
                                    subtitle="Aciertos vs errores en el diagnóstico"
                                    centerValue={`${pct}%`}
                                    centerLabel="precisión"
                                    height={180}
                                />
                            </div>

                            {/* Radar: Rendimiento por tema (si hay datos de temas) */}
                            {(() => {
                                const topicMap = {};
                                answersData.forEach(a => {
                                    const t = a.topic || 'General';
                                    if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 };
                                    topicMap[t].total++;
                                    if (a.isCorrect) topicMap[t].correct++;
                                });
                                const radarData = Object.entries(topicMap).map(([topic, d]) => ({
                                    label: topic.replace('Pensamiento ', 'P. '),
                                    value: Math.round((d.correct / d.total) * 100),
                                    color: '#2563eb',
                                }));
                                return radarData.length >= 3 ? (
                                    <div className="mck-chart-card">
                                        <RadarChart
                                            data={radarData}
                                            title="Perfil de Competencias"
                                            subtitle="Dominio por tipo de pensamiento"
                                            maxValue={100}
                                            height={220}
                                        />
                                    </div>
                                ) : null;
                            })()}

                            {/* Bar: Detalle por tema */}
                            {(() => {
                                const topicMap = {};
                                answersData.forEach(a => {
                                    const t = a.topic || 'General';
                                    if (!topicMap[t]) topicMap[t] = { correct: 0, total: 0 };
                                    topicMap[t].total++;
                                    if (a.isCorrect) topicMap[t].correct++;
                                });
                                const barData = Object.entries(topicMap)
                                    .map(([topic, d]) => ({
                                        label: topic.replace('Pensamiento ', 'P. '),
                                        value: Math.round((d.correct / d.total) * 100),
                                        color: (d.correct / d.total) >= 0.7 ? '#10b981' : (d.correct / d.total) >= 0.4 ? '#f59e0b' : '#ef4444',
                                    }))
                                    .sort((a, b) => b.value - a.value);
                                return barData.length > 0 ? (
                                    <div className="mck-chart-card">
                                        <BarChart
                                            data={barData}
                                            title="Rendimiento por Tema"
                                            subtitle="Porcentaje de acierto por área"
                                            height={200}
                                        />
                                    </div>
                                ) : null;
                            })()}

                            {/* Scatter: Tiempo vs Correctitud */}
                            {answersData.some(a => a.timeSpentMs > 0) && (
                                <div className="mck-chart-card mck-chart-card-full">
                                    <ScatterChart
                                        data={answersData.map((a, i) => ({
                                            x: Math.round((a.timeSpentMs || 0) / 1000),
                                            y: a.isCorrect ? 100 : 0,
                                            label: `P${a.questionIndex || i + 1}`,
                                            color: a.isCorrect ? '#10b981' : '#ef4444',
                                            size: 6,
                                        }))}
                                        title="Análisis Tiempo vs Resultado"
                                        subtitle="Cada punto es una pregunta. Hover para detalles."
                                        xLabel="Tiempo (s)"
                                        yLabel="Resultado"
                                        height={180}
                                    />
                                </div>
                            )}

                            {/* HorizontalBar: Tipos de error */}
                            {analysis.analysis && analysis.analysis.length > 0 && (() => {
                                const errorTypes = {};
                                analysis.analysis.forEach(a => {
                                    const t = a.errorType || 'otro';
                                    errorTypes[t] = (errorTypes[t] || 0) + 1;
                                });
                                const colors = { conceptual: '#ef4444', procedimental: '#f59e0b', aritmetico: '#3b82f6', interpretacion: '#a855f7' };
                                return (
                                    <div className="mck-chart-card">
                                        <HorizontalBarChart
                                            data={Object.entries(errorTypes).map(([type, count]) => ({
                                                label: type.charAt(0).toUpperCase() + type.slice(1),
                                                value: count,
                                                color: colors[type] || '#6b7280',
                                            }))}
                                            title="Tipos de Error"
                                            subtitle="Clasificación de respuestas incorrectas"
                                            unit=""
                                        />
                                    </div>
                                );
                            })()}

                            {/* ProgressRings: KPIs rápidos expandidos */}
                            <div className="mck-chart-card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', padding: '1.5rem' }}>
                                <ProgressRing value={pct} maxValue={100} size={72} label="Precisión" />
                                <ProgressRing value={r.assignedLevel || 1} maxValue={5} size={72} color="#6366f1" label="Nivel" />
                                <ProgressRing
                                    value={timeData.avgTimeMs ? Math.round(timeData.avgTimeMs / 1000) : 0}
                                    maxValue={120}
                                    size={72}
                                    color="#06b6d4"
                                    label="Seg/Preg"
                                />
                                <ProgressRing value={maxStreak} maxValue={total} size={72} color="#f59e0b" label="Racha Max" />
                                <ProgressRing value={fastCount} maxValue={total} size={72} color="#10b981" label="Rápidas" />
                                <ProgressRing value={slowCount} maxValue={total} size={72} color="#ef4444" label="Lentas" />
                            </div>

                            {/* BarChart: Tiempo por pregunta individual */}
                            {answersData.some(a => a.timeSpentMs > 0) && (
                                <div className="mck-chart-card mck-chart-card-full">
                                    <BarChart
                                        data={answersData.map((a, i) => ({
                                            label: `P${a.questionIndex || i + 1}`,
                                            value: Math.round((a.timeSpentMs || 0) / 1000),
                                            color: a.isCorrect ? '#10b981' : '#ef4444',
                                        }))}
                                        title="⏱️ Tiempo por Pregunta"
                                        subtitle="Segundos dedicados a cada pregunta (verde=correcta, rojo=incorrecta)"
                                        height={200}
                                    />
                                </div>
                            )}

                            {/* DonutChart: Distribución por dificultad */}
                            {Object.keys(diffStats).length > 0 && (
                                <div className="mck-chart-card">
                                    <DonutChart
                                        data={Object.entries(diffStats).map(([diff, s]) => ({
                                            label: `${diff.charAt(0).toUpperCase() + diff.slice(1)} (${s.correct}/${s.total})`,
                                            value: s.total,
                                            color: diff === 'facil' || diff === 'fácil' ? '#10b981' : diff === 'media' ? '#f59e0b' : '#ef4444',
                                        }))}
                                        title="Distribución por Dificultad"
                                        subtitle="Cantidad de preguntas por nivel (aciertos/total)"
                                        centerValue={`${total}`}
                                        centerLabel="preguntas"
                                        height={180}
                                    />
                                </div>
                            )}

                            {/* Mini resumen de tiempo */}
                            {timeData.totalTimeMs > 0 && (
                                <div className="mck-chart-card" style={{ padding: '1.25rem' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>⏱️ Resumen de Tiempos</h4>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.82rem' }}>
                                        <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>TOTAL</div>
                                            <div style={{ fontWeight: 700, color: 'var(--accent-primary)' }}>{formatTime(timeData.totalTimeMs)}</div>
                                        </div>
                                        <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>PROMEDIO</div>
                                            <div style={{ fontWeight: 700, color: '#06b6d4' }}>{timeData.avgTimeMs ? `${Math.round(timeData.avgTimeMs / 1000)}s` : '-'}</div>
                                        </div>
                                        {timeData.fastest && (
                                            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)' }}>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>MÁS RÁPIDA</div>
                                                <div style={{ fontWeight: 700, color: '#10b981' }}>P{timeData.fastest.index} ({Math.round(timeData.fastest.time / 1000)}s)</div>
                                            </div>
                                        )}
                                        {timeData.slowest && (
                                            <div style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)' }}>
                                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>MÁS LENTA</div>
                                                <div style={{ fontWeight: 700, color: '#ef4444' }}>P{timeData.slowest.index} ({Math.round(timeData.slowest.time / 1000)}s)</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Left column: Diagnosis + Errors + Answer Detail */}
                        <div>

                        {/* Diagnostico Academico */}
                        {diagnosis.diagnosticoGeneral && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🧠 Diagnostico Academico
                                    <TextToSpeech text={diagnosis.diagnosticoGeneral} />
                                </h2>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, fontSize: '0.9rem' }}>
                                    {diagnosis.diagnosticoGeneral}
                                </p>

                                {diagnosis.brechaAcademica && (
                                    <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,105,0,0.1)', border: '1px solid rgba(255,105,0,0.2)' }}>
                                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Brecha Academica: </span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{diagnosis.brechaAcademica}</span>
                                    </div>
                                )}

                                {diagnosis.observacionesTiempo && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                                        <span style={{ fontWeight: 600 }}>⏱️ Observaciones de Tiempo: </span>
                                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>{diagnosis.observacionesTiempo}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Mensaje motivador */}
                        {diagnosis.mensajeMotivador && (
                            <div className="card" style={{ padding: '1rem', marginBottom: '1rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.08))', border: '1px solid rgba(16,185,129,0.2)' }}>
                                <p style={{ fontSize: '0.9rem', color: '#10b981', fontWeight: 600, fontStyle: 'italic', lineHeight: 1.7, margin: 0 }}>
                                    {diagnosis.mensajeMotivador}
                                </p>
                            </div>
                        )}

                        {/* Nivel ICFES y Brecha Academica visual */}
                        {(diagnosis.nivelDesempenoICFES || diagnosis.nivelEstimado) && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    Nivel de Desempeno ICFES
                                </h2>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>NIVEL ICFES</div>
                                        <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#6366f1' }}>{diagnosis.nivelDesempenoICFES || 'No determinado'}</div>
                                    </div>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>NIVEL ESTIMADO</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#ef4444' }}>Grado {diagnosis.nivelEstimado || '?'}</div>
                                    </div>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>NIVEL ESPERADO</div>
                                        <div style={{ fontSize: '1.2rem', fontWeight: 800, color: '#10b981' }}>Grado {diagnosis.nivelEsperado || r.schoolGrade || '?'}</div>
                                    </div>
                                </div>
                                {/* Barra visual de brecha */}
                                {diagnosis.nivelEstimado && diagnosis.nivelEsperado && (
                                    <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 600, color: '#ef4444' }}>{diagnosis.nivelEstimado}</span>
                                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--bg-card)', overflow: 'hidden', position: 'relative' }}>
                                                <div style={{ position: 'absolute', left: 0, height: '100%', width: `${Math.min((diagnosis.nivelEstimado / diagnosis.nivelEsperado) * 100, 100)}%`, borderRadius: 4, background: 'linear-gradient(90deg, #ef4444, #f59e0b)' }} />
                                            </div>
                                            <span style={{ fontWeight: 600, color: '#10b981' }}>{diagnosis.nivelEsperado}</span>
                                        </div>
                                        <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                            Brecha: {Math.abs(diagnosis.nivelEsperado - diagnosis.nivelEstimado)} grado(s) de diferencia
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Perfil Cognitivo */}
                        {diagnosis.perfilCognitivo && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>
                                    Perfil Cognitivo
                                </h3>
                                <div style={{ display: 'grid', gap: '0.5rem' }}>
                                    {diagnosis.perfilCognitivo.estilo && (
                                        <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.06)', borderLeft: '3px solid #6366f1' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.82rem' }}>Estilo: </span>
                                            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{diagnosis.perfilCognitivo.estilo}</span>
                                        </div>
                                    )}
                                    {diagnosis.perfilCognitivo.descripcion && (
                                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '0.25rem 0' }}>
                                            {diagnosis.perfilCognitivo.descripcion}
                                        </div>
                                    )}
                                    {diagnosis.perfilCognitivo.comportamientoTemporal && (
                                        <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(6,182,212,0.06)', borderLeft: '3px solid #06b6d4', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            <span style={{ fontWeight: 600 }}>Comportamiento temporal: </span>
                                            {diagnosis.perfilCognitivo.comportamientoTemporal}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Competencias ICFES */}
                        {diagnosis.rendimientoPorCompetencia && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    Competencias ICFES
                                </h2>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {[
                                        { key: 'interpretacionRepresentacion', label: 'Interpretacion y Representacion', icon: '' },
                                        { key: 'formulacionEjecucion', label: 'Formulacion y Ejecucion', icon: '' },
                                        { key: 'argumentacion', label: 'Argumentacion', icon: '' },
                                    ].map(comp => {
                                        const c = diagnosis.rendimientoPorCompetencia[comp.key];
                                        if (!c) return null;
                                        const stateColors = { 'critico': '#ef4444', 'cr\u00edtico': '#ef4444', 'en desarrollo': '#f59e0b', 'adecuado': '#10b981', 'avanzado': '#6366f1', 'sin datos': '#6b7280' };
                                        const color = stateColors[c.estado] || '#6b7280';
                                        return (
                                            <div key={comp.key} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${color}33`, background: `${color}08` }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{comp.label}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: `${color}20`, color, fontWeight: 600, textTransform: 'capitalize' }}>{c.estado}</span>
                                                        <span style={{ fontWeight: 800, color, fontSize: '1.1rem' }}>{c.porcentaje}%</span>
                                                    </div>
                                                </div>
                                                {/* Progress bar */}
                                                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', marginBottom: '0.5rem', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${c.porcentaje}%`, borderRadius: 3, background: color, transition: 'width 0.8s ease' }} />
                                                </div>
                                                {c.descripcion && (
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>{c.descripcion}</p>
                                                )}
                                                {c.evidencias && c.evidencias.length > 0 && (
                                                    <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                        <span style={{ fontWeight: 600, color: '#10b981' }}>Evidencias: </span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{c.evidencias.join(' | ')}</span>
                                                    </div>
                                                )}
                                                {c.brechas && c.brechas.length > 0 && (
                                                    <div style={{ fontSize: '0.75rem' }}>
                                                        <span style={{ fontWeight: 600, color: '#ef4444' }}>Brechas: </span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{c.brechas.join(' | ')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Ejes de Conocimiento */}
                        {diagnosis.rendimientoPorEje && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    Ejes de Conocimiento MEN
                                </h2>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {[
                                        { key: 'algebraCalculo', label: 'Algebra y Calculo' },
                                        { key: 'geometria', label: 'Geometria' },
                                        { key: 'estadistica', label: 'Estadistica' },
                                    ].map(eje => {
                                        const e = diagnosis.rendimientoPorEje[eje.key];
                                        if (!e) return null;
                                        const stateColors = { 'critico': '#ef4444', 'cr\u00edtico': '#ef4444', 'en desarrollo': '#f59e0b', 'adecuado': '#10b981', 'avanzado': '#6366f1', 'sin datos': '#6b7280' };
                                        const color = stateColors[e.estado] || '#6b7280';
                                        return (
                                            <div key={eje.key} style={{ padding: '1rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${color}33`, background: `${color}08` }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{eje.label}</span>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                        <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: `${color}20`, color, fontWeight: 600, textTransform: 'capitalize' }}>{e.estado}</span>
                                                        <span style={{ fontWeight: 800, color, fontSize: '1.1rem' }}>{e.porcentaje}%</span>
                                                    </div>
                                                </div>
                                                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', marginBottom: '0.5rem', overflow: 'hidden' }}>
                                                    <div style={{ height: '100%', width: `${e.porcentaje}%`, borderRadius: 3, background: color, transition: 'width 0.8s ease' }} />
                                                </div>
                                                {e.descripcion && (
                                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.5rem 0' }}>{e.descripcion}</p>
                                                )}
                                                {e.temasEvaluados && e.temasEvaluados.length > 0 && (
                                                    <div style={{ fontSize: '0.75rem', marginBottom: '0.25rem' }}>
                                                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Temas evaluados: </span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{e.temasEvaluados.join(', ')}</span>
                                                    </div>
                                                )}
                                                {e.temasDebiles && e.temasDebiles.length > 0 && (
                                                    <div style={{ fontSize: '0.75rem' }}>
                                                        <span style={{ fontWeight: 600, color: '#ef4444' }}>Temas debiles: </span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{e.temasDebiles.join(', ')}</span>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Fortalezas y Debilidades */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            {diagnosis.fortalezas && diagnosis.fortalezas.length > 0 && (
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#10b981' }}>
                                        Fortalezas Detectadas
                                    </h3>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        {diagnosis.fortalezas.map((f, i) => (
                                            <li key={i} style={{ marginBottom: '0.25rem' }}>{f}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {diagnosis.debilidades && diagnosis.debilidades.length > 0 && (
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ef4444' }}>
                                        Debilidades Detectadas
                                    </h3>
                                    <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                        {diagnosis.debilidades.map((d, i) => (
                                            <li key={i} style={{ marginBottom: '0.25rem' }}>{d}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* DBAs Prioritarios */}
                        {diagnosis.dbasPrioritarios && diagnosis.dbasPrioritarios.length > 0 && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', borderLeft: '3px solid #6366f1' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#6366f1' }}>
                                    DBA Prioritarios (Derechos Basicos de Aprendizaje)
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {diagnosis.dbasPrioritarios.map((dba, i) => (
                                        <div key={i} style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.06)', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            <span style={{ fontWeight: 600, color: '#6366f1', marginRight: '0.3rem' }}>{i + 1}.</span>
                                            {dba}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Temas dominados y con dificultad */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                            {diagnosis.temasDominados && diagnosis.temasDominados.length > 0 && (
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#10b981' }}>
                                        Temas Dominados
                                    </h3>
                                    {diagnosis.temasDominados.map((t, i) => (
                                        <div key={i} style={{ padding: '0.6rem 0', borderBottom: i < diagnosis.temasDominados.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.tema}</span>
                                                {t.pensamiento && (
                                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{t.pensamiento}</span>
                                                )}
                                                {t.nivel && (
                                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{t.nivel}</span>
                                                )}
                                            </div>
                                            {t.dba && (
                                                <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 500, marginBottom: '0.15rem' }}>{t.dba}</div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.comentario}</div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {diagnosis.temasConDificultad && diagnosis.temasConDificultad.length > 0 && (
                                <div className="card" style={{ padding: '1.25rem' }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ef4444' }}>
                                        Temas con Dificultad
                                    </h3>
                                    {diagnosis.temasConDificultad.map((t, i) => (
                                        <div key={i} style={{ padding: '0.6rem 0', borderBottom: i < diagnosis.temasConDificultad.length - 1 ? '1px solid var(--border-color)' : 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.tema}</span>
                                                <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: t.nivel === 'critico' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)', color: t.nivel === 'critico' ? '#ef4444' : '#f59e0b' }}>
                                                    {t.nivel}
                                                </span>
                                                {t.pensamiento && (
                                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>{t.pensamiento}</span>
                                                )}
                                                {t.tipoError && (
                                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>{t.tipoError}</span>
                                                )}
                                                {t.esEstructural && (
                                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 700 }}>ESTRUCTURAL</span>
                                                )}
                                            </div>
                                            {t.dba && (
                                                <div style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 500, marginBottom: '0.15rem' }}>{t.dba}</div>
                                            )}
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{t.comentario}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Analisis de errores */}
                        {analysis.analysis && analysis.analysis.length > 0 && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    🔍 Analisis de Errores ({analysis.analysis.length} preguntas incorrectas)
                                </h2>
                                {analysis.analysis.map((a, i) => (
                                    <div key={i} style={{ padding: '1rem', marginBottom: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                Pregunta {a.questionIndex} — {a.topic}
                                            </span>
                                            <span style={{ fontSize: '0.75rem', padding: '1px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                                {a.errorType}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                            Tu respuesta: <strong style={{ color: '#ef4444' }}>{a.selectedOption}</strong> | Correcta: <strong style={{ color: '#10b981' }}>{a.correctOption}</strong>
                                        </div>
                                        {a.explicacionError && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.25rem' }}>
                                                💡 <MathText text={a.explicacionError} />
                                            </div>
                                        )}
                                        {a.conceptoDebil && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                                Concepto debil: {a.conceptoDebil}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Respuestas detalladas expandibles */}
                        {answersData.length > 0 && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                    📝 Detalle Completo de Respuestas
                                </h2>
                                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                                    Haz clic en cada pregunta para ver la retroalimentación completa
                                </p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {answersData.map((a, i) => {
                                        const idx = a.questionIndex || i + 1;
                                        const isOpen = expandedQ === i;
                                        const timeS = a.timeSpentMs ? Math.round(a.timeSpentMs / 1000) : 0;
                                        const maxT = timeData.slowest?.time ? Math.round(timeData.slowest.time / 1000) : 60;
                                        const timePct = maxT > 0 ? Math.min((timeS / maxT) * 100, 100) : 0;
                                        // Find error analysis for this question
                                        const errDetail = analysis.analysis?.find(e => e.questionIndex === idx);
                                        return (
                                            <div key={i} style={{ borderRadius: 'var(--radius-md)', border: `1px solid ${a.isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`, overflow: 'hidden' }}>
                                                {/* Row header - clickable */}
                                                <div
                                                    onClick={() => setExpandedQ(isOpen ? null : i)}
                                                    style={{ display: 'grid', gridTemplateColumns: '32px 1fr 60px 60px 50px 70px 24px', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', cursor: 'pointer', background: a.isCorrect ? 'rgba(16,185,129,0.04)' : 'rgba(239,68,68,0.04)', transition: 'background 0.15s' }}
                                                >
                                                    <span style={{ fontWeight: 700, fontSize: '0.85rem', color: a.isCorrect ? '#10b981' : '#ef4444' }}>
                                                        {a.isCorrect ? '✓' : '✗'} {idx}
                                                    </span>
                                                    <div style={{ minWidth: 0 }}>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.topic}</div>
                                                        <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{a.difficulty}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Tuya</div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: a.isCorrect ? '#10b981' : '#ef4444' }}>{formatAnswerString(a.selectedOption)}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center' }}>
                                                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Correcta</div>
                                                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#10b981' }}>{formatAnswerString(a.correctOption)}</div>
                                                    </div>
                                                    <div style={{ textAlign: 'center', fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600, color: timeS > 60 ? '#ef4444' : 'var(--text-secondary)' }}>
                                                        {timeS > 0 ? `${timeS}s` : '-'}
                                                    </div>
                                                    {/* Time bar */}
                                                    <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                                        <div style={{ height: '100%', width: `${timePct}%`, borderRadius: 3, background: timeS > 60 ? '#ef4444' : timeS > 30 ? '#f59e0b' : '#10b981', transition: 'width 0.5s ease' }} />
                                                    </div>
                                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}>▼</span>
                                                </div>
                                                {/* Expanded detail */}
                                                {isOpen && (
                                                    <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-input)', fontSize: '0.82rem' }}>
                                                        {/* Question text */}
                                                        {a.questionText && (
                                                            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', marginBottom: '0.75rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.25rem', fontWeight: 600 }}>PREGUNTA:</div>
                                                                <MathText text={a.questionText} />
                                                            </div>
                                                        )}
                                                        {/* Answers comparison */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                                            <div style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', background: a.isCorrect ? 'rgba(16,185,129,0.08)' : 'rgba(239,68,68,0.08)', border: `1px solid ${a.isCorrect ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>TU RESPUESTA</div>
                                                                <div style={{ fontWeight: 700, color: a.isCorrect ? '#10b981' : '#ef4444' }}>{formatAnswerString(a.selectedOption)}</div>
                                                            </div>
                                                            <div style={{ padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                                                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>RESPUESTA CORRECTA</div>
                                                                <div style={{ fontWeight: 700, color: '#10b981' }}>{formatAnswerString(a.correctOption)}</div>
                                                            </div>
                                                        </div>
                                                        {/* Retroalimentación from error analysis */}
                                                        {errDetail && (
                                                            <>
                                                                {errDetail.explicacionError && (
                                                                    <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.05)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
                                                                        <div style={{ fontWeight: 600, color: '#ef4444', fontSize: '0.75rem', marginBottom: '0.2rem' }}>❌ POR QUÉ ESTÁ MAL:</div>
                                                                        <MathText text={errDetail.explicacionError} />
                                                                    </div>
                                                                )}
                                                                {errDetail.explicacionCorrecta && (
                                                                    <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.05)', marginBottom: '0.5rem', lineHeight: 1.6 }}>
                                                                        <div style={{ fontWeight: 600, color: '#10b981', fontSize: '0.75rem', marginBottom: '0.2rem' }}>✅ POR QUÉ ES CORRECTA:</div>
                                                                        <MathText text={errDetail.explicacionCorrecta} />
                                                                    </div>
                                                                )}
                                                                {errDetail.conceptoDebil && (
                                                                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,105,0,0.08)', marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                                                        <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>🎯 Concepto débil: </span>
                                                                        <span style={{ color: 'var(--text-secondary)' }}>{errDetail.conceptoDebil}</span>
                                                                    </div>
                                                                )}
                                                                {errDetail.recomendacionEspecifica && (
                                                                    <div style={{ padding: '0.3rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.06)', fontSize: '0.8rem' }}>
                                                                        <span style={{ fontWeight: 600, color: '#10b981' }}>💡 Para practicar: </span>
                                                                        <span style={{ color: 'var(--text-secondary)' }}>{errDetail.recomendacionEspecifica}</span>
                                                                    </div>
                                                                )}
                                                            </>
                                                        )}
                                                        {/* For correct answers or when no errDetail */}
                                                        {a.isCorrect && !errDetail && (
                                                            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', color: '#10b981', fontWeight: 600 }}>
                                                                ✅ ¡Respuesta correcta! Dominas este concepto.
                                                            </div>
                                                        )}
                                                        {a.explanation && !errDetail && (
                                                            <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                                                                <MathText text={a.explanation} />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        </div>{/* End left column */}

                        {/* Right sidebar: Recommendations & Actions */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '80px' }}>
                        {/* Plan de Estudio */}
                        {recommendations.temasPorPrioridad && (
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    Plan de Estudio Personalizado
                                </h2>

                                {recommendations.planDeEstudio && (
                                    <div style={{ marginBottom: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>
                                            {recommendations.planDeEstudio.metaPrincipal}
                                        </div>
                                        {recommendations.planDeEstudio.resumen && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.4rem' }}>
                                                {recommendations.planDeEstudio.resumen}
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            <span>Duracion: {recommendations.planDeEstudio.duracionEstimada}</span>
                                            {recommendations.planDeEstudio.estructuraSemanal && (
                                                <span>Ritmo: {recommendations.planDeEstudio.estructuraSemanal}</span>
                                            )}
                                        </div>
                                        {recommendations.planDeEstudio.indicadoresProgreso && recommendations.planDeEstudio.indicadoresProgreso.length > 0 && (
                                            <div style={{ marginTop: '0.5rem', padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.06)' }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.72rem', color: '#10b981', marginBottom: '0.2rem' }}>Indicadores de progreso:</div>
                                                <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                    {recommendations.planDeEstudio.indicadoresProgreso.map((ind, i) => (
                                                        <li key={i}>{ind}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {['alta', 'media', 'baja'].map(prioridad => {
                                    const temas = recommendations.temasPorPrioridad?.[prioridad] || [];
                                    if (temas.length === 0) return null;
                                    const colors = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };
                                    const labels = { alta: 'Alta Prioridad', media: 'Media Prioridad', baja: 'Baja Prioridad' };

                                    return (
                                        <div key={prioridad} style={{ marginBottom: '1rem' }}>
                                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: colors[prioridad] }}>
                                                {labels[prioridad]}
                                            </h4>
                                            {temas.map((t, i) => (
                                                <div key={i} style={{ padding: '0.6rem 0.75rem', marginBottom: '0.5rem', borderRadius: 'var(--radius-sm)', borderLeft: `3px solid ${colors[prioridad]}`, background: 'var(--bg-input)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.tema}</span>
                                                        {t.pensamiento && (
                                                            <span style={{ fontSize: '0.6rem', padding: '1px 4px', borderRadius: '3px', background: `${colors[prioridad]}15`, color: colors[prioridad] }}>{t.pensamiento}</span>
                                                        )}
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>{t.razon}</div>
                                                    {t.prerrequisito && (
                                                        <div style={{ fontSize: '0.72rem', color: '#6366f1', marginBottom: '0.2rem' }}>
                                                            <span style={{ fontWeight: 600 }}>Prerrequisito: </span>{t.prerrequisito}
                                                        </div>
                                                    )}
                                                    {t.secuenciaAprendizaje && t.secuenciaAprendizaje.length > 0 && (
                                                        <div style={{ margin: '0.3rem 0', padding: '0.3rem 0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.05)' }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.7rem', color: '#6366f1', marginBottom: '0.15rem' }}>Secuencia de aprendizaje:</div>
                                                            <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                                {t.secuenciaAprendizaje.map((paso, j) => (
                                                                    <li key={j}>{paso}</li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                    )}
                                                    {t.ejerciciosRecomendados && (
                                                        <ul style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            {t.ejerciciosRecomendados.map((ej, j) => (
                                                                <li key={j}>{ej}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.3rem', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                        {t.tiempoEstimado && <span>Tiempo: {t.tiempoEstimado}</span>}
                                                        {t.senalExito && <span style={{ color: '#10b981' }}>Meta: {t.senalExito}</span>}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}

                                {/* Estrategia semanal */}
                                {recommendations.estrategia && recommendations.estrategia.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#6366f1' }}>Estrategia Semanal</div>
                                        <ol style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            {recommendations.estrategia.map((e, i) => (
                                                <li key={i} style={{ marginBottom: '0.2rem' }}>{e}</li>
                                            ))}
                                        </ol>
                                    </div>
                                )}

                                {/* Metodologia de estudio */}
                                {recommendations.metodologiaEstudio && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(6,182,212,0.06)', border: '1px solid rgba(6,182,212,0.12)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.3rem', color: '#06b6d4' }}>
                                            Metodologia de Estudio
                                            {recommendations.metodologiaEstudio.estilo && (
                                                <span style={{ fontSize: '0.68rem', marginLeft: '0.4rem', padding: '1px 5px', borderRadius: '3px', background: 'rgba(6,182,212,0.15)', fontWeight: 500 }}>
                                                    {recommendations.metodologiaEstudio.estilo}
                                                </span>
                                            )}
                                        </div>
                                        {recommendations.metodologiaEstudio.descripcion && (
                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.3rem' }}>
                                                {recommendations.metodologiaEstudio.descripcion}
                                            </div>
                                        )}
                                        {recommendations.metodologiaEstudio.tecnicasEspecificas && recommendations.metodologiaEstudio.tecnicasEspecificas.length > 0 && (
                                            <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                                {recommendations.metodologiaEstudio.tecnicasEspecificas.map((tec, i) => (
                                                    <li key={i}>{tec}</li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}

                                {/* Consejos */}
                                {recommendations.consejos && recommendations.consejos.length > 0 && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(255,105,0,0.08)', border: '1px solid rgba(255,105,0,0.15)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Consejos</div>
                                        <ul style={{ margin: 0, paddingLeft: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                            {recommendations.consejos.map((c, i) => (
                                                <li key={i} style={{ marginBottom: '0.25rem' }}>{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}

                                {/* Mensaje final */}
                                {recommendations.mensajeFinal && (
                                    <div style={{ marginTop: '0.75rem', padding: '0.6rem', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(135deg, rgba(16,185,129,0.08), rgba(99,102,241,0.08))', textAlign: 'center' }}>
                                        <p style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 600, fontStyle: 'italic', margin: 0, lineHeight: 1.5 }}>
                                            {recommendations.mensajeFinal}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Acciones */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.35rem' }}>¿Qué quieres hacer ahora?</h4>
                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: 1.4 }}>
                                Elige cómo continuar tu aprendizaje.
                            </p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <Link
                                    href="/tutor"
                                    className="btn btn-primary"
                                    style={{
                                        width: '100%', textAlign: 'center',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        border: 'none', padding: '0.65rem',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                                    }}
                                    onClick={() => {
                                        // Marcar que debe abrir en modo plan semana 1
                                        if (typeof window !== 'undefined') {
                                            sessionStorage.setItem('tutorStartMode', 'plan');
                                        }
                                    }}
                                >
                                    📅 Empezar Plan — Semana 1
                                </Link>
                                <Link
                                    href="/tutor"
                                    className="btn btn-secondary"
                                    style={{ width: '100%', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}
                                >
                                    🎯 Práctica Libre
                                </Link>
                                <Link href="/dashboard" className="btn btn-secondary" style={{ width: '100%', textAlign: 'center' }}>
                                    Dashboard
                                </Link>
                                <button className="btn btn-primary" onClick={handleRetake} style={{ width: '100%', background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                                    Repetir Diagnóstico
                                </button>
                            </div>
                        </div>

                        {/* Math decorative */}
                        <div className="card" style={{ padding: '1rem', textAlign: 'center', background: 'linear-gradient(145deg, rgba(99,102,241,0.06) 0%, var(--bg-card) 100%)', borderColor: 'rgba(99,102,241,0.15)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', lineHeight: 2 }}>
                                a2 + b2 = c2<br />
                                f'(x) = lim(h-0) [f(x+h)-f(x)]/h
                            </div>
                        </div>

                        </div>{/* End right sidebar */}
                    </div>
                </main>
            </div>
        );
    }

    return null;
}

function NavBar() {
    return (
        <nav className="navbar">
            <Link href="/dashboard" className="navbar-brand">
                <div className="navbar-logo">YT</div>
                <span className="navbar-title">YedaTech</span>
            </Link>
            <div className="navbar-nav">
                <Link href="/dashboard" className="nav-link">Dashboard</Link>
                <Link href="/pruebas-estado" className="nav-link">Pruebas de Estado</Link>
                <Link href="/tutor" className="nav-link">Tutor</Link>
                <Link href="/diagnostic" className="nav-link active">Diagnóstico</Link>
                <Link href="/analytics" className="nav-link">Analítica</Link>
            </div>
        </nav>
    );
}
