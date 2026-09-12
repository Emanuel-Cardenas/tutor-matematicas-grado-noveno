'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import MathText from '@/components/MathText';
import ScientificCalculator from '@/components/ScientificCalculator';
import GraphingCalculator from '@/components/GraphingCalculator';
import Whiteboard from '@/components/Whiteboard';
import TextToSpeech from '@/components/TextToSpeech';
import SpeechToText from '@/components/SpeechToText';
import ImageUpload from '@/components/ImageUpload';
import { usePagePersistence } from '@/lib/usePagePersistence';
import MathEditor from '@/components/MathEditor';

export default function TutorPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sessionId, setSessionId] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(null);
    const [attemptNumber, setAttemptNumber] = useState(0);
    const [lastEvaluation, setLastEvaluation] = useState(null);
    const [questionStartTime, setQuestionStartTime] = useState(null);
    const [progressData, setProgressData] = useState(null);
    const [showProgress, setShowProgress] = useState(false);
    const [isRestoring, setIsRestoring] = useState(true);
    const [pendingImage, setPendingImage] = useState(null);
    const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
    const [whiteboardAnalyzing, setWhiteboardAnalyzing] = useState(false);
    const [isMathMode, setIsMathMode] = useState(false);
    const [mathComposerValue, setMathComposerValue] = useState('');
    // ── Plan de Estudio ──────────────────────────────────────
    const [tutorMode, setTutorMode] = useState('free');      // 'free' | 'plan'
    const [hasSelectedMode, setHasSelectedMode] = useState(false);
    const [studyPlan, setStudyPlan] = useState(null);
    const [studyPlanLoading, setStudyPlanLoading] = useState(false);
    const [selectedWeek, setSelectedWeek] = useState(null);  // número de semana activa
    const [showWeekPanel, setShowWeekPanel] = useState(false);
    const [weekCompletedToast, setWeekCompletedToast] = useState(null);
    const messagesEndRef = useRef(null);
    const localRestoredRef = useRef(false); // evitar doble restauración

    // ─── Clave de localStorage por usuario ─────────────────────
    const storageKey = session?.user?.id
        ? `yedatech_tutor_chat_${session.user.id}`
        : null;

    // Estado combinado que se persiste
    const persistState = {
        messages,
        sessionId,
        currentQuestion,
        attemptNumber,
        tutorMode,
        hasSelectedMode,
        selectedWeek
    };

    // Hook de persistencia: guarda al cambiar pestaña / cerrar ventana
    const { clear: clearLocalSession } = usePagePersistence(
        storageKey,
        persistState,
        null, // la restauración la manejamos manualmente abajo
        { enabled: !!storageKey, maxAgeMs: 4 * 60 * 60 * 1000 } // 4 horas
    );

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (session) {
            initializeTutor();
        }
    }, [session]);

    // Leer sessionStorage al montar: si llegó desde diagnóstico con "plan", activar modo plan
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const startMode = sessionStorage.getItem('tutorStartMode');
            if (startMode === 'plan') {
                sessionStorage.removeItem('tutorStartMode');
                setTutorMode('plan');
                setShowWeekPanel(true);
            }
        }
    }, []);

    useEffect(() => {
        setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
    }, [messages, loading]);

    // Cargar plan de estudio del diagnóstico
    const loadStudyPlan = useCallback(async () => {
        setStudyPlanLoading(true);
        try {
            const res = await fetch('/api/study-plan');
            if (res.ok) {
                const data = await res.json();
                setStudyPlan(data);
                // Si hay plan, seleccionar la semana activa por defecto
                if (data.hasPlan && data.activeWeek) {
                    setSelectedWeek(data.activeWeek);
                }
            }
        } catch (e) {
            console.error('[TUTOR] Error cargando plan de estudio:', e);
        } finally {
            setStudyPlanLoading(false);
        }
    }, []);

    // Cargar progreso y restaurar sesión activa
    const initializeTutor = async () => {
        setIsRestoring(true);
        try {
            // ─── PRIORIDAD 1: Restaurar desde localStorage (instantáneo) ───
            if (storageKey && !localRestoredRef.current) {
                const raw = localStorage.getItem(storageKey);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        const age    = Date.now() - (parsed.__savedAt || 0);
                        const data   = parsed.__data;

                        if (data?.messages?.length > 0 && age < 4 * 60 * 60 * 1000) {
                            console.log('[TUTOR] Restaurando chat desde localStorage...');
                            localRestoredRef.current = true;
                            setMessages(data.messages);
                            setSessionId(data.sessionId || null);
                            setCurrentQuestion(data.currentQuestion || null);
                            setAttemptNumber(data.attemptNumber || 0);
                            if (data.tutorMode) setTutorMode(data.tutorMode);
                            if (data.hasSelectedMode !== undefined) setHasSelectedMode(data.hasSelectedMode);
                            if (data.selectedWeek) setSelectedWeek(data.selectedWeek);
                            setIsRestoring(false);
                            refreshProgress();
                            loadStudyPlan(); // cargar plan en background
                            return;
                        }
                    } catch (e) {
                        console.error('[TUTOR] Error parseando localStorage:', e);
                        localStorage.removeItem(storageKey);
                    }
                }
            }

            // ─── PRIORIDAD 2: Restaurar sesión activa desde API ───
            const progressRes = await fetch('/api/progress');
            if (progressRes.ok) {
                const data = await progressRes.json();
                setProgressData(data);

                if (data.activeSession && data.activeSession.messages.length > 0) {
                    setSessionId(data.activeSession.id);
                    setCurrentQuestion(data.activeSession.lastQuestion);
                    setQuestionStartTime(Date.now());

                    const restoredMessages = [
                        {
                            role: 'tutor',
                            content: `¡Bienvenido de vuelta! 🧠 Continuemos donde lo dejamos. Tienes ${data.stats.totalCorrect} respuestas correctas de ${data.stats.totalQuestions} intentos (${data.stats.accuracy}% de precisión).`,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        },
                        ...data.activeSession.messages,
                    ];

                    setMessages(restoredMessages);
                    setIsRestoring(false);
                    loadStudyPlan();
                    return;
                }
            }

            // ─── PRIORIDAD 3: Inicio Limpio ───
            loadStudyPlan();
        } catch (e) {
            console.error('Error initializing tutor:', e);
            // loadFirstQuestion() se llamará cuando seleccionen modo
        }
        setIsRestoring(false);
    };

    const loadFirstQuestion = async () => {
        try {
            const res = await fetch('/api/questions/next');
            if (res.ok) {
                const data = await res.json();
                if (data.question) {
                    setCurrentQuestion(data.question);
                    setQuestionStartTime(Date.now());

                    const welcomeMsg = progressData?.stats?.totalQuestions > 0
                        ? `¡Hola de nuevo! 🧠 Llevas ${progressData.stats.totalCorrect} respuestas correctas. Sigamos practicando.`
                        : '¡Hola! Soy tu tutor de matemáticas YedaTech 🧠\n\nVoy a guiarte a resolver problemas, pero recuerda: no te daré las respuestas directamente. Mi trabajo es ayudarte a pensar y descubrir por ti mismo.\n\nAquí va tu primer ejercicio:';

                    setMessages([{
                        role: 'tutor',
                        content: welcomeMsg,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }, {
                        role: 'tutor',
                        content: `📝 ${data.question.topic || 'Matemáticas'} (Nivel ${data.question.difficulty})\n\n${data.question.content}\n\n¿Qué piensas? ¿Por dónde empezarías a resolver este problema?`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                }
            }
        } catch (e) {
            console.error(e);
            setMessages([{
                role: 'tutor',
                content: '¡Hola! Soy tu tutor YedaTech 🧠 Escríbeme cualquier problema de matemáticas y te ayudaré a resolverlo con preguntas guía.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        }
    };

    const startFreePracticeMode = async () => {
        setTutorMode('free');
        setShowWeekPanel(false);
        setHasSelectedMode(true);
        await loadFirstQuestion();
    };

    const startStudyPlanMode = async (weekNumber = null) => {
        setTutorMode('plan');
        setShowWeekPanel(true);
        setHasSelectedMode(true);
        
        const activeWeek = weekNumber || studyPlan?.activeWeek || 1;
        setSelectedWeek(activeWeek);

        if (!studyPlan?.diagnosticId) {
            await loadFirstQuestion();
            return;
        }

        try {
            const res = await fetch(`/api/questions/next?studyPlanWeek=${activeWeek}&diagnosticId=${studyPlan.diagnosticId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.question) {
                    setCurrentQuestion(data.question);
                    setQuestionStartTime(Date.now());

                    const weekData = studyPlan.weeks?.find(w => w.weekNumber === activeWeek);
                    const temas = weekData?.topicsData 
                        ? weekData.topicsData.map(t => t.tema).join(', ') 
                        : 'temas recomendados';

                    const welcomeMsg = `¡Excelente elección! 📅 Vamos a continuar con tu plan de estudio para la **Semana ${activeWeek}**.\n\nEn esta semana nos enfocaremos en: **${temas}**.\n\nAquí va tu primer ejercicio de la semana:`;

                    setMessages([{
                        role: 'tutor',
                        content: welcomeMsg,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }, {
                        role: 'tutor',
                        content: `📝 ${data.question.topic || 'Matemáticas'} (Nivel ${data.question.difficulty})\n\n${data.question.content}\n\n¿Por dónde empezarías a resolver este problema?`,
                        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    }]);
                }
            }
        } catch (e) {
            console.error('Error cargando pregunta del plan:', e);
            await loadFirstQuestion();
        }
    };

    // Refrescar datos de progreso
    const refreshProgress = async () => {
        try {
            const res = await fetch('/api/progress');
            if (res.ok) {
                const data = await res.json();
                setProgressData(data);
            }
        } catch (e) {
            console.error('Error refreshing progress:', e);
        }
    };

    const sendMessage = async (overrideMsg = null) => {
        const textToUse = typeof overrideMsg === 'string' ? overrideMsg : input;
        
        if ((!textToUse.trim() && !pendingImage) || loading) return;

        const userMsg = textToUse.trim();
        setInput('');
        setMathComposerValue('');
        setIsMathMode(false);

        const timeSpent = questionStartTime
            ? Math.round((Date.now() - questionStartTime) / 1000)
            : null;

        // Guardar imagen para enviar y limpiar el estado
        const imageToSend = pendingImage;
        setPendingImage(null);

        setMessages(prev => [...prev, {
            role: 'student',
            content: userMsg || '📷 Imagen enviada',
            imagePreview: imageToSend?.preview || null,
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }]);

        setLoading(true);
        if (imageToSend) setIsAnalyzingImage(true);

        try {
            const requestBody = {
                message: userMsg,
                sessionId,
                questionId: currentQuestion?.id,
                timeSpent,
                // Plan de estudio — se envían solo en modo plan
                ...(tutorMode === 'plan' && selectedWeek && studyPlan?.diagnosticId ? {
                    studyPlanWeek: selectedWeek,
                    studyPlanDiagnosticId: studyPlan.diagnosticId,
                } : {}),
            };

            // Agregar imagen si hay una pendiente
            if (imageToSend) {
                requestBody.imageBase64 = imageToSend.base64;
                requestBody.imageMimeType = imageToSend.mimeType;
            }

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody),
            });

            const data = await res.json();

            if (data.error) {
                setMessages(prev => [...prev, {
                    role: 'tutor',
                    content: `⚠️ ${data.error}`,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);
            } else {
                if (data.sessionId) setSessionId(data.sessionId);
                setAttemptNumber(data.attemptNumber || 0);
                setLastEvaluation(data.evaluation);

                // Mensaje del tutor
                setMessages(prev => [...prev, {
                    role: 'tutor',
                    content: data.response,
                    evaluation: data.evaluation,
                    imageAnalysis: data.imageAnalysis || null,
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                }]);

                // Si hay nueva pregunta (el estudiante acertó y se avanza)
                let willAdvanceWeek = false;

                // Actualizar progreso del plan de estudio si se registró un ejercicio correcto
                if (data.adaptive?.studyPlanExerciseDone) {
                    const { weekCompleted, exercisesDone, exercisesGoal } = data.adaptive;
                    if (weekCompleted) {
                        setWeekCompletedToast(selectedWeek);
                        setTimeout(() => setWeekCompletedToast(null), 5000);
                        
                        const nextWeek = selectedWeek + 1;
                        if (nextWeek <= 8) {
                            willAdvanceWeek = true;
                            setTimeout(() => {
                                setMessages(prev => [...prev, {
                                    role: 'tutor',
                                    content: `🎉 ¡Felicidades! Has terminado todos los ejercicios de la Semana ${selectedWeek}. ¡Vamos a comenzar de inmediato con los ejercicios de la Semana ${nextWeek}!`,
                                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                }]);
                                // Iniciar la siguiente semana
                                setTimeout(() => startStudyPlanMode(nextWeek), 2000);
                            }, 2500);
                        } else {
                            setTimeout(() => {
                                setMessages(prev => [...prev, {
                                    role: 'tutor',
                                    content: `🏆 ¡Increíble! Has completado las 8 semanas de tu plan de estudio. ¡Felicidades por alcanzar tu meta!`,
                                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                }]);
                            }, 2500);
                        }

                        // Recargar plan para reflejar el desbloqueo de siguiente semana
                        loadStudyPlan();
                    } else {
                        // Actualizar progreso local sin recargar todo
                        setStudyPlan(prev => {
                            if (!prev?.weeks) return prev;
                            return {
                                ...prev,
                                weeks: prev.weeks.map(w =>
                                    w.weekNumber === selectedWeek
                                        ? { ...w, exercisesDone, exercisesGoal }
                                        : w
                                ),
                            };
                        });
                    }
                }

                if (data.nextQuestion && !willAdvanceWeek) {
                    setCurrentQuestion(data.nextQuestion);
                    setQuestionStartTime(Date.now());
                    setAttemptNumber(0);

                    const levelMsg = data.adaptive?.action === 'INCREASE'
                        ? `\n\n🎉 ¡Subiste al nivel ${data.adaptive.newLevel}!`
                        : data.adaptive?.action === 'DECREASE'
                            ? `\nVamos a reforzar algunos conceptos. Nivel ajustado a ${data.adaptive.newLevel}.`
                            : '';

                    setTimeout(() => {
                        setMessages(prev => [...prev, {
                            role: 'tutor',
                            content: `¡Excelente trabajo! 🌟${levelMsg}\n\nAquí va tu siguiente ejercicio:\n\n📝 ${data.nextQuestion.topic || 'Matemáticas'} (Nivel ${data.nextQuestion.difficulty})\n\n${data.nextQuestion.content}\n\n¿Cómo abordarías este problema?`,
                            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                        }]);
                    }, 1500);

                    // Refrescar progreso tras acertar
                    refreshProgress();
                }
            }
        } catch (e) {
            console.error(e);
            setMessages(prev => [...prev, {
                role: 'tutor',
                content: '⚠️ Error de conexión. Por favor intenta de nuevo.',
                time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            }]);
        } finally {
            setLoading(false);
            setIsAnalyzingImage(false);
        }
    };

    // Callbacks para SpeechToText
    const handleVoiceTranscript = useCallback((text) => {
        setInput(prev => prev ? `${prev} ${text}` : text);
    }, []);

    const handleVoiceInterim = useCallback((text) => {
        // Mostrar resultado parcial en el textarea
        setInput(text);
    }, []);

    // Callbacks para ImageUpload
    const handleImageSelect = useCallback((imageData) => {
        setPendingImage(imageData);
    }, []);

    const handleClearImage = useCallback(() => {
        setPendingImage(null);
    }, []);

    // Callback para analizar la pizarra → se envía como imagen al chat
    const handleWhiteboardAnalyze = useCallback((imageData) => {
        setPendingImage(imageData);
        setWhiteboardAnalyzing(true);
        // Auto-enviar con mensaje descriptivo
        setTimeout(() => {
            setInput('Analiza mi trabajo en la pizarra y dame retroalimentación');
            // Trigger send after state update
            setTimeout(() => {
                document.getElementById('chat-send')?.click();
                setWhiteboardAnalyzing(false);
            }, 100);
        }, 50);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    if (status === 'loading' || isRestoring) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">{isRestoring ? 'Restaurando tu progreso...' : 'Preparando tu sesión...'}</p>
            </div>
        );
    }

    return (
        <div className="app-container">
            <nav className="navbar">
                <Link href="/dashboard" className="navbar-brand">
                    <div className="navbar-logo">YT</div>
                    <span className="navbar-title">YedaTech</span>
                </Link>
                <div className="navbar-nav">
                    <Link href="/dashboard" className="nav-link">Dashboard</Link>
                    <Link href="/pruebas-estado" className="nav-link">Pruebas de Estado</Link>
                    <Link href="/tutor" className="nav-link active">Tutor</Link>
                    <Link href="/diagnostic" className="nav-link">Diagnóstico</Link>
                    <Link href="/analytics" className="nav-link">Analítica</Link>
                </div>
                <div className="nav-user">
                    <div className="nav-user-info">
                        <div className="nav-user-name">{session?.user?.name}</div>
                        <div className="nav-user-level">
                            {session?.user?.schoolGrade ? `Grado ${session.user.schoolGrade}° • ` : ''}Nivel {session?.user?.currentLevel || 1}
                        </div>
                    </div>
                </div>
            </nav>

            {!hasSelectedMode ? (
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', background: 'var(--bg-primary)' }}>
                    <h1 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '0.5rem', textAlign: 'center' }}>¿Qué quieres hacer hoy?</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem', textAlign: 'center', maxWidth: '500px' }}>
                        Elige tu modalidad de estudio. Puedes alternar entre ambas en cualquier momento usando la barra superior.
                    </p>

                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                        {/* Tarjeta Práctica Libre */}
                        <button
                            onClick={startFreePracticeMode}
                            style={{
                                background: 'var(--bg-card)', border: '2px solid var(--border-color)', borderRadius: '16px',
                                padding: '2rem', width: '280px', cursor: 'pointer', transition: 'all 0.3s',
                                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem',
                                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
                            }}
                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--accent-primary)'}
                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
                        >
                            <div style={{ fontSize: '2.5rem' }}>🎯</div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0' }}>Práctica Libre</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.4 }}>
                                    Haz preguntas sueltas, explora temas o pide ayuda con un problema específico sin un plan.
                                </p>
                            </div>
                        </button>

                        {/* Tarjeta Plan de Estudio */}
                        <button
                            onClick={() => startStudyPlanMode(null)}
                            style={{
                                background: 'linear-gradient(145deg, rgba(99,102,241,0.05), rgba(139,92,246,0.05))',
                                border: '2px solid rgba(99,102,241,0.3)', borderRadius: '16px',
                                padding: '2rem', width: '280px', cursor: 'pointer', transition: 'all 0.3s',
                                textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '1rem',
                                boxShadow: '0 4px 15px rgba(99,102,241,0.1)'
                            }}
                            onMouseOver={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.8)'}
                            onMouseOut={e => e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'}
                        >
                            <div style={{ fontSize: '2.5rem' }}>📅</div>
                            <div>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 0.5rem 0', color: '#6366f1' }}>Plan de Estudio</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0, lineHeight: 1.4 }}>
                                    Sigue tu recorrido de 8 semanas diseñado por tu diagnóstico. El tutor te guiará.
                                </p>
                            </div>
                            {studyPlan?.hasPlan && (
                                <div style={{ marginTop: 'auto', background: 'rgba(99,102,241,0.1)', padding: '0.5rem 0.8rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, color: '#6366f1' }}>
                                    Semana sugerida: {studyPlan.activeWeek || 1}
                                </div>
                            )}
                        </button>
                    </div>
                </div>
            ) : (
            <>
            {/* ═══════════════════════════════════════════════════════
                BARRA DE MODO: Práctica Libre vs Plan de Estudio
                Siempre visible para que el estudiante pueda elegir
            ═══════════════════════════════════════════════════════ */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.5rem 1.25rem',
                background: 'var(--bg-card)',
                borderBottom: '1px solid var(--border-color)',
                flexWrap: 'wrap',
            }}>
                    {/* Selector de modo */}
                    <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--bg-input)', borderRadius: '10px', padding: '3px' }}>
                        <button
                            onClick={() => { setTutorMode('free'); setShowWeekPanel(false); }}
                            style={{
                                padding: '5px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s',
                                background: tutorMode === 'free' ? 'var(--accent-primary)' : 'transparent',
                                color: tutorMode === 'free' ? '#fff' : 'var(--text-secondary)',
                            }}
                        >
                            🎯 Práctica Libre
                        </button>
                        <button
                            onClick={() => { setTutorMode('plan'); setShowWeekPanel(true); }}
                            style={{
                                padding: '5px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                                fontWeight: 600, fontSize: '0.8rem', transition: 'all 0.2s',
                                background: tutorMode === 'plan' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'transparent',
                                color: tutorMode === 'plan' ? '#fff' : 'var(--text-secondary)',
                            }}
                        >
                            📅 Plan de Estudio
                        </button>
                    </div>

                    {/* Info de semana activa cuando está en modo plan */}
                    {tutorMode === 'plan' && selectedWeek && studyPlan?.weeks && (
                        <>
                            <div style={{ height: '18px', width: '1px', background: 'var(--border-color)' }} />
                            <button
                                onClick={() => setShowWeekPanel(v => !v)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                                    padding: '4px 12px', borderRadius: '20px', border: '1px solid rgba(99,102,241,0.3)',
                                    background: 'rgba(99,102,241,0.08)', color: '#818cf8',
                                    cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem',
                                }}
                            >
                                {(() => {
                                    const w = studyPlan.weeks?.find(w => w.weekNumber === selectedWeek);
                                    return w ? `Semana ${selectedWeek} — ${w.topics?.[0]?.tema || 'Repaso'}` : `Semana ${selectedWeek}`;
                                })()}
                                <span style={{ fontSize: '0.65rem' }}>{showWeekPanel ? '▲' : '▼'}</span>
                            </button>

                            {/* Barra de progreso de la semana */}
                            {(() => {
                                const w = studyPlan.weeks?.find(w => w.weekNumber === selectedWeek);
                                if (!w) return null;
                                const pct = Math.min(100, Math.round((w.exercisesDone / w.exercisesGoal) * 100));
                                return (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ width: '80px', height: '6px', borderRadius: '3px', background: 'var(--bg-input)', overflow: 'hidden' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '3px', transition: 'width 0.4s' }} />
                                        </div>
                                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            {w.exercisesDone}/{w.exercisesGoal} ej.
                                        </span>
                                    </div>
                                );
                            })()}
                        </>
                    )}

                    {/* Progreso global */}
                    {studyPlan?.hasPlan && (
                        <div style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {studyPlan.totalCompleted || 0}/8 semanas • {studyPlan.overallProgress || 0}% completado
                        </div>
                    )}
                </div>

            {/* ═══════════════════════════════════════════════════════
                PANEL DE SEMANAS (drawer horizontal)
            ═══════════════════════════════════════════════════════ */}
            {tutorMode === 'plan' && showWeekPanel && studyPlan?.hasPlan && (
                <div style={{
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border-color)',
                    padding: '1rem 1.25rem',
                    overflowX: 'auto',
                }}>
                    {/* Plan general */}
                    {studyPlan.planDeEstudio?.resumen && (
                        <div style={{
                            marginBottom: '0.75rem', padding: '0.6rem 0.9rem',
                            borderRadius: '10px', background: 'rgba(99,102,241,0.07)',
                            border: '1px solid rgba(99,102,241,0.15)',
                            fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5,
                        }}>
                            <span style={{ fontWeight: 700, color: '#818cf8' }}>🎯 Meta: </span>
                            {studyPlan.planDeEstudio.metaPrincipal || studyPlan.planDeEstudio.resumen}
                        </div>
                    )}

                    {/* Carrusel de semanas */}
                    <div style={{ display: 'flex', gap: '0.6rem', overflowX: 'auto', paddingBottom: '6px' }}>
                        {studyPlan.weeks?.map(week => {
                            const isSelected = selectedWeek === week.weekNumber;
                            const isLocked = !week.isUnlocked;
                            const isDone = week.isCompleted;
                            const pct = Math.min(100, Math.round((week.exercisesDone / week.exercisesGoal) * 100));

                            const cardBg = isSelected
                                ? 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))'
                                : isDone
                                ? 'rgba(16,185,129,0.07)'
                                : isLocked
                                ? 'var(--bg-input)'
                                : 'var(--bg-card)';

                            const borderColor = isSelected
                                ? 'rgba(99,102,241,0.6)'
                                : isDone
                                ? 'rgba(16,185,129,0.3)'
                                : isLocked
                                ? 'var(--border-color)'
                                : 'rgba(99,102,241,0.2)';

                            return (
                                <button
                                    key={week.weekNumber}
                                    disabled={isLocked}
                                    onClick={() => { if (!isLocked) { setSelectedWeek(week.weekNumber); } }}
                                    style={{
                                        minWidth: '160px', maxWidth: '180px',
                                        padding: '0.7rem 0.85rem',
                                        borderRadius: '12px',
                                        border: `1.5px solid ${borderColor}`,
                                        background: cardBg,
                                        cursor: isLocked ? 'not-allowed' : 'pointer',
                                        opacity: isLocked ? 0.55 : 1,
                                        textAlign: 'left',
                                        transition: 'all 0.2s',
                                        flexShrink: 0,
                                        display: 'flex', flexDirection: 'column', gap: '0.35rem',
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isSelected ? '#818cf8' : isDone ? '#10b981' : 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                            Semana {week.weekNumber}
                                        </span>
                                        <span style={{ fontSize: '0.9rem' }}>
                                            {isDone ? '✅' : isLocked ? '🔒' : isSelected ? '📖' : '🔓'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>
                                        {week.topics?.[0]?.tema || 'Repaso'}
                                        {week.topics?.length > 1 && <span style={{ color: 'var(--text-muted)' }}> +{week.topics.length - 1}</span>}
                                    </div>
                                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                                        {week.duracionEstimada}
                                    </div>
                                    {/* Mini barra de progreso */}
                                    {!isLocked && (
                                        <div style={{ height: '3px', borderRadius: '2px', background: 'var(--bg-input)', overflow: 'hidden', marginTop: '2px' }}>
                                            <div style={{ height: '100%', width: `${pct}%`, background: isDone ? '#10b981' : 'linear-gradient(90deg,#6366f1,#8b5cf6)', borderRadius: '2px', transition: 'width 0.4s' }} />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Detalle de la semana seleccionada */}
                    {selectedWeek && (() => {
                        const w = studyPlan.weeks?.find(w => w.weekNumber === selectedWeek);
                        if (!w || !w.isUnlocked) return null;
                        return (
                            <div style={{ marginTop: '0.75rem', padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.82rem', color: '#818cf8', marginBottom: '0.4rem' }}>
                                    📋 Temas de esta semana
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
                                    {w.topics?.map((t, i) => (
                                        <span key={i} style={{
                                            padding: '2px 10px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600,
                                            background: t.prioridad === 'alta' ? 'rgba(239,68,68,0.1)' : t.prioridad === 'media' ? 'rgba(245,158,11,0.1)' : 'rgba(16,185,129,0.1)',
                                            color: t.prioridad === 'alta' ? '#ef4444' : t.prioridad === 'media' ? '#f59e0b' : '#10b981',
                                            border: `1px solid ${t.prioridad === 'alta' ? 'rgba(239,68,68,0.25)' : t.prioridad === 'media' ? 'rgba(245,158,11,0.25)' : 'rgba(16,185,129,0.25)'}`,
                                        }}>
                                            {t.tema}
                                        </span>
                                    ))}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                    <span style={{ fontWeight: 600 }}>Meta:</span> {w.metaSemana}
                                </div>
                                {w.ejercicios?.length > 0 && (
                                    <div style={{ marginTop: '0.4rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                        <span style={{ fontWeight: 600 }}>Ejercicios sugeridos:</span>{' '}
                                        {w.ejercicios.slice(0, 2).map((ej, i) => (
                                            <span key={i} style={{ display: 'block', marginTop: '2px' }}>• {ej.enunciado}</span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Toast: semana completada */}
            {weekCompletedToast && (
                <div style={{
                    position: 'fixed', top: '80px', right: '1.5rem', zIndex: 9999,
                    padding: '1rem 1.5rem', borderRadius: '14px',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff', fontWeight: 700, fontSize: '0.9rem',
                    boxShadow: '0 8px 30px rgba(16,185,129,0.4)',
                    animation: 'fadeInDown 0.4s ease',
                }}>
                    🎉 ¡Semana {weekCompletedToast} completada!{weekCompletedToast < 8 ? ` Se desbloqueó la Semana ${weekCompletedToast + 1}` : ' ¡Has completado el plan!'}
                </div>
            )}

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Panel de progreso lateral */}
                <div className={`progress-sidebar ${showProgress ? 'progress-sidebar-open' : ''}`}>
                    <div className="progress-sidebar-header">
                        <h3>📊 Mi Progreso</h3>
                        <button className="progress-sidebar-close" onClick={() => setShowProgress(false)}>✕</button>
                    </div>

                    {progressData && (
                        <div className="progress-sidebar-content">
                            {/* Estadísticas principales */}
                            <div className="progress-stats-grid">
                                <div className="progress-stat-card">
                                    <div className="progress-stat-value">{progressData.stats.accuracy}%</div>
                                    <div className="progress-stat-label">Precisión</div>
                                </div>
                                <div className="progress-stat-card">
                                    <div className="progress-stat-value">{progressData.stats.totalCorrect}</div>
                                    <div className="progress-stat-label">Correctas</div>
                                </div>
                                <div className="progress-stat-card">
                                    <div className="progress-stat-value">{progressData.stats.totalQuestions}</div>
                                    <div className="progress-stat-label">Total</div>
                                </div>
                                <div className="progress-stat-card">
                                    <div className="progress-stat-value">{progressData.user?.currentLevel || 1}</div>
                                    <div className="progress-stat-label">Nivel</div>
                                </div>
                            </div>

                            {/* Dominio por temas */}
                            {progressData.topicMasteries.length > 0 && (
                                <div className="progress-section">
                                    <h4>Dominio por Tema</h4>
                                    <div className="progress-topics-list">
                                        {progressData.topicMasteries.map((tm, i) => (
                                            <div key={i} className="progress-topic-item">
                                                <div className="progress-topic-header">
                                                    <span className="progress-topic-name">
                                                        {tm.isMastered ? '✅' : tm.masteryLevel >= 0.5 ? '📈' : '📉'} {tm.topicName}
                                                    </span>
                                                    <span className="progress-topic-pct">{Math.round(tm.masteryLevel * 100)}%</span>
                                                </div>
                                                <div className="progress-bar-track">
                                                    <div
                                                        className={`progress-bar-fill ${tm.isMastered ? 'progress-bar-mastered' : tm.masteryLevel >= 0.5 ? 'progress-bar-medium' : 'progress-bar-weak'}`}
                                                        style={{ width: `${Math.round(tm.masteryLevel * 100)}%` }}
                                                    />
                                                </div>
                                                <div className="progress-topic-detail">
                                                    {tm.questionsCorrect}/{tm.questionsTotal} correctas
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Temas débiles y fuertes */}
                            {progressData.profile && (
                                <div className="progress-section">
                                    {progressData.profile.weakTopics.length > 0 && (
                                        <div className="progress-tag-group">
                                            <h4>🔴 Necesitan Refuerzo</h4>
                                            <div className="progress-tags">
                                                {progressData.profile.weakTopics.map((t, i) => (
                                                    <span key={i} className="progress-tag progress-tag-weak">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {progressData.profile.strongTopics.length > 0 && (
                                        <div className="progress-tag-group">
                                            <h4>🟢 Dominados</h4>
                                            <div className="progress-tags">
                                                {progressData.profile.strongTopics.map((t, i) => (
                                                    <span key={i} className="progress-tag progress-tag-strong">{t}</span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Último resumen de sesión */}
                            {progressData.profile?.lastSessionSummary && (
                                <div className="progress-section">
                                    <h4>📝 Última Sesión</h4>
                                    <p className="progress-summary-text">{progressData.profile.lastSessionSummary}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Chat principal */}
                <div className="chat-container" style={{ flex: 1 }}>
                    <div className="chat-header" style={{ background: 'linear-gradient(180deg, rgba(255,105,0,0.04), transparent)' }}>
                        <div className="chat-header-info">
                            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ display: 'inline-flex', width: 28, height: 28, borderRadius: '50%', background: 'var(--gradient-primary)', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800, color: '#fff' }}>YT</span>
                                Tutor Socrático
                            </h2>
                            <p>Te guío con preguntas, tú descubres las respuestas ✨</p>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <button
                                className="progress-toggle-btn"
                                onClick={() => { setShowProgress(!showProgress); if (!showProgress) refreshProgress(); }}
                                title="Ver progreso"
                            >
                                📊 Progreso
                            </button>
                            {attemptNumber > 0 && (
                                <span className="chat-header-badge" style={{ background: 'rgba(99,102,241,0.12)', borderColor: 'rgba(99,102,241,0.25)', color: '#818cf8' }}>
                                    🔄 Intento {attemptNumber}
                                </span>
                            )}
                            {session?.user?.schoolGrade && (
                                <span className="chat-header-badge" style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.25)', color: '#a78bfa' }}>
                                    🏫 Grado {session.user.schoolGrade}°
                                </span>
                            )}
                            <span className="chat-header-badge">
                                📊 Nivel {session?.user?.currentLevel || 1}
                            </span>
                        </div>
                    </div>

                    <div className="chat-messages">
                        {messages.map((msg, i) => (
                            <div key={i} className={`message message-${msg.role}`}>
                                {msg.role === 'tutor' ? (
                                    <div className="message-tutor-avatar">
                                        <div className="avatar-icon">YT</div>
                                        <div>
                                            <div className="message-bubble">
                                                <MathText text={msg.content} />
                                            </div>

                                            {/* Retroalimentación de análisis de imagen */}
                                            {msg.imageAnalysis?.evaluacion && (
                                                <ImageFeedbackCard analysis={msg.imageAnalysis} />
                                            )}

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                                                {msg.evaluation && (
                                                    <div className={`eval-badge ${msg.evaluation.correcto ? 'eval-correct' : 'eval-incorrect'}`}>
                                                        {msg.evaluation.correcto ? '✓ Correcto' : `✗ ${msg.evaluation.tipo_error || 'Incorrecto'}`}
                                                    </div>
                                                )}
                                                <TextToSpeech text={msg.content} />
                                            </div>
                                            <div className="message-time">{msg.time}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div>
                                        {msg.imagePreview && (
                                            <div className="message-image-container">
                                                <img
                                                    src={msg.imagePreview}
                                                    alt="Imagen enviada"
                                                    className="message-image"
                                                    onClick={() => window.open(msg.imagePreview, '_blank')}
                                                />
                                            </div>
                                        )}
                                        <div className="message-bubble"><MathText text={msg.content} /></div>
                                        <div className="message-time">{msg.time}</div>
                                    </div>
                                )}
                            </div>
                        ))}

                        {loading && (
                            <div className="typing-indicator">
                                {isAnalyzingImage && (
                                    <span className="typing-label">📸 Analizando imagen...</span>
                                )}
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                                <div className="typing-dot"></div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="chat-input-area" style={{ paddingBottom: isMathMode ? '320px' : undefined, transition: 'padding 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }}>
                        {currentQuestion && (
                            <div className="chat-question-card">
                                <div className="chat-question-label">Ejercicio actual</div>
                                <div><MathText text={currentQuestion.content} /></div>
                            </div>
                        )}

                        <ImageUpload
                            onImageSelect={handleImageSelect}
                            pendingImage={pendingImage}
                            onClearImage={handleClearImage}
                            disabled={loading}
                        />

                        <div className="chat-input-wrapper" style={{ flexDirection: 'column', gap: '0' }}>
                            {/* Live Preview del mensaje actual si tiene ecuaciones o markdown */}
                            {input.trim() && (input.includes('$$') || input.includes('^') || input.includes('\\') || input.includes('_')) && !isMathMode && (
                                <div className="chat-live-preview" style={{ padding: '8px 12px', fontSize: '0.9rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', borderRadius: '8px', marginBottom: '8px', alignSelf: 'stretch', border: '1px solid var(--border-color)' }}>
                                    <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px', opacity: 0.7 }}>Vista previa del mensaje</div>
                                    <MathText text={input} />
                                </div>
                            )}

                            {/* Panel de Inserción Matemática */}
                            {isMathMode && (
                                <div className="math-composer-panel" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '8px', border: '1px solid var(--border-color)', alignSelf: 'stretch' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Crea tu ecuación matemática:</div>
                                    <MathEditor
                                        className="chat-input math-input-mode"
                                        value={mathComposerValue}
                                        onChange={(latex) => setMathComposerValue(latex)}
                                        onEnter={() => {
                                            if(mathComposerValue) {
                                                const finalMsg = input.trim() ? `${input} $$${mathComposerValue}$$` : `$$${mathComposerValue}$$`;
                                                sendMessage(finalMsg);
                                            } else if (input.trim() || pendingImage) {
                                                sendMessage(input);
                                            }
                                        }}
                                        disabled={loading}
                                        placeholder="Toca aquí para abrir el teclado virtual..."
                                    />
                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', marginTop: '4px' }}>
                                        <button className="secondary-btn" onClick={() => {
                                            setIsMathMode(false);
                                            if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                                            document.getElementById('chat-input')?.focus();
                                        }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                            Cerrar Panel
                                        </button>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button className="secondary-btn" onClick={() => {
                                                if(mathComposerValue) {
                                                    setInput(prev => prev + (prev.endsWith(' ') ? '' : ' ') + `$$${mathComposerValue}$$ `);
                                                    setMathComposerValue('');
                                                }
                                                document.getElementById('chat-input')?.focus();
                                            }} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer' }}>
                                                Añadir y seguir escribiendo
                                            </button>
                                            <button className="primary-btn" onClick={() => {
                                                if(mathComposerValue) {
                                                    const finalMsg = input.trim() ? `${input} $$${mathComposerValue}$$` : `$$${mathComposerValue}$$`;
                                                    sendMessage(finalMsg);
                                                } else if (input.trim() || pendingImage) {
                                                    sendMessage(input);
                                                }
                                            }} style={{ padding: '6px 12px', borderRadius: '6px', background: 'var(--accent-primary)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                                                Enviar al Tutor ➤
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', alignItems: 'flex-end', width: '100%', gap: '8px' }}>
                                <SpeechToText
                                    onTranscript={handleVoiceTranscript}
                                    onInterimResult={handleVoiceInterim}
                                    disabled={loading}
                                />
                                <button
                                    className={`chat-tool-btn ${isMathMode ? 'active' : ''}`}
                                    onClick={() => { 
                                        const newMode = !isMathMode;
                                        setIsMathMode(newMode); 
                                        if(!newMode) {
                                            setMathComposerValue('');
                                            if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                                        }
                                    }}
                                    title="Añadir Ecuación"
                                    style={{ background: isMathMode ? 'var(--primary-color)' : 'transparent', color: isMathMode ? 'white' : 'inherit', border: 'none', borderRadius: '4px', padding: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40px' }}
                                >
                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></svg>
                                </button>
                                <textarea
                                    className="chat-input"
                                    placeholder={pendingImage ? 'Agrega un mensaje sobre la imagen (opcional)...' : 'Escribe tu respuesta o pregunta normal...'}
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    onFocus={() => {
                                        if (window.mathVirtualKeyboard) window.mathVirtualKeyboard.hide();
                                    }}
                                    rows={1}
                                    id="chat-input"
                                    style={{ flex: 1, minHeight: '40px', padding: '10px 12px' }}
                                />
                                <button
                                    className="chat-send-btn"
                                    onClick={sendMessage}
                                    disabled={(!input.trim() && !pendingImage) || loading}
                                    id="chat-send"
                                    title="Enviar"
                                >
                                    ➤
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <ScientificCalculator />
            <GraphingCalculator />
            <Whiteboard onAnalyze={handleWhiteboardAnalyze} analyzing={whiteboardAnalyzing || isAnalyzingImage} />
            </>
            )}
        </div>
    );
}

/**
 * Componente que muestra la retroalimentación visual del análisis de imagen.
 * Muestra pasos analizados con ✅/❌, errores, y sugerencias.
 */
function ImageFeedbackCard({ analysis }) {
    const [expanded, setExpanded] = useState(false);
    const eval_ = analysis.evaluacion;
    if (!eval_) return null;

    const totalPasos = eval_.pasos_analizados?.length || 0;
    const correctos = eval_.pasos_analizados?.filter(p => p.correcto).length || 0;
    const incorrectos = totalPasos - correctos;

    return (
        <div className={`img-feedback-card ${eval_.es_correcto ? 'img-feedback-correct' : 'img-feedback-incorrect'}`}>
            {/* Header */}
            <div className="img-feedback-header" onClick={() => setExpanded(!expanded)}>
                <div className="img-feedback-verdict">
                    <span className="img-feedback-icon">
                        {eval_.es_correcto ? '✅' : '❌'}
                    </span>
                    <div>
                        <div className="img-feedback-title">
                            {eval_.es_correcto ? '¡Solución Correcta!' : 'Solución con Errores'}
                        </div>
                        <div className="img-feedback-subtitle">
                            {correctos}/{totalPasos} pasos correctos
                            {analysis.tema_detectado && ` • ${analysis.tema_detectado}`}
                        </div>
                    </div>
                </div>
                <span className={`img-feedback-chevron ${expanded ? 'img-feedback-chevron-open' : ''}`}>▾</span>
            </div>

            {/* Veredicto siempre visible */}
            <div className="img-feedback-veredicto">
                <MathText text={eval_.veredicto} />
            </div>

            {/* Expanded details */}
            {expanded && (
                <div className="img-feedback-details">
                    {/* Pasos analizados */}
                    {eval_.pasos_analizados?.length > 0 && (
                        <div className="img-feedback-steps">
                            <div className="img-feedback-section-title">📋 Análisis paso a paso</div>
                            {eval_.pasos_analizados.map((paso, i) => (
                                <div key={i} className={`img-feedback-step ${paso.correcto ? 'img-step-ok' : 'img-step-error'}`}>
                                    <div className="img-step-header">
                                        <span className="img-step-icon">{paso.correcto ? '✅' : '❌'}</span>
                                        <span className="img-step-num">Paso {paso.numero}</span>
                                        {paso.tipo_error && (
                                            <span className="img-step-error-badge">{paso.tipo_error}</span>
                                        )}
                                    </div>
                                    <div className="img-step-desc">
                                        <MathText text={paso.descripcion} />
                                    </div>
                                    {paso.expresion && (
                                        <div className="img-step-expr">
                                            <MathText text={paso.expresion} />
                                        </div>
                                    )}
                                    {paso.error && (
                                        <div className="img-step-error-detail">
                                            <span className="img-step-error-label">Error:</span> <MathText text={paso.error} />
                                        </div>
                                    )}
                                    {paso.correccion && (
                                        <div className="img-step-correction">
                                            <span className="img-step-correction-label">✏️ Corrección:</span> <MathText text={paso.correccion} />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Sugerencias */}
                    {eval_.sugerencias?.length > 0 && (
                        <div className="img-feedback-suggestions">
                            <div className="img-feedback-section-title">💡 Sugerencias</div>
                            {eval_.sugerencias.map((s, i) => (
                                <div key={i} className="img-suggestion-item">
                                    <MathText text={s} />
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pregunta guía socrática */}
                    {eval_.pregunta_guia && (
                        <div className="img-feedback-guide-question">
                            <span className="img-guide-icon">🤔</span>
                            <MathText text={eval_.pregunta_guia} />
                        </div>
                    )}

                    {/* Respuestas */}
                    {(eval_.respuesta_estudiante || eval_.respuesta_correcta) && (
                        <div className="img-feedback-answers">
                            {eval_.respuesta_estudiante && (
                                <div className="img-answer-row">
                                    <span className="img-answer-label">Tu respuesta:</span>
                                    <span className="img-answer-value"><MathText text={eval_.respuesta_estudiante} /></span>
                                </div>
                            )}
                            {eval_.respuesta_correcta && !eval_.es_correcto && (
                                <div className="img-answer-row img-answer-correct">
                                    <span className="img-answer-label">Respuesta correcta:</span>
                                    <span className="img-answer-value"><MathText text={eval_.respuesta_correcta} /></span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
