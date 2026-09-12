import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

// Verificar token del padre
function getParentData(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return null;
    try {
        const token = authHeader.replace('Bearer ', '');
        const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
        if (!decoded.parentId || !decoded.childId) return null;
        return decoded;
    } catch {
        return null;
    }
}

function safeParseJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

export async function GET(request) {
    const parentData = getParentData(request);
    if (!parentData) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        // Verificar que el padre existe y está vinculado a este hijo
        const parent = await prisma.parent.findUnique({
            where: { id: parentData.parentId },
        });

        if (!parent || parent.childId !== parentData.childId) {
            return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
        }

        // Obtener datos completos del hijo (misma lógica que admin/students/[id])
        const student = await prisma.user.findUnique({
            where: { id: parentData.childId },
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
            },
        });

        if (!student) {
            return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
        }

        // Calcular métricas
        const allInteractions = student.sessions.flatMap(s => s.interactions);
        const correctCount = allInteractions.filter(i => i.isCorrect === true).length;
        const incorrectCount = allInteractions.filter(i => i.isCorrect === false).length;
        const totalEvaluated = correctCount + incorrectCount;

        // Datos del diagnóstico más reciente
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

        // Métricas finales
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

        // Errores por tema
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

        // Tiempos del diagnóstico
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

        // Historial de diagnósticos
        const diagnosticHistory = student.diagnosticResults.map(d => ({
            id: d.id,
            score: d.score,
            totalQuestions: d.totalQuestions,
            assignedLevel: d.assignedLevel,
            schoolGrade: d.schoolGrade,
            completedAt: d.completedAt,
            accuracy: d.totalQuestions > 0 ? Math.round((d.score / d.totalQuestions) * 100) : 0,
        }));

        return NextResponse.json({
            student: {
                id: student.id,
                name: student.fullName || student.username,
                username: student.username,
                currentLevel: student.currentLevel,
                schoolGrade: student.schoolGrade,
                createdAt: student.createdAt,
                lastLogin: student.lastLogin,
                sessions: student.sessions,
            },
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
                diagnosticHistory,
            },
            parentName: parentData.name,
        });
    } catch (error) {
        console.error('Parent child API error:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}
