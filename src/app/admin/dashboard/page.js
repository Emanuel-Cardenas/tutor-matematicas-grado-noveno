'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DonutChart, BarChart, HorizontalBarChart, GaugeChart, ProgressRing } from '@/components/Charts';
import ThemeToggle from '@/components/ThemeToggle';

const GRADES = [
    { value: 'all', label: 'Todos' },
    { value: '6', label: '6°' },
    { value: '7', label: '7°' },
    { value: '8', label: '8°' },
    { value: '9', label: '9°' },
    { value: '10', label: '10°' },
    { value: '11', label: '11°' },
    { value: 'none', label: 'Sin grado' },
];

export default function AdminDashboardPage() {
    const router = useRouter();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('createdAt');
    const [gradeFilter, setGradeFilter] = useState('all');

    // ═══ Estados de Chat Admin ═══
    const [unreadTotal, setUnreadTotal] = useState(0);
    const [chatSearchTerm, setChatSearchTerm] = useState('');
    const [chatGradeFilter, setChatGradeFilter] = useState('all');

    const getAdminToken = () => sessionStorage.getItem('adminToken');

    useEffect(() => {
        const token = getAdminToken();
        if (!token) {
            router.push('/admin');
            return;
        }
        fetchStudents(token);
        fetchUnread(token);
    }, [router]);

    const fetchStudents = async (token) => {
        try {
            const res = await fetch('/api/admin/students', {
                headers: { Authorization: 'Bearer ' + token },
            });
            if (res.status === 401) {
                sessionStorage.removeItem('adminToken');
                router.push('/admin');
                return;
            }
            const data = await res.json();
            setStudents(data.students || []);
        } catch (e) {
            setError('Error al cargar estudiantes');
        } finally {
            setLoading(false);
        }
    };

    // Filtrar por grado
    const filteredByGrade = students.filter(s => {
        if (gradeFilter === 'all') return true;
        if (gradeFilter === 'none') return !s.schoolGrade;
        return s.schoolGrade === parseInt(gradeFilter, 10);
    });

    // Filtrar por búsqueda + ordenar
    const filtered = filteredByGrade
        .filter(s =>
            (s.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.username || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (s.email || '').toLowerCase().includes(searchTerm.toLowerCase())
        )
        .sort((a, b) => {
            if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '');
            if (sortBy === 'level') return (b.currentLevel || 0) - (a.currentLevel || 0);
            if (sortBy === 'interactions') return (b.totalInteractions || 0) - (a.totalInteractions || 0);
            if (sortBy === 'grade') return (a.schoolGrade || 99) - (b.schoolGrade || 99);
            return new Date(b.createdAt) - new Date(a.createdAt);
        });

    // Conteo por grado para badges
    const gradeCountMap = {};
    students.forEach(s => {
        const key = s.schoolGrade ? String(s.schoolGrade) : 'none';
        gradeCountMap[key] = (gradeCountMap[key] || 0) + 1;
    });

    const handleLogout = () => {
        sessionStorage.removeItem('adminToken');
        router.push('/admin');
    };

    // ═══ Funciones de Chat Admin ═══
    const fetchUnread = async (token) => {
        try {
            const t = token || getAdminToken();
            const res = await fetch('/api/messages/unread', {
                headers: { Authorization: `Bearer ${t}` },
            });
            if (res.ok) {
                const data = await res.json();
                setUnreadTotal(data.total || 0);
            }
        } catch (e) { /* silent */ }
    };

    const openChat = async (studentId) => {
        try {
            const token = getAdminToken();
            await fetch('/api/messages/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ studentId }),
            });
            router.push('/admin/mensajes');
        } catch (e) {
            console.error('Error:', e);
        }
    };

    // Filtrar estudiantes para la sección de chat
    const chatFilteredStudents = students
        .filter(s => {
            if (chatGradeFilter !== 'all') {
                if (chatGradeFilter === 'none') { if (s.schoolGrade) return false; }
                else if (s.schoolGrade !== parseInt(chatGradeFilter, 10)) return false;
            }
            if (chatSearchTerm) {
                const term = chatSearchTerm.toLowerCase();
                return (s.name || '').toLowerCase().includes(term) ||
                    (s.username || '').toLowerCase().includes(term) ||
                    (s.email || '').toLowerCase().includes(term);
            }
            return true;
        })
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    if (loading) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando panel de administración...</p>
            </div>
        );
    }

    return (
        <div className="app-container">
            <nav className="navbar" style={{ borderBottom: '2px solid rgba(245, 158, 11, 0.3)' }}>
                <div className="navbar-brand" style={{ cursor: 'default' }}>
                    <div className="navbar-logo">🔐</div>
                    <span className="navbar-title">Admin Panel</span>
                </div>
                <div className="navbar-nav">
                    <span className="nav-link active">Estudiantes</span>
                    <Link href="/admin/content" className="nav-link">📚 Contenidos</Link>
                    <Link href="/admin/mensajes" className="nav-link" style={{ position: 'relative' }}>
                        💬 Mensajes
                        {unreadTotal > 0 && (
                            <span className="dm-nav-badge">{unreadTotal}</span>
                        )}
                    </Link>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <ThemeToggle />
                    <button className="btn-logout" onClick={handleLogout}>Cerrar Sesión</button>
                </div>
            </nav>

            <main className="main-content">
                {/* Header */}
                <div className="animate-fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                            📊 Panel de Administración
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            {students.length} estudiante{students.length !== 1 ? 's' : ''} registrado{students.length !== 1 ? 's' : ''}
                            {' • '}{students.filter(s => s.diagnosticCompleted).length} con diagnóstico completado
                        </p>
                    </div>
                    {/* Mini level distribution */}
                    {students.length > 0 && (
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-end', height: 40 }}>
                            {[1, 2, 3, 4, 5].map(level => {
                                const count = students.filter(s => (s.currentLevel || 1) === level).length;
                                const height = students.length > 0 ? Math.max((count / students.length) * 100, 8) : 8;
                                return (
                                    <div key={level} title={`Nivel ${level}: ${count} estudiantes`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                        <div style={{
                                            width: 18, height: `${height}%`, minHeight: 3,
                                            borderRadius: '3px 3px 0 0',
                                            background: level >= 4 ? 'linear-gradient(180deg, #10b981, rgba(16,185,129,0.4))' :
                                                level >= 2 ? 'linear-gradient(180deg, #f59e0b, rgba(245,158,11,0.4))' :
                                                    'linear-gradient(180deg, #6366f1, rgba(99,102,241,0.4))',
                                        }} />
                                        <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{level}</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Resumen general */}
                <div className="stats-grid animate-slide-up" style={{ marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-value">{students.length}</div>
                        <div className="stat-label">Total Estudiantes</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📋</div>
                        <div className="stat-value">{students.filter(s => s.diagnosticCompleted).length}</div>
                        <div className="stat-label">Diagnóstico Completado</div>
                        {students.length > 0 && (
                            <div style={{ marginTop: '0.5rem', height: 4, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                                <div style={{ width: `${Math.round((students.filter(s => s.diagnosticCompleted).length / students.length) * 100)}%`, height: '100%', borderRadius: 2, background: 'var(--gradient-success)' }} />
                            </div>
                        )}
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">💬</div>
                        <div className="stat-value">{students.reduce((sum, s) => sum + (s.totalInteractions || 0), 0)}</div>
                        <div className="stat-label">Total Interacciones</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📝</div>
                        <div className="stat-value">{students.reduce((sum, s) => sum + (s.totalSessions || 0), 0)}</div>
                        <div className="stat-label">Total Sesiones</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-value" style={{ fontSize: '1.4rem' }}>
                            ⌀ {students.length > 0 ? (students.reduce((sum, s) => sum + (s.currentLevel || 1), 0) / students.length).toFixed(1) : '0'}
                        </div>
                        <div className="stat-label">Nivel Promedio</div>
                    </div>
                </div>

                {/* ═══════ MCKINSEY CHARTS SECTION ═══════ */}
                {students.length > 0 && (
                    <div className="mck-chart-section animate-slide-up">
                        {/* Donut: Distribución por nivel */}
                        <div className="mck-chart-card">
                            <DonutChart
                                data={[1, 2, 3, 4, 5].map((level) => ({
                                    label: `Nivel ${level}`,
                                    value: students.filter(s => (s.currentLevel || 1) === level).length,
                                    color: level >= 4 ? '#10b981' : level >= 2 ? '#f59e0b' : '#6366f1',
                                })).filter(d => d.value > 0)}
                                title="Distribución por Nivel"
                                subtitle="Estudiantes agrupados por nivel actual"
                                centerValue={students.length}
                                centerLabel="estudiantes"
                                height={220}
                            />
                        </div>

                        {/* Donut: Diagnósticos completados vs pendientes */}
                        <div className="mck-chart-card">
                            <DonutChart
                                data={[
                                    { label: 'Completado', value: students.filter(s => s.diagnosticCompleted).length, color: '#10b981' },
                                    { label: 'Pendiente', value: students.filter(s => !s.diagnosticCompleted).length, color: '#ef4444' },
                                ].filter(d => d.value > 0)}
                                title="Estado de Diagnósticos"
                                subtitle="Completados vs pendientes"
                                centerValue={`${students.length > 0 ? Math.round((students.filter(s => s.diagnosticCompleted).length / students.length) * 100) : 0}%`}
                                centerLabel="completado"
                                height={220}
                            />
                        </div>

                        {/* Bar: Estudiantes por grado */}
                        <div className="mck-chart-card">
                            <BarChart
                                data={[6, 7, 8, 9, 10, 11].map(g => ({
                                    label: `${g}°`,
                                    value: students.filter(s => s.schoolGrade === g).length,
                                    color: '#2563eb',
                                })).filter(d => d.value > 0)}
                                title="Estudiantes por Grado"
                                subtitle="Distribución de la matrícula"
                                height={200}
                            />
                        </div>

                        {/* HorizontalBar: Top 10 estudiantes por interacciones */}
                        <div className="mck-chart-card">
                            <HorizontalBarChart
                                data={[...students]
                                    .sort((a, b) => (b.totalInteractions || 0) - (a.totalInteractions || 0))
                                    .slice(0, 8)
                                    .map(s => ({
                                        label: s.name || s.username || 'Sin nombre',
                                        value: s.totalInteractions || 0,
                                        color: '#8b5cf6',
                                    }))}
                                title="Top 8 — Mayor Actividad"
                                subtitle="Ranking por total de interacciones"
                                showPercentage={true}
                                unit=""
                            />
                        </div>
                    </div>
                )}

                {/* ═══════ ADMIN EXTENDED ANALYTICS ═══════ */}
                {students.length > 0 && (
                    <div className="mck-chart-section animate-slide-up" style={{ animationDelay: '0.1s' }}>
                        {/* Gauge: Precisión promedio del grupo */}
                        <div className="mck-chart-card">
                            <GaugeChart
                                value={(() => {
                                    const withDiag = students.filter(s => s.diagnosticCompleted && s.diagnosticScore != null);
                                    if (!withDiag.length) return 0;
                                    return Math.round(withDiag.reduce((s, st) => s + (st.diagnosticScore || 0), 0) / withDiag.length);
                                })()}
                                maxValue={100}
                                title="Precisión Promedio"
                                subtitle="Score diagnóstico del grupo"
                                label="% Promedio"
                                height={170}
                            />
                        </div>

                        {/* ProgressRings: KPIs del sistema */}
                        <div className="mck-chart-card" style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                            <ProgressRing
                                value={students.filter(s => s.diagnosticCompleted).length}
                                maxValue={students.length}
                                size={64}
                                color="#10b981"
                                label="Diagnosticados"
                            />
                            <ProgressRing
                                value={Math.round(students.reduce((s, st) => s + (st.currentLevel || 1), 0) / students.length * 20)}
                                maxValue={100}
                                size={64}
                                color="#ff6900"
                                label="Nivel Prom."
                            />
                            <ProgressRing
                                value={students.filter(s => (s.totalSessions || 0) > 0).length}
                                maxValue={students.length}
                                size={64}
                                color="#6366f1"
                                label="Con Sesiones"
                            />
                            <ProgressRing
                                value={students.filter(s => (s.currentLevel || 1) >= 3).length}
                                maxValue={students.length}
                                size={64}
                                color="#06b6d4"
                                label="Nivel ≥ 3"
                            />
                        </div>

                        {/* Bar: Top performers */}
                        <div className="mck-chart-card">
                            <BarChart
                                data={[...students]
                                    .filter(s => s.diagnosticCompleted && s.diagnosticScore != null)
                                    .sort((a, b) => (b.diagnosticScore || 0) - (a.diagnosticScore || 0))
                                    .slice(0, 8)
                                    .map(s => ({
                                        label: s.name || s.username || '?',
                                        value: s.diagnosticScore || 0,
                                        color: (s.diagnosticScore || 0) >= 70 ? '#10b981' : (s.diagnosticScore || 0) >= 40 ? '#f59e0b' : '#ef4444',
                                    }))}
                                title="Top 8 — Mejor Rendimiento"
                                subtitle="Mayor score en diagnóstico"
                                height={200}
                            />
                        </div>

                        {/* HorizontalBar: Estudiantes que necesitan atención */}
                        <div className="mck-chart-card">
                            <HorizontalBarChart
                                data={[...students]
                                    .filter(s => s.diagnosticCompleted && s.diagnosticScore != null && (s.diagnosticScore || 0) < 50)
                                    .sort((a, b) => (a.diagnosticScore || 0) - (b.diagnosticScore || 0))
                                    .slice(0, 8)
                                    .map(s => ({
                                        label: s.name || s.username || '?',
                                        value: s.diagnosticScore || 0,
                                        color: '#ef4444',
                                    }))}
                                title="⚠️ Estudiantes en Riesgo"
                                subtitle="Score < 50% — requieren atención"
                                unit="%"
                            />
                        </div>
                    </div>
                )}

                {/* ═══════ SECCIÓN DE CHAT DIRECTO ═══════ */}
                <div className="card animate-slide-up" style={{ padding: '1.5rem', marginBottom: '1.5rem', borderColor: 'rgba(99,102,241,0.25)', background: 'linear-gradient(145deg, rgba(99,102,241,0.04) 0%, var(--bg-card) 100%)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <div>
                            <h2 style={{ fontSize: '1.05rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                💬 Comunicación Directa
                            </h2>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                                Selecciona un estudiante para abrir el chat directo
                            </p>
                        </div>
                        <Link href="/admin/mensajes" className="btn btn-primary btn-sm" style={{ fontSize: '0.8rem' }}>
                            Ir a Mensajes {unreadTotal > 0 && `(${unreadTotal})`}
                        </Link>
                    </div>

                    {/* Búsqueda y filtro por grado */}
                    <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        <input
                            className="input"
                            type="text"
                            placeholder="🔍 Buscar por nombre, usuario o email..."
                            value={chatSearchTerm}
                            onChange={(e) => setChatSearchTerm(e.target.value)}
                            style={{ flex: 1, minWidth: '200px', fontSize: '0.82rem' }}
                            id="chat-search-input"
                        />
                        <select
                            className="input"
                            value={chatGradeFilter}
                            onChange={(e) => setChatGradeFilter(e.target.value)}
                            style={{ width: 'auto', minWidth: '130px', fontSize: '0.82rem' }}
                            id="chat-grade-filter"
                        >
                            <option value="all">🎓 Todos los grados</option>
                            <option value="6">6° Grado</option>
                            <option value="7">7° Grado</option>
                            <option value="8">8° Grado</option>
                            <option value="9">9° Grado</option>
                            <option value="10">10° Grado</option>
                            <option value="11">11° Grado</option>
                            <option value="none">Sin grado</option>
                        </select>
                    </div>

                    {/* Tabs rápidos de grado */}
                    <div style={{ display: 'flex', gap: '0.3rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                        {[{v:'all',l:'Todos'},{v:'6',l:'6°'},{v:'7',l:'7°'},{v:'8',l:'8°'},{v:'9',l:'9°'},{v:'10',l:'10°'},{v:'11',l:'11°'}].map(g => {
                            const count = g.v === 'all' ? students.length : students.filter(s => s.schoolGrade === parseInt(g.v, 10)).length;
                            const isActive = chatGradeFilter === g.v;
                            return (
                                <button
                                    key={g.v}
                                    onClick={() => setChatGradeFilter(g.v)}
                                    style={{
                                        padding: '0.3rem 0.7rem', borderRadius: '16px', fontSize: '0.75rem', fontWeight: isActive ? 700 : 500,
                                        border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        background: isActive ? 'rgba(255,105,0,0.12)' : 'transparent',
                                        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '0.3rem',
                                    }}
                                >
                                    {g.l}
                                    <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: '8px', background: isActive ? 'var(--accent-primary)' : 'var(--bg-input)', color: isActive ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>{count}</span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Lista de estudiantes filtrados */}
                    <div style={{ maxHeight: '300px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {chatFilteredStudents.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                                {chatSearchTerm || chatGradeFilter !== 'all' ? 'No se encontraron estudiantes con esos filtros' : 'No hay estudiantes registrados'}
                            </div>
                        ) : (
                            chatFilteredStudents.map(st => (
                                <div key={st.id} style={{
                                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem',
                                    background: 'var(--bg-input)', borderRadius: 'var(--radius-md)', transition: 'all 0.15s',
                                    cursor: 'pointer',
                                }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.08)'}
                                   onMouseLeave={(e) => e.currentTarget.style.background = 'var(--bg-input)'}>
                                    <div className="dm-avatar" style={{ width: 36, height: 36, fontSize: '0.85rem' }}>
                                        {(st.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{st.name}</div>
                                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                            @{st.username} {st.schoolGrade ? `• ${st.schoolGrade}°` : ''} • Nivel {st.currentLevel || 1}
                                        </div>
                                    </div>
                                    <button className="btn btn-primary btn-sm" onClick={() => openChat(st.id)} style={{ fontSize: '0.75rem', padding: '5px 14px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                                        💬 Chat
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                    {chatFilteredStudents.length > 0 && (
                        <div style={{ marginTop: '0.5rem', fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                            {chatFilteredStudents.length} estudiante{chatFilteredStudents.length !== 1 ? 's' : ''} encontrado{chatFilteredStudents.length !== 1 ? 's' : ''}
                        </div>
                    )}
                </div>

                {/* Pestañas de grado */}
                <div className="card" style={{ padding: '0.75rem 1rem', marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-secondary)' }}>🎓 Filtrar por Grado:</span>
                    </div>
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', alignItems: 'center' }}>
                        {GRADES.map(g => {
                            const count = g.value === 'all' ? students.length : (gradeCountMap[g.value] || 0);
                            const isActive = gradeFilter === g.value;
                            return (
                                <button
                                    key={g.value}
                                    id={`grade-filter-${g.value}`}
                                    onClick={() => setGradeFilter(g.value)}
                                    style={{
                                        padding: '0.4rem 0.85rem',
                                        borderRadius: '20px',
                                        border: isActive ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        background: isActive ? 'rgba(255, 105, 0, 0.12)' : 'transparent',
                                        color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        cursor: 'pointer',
                                        fontSize: '0.8rem',
                                        fontWeight: isActive ? 700 : 500,
                                        transition: 'all 0.2s ease',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '0.35rem',
                                    }}
                                >
                                    {g.label}
                                    <span style={{
                                        fontSize: '0.65rem',
                                        padding: '1px 6px',
                                        borderRadius: '10px',
                                        background: isActive ? 'var(--accent-primary)' : 'var(--bg-input)',
                                        color: isActive ? '#fff' : 'var(--text-muted)',
                                        fontWeight: 700,
                                    }}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}

                        {/* Botón de informe grupal */}
                        {gradeFilter !== 'all' && gradeFilter !== 'none' && (gradeCountMap[gradeFilter] || 0) > 0 && (
                            <Link
                                href={`/admin/group-report/${gradeFilter}`}
                                id="btn-group-report"
                                style={{
                                    marginLeft: 'auto',
                                    padding: '0.4rem 1rem',
                                    borderRadius: '20px',
                                    border: '2px solid rgba(16, 185, 129, 0.4)',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    color: '#10b981',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    transition: 'all 0.2s ease',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.3rem',
                                }}
                            >
                                📊 Ver Informe del Grado {gradeFilter}°
                            </Link>
                        )}
                    </div>
                </div>

                {/* Filtros */}
                <div className="card" style={{ padding: '1rem', marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <div style={{ flex: 1, minWidth: '200px' }}>
                        <input
                            className="input"
                            type="text"
                            placeholder="🔍 Buscar por nombre, usuario o email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            id="admin-search"
                        />
                    </div>
                    <select
                        className="input"
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        style={{ width: 'auto', minWidth: '180px' }}
                        id="admin-sort"
                    >
                        <option value="createdAt">Más recientes</option>
                        <option value="name">Por nombre</option>
                        <option value="level">Por nivel</option>
                        <option value="interactions">Por actividad</option>
                        <option value="grade">Por grado</option>
                    </select>
                </div>

                {error && (
                    <div className="card" style={{ padding: '1rem', borderColor: 'rgba(239,68,68,0.3)', marginBottom: '1rem' }}>
                        <p style={{ color: 'var(--error)' }}>{error}</p>
                    </div>
                )}

                {/* Info de filtro activo */}
                {gradeFilter !== 'all' && (
                    <div style={{
                        padding: '0.6rem 1rem',
                        marginBottom: '1rem',
                        borderRadius: 'var(--radius-md)',
                        background: 'rgba(255, 105, 0, 0.06)',
                        border: '1px solid rgba(255, 105, 0, 0.15)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '0.85rem',
                    }}>
                        <span>
                            🎓 Mostrando <strong>{filtered.length}</strong> estudiante{filtered.length !== 1 ? 's' : ''} de{' '}
                            <strong>{gradeFilter === 'none' ? 'sin grado asignado' : `grado ${gradeFilter}°`}</strong>
                        </span>
                        <button
                            onClick={() => setGradeFilter('all')}
                            style={{
                                padding: '0.25rem 0.5rem', border: 'none', borderRadius: '4px',
                                background: 'rgba(255,105,0,0.15)', color: 'var(--accent-primary)',
                                cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600,
                            }}
                        >
                            ✕ Quitar filtro
                        </button>
                    </div>
                )}

                {/* Tabla de estudiantes */}
                <div className="card" style={{ overflow: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Estudiante</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Grado</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Padre/Acudiente</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Nivel</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Diagnóstico</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sesiones</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Interacciones</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Registro</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Último acceso</th>
                                <th style={{ padding: '0.75rem 1rem', color: 'var(--text-secondary)', fontWeight: 600 }}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={10} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        {searchTerm ? 'No se encontraron resultados' : gradeFilter !== 'all' ? 'No hay estudiantes en este grado' : 'No hay estudiantes registrados aún'}
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((s, i) => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background 0.15s' }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99,102,241,0.05)'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <div style={{ fontWeight: 600 }}>{s.name || 'Sin nombre'}</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>@{s.username} • {s.email}</div>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {s.schoolGrade ? (
                                                <span style={{
                                                    display: 'inline-block',
                                                    padding: '2px 10px',
                                                    borderRadius: '12px',
                                                    fontSize: '0.8rem',
                                                    fontWeight: 700,
                                                    background: 'rgba(139, 92, 246, 0.12)',
                                                    color: '#8b5cf6',
                                                }}>
                                                    {s.schoolGrade}°
                                                </span>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>—</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {s.parent ? (
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '0.82rem', color: '#8b5cf6' }}>
                                                        👨‍👩‍👧 {s.parent.fullName}
                                                    </div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                                        📧 {s.parent.email}
                                                    </div>
                                                </div>
                                            ) : (
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin padre</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <span style={{
                                                display: 'inline-block',
                                                padding: '2px 10px',
                                                borderRadius: '12px',
                                                fontSize: '0.8rem',
                                                fontWeight: 700,
                                                background: s.currentLevel >= 4 ? 'rgba(16,185,129,0.15)' : s.currentLevel >= 2 ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                                                color: s.currentLevel >= 4 ? '#10b981' : s.currentLevel >= 2 ? '#f59e0b' : '#6366f1',
                                            }}>
                                                Nivel {s.currentLevel || 1}
                                            </span>
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            {s.diagnosticCompleted ? (
                                                <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Nivel {s.diagnosticLevel}</span>
                                            ) : (
                                                <span style={{ color: 'var(--text-muted)' }}>Pendiente</span>
                                            )}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.totalSessions}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontWeight: 600 }}>{s.totalInteractions}</td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {new Date(s.createdAt).toLocaleDateString('es-CO')}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {s.lastLogin ? new Date(s.lastLogin).toLocaleDateString('es-CO') : 'Nunca'}
                                        </td>
                                        <td style={{ padding: '0.75rem 1rem' }}>
                                            <Link href={'/admin/student/' + s.id}
                                                className="btn btn-primary btn-sm"
                                                style={{ fontSize: '0.75rem', padding: '4px 12px' }}>
                                                Ver detalle
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </main>
        </div>
    );
}
