'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function ParentLoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Completa todos los campos');
            return;
        }

        setLoading(true);

        try {
            const res = await fetch('/api/parent/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: username.trim(), password }),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.error || 'Error al iniciar sesión');
            } else {
                // Guardar token y datos en sessionStorage
                sessionStorage.setItem('parentToken', data.token);
                sessionStorage.setItem('parentName', data.parent.name);
                sessionStorage.setItem('childName', data.child.name);
                sessionStorage.setItem('childId', data.child.id);
                router.push('/parent/dashboard');
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
                    <h1 className="auth-title">Portal de Padres</h1>
                    <p className="auth-subtitle">Acompaña el aprendizaje de tu hijo</p>
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
                            onChange={(e) => { setUsername(e.target.value); setError(''); }}
                            autoFocus
                            id="parent-login-username"
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Contraseña</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="Tu contraseña"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            id="parent-login-password"
                        />
                    </div>

                    <button className="btn btn-primary" type="submit" disabled={loading} id="parent-login-submit">
                        {loading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>

                <div className="auth-footer">
                    ¿No tienes cuenta?{' '}
                    <Link href="/parent/register">Regístrate como padre</Link>
                </div>

                <div style={{ textAlign: 'center', marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    <Link href="/login" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Ir al login de estudiantes
                    </Link>
                    <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ← Volver al Portal Principal
                    </Link>
                </div>
            </div>
        </div>
    );
}
