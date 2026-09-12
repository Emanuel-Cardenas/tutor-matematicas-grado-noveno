'use client';
import { useState } from 'react';
import { signIn, getSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await signIn('credentials', {
                username: username.trim(),
                password,
                redirect: false,
            });

            if (result?.error) {
                setError(result.error);
            } else {
                // Redirect based on role
                const session = await getSession();
                if (session?.user?.role === 'admin') {
                    router.push('/admin/dashboard');
                } else {
                    router.push('/dashboard');
                }
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
                    <div className="auth-icon">YT</div>
                    <h1 className="auth-title">Bienvenido de vuelta</h1>
                    <p className="auth-subtitle">Ingresa a tu sesión de YedaTech</p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    {error && <div className="error-msg">{error}</div>}

                    <div className="input-group">
                        <label className="input-label">Usuario</label>
                        <input
                            className="input"
                            type="text"
                            placeholder="Tu nombre de usuario"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            id="login-username"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Contraseña</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            id="login-password"
                        />
                    </div>

                    <button className="btn btn-primary" type="submit" disabled={loading} id="login-submit">
                        {loading ? 'Ingresando...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div className="auth-footer">
                    ¿No tienes cuenta?{' '}
                    <Link href="/register">Regístrate aquí</Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ← Volver al Portal Principal
                    </Link>
                </div>
            </div>
        </div>
    );
}
