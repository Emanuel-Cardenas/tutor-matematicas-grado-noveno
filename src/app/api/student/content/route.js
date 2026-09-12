// API: Contenidos disponibles para el estudiante
// GET — Lista contenidos listos y con preguntas aprobadas para el grado del estudiante
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: { schoolGrade: true },
        });

        if (!user?.schoolGrade) {
            return NextResponse.json({ contents: [] });
        }

        // Contenidos listos con preguntas aprobadas para el grado del estudiante
        const contents = await prisma.teacherContent.findMany({
            where: {
                schoolGrade: user.schoolGrade,
                status: 'ready',
            },
            select: {
                id: true,
                title: true,
                topic: true,
                description: true,
                schoolGrade: true,
                createdAt: true,
                _count: {
                    select: {
                        questions: { where: { isApproved: true } },
                    },
                },
            },
            orderBy: { createdAt: 'desc' },
        });

        // Solo mostrar contenidos con al menos 1 pregunta aprobada
        const available = contents.filter(c => c._count.questions > 0);

        // Obtener resultados previos del estudiante
        const myResults = await prisma.contentDiagnosticResult.findMany({
            where: { userId: session.user.id },
            select: {
                contentId: true,
                attemptNumber: true,
                score: true,
                totalQuestions: true,
                percentage: true,
                completedAt: true,
            },
            orderBy: { completedAt: 'desc' },
        });

        // Enriquecer con datos del estudiante
        const enriched = available.map(c => {
            const results = myResults.filter(r => r.contentId === c.id);
            const bestResult = results.reduce((best, r) => (!best || r.percentage > best.percentage) ? r : best, null);
            return {
                ...c,
                totalQuestions: c._count.questions,
                attempts: results.length,
                bestScore: bestResult?.percentage || null,
                lastAttempt: results[0]?.completedAt || null,
            };
        });

        return NextResponse.json({ contents: enriched });
    } catch (error) {
        console.error('[STUDENT-CONTENT] Error:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
