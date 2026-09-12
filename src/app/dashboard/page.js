'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DonutChart, GaugeChart, ProgressRing, HorizontalBarChart } from '@/components/Charts';
import ThemeToggle from '@/components/ThemeToggle';

export default function DashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [stats, setStats] = useState(null);
    const [hasDiagnostic, setHasDiagnostic] = useState(null);
    const [teacherContents, setTeacherContents] = useState([]);
    const [unreadMessages, setUnreadMessages] = useState(0);

    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    useEffect(() => {
        if (session?.user?.id) {
            fetchStats();
            checkDiagnostic();
            fetchTeacherContent();
            fetchUnread();
        }
    }, [session]);

    const fetchUnread = async () => {
        try {
            const res = await fetch('/api/messages/unread');
            if (res.ok) {
                const data = await res.json();
                setUnreadMessages(data.total || 0);
            }
        } catch (e) { /* silent */ }
    };

    const fetchStats = async () => {
        try {
            const res = await fetch('/api/stats');
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (e) {
            console.error('Error fetching stats:', e);
        }
    };

    const checkDiagnostic = async () => {
        try {
            const res = await fetch('/api/diagnostic');
            if (res.ok) {
                const data = await res.json();
                setHasDiagnostic(data.completed);
            }
        } catch (e) {
            console.error('Error checking diagnostic:', e);
        }
    };

    const fetchTeacherContent = async () => {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            const res = await fetch('/api/student/content', { signal: controller.signal });
            clearTimeout(timeout);
            if (res.ok) {
                const data = await res.json();
                setTeacherContents(data.contents || []);
            }
        } catch (e) {
            // Silently fail - teacher content is optional
        }
    };

    if (status === 'loading' || !session) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando dashboard...</p>
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
                    <Link href="/dashboard" className="nav-link active">Dashboard</Link>
                    <Link href="/pruebas-estado" className="nav-link">Pruebas de Estado</Link>
                    <Link href="/tutor" className="nav-link">Tutor</Link>
                    <Link href="/mensajes" className="nav-link" style={{ position: 'relative' }}>
                        💬 Mensajes
                        {unreadMessages > 0 && (
                            <span className="dm-nav-badge">{unreadMessages}</span>
                        )}
                    </Link>
                    <Link href="/diagnostic" className="nav-link">Diagnóstico</Link>
                    <Link href="/analytics" className="nav-link">Analítica</Link>
                </div>
                <div className="nav-user">
                    <ThemeToggle />
                    <div className="nav-user-info">
                        <div className="nav-user-name">{session.user.name}</div>
                        <div className="nav-user-level">
                            {session.user.schoolGrade ? `Grado ${session.user.schoolGrade}° • ` : ''}Nivel {session.user.currentLevel || 1}
                        </div>
                    </div>
                    <button className="btn-logout" onClick={() => signOut({ callbackUrl: '/' })}>
                        Salir
                    </button>
                </div>
            </nav>

            <main className="main-content dashboard">
                {/* ═══ HEADER + PERFIL ═══ */}
                <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '1.5rem', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <div>
                        <h1 className="dashboard-greeting">
                            ¡Hola, <span>{session.user.name}</span>! 👋
                        </h1>
                        <p className="dashboard-subtitle">
                            {hasDiagnostic === false
                                ? 'Comienza con tu evaluación diagnóstica para personalizar tu experiencia.'
                                : 'Continúa tu aprendizaje con YedaTech.'}
                        </p>
                    </div>
                    {/* Mini profile card in header */}
                    <div className="card" style={{ padding: '0.75rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', background: 'linear-gradient(145deg, var(--bg-card) 0%, rgba(255,105,0,0.06) 100%)' }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2rem', fontWeight: 800, color: '#fff', boxShadow: '0 0 15px rgba(255,105,0,0.3)', flexShrink: 0 }}>
                            {(session.user.name || 'E').charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{session.user.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {session.user.schoolGrade ? `Grado ${session.user.schoolGrade}°` : 'Estudiante'}
                            </div>
                        </div>
                        <div style={{ display: 'inline-flex', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(255,105,0,0.12)', border: '1px solid rgba(255,105,0,0.25)', color: 'var(--text-accent)', fontWeight: 700, fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                            Nivel {session.user.currentLevel || 1}
                        </div>
                    </div>
                </div>

                {/* ═══ STAT CARDS ═══ */}
                <div className="stats-grid animate-slide-up" style={{ animationDelay: '0.1s' }}>
                    {session.user.schoolGrade && (
                        <div className="stat-card">
                            <div className="stat-icon">🏫</div>
                            <div className="stat-value">{session.user.schoolGrade}°</div>
                            <div className="stat-label">Grado</div>
                        </div>
                    )}
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-value">{session.user.currentLevel || 1}</div>
                        <div className="stat-label">Nivel Actual</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-value">{stats?.totalCorrect || 0}</div>
                        <div className="stat-label">Respuestas Correctas</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-value">{stats?.totalSessions || 0}</div>
                        <div className="stat-label">Sesiones Completadas</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">🔥</div>
                        <div className="stat-value">{stats?.accuracy || 0}%</div>
                        <div className="stat-label">Precisión General</div>
                        <div style={{ marginTop: '0.5rem', height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                            <div style={{ width: `${stats?.accuracy || 0}%`, height: '100%', borderRadius: 2, background: (stats?.accuracy || 0) >= 70 ? 'var(--gradient-success)' : (stats?.accuracy || 0) >= 40 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : 'linear-gradient(90deg, #ef4444, #f87171)', transition: 'width 0.8s ease' }} />
                        </div>
                    </div>
                </div>

                {/* ═══ MCKINSEY CHARTS ═══ */}
                {stats && (
                    <div className="mck-chart-section animate-slide-up" style={{ animationDelay: '0.15s' }}>
                        <div className="mck-chart-card">
                            <GaugeChart
                                value={stats.accuracy || 0}
                                maxValue={100}
                                title="Precisión General"
                                subtitle="Tu rendimiento acumulado"
                                label="% Acierto"
                                height={170}
                            />
                        </div>
                        <div className="mck-chart-card">
                            <DonutChart
                                data={[
                                    { label: 'Correctas', value: stats.totalCorrect || 0, color: '#10b981' },
                                    { label: 'Incorrectas', value: stats.totalIncorrect || 0, color: '#ef4444' },
                                ]}
                                title="Distribución de Respuestas"
                                subtitle="Total acumulado"
                                centerValue={`${stats.totalCorrect || 0}`}
                                centerLabel="correctas"
                                height={170}
                            />
                        </div>
                        <div className="mck-chart-card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <ProgressRing value={session.user.currentLevel || 1} maxValue={5} size={64} color="#ff6900" label="Nivel" />
                            <ProgressRing value={stats.accuracy || 0} maxValue={100} size={64} label="Precisión" />
                            <ProgressRing value={stats.totalSessions || 0} maxValue={Math.max(stats.totalSessions || 1, 10)} size={64} color="#6366f1" label="Sesiones" />
                            <ProgressRing value={stats.totalCorrect || 0} maxValue={Math.max((stats.totalCorrect || 0) + (stats.totalIncorrect || 0), 1)} size={64} color="#06b6d4" label="✓ Total" />
                        </div>
                    </div>
                )}

                {/* ═══ CONTENIDO DEL PROFESOR (sección propia, fuera del grid 2-col) ═══ */}
                {teacherContents.length > 0 && (
                    <div className="animate-slide-up" style={{ animationDelay: '0.2s', marginBottom: '1.5rem' }}>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            📚 Contenido del Profesor
                        </h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                            {teacherContents.map(c => (
                                <Link key={c.id} href={`/content-practice/${c.id}`} className="card" style={{
                                    padding: '1.25rem', textDecoration: 'none', color: 'inherit', transition: 'all 0.2s',
                                    borderLeft: `4px solid ${c.bestScore >= 60 ? '#22c55e' : c.attempts > 0 ? '#f59e0b' : 'var(--primary)'}`,
                                }}>
                                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.3rem' }}>{c.title}</h3>
                                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>{c.topic} • {c.totalQuestions} preguntas</p>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.8rem' }}>
                                            {c.attempts > 0 ? (
                                                <>
                                                    <span style={{ color: c.bestScore >= 60 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>Mejor: {c.bestScore}%</span>
                                                    <span style={{ color: 'var(--text-secondary)' }}>{c.attempts} intentos</span>
                                                </>
                                            ) : (
                                                <span style={{ color: 'var(--primary)', fontWeight: 600 }}>Sin intentar</span>
                                            )}
                                        </div>
                                        <span style={{ fontSize: '1.2rem' }}>{c.bestScore >= 60 ? '✅' : c.attempts > 0 ? '📝' : '▶️'}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}

                {/* ═══ ACCIONES RÁPIDAS + SIDEBAR ═══ */}
                <div className="layout-main-sidebar animate-slide-up" style={{ animationDelay: '0.25s' }}>
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>🚀 Acciones Rápidas</h2>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
                            {hasDiagnostic === false && (
                                <Link href="/diagnostic" className="action-card" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
                                    <div className="action-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>📋</div>
                                    <h3 className="action-title">Evaluación Diagnóstica</h3>
                                    <p className="action-desc">
                                        Realiza tu examen inicial para que podamos conocer tu nivel y personalizar tu aprendizaje.
                                    </p>
                                    <div className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                                        Comenzar Diagnóstico
                                    </div>
                                </Link>
                            )}

                            {hasDiagnostic === true && (
                                <Link href="/diagnostic" className="action-card" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                                    <div className="action-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>📈</div>
                                    <h3 className="action-title">Repetir Diagnóstico</h3>
                                    <p className="action-desc">
                                        Vuelve a evaluar tu progreso con nuevas preguntas sobre los mismos temas para medir tu mejora.
                                    </p>
                                    <div className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                                        Medir Mi Progreso
                                    </div>
                                </Link>
                            )}

                            <Link href="/pruebas-estado" className="action-card" style={{ borderColor: 'rgba(255, 105, 0, 0.3)' }}>
                                <div className="action-icon" style={{ background: 'rgba(255, 105, 0, 0.15)' }}>📝</div>
                                <h3 className="action-title">Pruebas de Estado Saber 11</h3>
                                <p className="action-desc">
                                    Entrena bajo tiempo con el banco oficial de preguntas tipo ICFES (Saber 11) en formato LaTeX.
                                </p>
                                <div className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                                    Practicar Simulacro
                                </div>
                            </Link>

                            <Link href="/tutor" className="action-card">
                                <div className="action-icon purple">YT</div>
                                <h3 className="action-title">Tutor Socrático</h3>
                                <p className="action-desc">
                                    Practica matemáticas con tu tutor de IA. Te guiará con preguntas para que descubras la respuesta.
                                </p>
                                <div className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                                    Iniciar Sesión
                                </div>
                            </Link>

                            <Link href="/analytics" className="action-card" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
                                <div className="action-icon blue">📊</div>
                                <h3 className="action-title">Analítica Avanzada</h3>
                                <p className="action-desc">
                                    Visualiza tu progreso detallado, rendimiento por tema, historial de diagnósticos y más.
                                </p>
                                <div className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                                    Ver Analíticas
                                </div>
                            </Link>
                        </div>
                    </div>

                    {/* Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '80px' }}>
                        {/* Quick Stats Card */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>📈 Resumen Rápido</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Interacciones</span>
                                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{stats?.totalInteractions || 0}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Correctas</span>
                                    <span style={{ fontWeight: 700, color: '#10b981' }}>{stats?.totalCorrect || 0}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Incorrectas</span>
                                    <span style={{ fontWeight: 700, color: '#ef4444' }}>{stats?.totalIncorrect || 0}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>Diagnóstico</span>
                                    <span style={{ fontWeight: 600, color: hasDiagnostic ? '#10b981' : '#f59e0b' }}>
                                        {hasDiagnostic ? '✓ Completado' : '⏳ Pendiente'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Level Progress Card */}
                        <div className="card" style={{ padding: '1.25rem' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>🎯 Progreso de Nivel</h4>
                            <div style={{ textAlign: 'center', marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--primary)' }}>{session.user.currentLevel || 1}</div>
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nivel Actual</div>
                            </div>
                            <div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                    <span>Progreso</span>
                                    <span>Nivel {(session.user.currentLevel || 1) + 1}</span>
                                </div>
                                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                    <div style={{ width: `${Math.min(((stats?.accuracy || 0) / 100) * 100, 95)}%`, height: '100%', borderRadius: 3, background: 'var(--gradient-primary)', transition: 'width 0.8s ease' }} />
                                </div>
                            </div>
                        </div>

                        {/* Math Tips */}
                        <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(145deg, rgba(99,102,241,0.06) 0%, var(--bg-card) 100%)', borderColor: 'rgba(99,102,241,0.2)' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#818cf8' }}>💡 ¿Sabías que?</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                El método socrático te ayuda a <strong style={{ color: 'var(--text-primary)' }}>descubrir las respuestas por ti mismo</strong> a través de preguntas guiadas. ¡Es la forma más efectiva de aprender!
                            </p>
                            <div style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(99,102,241,0.08)', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace', textAlign: 'center' }}>
                                E = mc² &nbsp;|&nbsp; a² + b² = c² &nbsp;|&nbsp; ∫f(x)dx
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
