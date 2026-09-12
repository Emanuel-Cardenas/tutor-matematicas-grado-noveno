// ═══════════════════════════════════════════════════════
// GAMIFICATION AGENT — Sistema de XP, Badges y Rachas
// ═══════════════════════════════════════════════════════
// Agente de gamificación que NO consume tokens de IA.
// Opera con pura lógica sobre los datos de interacciones.
//
// Funcionalidades:
// - XP por acción (examen, respuesta correcta, racha)
// - Badges por logros desbloqueados
// - Niveles/Rangos (Bronce → Diamante)
// - Rachas diarias
// ═══════════════════════════════════════════════════════

import prisma from '../db';

// ═══════════════════════════════════════
// CONFIGURACIÓN DE XP
// ═══════════════════════════════════════
const XP_CONFIG = {
    respuestaCorrecta: 10,
    respuestaCorrectaDificil: 20,
    respuestaCorrectaMedia: 15,
    rachaDeN: { 3: 15, 5: 30, 10: 75 }, // N correctas seguidas
    examCompletado: 50,
    examPerfecto: 100,       // 100% en examen
    sesionCompletada: 25,
    primeraSesion: 50,
    interactivaCorrecta: 25, // Pregunta interactiva correcta
    diasConsecutivos: { 2: 10, 5: 30, 7: 75, 14: 150, 30: 500 },
};

// ═══════════════════════════════════════
// SISTEMA DE RANGOS
// ═══════════════════════════════════════
const RANKS = [
    { name: 'Novato',    minXP: 0,     icon: '🌱', color: '#9ca3af' },
    { name: 'Bronce',    minXP: 100,   icon: '🥉', color: '#cd7f32' },
    { name: 'Plata',     minXP: 300,   icon: '🥈', color: '#c0c0c0' },
    { name: 'Oro',       minXP: 600,   icon: '🥇', color: '#ffd700' },
    { name: 'Platino',   minXP: 1200,  icon: '💎', color: '#e5e4e2' },
    { name: 'Diamante',  minXP: 2500,  icon: '💠', color: '#b9f2ff' },
    { name: 'Maestro',   minXP: 5000,  icon: '👑', color: '#ff6900' },
    { name: 'Leyenda',   minXP: 10000, icon: '🏆', color: '#ff4500' },
];

