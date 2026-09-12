// ═══════════════════════════════════════════════════════
// SPACED REPETITION AGENT — Repaso Programado (SM-2)
// ═══════════════════════════════════════════════════════
// Implementa el algoritmo SuperMemo SM-2 adaptado para
// programar repasos óptimos de temas matemáticos.
//
// No consume tokens de IA — opera con pura lógica.
//
// El algoritmo calcula cuándo un estudiante debe repasar
// cada tema basándose en su historial de aciertos/errores,
// aplicando intervalos crecientes para temas dominados y
// intervalos cortos para temas con dificultad.
// ═══════════════════════════════════════════════════════

import prisma from '../db';

/**
 * Obtiene los temas que el estudiante debe repasar HOY,
 * ordenados por urgencia (los más atrasados primero).
 *
 * @param {string} userId
 * @returns {Promise<object[]>} — lista de temas para repasar
 */
export async function getReviewTopics(userId) {
    try {
        const topicMasteries = await prisma.topicMastery.findMany({
            where: { userId },
        });

        if (topicMasteries.length === 0) return [];

        // Obtener datos de repaso del perfil
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        const spacedData = safeParseJSON(profile?.spacedRepetitionData, {});
        const now = new Date();
        const today = now.toISOString().split('T')[0];

        const reviewItems = [];

        for (const mastery of topicMasteries) {
            const topicName = mastery.topicName;
            const topicSR = spacedData[topicName] || createDefaultSR();

            // Calcular si es hora de repasar
            const nextReviewDate = new Date(topicSR.nextReview || 0);
            const isOverdue = nextReviewDate <= now;
            const daysSinceReview = Math.floor((now - nextReviewDate) / 86400000);

            if (isOverdue) {
                // Calcular urgencia: más atrasado = más urgente
                const urgency = Math.min(100, Math.max(0,
                    // Factor 1: días atrasado (0-50 pts)
                    Math.min(50, daysSinceReview * 5) +
                    // Factor 2: baja maestría (0-30 pts)
                    Math.max(0, (1 - mastery.masteryLevel) * 30) +
                    // Factor 3: muchos errores (0-20 pts)
                    Math.min(20, (mastery.questionsTotal - mastery.questionsCorrect) * 2)
                ));

                reviewItems.push({
                    topicName,
                    urgency: Math.round(urgency),
                    masteryLevel: mastery.masteryLevel,
                    isMastered: mastery.isMastered,
                    daysSinceReview: Math.max(0, daysSinceReview),
                    interval: topicSR.interval,
                    easeFactor: topicSR.easeFactor,
                    repetitions: topicSR.repetitions,
                    nextReview: topicSR.nextReview,
                    lastPracticed: mastery.lastPracticed,
                    totalQuestions: mastery.questionsTotal,
                    totalCorrect: mastery.questionsCorrect,
                });
            }
        }

        // Ordenar por urgencia descendente
        return reviewItems.sort((a, b) => b.urgency - a.urgency);

    } catch (error) {
        console.error('[SPACED-REP] Error getting review topics:', error);
        return [];
    }
}

/**
 * Actualiza los datos de repaso de un tema después de practicarlo.
 * Implementa el algoritmo SM-2.
 *
 * @param {string} userId
 * @param {string} topicName — nombre del tema
 * @param {number} quality — calidad de la respuesta (0-5)
 *   0 = No recordó nada
 *   1 = Respuesta incorrecta, pero reconocía el tema
 *   2 = Respuesta incorrecta, pero la correcta parecía familiar
 *   3 = Respuesta correcta con dificultad significativa
 *   4 = Respuesta correcta con algo de dificultad
 *   5 = Respuesta correcta y fácil
 */
