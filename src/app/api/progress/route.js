import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/db';

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); } catch { return fallback; }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const userId = session.user.id;

        // 1. Datos del usuario
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // 2. Sesión activa (sin endedAt, con interacciones)
        const activeSession = await prisma.session.findFirst({
            where: { userId, endedAt: null, sessionType: 'practice' },
            orderBy: { startedAt: 'desc' },
            include: {
                interactions: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        question: { include: { topic: true } },
                    },
                },
            },
        });

        // 3. Dominio por temas
        const topicMasteries = await prisma.topicMastery.findMany({
            where: { userId },
            orderBy: { lastPracticed: 'desc' },
        });

        // 4. Perfil del estudiante
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        // 5. Estadísticas globales
        const totalInteractions = await prisma.interaction.count({
            where: { session: { userId }, isCorrect: { not: null } },
        });
        const correctInteractions = await prisma.interaction.count({
            where: { session: { userId }, isCorrect: true },
        });

        // 6. Construir mensajes de la sesión activa (para restaurar chat)
        let sessionMessages = [];
        if (activeSession && activeSession.interactions.length > 0) {
            for (const inter of activeSession.interactions) {
                sessionMessages.push({
                    role: 'student',
                    content: inter.studentMessage,
                    time: new Date(inter.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
                sessionMessages.push({
                    role: 'tutor',
                    content: inter.tutorResponse,
                    evaluation: inter.agentMetadata ? safeParseJSON(inter.agentMetadata, null) : null,
                    time: new Date(inter.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                });
            }
        }

        // 7. Última pregunta activa en la sesión
        let lastQuestion = null;
        if (activeSession && activeSession.interactions.length > 0) {
            const lastInteraction = activeSession.interactions[activeSession.interactions.length - 1];
            if (lastInteraction.question) {
                lastQuestion = {
                    id: lastInteraction.question.id,
                    content: lastInteraction.question.content,
                    topic: lastInteraction.question.topic?.name,
                    difficulty: lastInteraction.question.difficultyLevel,
                };
            }
        }

        return NextResponse.json({
            user: {
                currentLevel: user?.currentLevel || 1,
                currentTopic: user?.currentTopic,
                schoolGrade: user?.schoolGrade,
            },
            activeSession: activeSession ? {
                id: activeSession.id,
                startedAt: activeSession.startedAt,
                questionsAttempted: activeSession.questionsAttempted,
                questionsCorrect: activeSession.questionsCorrect,
                messages: sessionMessages,
                lastQuestion,
            } : null,
            topicMasteries: topicMasteries.map(tm => ({
                topicName: tm.topicName,
                questionsTotal: tm.questionsTotal,
                questionsCorrect: tm.questionsCorrect,
                masteryLevel: tm.masteryLevel,
                isMastered: tm.isMastered,
                lastPracticed: tm.lastPracticed,
            })),
            profile: studentProfile ? {
                weakTopics: safeParseJSON(studentProfile.weakTopics, []),
                strongTopics: safeParseJSON(studentProfile.strongTopics, []),
                learningSpeed: studentProfile.learningSpeed,
                lastSessionSummary: studentProfile.lastSessionSummary,
                totalSessionsCompleted: studentProfile.totalSessionsCompleted,
            } : null,
            stats: {
                totalQuestions: totalInteractions,
                totalCorrect: correctInteractions,
                accuracy: totalInteractions > 0
                    ? Math.round((correctInteractions / totalInteractions) * 100)
                    : 0,
            },
        });
    } catch (error) {
        console.error('Error en progress API:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
