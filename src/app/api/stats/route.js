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

        const sessions = await prisma.session.findMany({
            where: { userId },
        });

        const interactions = await prisma.interaction.findMany({
            where: {
                session: { userId },
                isCorrect: { not: null },
            },
        });

        const totalCorrect = interactions.filter(i => i.isCorrect).length;
        const totalAttempted = interactions.length;
        const accuracy = totalAttempted > 0
            ? Math.round((totalCorrect / totalAttempted) * 100)
            : 0;

        // Obtener perfil cognitivo del estudiante
        const studentProfile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        // Parsear campos JSON del perfil
        const profile = studentProfile ? {
            weakTopics: safeParseJSON(studentProfile.weakTopics, []),
            strongTopics: safeParseJSON(studentProfile.strongTopics, []),
            commonErrorPatterns: safeParseJSON(studentProfile.commonErrorPatterns, {}),
            learningSpeed: studentProfile.learningSpeed,
            totalSessionsCompleted: studentProfile.totalSessionsCompleted,
            totalTimeMinutes: studentProfile.totalTimeMinutes,
            lastSessionSummary: studentProfile.lastSessionSummary,
        } : null;

        return NextResponse.json({
            totalSessions: sessions.length,
            totalCorrect,
            totalAttempted,
            accuracy,
            studentProfile: profile,
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
