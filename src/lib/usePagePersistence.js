/**
 * usePagePersistence — Hook universal de persistencia por pestaña
 *
 * Guarda automáticamente cualquier estado en localStorage cuando:
 *  - El usuario cambia de pestaña (visibilitychange → hidden)
 *  - El usuario cierra/recarga la ventana (beforeunload)
 *  - El estado cambia (autoguardado reactivo)
 *
 * Restaura el estado al montar si los datos son recientes (< maxAgeMs).
 *
 * @param {string}   key        Clave única de localStorage
 * @param {any}      state      Objeto/valor de estado a persistir
 * @param {Function} onRestore  Callback llamado con los datos restaurados
 * @param {object}   options
 *   @param {boolean} options.enabled    Activar/desactivar (default: true)
 *   @param {number}  options.maxAgeMs   Máxima edad para restaurar (default: 4h)
 *   @param {boolean} options.autoSave   Guardar en cada cambio de estado (default: true)
 */
import { useEffect, useRef, useCallback } from 'react';

export function usePagePersistence(key, state, onRestore, options = {}) {
    const {
        enabled   = true,
        maxAgeMs  = 4 * 60 * 60 * 1000,   // 4 horas por defecto
        autoSave  = true,
    } = options;

    const restoredRef = useRef(false);
    const stateRef    = useRef(state);

    // Mantener stateRef sincronizado con el estado más reciente
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // ── RESTAURAR al montar ───────────────────────────────────────
    useEffect(() => {
        if (!enabled || !key || !onRestore || restoredRef.current) return;

        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;

            const parsed = JSON.parse(raw);
            const age    = Date.now() - (parsed.__savedAt || 0);

            if (age < maxAgeMs && parsed.__data !== undefined) {
                console.log(`[PERSIST] Restaurando "${key}" (${Math.round(age / 1000)}s de antigüedad)`);
                onRestore(parsed.__data);
                restoredRef.current = true;
            } else if (age >= maxAgeMs) {
                // Datos demasiado viejos → limpiar
                localStorage.removeItem(key);
                console.log(`[PERSIST] "${key}" expirado (${Math.round(age / 1000 / 60)}min), limpiado.`);
            }
        } catch (e) {
            console.error(`[PERSIST] Error restaurando "${key}":`, e);
            localStorage.removeItem(key);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, key]); // Solo al montar

    // ── GUARDAR ──────────────────────────────────────────────────
    const save = useCallback(() => {
        if (!enabled || !key) return;
        try {
            const payload = {
                __savedAt: Date.now(),
                __data:    stateRef.current,
            };
            localStorage.setItem(key, JSON.stringify(payload));
        } catch (e) {
            console.error(`[PERSIST] Error guardando "${key}":`, e);
        }
    }, [enabled, key]);

    // Autoguardado reactivo (cuando el estado cambia)
    useEffect(() => {
        if (!autoSave || !enabled) return;
        save();
    }, [state, save, autoSave, enabled]);

    // ── EVENTOS DE VISIBILIDAD Y CIERRE ──────────────────────────
    useEffect(() => {
        if (!enabled || !key) return;

        const onHide = () => {
            if (document.visibilityState === 'hidden') {
                save();
                console.log(`[PERSIST] Guardado por cambio de pestaña: "${key}"`);
            }
        };

        const onUnload = () => {
            save();
        };

        document.addEventListener('visibilitychange', onHide);
        window.addEventListener('beforeunload', onUnload);
        // pagehide cubre iOS Safari donde beforeunload no siempre dispara
        window.addEventListener('pagehide', onUnload);

        return () => {
            document.removeEventListener('visibilitychange', onHide);
            window.removeEventListener('beforeunload', onUnload);
            window.removeEventListener('pagehide', onUnload);
        };
    }, [enabled, key, save]);

    // ── UTILIDADES públicas ───────────────────────────────────────
    const clear = useCallback(() => {
        if (key) localStorage.removeItem(key);
    }, [key]);

    return { save, clear };
}
