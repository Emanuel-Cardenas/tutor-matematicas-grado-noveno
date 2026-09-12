'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { LineChart, HorizontalBarChart, RadarChart, DonutChart, BarChart, ChartLegend, GaugeChart, ProgressRing, ScatterChart, HeatmapChart } from '@/components/Charts';

export default function AnalyticsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
    }, [status, router]);

    useEffect(() => {
        if (session) fetchAnalytics();
    }, [session]);

    const fetchAnalytics = async () => {
        try {
            const res = await fetch('/api/stats/analytics');
            if (res.ok) {
                setData(await res.json());
            }
        } catch (e) {
            console.error('Error fetching analytics:', e);
        } finally {
            setLoading(false);
        }
    };

    if (status === 'loading' || loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando analíticas...</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="app-container">
                <NavBar session={session} />
                <main className="main-content">
                    <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                        <h2 style={{ marginBottom: '0.5rem' }}>Sin datos aún</h2>
                        <p style={{ color: 'var(--text-muted)' }}>Completa tu primera evaluación diagnóstica para ver tus analíticas.</p>
                        <Link href="/diagnostic" className="btn btn-primary btn-lg" style={{ marginTop: '1.5rem', display: 'inline-block' }}>
                            Ir al Diagnóstico
                        </Link>
                    </div>
                </main>
            </div>
        );
    }

    const { summary, diagnosticHistory, topicStats, tutoringSessions, dailyActivity, cognitiveProfile } = data;

    // Calcular mejora entre primer y último diagnóstico
    const improvement = diagnosticHistory.length >= 2
        ? diagnosticHistory[diagnosticHistory.length - 1].percentage - diagnosticHistory[0].percentage
        : null;

    // Build chart data
    const lineChartData = diagnosticHistory.map((d, i) => ({
        label: i === 0 ? '1er' : i === 1 ? '2do' : `${i + 1}°`,
        value: d.percentage,
    }));

    const topicBarData = [...topicStats]
        .sort((a, b) => b.percentage - a.percentage)
        .map(t => ({
            label: t.topic,
            value: t.percentage,
            color: t.percentage >= 70 ? '#10b981' : t.percentage >= 40 ? '#f59e0b' : '#ef4444',
        }));

    const donutAccuracyData = [
        { label: 'Correctas', value: summary.totalCorrect, color: '#10b981' },
        { label: 'Incorrectas', value: Math.max(0, (summary.totalDiagnostics * 10 || summary.totalCorrect * 1.5) - summary.totalCorrect), color: '#ef4444' },
    ];

    // Radar data from topic stats (top 6)
    const radarData = topicStats.slice(0, 8).map(t => ({
        label: t.topic,
        value: t.percentage,
        color: '#2563eb',
    }));

    // Sessions accuracy line chart
    const sessionLineData = tutoringSessions.slice(-15).map((s, i) => ({
        label: `S${i + 1}`,
        value: s.accuracy,
    }));

    return (
        <div className="app-container">
            <NavBar session={session} />
            <main className="main-content">

                    {/* Header */}
                    <div className="animate-fade-in" style={{ marginBottom: '1.5rem' }}>
                        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                            📊 Analítica de Progreso
                        </h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Tu rendimiento académico en detalle
                            {data.user.schoolGrade && ` • Grado ${data.user.schoolGrade}°`}
                        </p>
                    </div>

                    {/* Resumen General */}
                    <div className="animate-slide-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        <StatCard icon="🎯" value={`${summary.overallAccuracy}%`} label="Precisión General" color={summary.overallAccuracy >= 70 ? '#10b981' : summary.overallAccuracy >= 40 ? '#f59e0b' : '#ef4444'} />
                        <StatCard icon="📝" value={summary.totalDiagnostics} label="Diagnósticos" color="#6366f1" />
                        <StatCard icon="💬" value={summary.totalTutoringSessions} label="Sesiones Tutor" color="#8b5cf6" />
                        <StatCard icon="✅" value={summary.totalCorrect} label="Respuestas OK" color="#10b981" />
                        <StatCard icon="📊" value={`Nivel ${data.user.currentLevel}`} label="Nivel Actual" color="var(--accent-primary)" />
                        {improvement !== null && (
                            <StatCard
                                icon={improvement > 0 ? '📈' : improvement < 0 ? '📉' : '➡️'}
                                value={`${improvement > 0 ? '+' : ''}${improvement}%`}
                                label="Mejora"
                                color={improvement > 0 ? '#10b981' : improvement < 0 ? '#ef4444' : '#6b7280'}
                            />
                        )}
                    </div>

                    {/* ═══════ MCKINSEY CHARTS SECTION ═══════ */}
                    <div className="mck-chart-section animate-slide-up">

                        {/* Donut: Precisión global */}
                        <div className="mck-chart-card">
                            <DonutChart
                                data={donutAccuracyData}
                                title="Distribución de Respuestas"
                                subtitle="Aciertos vs errores acumulados"
                                centerValue={`${summary.overallAccuracy}%`}
                                centerLabel="Precisión"
                                height={220}
                            />
                        </div>

                        {/* Radar: Competencias por tema */}
                        {radarData.length >= 3 && (
                            <div className="mck-chart-card">
                                <RadarChart
                                    data={radarData}
                                    title="Perfil de Competencias"
                                    subtitle="Rendimiento por área temática"
                                    maxValue={100}
                                    height={220}
                                />
                            </div>
                        )}

                        {/* LineChart: Progreso en diagnósticos */}
                        {lineChartData.length >= 2 && (
                            <div className="mck-chart-card mck-chart-card-full">
                                <LineChart
                                    data={lineChartData}
                                    title="Evolución en Diagnósticos"
                                    subtitle={`${diagnosticHistory.length} evaluaciones realizadas${improvement !== null ? ` • Tendencia: ${improvement > 0 ? '+' : ''}${improvement}%` : ''}`}
                                    height={200}
                                />
                            </div>
                        )}

                        {/* HorizontalBar: Rendimiento por tema */}
                        {topicBarData.length > 0 && (
                            <div className="mck-chart-card mck-chart-card-full">
                                <HorizontalBarChart
                                    data={topicBarData}
                                    title="Rendimiento por Tema"
                                    subtitle="Ordenado de mayor a menor dominio"
                                    maxValue={100}
                                    unit="%"
                                />
                            </div>
                        )}

                        {/* LineChart: Tendencia sesiones de tutoría */}
                        {sessionLineData.length >= 2 && (
                            <div className="mck-chart-card mck-chart-card-full">
                                <LineChart
                                    data={sessionLineData}
                                    title="Tendencia de Precisión en Tutorías"
                                    subtitle={`Últimas ${sessionLineData.length} sesiones`}
                                    height={180}
                                />
                            </div>
                        )}
                    </div>

                    {/* ═══════ EXTENDED ANALYTICS ═══════ */}
                    <div className="mck-chart-section animate-slide-up" style={{ animationDelay: '0.15s' }}>

                        {/* Gauge: Score promedio */}
                        <div className="mck-chart-card">
                            <GaugeChart
                                value={summary.overallAccuracy}
                                maxValue={100}
                                title="Índice de Rendimiento"
                                subtitle="Precisión general acumulada"
                                label="% Promedio"
                                height={170}
                            />
                        </div>

                        {/* ProgressRings: KPIs */}
                        <div className="mck-chart-card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <ProgressRing value={data.user.currentLevel} maxValue={5} size={68} color="#ff6900" label="Nivel" />
                            <ProgressRing value={summary.overallAccuracy} maxValue={100} size={68} label="Precisión" />
                            <ProgressRing value={summary.totalDiagnostics} maxValue={Math.max(summary.totalDiagnostics, 5)} size={68} color="#6366f1" label="Diagnósticos" />
                            <ProgressRing value={summary.totalTutoringSessions} maxValue={Math.max(summary.totalTutoringSessions, 10)} size={68} color="#06b6d4" label="Sesiones" />
                        </div>

                        {/* Scatter: Rendimiento por tema con tiempo */}
                        {topicStats.length > 0 && (
                            <div className="mck-chart-card mck-chart-card-full">
                                <ScatterChart
                                    data={topicStats.map(t => ({
                                        x: Math.round(t.avgTimeMs / 1000),
                                        y: t.percentage,
                                        label: t.topic.replace('Pensamiento ', 'P. '),
                                        color: t.percentage >= 70 ? '#10b981' : t.percentage >= 40 ? '#f59e0b' : '#ef4444',
                                        size: Math.max(4, Math.min(10, t.total)),
                                    }))}
                                    title="Análisis: Tiempo vs Dominio por Tema"
                                    subtitle="Tamaño del punto = cantidad de preguntas. Hover para detalles."
                                    xLabel="Tiempo promedio (s)"
                                    yLabel="Dominio (%)"
                                    height={200}
                                />
                            </div>
                        )}

                        {/* Heatmap: Topic scores across diagnostics */}
                        {diagnosticHistory.length >= 2 && topicStats.length > 0 && (() => {
                            const topics = [...new Set(topicStats.map(t => t.topic))].slice(0, 6);
                            const heatData = diagnosticHistory.slice(-5).map(d => {
                                return topics.map(t => {
                                    const ts = d.topicScores || {};
                                    const topicData = ts[t];
                                    if (topicData && topicData.total > 0) return Math.round((topicData.correct / topicData.total) * 100);
                                    return 0;
                                });
                            });
                            const diagLabels = diagnosticHistory.slice(-5).map((d, i) => `D${i + 1}`);
                            return (
                                <div className="mck-chart-card mck-chart-card-full">
                                    <HeatmapChart
                                        data={heatData}
                                        rows={diagLabels}
                                        cols={topics.map(t => t.replace('Pensamiento ', 'P. '))}
                                        title="Mapa de Calor: Progreso por Tema"
                                        subtitle="Rendimiento en cada diagnóstico por área"
                                        height={Math.max(120, diagLabels.length * 40 + 50)}
                                    />
                                </div>
                            );
                        })()}
                    </div>

                    {/* 2-column layout for detailed data */}
                    <div className="layout-2col">


                    {/* Left column */}
                    <div>
                    {/* Historial de Diagnósticos - tabla detallada */}
                    {diagnosticHistory.length > 0 && (
                        <div className="card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                📋 Detalle de Diagnósticos
                                {diagnosticHistory.length >= 2 && (
                                    <span style={{
                                        fontSize: '0.75rem', padding: '2px 8px', borderRadius: '12px',
                                        background: improvement > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                        color: improvement > 0 ? '#10b981' : '#ef4444'
                                    }}>
                                        {improvement > 0 ? `+${improvement}% mejora` : `${improvement}% cambio`}
                                    </span>
                                )}
                            </h2>

                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>#</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--text-muted)' }}>Fecha</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Puntaje</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Nivel</th>
                                            <th style={{ padding: '0.5rem', textAlign: 'right', color: 'var(--text-muted)' }}>Tiempo</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {diagnosticHistory.map((d, i) => (
                                            <tr key={d.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{i + 1}</td>
                                                <td style={{ padding: '0.5rem' }}>{new Date(d.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    <span style={{
                                                        fontWeight: 700,
                                                        color: d.percentage >= 60 ? '#10b981' : d.percentage >= 40 ? '#f59e0b' : '#ef4444'
                                                    }}>
                                                        {d.score}/{d.total} ({d.percentage}%)
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                                                    <span style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(99,102,241,0.15)', color: '#6366f1' }}>
                                                        Nivel {d.assignedLevel}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '0.5rem', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                                                    {d.totalTimeMs ? formatTime(d.totalTimeMs) : '-'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Rendimiento por Tema - detailed list */}
                    {topicStats.length > 0 && (
                        <div className="card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                🧠 Detalle por Tema
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {topicStats.map((t, i) => (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                                            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{t.topic}</span>
                                            <span style={{
                                                fontSize: '0.8rem', fontWeight: 700,
                                                color: t.percentage >= 70 ? '#10b981' : t.percentage >= 40 ? '#f59e0b' : '#ef4444'
                                            }}>
                                                {t.percentage}% ({t.correct}/{t.total})
                                            </span>
                                        </div>
                                        <div style={{ width: '100%', height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${t.percentage}%`,
                                                height: '100%', borderRadius: 4,
                                                background: t.percentage >= 70 ? 'linear-gradient(90deg, #10b981, #34d399)' :
                                                    t.percentage >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' :
                                                        'linear-gradient(90deg, #ef4444, #f87171)',
                                                transition: 'width 0.8s ease',
                                            }} />
                                        </div>
                                        {t.avgTimeMs > 0 && (
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                Tiempo promedio: {Math.round(t.avgTimeMs / 1000)}s por pregunta
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    </div>{/* End left column */}

                    {/* Right column */}
                    <div>
                    {/* Perfil Cognitivo */}
                    {cognitiveProfile && (
                        <div className="card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                🎯 Perfil Cognitivo
                            </h2>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                {cognitiveProfile.strongTopics?.length > 0 && (
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.15)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#10b981', marginBottom: '0.5rem' }}>✅ Fortalezas</div>
                                        {cognitiveProfile.strongTopics.map((t, i) => (
                                            <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.15rem 0' }}>{t}</div>
                                        ))}
                                    </div>
                                )}
                                {cognitiveProfile.weakTopics?.length > 0 && (
                                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)' }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#ef4444', marginBottom: '0.5rem' }}>⚠️ Por Mejorar</div>
                                        {cognitiveProfile.weakTopics.map((t, i) => (
                                            <div key={i} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '0.15rem 0' }}>{t}</div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                <MiniStat label="Velocidad" value={
                                    cognitiveProfile.learningSpeed === 'fast' ? '⚡ Rápido' :
                                    cognitiveProfile.learningSpeed === 'slow' ? '🐢 Lento' : '📚 Normal'
                                } />
                                <MiniStat label="Sesiones" value={cognitiveProfile.totalSessions || 0} />
                                <MiniStat label="Minutos" value={cognitiveProfile.totalMinutes || 0} />
                            </div>

                            {cognitiveProfile.lastSummary && (
                                <div style={{ marginTop: '1rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                    <strong>📝 Última sesión:</strong> {cognitiveProfile.lastSummary}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actividad Reciente */}
                    {dailyActivity.length > 0 && (
                        <div className="card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                📅 Actividad (30 días)
                            </h2>
                            <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                                {generateLast30Days().map(day => {
                                    const activity = dailyActivity.find(a => a.date === day);
                                    const intensity = activity ? Math.min(activity.sessions * 0.3 + 0.2, 1) : 0;
                                    return (
                                        <div
                                            key={day}
                                            title={activity ? `${day}: ${activity.sessions} sesiones, ${activity.correct}/${activity.total} correctas` : day}
                                            style={{
                                                width: 18, height: 18, borderRadius: 3,
                                                background: intensity > 0
                                                    ? `rgba(255, 105, 0, ${intensity})`
                                                    : 'var(--bg-input)',
                                                border: '1px solid rgba(255,255,255,0.05)',
                                                cursor: 'pointer',
                                            }}
                                        />
                                    );
                                })}
                            </div>
                            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                <span>Menos</span>
                                {[0.15, 0.3, 0.5, 0.8, 1].map(o => (
                                    <div key={o} style={{ width: 12, height: 12, borderRadius: 2, background: `rgba(255, 105, 0, ${o})` }} />
                                ))}
                                <span>Más</span>
                            </div>
                        </div>
                    )}

                    {/* Historial de Tutorías */}
                    {tutoringSessions.length > 0 && (
                        <div className="card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1rem' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem' }}>
                                💬 Sesiones de Tutoría ({tutoringSessions.length})
                            </h2>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {tutoringSessions.slice(-10).reverse().map((s, i) => (
                                    <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                                        <div style={{ fontSize: '0.8rem' }}>
                                            <span style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(s.date).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                            </span>
                                            <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                                {s.totalInteractions} interacciones
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: s.accuracy >= 70 ? '#10b981' : s.accuracy >= 40 ? '#f59e0b' : '#ef4444' }}>
                                                {s.accuracy}%
                                            </span>
                                            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                                {s.questionsCorrect}/{s.questionsAttempted}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Acciones */}
                    <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem' }}>🚀 Acciones</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <Link href="/tutor" className="btn btn-primary" style={{ width: '100%' }}>
                                Ir al Tutor
                            </Link>
                            <Link href="/diagnostic" className="btn btn-secondary" style={{ width: '100%' }}>
                                Diagnóstico
                            </Link>
                            <Link href="/dashboard" className="btn btn-secondary" style={{ width: '100%' }}>
                                Dashboard
                            </Link>
                        </div>
                    </div>

                    </div>{/* End right column */}
                    </div>{/* End 2-column layout */}
            </main>
        </div>
    );
}

function StatCard({ icon, value, label, color }) {
    return (
        <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '0.25rem' }}>{icon}</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: color || 'var(--text-primary)' }}>{value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{label}</div>
        </div>
    );
}

function MiniStat({ label, value }) {
    return (
        <div style={{ padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-input)', fontSize: '0.8rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
            <span style={{ fontWeight: 600 }}>{value}</span>
        </div>
    );
}

function NavBar({ session }) {
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
                <Link href="/diagnostic" className="nav-link">Diagnóstico</Link>
                <Link href="/analytics" className="nav-link active">Analítica</Link>
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
    );
}

function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const min = Math.floor(totalSec / 60);
    const sec = totalSec % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
}

function generateLast30Days() {
    const days = [];
    for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
        days.push(d.toISOString().split('T')[0]);
    }
    return days;
}
