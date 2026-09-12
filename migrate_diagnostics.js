// Script to migrate existing diagnostic results to sessions + interactions
const { PrismaClient } = require('@prisma/client');
const path = require('path');

async function main() {
    const prisma = new PrismaClient();

    try {
        // Find all diagnostic results
        const diagnosticResults = await prisma.diagnosticResult.findMany({
            include: { user: true },
        });

        console.log(`Found ${diagnosticResults.length} diagnostic results to migrate`);

        for (const diag of diagnosticResults) {
            // Check if already migrated
            const existingSession = await prisma.session.findFirst({
                where: {
                    userId: diag.userId,
                    sessionType: 'diagnostic',
                },
            });

            if (existingSession) {
                console.log(`  Skip ${diag.user.username} - already has diagnostic session`);
                continue;
            }

            // Create diagnostic session
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

            // Parse topic scores and create interactions
            let topicScores = {};
            try {
                topicScores = JSON.parse(diag.topicScores || '{}');
            } catch (e) {
                topicScores = {};
            }

            let created = 0;
            for (const [topic, data] of Object.entries(topicScores)) {
                // Create correct interactions
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

                // Create incorrect interactions
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

            console.log(`  Migrated ${diag.user.username}: ${created} interactions created (Score: ${diag.score}/${diag.totalQuestions})`);
        }

        console.log('\nMigration complete!');
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
