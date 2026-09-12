'use client';
import { useState, useRef, useCallback } from 'react';

/**
 * ImageUpload — Botón y zona de drop para subir imágenes al chat.
 * 
 * Props:
 *  - onImageSelect: (imageData: { base64: string, preview: string, name: string }) => void
 *  - pendingImage: object | null — imagen pendiente de envío
 *  - onClearImage: () => void — callback para limpiar la imagen pendiente
 *  - disabled: boolean
 */
export default function ImageUpload({ onImageSelect, pendingImage, onClearImage, disabled = false }) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

    const processFile = useCallback((file) => {
        if (!file) return;

        // Validar tipo
        if (!ALLOWED_TYPES.includes(file.type)) {
            setError('Formato no soportado. Usa JPG, PNG, WebP o GIF.');
            setTimeout(() => setError(null), 4000);
            return;
        }

        // Validar tamaño
        if (file.size > MAX_SIZE) {
            setError('La imagen es muy grande. Máximo 5MB.');
            setTimeout(() => setError(null), 4000);
            return;
        }

        setError(null);

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64Full = e.target.result; // data:image/...;base64,...
            const base64Data = base64Full.split(',')[1]; // solo el base64

            onImageSelect({
                base64: base64Data,
                mimeType: file.type,
                preview: base64Full,
                name: file.name,
            });
        };
        reader.onerror = () => {
            setError('Error al leer la imagen. Intenta con otra.');
            setTimeout(() => setError(null), 4000);
        };
        reader.readAsDataURL(file);
    }, [onImageSelect]);

    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
        // Reset input para permitir re-selección del mismo archivo
        e.target.value = '';
    };

    const handleDragOver = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    }, [processFile]);

    return (
        <>
            {/* Botón de adjuntar imagen */}
            <button
                className="img-upload-btn"
                onClick={handleClick}
                disabled={disabled || !!pendingImage}
                title="Subir imagen (ejercicio, problema, captura)"
                type="button"
                id="image-upload-btn"
            >
                📷
            </button>

            {/* Input file oculto */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleFileChange}
                style={{ display: 'none' }}
                id="image-file-input"
            />

            {/* Preview de imagen pendiente */}
            {pendingImage && (
                <div className="img-preview-container">
                    <div className="img-preview-card">
                        <img
                            src={pendingImage.preview}
                            alt={pendingImage.name}
                            className="img-preview-thumb"
                        />
                        <div className="img-preview-info">
                            <span className="img-preview-name">{pendingImage.name}</span>
                            <span className="img-preview-hint">Se enviará con tu mensaje</span>
                        </div>
                        <button
                            className="img-preview-remove"
                            onClick={onClearImage}
                            title="Quitar imagen"
                            type="button"
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            {/* Zona de drop overlay */}
            {isDragging && (
                <div className="img-drop-overlay">
                    <div className="img-drop-content">
                        <span className="img-drop-icon">📸</span>
                        <span>Suelta la imagen aquí</span>
                    </div>
                </div>
            )}

            {/* Error toast */}
            {error && (
                <div className="img-error-toast">
                    <span>⚠️ {error}</span>
                </div>
            )}

            {/* Exportar handlers de drag para el contenedor padre */}
            <DragHandlers
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            />
        </>
    );
}

/**
 * Componente invisible que registra los handlers de drag en el chat container.
 * Se usa como "bridge" — el componente padre debe pasar estos handlers al contenedor.
 */
function DragHandlers({ onDragOver, onDragLeave, onDrop }) {
    // Registrar en el contenedor del chat
    useState(() => {
        if (typeof window === 'undefined') return;

        // Attach to the chat container after mount
        setTimeout(() => {
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.addEventListener('dragover', onDragOver);
                chatContainer.addEventListener('dragleave', onDragLeave);
                chatContainer.addEventListener('drop', onDrop);
            }
        }, 100);

        return () => {
            const chatContainer = document.querySelector('.chat-container');
            if (chatContainer) {
                chatContainer.removeEventListener('dragover', onDragOver);
                chatContainer.removeEventListener('dragleave', onDragLeave);
                chatContainer.removeEventListener('drop', onDrop);
            }
        };
    });

    return null;
}