// ═══════════════════════════════════════
// CATÁLOGO DE BADGES
// ═══════════════════════════════════════
const BADGE_CATALOG = {
    // Badges de inicio
    primera_sesion: {
        id: 'primera_sesion',
        name: 'Primer Paso',
        description: 'Completaste tu primera sesión de tutoría',
        icon: '🎯',
        category: 'inicio',
    },
    primer_examen: {
        id: 'primer_examen',
        name: 'Diagnóstico Inicial',
        description: 'Completaste tu primer examen diagnóstico',
        icon: '📋',
        category: 'inicio',
    },

    // Badges de precisión
    racha_3: {
        id: 'racha_3',
        name: 'En Racha',
        description: '3 respuestas correctas seguidas',
        icon: '🔥',
        category: 'racha',
    },
    racha_5: {
        id: 'racha_5',
        name: 'Imparable',
        description: '5 respuestas correctas seguidas',
        icon: '⚡',
        category: 'racha',
    },
    racha_10: {
        id: 'racha_10',
        name: 'Máquina',
        description: '10 respuestas correctas seguidas',
        icon: '🚀',
        category: 'racha',
    },
    examen_perfecto: {
        id: 'examen_perfecto',
        name: 'Perfección',
        description: 'Obtuviste 100% en un examen diagnóstico',
        icon: '💯',
        category: 'examen',
    },

    // Badges de constancia
    dias_2: {
        id: 'dias_2',
        name: 'Consistente',
        description: '2 días seguidos de estudio',
        icon: '📅',
        category: 'constancia',
    },
    dias_5: {
        id: 'dias_5',
        name: 'Disciplinado',
        description: '5 días seguidos de estudio',
        icon: '🗓️',
        category: 'constancia',
    },
    dias_7: {
        id: 'dias_7',
        name: 'Semana Perfecta',
        description: '7 días seguidos de estudio',
        icon: '⭐',
        category: 'constancia',
    },
    dias_30: {
        id: 'dias_30',
        name: 'Mes Imparable',
        description: '30 días seguidos de estudio',
        icon: '🏅',
        category: 'constancia',
    },

    // Badges por cantidad
    preguntas_50: {
        id: 'preguntas_50',
        name: 'Medio Centenar',
        description: 'Respondiste 50 preguntas correctamente',
        icon: '📝',
        category: 'cantidad',
    },
    preguntas_100: {
        id: 'preguntas_100',
        name: 'Centenario',
        description: 'Respondiste 100 preguntas correctamente',
        icon: '💪',
        category: 'cantidad',
    },
    preguntas_500: {
        id: 'preguntas_500',
        name: 'Experto',
        description: 'Respondiste 500 preguntas correctamente',
        icon: '🧠',
        category: 'cantidad',
    },

    // Badges por pensamiento MEN
    dominio_numerico: {
        id: 'dominio_numerico',
        name: 'Maestro Numérico',
        description: 'Dominaste un tema de Pensamiento Numérico',
        icon: '🔢',
        category: 'men',
    },
    dominio_variacional: {
        id: 'dominio_variacional',
        name: 'Maestro Variacional',
        description: 'Dominaste un tema de Pensamiento Variacional',
        icon: '📈',
        category: 'men',
    },
    dominio_espacial: {
        id: 'dominio_espacial',
        name: 'Maestro Espacial',
        description: 'Dominaste un tema de Pensamiento Espacial/Métrico',
        icon: '📐',
        category: 'men',
    },
    dominio_aleatorio: {
        id: 'dominio_aleatorio',
        name: 'Maestro Aleatorio',
        description: 'Dominaste un tema de Pensamiento Aleatorio',
        icon: '🎲',
        category: 'men',
    },

    // Badge especial
    explorador_interactivo: {
        id: 'explorador_interactivo',
        name: 'Explorador Visual',
        description: 'Interactuaste con una pregunta que tiene gráfica interactiva',
        icon: '🎛️',
        category: 'especial',
    },
    nivel_subido: {
        id: 'nivel_subido',
        name: 'Nivel Arriba',
        description: 'Tu nivel de dificultad subió por tu buen rendimiento',
        icon: '⬆️',
        category: 'progreso',
    },
};

// ═══════════════════════════════════════
// FUNCIONES PRINCIPALES
// ═══════════════════════════════════════

/**
 * Obtiene el perfil de gamificación del usuario.
 * Crea uno si no existe.
 * 
 * @param {string} userId
 * @returns {object} — perfil de gamificación completo
 */
export async function getGamificationProfile(userId) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) return createDefaultGamification();

        const gamData = safeParseJSON(profile.gamificationData, null);
        if (!gamData) return createDefaultGamification();

        // Calcular rango actual
        const rank = getRank(gamData.totalXP || 0);
        const nextRank = getNextRank(gamData.totalXP || 0);

        return {
            ...gamData,
            rank,
            nextRank,
            badgeDetails: (gamData.badges || []).map(id => BADGE_CATALOG[id]).filter(Boolean),
        };
    } catch (error) {
        console.error('[GAMIFICATION] Error getting profile:', error);
        return createDefaultGamification();
    }
}

/**
 * Procesa un evento de gamificación y otorga XP/badges.
 * Se llama DESPUÉS de cada interacción evaluada.
 *
 * @param {string} userId
 * @param {string} eventType — tipo de evento
 * @param {object} eventData — datos del evento
 * @returns {{ xpGained, newBadges, levelUp, newRank }}
 */
