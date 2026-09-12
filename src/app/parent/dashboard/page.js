'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function ParentDashboardPage() {
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('diagnostico');
    const [expandedSession, setExpandedSession] = useState(null);

    useEffect(() => {
        const token = sessionStorage.getItem('parentToken');
        if (!token) {
            router.push('/parent');
            return;
        }
        fetchChildData(token);
    }, [router]);

    const fetchChildData = async (token) => {
        try {
            const res = await fetch('/api/parent/child', {
                headers: { Authorization: 'Bearer ' + token },
            });

            if (res.status === 401) {
                sessionStorage.removeItem('parentToken');
                sessionStorage.removeItem('parentName');
                sessionStorage.removeItem('childName');
                router.push('/parent');
                return;
            }

            const result = await res.json();
            if (result.error) {
                setError(result.error);
            } else {
                setData(result);
            }
        } catch {
            setError('Error al cargar los datos');
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('parentToken');
        sessionStorage.removeItem('parentName');
        sessionStorage.removeItem('childName');
        sessionStorage.removeItem('childId');
        router.push('/parent');
    };

    const formatTime = (ms) => {
        if (!ms) return '-';
        const sec = Math.round(ms / 1000);
        if (sec < 60) return `${sec}s`;
        return `${Math.floor(sec / 60)}m ${sec % 60}s`;
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando información de tu hijo...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{error}</p>
                    <button className="btn btn-primary" onClick={handleLogout}>Volver al login</button>
                </div>
            </div>
        );
    }

    if (!data) return null;

    const { student, analytics, parentName } = data;
    const diag = analytics.diagnosticData;
    const aiDiag = analytics.aiDiagnosis;
    const aiAnalysis = analytics.aiAnalysis;
    const aiRecs = analytics.aiRecommendations;
    const timingStats = analytics.diagnosticTimingStats;
    const diagHistory = analytics.diagnosticHistory || [];

    const tabs = [
        { id: 'resumen', label: '📊 Resumen' },
        { id: 'diagnostico', label: '📋 Diagnóstico' },
        { id: 'respuestas', label: '📝 Respuestas' },
        { id: 'recomendaciones', label: '📚 Recomendaciones' },
        { id: 'sesiones', label: '💬 Sesiones' },
    ];

    return (
        <div className="app-container">
            <nav className="navbar" style={{ borderBottom: '2px solid rgba(139, 92, 246, 0.3)' }}>
                <div className="navbar-brand" style={{ cursor: 'default' }}>
                    <div className="navbar-logo" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>👨‍👩‍👧</div>
                    <span className="navbar-title">Portal de Padres</span>
                </div>
                <div className="navbar-nav">
                    <span className="nav-link active">Mi Hijo</span>
                </div>
                <div className="nav-user">
                    <ThemeToggle />
                    <div className="nav-user-info">
                        <div className="nav-user-name">{parentName}</div>
                        <div className="nav-user-level" style={{ color: 'rgba(139, 92, 246, 0.8)' }}>Padre/Acudiente</div>
                    </div>
                    <button className="btn-logout" onClick={handleLogout}>Cerrar Sesión</button>
                </div>
            </nav>

            <main className="main-content">
                {/* Header del hijo */}
                <div className="card animate-fade-in" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.05) 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                👦 {student.name}
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                @{student.username}
                                {student.schoolGrade && ` • Grado ${student.schoolGrade}°`}
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                Registrado: {new Date(student.createdAt).toLocaleDateString('es-CO')} •
                                Último acceso: {student.lastLogin ? new Date(student.lastLogin).toLocaleDateString('es-CO') : 'Sin registro'}
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--accent-primary-light)' }}>
                                Nivel {student.currentLevel || 1}
                            </div>
                            {student.schoolGrade && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    Grado {student.schoolGrade}° Bachillerato
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Métricas principales */}
                <div className="stats-grid animate-slide-up" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                        <div className="stat-icon">🎯</div>
                        <div className="stat-value" style={{
                            background: 'none',
                            WebkitTextFillColor: analytics.accuracy >= 70 ? '#10b981' : analytics.accuracy >= 40 ? '#f59e0b' : '#ef4444',
                            color: analytics.accuracy >= 70 ? '#10b981' : analytics.accuracy >= 40 ? '#f59e0b' : '#ef4444',
                        }}>
                            {analytics.accuracy}%
                        </div>
                        <div className="stat-label">Precisión</div>
                        <div style={{ marginTop: '0.5rem', height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                            <div style={{
                                width: `${analytics.accuracy}%`, height: '100%', borderRadius: 2,
                                background: analytics.accuracy >= 70 ? 'var(--gradient-success)' : analytics.accuracy >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)',
                                transition: 'width 0.8s ease',
                            }} />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-value">{analytics.correctCount}</div>
                        <div className="stat-label">Correctas</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">❌</div>
                        <div className="stat-value">{analytics.incorrectCount}</div>
                        <div className="stat-label">Incorrectas</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⏱️</div>
                        <div className="stat-value">{timingStats ? formatTime(timingStats.avgTimeMs) : `${analytics.avgTimePerAnswer}s`}</div>
                        <div className="stat-label">Tiempo Promedio</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-value">{analytics.totalSessions}</div>
                        <div className="stat-label">Sesiones</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">💬</div>
                        <div className="stat-value">{analytics.totalInteractions}</div>
                        <div className="stat-label">Interacciones</div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            style={{
                                padding: '0.5rem 1rem',
                                borderRadius: 'var(--radius-md)',
                                border: 'none',
                                background: activeTab === tab.id ? '#8b5cf6' : 'var(--bg-card)',
                                color: activeTab === tab.id ? '#fff' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                transition: 'all 0.15s',
                            }}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* TAB: Resumen */}
                {activeTab === 'resumen' && (
                    <div>
                        {/* Historial de diagnósticos */}
                        {diagHistory.length > 0 && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📈 Historial de Evaluaciones</h3>
                                <div style={{ display: 'grid', gap: '0.75rem' }}>
                                    {diagHistory.map((d, i) => (
                                        <div key={d.id} style={{
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: i === 0 ? 'rgba(139, 92, 246, 0.08)' : 'var(--bg-input)',
                                            border: i === 0 ? '1px solid rgba(139, 92, 246, 0.2)' : '1px solid transparent',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                                                    {i === 0 ? '🏆 Último diagnóstico' : `Diagnóstico #${diagHistory.length - i}`}
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                    {new Date(d.completedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}
                                                    {d.schoolGrade && ` • Grado ${d.schoolGrade}°`}
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{
                                                    fontSize: '1.2rem', fontWeight: 800,
                                                    color: d.accuracy >= 70 ? '#10b981' : d.accuracy >= 40 ? '#f59e0b' : '#ef4444',
                                                }}>
                                                    {d.score}/{d.totalQuestions}
                                                </div>
                                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                    {d.accuracy}% • Nivel {d.assignedLevel}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Diagnóstico IA resumen */}
                        {aiDiag && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🧠 Diagnóstico del Tutor</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                    {aiDiag.diagnosticoGeneral}
                                </p>
                                {aiDiag.brechaAcademica && (
                                    <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,105,0,0.08)', borderRadius: 'var(--radius-sm)', marginTop: '0.75rem', fontSize: '0.8rem' }}>
                                        <strong style={{ color: 'var(--accent-primary)' }}>Brecha académica: </strong>{aiDiag.brechaAcademica}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Fortalezas y debilidades */}
                        {aiDiag && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                {aiDiag.temasDominados?.length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', color: '#10b981', marginBottom: '0.75rem' }}>✅ Tu hijo domina</h4>
                                        {aiDiag.temasDominados.map((t, i) => (
                                            <div key={i} style={{ fontSize: '0.8rem', padding: '0.4rem 0', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                                <strong>{t.tema}</strong>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.pensamiento}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {aiDiag.temasConDificultad?.length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', color: '#ef4444', marginBottom: '0.75rem' }}>⚠️ Necesita refuerzo</h4>
                                        {aiDiag.temasConDificultad.map((t, i) => (
                                            <div key={i} style={{ fontSize: '0.8rem', padding: '0.4rem 0', color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                                                <strong>{t.tema}</strong>
                                                <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', padding: '1px 6px', borderRadius: '4px', background: t.nivel === 'critico' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)', color: t.nivel === 'critico' ? '#ef4444' : '#f59e0b' }}>
                                                    {t.nivel}
                                                </span>
                                                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t.pensamiento}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Sin datos */}
                        {!diag && (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Aún no hay diagnóstico</h3>
                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                    Tu hijo aún no ha realizado la evaluación diagnóstica. Anímale a completarla para que el sistema pueda personalizar su aprendizaje.
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Diagnóstico */}
                {activeTab === 'diagnostico' && (
                    <div>
                        {/* Errores por tema */}
                        {analytics.errorsByTopic && Object.keys(analytics.errorsByTopic).length > 0 && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📊 Errores por Tema</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {Object.entries(analytics.errorsByTopic).sort(([, a], [, b]) => b - a).map(([topic, count]) => (
                                        <div key={topic} style={{
                                            padding: '0.75rem 1rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: 'rgba(239,68,68,0.08)',
                                            border: '1px solid rgba(239,68,68,0.15)',
                                            textAlign: 'center',
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#ef4444' }}>{count}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{topic}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tiempos */}
                        {timingStats && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>⏱️ Análisis de Tiempos</h3>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatTime(timingStats.totalTimeMs)}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Tiempo Total</div>
                                    </div>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700 }}>{formatTime(timingStats.avgTimeMs)}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Promedio/Pregunta</div>
                                    </div>
                                    {timingStats.slowest && (
                                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#ef4444' }}>P{timingStats.slowest.index} ({formatTime(timingStats.slowest.time)})</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Más Lenta</div>
                                        </div>
                                    )}
                                    {timingStats.fastest && (
                                        <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', textAlign: 'center' }}>
                                            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#10b981' }}>P{timingStats.fastest.index} ({formatTime(timingStats.fastest.time)})</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Más Rápida</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Tipos de error */}
                        {Object.keys(analytics.errorTypes).length > 0 && (
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>🔍 Tipos de Error</h3>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {Object.entries(analytics.errorTypes).map(([type, count]) => (
                                        <div key={type} style={{
                                            padding: '0.75rem 1.25rem',
                                            borderRadius: 'var(--radius-md)',
                                            background: type === 'conceptual' ? 'rgba(239,68,68,0.1)' :
                                                type === 'procedimental' ? 'rgba(245,158,11,0.1)' :
                                                    type === 'aritmetico' ? 'rgba(59,130,246,0.1)' : 'rgba(168,85,247,0.1)',
                                            border: '1px solid ' + (type === 'conceptual' ? 'rgba(239,68,68,0.2)' :
                                                type === 'procedimental' ? 'rgba(245,158,11,0.2)' :
                                                    type === 'aritmetico' ? 'rgba(59,130,246,0.2)' : 'rgba(168,85,247,0.2)'),
                                        }}>
                                            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{count}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{type}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {!diag && (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)' }}>Tu hijo aún no ha completado el diagnóstico.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Respuestas */}
                {activeTab === 'respuestas' && (
                    <div className="card" style={{ padding: '1.25rem', overflow: 'auto' }}>
                        {diag ? (
                            <>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📝 Respuestas del Diagnóstico ({diag.score}/{diag.total})</h3>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>#</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Pregunta</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Tema</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Resp.</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Correcta</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>OK</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>Tiempo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diag.answers.map((a, i) => (
                                            <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: !a.isCorrect ? 'rgba(239,68,68,0.03)' : 'transparent' }}>
                                                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{a.questionIndex}</td>
                                                <td style={{ padding: '0.5rem', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {a.questionText}
                                                </td>
                                                <td style={{ padding: '0.5rem' }}>{a.topic}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600, color: a.isCorrect ? '#10b981' : '#ef4444' }}>
                                                    {a.selectedOption || '-'}
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center', fontWeight: 600 }}>{a.correctOption}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    {a.isCorrect ? <span style={{ color: '#10b981' }}>✓</span> : <span style={{ color: '#ef4444' }}>✗</span>}
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', color: a.timeSpentMs > 60000 ? '#ef4444' : 'var(--text-secondary)' }}>
                                                    {formatTime(a.timeSpentMs)}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>
                                Aún no hay respuestas para mostrar.
                            </p>
                        )}
                    </div>
                )}

                {/* TAB: Recomendaciones */}
                {activeTab === 'recomendaciones' && (
                    <div>
                        {aiRecs ? (
                            <>
                                {aiRecs.planDeEstudio && (
                                    <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(16,185,129,0.05) 100%)' }}>
                                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>📚 Plan de Estudio Recomendado</h3>
                                        <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{aiRecs.planDeEstudio.metaPrincipal}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                            Duración estimada: {aiRecs.planDeEstudio.duracionEstimada}
                                        </div>
                                        {aiRecs.planDeEstudio.resumen && (
                                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.5rem', lineHeight: 1.6 }}>{aiRecs.planDeEstudio.resumen}</p>
                                        )}
                                    </div>
                                )}

                                {aiRecs.temasPorPrioridad && ['alta', 'media', 'baja'].map(prioridad => {
                                    const temas = aiRecs.temasPorPrioridad[prioridad] || [];
                                    if (temas.length === 0) return null;
                                    const colors = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };
                                    const labels = { alta: '🔴 Prioridad Alta', media: '🟡 Prioridad Media', baja: '🟢 Prioridad Baja' };

                                    return (
                                        <div key={prioridad} className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: colors[prioridad] }}>
                                                {labels[prioridad]}
                                            </h4>
                                            {temas.map((t, i) => (
                                                <div key={i} style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderLeft: `3px solid ${colors[prioridad]}`, background: 'var(--bg-input)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.tema}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t.razon}</div>
                                                    {t.ejerciciosRecomendados?.length > 0 && (
                                                        <ul style={{ margin: '0.25rem 0 0 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                            {t.ejerciciosRecomendados.map((ej, j) => (
                                                                <li key={j}>{ej}</li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}

                                {aiRecs.consejos?.length > 0 && (
                                    <div className="card" style={{ padding: '1.25rem' }}>
                                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>💡 Consejos para Padres</h4>
                                        <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {aiRecs.consejos.map((c, i) => (
                                                <li key={i} style={{ marginBottom: '0.35rem' }}>{c}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                <p style={{ color: 'var(--text-muted)' }}>Las recomendaciones aparecerán cuando tu hijo complete el diagnóstico.</p>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Sesiones */}
                {activeTab === 'sesiones' && (
                    <div className="card" style={{ padding: '1.25rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                            💬 Historial de Sesiones ({student.sessions?.length || 0})
                        </h3>
                        {(!student.sessions || student.sessions.length === 0) ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                                Tu hijo aún no ha tenido sesiones con el tutor.
                            </p>
                        ) : (
                            student.sessions.map((session, si) => (
                                <div key={session.id} style={{ marginBottom: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <div
                                        onClick={() => setExpandedSession(expandedSession === si ? null : si)}
                                        style={{ padding: '0.75rem 1rem', background: 'rgba(139, 92, 246, 0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sesión #{student.sessions.length - si}</span>
                                            <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '8px', background: session.sessionType === 'diagnostic' ? 'rgba(245,158,11,0.15)' : 'rgba(139,92,246,0.15)', color: session.sessionType === 'diagnostic' ? '#f59e0b' : '#8b5cf6' }}>
                                                {session.sessionType}
                                            </span>
                                            <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                                {new Date(session.startedAt).toLocaleString('es-CO')}
                                            </span>
                                        </div>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                            {session.interactions?.length || 0} interacciones {expandedSession === si ? '▼' : '▶'}
                                        </span>
                                    </div>
                                    {expandedSession === si && session.interactions && (
                                        <div style={{ padding: '0.75rem 1rem' }}>
                                            {session.interactions.length === 0 ? (
                                                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Sin interacciones</p>
                                            ) : (
                                                session.interactions.map((inter) => (
                                                    <div key={inter.id} style={{ padding: '0.5rem', marginBottom: '0.4rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-card)', border: `1px solid ${inter.isCorrect ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}`, fontSize: '0.8rem' }}>
                                                        <div><span style={{ color: 'var(--text-muted)' }}>Estudiante:</span> {inter.studentMessage}</div>
                                                        <div><span style={{ color: 'var(--text-muted)' }}>Tutor:</span> {inter.tutorResponse}</div>
                                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {inter.isCorrect !== null && (
                                                                <span style={{ color: inter.isCorrect ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                    {inter.isCorrect ? '✓ Correcto' : '✗ Incorrecto'}
                                                                </span>
                                                            )}
                                                            {inter.errorType && inter.errorType !== 'none' && <span>Error: {inter.errorType}</span>}
                                                            {inter.timeSpentSeconds && <span>⏱️ {inter.timeSpentSeconds}s</span>}
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}
