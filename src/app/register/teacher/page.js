'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function TeacherRegisterPage() {
    const [form, setForm] = useState({ username: '', email: '', password: '', fullName: '', accessCode: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.username || !form.email || !form.password || !form.accessCode) {
            setError('Todos los campos son obligatorios');
            return;
        }
        setLoading(true);
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, role: 'teacher' }),
            });
            const data = await res.json();
            if (!res.ok) {
                setError(data.error || 'Error al registrar');
                setLoading(false);
                return;
            }
            router.push('/login?registered=teacher');
        } catch (err) {
            setError('Error de conexión');
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card" style={{ maxWidth: '460px' }}>
                <div className="auth-header">
                    <div className="auth-icon">👨‍🏫</div>
                    <h1 className="auth-title">Registro de Profesor</h1>
                    <p className="auth-subtitle">Crea tu cuenta de profesor en YedaTech</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Nombre Completo</label>
                        <input
                            className="input"
                            type="text"
                            name="fullName"
                            placeholder="Ej: María García López"
                            value={form.fullName}
                            onChange={handleChange}
                            id="teacher-fullname"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Usuario</label>
                        <input
                            className="input"
                            type="text"
                            name="username"
                            placeholder="Nombre de usuario"
                            value={form.username}
                            onChange={handleChange}
                            id="teacher-username"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            className="input"
                            type="email"
                            name="email"
                            placeholder="profesor@correo.com"
                            value={form.email}
                            onChange={handleChange}
                            id="teacher-email"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">Contraseña</label>
                        <input
                            className="input"
                            type="password"
                            name="password"
                            placeholder="Mínimo 6 caracteres"
                            value={form.password}
                            onChange={handleChange}
                            id="teacher-password"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label">🔑 Código de Acceso</label>
                        <input
                            className="input"
                            type="text"
                            name="accessCode"
                            placeholder="Código proporcionado por la institución"
                            value={form.accessCode}
                            onChange={handleChange}
                            id="teacher-access-code"
                            style={{ borderColor: 'rgba(255, 105, 0, 0.4)' }}
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            Solicita tu código al administrador del sistema
                        </span>
                    </div>

                    {error && <p className="error-msg">{error}</p>}

                    <button
                        className="btn btn-primary btn-lg"
                        type="submit"
                        disabled={loading}
                        id="teacher-register-btn"
                    >
                        {loading ? 'Registrando...' : 'Registrar como Profesor'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>¿Ya tienes cuenta? <Link href="/login">Iniciar sesión</Link></p>
                    <p style={{ marginTop: '0.5rem' }}>¿Eres estudiante? <Link href="/register">Regístrate aquí</Link></p>
                </div>
            </div>
        </div>
    );
}
