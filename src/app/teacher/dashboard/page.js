'use client';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function TeacherDashboardPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [assigning, setAssigning] = useState(false);
    const [identifier, setIdentifier] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [unreadTotal, setUnreadTotal] = useState(0);

    useEffect(() => {
        if (status === 'unauthenticated') router.push('/login');
        if (session && session.user.role !== 'teacher') router.push('/dashboard');
    }, [status, session, router]);

    useEffect(() => {
        if (session?.user?.role === 'teacher') {
            fetchStudents();
            fetchUnread();
        }
    }, [session]);

    const fetchStudents = async () => {
        try {
            const res = await fetch('/api/teacher/students');
            if (res.ok) {
                const data = await res.json();
                setStudents(data.students || []);
            }
        } catch (e) {
            console.error('Error:', e);
        } finally {
            setLoading(false);
        }
    };

    const fetchUnread = async () => {
        try {
            const res = await fetch('/api/messages/unread');
            if (res.ok) {
                const data = await res.json();
                setUnreadTotal(data.total || 0);
            }
        } catch (e) { /* silent */ }
    };

    const handleAssign = async (e) => {
        e.preventDefault();
        if (!identifier.trim()) return;
        setAssigning(true);
        setError('');
        setSuccess('');

        try {
            const res = await fetch('/api/teacher/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: identifier.trim() }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error);
            } else {
                setSuccess(`✅ ${data.student.name} agregado exitosamente`);
                setIdentifier('');
                fetchStudents();
            }
        } catch (e) {
            setError('Error de conexión');
        } finally {
            setAssigning(false);
        }
    };

    const handleUnassign = async (studentId, name) => {
        if (!confirm(`¿Desasignar a ${name}?`)) return;
        try {
            const res = await fetch('/api/teacher/students', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ studentId }),
            });
            if (res.ok) {
                fetchStudents();
                setSuccess(`${name} fue desasignado`);
            }
        } catch (e) {
            setError('Error al desasignar');
        }
    };

    const openChat = async (studentId) => {
        try {
            const res = await fetch('/api/messages/conversations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contactId: studentId }),
            });
            if (res.ok) {
                router.push('/mensajes');
            }
        } catch (e) {
            console.error('Error abriendo chat:', e);
        }
    };

    if (status === 'loading' || !session) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando panel de profesor...</p>
            </div>
        );
    }

    return (
        <div className="app-container">
            <nav className="navbar">
                <Link href="/teacher/dashboard" className="navbar-brand">
                    <div className="navbar-logo">YT</div>
                    <span className="navbar-title">YedaTech</span>
                </Link>
                <div className="navbar-nav">
                    <Link href="/teacher/dashboard" className="nav-link active">Dashboard</Link>
                    <Link href="/mensajes" className="nav-link" style={{ position: 'relative' }}>
                        💬 Mensajes
                        {unreadTotal > 0 && (
                            <span className="dm-nav-badge">{unreadTotal}</span>
                        )}
                    </Link>
                    <Link href="/admin" className="nav-link">Admin</Link>
                </div>
                <div className="nav-user">
                    <div className="nav-user-info">
                        <div className="nav-user-name">{session.user.name}</div>
                        <div className="nav-user-level" style={{ color: '#818cf8' }}>👨‍🏫 Profesor</div>
                    </div>
                    <button className="btn-logout" onClick={() => signOut({ callbackUrl: '/' })}>Salir</button>
                </div>
            </nav>

            <main className="main-content">
                {/* Header */}
                <div className="animate-fade-in" style={{ marginBottom: '2rem' }}>
                    <h1 className="dashboard-greeting">
                        Panel del Profesor <span>👨‍🏫</span>
                    </h1>
                    <p className="dashboard-subtitle">
                        Gestiona tus estudiantes y mantén comunicación directa con ellos
                    </p>
                </div>

                {/* Stats rapidos */}
                <div className="stats-grid animate-slide-up" style={{ animationDelay: '0.1s', marginBottom: '2rem' }}>
                    <div className="stat-card">
                        <div className="stat-icon">👥</div>
                        <div className="stat-value">{students.length}</div>
                        <div className="stat-label">Estudiantes Asignados</div>
                    </div>
                    <div className="stat-card" onClick={() => router.push('/mensajes')} style={{ cursor: 'pointer' }}>
                        <div className="stat-icon">💬</div>
                        <div className="stat-value">{unreadTotal}</div>
                        <div className="stat-label">Mensajes No Leídos</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-value">
                            {students.length > 0
                                ? Math.round(students.reduce((s, st) => s + (st.currentLevel || 1), 0) / students.length)
                                : 0}
                        </div>
                        <div className="stat-label">Nivel Promedio</div>
                    </div>
                </div>

                <div className="layout-main-sidebar animate-slide-up" style={{ animationDelay: '0.2s' }}>
                    {/* Lista de estudiantes */}
                    <div>
                        <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            👥 Mis Estudiantes
                        </h2>

                        {loading ? (
                            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto' }}></div>
                            </div>
                        ) : students.length === 0 ? (
                            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👥</div>
                                <h3 style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Sin estudiantes asignados</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    Agrega estudiantes usando su nombre de usuario o email
                                </p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {students.map(student => (
                                    <div key={student.id} className="card teacher-student-card">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div className="dm-avatar" style={{ width: 48, height: 48, fontSize: '1.1rem', flexShrink: 0 }}>
                                                {(student.name || '?').charAt(0).toUpperCase()}
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{student.name}</div>
                                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                    @{student.username} • {student.email}
                                                </div>
                                                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.3rem', fontSize: '0.75rem' }}>
                                                    {student.schoolGrade && (
                                                        <span style={{ color: 'var(--text-muted)' }}>Grado {student.schoolGrade}°</span>
                                                    )}
                                                    <span style={{ color: 'var(--text-accent)' }}>Nivel {student.currentLevel || 1}</span>
                                                    {student.lastLogin && (
                                                        <span style={{ color: 'var(--text-muted)' }}>
                                                            Último acceso: {new Date(student.lastLogin).toLocaleDateString('es')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => openChat(student.id)}
                                                    title="Abrir chat"
                                                >
                                                    💬 Chat
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => handleUnassign(student.id, student.name)}
                                                    style={{ color: 'var(--accent-error)' }}
                                                    title="Desasignar"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'sticky', top: '80px' }}>
                        {/* Agregar estudiante */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                ➕ Agregar Estudiante
                            </h4>
                            <form onSubmit={handleAssign}>
                                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                                    <input
                                        className="input"
                                        type="text"
                                        placeholder="Username o email del estudiante"
                                        value={identifier}
                                        onChange={(e) => { setIdentifier(e.target.value); setError(''); setSuccess(''); }}
                                        id="assign-student-input"
                                    />
                                </div>
                                {error && <p className="error-msg" style={{ marginBottom: '0.75rem' }}>{error}</p>}
                                {success && <p className="success-msg" style={{ marginBottom: '0.75rem' }}>{success}</p>}
                                <button
                                    className="btn btn-primary btn-sm"
                                    type="submit"
                                    disabled={assigning}
                                    style={{ width: '100%' }}
                                    id="assign-student-btn"
                                >
                                    {assigning ? 'Asignando...' : 'Agregar al Grupo'}
                                </button>
                            </form>
                        </div>

                        {/* Acciones rápidas */}
                        <div className="card" style={{ padding: '1.5rem' }}>
                            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '1rem' }}>🚀 Acciones Rápidas</h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <Link href="/mensajes" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                                    💬 Ir a Mensajes {unreadTotal > 0 && `(${unreadTotal})`}
                                </Link>
                                <Link href="/admin" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                                    📊 Panel de Administración
                                </Link>
                                <Link href="/admin/content" className="btn btn-secondary btn-sm" style={{ justifyContent: 'flex-start' }}>
                                    📚 Gestionar Contenido
                                </Link>
                            </div>
                        </div>

                        {/* Tips */}
                        <div className="card" style={{ padding: '1.25rem', background: 'linear-gradient(145deg, rgba(99,102,241,0.06) 0%, var(--bg-card) 100%)', borderColor: 'rgba(99,102,241,0.2)' }}>
                            <h4 style={{ fontSize: '0.85rem', fontWeight: 700, marginBottom: '0.5rem', color: '#818cf8' }}>💡 Tip</h4>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                Puedes enviar <strong style={{ color: 'var(--text-primary)' }}>imágenes de ejercicios</strong> y
                                <strong style={{ color: 'var(--text-primary)' }}> archivos PDF</strong> directamente por el chat para
                                complementar el acompañamiento académico.
                            </p>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
