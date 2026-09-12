'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { GaugeChart, DonutChart } from '@/components/Charts';
import MathText from '@/components/MathText';

// ─── helpers ──────────────────────────────────────────────
const DIFFICULTY_CFG = {
    facil:   { label: 'Fácil',   bg: '#22c55e22', color: '#22c55e' },
    media:   { label: 'Media',   bg: '#f59e0b22', color: '#f59e0b' },
    dificil: { label: 'Difícil', bg: '#ef444422', color: '#ef4444' },
};
const Chip = ({ label, bg, color, style = {} }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '0.15rem 0.55rem', borderRadius: 20, fontSize: '0.7rem', fontWeight: 700, background: bg, color, ...style }}>{label}</span>
);

// ─── Componente principal ──────────────────────────────────
export default function ContentDetailPage() {
    const router = useRouter();
    const { id } = useParams();

    const [content,         setContent]         = useState(null);
    const [loading,         setLoading]         = useState(true);
    const [activeTab,       setActiveTab]       = useState('preguntas');
    const [report,          setReport]          = useState(null);
    const [loadingReport,   setLoadingReport]   = useState(false);
    const [regenerating,    setRegenerating]    = useState(false);
    const [showRegenModal,  setShowRegenModal]  = useState(false);
    const [showAddManual,   setShowAddManual]   = useState(false);

    // Para la tab de publicación
    const [students,        setStudents]        = useState([]);
    const [pubGrade,        setPubGrade]        = useState('');
    const [pubStudents,     setPubStudents]     = useState([]);
    const [pubType,         setPubType]         = useState('quiz');    // quiz | tarea | evaluacion
    const [pubDeadline,     setPubDeadline]     = useState('');
    const [pubNote,         setPubNote]         = useState('');
    const [publishing,      setPublishing]      = useState(false);
    const [pubSuccess,      setPubSuccess]      = useState('');
    const [pubError,        setPubError]        = useState('');

    // Para editar pregunta
    const [editQ,           setEditQ]           = useState(null);

    // Form manual question
    const [mText,  setMText]  = useState('');
    const [mA,     setMA]     = useState('');
    const [mB,     setMB]     = useState('');
    const [mC,     setMC]     = useState('');
    const [mD,     setMD]     = useState('');
    const [mCorr,  setMCorr]  = useState('A');
    const [mDiff,  setMDiff]  = useState('media');
    const [mExp,   setMExp]   = useState('');

    const getToken = () => sessionStorage.getItem('adminToken');

    // ── fetch content ────────────────────────────────────────
    const fetchContent = useCallback(async () => {
        try {
            const res  = await fetch(`/api/teacher/content/${id}`, {
                headers: { Authorization: 'Bearer ' + getToken() },
            });
            if (res.status === 401) { router.push('/admin'); return; }
            const data = await res.json();
            setContent(data.content);
        } catch {}
        finally { setLoading(false); }
    }, [id, router]);

    useEffect(() => {
        if (!getToken()) { router.push('/admin'); return; }
        fetchContent();
    }, [fetchContent]);

    // ── fetch students (para asignación) ─────────────────────
    const fetchStudents = useCallback(async () => {
        if (students.length > 0) return;
        try {
            const res  = await fetch('/api/admin/students', {
                headers: { Authorization: 'Bearer ' + getToken() },
            });
            const data = await res.json();
            setStudents(data.students || []);
        } catch {}
    }, [students.length]);

    useEffect(() => {
        if (activeTab === 'publicar') fetchStudents();
    }, [activeTab, fetchStudents]);

    // ── actions ───────────────────────────────────────────────
    const doAction = async (action, body = {}) => {
        await fetch(`/api/teacher/content/${id}`, {
            method: 'PATCH',
            headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...body }),
        });
        fetchContent();
    };

    const fetchReport = async () => {
        setLoadingReport(true);
        try {
            const res  = await fetch(`/api/teacher/content/${id}/report`, {
                headers: { Authorization: 'Bearer ' + getToken() },
            });
            const data = await res.json();
            setReport(data.report);
        } catch {}
        finally { setLoadingReport(false); }
    };

    const handleRegenerate = async () => {
        setShowRegenModal(false);
        setRegenerating(true);
        try {
            await fetch(`/api/teacher/content/${id}`, {
                method: 'PATCH',
                headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'regenerate_questions' }),
            });
            const poll = setInterval(async () => {
                const res  = await fetch(`/api/teacher/content/${id}`, {
                    headers: { Authorization: 'Bearer ' + getToken() },
                });
                const data = await res.json();
                if (['ready','error'].includes(data.content?.status)) {
                    clearInterval(poll);
                    setContent(data.content);
                    setRegenerating(false);
                }
            }, 3000);
        } catch { setRegenerating(false); }
    };

    const handleAddManual = async (e) => {
        e.preventDefault();
        if (!mText.trim() || !mA || !mB || !mC || !mD) return;
        await doAction('add_manual_question', {
            text: mText, options: { A: mA, B: mB, C: mC, D: mD },
            correctOption: mCorr, difficulty: mDiff, explanation: mExp,
            topic: content?.topic || 'General',
        });
        setShowAddManual(false);
        setMText(''); setMA(''); setMB(''); setMC(''); setMD(''); setMCorr('A'); setMDiff('media'); setMExp('');
    };

    // ── publicación ──────────────────────────────────────────
    const studentsForGrade = pubGrade
        ? students.filter(s => s.schoolGrade === parseInt(pubGrade))
        : students;

    const toggleStudent = (id) => {
        setPubStudents(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    };

    const handlePublish = async () => {
        const approved = content?.questions?.filter(q => q.isApproved) || [];
        if (approved.length === 0) { setPubError('Debes aprobar al menos una pregunta antes de publicar.'); return; }
        if (pubStudents.length === 0 && !pubGrade) { setPubError('Selecciona un grado o estudiantes específicos.'); return; }

        setPublishing(true); setPubError('');
        try {
            const res = await fetch(`/api/admin/assign-content`, {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: id,
                    assignToGrade:    pubGrade    || null,
                    assignToStudents: pubStudents.length > 0 ? pubStudents : null,
                    assignmentType:   pubType,
                    deadline:         pubDeadline || null,
                    note:             pubNote     || null,
                }),
            });
            const data = await res.json();
            if (data.success || res.ok) {
                setPubSuccess(`✅ Contenido publicado exitosamente${pubGrade ? ` al grado ${pubGrade}°` : ` a ${pubStudents.length} estudiante(s)`}.`);
                setPubGrade(''); setPubStudents([]); setPubNote(''); setPubDeadline('');
                setTimeout(() => setPubSuccess(''), 6000);
            } else {
                setPubError(data.error || 'Error al publicar');
            }
        } catch { setPubError('Error de conexión'); }
        finally { setPublishing(false); }
    };

    // ── render guards ─────────────────────────────────────────
    if (loading) return (
        <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📚</div>
            Cargando contenido...
        </div>
    );
    if (!content) return (
        <div className="app-container" style={{ textAlign: 'center', padding: '5rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>❌</div>
            Contenido no encontrado.{' '}
            <Link href="/admin/content" style={{ color: 'var(--accent-primary)' }}>← Volver</Link>
        </div>
    );

    // ── stats ─────────────────────────────────────────────────
    const concepts     = content.keyConcepts;
    const mainTopic    = concepts?.temaPrincipal;
    const approved     = content.questions.filter(q => q.isApproved);
    const pending      = content.questions.filter(q => !q.isApproved);
    const totalResults = content.results.length;
    const uniqueStuds  = new Set(content.results.map(r => r.userId)).size;
    const avgPct       = totalResults > 0
        ? Math.round(content.results.reduce((s, r) => s + r.percentage, 0) / totalResults)
        : 0;

    const TABS = [
        { id: 'preguntas', label: `📝 Preguntas (${content.questions.length})` },
        { id: 'publicar',  label: `🚀 Publicar${approved.length > 0 ? ` (${approved.length} listas)` : ''}` },
        { id: 'resultados',label: `📊 Resultados (${totalResults})` },
        { id: 'conceptos', label: `🧠 Conceptos` },
        { id: 'reporte',   label: `📋 Reporte IA` },
    ];

    return (
        <div className="app-container" style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>

            {/* NAVBAR */}
            <nav className="navbar" style={{ marginBottom: '1.5rem', borderBottom: '2px solid rgba(245,158,11,0.3)' }}>
                <div className="navbar-brand">
                    <div className="navbar-logo">📚</div>
                    <span className="navbar-title" style={{ fontSize: '0.95rem' }}>{content.title}</span>
                </div>
                <div className="navbar-nav">
                    <Link href="/admin/content" className="nav-link">← Contenidos</Link>
                    <Link href="/admin/dashboard" className="nav-link">Panel Admin</Link>
                </div>
            </nav>

            {/* META INFO */}
            <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
                <span style={{ padding: '0.2rem 0.65rem', borderRadius: 12, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', fontSize: '0.8rem', fontWeight: 700 }}>🎓 {content.schoolGrade}°</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📐 {content.topic}</span>
                {mainTopic && <span style={{ padding: '0.2rem 0.65rem', borderRadius: 12, background: 'rgba(255,105,0,0.12)', color: 'var(--accent-primary)', fontSize: '0.8rem', fontWeight: 700 }}>🎯 {mainTopic}</span>}
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    ✅ {approved.length} aprobadas · ⏳ {pending.length} pendientes · 👥 {uniqueStuds} estudiantes
                </span>
            </div>

            {/* KPI CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
                {[
                    { icon: '📝', v: content.questions.length, l: 'Preguntas',   c: 'var(--accent-primary)' },
                    { icon: '✅', v: approved.length,          l: 'Aprobadas',   c: '#22c55e' },
                    { icon: '⏳', v: pending.length,           l: 'Por revisar', c: '#f59e0b' },
                    { icon: '👥', v: uniqueStuds,              l: 'Estudiantes', c: '#6366f1' },
                    { icon: '📊', v: `${avgPct}%`,             l: 'Promedio',    c: avgPct >= 60 ? '#22c55e' : '#ef4444' },
                ].map((k, i) => (
                    <div key={i} className="card" style={{ padding: '0.85rem 1rem', textAlign: 'center' }}>
                        <div style={{ fontSize: '1.2rem' }}>{k.icon}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: k.c }}>{k.v}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{k.l}</div>
                    </div>
                ))}
            </div>

            {/* TABS */}
            <div style={{ display: 'flex', gap: '0.2rem', marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', flexWrap: 'wrap' }}>
                {TABS.map(t => (
                    <button key={t.id}
                        onClick={() => { setActiveTab(t.id); if (t.id === 'reporte' && !report) fetchReport(); }}
                        style={{
                            padding: '0.7rem 1.1rem', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600,
                            background: activeTab === t.id ? 'var(--accent-primary)' : 'transparent',
                            color: activeTab === t.id ? '#fff' : 'var(--text-secondary)',
                            borderRadius: '8px 8px 0 0', transition: 'all 0.15s',
                        }}>
                        {t.label}
                    </button>
                ))}
            </div>

            {/* ══════════════════════════════════════════════ */}
            {/* TAB: PREGUNTAS                               */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'preguntas' && (
                <div>
                    {/* Barra de acciones */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                            Revisa, edita o aprueba preguntas existentes. La regeneracion con IA esta desactivada.
                            {pending.length > 0 && <> — <strong style={{ color: '#f59e0b' }}>{pending.length} pendiente{pending.length !== 1 ? 's' : ''} de aprobación</strong></>}
                        </p>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            <button onClick={() => setShowAddManual(!showAddManual)} style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: '#3b82f6', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}>
                                ✏️ Agregar Manual
                            </button>
                            <button disabled style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'not-allowed', opacity: 0.45 }}>
                                Regeneracion IA desactivada
                            </button>
                            <button onClick={() => doAction('approve_all')} className="btn btn-primary" style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem' }}>
                                ✅ Aprobar Todas
                            </button>
                        </div>
                    </div>

                    {/* Form: Agregar pregunta manual */}
                    {showAddManual && (
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem', border: '2px dashed rgba(59,130,246,0.4)' }}>
                            <h4 style={{ marginBottom: '1rem', color: '#3b82f6' }}>✏️ Nueva Pregunta Manual</h4>
                            <form onSubmit={handleAddManual}>
                                <div className="input-group" style={{ marginBottom: '0.75rem' }}>
                                    <label className="input-label">Enunciado *</label>
                                    <textarea className="input" rows={3} value={mText} onChange={e => setMText(e.target.value)} placeholder="Escribe la pregunta aquí..." required />
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    {[['A', mA, setMA], ['B', mB, setMB], ['C', mC, setMC], ['D', mD, setMD]].map(([l, v, sv]) => (
                                        <div key={l} className="input-group">
                                            <label className="input-label">Opción {l} *</label>
                                            <input className="input" value={v} onChange={e => sv(e.target.value)} placeholder={`Opción ${l}`} required />
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <div className="input-group">
                                        <label className="input-label">Respuesta correcta</label>
                                        <select className="input" value={mCorr} onChange={e => setMCorr(e.target.value)}>
                                            {['A','B','C','D'].map(x => <option key={x}>{x}</option>)}
                                        </select>
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Dificultad</label>
                                        <select className="input" value={mDiff} onChange={e => setMDiff(e.target.value)}>
                                            <option value="facil">Fácil</option>
                                            <option value="media">Media</option>
                                            <option value="dificil">Difícil</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="input-group" style={{ marginBottom: '1rem' }}>
                                    <label className="input-label">Explicación (opcional)</label>
                                    <input className="input" value={mExp} onChange={e => setMExp(e.target.value)} placeholder="Explicación de la respuesta correcta..." />
                                </div>
                                <div style={{ display: 'flex', gap: '0.75rem' }}>
                                    <button type="submit" className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>💾 Guardar Pregunta</button>
                                    <button type="button" onClick={() => setShowAddManual(false)} className="btn" style={{ fontSize: '0.85rem', padding: '0.5rem 1.25rem' }}>Cancelar</button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Modal: regeneracion desactivada */}
                    {showRegenModal && (
                        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                            <div className="card" style={{ padding: '2rem', maxWidth: 420, textAlign: 'center' }}>
                                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🔄</div>
                                <h3 style={{ marginBottom: '0.75rem' }}>Regeneracion IA desactivada</h3>
                                <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
                                    El sistema ya no genera ni regenera preguntas con IA.
                                </p>
                                <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
                                    <button className="btn" onClick={() => setShowRegenModal(false)} style={{ padding: '0.5rem 1.5rem' }}>Cancelar</button>
                                    <button className="btn btn-primary" disabled style={{ padding: '0.5rem 1.5rem', background: '#f59e0b', opacity: 0.45, cursor: 'not-allowed' }}>Desactivado</button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Estado: regenerando */}
                    {regenerating && (
                        <div className="card" style={{ padding: '2rem', textAlign: 'center', marginBottom: '1rem', border: '1px solid rgba(245,158,11,0.3)' }}>
                            <div style={{ fontSize: '2rem', marginBottom: '0.5rem', animation: 'spin 2s linear infinite', display: 'inline-block' }}>🔄</div>
                            <p style={{ fontWeight: 600 }}>Regeneracion desactivada</p>
                            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>El nuevo banco se carga como JSON de Pruebas de Estado.</p>
                        </div>
                    )}

                    {/* LISTA DE PREGUNTAS */}
                    {content.questions.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                            No hay preguntas cargadas.
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '0.75rem' }}>
                            {content.questions.map((q, i) => {
                                const dc  = DIFFICULTY_CFG[q.difficulty] || DIFFICULTY_CFG.media;
                                return (
                                    <div key={q.id} className="card" style={{
                                        padding: '1.25rem',
                                        borderLeft: `4px solid ${q.isApproved ? '#22c55e' : q.isManual ? '#3b82f6' : '#f59e0b'}`,
                                    }}>
                                        {/* Header de la pregunta */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                                            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                                                <Chip label={`#${i + 1}`} bg="rgba(255,255,255,0.06)" color="var(--text-secondary)" />
                                                <Chip label={dc.label} bg={dc.bg} color={dc.color} />
                                                {q.isManual   && <Chip label="Manual"   bg="#3b82f622" color="#3b82f6" />}
                                                {q.isApproved && <Chip label="✓ Aprobada" bg="#22c55e22" color="#22c55e" />}
                                                {q.conceptRelated && <Chip label={`📌 ${q.conceptRelated}`} bg="rgba(168,85,247,0.12)" color="#a855f7" />}
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                                                {!q.isApproved && (
                                                    <button onClick={() => doAction('approve_question', { questionId: q.id })}
                                                        style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}>
                                                        ✅ Aprobar
                                                    </button>
                                                )}
                                                <button onClick={() => doAction('reject_question', { questionId: q.id })}
                                                    style={{ padding: '0.25rem 0.65rem', fontSize: '0.75rem', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 'var(--radius-sm)', background: 'transparent', cursor: 'pointer' }}>
                                                    🗑
                                                </button>
                                            </div>
                                        </div>

                                        {/* Texto de la pregunta */}
                                        <div style={{ fontSize: '0.95rem', lineHeight: 1.6, marginBottom: '0.85rem' }}>
                                            <MathText text={q.text} />
                                        </div>

                                        {/* Opciones */}
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                            {Object.entries(q.options || {}).map(([key, val]) => (
                                                <div key={key} style={{
                                                    padding: '0.5rem 0.75rem', borderRadius: 8, fontSize: '0.85rem',
                                                    border: key === q.correctOption ? '2px solid #22c55e' : '1px solid var(--border-color)',
                                                    background: key === q.correctOption ? 'rgba(34,197,94,0.08)' : 'transparent',
                                                }}>
                                                    <strong style={{ color: key === q.correctOption ? '#22c55e' : undefined }}>{key})</strong> <MathText text={val} />
                                                </div>
                                            ))}
                                        </div>

                                        {/* Explicación */}
                                        {q.explanation && (
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                                                💡 <MathText text={q.explanation} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* TAB: PUBLICAR                                */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'publicar' && (
                <div>
                    {approved.length === 0 ? (
                        <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⏳</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>Sin preguntas aprobadas</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
                                Aprueba al menos una pregunta en la pestaña &quot;Preguntas&quot; antes de publicar.
                            </p>
                            <button className="btn btn-primary" onClick={() => setActiveTab('preguntas')}>
                                → Ir a Preguntas
                            </button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1.25rem' }}>
                            {/* Resumen */}
                            <div className="card" style={{ padding: '1.25rem', background: 'rgba(34,197,94,0.04)', borderColor: 'rgba(34,197,94,0.2)' }}>
                                <h3 style={{ marginBottom: '0.5rem', color: '#22c55e' }}>✅ Listo para publicar</h3>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                    <strong>{approved.length}</strong> pregunta{approved.length !== 1 ? 's' : ''} aprobada{approved.length !== 1 ? 's' : ''} disponible{approved.length !== 1 ? 's' : ''}.
                                    Asigna este contenido a un grado completo o estudiantes específicos.
                                </p>
                            </div>

                            {/* Tipo de asignación */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>📋 Tipo de Actividad</h4>
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    {[
                                        { v: 'quiz',        label: '⚡ Quiz',       desc: 'Evaluación rápida' },
                                        { v: 'tarea',       label: '📚 Tarea',      desc: 'Actividad en casa' },
                                        { v: 'evaluacion',  label: '📝 Evaluación', desc: 'Prueba formal' },
                                    ].map(t => (
                                        <button key={t.v} onClick={() => setPubType(t.v)} style={{
                                            padding: '0.85rem 1.5rem', borderRadius: 12, cursor: 'pointer',
                                            border: pubType === t.v ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                            background: pubType === t.v ? 'rgba(255,105,0,0.1)' : 'var(--bg-input)',
                                            color: pubType === t.v ? 'var(--accent-primary)' : 'var(--text-primary)',
                                            fontWeight: pubType === t.v ? 700 : 500, textAlign: 'center', minWidth: 140,
                                        }}>
                                            <div style={{ fontSize: '0.95rem', marginBottom: '0.2rem' }}>{t.label}</div>
                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{t.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Asignar a grado */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>🎓 Asignar a Grado Completo</h4>
                                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                                    <button onClick={() => setPubGrade('')} style={{
                                        padding: '0.4rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', cursor: 'pointer',
                                        border: !pubGrade ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                        background: !pubGrade ? 'rgba(255,105,0,0.1)' : 'transparent',
                                        color: !pubGrade ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                        fontWeight: !pubGrade ? 700 : 500,
                                    }}>Ninguno (individual)</button>
                                    {[6,7,8,9,10,11].map(g => {
                                        const count = students.filter(s => s.schoolGrade === g).length;
                                        return (
                                            <button key={g} onClick={() => { setPubGrade(String(g)); setPubStudents([]); }} style={{
                                                padding: '0.4rem 0.9rem', borderRadius: 20, fontSize: '0.82rem', cursor: 'pointer',
                                                border: pubGrade === String(g) ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)',
                                                background: pubGrade === String(g) ? 'rgba(255,105,0,0.1)' : 'transparent',
                                                color: pubGrade === String(g) ? 'var(--accent-primary)' : 'var(--text-secondary)',
                                                fontWeight: pubGrade === String(g) ? 700 : 500,
                                            }}>
                                                {g}° <span style={{ fontSize: '0.65rem', color: 'inherit', opacity: 0.7 }}>({count})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Asignar a estudiantes individuales */}
                            {!pubGrade && (
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '1rem' }}>👤 Asignar a Estudiantes Específicos</h4>
                                    {students.length === 0 ? (
                                        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando estudiantes...</p>
                                    ) : (
                                        <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                            {students.map(s => {
                                                const sel = pubStudents.includes(s.id);
                                                return (
                                                    <div key={s.id} onClick={() => toggleStudent(s.id)} style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem',
                                                        borderRadius: 'var(--radius-md)', cursor: 'pointer',
                                                        background: sel ? 'rgba(255,105,0,0.08)' : 'var(--bg-input)',
                                                        border: sel ? '1px solid rgba(255,105,0,0.3)' : '1px solid transparent',
                                                        transition: 'all 0.15s',
                                                    }}>
                                                        <div style={{ width: 20, height: 20, borderRadius: 4, border: sel ? '2px solid var(--accent-primary)' : '2px solid var(--border-color)', background: sel ? 'var(--accent-primary)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                            {sel && <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 900 }}>✓</span>}
                                                        </div>
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{s.name || s.username}</div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{s.username}{s.schoolGrade ? ` · ${s.schoolGrade}°` : ''}</div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {pubStudents.length > 0 && (
                                        <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: 'var(--accent-primary)', fontWeight: 600 }}>
                                            {pubStudents.length} estudiante{pubStudents.length !== 1 ? 's' : ''} seleccionado{pubStudents.length !== 1 ? 's' : ''}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Configuración opcional */}
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h4 style={{ marginBottom: '1rem' }}>⚙️ Opciones</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <div className="input-group">
                                        <label className="input-label">Fecha límite (opcional)</label>
                                        <input type="date" className="input" value={pubDeadline} onChange={e => setPubDeadline(e.target.value)} min={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <div className="input-group">
                                        <label className="input-label">Notas para el estudiante</label>
                                        <input className="input" value={pubNote} onChange={e => setPubNote(e.target.value)} placeholder="Instrucciones adicionales..." />
                                    </div>
                                </div>
                            </div>

                            {/* Mensajes */}
                            {pubError   && <div style={{ padding: '0.85rem', borderRadius: 10, background: 'rgba(239,68,68,0.1)',  border: '1px solid rgba(239,68,68,0.3)',  color: '#ef4444',  fontSize: '0.85rem' }}>{pubError}</div>}
                            {pubSuccess  && <div style={{ padding: '0.85rem', borderRadius: 10, background: 'rgba(34,197,94,0.1)',  border: '1px solid rgba(34,197,94,0.3)',  color: '#22c55e',  fontSize: '0.85rem' }}>{pubSuccess}</div>}

                            {/* Botón publicar */}
                            <button
                                className="btn btn-primary"
                                onClick={handlePublish}
                                disabled={publishing || (pubStudents.length === 0 && !pubGrade)}
                                style={{ padding: '0.85rem', fontSize: '1rem', fontWeight: 700, opacity: (pubStudents.length === 0 && !pubGrade) ? 0.5 : 1 }}
                            >
                                {publishing ? '⏳ Publicando...' : `🚀 Publicar ${pubType.charAt(0).toUpperCase() + pubType.slice(1)}${pubGrade ? ` al grado ${pubGrade}°` : pubStudents.length > 0 ? ` a ${pubStudents.length} estudiante(s)` : ''}`}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* TAB: RESULTADOS                              */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'resultados' && (
                <div>
                    {totalResults === 0 ? (
                        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📊</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>Sin resultados aún</h3>
                            <p style={{ color: 'var(--text-secondary)' }}>
                                Cuando los estudiantes completen el contenido, los resultados aparecerán aquí.
                            </p>
                        </div>
                    ) : (
                        <>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '0.75rem' }}>Precisión Promedio</h4>
                                    <GaugeChart value={avgPct} label="% Promedio" />
                                </div>
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h4 style={{ marginBottom: '0.75rem' }}>Distribución</h4>
                                    <DonutChart
                                        data={[
                                            { label: 'Aprobados (≥60%)', value: content.results.filter(r => r.percentage >= 60).length, color: '#22c55e' },
                                            { label: 'Reprobados (<60%)', value: content.results.filter(r => r.percentage < 60).length, color: '#ef4444' },
                                        ].filter(d => d.value > 0)}
                                        height={180}
                                    />
                                </div>
                            </div>
                            <div className="card" style={{ overflow: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                                            <th style={{ padding: '0.75rem 1rem' }}>Estudiante</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Intento</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>Score</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>%</th>
                                            <th style={{ padding: '0.75rem 1rem', textAlign: 'right' }}>Fecha</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {content.results.map(r => (
                                            <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                                <td style={{ padding: '0.75rem 1rem' }}>
                                                    <div style={{ fontWeight: 600 }}>{r.user?.fullName || r.user?.username}</div>
                                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{r.user?.schoolGrade ? `${r.user.schoolGrade}°` : ''}</div>
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>#{r.attemptNumber}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center' }}>{r.score}/{r.totalQuestions}</td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'center', fontWeight: 700, color: r.percentage >= 60 ? '#22c55e' : '#ef4444' }}>
                                                    {Math.round(r.percentage)}%
                                                </td>
                                                <td style={{ padding: '0.75rem 1rem', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.8rem' }}>
                                                    {new Date(r.completedAt).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* TAB: CONCEPTOS                               */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'conceptos' && concepts && (
                <div>
                    {concepts.resumenContenido && (
                        <div className="card" style={{ padding: '1.5rem', marginBottom: '1.25rem' }}>
                            <h3 style={{ marginBottom: '0.5rem' }}>📄 Resumen del Documento</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>{concepts.resumenContenido}</p>
                            <div style={{ display: 'flex', gap: '0.6rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                                {concepts.nivelComplejidad && <Chip label={`Complejidad: ${concepts.nivelComplejidad}`} bg="rgba(255,105,0,0.1)" color="var(--accent-primary)" />}
                                {concepts.gradoRecomendado && <Chip label={`Grado recomendado: ${concepts.gradoRecomendado}°`} bg="rgba(59,130,246,0.1)" color="#3b82f6" />}
                                {(concepts.formulasIdentificadas||[]).length > 0 && <Chip label={`${concepts.formulasIdentificadas.length} fórmulas`} bg="rgba(168,85,247,0.1)" color="#a855f7" />}
                                {(concepts.ejemplosResueltos||[]).length > 0 && <Chip label={`${concepts.ejemplosResueltos.length} ejemplos`} bg="rgba(34,197,94,0.1)" color="#22c55e" />}
                            </div>
                        </div>
                    )}

                    <h3 style={{ marginBottom: '0.75rem' }}>🧠 Conceptos Clave ({(concepts.conceptosClave||[]).length})</h3>
                    <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.5rem' }}>
                        {(concepts.conceptosClave||[]).map((c, i) => (
                            <div key={i} className="card" style={{ padding: '1rem', borderLeft: `3px solid ${c.importancia === 'alta' ? '#ef4444' : c.importancia === 'media' ? '#f59e0b' : '#22c55e'}` }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                                    <strong>{c.nombre}</strong>
                                    {c.pensamientoMEN && <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{c.pensamientoMEN}</span>}
                                </div>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{c.descripcion}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ══════════════════════════════════════════════ */}
            {/* TAB: REPORTE IA                              */}
            {/* ══════════════════════════════════════════════ */}
            {activeTab === 'reporte' && (
                <div>
                    {loadingReport ? (
                        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🤖</div>
                            <p>Generando reporte con IA...</p>
                        </div>
                    ) : !report ? (
                        <div className="card" style={{ padding: '4rem', textAlign: 'center' }}>
                            <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>📋</div>
                            <h3 style={{ marginBottom: '0.5rem' }}>Reporte IA</h3>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>Se necesita al menos 1 resultado de estudiante para generar el reporte de grupo.</p>
                            <button className="btn btn-primary" onClick={fetchReport}>Generar Reporte</button>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <div className="card" style={{ padding: '1.5rem' }}>
                                <h3 style={{ marginBottom: '0.75rem' }}>📋 Diagnóstico Grupal</h3>
                                <p style={{ lineHeight: 1.7, color: 'var(--text-secondary)' }}>{report.resumenEjecutivo}</p>
                            </div>
                            {(report.recomendacionesPedagogicas||[]).length > 0 && (
                                <div className="card" style={{ padding: '1.5rem' }}>
                                    <h3 style={{ marginBottom: '0.75rem' }}>🎯 Recomendaciones</h3>
                                    {report.recomendacionesPedagogicas.map((r, i) => (
                                        <div key={i} style={{ padding: '0.75rem', borderLeft: `3px solid ${r.prioridad === 'alta' ? '#ef4444' : '#f59e0b'}`, marginBottom: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '0 8px 8px 0' }}>
                                            <p style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{r.recomendacion}</p>
                                            {r.estrategiaSugerida && <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>💡 {r.estrategiaSugerida}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {(report.alertasDocente||[]).length > 0 && (
                                <div className="card" style={{ padding: '1.5rem', borderLeft: '4px solid #ef4444' }}>
                                    <h3 style={{ marginBottom: '0.75rem', color: '#ef4444' }}>⚠️ Alertas</h3>
                                    {report.alertasDocente.map((a, i) => <p key={i} style={{ marginBottom: '0.4rem' }}>• {a}</p>)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
