'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
        fullName: '',
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (form.password !== form.confirmPassword) {
            setError('Las contraseñas no coinciden');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    username: form.username.trim(),
                    email: form.email.trim(),
                    password: form.password,
                    fullName: form.fullName.trim(),
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error en el registro');
            } else {
                setSuccess('¡Cuenta creada! Redirigiendo al login...');
                setTimeout(() => router.push('/login'), 2000);
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
                    <div className="auth-icon">📝</div>
                    <h1 className="auth-title">Crear Cuenta</h1>
                    <p className="auth-subtitle">Únete y comienza a aprender</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="error-msg">{error}</div>}
                    {success && <div className="success-msg">{success}</div>}

                    <div className="input-group">
                        <label className="input-label">Nombre completo</label>
                        <input
                            className="input"
                            type="text"
                            name="fullName"
                            placeholder="Tu nombre"
                            value={form.fullName}
                            onChange={handleChange}
                            id="register-fullname"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Usuario</label>
                        <input
                            className="input"
                            type="text"
                            name="username"
                            placeholder="Elige un nombre de usuario"
                            value={form.username}
                            onChange={handleChange}
                            required
                            id="register-username"
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
                            id="register-email"
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
                            id="register-password"
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
                            id="register-confirm"
                        />
                    </div>

                    <button className="btn btn-primary" type="submit" disabled={loading} id="register-submit">
                        {loading ? 'Creando cuenta...' : 'Registrarse'}
                    </button>
                </form>

                <div className="auth-footer">
                    ¿Ya tienes cuenta?{' '}
                    <Link href="/login">Inicia sesión</Link>
                </div>
            </div>
        </div>
    );
}
