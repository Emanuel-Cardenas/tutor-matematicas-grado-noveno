'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminLoginPage() {
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const router = useRouter();

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!password.trim()) {
            setError('Ingresa la contraseña');
            return;
        }
        // Guardar en sessionStorage para las peticiones del admin
        sessionStorage.setItem('adminToken', password);
        router.push('/admin/dashboard');
    };

    return (
        <div className="app-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="card" style={{ maxWidth: '420px', width: '100%', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🔐</div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Panel de Administración</h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                        Acceso exclusivo para administradores
                    </p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Contraseña de Admin</label>
                        <input
                            className="input"
                            type="password"
                            placeholder="Contraseña de administrador"
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); setError(''); }}
                            autoFocus
                            id="admin-password"
                        />
                    </div>
                    {error && <p style={{ color: 'var(--error)', fontSize: '0.8rem', marginBottom: '1rem' }}>{error}</p>}
                    <button className="btn btn-primary btn-lg" type="submit" style={{ width: '100%' }}>
                        Acceder al Panel
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    Contraseña configurada en variables de entorno (ADMIN_PASSWORD)
                </p>
                <div style={{ textAlign: 'center', marginTop: '1rem' }}>
                    <Link href="/" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        ← Volver al Portal Principal
                    </Link>
                </div>
            </div>
        </div>
    );
}
