import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { routerAgent } from '@/lib/agents/router';
import { socraticTutorAgent } from '@/lib/agents/socratic-tutor';
import { evaluatorAgent } from '@/lib/agents/evaluator';
import { adaptiveAgent, getNextQuestion } from '@/lib/agents/adaptive';
import { telemetryAgent, createSession, endSession } from '@/lib/agents/telemetry';
import { memoryAgent, getStudentProfile } from '@/lib/agents/memory-agent';
import { imageAnalyzerAgent } from '@/lib/agents/image-analyzer';
import prisma from '@/lib/db';

export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const userId = session.user.id;
        const {
            message, sessionId, questionId, timeSpent,
            imageBase64, imageMimeType,
            // Plan de estudio (opcionales — no rompen práctica libre)
            studyPlanWeek, studyPlanDiagnosticId,
        } = await request.json();

        if (!message && !imageBase64) {
            return NextResponse.json({ error: 'Mensaje o imagen requerido' }, { status: 400 });
        }

        // Obtener o crear sesión
        let chatSession;
        if (sessionId) {
            chatSession = await prisma.session.findUnique({
                where: { id: sessionId },
                include: { interactions: { orderBy: { createdAt: 'asc' } } },
            });
        }

        if (!chatSession) {
            chatSession = await createSession(userId, 'practice');
        }

        // Obtener datos del usuario
        const user = await prisma.user.findUnique({ where: { id: userId } });

        // Obtener dominio por temas
        const topicMasteries = await prisma.topicMastery.findMany({
            where: { userId },
        });

        // Obtener perfil cognitivo del estudiante (Capa 1 + 2)
        const studentProfile = await getStudentProfile(userId);

        // Obtener pregunta actual si existe
        let currentQuestion = null;
        if (questionId) {
            currentQuestion = await prisma.question.findUnique({
                where: { id: questionId },
                include: { topic: true },
            });
        }

        // 0. Analizar imagen si se adjuntó una
        let imageAnalysis = null;
        let enrichedMessage = message || '';

        if (imageBase64) {
            try {
                // Pasar contexto del ejercicio actual al analyzer/evaluator
                const imageContext = {
                    currentQuestion: currentQuestion?.content || null,
                    correctAnswer: currentQuestion?.correctAnswer || null,
                    topic: currentQuestion?.topic?.name || user.currentTopic || null,
                    studentLevel: user.currentLevel,
                };

                imageAnalysis = await imageAnalyzerAgent(
                    imageBase64,
                    imageMimeType || 'image/jpeg',
                    imageContext
                );
                
                // Enriquecer el mensaje con el contenido extraído de la imagen
                if (imageAnalysis && imageAnalysis.tipo !== 'error') {
                    let imgContextMsg;

                    if (imageAnalysis.es_ejercicio_resuelto && imageAnalysis.evaluacion) {
                        // Ejercicio resuelto con evaluación detallada
                        const eval_ = imageAnalysis.evaluacion;
                        const erroresStr = eval_.pasos_analizados
                            ?.filter(p => !p.correcto)
                            .map(p => `- Paso ${p.numero}: ${p.error} (${p.tipo_error})`)
                            .join('\n') || 'Ninguno';

                        imgContextMsg = `[IMAGEN - EJERCICIO RESUELTO POR EL ESTUDIANTE]
Ejercicio: ${imageAnalysis.ejercicio_formateado || imageAnalysis.contenido_extraido}
Resultado: ${eval_.es_correcto ? 'CORRECTO ✓' : 'INCORRECTO ✗'}
Respuesta del estudiante: ${eval_.respuesta_estudiante || 'No identificada'}
Respuesta correcta: ${eval_.respuesta_correcta || 'No determinada'}
Errores encontrados:
${erroresStr}
Veredicto: ${eval_.veredicto}

INSTRUCCIÓN PARA EL TUTOR: Usa esta evaluación para guiar al estudiante de manera socrática. Si cometió errores, hazle preguntas que lo lleven a descubrirlos. Si acertó, felicítalo y refuerza los conceptos.`;
                    } else if (imageAnalysis.es_ejercicio && imageAnalysis.ejercicio_formateado) {
                        imgContextMsg = `[IMAGEN ADJUNTA - Ejercicio detectado]: ${imageAnalysis.ejercicio_formateado}`;
                    } else {
                        imgContextMsg = `[IMAGEN ADJUNTA - ${imageAnalysis.tipo}]: ${imageAnalysis.contenido_extraido}`;
                    }
                    
                    enrichedMessage = enrichedMessage
                        ? `${enrichedMessage}\n\n${imgContextMsg}`
                        : imgContextMsg;
                }
            } catch (imgError) {
                console.error('Error analyzing image:', imgError);
                // Continuar sin análisis de imagen
            }
        }

        // 1. Router Agent — clasificar intención
        const routerResult = await routerAgent(enrichedMessage || message, {
            level: user.currentLevel,
            topic: user.currentTopic,
            hasActiveQuestion: !!currentQuestion,
        });

        // 2. Evaluar si hay una pregunta activa y la intención es responderla
        let evaluationResult = null;
        if (currentQuestion && routerResult.requiere_evaluacion) {
            evaluationResult = await evaluatorAgent(
                message,
                currentQuestion.correctAnswer,
                currentQuestion.content
            );
        }

        // 3. Construir historial de conversación
        const conversationHistory = (chatSession.interactions || []).map(i => ([
            { role: 'student', content: i.studentMessage },
            { role: 'tutor', content: i.tutorResponse },
        ])).flat();

        // Contar intentos en la pregunta actual
        const attemptNumber = currentQuestion
            ? (chatSession.interactions || []).filter(i => i.questionId === questionId).length + 1
            : 1;

        // 4. Tutor Socrático — generar respuesta (con memoria del estudiante)
        const topicMasteryInfo = topicMasteries.length > 0
            ? topicMasteries.map(tm => `${tm.topicName}: ${Math.round(tm.masteryLevel * 100)}% dominio`).join(', ')
            : null;

        // Contexto adicional del plan de estudio (sólo si el estudiante está en modo plan)
        let studyPlanContext = null;
        if (studyPlanWeek && studyPlanDiagnosticId) {
            try {
                const spData = await prisma.studyPlanProgress.findFirst({
                    where: { userId, diagnosticId: studyPlanDiagnosticId, weekNumber: studyPlanWeek },
                });
                if (spData?.topicsData) {
                    const topics = JSON.parse(spData.topicsData);
                    studyPlanContext = `\n\n[PLAN DE ESTUDIO - SEMANA ${studyPlanWeek}]\nEl estudiante esta trabajando en la Semana ${studyPlanWeek} de su plan personalizado.\nTemas de esta semana: ${topics.map(t => t.tema).join(', ')}.\nINSTRUCCION: Acompana al estudiante sobre estos temas sin crear preguntas nuevas ni ejercicios nuevos. Usa solo explicaciones, pistas y retroalimentacion sobre el material o la respuesta que el estudiante ya aporte.`;
                }
            } catch (e) {
                console.error('[CHAT] Error leyendo studyPlanProgress:', e);
            }
        }

        const tutorResponse = await socraticTutorAgent({
            studentMessage: enrichedMessage || message,
            studentLevel: user.currentLevel,
            currentTopic: currentQuestion?.topic?.name || user.currentTopic || 'Matemáticas General',
            currentQuestion: currentQuestion?.content || null,
            correctAnswer: currentQuestion?.correctAnswer || null,
            conversationHistory,
            attemptNumber,
            studentProfile,
            lastSessionSummary: studentProfile?.lastSessionSummary || null,
            topicMasteryInfo,
            evaluationResult,
            studyPlanContext, // nuevo — null en práctica libre
        });

        // 5. Telemetría — registrar interacción
        await telemetryAgent({
            sessionId: chatSession.id,
            questionId: currentQuestion?.id || null,
            studentMessage: message,
            tutorResponse,
            isCorrect: evaluationResult?.correcto ?? null,
            timeSpentSeconds: timeSpent || null,
            attemptNumber,
            errorType: evaluationResult?.tipo_error || null,
            difficultyAtTime: user.currentLevel,
            evaluationResult,
        });

        // 5.5 Memory Agent — actualizar perfil cognitivo (solo si hubo evaluación)
        if (evaluationResult) {
            // Se ejecuta en background — no bloquea la respuesta
            memoryAgent(userId, evaluationResult).catch(err =>
                console.error('Memory agent background error:', err)
            );
        }

        // 6. Adaptativo — ajustar si acertó o falló
        let adaptiveResult = null;
        let nextQuestion = null;

        if (evaluationResult?.correcto) {
            adaptiveResult = await adaptiveAgent(userId);
            nextQuestion = await getNextQuestion(userId);

            // Registrar ejercicio correcto en el plan de estudio (si está activo)
            if (studyPlanWeek && studyPlanDiagnosticId) {
                try {
                    const spRecord = await prisma.studyPlanProgress.findFirst({
                        where: { userId, diagnosticId: studyPlanDiagnosticId, weekNumber: studyPlanWeek },
                    });
                    if (spRecord && spRecord.isUnlocked && !spRecord.isCompleted) {
                        const newDone = spRecord.exercisesDone + 1;
                        const nowCompleted = newDone >= spRecord.exercisesGoal;
                        await prisma.studyPlanProgress.update({
                            where: { id: spRecord.id },
                            data: {
                                exercisesDone: newDone,
                                isCompleted: nowCompleted,
                                startedAt: spRecord.startedAt || new Date(),
                                completedAt: nowCompleted ? new Date() : null,
                            },
                        });
                        if (nowCompleted && studyPlanWeek < 8) {
                            const nextWeekRecord = await prisma.studyPlanProgress.findFirst({
                                where: { userId, diagnosticId: studyPlanDiagnosticId, weekNumber: studyPlanWeek + 1 },
                            });
                            if (nextWeekRecord && !nextWeekRecord.isUnlocked) {
                                await prisma.studyPlanProgress.update({
                                    where: { id: nextWeekRecord.id },
                                    data: { isUnlocked: true },
                                });
                            }
                        }
                        adaptiveResult = { ...adaptiveResult, studyPlanExerciseDone: true, weekCompleted: nowCompleted, exercisesDone: newDone, exercisesGoal: spRecord.exercisesGoal };
                    }
                } catch (e) {
                    console.error('[CHAT] Error actualizando studyPlanProgress:', e);
                }
            }
        } else if (evaluationResult && !evaluationResult.correcto && attemptNumber >= 8) {
            adaptiveResult = await adaptiveAgent(userId);
            nextQuestion = await getNextQuestion(userId);
        }

        return NextResponse.json({
            response: tutorResponse,
            sessionId: chatSession.id,
            evaluation: evaluationResult,
            adaptive: adaptiveResult,
            nextQuestion: nextQuestion ? {
                id: nextQuestion.id,
                content: nextQuestion.content,
                topic: nextQuestion.topic?.name,
                difficulty: nextQuestion.difficultyLevel,
            } : null,
            attemptNumber,
            imageAnalysis: imageAnalysis || null,
        });
    } catch (error) {
        console.error('Error en chat:', error);
        return NextResponse.json(
            { error: 'Error procesando mensaje: ' + error.message },
            { status: 500 }
        );
    }
}
