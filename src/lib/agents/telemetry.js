import prisma from '../db';
import { sessionSummaryAgent } from './session-summary';

export async function telemetryAgent({
    sessionId,
    questionId,
    studentMessage,
    tutorResponse,
    isCorrect,
    timeSpentSeconds,
    attemptNumber,
    errorType,
    difficultyAtTime,
    evaluationResult,
}) {
    // Registrar la interacción
    const interaction = await prisma.interaction.create({
        data: {
            sessionId,
            questionId,
            studentMessage,
            tutorResponse,
            isCorrect,
            timeSpentSeconds,
            attemptNumber,
            errorType: errorType || null,
            difficultyAtTime,
            agentMetadata: evaluationResult ? JSON.stringify(evaluationResult) : null,
        },
    });

    // Actualizar métricas de la sesión
    const session = await prisma.session.findUnique({
        where: { id: sessionId },
        include: { interactions: true },
    });

    if (session) {
        const totalAttempted = session.interactions.length;
        const totalCorrect = session.interactions.filter(i => i.isCorrect === true).length;
        const accuracyRate = totalAttempted > 0 ? totalCorrect / totalAttempted : 0;

        await prisma.session.update({
            where: { id: sessionId },
            data: {
                questionsAttempted: totalAttempted,
                questionsCorrect: totalCorrect,
                accuracyRate,
            },
        });

        // Actualizar o crear métricas detalladas
        const interactions = session.interactions;
        const timesSpent = interactions
            .map(i => i.timeSpentSeconds)
            .filter(Boolean);
        const avgTime = timesSpent.length > 0
            ? timesSpent.reduce((a, b) => a + b, 0) / timesSpent.length
            : 0;

        // Calcular rachas
        let streakCorrect = 0;
        let streakIncorrect = 0;
        for (let i = interactions.length - 1; i >= 0; i--) {
            if (interactions[i].isCorrect === true) {
                if (streakIncorrect > 0) break;
                streakCorrect++;
            } else if (interactions[i].isCorrect === false) {
                if (streakCorrect > 0) break;
                streakIncorrect++;
            }
        }

        const difficultyChanges = interactions.reduce((count, inter, idx) => {
            if (idx === 0) return 0;
            return inter.difficultyAtTime !== interactions[idx - 1].difficultyAtTime
                ? count + 1
                : count;
        }, 0);

        await prisma.sessionMetrics.upsert({
            where: { sessionId },
            update: {
                avgTimePerQuestion: avgTime,
                accuracyTrend: accuracyRate,
                streakCorrect,
                streakIncorrect,
                difficultyChanges,
            },
            create: {
                sessionId,
                avgTimePerQuestion: avgTime,
                accuracyTrend: accuracyRate,
                streakCorrect,
                streakIncorrect,
                difficultyChanges,
            },
        });
    }

    return interaction;
}

export async function createSession(userId, sessionType = 'practice') {
    return prisma.session.create({
        data: { userId, sessionType },
    });
}

export async function endSession(sessionId, userId = null) {
    const session = await prisma.session.update({
        where: { id: sessionId },
        data: { endedAt: new Date() },
    });

    // Generar resumen de sesión con IA (Capa 2) — en background
    if (userId && session) {
        sessionSummaryAgent(sessionId, userId).catch(err =>
            console.error('Session summary background error:', err)
        );
    }

    return session;
}
