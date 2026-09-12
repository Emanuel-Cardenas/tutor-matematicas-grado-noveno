import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
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

        // 1. Historial de diagnósticos (para ver progreso)
        const diagnostics = await prisma.diagnosticResult.findMany({
            where: { userId },
            orderBy: { completedAt: 'asc' },
            include: {
                answers: { orderBy: { questionIndex: 'asc' } },
            },
        });

        // 2. Sesiones de tutoría
        const sessions = await prisma.session.findMany({
            where: { userId },
            orderBy: { startedAt: 'asc' },
            include: {
                metrics: true,
                interactions: {
                    where: { isCorrect: { not: null } },
                    orderBy: { createdAt: 'asc' },
                },
            },
        });

        // 3. Perfil del estudiante
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        // 4. User data
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { currentLevel: true, schoolGrade: true, createdAt: true },
        });

        // ─── Procesar Diagnósticos ───
        const diagnosticHistory = diagnostics.map(d => {
            const topicScores = safeParseJSON(d.topicScores, {});
            return {
                id: d.id,
                date: d.completedAt,
                score: d.score,
                total: d.totalQuestions,
                percentage: Math.round((d.score / d.totalQuestions) * 100),
                assignedLevel: d.assignedLevel,
                schoolGrade: d.schoolGrade,
                totalTimeMs: d.totalTimeMs,
                topicScores,
            };
        });

        // ─── Rendimiento por Tema (de todos los diagnósticos) ───
        const topicPerformance = {};
        for (const d of diagnostics) {
            for (const ans of d.answers) {
                const topic = ans.topic || 'General';
                if (!topicPerformance[topic]) {
                    topicPerformance[topic] = { correct: 0, total: 0, avgTimeMs: 0, totalTimeMs: 0 };
                }
                topicPerformance[topic].total++;
                if (ans.isCorrect) topicPerformance[topic].correct++;
                topicPerformance[topic].totalTimeMs += ans.timeSpentMs || 0;
            }
        }
        // Calcular porcentajes y promedios
        const topicStats = Object.entries(topicPerformance).map(([topic, data]) => ({
            topic,
            correct: data.correct,
            total: data.total,
            percentage: Math.round((data.correct / data.total) * 100),
            avgTimeMs: data.total > 0 ? Math.round(data.totalTimeMs / data.total) : 0,
        })).sort((a, b) => a.percentage - b.percentage);

        // ─── Sesiones de Tutoría ───
        const tutoringSessions = sessions
            .filter(s => s.sessionType === 'practice')
            .map(s => ({
                id: s.id,
                date: s.startedAt,
                endDate: s.endedAt,
                questionsAttempted: s.questionsAttempted,
                questionsCorrect: s.questionsCorrect,
                accuracy: s.accuracyRate ? Math.round(s.accuracyRate * 100) : 0,
                totalInteractions: s.interactions.length,
            }));

        // ─── Actividad por Día (últimos 30 días) ───
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const dailyActivity = {};
        for (const s of sessions) {
            const day = new Date(s.startedAt).toISOString().split('T')[0];
            if (new Date(s.startedAt) >= thirtyDaysAgo) {
                if (!dailyActivity[day]) dailyActivity[day] = { sessions: 0, correct: 0, total: 0 };
                dailyActivity[day].sessions++;
                dailyActivity[day].correct += s.questionsCorrect || 0;
                dailyActivity[day].total += s.questionsAttempted || 0;
            }
        }

        // ─── Totales Generales ───
        const allInteractions = sessions.flatMap(s => s.interactions);
        const totalCorrect = allInteractions.filter(i => i.isCorrect).length;
        const totalAttempted = allInteractions.length;

        // ─── Perfil Cognitivo ───
        const cognitiveProfile = profile ? {
            weakTopics: safeParseJSON(profile.weakTopics, []),
            strongTopics: safeParseJSON(profile.strongTopics, []),
            commonErrors: safeParseJSON(profile.commonErrorPatterns, {}),
            learningSpeed: profile.learningSpeed,
            totalSessions: profile.totalSessionsCompleted,
            totalMinutes: profile.totalTimeMinutes,
            lastSummary: profile.lastSessionSummary,
        } : null;

        return NextResponse.json({
            user: {
                currentLevel: user?.currentLevel || 1,
                schoolGrade: user?.schoolGrade,
                memberSince: user?.createdAt,
            },
            summary: {
                totalDiagnostics: diagnostics.length,
                totalTutoringSessions: tutoringSessions.length,
                totalCorrect,
                totalAttempted,
                overallAccuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
                latestDiagnosticScore: diagnosticHistory.length > 0 ? diagnosticHistory[diagnosticHistory.length - 1].percentage : null,
                firstDiagnosticScore: diagnosticHistory.length > 0 ? diagnosticHistory[0].percentage : null,
            },
            diagnosticHistory,
            topicStats,
            tutoringSessions,
            dailyActivity: Object.entries(dailyActivity).map(([date, data]) => ({ date, ...data })),
            cognitiveProfile,
        });
    } catch (error) {
        console.error('Error fetching analytics:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