export async function processGamificationEvent(userId, eventType, eventData = {}) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });
        if (!profile) return { xpGained: 0, newBadges: [], levelUp: false };

        let gamData = safeParseJSON(profile.gamificationData, createDefaultGamification());
        let xpGained = 0;
        const newBadges = [];

        // ═══════════════════════════════════════
        // PROCESAR EVENTO
        // ═══════════════════════════════════════
        switch (eventType) {
            case 'respuesta_correcta': {
                const difficulty = eventData.difficulty || 'media';
                if (difficulty === 'dificil') xpGained = XP_CONFIG.respuestaCorrectaDificil;
                else if (difficulty === 'media') xpGained = XP_CONFIG.respuestaCorrectaMedia;
                else xpGained = XP_CONFIG.respuestaCorrecta;

                gamData.totalCorrect = (gamData.totalCorrect || 0) + 1;
                gamData.currentStreak = (gamData.currentStreak || 0) + 1;
                gamData.bestStreak = Math.max(gamData.bestStreak || 0, gamData.currentStreak);

                // Verificar badges de racha
                if (gamData.currentStreak >= 3 && !gamData.badges.includes('racha_3')) {
                    newBadges.push('racha_3');
                    xpGained += XP_CONFIG.rachaDeN[3];
                }
                if (gamData.currentStreak >= 5 && !gamData.badges.includes('racha_5')) {
                    newBadges.push('racha_5');
                    xpGained += XP_CONFIG.rachaDeN[5];
                }
                if (gamData.currentStreak >= 10 && !gamData.badges.includes('racha_10')) {
                    newBadges.push('racha_10');
                    xpGained += XP_CONFIG.rachaDeN[10];
                }

                // Verificar badges de cantidad
                if (gamData.totalCorrect >= 50 && !gamData.badges.includes('preguntas_50')) {
                    newBadges.push('preguntas_50');
                }
                if (gamData.totalCorrect >= 100 && !gamData.badges.includes('preguntas_100')) {
                    newBadges.push('preguntas_100');
                }
                if (gamData.totalCorrect >= 500 && !gamData.badges.includes('preguntas_500')) {
                    newBadges.push('preguntas_500');
                }

                // Badge interactiva
                if (eventData.isInteractive && !gamData.badges.includes('explorador_interactivo')) {
                    newBadges.push('explorador_interactivo');
                }
                break;
            }

            case 'respuesta_incorrecta': {
                gamData.currentStreak = 0; // Reset racha
                break;
            }

            case 'examen_completado': {
                xpGained = XP_CONFIG.examCompletado;
                gamData.totalExams = (gamData.totalExams || 0) + 1;

                if (!gamData.badges.includes('primer_examen')) {
                    newBadges.push('primer_examen');
                    xpGained += 25;
                }

                // Examen perfecto
                if (eventData.score === eventData.total && eventData.total > 0) {
                    if (!gamData.badges.includes('examen_perfecto')) {
                        newBadges.push('examen_perfecto');
                        xpGained += XP_CONFIG.examPerfecto;
                    }
                }
                break;
            }

            case 'sesion_completada': {
                xpGained = XP_CONFIG.sesionCompletada;
                gamData.totalSessions = (gamData.totalSessions || 0) + 1;

                if (gamData.totalSessions === 1 && !gamData.badges.includes('primera_sesion')) {
                    newBadges.push('primera_sesion');
                    xpGained += XP_CONFIG.primeraSesion;
                }
                break;
            }

            case 'nivel_subido': {
                if (!gamData.badges.includes('nivel_subido')) {
                    newBadges.push('nivel_subido');
                    xpGained += 30;
                }
                break;
            }

            case 'dia_activo': {
                const today = new Date().toISOString().split('T')[0];
                const lastDay = gamData.lastActiveDay || '';

                if (today !== lastDay) {
                    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
                    if (lastDay === yesterday) {
                        gamData.dailyStreak = (gamData.dailyStreak || 0) + 1;
                    } else if (lastDay !== today) {
                        gamData.dailyStreak = 1;
                    }
                    gamData.lastActiveDay = today;

                    // Verificar badges de constancia
                    for (const [days, xp] of Object.entries(XP_CONFIG.diasConsecutivos)) {
                        const badgeId = `dias_${days}`;
                        if (gamData.dailyStreak >= parseInt(days) && !gamData.badges.includes(badgeId)) {
                            newBadges.push(badgeId);
                            xpGained += xp;
                        }
                    }
                }
                break;
            }

            case 'dominio_tema': {
                const pensamiento = eventData.pensamiento || '';
                const badgeMap = {
                    'Numérico': 'dominio_numerico',
                    'Variacional': 'dominio_variacional',
                    'Espacial': 'dominio_espacial',
                    'Métrico': 'dominio_espacial',
                    'Aleatorio': 'dominio_aleatorio',
                };
                for (const [key, badgeId] of Object.entries(badgeMap)) {
                    if (pensamiento.includes(key) && !gamData.badges.includes(badgeId)) {
                        newBadges.push(badgeId);
                        xpGained += 50;
                    }
                }
                break;
            }
        }

        // ═══════════════════════════════════════
        // ACTUALIZAR XP Y BADGES
        // ═══════════════════════════════════════
        const oldXP = gamData.totalXP || 0;
        gamData.totalXP = oldXP + xpGained;
        gamData.badges = [...new Set([...(gamData.badges || []), ...newBadges])];

        // Detectar level up
        const oldRank = getRank(oldXP);
        const newRank = getRank(gamData.totalXP);
        const levelUp = newRank.name !== oldRank.name;

        // Historial de XP (últimas 20 ganadas)
        if (xpGained > 0) {
            if (!gamData.xpHistory) gamData.xpHistory = [];
            gamData.xpHistory.unshift({
                amount: xpGained,
                event: eventType,
                date: new Date().toISOString(),
            });
            gamData.xpHistory = gamData.xpHistory.slice(0, 20);
        }

        // ═══════════════════════════════════════
        // GUARDAR
        // ═══════════════════════════════════════
        await prisma.studentProfile.update({
            where: { userId },
            data: {
                gamificationData: JSON.stringify(gamData),
            },
        });

        const result = {
            xpGained,
            totalXP: gamData.totalXP,
            newBadges: newBadges.map(id => BADGE_CATALOG[id]).filter(Boolean),
            levelUp,
            newRank: levelUp ? newRank : null,
            currentStreak: gamData.currentStreak || 0,
            dailyStreak: gamData.dailyStreak || 0,
        };

        if (xpGained > 0 || newBadges.length > 0) {
            console.log(`[GAMIFICATION] ${userId}: +${xpGained}XP${newBadges.length > 0 ? ` | Badges: ${newBadges.join(', ')}` : ''}${levelUp ? ` | LEVEL UP → ${newRank.name}` : ''}`);
        }

        return result;

    } catch (error) {
        console.error('[GAMIFICATION] Error processing event:', error);
        return { xpGained: 0, newBadges: [], levelUp: false };
    }
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function getRank(xp) {
    for (let i = RANKS.length - 1; i >= 0; i--) {
        if (xp >= RANKS[i].minXP) return RANKS[i];
    }
    return RANKS[0];
}

function getNextRank(xp) {
    for (const rank of RANKS) {
        if (xp < rank.minXP) {
            return { ...rank, xpNeeded: rank.minXP - xp };
        }
    }
    return null; // Ya es el máximo
}

function createDefaultGamification() {
    return {
        totalXP: 0,
        badges: [],
        totalCorrect: 0,
        totalExams: 0,
        totalSessions: 0,
        currentStreak: 0,
        bestStreak: 0,
        dailyStreak: 0,
        lastActiveDay: null,
        xpHistory: [],
        rank: RANKS[0],
        nextRank: RANKS[1],
        badgeDetails: [],
    };
}

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); }
    catch { return fallback; }
}

/** Exportar catálogos para uso en frontend */
export { BADGE_CATALOG, RANKS, XP_CONFIG };
