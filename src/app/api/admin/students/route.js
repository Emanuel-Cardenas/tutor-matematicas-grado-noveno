import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAdminAuth(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;
    return Boolean(ADMIN_PASSWORD) && authHeader.replace('Bearer ', '') === ADMIN_PASSWORD;
}

export async function GET(request) {
    if (!checkAdminAuth(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const students = await prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                currentLevel: true,
                currentTopic: true,
                schoolGrade: true,
                createdAt: true,
                lastLogin: true,
                diagnosticResults: {
                    select: {
                        assignedLevel: true,
                        score: true,
                        completedAt: true,
                    },
                    orderBy: { completedAt: 'desc' },
                    take: 1,
                },
                sessions: {
                    select: {
                        id: true,
                        sessionType: true,
                        startedAt: true,
                        endedAt: true,
                        _count: {
                            select: { interactions: true },
                        },
                    },
                    orderBy: { startedAt: 'desc' },
                },
                studentProfile: {
                    select: {
                        weakTopics: true,
                        strongTopics: true,
                        commonErrorPatterns: true,
                        learningSpeed: true,
                        totalSessionsCompleted: true,
                        totalTimeMinutes: true,
                        lastSessionSummary: true,
                        lastMisconceptions: true,
                        updatedAt: true,
                    },
                },
                parent: {
                    select: {
                        id: true,
                        fullName: true,
                        username: true,
                        email: true,
                        createdAt: true,
                        lastLogin: true,
                    },
                },
            },
        });

        const studentsWithMetrics = students.map(student => {
            const totalSessions = student.sessions.length;
            const totalInteractions = student.sessions.reduce((sum, s) => sum + s._count.interactions, 0);

            return {
                id: student.id,
                username: student.username,
                name: student.fullName || student.username,
                email: student.email,
                currentLevel: student.currentLevel,
                currentTopic: student.currentTopic,
                schoolGrade: student.schoolGrade || null,
                createdAt: student.createdAt,
                lastLogin: student.lastLogin,
                diagnosticCompleted: student.diagnosticResults.length > 0,
                diagnosticLevel: student.diagnosticResults[0]?.assignedLevel || null,
                diagnosticScore: student.diagnosticResults[0]?.score || null,
                totalSessions,
                totalInteractions,
                studentProfile: student.studentProfile || null,
                parent: student.parent || null,
            };
        });

        return NextResponse.json({
            total: studentsWithMetrics.length,
            students: studentsWithMetrics,
        });
    } catch (error) {
        console.error('Admin API error:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}
