'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ParentRegisterPage() {
    const [form, setForm] = useState({
        fullName: '',
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        childUsername: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
        setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!form.fullName || !form.username || !form.email || !form.password || !form.childUsername) {
            setError('Completa todos los campos');
            return;
        }

        if (form.password !== form.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        if (form.password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/parent/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fullName: form.fullName.trim(),
                    username: form.username.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    childUsername: form.childUsername.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error en el registro');
            } else {
                setSuccess(`¡Cuenta creada! Vinculado a: ${data.child.name}. Redirigiendo...`);
                setTimeout(() => router.push('/parent'), 2500);
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-icon" style={{ fontSize: '3rem' }}>👨‍👩‍👧</div>
                    <h1 className="auth-title">Registro de Padre</h1>
                    <p className="auth-subtitle">Crea tu cuenta para seguir el progreso de tu hijo</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="error-msg">{error}</div>}
                    {success && <div className="success-msg">{success}</div>}

                    <div className="input-group">
                        <label className="input-label">Tu nombre completo</label>
                        <input
                            className="input"
                            type="text"
                            name="fullName"
                            placeholder="Ej: Carlos Pérez"
                            value={form.fullName}
                            onChange={handleChange}
                            id="parent-reg-name"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Nombre de usuario</label>
                        <input
                            className="input"
                            type="text"
                            name="username"
                            placeholder="Elige un usuario para ti"
                            value={form.username}
                            onChange={handleChange}
                            required
                            id="parent-reg-username"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Email</label>
                        <input
                            className="input"
                            type="email"
                            name="email"
                            placeholder="tu@email.com"
                            value={form.email}
                            onChange={handleChange}
                            required
                            id="parent-reg-email"
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
                            required
                            id="parent-reg-password"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Confirmar contraseña</label>
                        <input
                            className="input"
                            type="password"
                            name="confirmPassword"
                            placeholder="Repite la contraseña"
                            value={form.confirmPassword}
                            onChange={handleChange}
                            required
                            id="parent-reg-confirm"
                        />
                    </div>

                    <div style={{
                        padding: '1rem',
                        background: 'rgba(255, 105, 0, 0.08)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid rgba(255, 105, 0, 0.2)',
                        marginBottom: '0.5rem',
                    }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label className="input-label" style={{ color: 'var(--accent-primary)' }}>
                                👦 Usuario de tu hijo (estudiante)
                            </label>
                            <input
                                className="input"
                                type="text"
                                name="childUsername"
                                placeholder="Nombre de usuario del estudiante"
                                value={form.childUsername}
                                onChange={handleChange}
                                required
                                id="parent-reg-child"
                                style={{ borderColor: 'rgba(255, 105, 0, 0.3)' }}
                            />
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                                Tu hijo debe estar registrado previamente como estudiante en YedaTech.
                            </p>
                        </div>
                    </div>

                    <button className="btn btn-primary" type="submit" disabled={loading} id="parent-reg-submit">
                        {loading ? 'Creando cuenta...' : 'Crear Cuenta de Padre'}
                    </button>
                </form>

                <div className="auth-footer">
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/parent">Inicia sesión</Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <Link href="/register" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ← Registrar como estudiante
                    </Link>
                </div>
            </div>
        </div>
    );
}
