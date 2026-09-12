import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { answerAnalyzerAgent } from '@/lib/agents/answer-analyzer';
import { academicDiagnosticAgent } from '@/lib/agents/academic-diagnostic';
import { learningRecommendationsAgent } from '@/lib/agents/learning-recommendations';
import {
    DIAGNOSTIC_QUESTION_COUNT,
    getDiagnosticQuestionBankSummary,
    loadDiagnosticQuestionBank,
    selectDiagnosticQuestions,
} from '@/lib/diagnostic-question-bank';

// GET — verificar estado del diagnostico
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const existing = await prisma.diagnosticResult.findFirst({
            where: { userId: session.user.id },
            orderBy: { completedAt: 'desc' },
            include: {
                answers: { orderBy: { questionIndex: 'asc' } },
            },
        });

        if (existing) {
            // Parsear datos de IA
            const aiAnalysis = existing.aiAnalysis ? JSON.parse(existing.aiAnalysis) : {};
            const aiDiagnosis = existing.aiDiagnosis ? JSON.parse(existing.aiDiagnosis) : {};
            const aiRecommendations = existing.aiRecommendations ? JSON.parse(existing.aiRecommendations) : {};
            const topicScores = existing.topicScores ? JSON.parse(existing.topicScores) : {};

            // Mapear answers de BD al formato que espera el frontend
            const answersData = (existing.answers || []).map(a => ({
                questionIndex: a.questionIndex,
                questionText: a.questionText,
                options: a.options ? JSON.parse(a.options) : null,
                correctOption: a.correctOption,
                selectedOption: a.selectedOption,
                isCorrect: a.isCorrect,
                timeSpentMs: a.timeSpentMs || 0,
                topic: a.topic,
                difficulty: a.difficulty,
                explanation: a.explanation,
            }));

            // Calcular timeData desde los answers guardados
            const questionTimings = answersData.map(a => a.timeSpentMs || 0);
            const totalTimeMs = existing.totalTimeMs || questionTimings.reduce((s, t) => s + t, 0);
            const avgTimeMs = questionTimings.length > 0
                ? questionTimings.reduce((s, t) => s + t, 0) / questionTimings.length
                : 0;
            let slowest = null, fastest = null, slowQuestions = 0, fastQuestions = 0;
            if (questionTimings.length > 0) {
                let maxTime = 0, minTime = Infinity, maxIdx = 0, minIdx = 0;
                questionTimings.forEach((t, i) => {
                    if (t > maxTime) { maxTime = t; maxIdx = i; }
                    if (t > 0 && t < minTime) { minTime = t; minIdx = i; }
                    if (t > 60000) slowQuestions++;
                    if (t > 0 && t < 10000) fastQuestions++;
                });
                if (maxTime > 0) slowest = { index: maxIdx + 1, time: maxTime };
                if (minTime < Infinity) fastest = { index: minIdx + 1, time: minTime };
            }

            return NextResponse.json({
                completed: true,
                result: {
                    score: existing.score,
                    total: existing.totalQuestions,
                    totalQuestions: existing.totalQuestions,
                    percentage: Math.round((existing.score / existing.totalQuestions) * 100),
                    assignedLevel: existing.assignedLevel,
                    schoolGrade: existing.schoolGrade,
                    topicScores,
                    analysis: aiAnalysis,
                    diagnosis: aiDiagnosis,
                    recommendations: aiRecommendations,
                    answers: answersData,
                    timeData: { totalTimeMs, avgTimeMs, slowest, fastest, slowQuestions, fastQuestions },
                },
            });
        }

        return NextResponse.json({ completed: false });
    } catch (error) {
        console.error('Error obteniendo diagnostico:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// POST — generar examen o enviar respuestas
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;

        if (action === 'generate') {
            return await handleGenerate(body, session);
        } else if (action === 'submit') {
            return await handleSubmit(body, session);
        } else if (action === 'reset') {
            return await handleReset(session);
        }

        return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
    } catch (error) {
        console.error('Error en diagnostico:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}

async function handleGenerate({ schoolGrade }, session) {
    const normalizedGrade = Number(schoolGrade);

    if (!Number.isInteger(normalizedGrade) || normalizedGrade !== 9) {
        return NextResponse.json({ error: 'Esta aplicacion esta disponible unicamente para grado noveno' }, { status: 400 });
    }

    // Guardar grado en el usuario
    await prisma.user.update({
        where: { id: session.user.id },
        data: { schoolGrade: normalizedGrade },
    });

    const questionBank = loadDiagnosticQuestionBank(normalizedGrade);
    if (questionBank.length === 0) {
        const summary = getDiagnosticQuestionBankSummary(normalizedGrade);
        return NextResponse.json({
            error: `No hay preguntas validas para grado ${normalizedGrade}. Revisa que el JSON tenga enunciado y opciones A/B/C/D.`,
            summary,
        }, { status: 422 });
    }

    const questions = selectDiagnosticQuestions(questionBank, DIAGNOSTIC_QUESTION_COUNT);
    const summary = getDiagnosticQuestionBankSummary(normalizedGrade);

    return NextResponse.json({
        success: true,
        source: 'json-diagnostic-bank',
        schoolGrade: normalizedGrade,
        totalAvailable: questionBank.length,
        missingAnswerKeys: questions.filter(q => q.answerKeyMissing).length,
        bankSummary: summary,
        questions,
    });
}

// Evaluar respuestas con pipeline multiagente
async function handleSubmit({ schoolGrade, questions, answers, timings, totalTimeMs }, session) {
    const userId = session.user.id;

    if (!questions || !answers || !Array.isArray(questions)) {
        return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    // Calcular correctas/incorrectas
    let totalCorrect = 0;
    const studentAnswers = [];
    const isCorrectArray = [];
    const topicScores = {};

    questions.forEach((q, i) => {
        const rawAnswer = answers[i] || null;

        // Normalizar respuesta: puede ser string ("A") o objeto de widget directo
        let selected = null;
        let isCorrect = false;

        if (rawAnswer === null || rawAnswer === undefined) {
            selected = null;
            isCorrect = false;
        } else if (typeof rawAnswer === 'object' && rawAnswer.type) {
            // Widget directo (slider_answer, input_number, drag_sort, fill_expression)
            // Extraer el valor real para el analizador
            let valStr = 'Sin respuesta';
            if (rawAnswer.value !== undefined) {
                if (Array.isArray(rawAnswer.value)) {
                    valStr = rawAnswer.value.map(v => typeof v === 'object' ? v.id : v).join(', ');
                } else {
                    valStr = String(rawAnswer.value);
                }
            } else if (rawAnswer.order !== undefined) {
                valStr = Array.isArray(rawAnswer.order) ? rawAnswer.order.join(', ') : String(rawAnswer.order);
            } else if (rawAnswer.values !== undefined) {
                valStr = typeof rawAnswer.values === 'object' ? Object.values(rawAnswer.values).join(', ') : String(rawAnswer.values);
            }
            
            // Guardar con prefijo especial para diferenciar en BD
            selected = `__widget__:${valStr}`;
            isCorrect = rawAnswer.isCorrect === true;
        } else if (typeof rawAnswer === 'string') {
            // Respuesta tradicional A/B/C/D
            selected = rawAnswer;
            isCorrect = selected
                && q.correctOption
                && selected.toUpperCase() === q.correctOption.toUpperCase();
        }

        if (isCorrect) totalCorrect++;
        studentAnswers.push(selected);
        isCorrectArray.push(isCorrect); // Mantenemos la verdad absoluta calculada

        const topic = q.topic || 'General';
        if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
        topicScores[topic].total++;
        if (isCorrect) topicScores[topic].correct++;
    });

    // Datos de tiempo
    const questionTimings = timings || [];
    // Filtrar tiempos válidos (>0) para estadísticas precisas
    const validTimings = questionTimings.filter(t => t > 0);
    const timeData = {
        totalTimeMs: totalTimeMs || 0,
        avgTimeMs: validTimings.length > 0 ? validTimings.reduce((a, b) => a + b, 0) / validTimings.length : 0,
        slowest: null,
        fastest: null,
        slowQuestions: 0,
        fastQuestions: 0,
    };

    if (validTimings.length > 0) {
        let maxTime = 0, minTime = Infinity, maxIdx = 0, minIdx = 0;
        questionTimings.forEach((t, i) => {
            if (t > maxTime) { maxTime = t; maxIdx = i; }
            if (t > 0 && t < minTime) { minTime = t; minIdx = i; }
            if (t > 60000) timeData.slowQuestions++;
            if (t > 0 && t < 10000) timeData.fastQuestions++;
        });
        if (maxTime > 0) timeData.slowest = { index: maxIdx + 1, time: maxTime };
        if (minTime < Infinity) timeData.fastest = { index: minIdx + 1, time: minTime };
    }

    // Pipeline multiagente
    console.log('[ANSWER-ANALYZER] Analizando respuestas...');
    const analysis = await answerAnalyzerAgent(questions, studentAnswers, schoolGrade, isCorrectArray);
    console.log('[ANSWER-ANALYZER] Analisis completado');

    console.log('[ACADEMIC-DIAGNOSTIC] Generando diagnostico...');
    const diagnosis = await academicDiagnosticAgent(analysis, schoolGrade, timeData);
    console.log('[ACADEMIC-DIAGNOSTIC] Diagnostico completado');

    console.log('[LEARNING-RECOMMENDATIONS] Generando recomendaciones...');
    const recommendations = await learningRecommendationsAgent(diagnosis, schoolGrade);
    console.log('[LEARNING-RECOMMENDATIONS] Recomendaciones completadas');

    // Calcular nivel asignado
    const percentage = totalCorrect / questions.length;
    let assignedLevel;
    if (percentage >= 0.8) assignedLevel = 5;
    else if (percentage >= 0.6) assignedLevel = 4;
    else if (percentage >= 0.4) assignedLevel = 3;
    else if (percentage >= 0.2) assignedLevel = 2;
    else assignedLevel = 1;

    // Guardar en BD
    const diagnosticResult = await prisma.diagnosticResult.create({
        data: {
            userId,
            score: totalCorrect,
            totalQuestions: questions.length,
            assignedLevel,
            topicScores: JSON.stringify(topicScores),
            schoolGrade,
            totalTimeMs: totalTimeMs || null,
            aiAnalysis: JSON.stringify(analysis),
            aiDiagnosis: JSON.stringify(diagnosis),
            aiRecommendations: JSON.stringify(recommendations),
        },
    });

    // Guardar cada respuesta individual
    for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        const selected = studentAnswers[i];
        // Usar la verdad absoluta ya calculada
        const isCorrect = isCorrectArray[i] === true;

        // Buscar explicacion del error en el analisis
        let explanation = null;
        if (!isCorrect && analysis.analysis) {
            const errorAnalysis = analysis.analysis.find(a => a.questionIndex === (i + 1));
            if (errorAnalysis) {
                explanation = `${errorAnalysis.explicacionError || ''}\n\nRespuesta correcta: ${errorAnalysis.explicacionCorrecta || ''}`;
            }
        }

        // Para widgets directos sin opciones A/B/C/D, guardar metadatos de interactividad
        let optionsData = JSON.stringify(q.options || {});
        if (!q.options && q.interactivity) {
            optionsData = JSON.stringify({
                __interactive__: true,
                type: q.interactivity.type,
                correctValue: q.interactivity.correctValue ?? q.interactivity.correctOrder ?? null,
                tolerance: q.interactivity.tolerance ?? 0,
            });
        }

        await prisma.diagnosticAnswer.create({
            data: {
                diagnostic: { connect: { id: diagnosticResult.id } },
                questionIndex: i + 1,
                questionText: q.text || '',
                options: optionsData,
                correctOption: q.correctOption || (q.interactivity ? `__widget__:${q.interactivity.correctValue ?? 'interactive'}` : '__pending_key__'),
                selectedOption: selected,
                isCorrect,
                timeSpentMs: questionTimings[i] || 0,
                topic: q.topic || 'General',
                difficulty: q.difficulty || 'media',
                explanation,
            },
        });
    }

    // Crear sesion de diagnostico para tracking admin
    const diagSession = await prisma.session.create({
        data: {
            userId,
            sessionType: 'diagnostic',
            endedAt: new Date(),
            questionsAttempted: questions.length,
            questionsCorrect: totalCorrect,
            accuracyRate: percentage,
        },
    });

    // Crear interactions para tracking
    for (let i = 0; i < questions.length; i++) {
        const selected = studentAnswers[i];
        const isCorrect = isCorrectArray[i] === true;

        await prisma.interaction.create({
            data: {
                sessionId: diagSession.id,
                studentMessage: `Respuesta: ${selected || 'sin respuesta'} - ${questions[i].topic}`,
                tutorResponse: isCorrect ? 'Correcto' : `Incorrecto. Correcta: ${questions[i].correctOption || 'pendiente de clave'}`,
                isCorrect,
                timeSpentSeconds: questionTimings[i] ? Math.round(questionTimings[i] / 1000) : null,
                attemptNumber: 1,
                difficultyAtTime: assignedLevel,
                errorType: isCorrect ? null : 'diagnostic_error',
            },
        });
    }

    // Actualizar nivel del usuario
    await prisma.user.update({
        where: { id: userId },
        data: { currentLevel: assignedLevel, schoolGrade },
    });

    // Construir answersData para devolver al cliente inmediatamente
    const answersResponse = questions.map((q, i) => {
        const selected = studentAnswers[i];
        const isCorrect = isCorrectArray[i] === true;
        let explanation = null;
        if (!isCorrect && analysis && analysis.analysis) {
            const errorAnalysis = analysis.analysis.find(a => a.questionIndex === (i + 1));
            if (errorAnalysis) {
                explanation = `${errorAnalysis.explicacionError || ''}\n\nRespuesta correcta: ${errorAnalysis.explicacionCorrecta || ''}`;
            }
        }
        return {
            questionIndex: i + 1,
            questionText: q.text || '',
            options: q.options || null,
            correctOption: q.correctOption || (q.interactivity ? `__widget__:${q.interactivity.correctValue ?? 'interactive'}` : '__pending_key__'),
            selectedOption: selected,
            isCorrect,
            timeSpentMs: questionTimings[i] || 0,
            topic: q.topic || 'General',
            difficulty: q.difficulty || 'media',
            explanation,
        };
    });

    return NextResponse.json({
        success: true,
        score: totalCorrect,
        total: questions.length,
        percentage: Math.round(percentage * 100),
        assignedLevel,
        topicScores,
        analysis,
        diagnosis,
        recommendations,
        timeData,
        answers: answersResponse,
    });
}

// Reset diagnostico (para re-hacerlo)
async function handleReset(session) {
    const userId = session.user.id;

    // Eliminar answers primero (foreign key)
    const diagnostics = await prisma.diagnosticResult.findMany({
        where: { userId },
        select: { id: true },
    });

    for (const d of diagnostics) {
        await prisma.diagnosticAnswer.deleteMany({ where: { diagnosticId: d.id } });
    }

    await prisma.diagnosticResult.deleteMany({ where: { userId } });

    return NextResponse.json({ success: true, message: 'Diagnostico reiniciado' });
}
