import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAdminAuth(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;
    return Boolean(ADMIN_PASSWORD) && authHeader.replace('Bearer ', '') === ADMIN_PASSWORD;
}

export async function GET(request, { params }) {
    if (!checkAdminAuth(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { id } = await params;

        const student = await prisma.user.findUnique({
            where: { id },
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
                    orderBy: { completedAt: 'desc' },
                    include: {
                        answers: {
                            orderBy: { questionIndex: 'asc' },
                        },
                    },
                },
                sessions: {
                    orderBy: { startedAt: 'desc' },
                    include: {
                        interactions: {
                            orderBy: { createdAt: 'asc' },
                            include: {
                                question: {
                                    select: {
                                        content: true,
                                        correctAnswer: true,
                                        difficultyLevel: true,
                                        topic: { select: { name: true } },
                                    },
                                },
                            },
                        },
                        metrics: true,
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

        if (!student) {
            return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
        }

        // Calcular metricas desde Sessions + Interactions
        const allInteractions = student.sessions.flatMap(s => s.interactions);
        const correctCount = allInteractions.filter(i => i.isCorrect === true).length;
        const incorrectCount = allInteractions.filter(i => i.isCorrect === false).length;
        const totalEvaluated = correctCount + incorrectCount;

        // Datos del diagnostico mas reciente
        const latestDiag = student.diagnosticResults.length > 0 ? student.diagnosticResults[0] : null;
        let diagnosticData = null;
        let aiAnalysis = null;
        let aiDiagnosis = null;
        let aiRecommendations = null;

        if (latestDiag) {
            diagnosticData = {
                score: latestDiag.score,
                total: latestDiag.totalQuestions,
                accuracy: latestDiag.totalQuestions > 0 ? Math.round((latestDiag.score / latestDiag.totalQuestions) * 100) : 0,
                level: latestDiag.assignedLevel,
                schoolGrade: latestDiag.schoolGrade,
                totalTimeMs: latestDiag.totalTimeMs,
                completedAt: latestDiag.completedAt,
                topicScores: safeParseJSON(latestDiag.topicScores),
                answers: latestDiag.answers.map(a => ({
                    ...a,
                    options: safeParseJSON(a.options),
                })),
            };

            aiAnalysis = safeParseJSON(latestDiag.aiAnalysis);
            aiDiagnosis = safeParseJSON(latestDiag.aiDiagnosis);
            aiRecommendations = safeParseJSON(latestDiag.aiRecommendations);
        }

        // Metricas finales (fallback a diagnostico si no hay interacciones)
        const diagCorrect = latestDiag?.score || 0;
        const diagTotal = latestDiag?.totalQuestions || 0;
        const finalCorrectCount = correctCount > 0 ? correctCount : diagCorrect;
        const finalIncorrectCount = incorrectCount > 0 ? incorrectCount : (diagTotal - diagCorrect);
        const finalTotalEvaluated = totalEvaluated > 0 ? totalEvaluated : diagTotal;
        const finalAccuracy = finalTotalEvaluated > 0 ? Math.round((finalCorrectCount / finalTotalEvaluated) * 100) : 0;

        // Tipos de errores
        const errorTypes = {};
        allInteractions.forEach(i => {
            if (i.errorType && i.errorType !== 'none') {
                errorTypes[i.errorType] = (errorTypes[i.errorType] || 0) + 1;
            }
        });

        // Errores por tema (desde answers del diagnostico)
        const errorsByTopic = {};
        if (latestDiag?.answers) {
            latestDiag.answers.forEach(a => {
                if (!a.isCorrect) {
                    errorsByTopic[a.topic] = (errorsByTopic[a.topic] || 0) + 1;
                }
            });
        }

        // Tiempos
        const timesSpent = allInteractions.filter(i => i.timeSpentSeconds).map(i => i.timeSpentSeconds);
        const avgTime = timesSpent.length > 0
            ? Math.round(timesSpent.reduce((a, b) => a + b, 0) / timesSpent.length)
            : 0;

        // Tiempos del diagnostico
        let diagnosticTimingStats = null;
        if (latestDiag?.answers?.length > 0) {
            const answerTimes = latestDiag.answers.filter(a => a.timeSpentMs > 0).map(a => a.timeSpentMs);
            if (answerTimes.length > 0) {
                const avgMs = Math.round(answerTimes.reduce((a, b) => a + b, 0) / answerTimes.length);
                const slowest = latestDiag.answers.reduce((max, a) => a.timeSpentMs > (max?.timeSpentMs || 0) ? a : max, null);
                const fastest = latestDiag.answers.reduce((min, a) => (a.timeSpentMs > 0 && a.timeSpentMs < (min?.timeSpentMs || Infinity)) ? a : min, null);

                diagnosticTimingStats = {
                    avgTimeMs: avgMs,
                    totalTimeMs: latestDiag.totalTimeMs,
                    slowest: slowest ? { index: slowest.questionIndex, topic: slowest.topic, time: slowest.timeSpentMs } : null,
                    fastest: fastest ? { index: fastest.questionIndex, topic: fastest.topic, time: fastest.timeSpentMs } : null,
                    slowQuestions: latestDiag.answers.filter(a => a.timeSpentMs > 60000).length,
                    fastQuestions: latestDiag.answers.filter(a => a.timeSpentMs > 0 && a.timeSpentMs < 5000).length,
                };
            }
        }

        const studentData = {
            ...student,
            name: student.fullName || student.username,
            diagnosticResults: student.diagnosticResults.map(d => ({
                id: d.id,
                score: d.score,
                totalQuestions: d.totalQuestions,
                assignedLevel: d.assignedLevel,
                schoolGrade: d.schoolGrade,
                completedAt: d.completedAt,
            })),
            parent: student.parent || null,
        };

        return NextResponse.json({
            student: studentData,
            analytics: {
                totalInteractions: allInteractions.length || diagTotal,
                correctCount: finalCorrectCount,
                incorrectCount: finalIncorrectCount,
                accuracy: finalAccuracy,
                errorTypes,
                errorsByTopic,
                avgTimePerAnswer: avgTime,
                totalSessions: student.sessions.length || (latestDiag ? 1 : 0),
                diagnosticData,
                aiAnalysis,
                aiDiagnosis,
                aiRecommendations,
                diagnosticTimingStats,
            },
        });
    } catch (error) {
        console.error('Admin detail error:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}

function safeParseJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}
