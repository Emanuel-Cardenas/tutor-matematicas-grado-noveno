'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STATUS_MAP = {
    processing: { label: 'Extrayendo texto...', color: '#f59e0b', icon: '⏳', pulse: true },
    analyzing:  { label: 'Analizando con IA',  color: '#3b82f6', icon: '🤖', pulse: true },
    ready:      { label: 'Listo',              color: '#22c55e', icon: '✅', pulse: false },
    error:      { label: 'Error',              color: '#ef4444', icon: '❌', pulse: false },
};

export default function AdminContentPage() {
    const router = useRouter();
    const fileInputRef = useRef(null);
    const dropRef = useRef(null);
    const [contents, setContents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [gradeFilter, setGradeFilter] = useState('all');
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [dragOver, setDragOver] = useState(false);

    // Upload form
    const [formTitle, setFormTitle]       = useState('');
    const [formTopic, setFormTopic]       = useState('');
    const [formDesc, setFormDesc]         = useState('');
    const [formGrade, setFormGrade]       = useState('11');
    const [formFile, setFormFile]         = useState(null);

    const getToken = () => sessionStorage.getItem('adminToken');

    useEffect(() => {
        if (!getToken()) { router.push('/admin'); return; }
        fetchContents();
        const iv = setInterval(fetchContents, 7000);
        return () => clearInterval(iv);
    }, [router, gradeFilter]);

    const fetchContents = async () => {
        try {
            const res = await fetch(`/api/teacher/content?grade=${gradeFilter}`, {
                headers: { Authorization: 'Bearer ' + getToken() },
            });
            if (res.status === 401) { router.push('/admin'); return; }
            const data = await res.json();
            setContents(data.contents || []);
        } catch { setError('Error al cargar contenidos'); }
        finally { setLoading(false); }
    };

    const handleFileDrop = (e) => {
        e.preventDefault(); setDragOver(false);
        const file = e.dataTransfer.files[0];
        if (file) { setFormFile(file); setShowUpload(true); }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!formFile)        { setError('Selecciona un archivo'); return; }
        if (!formTitle.trim()) { setError('Ingresa un título');    return; }
        setUploading(true); setError('');

        const fd = new FormData();
        fd.append('file', formFile);
        fd.append('title', formTitle);
        fd.append('topic', formTopic || 'General');
        fd.append('description', formDesc);
        fd.append('schoolGrade', formGrade);

        try {
            const res  = await fetch('/api/teacher/content', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + getToken() },
                body: fd,
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg('✅ Archivo subido. La IA está procesando el documento...');
                setShowUpload(false);
                setFormTitle(''); setFormTopic(''); setFormDesc(''); setFormFile(null);
                fetchContents();
                setTimeout(() => setSuccessMsg(''), 6000);
            } else {
                setError(data.error || 'Error al subir');
            }
        } catch { setError('Error de conexión'); }
        finally { setUploading(false); }
    };

    const handleDelete = async (id, title) => {
        if (!confirm(`¿Eliminar "${title}" y todas sus preguntas?\n\nEsta acción no se puede deshacer.`)) return;
        try {
            await fetch(`/api/teacher/content/${id}`, {
                method: 'DELETE',
                headers: { Authorization: 'Bearer ' + getToken() },
            });
            fetchContents();
        } catch { setError('Error al eliminar'); }
    };

    const handleRetry = async (id) => {
        try {
            const res = await fetch(`/api/teacher/content/${id}`, {
                method: 'PATCH',
                headers: {
                    Authorization: 'Bearer ' + getToken(),
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ action: 'regenerate_questions' }),
            });
            const data = await res.json();
            if (data.success) {
                setSuccessMsg('✅ Reintentando análisis con IA...');
                setTimeout(() => setSuccessMsg(''), 5000);
                fetchContents();
            } else {
                setError(data.error || 'Error al reintentar');
            }
        } catch { setError('Error de conexión al reintentar'); }
    };

    const fmtDate = (d)  => new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
    const fmtSize = (b)  => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;

    const processing = contents.filter(c => c.status === 'processing' || c.status === 'analyzing').length;

    return (
        <div className="app-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>

            {/* ── NAVBAR ── */}
            <nav className="navbar" style={{ marginBottom: '1.5rem', borderBottom: '2px solid rgba(245,158,11,0.3)' }}>
                <div className="navbar-brand">
                    <div className="navbar-logo">📚</div>
                    <span className="navbar-title">Contenido del Profesor</span>
                </div>
                <div className="navbar-nav">
                    <Link href="/admin/dashboard" className="nav-link">← Panel Admin</Link>
                </div>
            </nav>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📚 Gestión de Contenidos
                    </h1>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '0.3rem' }}>
                        La generacion automatica esta desactivada. Usa el banco JSON de Pruebas de Estado.
                    </p>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={() => setShowUpload(!showUpload)}
                    style={{ padding: '0.7rem 1.4rem', fontSize: '0.95rem' }}
                >
                    {showUpload ? '✕ Cancelar' : '⬆ Subir Material'}
                </button>
            </div>

            {/* ── STATS BAR ── */}
            <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {[
                    { label: 'Materiales',   value: contents.length,                                          color: '#6366f1' },
                    { label: 'Listos',        value: contents.filter(c => c.status === 'ready').length,        color: '#22c55e' },
                    { label: 'Procesando',    value: processing,                                               color: '#f59e0b' },
                    { label: 'Preguntas Tot.', value: contents.reduce((s, c) => s + (c._count?.questions || 0), 0), color: '#ff6900' },
                ].map((s, i) => (
                    <div key={i} className="card" style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: 120 }}>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.label}</div>
                    </div>
                ))}
                {processing > 0 && (
                    <div style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#f59e0b', background: 'rgba(245,158,11,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(245,158,11,0.2)' }}>
                        <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>⚙</span>
                        La IA está procesando {processing} documento{processing > 1 ? 's' : ''}...
                    </div>
                )}
            </div>

            {/* ── MENSAJES ── */}
            {error      && <div style={{ background: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.3)',  borderRadius: 12, padding: '1rem', marginBottom: '1rem', color: '#ef4444' }}>{error}</div>}
            {successMsg && <div style={{ background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.3)',  borderRadius: 12, padding: '1rem', marginBottom: '1rem', color: '#22c55e' }}>{successMsg}</div>}

            {/* ── FORM DE SUBIDA ── */}
            {showUpload && (
                <div
                    className="card"
                    ref={dropRef}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleFileDrop}
                    style={{
                        padding: '2rem', marginBottom: '2rem',
                        border: `2px dashed ${dragOver ? '#ff6900' : 'var(--border-color)'}`,
                        borderRadius: 16,
                        background: dragOver ? 'rgba(255,105,0,0.04)' : undefined,
                        transition: 'all 0.2s',
                    }}
                >
                    <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        📤 Subir Nuevo Material Educativo
                    </h2>
                    <form onSubmit={handleUpload}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                            <div className="input-group">
                                <label className="input-label">Título *</label>
                                <input className="input" value={formTitle} onChange={e => setFormTitle(e.target.value)} placeholder="Ej: Funciones Cuadráticas — Grado 9" required />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Tema</label>
                                <input className="input" value={formTopic} onChange={e => setFormTopic(e.target.value)} placeholder="Ej: Álgebra, Geometría..." />
                            </div>
                            <div className="input-group">
                                <label className="input-label">Grado *</label>
                                <select className="input" value={formGrade} onChange={e => setFormGrade(e.target.value)}>
                                    {[6,7,8,9,10,11].map(g => <option key={g} value={g}>{g}° Grado</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label className="input-label">Archivo (PDF, Word, imagen) *</label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".pdf,.docx,.doc,.txt,.jpg,.jpeg,.png"
                                    onChange={e => setFormFile(e.target.files[0])}
                                    className="input"
                                    style={{ padding: '0.5rem' }}
                                />
                            </div>
                        </div>
                        <div className="input-group" style={{ marginBottom: '1rem' }}>
                            <label className="input-label">Descripción (opcional)</label>
                            <textarea className="input" value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={2} placeholder="Breve descripción del material..." />
                        </div>

                        {/* Drop zone hint */}
                        <div style={{ textAlign: 'center', padding: '1rem', borderRadius: 8, background: 'rgba(255,105,0,0.04)', marginBottom: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {formFile
                                ? <><strong style={{ color: '#22c55e' }}>📎 {formFile.name}</strong> ({fmtSize(formFile.size)})</>
                                : '💡 También puedes arrastrar y soltar el archivo aquí'}
                        </div>

                        <div style={{ display: 'flex', gap: '0.75rem' }}>
                            <button className="btn btn-primary" type="submit" disabled={uploading} style={{ flex: 1, padding: '0.75rem', fontSize: '0.95rem' }}>
                                {uploading ? '⏳ Subiendo y procesando con IA...' : '🚀 Subir y Analizar con IA'}
                            </button>
                            <button type="button" className="btn" onClick={() => setShowUpload(false)} style={{ padding: '0.75rem 1.5rem' }}>
                                Cancelar
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* ── FILTROS POR GRADO ── */}
            <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                {['all','6','7','8','9','10','11'].map(g => {
                    const count = g === 'all' ? contents.length : contents.filter(c => c.schoolGrade === parseInt(g)).length;
                    const active = gradeFilter === g;
                    return (
                        <button key={g} onClick={() => setGradeFilter(g)} style={{
                            padding: '0.35rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', fontWeight: active ? 700 : 500,
                            border: active ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                            background: active ? 'rgba(255,105,0,0.12)' : 'transparent',
                            color: active ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem',
                        }}>
                            {g === 'all' ? 'Todos' : `${g}°`}
                            <span style={{ fontSize: '0.65rem', padding: '1px 5px', borderRadius: 8, background: active ? 'var(--accent-primary)' : 'var(--bg-input)', color: active ? '#fff' : 'var(--text-muted)', fontWeight: 700 }}>{count}</span>
                        </button>
                    );
                })}
            </div>

            {/* ── LISTA DE CONTENIDOS ── */}
            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
                    Cargando materiales...
                </div>
            ) : contents.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '5rem 2rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>📁</div>
                    <h3 style={{ marginBottom: '0.75rem' }}>No hay materiales {gradeFilter !== 'all' ? `para ${gradeFilter}°` : ''}</h3>
                    <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', maxWidth: 400, margin: '0 auto 1.5rem' }}>
                        La carga automatica de preguntas desde archivos esta desactivada. El nuevo banco debe cargarse como JSON en Pruebas de Estado.
                    </p>
                    <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ padding: '0.75rem 2rem' }}>
                        ⬆ Subir Material
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gap: '0.85rem' }}>
                    {contents.map(c => {
                        const st = STATUS_MAP[c.status] || STATUS_MAP.processing;
                        const qCount = c._count?.questions || 0;
                        const rCount = c._count?.results   || 0;
                        return (
                            <div key={c.id} className="card" style={{ padding: '1.25rem 1.5rem', display: 'grid', gridTemplateColumns: '1fr auto', gap: '1rem', alignItems: 'center', borderLeft: `4px solid ${st.color}` }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                                        <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>{c.title}</h3>
                                        <span style={{
                                            padding: '0.15rem 0.6rem', borderRadius: 20, fontSize: '0.72rem', fontWeight: 700,
                                            background: `${st.color}22`, color: st.color,
                                            display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        }}>
                                            <span style={st.pulse ? { animation: 'spin 1.5s linear infinite', display: 'inline-block' } : {}}>{st.icon}</span>
                                            {st.label}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                                        <span>📐 {c.topic}</span>
                                        <span style={{ padding: '0.1rem 0.5rem', borderRadius: 10, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontWeight: 700, fontSize: '0.75rem' }}>🎓 {c.schoolGrade}°</span>
                                        <span>📝 {qCount} pregunta{qCount !== 1 ? 's' : ''}</span>
                                        <span>👥 {rCount} resultado{rCount !== 1 ? 's' : ''}</span>
                                        <span>📦 {fmtSize(c.fileSize)}</span>
                                        <span>📅 {fmtDate(c.createdAt)}</span>
                                    </div>
                                    {c.description && <p style={{ fontSize: '0.8rem', marginTop: '0.4rem', color: 'var(--text-muted)' }}>{c.description}</p>}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', alignItems: 'flex-end' }}>
                                    {c.status === 'ready' && (
                                        <Link href={`/admin/content/${c.id}`} className="btn btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.82rem', textDecoration: 'none', whiteSpace: 'nowrap' }}>
                                            📋 Gestionar →
                                        </Link>
                                    )}
                                    {(c.status === 'processing' || c.status === 'analyzing') && (
                                        <div style={{ fontSize: '0.75rem', color: '#f59e0b', textAlign: 'center' }}>
                                            Procesando...
                                        </div>
                                    )}
                                    {c.status === 'error' && (
                                        <button
                                            onClick={() => handleRetry(c.id)}
                                            style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.4)', borderRadius: 'var(--radius-sm)', background: 'rgba(245,158,11,0.08)', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                        >
                                            🔄 Reintentar
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleDelete(c.id, c.title)}
                                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}
                                    >
                                        🗑 Eliminar
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