export async function updateSpacedRepetition(userId, topicName, quality) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });
        if (!profile) return;

        const spacedData = safeParseJSON(profile.spacedRepetitionData, {});
        const topicSR = spacedData[topicName] || createDefaultSR();

        // ═══════════════════════════════════════
        // ALGORITMO SM-2 ADAPTADO
        // ═══════════════════════════════════════

        // Limitar quality a 0-5
        const q = Math.max(0, Math.min(5, Math.round(quality)));

        if (q >= 3) {
            // Respuesta satisfactoria
            if (topicSR.repetitions === 0) {
                topicSR.interval = 1; // 1 día
            } else if (topicSR.repetitions === 1) {
                topicSR.interval = 3; // 3 días
            } else {
                topicSR.interval = Math.round(topicSR.interval * topicSR.easeFactor);
            }
            topicSR.repetitions += 1;
        } else {
            // Respuesta insatisfactoria → resetear
            topicSR.repetitions = 0;
            topicSR.interval = 1; // Volver a 1 día
        }

        // Actualizar factor de facilidad (ease factor)
        // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        topicSR.easeFactor = Math.max(1.3,
            topicSR.easeFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
        );

        // Calcular próximo repaso
        const nextReview = new Date();
        nextReview.setDate(nextReview.getDate() + topicSR.interval);
        topicSR.nextReview = nextReview.toISOString();
        topicSR.lastReview = new Date().toISOString();

        // Limitar intervalo máximo a 180 días
        topicSR.interval = Math.min(180, topicSR.interval);

        // Guardar
        spacedData[topicName] = topicSR;

        await prisma.studentProfile.update({
            where: { userId },
            data: {
                spacedRepetitionData: JSON.stringify(spacedData),
            },
        });

        console.log(`[SPACED-REP] ${topicName}: q=${q}, interval=${topicSR.interval}d, EF=${topicSR.easeFactor.toFixed(2)}, next=${topicSR.nextReview.split('T')[0]}`);

    } catch (error) {
        console.error('[SPACED-REP] Error updating:', error);
    }
}

/**
 * Convierte un resultado de accuracy (0.0-1.0) a calidad SM-2 (0-5).
 * Útil para convertir resultados de interacciones del tutor.
 *
 * @param {number} accuracy — porcentaje de acierto (0.0 a 1.0)
 * @param {number} timeSeconds — tiempo que tardó (opcional)
 * @returns {number} — quality 0-5
 */
export function accuracyToQuality(accuracy, timeSeconds = null) {
    if (accuracy >= 0.95) return 5; // Perfecto
    if (accuracy >= 0.8)  return 4; // Correcto con algo de dificultad
    if (accuracy >= 0.6)  return 3; // Correcto con dificultad significativa
    if (accuracy >= 0.4)  return 2; // Incorrecto pero familiar
    if (accuracy >= 0.2)  return 1; // Incorrecto pero reconocía el tema
    return 0;                        // No recordó nada
}

/**
 * Genera un resumen del estado de repaso del estudiante.
 * Útil para el dashboard.
 *
 * @param {string} userId
 * @returns {Promise<object>}
 */
export async function getRepetitionSummary(userId) {
    try {
        const reviewTopics = await getReviewTopics(userId);

        const topicMasteries = await prisma.topicMastery.findMany({
            where: { userId },
        });

        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });
        const spacedData = safeParseJSON(profile?.spacedRepetitionData, {});

        // Contar temas por estado
        let overdue = 0;
        let upcoming = 0;
        let mastered = 0;

        for (const tm of topicMasteries) {
            const sr = spacedData[tm.topicName];
            if (!sr || !sr.nextReview) {
                overdue++;
            } else {
                const nextDate = new Date(sr.nextReview);
                if (nextDate <= new Date()) overdue++;
                else upcoming++;
            }
            if (tm.isMastered) mastered++;
        }

        return {
            totalTopics: topicMasteries.length,
            overdueCount: overdue,
            upcomingCount: upcoming,
            masteredCount: mastered,
            todayReviews: reviewTopics.slice(0, 5), // Los 5 más urgentes
            nextReviewDate: reviewTopics.length > 0
                ? reviewTopics[0].nextReview
                : null,
        };

    } catch (error) {
        console.error('[SPACED-REP] Error getting summary:', error);
        return {
            totalTopics: 0,
            overdueCount: 0,
            upcomingCount: 0,
            masteredCount: 0,
            todayReviews: [],
            nextReviewDate: null,
        };
    }
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function createDefaultSR() {
    return {
        interval: 0,        // Días hasta el próximo repaso
        easeFactor: 2.5,     // Factor de facilidad inicial SM-2
        repetitions: 0,      // Número de repasos exitosos consecutivos
        nextReview: new Date().toISOString(), // Repaso inmediato
        lastReview: null,
    };
}

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); }
    catch { return fallback; }
}
