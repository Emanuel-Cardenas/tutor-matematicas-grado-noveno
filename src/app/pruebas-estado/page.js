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
import { GaugeChart, DonutChart, RadarChart, ProgressRing, ChartLegend } from '@/components/Charts';

function dedupeQuestionsForExam(questions) {
    const seen = new Set();
    const unique = [];

    for (const question of questions || []) {
        const signature = buildQuestionSignature(question);
        if (seen.has(signature)) continue;
        seen.add(signature);
        unique.push(question);
    }

    return unique;
}

function buildQuestionSignature(question) {
    const rawText = String(question?.text || question?.content || '');
    const firstParagraph = rawText.split(/\n\s*\n/).map(p => p.trim()).find(Boolean);
    if (firstParagraph && firstParagraph.length > 120) {
        return normalizeQuestionText(firstParagraph).slice(0, 260);
    }

    const text = normalizeQuestionText(rawText);
    const questionStart = text.search(/(?:cual|cuanto|cuantos|que|por que|es verdadera|la afirmacion)/);
    const context = questionStart > 120 ? text.slice(0, questionStart) : text.slice(0, 260);
    return context.trim() || text.slice(0, 260);
}

function normalizeQuestionText(text) {
    return String(text || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/\\(?:textbf|textit|emph|mathrm|text)\{([^}]*)\}/g, '$1')
        .replace(/\\[a-zA-Z]+/g, ' ')
        .replace(/[{}$\\]/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export default function PruebasEstadoPage() {
    const { data: session, status } = useSession();
    const router = useRouter();

    // Estados del flujo
    const [phase, setPhase] = useState('loading'); // loading, setup, generating, exam, processing, results
    const [history, setHistory] = useState([]);
    const [examSize, setExamSize] = useState(30); // 15, 30, 50
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [answers, setAnswers] = useState({});
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [expandedQ, setExpandedQ] = useState(null);

    // Herramientas
    const [showCalculator, setShowCalculator] = useState(false);
    const [showGrapher, setShowGrapher] = useState(false);
    const [showWhiteboard, setShowWhiteboard] = useState(false);

    // Timer acumulativo
    const [timings, setTimings] = useState([]);
    const [totalElapsed, setTotalElapsed] = useState(0);
    const [questionElapsed, setQuestionElapsed] = useState(0);
    const timerRef = useRef(null);
    const lastTickRef = useRef(null);
    const questionElapsedRef = useRef(0);
    const totalElapsedRef = useRef(0);

    const getStorageKey = useCallback(() => {
        return session?.user?.id ? `yedatech_pruebas_estado_state_${session.user.id}` : null;
    }, [session]);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (session) {
            checkExistingOrHistory();
        }
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

    // Autoguardado en localStorage
    useEffect(() => {
        if (phase === 'exam' && questions.length > 0) {
            const key = getStorageKey();
            if (key) {
                localStorage.setItem(key, JSON.stringify({
                    phase,
                    examSize,
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
    }, [phase, examSize, questions, currentIndex, answers, timings, getStorageKey]);

    // Registrar eventos para guardar al cerrar la pestaña
    useEffect(() => {
        const saveNow = () => {
            if (phase === 'exam' && questions.length > 0) {
                const key = getStorageKey();
                if (key) {
                    localStorage.setItem(key, JSON.stringify({
                        phase,
                        examSize,
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

        window.addEventListener('beforeunload', saveNow);
        window.addEventListener('pagehide', saveNow);
        const handleVisibility = () => {
            if (document.visibilityState === 'hidden') saveNow();
        };
        document.addEventListener('visibilitychange', handleVisibility);

        return () => {
            window.removeEventListener('beforeunload', saveNow);
            window.removeEventListener('pagehide', saveNow);
            document.removeEventListener('visibilitychange', handleVisibility);
        };
    }, [phase, examSize, questions, currentIndex, answers, timings, getStorageKey]);

    const checkExistingOrHistory = async () => {
        // 1. Revisar si hay un simulacro activo en progreso localmente
        const key = session?.user?.id ? `yedatech_pruebas_estado_state_${session.user.id}` : null;
        if (key) {
            const saved = localStorage.getItem(key);
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    const isRecent = parsed.savedAt && (Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000);
                    if (parsed.phase === 'exam' && parsed.questions?.length > 0 && isRecent) {
                        const uniqueQuestions = dedupeQuestionsForExam(parsed.questions);
                        if (uniqueQuestions.length !== parsed.questions.length) {
                            console.warn('[PERSISTENCE] Simulacro guardado descartado por preguntas repetidas.');
                            localStorage.removeItem(key);
                            setError('El simulacro guardado tenÃ­a preguntas repetidas. Inicia uno nuevo para usar el banco corregido.');
                            fetchHistory();
                            return;
                        }

                        console.log('[PERSISTENCE] Restaurando simulacro en progreso...');
                        setQuestions(parsed.questions);
                        setAnswers(parsed.answers || {});
                        setCurrentIndex(parsed.currentIndex || 0);
                        setExamSize(parsed.examSize || 30);
                        setTimings(parsed.timings || []);
                        questionElapsedRef.current = parsed.questionElapsed || 0;
                        totalElapsedRef.current = parsed.totalElapsed || 0;
                        setTotalElapsed(totalElapsedRef.current);
                        setQuestionElapsed(questionElapsedRef.current);
                        setPhase('exam');
                        return;
                    }
                } catch (e) {
                    console.error('[PERSISTENCE] Error restaurando progreso:', e);
                    localStorage.removeItem(key);
                }
            }
        }

        // 2. Si no hay en progreso, cargar el historial
        fetchHistory();
    };

    const fetchHistory = async () => {
        setPhase('loading');
        try {
            const res = await fetch('/api/pruebas-estado');
            if (res.ok) {
                const data = await res.json();
                setHistory(data.history || []);
            }
            setPhase('setup');
        } catch (e) {
            console.error('Error al obtener historial:', e);
            setPhase('setup');
        }
    };

    const handleStartSimulacro = async () => {
        setPhase('generating');
        setError('');

        try {
            const res = await fetch('/api/pruebas-estado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'generate', size: examSize }),
            });
            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Error al generar simulacro');

            const uniqueQuestions = dedupeQuestionsForExam(data.questions);
            if (uniqueQuestions.length === 0) {
                throw new Error('No se pudieron cargar preguntas Ãºnicas para este simulacro.');
            }
            if (uniqueQuestions.length !== data.questions.length) {
                console.warn(`[PRUEBAS-ESTADO] Se filtraron ${data.questions.length - uniqueQuestions.length} preguntas repetidas antes de iniciar.`);
            }

            setQuestions(uniqueQuestions);
            setAnswers({});
            setCurrentIndex(0);
            setTimings(new Array(uniqueQuestions.length).fill(0));
            
            questionElapsedRef.current = 0;
            totalElapsedRef.current = 0;
            setTotalElapsed(0);
            setQuestionElapsed(0);

            setPhase('exam');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error de conexión.');
            setPhase('setup');
        }
    };

    const handleOptionSelect = (optionChar) => {
        setAnswers(prev => ({
            ...prev,
            [currentIndex]: optionChar,
        }));
    };

    const saveCurrentQuestionTiming = () => {
        setTimings(prev => {
            const copy = [...prev];
            copy[currentIndex] = (copy[currentIndex] || 0) + questionElapsedRef.current;
            return copy;
        });
        questionElapsedRef.current = 0;
        setQuestionElapsed(0);
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            saveCurrentQuestionTiming();
            setCurrentIndex(prev => prev - 1);
        }
    };

    const handleNext = () => {
        if (currentIndex < questions.length - 1) {
            saveCurrentQuestionTiming();
            setCurrentIndex(prev => prev + 1);
        }
    };

    const handleJumpToQuestion = (index) => {
        saveCurrentQuestionTiming();
        setCurrentIndex(index);
    };

    const handleSubmitExam = async () => {
        // Guardar el tiempo de la pregunta activa
        saveCurrentQuestionTiming();

        setPhase('processing');
        setError('');

        const finalTimings = [...timings];
        finalTimings[currentIndex] = (finalTimings[currentIndex] || 0) + questionElapsedRef.current;

        try {
            // Estructurar respuestas de forma ordenada
            const finalAnswersArray = questions.map((_, idx) => answers[idx] || null);

            const res = await fetch('/api/pruebas-estado', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    questions,
                    answers: finalAnswersArray,
                    timings: finalTimings,
                    totalTimeMs: totalElapsedRef.current,
                    action: 'submit',
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                if (data.error === 'stale_questions_error') {
                    setError('El banco de preguntas ha sido actualizado. Por seguridad de tus datos, este simulacro obsoleto ha sido cancelado. Por favor, inicia uno nuevo.');
                    const key = getStorageKey();
                    if (key) localStorage.removeItem(key);
                    setPhase('setup');
                    fetchHistory();
                    return;
                }
                throw new Error(data.error || 'Error al procesar el examen');
            }

            setResult(data);
            
            // Limpiar localStorage
            const key = getStorageKey();
            if (key) localStorage.removeItem(key);

            setPhase('results');
        } catch (err) {
            console.error(err);
            setError(err.message || 'Error al procesar examen.');
            setPhase('exam');
        }
    };

    const handleRestart = () => {
        setResult(null);
        setQuestions([]);
        setAnswers({});
        setCurrentIndex(0);
        setTimings([]);
        fetchHistory();
    };

    // Formatear milisegundos a formato mm:ss
    const formatTime = (ms) => {
        const totalSecs = Math.floor(ms / 1000);
        const mins = Math.floor(totalSecs / 60);
        const secs = totalSecs % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    if (status === 'loading' || phase === 'loading') {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando Pruebas de Estado...</p>
            </div>
        );
    }

    const currentQuestion = questions[currentIndex];
    const answeredCount = Object.keys(answers).length;
    const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

    return (
        <div className="app-container">
            {/* ══ navbar ══ */}
            <nav className="navbar">
                <Link href="/dashboard" className="navbar-brand">
                    <div className="navbar-logo">YT</div>
                    <span className="navbar-title">YedaTech</span>
                </Link>
                <div className="navbar-nav">
                    <Link href="/dashboard" className="nav-link">Dashboard</Link>
                    <Link href="/tutor" className="nav-link">Tutor</Link>
                    <Link href="/pruebas-estado" className="nav-link active">Pruebas de Estado</Link>
                    <Link href="/diagnostic" className="nav-link">Diagnóstico</Link>
                    <Link href="/analytics" className="nav-link">Analítica</Link>
                </div>
                <div className="nav-user">
                    <div className="nav-user-info">
                        <div className="nav-user-name">{session.user.name}</div>
                        <div className="nav-user-level">Nivel {session.user.currentLevel || 1}</div>
                    </div>
                </div>
            </nav>

            <main className="main-content">
                {/* ────────────────────────────────────────────────────────── */}
                {/* 1. SETUP / PANTALLA INICIAL                                */}
                {/* ────────────────────────────────────────────────────────── */}
                {phase === 'setup' && (
                    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto', paddingBottom: '3.5rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                            <h1 className="dashboard-greeting" style={{ fontSize: '2rem' }}>
                                Bancos de Preguntas - <span>Pruebas de Estado Saber 11</span> 📝
                            </h1>
                            <p className="dashboard-subtitle" style={{ fontSize: '1.05rem', marginTop: '0.4rem' }}>
                                Entrena con el banco de preguntas oficial del ICFES para el examen Saber 11. Desarrolla precisión bajo tiempo.
                            </p>
                        </div>

                        <div className="layout-main-sidebar" style={{ alignItems: 'flex-start', gap: '2rem' }}>
                            {/* Panel Principal */}
                            <div style={{ flex: 1 }}>
                                <div className="card" style={{ padding: '2rem', marginBottom: '2rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.2rem', color: 'var(--text-primary)' }}>
                                        🎯 Configura tu Simulacro
                                    </h2>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', lineHeight: 1.6 }}>
                                        Selecciona la cantidad de preguntas para esta sesión de práctica. Las preguntas provienen de la base de conocimiento cargada en el sistema.
                                    </p>

                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '2rem' }}>
                                        {[
                                            { size: 15, label: 'Simulacro Corto', desc: '15 preguntas rápidas' },
                                            { size: 30, label: 'Simulacro Estándar', desc: '30 preguntas enfocadas' },
                                            { size: 50, label: 'Simulacro Completo', desc: '50 preguntas oficiales' },
                                        ].map(opt => (
                                            <button
                                                key={opt.size}
                                                type="button"
                                                onClick={() => setExamSize(opt.size)}
                                                style={{
                                                    padding: '1.25rem 1rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: examSize === opt.size ? 'rgba(255, 105, 0, 0.12)' : 'var(--bg-input)',
                                                    border: examSize === opt.size ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <span style={{ fontSize: '1.35rem', fontWeight: 800, color: examSize === opt.size ? 'var(--text-accent)' : 'var(--text-primary)' }}>{opt.size}</span>
                                                <span style={{ fontSize: '0.9rem', fontWeight: 700, marginTop: '0.25rem' }}>{opt.label}</span>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{opt.desc}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {error && <div className="error-banner" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

                                    <button className="btn btn-primary" onClick={handleStartSimulacro} style={{ width: '100%', padding: '0.9rem', fontSize: '1.05rem', fontWeight: 700 }}>
                                        Comenzar Simulacro Saber 11
                                    </button>
                                </div>

                                {/* Historial de Intentos */}
                                <div>
                                    <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        📋 Historial de Simulacros Anteriores
                                    </h3>
                                    {history.length === 0 ? (
                                        <div className="card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                                            No has realizado ningún simulacro de Saber 11 aún. ¡Configura uno arriba para comenzar!
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                            {history.map((h, i) => (
                                                <div key={h.id} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${h.accuracyRate >= 80 ? '#10b981' : h.accuracyRate >= 60 ? '#f59e0b' : '#ef4444'}` }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center' }}>
                                                        <div>
                                                            <h4 style={{ fontWeight: 700, fontSize: '0.95rem', marginBottom: '0.2rem' }}>
                                                                Intento #{history.length - i} • {h.questionsAttempted} preguntas
                                                            </h4>
                                                            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                                                Fecha: {new Date(h.startedAt).toLocaleDateString()} &nbsp;•&nbsp; Tiempo: {formatTime(h.totalTimeMs)}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: h.accuracyRate >= 80 ? '#10b981' : h.accuracyRate >= 60 ? '#f59e0b' : '#ef4444' }}>
                                                                {h.accuracyRate}%
                                                            </div>
                                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                                {h.questionsCorrect} de {h.questionsAttempted} correctas
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Sidebar Informativo */}
                            <div className="sidebar" style={{ width: '280px', position: 'sticky', top: '80px' }}>
                                <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(145deg, rgba(255, 105, 0, 0.05) 0%, var(--bg-card) 100%)' }}>
                                    <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-accent)', marginBottom: '0.5rem' }}>Estructura Saber 11</h4>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                        El examen de Matemáticas Saber 11 evalúa tres competencias clave:
                                    </p>
                                    <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', marginTop: '0.5rem', lineHeight: 1.5 }}>
                                        <li><strong>Interpretación y representación</strong>.</li>
                                        <li><strong>Formulación y ejecución</strong>.</li>
                                        <li><strong>Argumentación</strong>.</li>
                                    </ul>
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                                        Nuestra IA analizará conceptualmente tus errores al final para darte consejos enfocados de estudio.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────── */}
                {/* 2. EN GENERACIÓN                                           */}
                {/* ────────────────────────────────────────────────────────── */}
                {phase === 'generating' && (
                    <div className="loading-container animate-fade-in">
                        <div className="loading-spinner"></div>
                        <p className="loading-text">Cargando preguntas de Simulacro...</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem' }}>
                            Preparando preguntas para tu simulacro de Pruebas de Estado
                        </p>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────── */}
                {/* 3. VISOR DEL EXAMEN EN CURSO                               */}
                {/* ────────────────────────────────────────────────────────── */}
                {phase === 'exam' && currentQuestion && (
                    <div className="exam-layout animate-fade-in">
                        {/* Panel de Pregunta */}
                        <div className="exam-panel">
                            {/* Barra Superior con Info */}
                            <div className="exam-header">
                                <div>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-accent)', fontWeight: 700, textTransform: 'uppercase', tracking: '0.05em' }}>
                                        Simulacro Saber 11
                                    </span>
                                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: '0.1rem 0' }}>
                                        Pregunta {currentIndex + 1} de {questions.length}
                                    </h2>
                                </div>

                                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                        Progreso: {answeredCount}/{questions.length} ({progressPercent}%)
                                    </span>
                                    <div className="timer-pill" style={{ color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '0.4rem 0.8rem', borderRadius: 'var(--radius-full)', border: '1px solid var(--border)', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'monospace' }}>
                                        🕒 {formatTime(totalElapsed)}
                                    </div>
                                </div>
                            </div>

                            {/* Barra de progreso visual */}
                            <div style={{ height: 4, width: '100%', background: 'var(--border)', overflow: 'hidden', marginBottom: '1.5rem' }}>
                                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--gradient-primary)', transition: 'width 0.3s ease' }} />
                            </div>

                            {/* Caja de Pregunta */}
                            <div className="card" style={{ padding: '2rem', marginBottom: '1.5rem', flex: 1, minHeight: '320px', display: 'flex', flexDirection: 'column' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <span className="badge badge-topic">{currentQuestion.topic}</span>
                                    </div>
                                    <TextToSpeech text={currentQuestion.text} />
                                </div>

                                <div className="question-content" style={{ fontSize: '1.05rem', lineHeight: 1.7, color: 'var(--text-primary)', flex: 1, marginBottom: '1.5rem' }}>
                                    <MathText text={currentQuestion.text} />
                                    {currentQuestion.materials && (
                                        <QuestionMaterials materials={currentQuestion.materials} />
                                    )}
                                </div>

                                {/* Opciones de Respuesta */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                    {Object.entries(currentQuestion.options).map(([key, value]) => {
                                        const isSelected = answers[currentIndex] === key;
                                        return (
                                            <button
                                                key={key}
                                                type="button"
                                                onClick={() => handleOptionSelect(key)}
                                                className={`option-btn ${isSelected ? 'selected' : ''}`}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    width: '100%',
                                                    padding: '1rem 1.25rem',
                                                    borderRadius: 'var(--radius-md)',
                                                    background: isSelected ? 'rgba(255, 105, 0, 0.08)' : 'var(--bg-input)',
                                                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                    color: 'var(--text-primary)',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.15s',
                                                    textAlign: 'left',
                                                    fontSize: '0.95rem'
                                                }}
                                            >
                                                <span className={`option-letter ${isSelected ? 'selected' : ''}`} style={{
                                                    width: 32, height: 32, borderRadius: '50%',
                                                    background: isSelected ? 'var(--gradient-primary)' : 'var(--bg-card)',
                                                    color: isSelected ? '#fff' : 'var(--text-secondary)',
                                                    border: isSelected ? 'none' : '1px solid var(--border)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontWeight: 700, fontSize: '0.95rem', marginRight: '1rem', flexShrink: 0
                                                }}>
                                                    {key}
                                                </span>
                                                <span style={{ flex: 1 }}>
                                                    <MathText text={value} />
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Controles de Navegación */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <button className="btn btn-secondary" onClick={handlePrev} disabled={currentIndex === 0}>
                                    ⬅ Anterior
                                </button>
                                
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button className="btn btn-secondary" onClick={() => setShowCalculator(!showCalculator)}>
                                        🧮 Calculadora
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => setShowWhiteboard(!showWhiteboard)}>
                                        ✏ Pizarra
                                    </button>
                                </div>

                                {currentIndex === questions.length - 1 ? (
                                    <button className="btn btn-primary" onClick={handleSubmitExam} style={{ padding: '0.6rem 1.5rem', fontWeight: 700 }}>
                                        Finalizar Simulacro
                                    </button>
                                ) : (
                                    <button className="btn btn-primary" onClick={handleNext}>
                                        Siguiente ➡
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Panel lateral con Navegación por preguntas e Instrumentos */}
                        <div className="exam-sidebar" style={{ width: '300px', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>Navegación</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
                                    {questions.map((q, idx) => {
                                        const isCurrent = currentIndex === idx;
                                        const isAnswered = answers[idx] !== undefined;
                                        return (
                                            <button
                                                key={q.id}
                                                type="button"
                                                onClick={() => handleJumpToQuestion(idx)}
                                                style={{
                                                    height: 38,
                                                    borderRadius: 'var(--radius-sm)',
                                                    border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)',
                                                    background: isCurrent ? 'rgba(255, 105, 0, 0.12)' : isAnswered ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-input)',
                                                    color: isCurrent ? 'var(--text-accent)' : isAnswered ? '#10b981' : 'var(--text-primary)',
                                                    fontWeight: (isCurrent || isAnswered) ? 700 : 500,
                                                    fontSize: '0.85rem',
                                                    cursor: 'pointer',
                                                }}
                                            >
                                                {idx + 1}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Contenedores flotantes / colapsables de herramientas */}
                            {showCalculator && (
                                <div className="card" style={{ padding: '1rem', border: '2px solid var(--primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '0.85rem' }}>🧮 Calculadora Científica</strong>
                                        <button onClick={() => setShowCalculator(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>×</button>
                                    </div>
                                    <ScientificCalculator />
                                </div>
                            )}

                            {showWhiteboard && (
                                <div className="card" style={{ padding: '1rem', border: '2px solid var(--primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                        <strong style={{ fontSize: '0.85rem' }}>✏ Pizarra de Borrador</strong>
                                        <button onClick={() => setShowWhiteboard(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', color: 'var(--text-muted)' }}>×</button>
                                    </div>
                                    <div style={{ height: '240px' }}>
                                        <Whiteboard />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────── */}
                {/* 4. EVALUANDO Y PROCESANDO                                  */}
                {/* ────────────────────────────────────────────────────────── */}
                {phase === 'processing' && (
                    <div className="loading-container animate-fade-in">
                        <div className="loading-spinner"></div>
                        <p className="loading-text">Evaluando simulacro con IA...</p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: '0.2rem', maxWidth: '400px', textAlign: 'center' }}>
                            Nuestros agentes están analizando tus respuestas para mapear debilidades conceptuales y fortalezas de cara a la Prueba de Estado.
                        </p>
                    </div>
                )}

                {/* ────────────────────────────────────────────────────────── */}
                {/* 5. RESULTADOS DEL SIMULACRO ACTUAL                         */}
                {/* ────────────────────────────────────────────────────────── */}
                {phase === 'results' && result && (() => {
                    const sea = result.stateExamAnalysis || result.analysis || {};
                    const nivelICFES = sea.nivelDesempenoICFES || result.diagnosis?.nivelDesempenoICFES || {};
                    const compData = sea.rendimientoPorCompetencia || result.diagnosis?.rendimientoPorCompetencia || {};
                    const compComponente = sea.rendimientoPorComponente || result.diagnosis?.rendimientoPorComponente || {};
                    const patrones = sea.patronesDeError || [];
                    const tendencias = sea.tendenciasRespuesta || {};
                    const recomendaciones = sea.recomendacionesSaber11 || result.recommendations || {};
                    const comparacion = sea.comparacionDesempeno || {};
                    const analisisIndividual = sea.analisisIndividual || [];

                    const getEstadoColor = (estado) => {
                        if (!estado) return 'var(--text-muted)';
                        const s = estado.toLowerCase();
                        if (s.includes('avanzado')) return '#10b981';
                        if (s.includes('adecuado')) return '#3b82f6';
                        if (s.includes('desarrollo')) return '#f59e0b';
                        if (s.includes('crítico') || s.includes('critico')) return '#ef4444';
                        return 'var(--text-muted)';
                    };

                    const getNivelColor = (nivel) => {
                        if (nivel >= 4) return '#10b981';
                        if (nivel >= 3) return '#3b82f6';
                        if (nivel >= 2) return '#f59e0b';
                        return '#ef4444';
                    };

                    return (
                    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto', paddingBottom: '3.5rem' }}>
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
                            <span style={{ fontSize: '0.9rem', color: 'var(--text-accent)', fontWeight: 700, textTransform: 'uppercase' }}>
                                ¡Simulacro Completado!
                            </span>
                            <h1 className="dashboard-greeting" style={{ fontSize: '2.2rem', marginTop: '0.2rem' }}>
                                Resultados: Saber 11 Matemáticas 🎯
                            </h1>
                            {sea.resumenEjecutivo && (
                                <p style={{ fontSize: '0.92rem', color: 'var(--text-secondary)', maxWidth: '700px', margin: '0.75rem auto 0', lineHeight: 1.6 }}>
                                    {sea.resumenEjecutivo}
                                </p>
                            )}
                        </div>

                        {/* Fila de Métricas Clave — 5 cards incluyendo puntaje ICFES */}
                        <div className="stats-grid" style={{ marginBottom: '2rem' }}>
                            <div className="stat-card" style={{ borderTop: `3px solid ${getNivelColor(nivelICFES.nivel || 0)}` }}>
                                <div className="stat-icon">🏆</div>
                                <div className="stat-value">{sea.puntajeEstimadoICFES || '—'}</div>
                                <div className="stat-label">Puntaje ICFES Est.</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🔥</div>
                                <div className="stat-value">{result.percentage}%</div>
                                <div className="stat-label">Precisión</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">✅</div>
                                <div className="stat-value">{result.score}</div>
                                <div className="stat-label">Correctas</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">❌</div>
                                <div className="stat-value">{result.total - result.score}</div>
                                <div className="stat-label">Incorrectas</div>
                            </div>
                            <div className="stat-card">
                                <div className="stat-icon">🕒</div>
                                <div className="stat-value">{formatTime(result.timeData?.totalTimeMs || 0)}</div>
                                <div className="stat-label">Tiempo Total</div>
                            </div>
                        </div>

                        {/* ══ Nivel de Desempeño ICFES ══ */}
                        {nivelICFES.nivel && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem', borderLeft: `4px solid ${getNivelColor(nivelICFES.nivel)}` }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                                    <div style={{ textAlign: 'center', minWidth: '90px' }}>
                                        <div style={{ fontSize: '2.5rem', fontWeight: 900, color: getNivelColor(nivelICFES.nivel), lineHeight: 1 }}>
                                            {nivelICFES.nivel}
                                        </div>
                                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginTop: '0.2rem' }}>
                                            de 4 niveles
                                        </div>
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                                            Nivel {nivelICFES.nivel} — {nivelICFES.nombre || ''}
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.5rem' }}>
                                                (Rango: {nivelICFES.rangoOficial || ''})
                                            </span>
                                        </h3>
                                        <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                                            {nivelICFES.descripcion}
                                        </p>
                                    </div>
                                    {/* Level indicator dots */}
                                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                                        {[1,2,3,4].map(n => (
                                            <div key={n} style={{
                                                width: 28, height: 28, borderRadius: '50%',
                                                background: n <= nivelICFES.nivel ? getNivelColor(nivelICFES.nivel) : 'var(--bg-input)',
                                                border: `2px solid ${n <= nivelICFES.nivel ? getNivelColor(nivelICFES.nivel) : 'var(--border)'}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '0.7rem', fontWeight: 800,
                                                color: n <= nivelICFES.nivel ? '#fff' : 'var(--text-muted)',
                                            }}>{n}</div>
                                        ))}
                                    </div>
                                </div>
                                {comparacion.posicionEstimada && (
                                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.75rem', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', lineHeight: 1.4 }}>
                                        📊 {comparacion.posicionEstimada}
                                        {comparacion.metaSiguiente && <><br/>🎯 {comparacion.metaSiguiente}</>}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* ══ Gráficos: GaugeChart + DonutChart + Tiempo ══ */}
                        <div className="mck-chart-section" style={{ marginBottom: '2rem' }}>
                            <div className="mck-chart-card">
                                <GaugeChart
                                    value={sea.puntajeEstimadoICFES || result.percentage}
                                    maxValue={100}
                                    title="Puntaje ICFES Estimado"
                                    subtitle="Escala 0-100 puntos"
                                    label="puntos"
                                    height={170}
                                />
                            </div>
                            <div className="mck-chart-card">
                                <DonutChart
                                    data={[
                                        { label: 'Correctas', value: result.score, color: '#10b981' },
                                        { label: 'Incorrectas', value: result.total - result.score, color: '#ef4444' },
                                    ]}
                                    title="Distribución de Acierto"
                                    subtitle="Preguntas respondidas"
                                    centerValue={`${result.score}`}
                                    centerLabel="correctas"
                                    height={170}
                                />
                            </div>
                            <div className="mck-chart-card">
                                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'center' }}>
                                    <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>🕒 Desglose de Tiempo</h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Promedio por pregunta:</span>
                                            <strong style={{ color: 'var(--text-primary)' }}>{formatTime(result.timeData?.avgTimeMs || 0)}</strong>
                                        </div>
                                        {result.timeData?.slowest && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Más lenta:</span>
                                                <strong style={{ color: 'var(--text-primary)' }}>P{result.timeData.slowest.index} ({formatTime(result.timeData.slowest.time)})</strong>
                                            </div>
                                        )}
                                        {result.timeData?.fastest && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span style={{ color: 'var(--text-secondary)' }}>Más rápida:</span>
                                                <strong style={{ color: 'var(--text-primary)' }}>P{result.timeData.fastest.index} ({formatTime(result.timeData.fastest.time)})</strong>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>Apuradas (&lt;10s):</span>
                                            <strong style={{ color: result.timeData?.fastQuestions > 3 ? '#ef4444' : 'var(--text-primary)' }}>{result.timeData?.fastQuestions || 0}</strong>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ══ Rendimiento por Competencia ICFES ══ */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                📊 Rendimiento por Competencia ICFES
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                                {[
                                    { key: 'interpretacionRepresentacion', label: 'Interpretación y Representación', code: 'IR', pct: '34%' },
                                    { key: 'formulacionEjecucion', label: 'Formulación y Ejecución', code: 'FE', pct: '43%' },
                                    { key: 'argumentacion', label: 'Argumentación', code: 'AR', pct: '23%' },
                                ].map(comp => {
                                    const d = compData[comp.key] || {};
                                    const pct = d.porcentaje || 0;
                                    const color = getEstadoColor(d.estado);
                                    return (
                                        <div key={comp.key}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 800, background: color, color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '3px' }}>{comp.code}</span>
                                                    <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{comp.label}</span>
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>~{comp.pct} del examen</span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                    <span style={{ fontSize: '0.75rem', color: color, fontWeight: 700, textTransform: 'capitalize' }}>{d.estado || '—'}</span>
                                                    <strong style={{ fontSize: '0.95rem', color }}>{pct}%</strong>
                                                </div>
                                            </div>
                                            <div style={{ height: 8, background: 'var(--bg-input)', borderRadius: 4, overflow: 'hidden' }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.5s ease' }} />
                                            </div>
                                            {d.preguntasTotal > 0 && (
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                    {d.preguntasCorrectas || 0} de {d.preguntasTotal} correctas
                                                </div>
                                            )}
                                            {d.descripcion && (
                                                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>{d.descripcion}</p>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ══ Rendimiento por Componente ══ */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    🧩 Rendimiento por Componente
                                </h3>
                                <RadarChart
                                    data={[
                                        { label: 'Estadística', value: compComponente.estadistica?.porcentaje || 0, maxValue: 100 },
                                        { label: 'Geometría', value: compComponente.geometria?.porcentaje || 0, maxValue: 100 },
                                        { label: 'Álgebra y Cálculo', value: compComponente.algebraCalculo?.porcentaje || 0, maxValue: 100 },
                                    ]}
                                    title=""
                                    height={200}
                                />
                            </div>
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    📋 Detalle por Componente
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[
                                        { key: 'estadistica', label: 'Estadística', icon: '📈', code: 'AL' },
                                        { key: 'geometria', label: 'Geometría', icon: '📐', code: 'GM' },
                                        { key: 'algebraCalculo', label: 'Álgebra y Cálculo', icon: '🔢', code: 'NV' },
                                    ].map(comp => {
                                        const d = compComponente[comp.key] || {};
                                        const color = getEstadoColor(d.estado);
                                        return (
                                            <div key={comp.key} style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', borderLeft: `3px solid ${color}` }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>{comp.icon} {comp.label}</span>
                                                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color }}>{d.porcentaje || 0}%</span>
                                                </div>
                                                {d.temasFuertes?.length > 0 && (
                                                    <div style={{ fontSize: '0.72rem', color: '#10b981', marginTop: '0.2rem' }}>✓ {d.temasFuertes.join(', ')}</div>
                                                )}
                                                {d.temasDebiles?.length > 0 && (
                                                    <div style={{ fontSize: '0.72rem', color: '#ef4444', marginTop: '0.15rem' }}>✗ {d.temasDebiles.join(', ')}</div>
                                                )}
                                                {d.genericoVsNoGenerico && (d.genericoVsNoGenerico.genericoPct > 0 || d.genericoVsNoGenerico.noGenericoPct > 0) && (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                        Genérico: {d.genericoVsNoGenerico.genericoPct}% · No genérico: {d.genericoVsNoGenerico.noGenericoPct}%
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* ══ Fortalezas, Debilidades y Patrones ══ */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
                            {/* Fortalezas y Debilidades */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    🧠 Fortalezas y Debilidades
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    <div>
                                        <strong style={{ color: '#10b981', fontSize: '0.82rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                                            ✓ Fortalezas Específicas
                                        </strong>
                                        {(sea.fortalezasEspecificas || result.diagnosis?.fortalezas || []).length > 0 ? (
                                            <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 1.5, margin: 0 }}>
                                                {(sea.fortalezasEspecificas || result.diagnosis?.fortalezas || []).map((f, i) => <li key={i}>{f}</li>)}
                                            </ul>
                                        ) : (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin fortalezas destacadas en este intento.</p>
                                        )}
                                    </div>
                                    <div>
                                        <strong style={{ color: '#ef4444', fontSize: '0.82rem', textTransform: 'uppercase', display: 'block', marginBottom: '0.3rem' }}>
                                            ✗ Debilidades Específicas
                                        </strong>
                                        {(sea.debilidadesEspecificas || result.diagnosis?.debilidades || []).length > 0 ? (
                                            <ul style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', paddingLeft: '1.2rem', lineHeight: 1.5, margin: 0 }}>
                                                {(sea.debilidadesEspecificas || result.diagnosis?.debilidades || []).map((d, i) => <li key={i}>{d}</li>)}
                                            </ul>
                                        ) : (
                                            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>¡Excelente! No se hallaron debilidades marcadas.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Patrones de Error + Tendencias */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                    🔍 Patrones de Error y Tendencias
                                </h3>
                                {patrones.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                        {patrones.map((p, i) => (
                                            <div key={i} style={{ padding: '0.6rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.04)', borderLeft: `3px solid ${p.gravedad === 'alta' ? '#ef4444' : p.gravedad === 'media' ? '#f59e0b' : '#3b82f6'}` }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--text-primary)', marginBottom: '0.15rem' }}>
                                                    {p.patron}
                                                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '0.5rem' }}>
                                                        ({p.frecuencia}x · {p.gravedad})
                                                    </span>
                                                </div>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{p.descripcion}</p>
                                                {p.preguntasAfectadas?.length > 0 && (
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                                        Preguntas: {p.preguntasAfectadas.map(n => `P${n}`).join(', ')}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>No se detectaron patrones de error repetitivos.</p>
                                )}

                                {/* Tendencias de respuesta */}
                                {tendencias.observacionGeneral && (
                                    <div style={{ padding: '0.6rem 0.75rem', background: 'rgba(59, 130, 246, 0.04)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #3b82f6' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#3b82f6', marginBottom: '0.15rem' }}>⏱ Tendencias de Respuesta</div>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{tendencias.observacionGeneral}</p>
                                    </div>
                                )}
                                {tendencias.posiblesAdivinanzas?.length > 0 && (
                                    <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: '#f59e0b' }}>
                                        ⚠ Posibles adivinanzas: {tendencias.posiblesAdivinanzas.map(a => `P${a.index} (${a.tiempo}s)`).join(', ')}
                                    </div>
                                )}
                                {tendencias.bloqueos?.length > 0 && (
                                    <div style={{ marginTop: '0.3rem', fontSize: '0.72rem', color: '#ef4444' }}>
                                        🧊 Bloqueos detectados: {tendencias.bloqueos.map(b => `P${b.index} (${b.tiempo}s)`).join(', ')}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ══ Recomendaciones Saber 11 ══ */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '2rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.2rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                                🎯 Recomendaciones para Saber 11
                            </h3>
                            {[
                                { key: 'alta', label: '🔴 Alta Prioridad', color: '#ef4444' },
                                { key: 'media', label: '🟡 Media Prioridad', color: '#f59e0b' },
                                { key: 'baja', label: '🟢 Baja Prioridad', color: '#10b981' },
                            ].map(prio => {
                                const items = recomendaciones[prio.key] || [];
                                if (items.length === 0) return null;
                                return (
                                    <div key={prio.key} style={{ marginBottom: '1.25rem' }}>
                                        <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: prio.color, marginBottom: '0.5rem' }}>{prio.label}</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                            {items.map((item, i) => (
                                                <div key={i} style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', borderLeft: `3px solid ${prio.color}` }}>
                                                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: '0.2rem' }}>{item.tema}</div>
                                                    {item.componente && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.componente} · {item.competencia}</div>}
                                                    {item.razon && <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', margin: '0.3rem 0 0', lineHeight: 1.4 }}>{item.razon}</p>}
                                                    {item.ejercicios?.length > 0 && (
                                                        <div style={{ marginTop: '0.4rem', paddingTop: '0.3rem', borderTop: '1px dashed var(--border)' }}>
                                                            <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.2rem' }}>EJERCICIOS SUGERIDOS:</div>
                                                            <ul style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', paddingLeft: '1rem', margin: 0, lineHeight: 1.5 }}>
                                                                {item.ejercicios.map((ej, j) => <li key={j}>{ej}</li>)}
                                                            </ul>
                                                        </div>
                                                    )}
                                                    {item.estrategiaExamen && (
                                                        <p style={{ fontSize: '0.72rem', color: '#3b82f6', margin: '0.3rem 0 0', fontStyle: 'italic' }}>
                                                            💡 {item.estrategiaExamen}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                            {recomendaciones.estrategiasGenerales?.length > 0 && (
                                <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(255, 105, 0, 0.04)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--primary)' }}>
                                    <h4 style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-accent)', marginBottom: '0.3rem' }}>📝 Estrategias Generales de Examen</h4>
                                    <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '1rem', margin: 0, lineHeight: 1.5 }}>
                                        {recomendaciones.estrategiasGenerales.map((e, i) => <li key={i}>{e}</li>)}
                                    </ul>
                                </div>
                            )}
                        </div>

                        {/* ══ Desglose Individual de Preguntas (mejorado) ══ */}
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '2.5rem' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1.2rem' }}>
                                📝 Desglose Individual de Preguntas
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {questions.map((q, idx) => {
                                    const isExpanded = expandedQ === idx;
                                    const selected = answers[idx] || null;
                                    const isCorrect = selected && q.correctOption && selected.toUpperCase() === q.correctOption.toUpperCase();
                                    // Find AI analysis for this question
                                    const aiDetail = analisisIndividual.find(a => a.questionIndex === (idx + 1)) || {};
                                    return (
                                        <div key={idx} style={{ borderRadius: 'var(--radius-sm)', border: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`, background: isCorrect ? 'rgba(16, 185, 129, 0.02)' : 'rgba(239, 68, 68, 0.02)', overflow: 'hidden' }}>
                                            <div
                                                onClick={() => setExpandedQ(isExpanded ? null : idx)}
                                                style={{ padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', flexWrap: 'wrap' }}
                                            >
                                                <span style={{ fontSize: '1rem' }}>{isCorrect ? '✅' : '❌'}</span>
                                                <span style={{ fontWeight: 700, fontSize: '0.88rem', minWidth: '80px' }}>Pregunta {idx + 1}</span>
                                                <span className="badge badge-topic" style={{ fontSize: '0.68rem' }}>{q.topic}</span>
                                                {aiDetail.competenciaCode && (
                                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>{aiDetail.competenciaCode}</span>
                                                )}
                                                {aiDetail.componenteCode && (
                                                    <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>{aiDetail.componenteCode}</span>
                                                )}
                                                <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                                            </div>

                                            {isExpanded && (
                                                <div style={{ padding: '1.25rem', borderTop: `1px solid ${isCorrect ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`, background: 'var(--bg-input)' }}>
                                                    <div style={{ fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-primary)', marginBottom: '1rem' }}>
                                                        <MathText text={q.text} />
                                                        {q.materials && (
                                                            <QuestionMaterials materials={q.materials} />
                                                        )}
                                                    </div>

                                                    {q.options && (
                                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.5rem', marginBottom: '1rem' }}>
                                                            {Object.entries(q.options).map(([key, val]) => (
                                                                <div key={key} style={{ padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)', border: `1px solid ${key === q.correctOption ? 'rgba(16, 185, 129, 0.3)' : key === selected ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)'}`, background: key === q.correctOption ? 'rgba(16, 185, 129, 0.06)' : key === selected ? 'rgba(239, 68, 68, 0.06)' : 'var(--bg-card)', fontSize: '0.82rem', display: 'flex', gap: '0.5rem' }}>
                                                                    <strong>{key}:</strong>
                                                                    <span><MathText text={val} /></span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.82rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                                                        <div><span style={{ color: 'var(--text-secondary)' }}>Tu respuesta:</span> <strong style={{ color: isCorrect ? '#10b981' : '#ef4444' }}>{selected || 'Sin respuesta'}</strong></div>
                                                        <div><span style={{ color: 'var(--text-secondary)' }}>Correcta:</span> <strong style={{ color: '#10b981' }}>{q.correctOption}</strong></div>
                                                        {aiDetail.competencia && <div><span style={{ color: 'var(--text-secondary)' }}>Competencia:</span> <strong>{aiDetail.competencia}</strong></div>}
                                                        {aiDetail.componente && <div><span style={{ color: 'var(--text-secondary)' }}>Componente:</span> <strong>{aiDetail.componente}</strong></div>}
                                                    </div>

                                                    {!isCorrect && aiDetail.explicacionError && (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.5rem', padding: '0.6rem', background: 'rgba(239, 68, 68, 0.04)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #ef4444' }}>
                                                            <strong style={{ color: '#ef4444' }}>Por qué tu respuesta es incorrecta:</strong>
                                                            <p style={{ margin: '0.2rem 0 0' }}>{aiDetail.explicacionError}</p>
                                                        </div>
                                                    )}
                                                    {!isCorrect && aiDetail.explicacionCorrecta && (
                                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, padding: '0.6rem', background: 'rgba(16, 185, 129, 0.04)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid #10b981' }}>
                                                            <strong style={{ color: '#10b981' }}>Procedimiento correcto:</strong>
                                                            <p style={{ margin: '0.2rem 0 0' }}>{aiDetail.explicacionCorrecta}</p>
                                                        </div>
                                                    )}
                                                    {isCorrect && aiDetail.observacion && (
                                                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: '0.3rem' }}>
                                                            💡 {aiDetail.observacion}
                                                        </div>
                                                    )}
                                                    {aiDetail.errorType && !isCorrect && (
                                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                                                            Tipo de error: <strong>{aiDetail.errorType}</strong>
                                                            {aiDetail.conceptoDebil && <> · Concepto débil: <strong>{aiDetail.conceptoDebil}</strong></>}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Mensaje motivador */}
                        {sea.mensajeMotivador && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '2rem', textAlign: 'center', borderTop: '3px solid var(--primary)' }}>
                                <p style={{ fontSize: '0.95rem', color: 'var(--text-primary)', fontWeight: 500, lineHeight: 1.5, margin: 0 }}>
                                    💪 {sea.mensajeMotivador}
                                </p>
                            </div>
                        )}

                        {/* Botón de regreso */}
                        <div style={{ textAlign: 'center' }}>
                            <button className="btn btn-primary" onClick={handleRestart} style={{ padding: '0.8rem 2rem', fontWeight: 700 }}>
                                Regresar a Pruebas de Estado
                            </button>
                        </div>
                    </div>
                    );
                })()}
            </main>
        </div>
    );
}
