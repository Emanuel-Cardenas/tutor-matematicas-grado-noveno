'use client';
import { useEffect, useRef } from 'react';

export default function MathEditor({ 
    value, 
    onChange, 
    onEnter, 
    placeholder = 'Escribe tu respuesta o pregunta...',
    disabled = false,
    className = ''
}) {
    const mfRef = useRef(null);

    useEffect(() => {
        // Importar MathLive solo en el cliente
        import('mathlive').then(() => {
            // Asegurarse de que las fuentes estén cargadas y la UI configurada
        });
    }, []);

    useEffect(() => {
        const mf = mfRef.current;
        if (!mf) return;

        // Sync initial value if it changes externally
        if (mf.value !== value) {
            mf.value = value || '';
        }

        const handleInput = (e) => {
            if (onChange) {
                // Obtener texto (LaTeX por defecto) y formato calculable (ascii-math)
                const latex = e.target.value;
                const ascii = e.target.getValue('ascii-math');
                onChange(latex, ascii);
            }
        };

        const handleCommit = (e) => {
            // El evento 'commit' se dispara cuando presionan Enter en el teclado físico o en el teclado virtual de mathlive
            if (onEnter) onEnter();
            if (window.mathVirtualKeyboard) {
                window.mathVirtualKeyboard.hide();
            }
        };

        mf.addEventListener('input', handleInput);
        mf.addEventListener('change', handleInput); // change atrapa cuando la ecuación completa ha cambiado (a veces útil si paste)
        mf.addEventListener('commit', handleCommit);

        // Configuración de la UI
        mf.mathVirtualKeyboardPolicy = 'manual'; // El usuario lo abre usando el botón (evita tapar la UI automáticamente)

        return () => {
            mf.removeEventListener('input', handleInput);
            mf.removeEventListener('change', handleInput);
            mf.removeEventListener('commit', handleCommit);
        };
    }, [onChange, onEnter, value]);

    return (
        <math-field
            ref={mfRef}
            class={className}
            disabled={disabled ? 'disabled' : undefined}
            style={{ 
                width: '100%', 
                backgroundColor: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: '1rem',
                color: 'inherit',
                minHeight: '40px',
                padding: '8px',
                '--text-color': 'var(--text-primary, #ffffff)',
                '--smart-fence-color': 'var(--text-primary, #ffffff)',
                '--caret-color': 'var(--accent-primary, #ff6900)',
            }}
        >
            {value}
        </math-field>
    );
}
