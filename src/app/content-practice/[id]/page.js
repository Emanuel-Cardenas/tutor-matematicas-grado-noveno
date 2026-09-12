'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { GaugeChart, DonutChart, BarChart, RadarChart, ProgressRing } from '@/components/Charts';
import MathText from '@/components/MathText';

export default function ContentPracticePage() {
    const { id } = useParams();
    const router = useRouter();
    const [phase, setPhase] = useState('loading'); // loading, intro, exam, submitting, results
    const [content, setContent] = useState(null);
    const [questions, setQuestions] = useState([]);
    const [previousAttempts, setPreviousAttempts] = useState([]);
    const [currentQ, setCurrentQ] = useState(0);
    const [answers, setAnswers] = useState({});
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    const [timings, setTimings] = useState([]);
    
    // Timer acumulativo
    const timerRef = useRef(null);
    const lastTickRef = useRef(null);
    const currentQElapsedRef = useRef(0);
    const totalElapsedRef = useRef(0);

    const getStorageKey = useCallback(() => {
        return `yedatech_practice_state_${id}`;
    }, [id]);

    useEffect(() => {
        if (phase === 'exam') {
            lastTickRef.current = Date.now();
            timerRef.current = setInterval(() => {
                const now = Date.now();
                const delta = now - (lastTickRef.current || now);
                lastTickRef.current = now;
                currentQElapsedRef.current += delta;
                totalElapsedRef.current += delta;
            }, 100);
        } else {
            lastTickRef.current = null;
        }
        return () => clearInterval(timerRef.current);
    }, [phase]);

    useEffect(() => {
        if (phase === 'exam' && questions.length > 0) {
            const key = getStorageKey();
            if (key) {
                localStorage.setItem(key, JSON.stringify({
                    phase,
                    questions,
                    currentQ,
                    answers,
                    timings,
                    totalElapsed: totalElapsedRef.current,
                    currentQElapsed: currentQElapsedRef.current
                }));
            }
        }
    }, [phase, questions, currentQ, answers, timings, getStorageKey]);

    useEffect(() => {
        fetchContent();
    }, [id]);

    const fetchContent = async () => {
        try {
            const res = await fetch(`/api/teacher/content/${id}/practice`);
            if (!res.ok) {
                const data = await res.json();
                setError(data.error || 'Error');
                setPhase('error');
                return;
            }
            const data = await res.json();
            setContent(data.content);
            setQuestions(data.questions);
            setPreviousAttempts(data.previousAttempts || []);

            const key = getStorageKey();
            const saved = key ? localStorage.getItem(key) : null;
            if (saved) {
                try {
                    const parsed = JSON.parse(saved);
                    if (parsed.phase === 'exam' && parsed.questions?.length > 0) {
                        setQuestions(parsed.questions);
                        setCurrentQ(parsed.currentQ || 0);
                        setAnswers(parsed.answers || {});
                        setTimings(parsed.timings || []);
                        
                        currentQElapsedRef.current = parsed.currentQElapsed || 0;
                        totalElapsedRef.current = parsed.totalElapsed || 0;
                        
                        setPhase('exam');
                        return; // Evita sobreescribir la fase a 'intro'
                    }
                } catch (e) {
                     console.error('Error restaurando progreso:', e);
                }
            }

            setPhase('intro');
        } catch {
            setError('Error de conexión');
            setPhase('error');
        }
    };

    const startExam = () => {
        setPhase('exam');
        currentQElapsedRef.current = 0;
        totalElapsedRef.current = 0;
        setTimings(new Array(questions.length).fill(0));
    };

    const selectAnswer = (questionId, option) => {
        setAnswers(prev => ({ ...prev, [questionId]: option }));
    };

    const recordTime = (index) => {
        setTimings(prev => {
            const next = [...prev];
            next[index] = (next[index] || 0) + currentQElapsedRef.current;
            return next;
        });
        currentQElapsedRef.current = 0;
    };

    const nextQuestion = () => {
        recordTime(currentQ);
        if (currentQ < questions.length - 1) {
            setCurrentQ(prev => prev + 1);
        }
    };

    const prevQuestion = () => {
        recordTime(currentQ);
        if (currentQ > 0) setCurrentQ(prev => prev - 1);
    };

    const handleJumpTo = (i) => {
        recordTime(currentQ);
        setCurrentQ(i);
    };

    const submitExam = async () => {
        recordTime(currentQ);

        setPhase('submitting');
        try {
            const res = await fetch(`/api/teacher/content/${id}/practice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    answers,
                    timings,
                    totalTimeMs: totalElapsedRef.current,
                }),
            });
            const data = await res.json();
            if (data.success) {
                const key = getStorageKey();
                if (key) localStorage.removeItem(key);

                setResults(data);
                setPhase('results');
            } else {
                setError(data.error || 'Error al enviar');
                setPhase('exam');
            }
        } catch {
            setError('Error de conexión');
            setPhase('exam');
        }
    };

    // FASE: Loading
    if (phase === 'loading') {
        return (
            <div className="app-container" style={{ textAlign: 'center', padding: '4rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
                <p>Cargando contenido...</p>
            </div>
        );
    }

    // FASE: Error
    if (phase === 'error') {
        return (
            <div className="app-container" style={{ textAlign: 'center', padding: '4rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>❌</div>
                <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
                <Link href="/dashboard" className="btn btn-primary">Volver al Dashboard</Link>
            </div>
        );
    }

    // FASE: Intro
    if (phase === 'intro') {
        return (
            <div className="app-container" style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
                <Link href="/dashboard" style={{ color: 'var(--primary)', fontSize: '0.85rem', textDecoration: 'none' }}>← Dashboard</Link>
                <div className="card" style={{ padding: '2.5rem', marginTop: '1rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>📚</div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.5rem' }}>{content.title}</h1>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>Tema: {content.topic} • Grado {content.schoolGrade}°</p>
                    {content.description && <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>{content.description}</p>}

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', margin: '1.5rem 0' }}>
                        <div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--primary)' }}>{questions.length}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Preguntas</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#3b82f6' }}>{previousAttempts.length}</div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Intentos Previos</div>
                        </div>
                        {previousAttempts.length > 0 && (
                            <div>
                                <div style={{ fontSize: '1.8rem', fontWeight: 700, color: '#22c55e' }}>
                                    {Math.max(...previousAttempts.map(a => a.percentage))}%
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Mejor Score</div>
                            </div>
                        )}
                    </div>

                    {previousAttempts.length > 0 && (
                        <div style={{ margin: '1rem 0', padding: '1rem', background: 'rgba(59,130,246,0.08)', borderRadius: 12 }}>
                            <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>📊 Historial de Intentos</h4>
                            {previousAttempts.slice(0, 5).map((a, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', padding: '0.3rem 0', borderBottom: '1px solid var(--border)' }}>
                                    <span>Intento #{a.attemptNumber}</span>
                                    <span style={{ color: a.percentage >= 60 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                        {a.score}/{a.totalQuestions} ({Math.round(a.percentage)}%)
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}

                    <button className="btn btn-primary btn-lg" onClick={startExam} style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}>
                        🚀 {previousAttempts.length > 0 ? 'Intentar de Nuevo' : 'Comenzar Evaluación'}
                    </button>
                </div>
            </div>
        );
    }

    // FASE: Examen
    if (phase === 'exam' || phase === 'submitting') {
        const q = questions[currentQ];
        const answered = Object.keys(answers).length;
        const progress = ((currentQ + 1) / questions.length) * 100;

        return (
            <div className="app-container" style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
                {/* Progress bar */}
                <div style={{ background: 'var(--border)', borderRadius: 10, height: 6, marginBottom: '1.5rem', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', background: 'var(--primary)', borderRadius: 10, transition: 'width 0.3s' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    <span>📚 {content.title}</span>
                    <span>{currentQ + 1} / {questions.length} • {answered} respondidas</span>
                </div>

                <div className="card" style={{ padding: '2rem' }}>
                    {q.difficulty && (
                        <span style={{
                            fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: 10, marginBottom: '0.75rem', display: 'inline-block',
                            background: q.difficulty === 'facil' ? '#22c55e33' : q.difficulty === 'dificil' ? '#ef444433' : '#f59e0b33',
                            color: q.difficulty === 'facil' ? '#22c55e' : q.difficulty === 'dificil' ? '#ef4444' : '#f59e0b',
                        }}>
                            {q.difficulty}
                        </span>
                    )}
                    <h2 style={{ fontSize: '1.15rem', lineHeight: 1.6, marginBottom: '1.5rem' }}><MathText text={q.text} /></h2>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {Object.entries(q.options).map(([key, val]) => (
                            <button key={key} onClick={() => selectAnswer(q.id, key)}
                                style={{
                                    padding: '1rem 1.25rem', borderRadius: 12, textAlign: 'left', cursor: 'pointer', fontSize: '0.95rem',
                                    border: answers[q.id] === key ? '2px solid var(--primary)' : '1px solid var(--border)',
                                    background: answers[q.id] === key ? 'rgba(255,105,0,0.1)' : 'transparent',
                                    color: 'var(--text-primary)', transition: 'all 0.2s',
                                }}>
                                <strong style={{ color: 'var(--primary)', marginRight: '0.5rem' }}>{key})</strong> <MathText text={val} />
                            </button>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1.5rem' }}>
                    <button className="btn" onClick={prevQuestion} disabled={currentQ === 0} style={{ padding: '0.6rem 1.5rem' }}>
                        ← Anterior
                    </button>
                    {currentQ < questions.length - 1 ? (
                        <button className="btn btn-primary" onClick={nextQuestion} style={{ padding: '0.6rem 1.5rem' }}>
                            Siguiente →
                        </button>
                    ) : (
                        <button className="btn btn-primary" onClick={submitExam} disabled={phase === 'submitting' || answered < questions.length}
                            style={{ padding: '0.6rem 1.5rem', opacity: answered < questions.length ? 0.5 : 1 }}>
                            {phase === 'submitting' ? '⏳ Evaluando...' : `✅ Finalizar (${answered}/${questions.length})`}
                        </button>
                    )}
                </div>

                {/* Quick nav */}
                <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center', marginTop: '1rem', flexWrap: 'wrap' }}>
                    {questions.map((_, i) => (
                        <button key={i} onClick={() => handleJumpTo(i)}
                            style={{
                                width: 32, height: 32, borderRadius: '50%', fontSize: '0.75rem', border: 'none', cursor: 'pointer',
                                background: i === currentQ ? 'var(--primary)' : answers[questions[i].id] ? '#22c55e' : 'var(--border)',
                                color: (i === currentQ || answers[questions[i].id]) ? '#fff' : 'var(--text-secondary)',
                            }}>
                            {i + 1}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    // FASE: Resultados
    if (phase === 'results' && results) {
        const { score, total, percentage, attemptNumber, aiDiagnosis, answers: detailedAnswers } = results;

        return (
            <div className="app-container" style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
                <h1 style={{ fontSize: '1.6rem', fontWeight: 700, textAlign: 'center', marginBottom: '0.5rem' }}>
                    📊 Resultados — {content.title}
                </h1>
                <p style={{ textAlign: 'center', color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                    Intento #{attemptNumber} • Grado {content.schoolGrade}°
                </p>

                {/* KPI Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Precisión</h4>
                        <GaugeChart value={percentage} label="% Acierto" />
                    </div>
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h4 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>Distribución</h4>
                        <DonutChart
                            data={[
                                { label: 'Correctas', value: score },
                                { label: 'Incorrectas', value: total - score },
                            ]}
                            colors={['#22c55e', '#ef4444']}
                        />
                    </div>
                    <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
                        <ProgressRing value={score} max={total} label="Score" color="#ff6900" />
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: percentage >= 60 ? '#22c55e' : '#ef4444' }}>
                            {score}/{total}
                        </div>
                    </div>
                </div>

                {/* AI Diagnosis */}
                {aiDiagnosis && (
                    <div style={{ display: 'grid', gap: '1rem', marginBottom: '2rem' }}>
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h3 style={{ marginBottom: '0.75rem' }}>🤖 Diagnóstico IA</h3>
                            <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{aiDiagnosis.resumenGeneral}</p>
                        </div>

                        {(aiDiagnosis.conceptosDominados || []).length > 0 && (
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h4 style={{ color: '#22c55e', marginBottom: '0.5rem' }}>✅ Conceptos Dominados</h4>
                                {aiDiagnosis.conceptosDominados.map((c, i) => (
                                    <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                                        <strong>{c.concepto}</strong>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.evidencia}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(aiDiagnosis.conceptosConDificultad || []).length > 0 && (
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h4 style={{ color: '#ef4444', marginBottom: '0.5rem' }}>⚠️ Conceptos por Mejorar</h4>
                                {aiDiagnosis.conceptosConDificultad.map((c, i) => (
                                    <div key={i} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border)' }}>
                                        <strong>{c.concepto}</strong>
                                        <span style={{ fontSize: '0.7rem', marginLeft: '0.5rem', padding: '0.1rem 0.4rem', borderRadius: 6, background: c.nivel === 'critico' ? '#ef444433' : '#f59e0b33', color: c.nivel === 'critico' ? '#ef4444' : '#f59e0b' }}>
                                            {c.nivel}
                                        </span>
                                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.explicacion}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(aiDiagnosis.recomendaciones || []).length > 0 && (
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h4 style={{ marginBottom: '0.5rem' }}>📖 Recomendaciones</h4>
                                {aiDiagnosis.recomendaciones.map((r, i) => (
                                    <p key={i} style={{ padding: '0.3rem 0', fontSize: '0.9rem' }}>• {r}</p>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Detailed Answers */}
                <div className="card" style={{ padding: '1.5rem' }}>
                    <h3 style={{ marginBottom: '1rem' }}>📝 Detalle de Respuestas</h3>
                    {(detailedAnswers || []).map((a, i) => (
                        <div key={i} style={{
                            padding: '1rem', marginBottom: '0.75rem', borderRadius: 12,
                            border: `1px solid ${a.isCorrect ? '#22c55e44' : '#ef444444'}`,
                            background: a.isCorrect ? 'rgba(34,197,94,0.05)' : 'rgba(239,68,68,0.05)',
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                <span style={{ fontWeight: 600 }}>Pregunta {i + 1}</span>
                                <span style={{ color: a.isCorrect ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                    {a.isCorrect ? '✅ Correcta' : '❌ Incorrecta'}
                                </span>
                            </div>
                            <div style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}><MathText text={a.text} /></div>
                            {!a.isCorrect && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    <p>Tu respuesta: <strong style={{ color: '#ef4444' }}>{a.selectedOption}</strong> • Correcta: <strong style={{ color: '#22c55e' }}>{a.correctOption}</strong></p>
                                    {a.explanation && <div style={{ marginTop: '0.3rem', fontStyle: 'italic' }}>💡 <MathText text={a.explanation} /></div>}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem' }}>
                    <button className="btn btn-primary" onClick={() => { setPhase('intro'); setAnswers({}); setCurrentQ(0); fetchContent(); }}
                        style={{ padding: '0.75rem 2rem' }}>
                        🔄 Intentar de Nuevo
                    </button>
                    <Link href="/dashboard" className="btn" style={{ padding: '0.75rem 2rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
                        🏠 Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return null;
}
