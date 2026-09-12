'use client';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';

export default function StudentMensajesPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const [conversations, setConversations] = useState([]);
    const [activeConv, setActiveConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [sending, setSending] = useState(false);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [fileAttachment, setFileAttachment] = useState(null);
    const messagesEndRef = useRef(null);
    const fileInputRef = useRef(null);
    const pollingRef = useRef(null);

    // Proteger ruta — solo estudiantes con NextAuth session
    useEffect(() => {
        if (status === 'unauthenticated') {
            router.push('/login');
        }
    }, [status, router]);

    // Cargar conversaciones
    const fetchConversations = useCallback(async () => {
        try {
            const res = await fetch('/api/messages/conversations');
            if (res.ok) {
                const data = await res.json();
                setConversations(data.conversations || []);
            }
        } catch (e) {
            console.error('Error:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (session) fetchConversations();
    }, [session, fetchConversations]);

    // Polling de mensajes
    useEffect(() => {
        if (!activeConv) return;
        const fetchMessages = async () => {
            try {
                const res = await fetch(`/api/messages/${activeConv.id}`);
                if (res.ok) {
                    const data = await res.json();
                    setMessages(data.messages || []);
                }
            } catch (e) {
                console.error('Error polling:', e);
            }
        };
        fetchMessages();
        pollingRef.current = setInterval(fetchMessages, 3000);
        return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
    }, [activeConv]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!session) return;
        const interval = setInterval(fetchConversations, 10000);
        return () => clearInterval(interval);
    }, [session, fetchConversations]);

    const handleSelectConversation = (conv) => {
        setActiveConv(conv);
        setMessages([]);
        setConversations(prev => prev.map(c =>
            c.id === conv.id ? { ...c, unreadCount: 0 } : c
        ));
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if ((!newMessage.trim() && !fileAttachment) || sending || !activeConv) return;
        setSending(true);
        try {
            const body = {};
            if (fileAttachment) {
                body.content = newMessage || '';
                body.messageType = fileAttachment.type.startsWith('image/') ? 'image' : 'file';
                body.fileData = fileAttachment.base64;
                body.fileName = fileAttachment.name;
            } else {
                body.content = newMessage;
                body.messageType = 'text';
            }
            const res = await fetch(`/api/messages/${activeConv.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, data.message]);
                setNewMessage('');
                setFileAttachment(null);
                fetchConversations();
            }
        } catch (e) {
            console.error('Error enviando:', e);
        } finally {
            setSending(false);
        }
    };

    const handleFileSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const maxSize = file.type.startsWith('image/') ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
        if (file.size > maxSize) {
            alert(`Archivo demasiado grande. Máximo: ${file.type.startsWith('image/') ? '5MB' : '10MB'}`);
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            setFileAttachment({ name: file.name, type: file.type, base64, size: file.size });
        };
        reader.readAsDataURL(file);
    };

    const formatTime = (dateStr) => {
        const d = new Date(dateStr);
        const now = new Date();
        const diff = now - d;
        if (diff < 60000) return 'Ahora';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
        if (diff < 86400000) return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
        return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
    };

    const formatMessageTime = (dateStr) => {
        return new Date(dateStr).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    };

    const filteredConversations = searchTerm
        ? conversations.filter(c => c.contact.name.toLowerCase().includes(searchTerm.toLowerCase()))
        : conversations;

    if (status === 'loading' || !session) {
        return (
            <div className="loading-container">
                <div className="loading-spinner"></div>
                <p className="loading-text">Cargando mensajes...</p>
            </div>
        );
    }

    return (
        <div className="app-container">
            {/* NAVBAR ESTUDIANTE */}
            <nav className="navbar">
                <Link href="/dashboard" className="navbar-brand">
                    <div className="navbar-logo">YT</div>
                    <span className="navbar-title">YedaTech</span>
                </Link>
                <div className="navbar-nav">
                    <Link href="/dashboard" className="nav-link">Dashboard</Link>
                    <Link href="/pruebas-estado" className="nav-link">Pruebas de Estado</Link>
                    <Link href="/tutor" className="nav-link">Tutor</Link>
                    <Link href="/mensajes" className="nav-link active">💬 Mensajes</Link>
                    <Link href="/diagnostic" className="nav-link">Diagnóstico</Link>
                    <Link href="/analytics" className="nav-link">Analítica</Link>
                </div>
                <div className="nav-user">
                    <div className="nav-user-info">
                        <div className="nav-user-name">{session.user.name || 'Estudiante'}</div>
                        <div className="nav-user-level">Nivel {session.user.currentLevel || 1}</div>
                    </div>
                </div>
            </nav>

            {/* CHAT LAYOUT */}
            <div className="dm-layout">
                {/* SIDEBAR */}
                <div className="dm-sidebar">
                    <div className="dm-sidebar-header">
                        <h2>💬 Mensajes</h2>
                        <span className="dm-total-badge">
                            {conversations.reduce((s, c) => s + c.unreadCount, 0) || ''}
                        </span>
                    </div>
                    <div className="dm-search">
                        <input
                            className="input"
                            type="text"
                            placeholder="🔍 Buscar conversación..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            id="dm-search"
                        />
                    </div>
                    <div className="dm-conversation-list">
                        {loading ? (
                            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                                <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
                                Cargando...
                            </div>
                        ) : filteredConversations.length === 0 ? (
                            <div className="dm-empty-state">
                                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💬</div>
                                <p>No hay conversaciones aún</p>
                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                    Tu profesor te enviará un mensaje pronto
                                </p>
                            </div>
                        ) : (
                            filteredConversations.map(conv => (
                                <div
                                    key={conv.id}
                                    className={`dm-conversation-item ${activeConv?.id === conv.id ? 'active' : ''} ${conv.unreadCount > 0 ? 'unread' : ''}`}
                                    onClick={() => handleSelectConversation(conv)}
                                >
                                    <div className="dm-avatar">
                                        {(conv.contact.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="dm-conv-info">
                                        <div className="dm-conv-header">
                                            <span className="dm-conv-name">{conv.contact.name}</span>
                                            {conv.lastMessage && (
                                                <span className="dm-conv-time">{formatTime(conv.lastMessage.time)}</span>
                                            )}
                                        </div>
                                        <div className="dm-conv-preview">
                                            <span className="dm-conv-last-msg">
                                                {conv.lastMessage
                                                    ? `${conv.lastMessage.isOwn ? 'Tú: ' : ''}${conv.lastMessage.content}`
                                                    : 'Sin mensajes'}
                                            </span>
                                            {conv.unreadCount > 0 && (
                                                <span className="dm-unread-badge">{conv.unreadCount}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* MAIN CHAT AREA */}
                <div className="dm-chat-area">
                    {activeConv ? (
                        <>
                            <div className="dm-chat-header">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                    <div className="dm-avatar" style={{ width: 40, height: 40, fontSize: '1rem' }}>
                                        {(activeConv.contact.name || '?').charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 style={{ fontWeight: 700, fontSize: '1rem' }}>{activeConv.contact.name}</h3>
                                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            {activeConv.contact.username || 'Profesor'}
                                        </p>
                                    </div>
                                </div>
                                <button className="dm-back-btn" onClick={() => setActiveConv(null)}>← Volver</button>
                            </div>

                            <div className="dm-messages">
                                {messages.length === 0 ? (
                                    <div className="dm-empty-chat">
                                        <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🤝</div>
                                        <h3>Inicio de conversación</h3>
                                        <p>Envía un mensaje a {activeConv.contact.name}</p>
                                    </div>
                                ) : (
                                    messages.map(msg => (
                                        <div key={msg.id} className={`dm-message ${msg.isOwn ? 'own' : 'other'}`}>
                                            <div className="dm-bubble">
                                                {msg.messageType === 'image' && msg.fileUrl && (
                                                    <img src={msg.fileUrl} alt="Imagen" className="dm-attached-image" onClick={() => window.open(msg.fileUrl, '_blank')} />
                                                )}
                                                {msg.messageType === 'file' && msg.fileUrl && (
                                                    <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="dm-file-link">📎 {msg.fileName || 'Archivo'}</a>
                                                )}
                                                {msg.content && <p className="dm-msg-text">{msg.content}</p>}
                                                <div className="dm-msg-meta">
                                                    <span className="dm-msg-time">{formatMessageTime(msg.createdAt)}</span>
                                                    {msg.isOwn && (
                                                        <span className={`dm-msg-status ${msg.isRead ? 'read' : ''}`}>
                                                            {msg.isRead ? '✓✓' : '✓'}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {fileAttachment && (
                                <div className="dm-file-preview">
                                    <div className="dm-file-preview-info">
                                        <span>{fileAttachment.type.startsWith('image/') ? '🖼️' : '📄'}</span>
                                        <span className="dm-file-name">{fileAttachment.name}</span>
                                        <span className="dm-file-size">({(fileAttachment.size / 1024).toFixed(0)} KB)</span>
                                    </div>
                                    <button className="dm-file-remove" onClick={() => setFileAttachment(null)}>✕</button>
                                </div>
                            )}

                            <form className="dm-input-area" onSubmit={handleSendMessage}>
                                <button type="button" className="dm-attach-btn" onClick={() => fileInputRef.current?.click()}>📎</button>
                                <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }} accept="image/*,.pdf,.doc,.docx" />
                                <input
                                    className="dm-text-input"
                                    type="text"
                                    placeholder="Escribe un mensaje..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    disabled={sending}
                                    id="dm-message-input"
                                />
                                <button type="submit" className="dm-send-btn" disabled={sending || (!newMessage.trim() && !fileAttachment)} id="dm-send-btn">
                                    {sending ? '...' : '➤'}
                                </button>
                            </form>
                        </>
                    ) : (
                        <div className="dm-no-chat">
                            <div style={{ fontSize: '5rem', marginBottom: '1.5rem', filter: 'drop-shadow(0 0 20px rgba(255,105,0,0.3))' }}>💬</div>
                            <h2>YedaTech Mensajes</h2>
                            <p>Selecciona una conversación para comenzar a chatear</p>
                            <div className="dm-features">
                                <div className="dm-feature">📝 Mensajes de texto</div>
                                <div className="dm-feature">🖼️ Imágenes</div>
                                <div className="dm-feature">📄 Archivos PDF</div>
                                <div className="dm-feature">✓✓ Confirmación de lectura</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
