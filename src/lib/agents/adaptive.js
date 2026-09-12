import prisma from '../db';

export async function adaptiveAgent(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuario no encontrado');

    const recentInteractions = await prisma.interaction.findMany({
        where: {
            session: { userId },
            isCorrect: { not: null },
        },
        orderBy: { createdAt: 'desc' },
        take: 15,
        include: {
            question: { include: { topic: true } },
        },
    });

    if (recentInteractions.length === 0) {
        return {
            action: 'MAINTAIN',
            newLevel: user.currentLevel,
            reinforceTopics: [],
        };
    }

    const correctCount = recentInteractions.filter(interaction => interaction.isCorrect).length;
    const accuracy = correctCount / recentInteractions.length;
    const topicPerformance = {};

    for (const interaction of recentInteractions) {
        const topicName = interaction.question?.topic?.name || 'General';
        if (!topicPerformance[topicName]) {
            topicPerformance[topicName] = { correct: 0, total: 0 };
        }
        topicPerformance[topicName].total++;
        if (interaction.isCorrect) topicPerformance[topicName].correct++;
    }

    let action;
    let newLevel;
    let reinforceTopics = [];

    if (accuracy >= 0.8 && recentInteractions.length >= 5) {
        action = 'INCREASE';
        newLevel = Math.min(10, user.currentLevel + 1);
    } else if (accuracy >= 0.5) {
        action = 'MAINTAIN';
        newLevel = user.currentLevel;
    } else {
        action = 'DECREASE';
        newLevel = Math.max(1, user.currentLevel - 1);

        for (const [topic, stats] of Object.entries(topicPerformance)) {
            if (stats.total >= 2 && (stats.correct / stats.total) < 0.5) {
                reinforceTopics.push(topic);
            }
        }

        const weakConcepts = recentInteractions
            .filter(interaction => !interaction.isCorrect)
            .map(interaction => {
                try {
                    const meta = JSON.parse(interaction.agentMetadata || '{}');
                    return meta.concepto_debil;
                } catch {
                    return null;
                }
            })
            .filter(Boolean);

        reinforceTopics = [...new Set([...reinforceTopics, ...weakConcepts])];
    }

    await prisma.user.update({
        where: { id: userId },
        data: { currentLevel: newLevel },
    });

    return { action, newLevel, reinforceTopics, topicPerformance };
}

export async function getNextQuestion(userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('Usuario no encontrado');

    // Desactivado: el banco legacy `practice` fue retirado. La seleccion de
    // preguntas queda limitada al modulo de Pruebas de Estado con banco JSON.
    return null;
}
