// Agente de Memoria — Actualiza el perfil cognitivo del estudiante
// Se ejecuta después de cada interacción evaluada (sin IA, pura lógica de datos)
import prisma from '../db';

/**
 * Actualiza el StudentProfile del estudiante basándose en sus interacciones recientes.
 * No consume tokens de IA — opera con lógica pura sobre los datos existentes.
 */
export async function memoryAgent(userId, evaluationResult = null) {
    try {
        // Obtener o crear perfil
        let profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) {
            profile = await prisma.studentProfile.create({
                data: { userId },
            });
        }

        // Obtener las últimas 20 interacciones evaluadas del estudiante
        const recentInteractions = await prisma.interaction.findMany({
            where: {
                session: { userId },
                isCorrect: { not: null },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
            include: {
                question: {
                    include: { topic: true },
                },
            },
        });

        if (recentInteractions.length === 0) return profile;

        // ═══════════════════════════════════════════
        // 1. TEMAS DÉBILES Y FUERTES
        // ═══════════════════════════════════════════
        const topicStats = {};
        for (const inter of recentInteractions) {
            const topicName = inter.question?.topic?.name || 'General';
            if (!topicStats[topicName]) {
                topicStats[topicName] = { correct: 0, total: 0 };
            }
            topicStats[topicName].total++;
            if (inter.isCorrect) topicStats[topicName].correct++;
        }

        const weakTopics = [];
        const strongTopics = [];
        for (const [topic, stats] of Object.entries(topicStats)) {
            const accuracy = stats.correct / stats.total;
            if (accuracy < 0.5 && stats.total >= 2) {
                weakTopics.push(topic);
            } else if (accuracy >= 0.8 && stats.total >= 2) {
                strongTopics.push(topic);
            }
        }

        // ═══════════════════════════════════════════
        // 2. PATRONES DE ERROR COMUNES
        // ═══════════════════════════════════════════
        const errorCounts = { conceptual: 0, procedural: 0, aritmetico: 0, interpretacion: 0 };
        let totalErrors = 0;

        for (const inter of recentInteractions) {
            if (!inter.isCorrect && inter.errorType) {
                const type = inter.errorType.toLowerCase();
                if (errorCounts.hasOwnProperty(type)) {
                    errorCounts[type]++;
                    totalErrors++;
                }
            }
        }

        const errorPatterns = {};
        if (totalErrors > 0) {
            for (const [type, count] of Object.entries(errorCounts)) {
                errorPatterns[type] = Math.round((count / totalErrors) * 100);
            }
        }

        // ═══════════════════════════════════════════
        // 3. VELOCIDAD DE APRENDIZAJE
        // ═══════════════════════════════════════════
        const timesSpent = recentInteractions
            .map(i => i.timeSpentSeconds)
            .filter(Boolean);

        let learningSpeed = 'medium';
        if (timesSpent.length >= 3) {
            const avgTime = timesSpent.reduce((a, b) => a + b, 0) / timesSpent.length;
            if (avgTime < 30) learningSpeed = 'fast';
            else if (avgTime > 120) learningSpeed = 'slow';
        }

        // ═══════════════════════════════════════════
        // 4. ÚLTIMOS ERRORES CONCEPTUALES
        // ═══════════════════════════════════════════
        const misconceptions = [];
        for (const inter of recentInteractions.slice(0, 10)) {
            if (!inter.isCorrect && inter.agentMetadata) {
                try {
                    const meta = JSON.parse(inter.agentMetadata);
                    if (meta.concepto_debil && meta.concepto_debil !== 'none') {
                        misconceptions.push({
                            topic: inter.question?.topic?.name || 'General',
                            misconception: meta.concepto_debil,
                            errorType: inter.errorType || 'unknown',
                        });
                    }
                } catch { /* skip malformed metadata */ }
            }
        }

        // Deduplicar misconceptions
        const uniqueMisconceptions = [];
        const seen = new Set();
        for (const m of misconceptions) {
            const key = `${m.topic}:${m.misconception}`;
            if (!seen.has(key)) {
                seen.add(key);
                uniqueMisconceptions.push(m);
            }
        }

        // ═══════════════════════════════════════════
        // 5. TIEMPO ACUMULADO (FIX: solo tiempo NUEVO)
        // ═══════════════════════════════════════════
        // Solo sumar el tiempo de interacciones POSTERIORES a la última actualización
        // del perfil, evitando la acumulación redundante del bug anterior.
        const lastUpdate = profile.updatedAt || new Date(0);
        const newInteractionTime = recentInteractions
            .filter(i => i.createdAt > lastUpdate && i.timeSpentSeconds > 0)
            .reduce((sum, i) => sum + (i.timeSpentSeconds || 0), 0);
        const additionalMinutes = Math.round(newInteractionTime / 60);

        // ═══════════════════════════════════════════
        // GUARDAR PERFIL ACTUALIZADO
        // ═══════════════════════════════════════════
        const updatedProfile = await prisma.studentProfile.update({
            where: { userId },
            data: {
                weakTopics: JSON.stringify(weakTopics),
                strongTopics: JSON.stringify(strongTopics),
                commonErrorPatterns: JSON.stringify(errorPatterns),
                learningSpeed,
                lastMisconceptions: JSON.stringify(uniqueMisconceptions.slice(0, 5)),
                totalTimeMinutes: { increment: additionalMinutes },
            },
        });

        // ═══════════════════════════════════════════
        // 6. ACTUALIZAR TOPIC MASTERY POR TEMA
        // ═══════════════════════════════════════════
        for (const [topicName, stats] of Object.entries(topicStats)) {
            const mastery = stats.total > 0 ? stats.correct / stats.total : 0;
            const isMastered = mastery >= 0.8 && stats.total >= 5;

            await prisma.topicMastery.upsert({
                where: {
                    userId_topicName: { userId, topicName },
                },
                update: {
                    questionsTotal: stats.total,
                    questionsCorrect: stats.correct,
                    masteryLevel: Math.round(mastery * 100) / 100,
                    isMastered,
                    lastPracticed: new Date(),
                },
                create: {
                    userId,
                    topicName,
                    questionsTotal: stats.total,
                    questionsCorrect: stats.correct,
                    masteryLevel: Math.round(mastery * 100) / 100,
                    isMastered,
                },
            });
        }

        return updatedProfile;

    } catch (error) {
        console.error('Memory Agent error:', error);
        // No lanzar error — la memoria es un complemento, no debe romper el flujo principal
        return null;
    }
}

/**
 * Obtiene el perfil del estudiante (o null si no existe).
 * Se usa al inicio de cada sesión para inyectar contexto.
 */
export async function getStudentProfile(userId) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) return null;

        return {
            weakTopics: safeParseJSON(profile.weakTopics, []),
            strongTopics: safeParseJSON(profile.strongTopics, []),
            commonErrorPatterns: safeParseJSON(profile.commonErrorPatterns, {}),
            learningSpeed: profile.learningSpeed,
            preferredStyle: profile.preferredStyle,
            totalSessionsCompleted: profile.totalSessionsCompleted,
            totalTimeMinutes: profile.totalTimeMinutes,
            lastMisconceptions: safeParseJSON(profile.lastMisconceptions, []),
            lastSessionSummary: profile.lastSessionSummary,
        };
    } catch (error) {
        console.error('Error fetching student profile:', error);
        return null;
    }
}

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try {
        return JSON.parse(str);
    } catch {
        return fallback;
    }
}
