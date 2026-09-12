'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { RadarChart, DonutChart, BarChart, HorizontalBarChart } from '@/components/Charts';

export default function GroupReportPage() {
    const router = useRouter();
    const params = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const grade = params.grade;

    useEffect(() => {
        const token = sessionStorage.getItem('adminToken');
        if (!token) { router.push('/admin'); return; }
        fetchReport(token);
    }, [router, grade]);

    const fetchReport = async (token) => {
        try {
            const res = await fetch(`/api/admin/group-report/${grade}`, {
                headers: { Authorization: 'Bearer ' + token },
            });
            if (res.status === 401) { sessionStorage.removeItem('adminToken'); router.push('/admin'); return; }
            const result = await res.json();
            if (!result.success) { setError(result.error || result.message || 'Error al obtener informe'); }
            setData(result);
        } catch (e) {
            setError('Error al cargar el informe');
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
                <p className="loading-text">Generando informe del grado {grade}°... (el análisis IA puede tardar unos segundos)</p>
            </div>
        );
    }

    if (error || !data?.report) {
        return (
            <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
                <div className="card" style={{ padding: '2rem', textAlign: 'center', maxWidth: 420 }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
                    <p style={{ color: error ? 'var(--error)' : 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                        {error || data?.message || 'No hay datos disponibles'}
                    </p>
                    <Link href="/admin/dashboard" className="btn btn-primary">← Volver al Dashboard</Link>
                </div>
            </div>
        );
    }

    const report = data.report;

    return (
        <div className="app-container">
            <nav className="navbar" style={{ borderBottom: '2px solid rgba(16, 185, 129, 0.3)' }}>
                <Link href="/admin/dashboard" className="navbar-brand">
                    <div className="navbar-logo">🔐</div>
                    <span className="navbar-title">Admin Panel</span>
                </Link>
                <div className="navbar-nav">
                    <Link href="/admin/dashboard" className="nav-link">← Volver</Link>
                </div>
            </nav>

            <main className="main-content" style={{ padding: '2rem' }}>
                {/* Encabezado del informe */}
                <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <span style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 48, height: 48, borderRadius: '12px',
                            background: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.05))',
                            fontSize: '1.5rem',
                        }}>🎓</span>
                        <div>
                            <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '0.15rem' }}>
                                Informe del Grado {grade}°
                            </h1>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                {data.totalStudents} estudiante{data.totalStudents !== 1 ? 's' : ''} registrado{data.totalStudents !== 1 ? 's' : ''}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Métricas generales */}
                <div className="stats-grid animate-slide-up" style={{ marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <div className="stat-icon">🎯</div>
                        <div className="stat-value" style={{
                            color: report.rendimientoPromedio >= 70 ? '#10b981' :
                                report.rendimientoPromedio >= 40 ? '#f59e0b' : '#ef4444'
                        }}>
                            {report.rendimientoPromedio}%
                        </div>
                        <div className="stat-label">Rendimiento Promedio</div>
                        <div style={{ marginTop: '0.5rem', height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                            <div style={{
                                width: `${report.rendimientoPromedio}%`, height: '100%', borderRadius: 2,
                                background: report.rendimientoPromedio >= 70 ? 'var(--gradient-success)' :
                                    report.rendimientoPromedio >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)'
                            }} />
                        </div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-value">{report.nivelPromedio}</div>
                        <div className="stat-label">Nivel Promedio</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⚡</div>
                        <div className="stat-value">{report.nivelDificultadPromedio}</div>
                        <div className="stat-label">Dificultad Alcanzada</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">⏱️</div>
                        <div className="stat-value">{report.tiempoPromedio}s</div>
                        <div className="stat-label">Tiempo Prom./Pregunta</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-value">{report.totalSessions}</div>
                        <div className="stat-label">Sesiones Totales</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">💬</div>
                        <div className="stat-value">{report.totalInteractions}</div>
                        <div className="stat-label">Interacciones Totales</div>
                    </div>
                </div>

                {/* === ANÁLISIS IA DEL GRUPO === */}
                {report.aiGroupReport && (
                    <div style={{ marginBottom: '2rem' }}>
                        {/* Encabezado de sección IA */}
                        <div className="card" style={{
                            padding: '1.5rem',
                            marginBottom: '1.5rem',
                            background: 'linear-gradient(135deg, rgba(139,92,246,0.06), rgba(59,130,246,0.04))',
                            border: '1px solid rgba(139,92,246,0.15)',
                        }}>
                            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#8b5cf6' }}>
                                🧠 Análisis IA del Grupo
                            </h2>

                            {/* Diagnóstico general */}
                            <div style={{
                                padding: '1rem 1.25rem', borderRadius: 'var(--radius-md)',
                                background: 'rgba(139,92,246,0.04)', borderLeft: '4px solid #8b5cf6',
                                lineHeight: 1.7, fontSize: '0.88rem', color: 'var(--text-primary)',
                            }}>
                                {report.aiGroupReport.diagnosticoGrupal}
                            </div>

                            {/* Nivel general vs esperado */}
                            {report.aiGroupReport.nivelGeneralGrupo && (
                                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: 140, padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.1)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#3b82f6' }}>
                                            {report.aiGroupReport.nivelGeneralGrupo.estimado}°
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Nivel Estimado</div>
                                    </div>
                                    <div style={{ flex: 1, minWidth: 140, padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.1)', textAlign: 'center' }}>
                                        <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981' }}>
                                            {report.aiGroupReport.nivelGeneralGrupo.esperado}°
                                        </div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Nivel Esperado</div>
                                    </div>
                                    <div style={{ flex: 3, minWidth: 250, padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)', display: 'flex', alignItems: 'center' }}>
                                        <div>
                                            <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.25rem' }}>📏 Brecha Académica</div>
                                            <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                {report.aiGroupReport.nivelGeneralGrupo.brecha}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Rendimiento por Pensamiento Matemático (MEN) */}
                        {report.aiGroupReport.rendimientoPorPensamiento && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📐 Rendimiento por Pensamiento Matemático (MEN)
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {[
                                        { key: 'numerico', label: 'Pensamiento Numérico', icon: '🔢', color: '#6366f1' },
                                        { key: 'variacional', label: 'Pensamiento Variacional', icon: '📈', color: '#f59e0b' },
                                        { key: 'espacialMetrico', label: 'Pensamiento Espacial y Métrico', icon: '📐', color: '#10b981' },
                                        { key: 'aleatorio', label: 'Pensamiento Aleatorio y Datos', icon: '🎲', color: '#3b82f6' },
                                    ].map(p => {
                                        const penData = report.aiGroupReport.rendimientoPorPensamiento[p.key];
                                        if (!penData) return null;
                                        const pct = penData.porcentaje || 0;
                                        const estadoColors = {
                                            'adecuado': '#10b981', 'en desarrollo': '#f59e0b',
                                            'critico': '#ef4444', 'sin datos': 'var(--text-muted)'
                                        };
                                        return (
                                            <div key={p.key}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.icon} {p.label}</span>
                                                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                                                        <span style={{
                                                            fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
                                                            padding: '2px 8px', borderRadius: '8px',
                                                            background: `${estadoColors[penData.estado] || 'var(--text-muted)'}18`,
                                                            color: estadoColors[penData.estado] || 'var(--text-muted)',
                                                        }}>
                                                            {penData.estado}
                                                        </span>
                                                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: p.color }}>{pct}%</span>
                                                    </div>
                                                </div>
                                                <div style={{ height: 10, borderRadius: 5, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${pct}%`, height: '100%', borderRadius: 5,
                                                        background: `linear-gradient(90deg, ${p.color}, ${p.color}88)`,
                                                        transition: 'width 0.5s ease',
                                                    }} />
                                                </div>
                                                {penData.observacion && (
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontStyle: 'italic' }}>
                                                        {penData.observacion}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Temas más y menos dominados (IA) */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                            {/* Más dominados */}
                            {(report.aiGroupReport.temasMasDominados || []).length > 0 && (
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        🏆 Temas Más Dominados (IA)
                                    </h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {report.aiGroupReport.temasMasDominados.map((t, i) => (
                                            <div key={i} style={{
                                                padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(16,185,129,0.05)', borderLeft: '3px solid #10b981',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.83rem' }}>{t.tema}</span>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981' }}>{t.porcentajeDominio}%</span>
                                                </div>
                                                {t.pensamiento && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t.pensamiento}</div>}
                                                {t.comentario && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{t.comentario}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Menos dominados */}
                            {(report.aiGroupReport.temasMenosDominados || []).length > 0 && (
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        ⚠️ Temas Menos Dominados (IA)
                                    </h2>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {report.aiGroupReport.temasMenosDominados.map((t, i) => (
                                            <div key={i} style={{
                                                padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)',
                                                background: 'rgba(239,68,68,0.04)', borderLeft: '3px solid #ef4444',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <span style={{ fontWeight: 600, fontSize: '0.83rem' }}>{t.tema}</span>
                                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#ef4444' }}>{t.porcentajeDominio}%</span>
                                                </div>
                                                {t.pensamiento && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{t.pensamiento}</div>}
                                                {t.comentario && <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>{t.comentario}</div>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Debilidades colectivas */}
                        {(report.aiGroupReport.debilidadesColectivas || []).length > 0 && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🔴 Debilidades Colectivas
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                    {report.aiGroupReport.debilidadesColectivas.map((d, i) => {
                                        const gravedadColors = { alta: '#ef4444', media: '#f59e0b', baja: '#3b82f6' };
                                        return (
                                            <div key={i} style={{
                                                padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                                                background: `${gravedadColors[d.gravedad] || '#6366f1'}08`,
                                                border: `1px solid ${gravedadColors[d.gravedad] || '#6366f1'}20`,
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>{d.debilidad}</span>
                                                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                        <span style={{
                                                            fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: '6px',
                                                            background: `${gravedadColors[d.gravedad] || '#6366f1'}18`,
                                                            color: gravedadColors[d.gravedad] || '#6366f1',
                                                            textTransform: 'uppercase',
                                                        }}>
                                                            {d.gravedad}
                                                        </span>
                                                        {d.estudiantesAfectados && (
                                                            <span style={{ fontSize: '0.65rem', fontWeight: 600, padding: '2px 7px', borderRadius: '6px', background: 'var(--bg-input)', color: 'var(--text-muted)' }}>
                                                                {d.estudiantesAfectados}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {d.impactoAcademico && (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                                        {d.impactoAcademico}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Patrones de error */}
                        {(report.aiGroupReport.patronesDeError || []).length > 0 && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🔄 Patrones de Error Detectados (IA)
                                </h2>
                                <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    {report.aiGroupReport.patronesDeError.map((p, i) => {
                                        const typeColors = { conceptual: '#ef4444', procedimental: '#f59e0b', aritmetico: '#3b82f6', interpretacion: '#a855f7' };
                                        return (
                                            <div key={i} style={{
                                                padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)',
                                                background: `${typeColors[p.tipo] || '#6366f1'}08`,
                                                border: `1px solid ${typeColors[p.tipo] || '#6366f1'}18`,
                                                flex: '1 1 250px',
                                            }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.25rem' }}>{p.patron}</div>
                                                <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: `${typeColors[p.tipo] || '#6366f1'}15`, color: typeColors[p.tipo] || '#6366f1', textTransform: 'capitalize' }}>
                                                        {p.tipo}
                                                    </span>
                                                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>{p.frecuencia}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Recomendaciones pedagógicas */}
                        {(report.aiGroupReport.recomendacionesPedagogicas || []).length > 0 && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(16,185,129,0.04), rgba(59,130,246,0.03))', border: '1px solid rgba(16,185,129,0.12)' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    📝 Recomendaciones Pedagógicas
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                                    {report.aiGroupReport.recomendacionesPedagogicas.map((r, i) => {
                                        const prioColors = { alta: '#ef4444', media: '#f59e0b', baja: '#10b981' };
                                        return (
                                            <div key={i} style={{
                                                padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                                                background: 'rgba(255,255,255,0.04)',
                                                borderLeft: `4px solid ${prioColors[r.prioridad] || '#6366f1'}`,
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', flex: 1 }}>{r.recomendacion}</span>
                                                    <span style={{
                                                        fontSize: '0.6rem', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                                                        background: `${prioColors[r.prioridad] || '#6366f1'}15`,
                                                        color: prioColors[r.prioridad] || '#6366f1',
                                                        textTransform: 'uppercase', whiteSpace: 'nowrap', marginLeft: '0.5rem',
                                                    }}>
                                                        {r.prioridad}
                                                    </span>
                                                </div>
                                                {r.temaRelacionado && (
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: '0.2rem' }}>
                                                        📌 Tema: {r.temaRelacionado}
                                                    </div>
                                                )}
                                                {r.estrategiaSugerida && (
                                                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: '0.2rem' }}>
                                                        💡 {r.estrategiaSugerida}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Plan de acción */}
                        {report.aiGroupReport.planDeAccion && report.aiGroupReport.planDeAccion.metaPrincipal && (
                            <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.04), rgba(139,92,246,0.03))', border: '1px solid rgba(99,102,241,0.12)' }}>
                                <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#6366f1', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🗺️ Plan de Acción
                                </h2>
                                <p style={{ fontSize: '0.88rem', color: 'var(--text-primary)', marginBottom: '1rem', fontWeight: 600 }}>
                                    🎯 Meta: {report.aiGroupReport.planDeAccion.metaPrincipal}
                                </p>

                                {(report.aiGroupReport.planDeAccion.fasesDeAccion || []).length > 0 && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                                        {report.aiGroupReport.planDeAccion.fasesDeAccion.map((fase, i) => (
                                            <div key={i} style={{
                                                padding: '0.85rem 1rem', borderRadius: 'var(--radius-md)',
                                                background: 'rgba(99,102,241,0.04)',
                                                border: '1px solid rgba(99,102,241,0.08)',
                                            }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                                                    <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#6366f1' }}>{fase.fase}</span>
                                                    {fase.duracion && <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600 }}>⏱ {fase.duracion}</span>}
                                                </div>
                                                {(fase.actividades || []).length > 0 && (
                                                    <ul style={{ margin: '0.3rem 0 0 1.2rem', padding: 0, fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                                        {fase.actividades.map((a, j) => <li key={j}>{a}</li>)}
                                                    </ul>
                                                )}
                                                {(fase.temasACubrir || []).length > 0 && (
                                                    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap', marginTop: '0.4rem' }}>
                                                        {fase.temasACubrir.map((t, j) => (
                                                            <span key={j} style={{ fontSize: '0.65rem', padding: '2px 7px', borderRadius: '6px', background: 'rgba(99,102,241,0.1)', color: '#6366f1', fontWeight: 600 }}>
                                                                {t}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {(report.aiGroupReport.planDeAccion.indicadoresDeExito || []).length > 0 && (
                                    <div>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.3rem' }}>📊 Indicadores de Éxito:</div>
                                        <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                            {report.aiGroupReport.planDeAccion.indicadoresDeExito.map((ind, i) => <li key={i}>{ind}</li>)}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Alertas para el docente */}
                        {(report.aiGroupReport.alertasDocente || []).length > 0 && (
                            <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
                                <h2 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    🚨 Alertas para el Docente
                                </h2>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                    {report.aiGroupReport.alertasDocente.map((alerta, i) => (
                                        <div key={i} style={{
                                            padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                                            background: 'rgba(245,158,11,0.08)', fontSize: '0.83rem', lineHeight: 1.5,
                                            borderLeft: '3px solid #f59e0b',
                                        }}>
                                            {alerta}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════ MCKINSEY CHARTS SECTION ═══════ */}
                <div className="mck-chart-section animate-slide-up">

                    {/* Radar: Pensamiento matemático */}
                    {report.aiGroupReport?.rendimientoPorPensamiento && (
                        <div className="mck-chart-card">
                            <RadarChart
                                data={[
                                    { key: 'numerico', label: 'Numérico', icon: '🔢', color: '#6366f1' },
                                    { key: 'variacional', label: 'Variacional', icon: '📈', color: '#f59e0b' },
                                    { key: 'espacialMetrico', label: 'Espacial', icon: '📐', color: '#10b981' },
                                    { key: 'aleatorio', label: 'Aleatorio', icon: '🎲', color: '#3b82f6' },
                                ].map(p => ({
                                    label: p.label,
                                    value: report.aiGroupReport.rendimientoPorPensamiento[p.key]?.porcentaje || 0,
                                    color: p.color,
                                }))}
                                title="Pensamiento Matemático (MEN)"
                                subtitle="Perfil de competencias del grupo"
                                maxValue={100}
                                height={260}
                            />
                        </div>
                    )}

                    {/* Donut: Distribución de errores por tipo */}
                    {Object.keys(report.distribucionErrores || {}).length > 0 && (
                        <div className="mck-chart-card">
                            <DonutChart
                                data={Object.entries(report.distribucionErrores).map(([type, count]) => {
                                    const colors = { conceptual: '#ef4444', procedimental: '#f59e0b', aritmetico: '#3b82f6', interpretacion: '#a855f7' };
                                    return { label: type.charAt(0).toUpperCase() + type.slice(1), value: count, color: colors[type] || '#6b7280' };
                                })}
                                title="Tipos de Error"
                                subtitle="Distribución de errores del grupo"
                                centerValue={Object.values(report.distribucionErrores).reduce((s, v) => s + v, 0)}
                                centerLabel="errores"
                                height={260}
                            />
                        </div>
                    )}

                    {/* BarChart: Comparación de rendimiento por estudiante */}
                    {report.estudiantes?.length > 0 && (
                        <div className="mck-chart-card mck-chart-card-full">
                            <BarChart
                                data={[...report.estudiantes]
                                    .sort((a, b) => (b.rendimiento || 0) - (a.rendimiento || 0))
                                    .map(est => ({
                                        label: est.nombre?.split(' ')[0] || est.username,
                                        value: est.rendimiento || 0,
                                        color: (est.rendimiento || 0) >= 70 ? '#10b981' : (est.rendimiento || 0) >= 40 ? '#f59e0b' : '#ef4444',
                                    }))}
                                title="Rendimiento Individual"
                                subtitle="Comparación entre estudiantes del grado"
                                height={220}
                            />
                        </div>
                    )}

                    {/* HorizontalBar: Temas más/menos dominados */}
                    {(report.aiGroupReport?.temasMasDominados || []).length > 0 && (
                        <div className="mck-chart-card">
                            <HorizontalBarChart
                                data={(report.aiGroupReport.temasMasDominados || []).map(t => ({
                                    label: t.tema,
                                    value: t.porcentajeDominio || 0,
                                    color: '#10b981',
                                }))}
                                title="🏆 Temas Más Dominados"
                                subtitle="Fortalezas del grupo"
                                maxValue={100}
                                unit="%"
                            />
                        </div>
                    )}

                    {(report.aiGroupReport?.temasMenosDominados || []).length > 0 && (
                        <div className="mck-chart-card">
                            <HorizontalBarChart
                                data={(report.aiGroupReport.temasMenosDominados || []).map(t => ({
                                    label: t.tema,
                                    value: t.porcentajeDominio || 0,
                                    color: '#ef4444',
                                }))}
                                title="⚠️ Temas Menos Dominados"
                                subtitle="Áreas críticas del grupo"
                                maxValue={100}
                                unit="%"
                            />
                        </div>
                    )}

                    {/* Donut: Errores por dificultad */}
                    {(report.distribucionDificultad.facil > 0 || report.distribucionDificultad.media > 0 || report.distribucionDificultad.dificil > 0) && (
                        <div className="mck-chart-card">
                            <DonutChart
                                data={[
                                    { label: 'Fácil', value: report.distribucionDificultad.facil, color: '#10b981' },
                                    { label: 'Media', value: report.distribucionDificultad.media, color: '#f59e0b' },
                                    { label: 'Difícil', value: report.distribucionDificultad.dificil, color: '#ef4444' },
                                ].filter(d => d.value > 0)}
                                title="Errores por Dificultad"
                                subtitle="Distribución en diagnósticos"
                                centerValue={report.distribucionDificultad.facil + report.distribucionDificultad.media + report.distribucionDificultad.dificil}
                                centerLabel="total"
                                height={220}
                            />
                        </div>
                    )}

                    {/* Bar: progreso por temas */}
                    {report.progresoPorTemas?.length > 0 && (
                        <div className="mck-chart-card">
                            <HorizontalBarChart
                                data={report.progresoPorTemas.map(t => ({
                                    label: t.tema,
                                    value: Math.round(t.masteryPromedio * 100),
                                    color: Math.round(t.masteryPromedio * 100) >= 65 ? '#10b981' : Math.round(t.masteryPromedio * 100) >= 35 ? '#f59e0b' : '#ef4444',
                                }))}
                                title="Dominio por Tema"
                                subtitle="Promedio de mastery del grupo"
                                maxValue={100}
                                unit="%"
                            />
                        </div>
                    )}
                </div>

                <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📋 Resultados de Evaluación Diagnóstica
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem' }}>
                        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(16,185,129,0.06)', textAlign: 'center', border: '1px solid rgba(16,185,129,0.12)' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10b981' }}>{report.diagnosticos.completados}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Completados</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(245,158,11,0.06)', textAlign: 'center', border: '1px solid rgba(245,158,11,0.12)' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>{report.diagnosticos.pendientes}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Pendientes</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.06)', textAlign: 'center', border: '1px solid rgba(99,102,241,0.12)' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>{report.diagnosticos.scorePromedio}%</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score Promedio</div>
                        </div>
                        <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(139,92,246,0.06)', textAlign: 'center', border: '1px solid rgba(139,92,246,0.12)' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#8b5cf6' }}>{report.diagnosticos.nivelPromedio}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nivel Asignado Prom.</div>
                        </div>
                        {report.diagnosticos.tiempoPromedioMs > 0 && (
                            <div style={{ padding: '1rem', borderRadius: 'var(--radius-md)', background: 'rgba(59,130,246,0.06)', textAlign: 'center', border: '1px solid rgba(59,130,246,0.12)' }}>
                                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#3b82f6' }}>{formatTime(report.diagnosticos.tiempoPromedioMs)}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Tiempo Prom. Diagnóst.</div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fortalezas y Debilidades */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
                    {/* Fortalezas */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ✅ Fortalezas del Grupo
                        </h2>
                        {report.fortalezas.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {report.fortalezas.map((f, i) => (
                                    <div key={i} style={{
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(16,185,129,0.06)',
                                        borderLeft: '3px solid #10b981',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{f.tema}</span>
                                        <span style={{
                                            fontSize: '0.75rem', fontWeight: 700, color: '#10b981',
                                            padding: '2px 8px', borderRadius: '8px',
                                            background: 'rgba(16,185,129,0.12)',
                                        }}>
                                            {f.mastery !== null ? `${Math.round(f.mastery * 100)}%` : `${f.mencionadoPor} est.`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                                Sin datos de fortalezas aún
                            </p>
                        )}
                    </div>

                    {/* Debilidades */}
                    <div className="card" style={{ padding: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            ⚠️ Debilidades del Grupo
                        </h2>
                        {report.debilidades.length > 0 ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {report.debilidades.map((d, i) => (
                                    <div key={i} style={{
                                        padding: '0.65rem 0.85rem',
                                        borderRadius: 'var(--radius-sm)',
                                        background: 'rgba(239,68,68,0.05)',
                                        borderLeft: '3px solid #ef4444',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{d.tema}</span>
                                        <span style={{
                                            fontSize: '0.75rem', fontWeight: 700, color: '#ef4444',
                                            padding: '2px 8px', borderRadius: '8px',
                                            background: 'rgba(239,68,68,0.1)',
                                        }}>
                                            {d.mastery !== null ? `${Math.round(d.mastery * 100)}%` : `${d.mencionadoPor} est.`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>
                                Sin datos de debilidades aún
                            </p>
                        )}
                    </div>
                </div>

                {/* Progreso por temas */}
                {report.progresoPorTemas.length > 0 && (
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📈 Progreso por Temas
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            {report.progresoPorTemas.map((t, i) => {
                                const masteryPct = Math.round(t.masteryPromedio * 100);
                                const barColor = masteryPct >= 65 ? '#10b981' : masteryPct >= 35 ? '#f59e0b' : '#ef4444';
                                return (
                                    <div key={i}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.3rem' }}>
                                            <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>{t.tema}</span>
                                            <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                <span>{t.totalCorrectas}/{t.totalPreguntas} correctas</span>
                                                <span>{t.estudiantesQueLoDomin}/{t.estudiantesQueLoPracticaron} dominan</span>
                                                <span style={{ fontWeight: 700, color: barColor }}>{masteryPct}%</span>
                                            </div>
                                        </div>
                                        <div style={{ height: 8, borderRadius: 4, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                            <div style={{
                                                width: `${masteryPct}%`, height: '100%', borderRadius: 4,
                                                background: `linear-gradient(90deg, ${barColor}, ${barColor}88)`,
                                                transition: 'width 0.5s ease',
                                            }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Errores por tema */}
                {report.erroresPorTema.length > 0 && (
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📊 Errores por Tema (Diagnósticos)
                        </h2>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {report.erroresPorTema.map((e, i) => (
                                <div key={i} style={{
                                    padding: '0.75rem 1.25rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: 'rgba(239,68,68,0.06)',
                                    border: '1px solid rgba(239,68,68,0.12)',
                                    textAlign: 'center',
                                }}>
                                    <div style={{ fontWeight: 700, fontSize: '1.2rem', color: '#ef4444' }}>{e.errores}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{e.tema}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Distribución de errores por tipo */}
                {Object.keys(report.distribucionErrores).length > 0 && (
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            🔍 Distribución de Errores por Tipo
                        </h2>
                        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                            {Object.entries(report.distribucionErrores).map(([type, count]) => {
                                const colors = {
                                    conceptual: { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.15)', text: '#ef4444' },
                                    procedimental: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', text: '#f59e0b' },
                                    aritmetico: { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', text: '#3b82f6' },
                                    interpretacion: { bg: 'rgba(168,85,247,0.08)', border: 'rgba(168,85,247,0.15)', text: '#a855f7' },
                                };
                                const c = colors[type] || { bg: 'var(--bg-input)', border: 'var(--border-color)', text: 'var(--text-primary)' };
                                return (
                                    <div key={type} style={{
                                        padding: '0.75rem 1.25rem',
                                        borderRadius: 'var(--radius-md)',
                                        background: c.bg, border: `1px solid ${c.border}`,
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontWeight: 700, fontSize: '1.2rem', color: c.text }}>{count}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>{type}</div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Distribución por dificultad */}
                {(report.distribucionDificultad.facil > 0 || report.distribucionDificultad.media > 0 || report.distribucionDificultad.dificil > 0) && (
                    <div className="card" style={{ padding: '1.5rem', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📉 Errores por Dificultad (Diagnósticos)
                        </h2>
                        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                            {[
                                { key: 'facil', label: 'Fácil', color: '#10b981', bg: 'rgba(16,185,129,0.08)' },
                                { key: 'media', label: 'Media', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)' },
                                { key: 'dificil', label: 'Difícil', color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
                            ].map(d => (
                                <div key={d.key} style={{
                                    flex: 1, minWidth: 120, padding: '1rem',
                                    borderRadius: 'var(--radius-md)',
                                    background: d.bg,
                                    textAlign: 'center',
                                    border: `1px solid ${d.color}22`,
                                }}>
                                    <div style={{ fontWeight: 800, fontSize: '1.5rem', color: d.color }}>
                                        {report.distribucionDificultad[d.key]}
                                    </div>
                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>errores en {d.label}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Tabla de estudiantes del grado */}
                <div className="card" style={{ padding: '1.5rem', overflow: 'auto' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        👥 Estudiantes del Grado {grade}°
                    </h2>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Estudiante</th>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nivel</th>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Diagnóstico</th>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Rendimiento</th>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sesiones</th>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Último Acceso</th>
                                <th style={{ padding: '0.6rem 0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {report.estudiantes.map((est) => (
                                <tr key={est.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <div style={{ fontWeight: 600 }}>{est.nombre}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{est.username}</div>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <span style={{
                                            display: 'inline-block', padding: '2px 10px', borderRadius: '12px',
                                            fontSize: '0.8rem', fontWeight: 700,
                                            background: est.nivel >= 4 ? 'rgba(16,185,129,0.15)' : est.nivel >= 2 ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                                            color: est.nivel >= 4 ? '#10b981' : est.nivel >= 2 ? '#f59e0b' : '#6366f1',
                                        }}>
                                            Nivel {est.nivel}
                                        </span>
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        {est.diagnosticoCompletado ? (
                                            <span style={{ fontWeight: 600, color: '#10b981' }}>✓ {est.diagnosticoScore}%</span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>Pendiente</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        {est.rendimiento !== null ? (
                                            <span style={{
                                                fontWeight: 700,
                                                color: est.rendimiento >= 70 ? '#10b981' : est.rendimiento >= 40 ? '#f59e0b' : '#ef4444',
                                            }}>
                                                {est.rendimiento}%
                                            </span>
                                        ) : (
                                            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>—</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontWeight: 600 }}>{est.totalSesiones}</td>
                                    <td style={{ padding: '0.6rem 0.75rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                        {est.ultimoAcceso ? new Date(est.ultimoAcceso).toLocaleDateString('es-CO') : 'Nunca'}
                                    </td>
                                    <td style={{ padding: '0.6rem 0.75rem' }}>
                                        <Link href={'/admin/student/' + est.id}
                                            className="btn btn-primary btn-sm"
                                            style={{ fontSize: '0.72rem', padding: '3px 10px' }}>
                                            Ver detalle
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
