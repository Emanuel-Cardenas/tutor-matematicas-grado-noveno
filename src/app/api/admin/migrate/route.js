import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// API temporal para migrar diagnosticos existentes
// Acceder: GET /api/admin/migrate?password=<ADMIN_PASSWORD>
export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const password = searchParams.get('password');

    if (!process.env.ADMIN_PASSWORD || password !== process.env.ADMIN_PASSWORD) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const diagnosticResults = await prisma.diagnosticResult.findMany({
            include: { user: true },
        });

        const log = [];
        log.push(`Encontrados ${diagnosticResults.length} diagnosticos`);

        for (const diag of diagnosticResults) {
            // Verificar si ya existe sesion diagnostic
            const existingSession = await prisma.session.findFirst({
                where: {
                    userId: diag.userId,
                    sessionType: 'diagnostic',
                },
            });

            if (existingSession) {
                log.push(`Skip ${diag.user.username} - ya tiene sesion diagnostic`);
                continue;
            }

            // Crear sesion
            const session = await prisma.session.create({
                data: {
                    userId: diag.userId,
                    sessionType: 'diagnostic',
                    startedAt: diag.completedAt,
                    endedAt: diag.completedAt,
                    questionsAttempted: diag.totalQuestions,
                    questionsCorrect: diag.score,
                    accuracyRate: diag.totalQuestions > 0 ? diag.score / diag.totalQuestions : 0,
                },
            });

            // Parse topic scores
            let topicScores = {};
            try {
                topicScores = JSON.parse(diag.topicScores || '{}');
            } catch {
                topicScores = {};
            }

            let created = 0;
            for (const [topic, data] of Object.entries(topicScores)) {
                for (let i = 0; i < (data.correct || 0); i++) {
                    await prisma.interaction.create({
                        data: {
                            sessionId: session.id,
                            studentMessage: `Respuesta correcta - ${topic}`,
                            tutorResponse: `Correcto. Tema: ${topic}`,
                            isCorrect: true,
                            attemptNumber: 1,
                            difficultyAtTime: diag.assignedLevel,
                        },
                    });
                    created++;
                }

                const wrong = (data.total || 0) - (data.correct || 0);
                for (let i = 0; i < wrong; i++) {
                    await prisma.interaction.create({
                        data: {
                            sessionId: session.id,
                            studentMessage: `Respuesta incorrecta - ${topic}`,
                            tutorResponse: `Incorrecto. Tema: ${topic}`,
                            isCorrect: false,
                            attemptNumber: 1,
                            difficultyAtTime: diag.assignedLevel,
                            errorType: 'diagnostic_error',
                        },
                    });
                    created++;
                }
            }

            log.push(`Migrado ${diag.user.username}: ${created} interactions (Score: ${diag.score}/${diag.totalQuestions})`);
        }

        log.push('Migracion completada!');
        return NextResponse.json({ success: true, log });
    } catch (error) {
        console.error('Migration error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
