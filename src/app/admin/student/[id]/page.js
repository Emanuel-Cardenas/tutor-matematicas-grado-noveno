'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { DonutChart, RadarChart, BarChart, HorizontalBarChart, GaugeChart, ProgressRing, ScatterChart, ChartLegend } from '@/components/Charts';

export default function StudentDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedSession, setExpandedSession] = useState(null);
    const [activeTab, setActiveTab] = useState('visuales');

    useEffect(() => {
        const token = sessionStorage.getItem('adminToken');
        if (!token) { router.push('/admin'); return; }
        fetchStudent(token);
    }, [router, params.id]);

    const fetchStudent = async (token) => {
        try {
            const res = await fetch('/api/admin/students/' + params.id, {
                headers: { Authorization: 'Bearer ' + token },
            });
            if (res.status === 401) { sessionStorage.removeItem('adminToken'); router.push('/admin'); return; }
            if (res.status === 404) { setData({ error: 'Estudiante no encontrado' }); return; }
            const result = await res.json();
            setData(result);
        } catch (e) {
            setData({ error: 'Error al cargar datos' });
        } finally {
            setLoading(false);
        }
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
                <p className="loading-text">Cargando perfil del estudiante...</p>
            </div>
        );
    }

    if (data?.error) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ color: 'var(--error)', marginBottom: '1rem' }}>{data.error}</p>
                    <Link href="/admin/dashboard" className="btn btn-primary">Volver</Link>
                </div>
            </div>
        );
    }

    const { student, analytics } = data;
    const diag = analytics.diagnosticData;
    const aiDiag = analytics.aiDiagnosis;
    const aiAnalysis = analytics.aiAnalysis;
    const aiRecs = analytics.aiRecommendations;
    const timingStats = analytics.diagnosticTimingStats;

    const tabs = [
        { id: 'visuales', label: '📊 Visuales' },
        { id: 'diagnostico', label: '📋 Diagnóstico' },
        { id: 'respuestas', label: '📝 Respuestas' },
        { id: 'analisis', label: '🔍 Análisis IA' },
        { id: 'recomendaciones', label: '📚 Recomendaciones' },
        { id: 'sesiones', label: '💬 Sesiones' },
    ];

    return (
        <div className="app-container">
            <nav className="navbar" style={{ borderBottom: '2px solid rgba(245, 158, 11, 0.3)' }}>
                <Link href="/admin/dashboard" className="navbar-brand">
                    <div className="navbar-logo">🔐</div>
                    <span className="navbar-title">Admin Panel</span>
                </Link>
                <div className="navbar-nav">
                    <Link href="/admin/dashboard" className="nav-link">← Volver</Link>
                </div>
            </nav>

            <main className="main-content" style={{ padding: '2rem' }}>
                {/* Header del estudiante */}
                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                                👤 {student.name || 'Sin nombre'}
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                @{student.username} • {student.email}
                                {student.schoolGrade && ` • Grado ${student.schoolGrade}°`}
                            </p>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                                Registrado: {new Date(student.createdAt).toLocaleString('es-CO')} •
                                Acceso: {student.lastLogin ? new Date(student.lastLogin).toLocaleString('es-CO') : 'Nunca'}
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

                {/* Info del padre/acudiente */}
                {student.parent ? (
                    <div className="card" style={{
                        padding: '1.25rem',
                        marginBottom: '1.5rem',
                        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(139, 92, 246, 0.06) 100%)',
                        border: '1px solid rgba(139, 92, 246, 0.15)',
                    }}>
                        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', color: '#8b5cf6' }}>
                            👨‍👩‍👧 Padre / Acudiente Vinculado
                        </h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Nombre</div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{student.parent.fullName}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Email de contacto</div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                                    <a href={'mailto:' + student.parent.email} style={{ color: '#8b5cf6', textDecoration: 'none' }}>
                                        {student.parent.email}
                                    </a>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Usuario padre</div>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>@{student.parent.username}</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Registrado / Último acceso</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {new Date(student.parent.createdAt).toLocaleDateString('es-CO')}
                                    {' / '}
                                    {student.parent.lastLogin ? new Date(student.parent.lastLogin).toLocaleDateString('es-CO') : 'Sin acceso'}
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            ⚠️ Este estudiante no tiene un padre/acudiente vinculado aún.
                        </span>
                    </div>
                )}
                {/* Métricas principales */}
                <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                        <div className="stat-icon">🎯</div>
                        <div className="stat-value" style={{ color: analytics.accuracy >= 70 ? '#10b981' : analytics.accuracy >= 40 ? '#f59e0b' : '#ef4444' }}>
                            {analytics.accuracy}%
                        </div>
                        <div className="stat-label">Precisión</div>
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
                                background: activeTab === tab.id ? 'var(--accent-primary)' : 'var(--bg-card)',
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

                {/* TAB: Visuales (NEW) */}
                {activeTab === 'visuales' && (
                    <div>
                        {/* KPI Header */}
                        <div className="mck-chart-section" style={{ marginBottom: '1rem' }}>
                            {/* Gauge: Precisión */}
                            <div className="mck-chart-card">
                                <GaugeChart
                                    value={analytics.accuracy || 0}
                                    maxValue={100}
                                    title="Precisión General"
                                    subtitle={`${analytics.correctCount}/${analytics.correctCount + analytics.incorrectCount} correctas`}
                                    label="% Acierto"
                                    height={170}
                                />
                            </div>

                            {/* Donut: Aciertos vs Errores */}
                            <div className="mck-chart-card">
                                <DonutChart
                                    data={[
                                        { label: 'Correctas', value: analytics.correctCount || 0, color: '#10b981' },
                                        { label: 'Incorrectas', value: analytics.incorrectCount || 0, color: '#ef4444' },
                                    ]}
                                    title="Distribución de Respuestas"
                                    subtitle="Diagnóstico acumulado"
                                    centerValue={`${analytics.accuracy}%`}
                                    centerLabel="precisión"
                                    height={170}
                                />
                            </div>

                            {/* ProgressRings */}
                            <div className="mck-chart-card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                                <ProgressRing value={student.currentLevel || 1} maxValue={5} size={64} color="#ff6900" label="Nivel" />
                                <ProgressRing value={analytics.accuracy || 0} maxValue={100} size={64} label="Precisión" />
                                <ProgressRing value={analytics.totalSessions || 0} maxValue={Math.max(analytics.totalSessions || 1, 10)} size={64} color="#6366f1" label="Sesiones" />
                                <ProgressRing value={analytics.totalInteractions || 0} maxValue={Math.max(analytics.totalInteractions || 1, 50)} size={64} color="#06b6d4" label="Interacc." />
                            </div>
                        </div>

                        <div className="mck-chart-section" style={{ marginBottom: '1rem' }}>
                            {/* Horizontal Bar: Errores por tema */}
                            {analytics.errorsByTopic && Object.keys(analytics.errorsByTopic).length > 0 && (
                                <div className="mck-chart-card">
                                    <HorizontalBarChart
                                        data={Object.entries(analytics.errorsByTopic)
                                            .sort(([,a], [,b]) => b - a)
                                            .map(([topic, count]) => ({
                                                label: topic.replace('Pensamiento ', 'P. '),
                                                value: count,
                                                color: '#ef4444',
                                            }))
                                        }
                                        title="Errores por Tema"
                                        subtitle="Áreas de mayor dificultad"
                                        unit=""
                                    />
                                </div>
                            )}

                            {/* Donut: Tipos de error */}
                            {Object.keys(analytics.errorTypes).length > 0 && (
                                <div className="mck-chart-card">
                                    <DonutChart
                                        data={Object.entries(analytics.errorTypes).map(([type, count]) => {
                                            const colors = { conceptual: '#ef4444', procedimental: '#f59e0b', aritmetico: '#3b82f6', interpretacion: '#a855f7' };
                                            return { label: type.charAt(0).toUpperCase() + type.slice(1), value: count, color: colors[type] || '#6b7280' };
                                        })}
                                        title="Tipos de Error"
                                        subtitle="Clasificación de errores"
                                        height={200}
                                    />
                                </div>
                            )}

                            {/* Radar: Competencias */}
                            {aiDiag && (() => {
                                const allTopics = [
                                    ...(aiDiag.temasDominados || []).map(t => ({ label: (t.tema || '').replace('Pensamiento ', 'P. '), value: 85 })),
                                    ...(aiDiag.temasConDificultad || []).map(t => ({ label: (t.tema || '').replace('Pensamiento ', 'P. '), value: t.nivel === 'critico' ? 20 : 45 })),
                                ].filter(t => t.label);
                                return allTopics.length >= 3 ? (
                                    <div className="mck-chart-card">
                                        <RadarChart
                                            data={allTopics.map(t => ({ ...t, color: '#2563eb' }))}
                                            title="Mapa de Competencias"
                                            subtitle="Fortalezas y áreas de mejora"
                                            maxValue={100}
                                            height={220}
                                        />
                                    </div>
                                ) : null;
                            })()}
                        </div>

                        {/* Timing analysis */}
                        {timingStats && diag && diag.answers && (
                            <div className="mck-chart-section" style={{ marginBottom: '1rem' }}>
                                <div className="mck-chart-card mck-chart-card-full">
                                    <ScatterChart
                                        data={diag.answers.map((a, i) => ({
                                            x: Math.round((a.timeSpentMs || 0) / 1000),
                                            y: a.isCorrect ? 100 : 0,
                                            label: `P${a.questionIndex || i + 1} (${a.topic || 'General'})`,
                                            color: a.isCorrect ? '#10b981' : '#ef4444',
                                            size: 6,
                                        }))}
                                        title="Tiempo vs Resultado por Pregunta"
                                        subtitle="Análisis de velocidad vs precisión"
                                        xLabel="Tiempo (s)"
                                        yLabel="Resultado"
                                        height={200}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Diagnostico */}
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

                        {/* Timing stats */}
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
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b' }}>{timingStats.slowQuestions}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Preguntas {'>'}60s</div>
                                    </div>
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(59,130,246,0.08)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1rem', fontWeight: 700, color: '#3b82f6' }}>{timingStats.fastQuestions}</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Preguntas {'<'}5s</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Diagnostico IA */}
                        {aiDiag && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🧠 Diagnóstico Académico (IA)</h3>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '1rem' }}>
                                    {aiDiag.diagnosticoGeneral}
                                </p>
                                {aiDiag.brechaAcademica && (
                                    <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,105,0,0.08)', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', fontSize: '0.8rem' }}>
                                        <strong style={{ color: 'var(--accent-primary)' }}>Brecha: </strong>{aiDiag.brechaAcademica}
                                    </div>
                                )}
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                    {aiDiag.temasDominados?.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: '0.85rem', color: '#10b981', marginBottom: '0.5rem' }}>✅ Dominados</h4>
                                            {aiDiag.temasDominados.map((t, i) => (
                                                <div key={i} style={{ fontSize: '0.8rem', padding: '0.25rem 0', color: 'var(--text-secondary)' }}>
                                                    • {t.tema}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    {aiDiag.temasConDificultad?.length > 0 && (
                                        <div>
                                            <h4 style={{ fontSize: '0.85rem', color: '#ef4444', marginBottom: '0.5rem' }}>⚠️ Con Dificultad</h4>
                                            {aiDiag.temasConDificultad.map((t, i) => (
                                                <div key={i} style={{ fontSize: '0.8rem', padding: '0.25rem 0', color: 'var(--text-secondary)' }}>
                                                    • {t.tema} <span style={{ color: t.nivel === 'critico' ? '#ef4444' : '#f59e0b', fontSize: '0.7rem' }}>({t.nivel})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Error types */}
                        {Object.keys(analytics.errorTypes).length > 0 && (
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>📊 Tipos de Error</h3>
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
                    </div>
                )}

                {/* TAB: Respuestas */}
                {activeTab === 'respuestas' && diag && (
                    <div className="card" style={{ padding: '1.25rem', overflow: 'auto' }}>
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
                    </div>
                )}

                {/* TAB: Analisis IA */}
                {activeTab === 'analisis' && aiAnalysis && (
                    <div>
                        {aiAnalysis.analysis && aiAnalysis.analysis.length > 0 && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                    🔍 Análisis de Errores ({aiAnalysis.analysis.length} incorrectas)
                                </h3>
                                {aiAnalysis.analysis.map((a, i) => (
                                    <div key={i} style={{ padding: '0.75rem', marginBottom: '0.5rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.12)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                                            <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                                                P{a.questionIndex} — {a.topic}
                                            </span>
                                            <span style={{ fontSize: '0.7rem', padding: '1px 8px', borderRadius: '4px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                                                {a.errorType}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                                            Resp: <strong style={{ color: '#ef4444' }}>{a.selectedOption}</strong> | Correcta: <strong style={{ color: '#10b981' }}>{a.correctOption}</strong>
                                        </div>
                                        {a.explicacionError && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: '0.25rem' }}>
                                                💡 {a.explicacionError}
                                            </div>
                                        )}
                                        {a.conceptoDebil && (
                                            <div style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                                Concepto: {a.conceptoDebil}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Patrones detectados */}
                        {aiAnalysis.patrones && aiAnalysis.patrones.length > 0 && (
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>🎯 Patrones Detectados</h3>
                                {aiAnalysis.patrones.map((p, i) => (
                                    <div key={i} style={{ padding: '0.5rem 0.75rem', marginBottom: '0.5rem', borderLeft: `3px solid ${p.gravedad === 'alta' ? '#ef4444' : p.gravedad === 'media' ? '#f59e0b' : '#3b82f6'}`, background: 'var(--bg-input)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{p.patron}</div>
                                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                            Frecuencia: {p.frecuencia} | Gravedad: {p.gravedad}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: Recomendaciones */}
                {activeTab === 'recomendaciones' && aiRecs && (
                    <div>
                        {aiRecs.planDeEstudio && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(16,185,129,0.05) 100%)' }}>
                                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem' }}>📚 Plan de Estudio</h3>
                                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.25rem' }}>{aiRecs.planDeEstudio.metaPrincipal}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                    Duración: {aiRecs.planDeEstudio.duracionEstimada}
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
                            const labels = { alta: '🔴 Alta Prioridad', media: '🟡 Media Prioridad', baja: '🟢 Baja Prioridad' };

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

                        {aiRecs.estrategia?.length > 0 && (
                            <div className="card" style={{ padding: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>📋 Estrategia</h4>
                                <ol style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    {aiRecs.estrategia.map((s, i) => (
                                        <li key={i} style={{ marginBottom: '0.25rem' }}>{s}</li>
                                    ))}
                                </ol>
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
                                No hay sesiones registradas
                            </p>
                        ) : (
                            student.sessions.map((session, si) => (
                                <div key={session.id} style={{ marginBottom: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                                    <div
                                        onClick={() => setExpandedSession(expandedSession === si ? null : si)}
                                        style={{ padding: '0.75rem 1rem', background: 'rgba(99,102,241,0.05)', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                                    >
                                        <div>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>Sesión #{student.sessions.length - si}</span>
                                            <span style={{ marginLeft: '0.75rem', fontSize: '0.75rem', padding: '2px 8px', borderRadius: '8px', background: session.sessionType === 'diagnostic' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)', color: session.sessionType === 'diagnostic' ? '#f59e0b' : '#6366f1' }}>
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
                                                        <div><span style={{ color: 'var(--text-muted)' }}>Est:</span> {inter.studentMessage}</div>
                                                        <div><span style={{ color: 'var(--text-muted)' }}>Tutor:</span> {inter.tutorResponse}</div>
                                                        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                            {inter.isCorrect !== null && (
                                                                <span style={{ color: inter.isCorrect ? '#10b981' : '#ef4444', fontWeight: 700 }}>
                                                                    {inter.isCorrect ? '✓' : '✗'}
                                                                </span>
                                                            )}
                                                            {inter.errorType && inter.errorType !== 'none' && <span>Error: {inter.errorType}</span>}
                                                            {inter.timeSpentSeconds && <span>{inter.timeSpentSeconds}s</span>}
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
