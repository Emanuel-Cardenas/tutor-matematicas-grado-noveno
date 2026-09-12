import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { stateExamAnalyzerAgent } from '@/lib/agents/state-exam-analyzer';
import { loadStateExamQuestionBank } from '@/lib/state-exam-question-bank';
import crypto from 'crypto';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const history = await prisma.session.findMany({
            where: {
                userId: session.user.id,
                sessionType: 'pruebas-estado',
            },
            orderBy: { startedAt: 'desc' },
            include: {
                interactions: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        question: { include: { topic: true } },
                    },
                },
            },
        });

        const formattedHistory = history.map(sessionRecord => {
            const summaryData = safeParse(sessionRecord.summary, {});
            const snapshots = summaryData.questionSnapshots || [];

            return {
                id: sessionRecord.id,
                startedAt: sessionRecord.startedAt,
                endedAt: sessionRecord.endedAt,
                questionsAttempted: sessionRecord.questionsAttempted,
                questionsCorrect: sessionRecord.questionsCorrect,
                accuracyRate: sessionRecord.accuracyRate ? Math.round(sessionRecord.accuracyRate * 100) : 0,
                analysis: summaryData.analysis || null,
                diagnosis: summaryData.diagnosis || null,
                recommendations: summaryData.recommendations || null,
                totalTimeMs: summaryData.totalTimeMs || 0,
                interactions: sessionRecord.interactions.map((interaction, index) => {
                    const snapshot = snapshots[index] || {};
                    const dbOptions = interaction.question?.metadata
                        ? safeParse(interaction.question.metadata, {}).options
                        : null;

                    return {
                        questionId: interaction.questionId || snapshot.id || null,
                        questionText: interaction.question?.content || snapshot.text || '',
                        options: dbOptions || snapshot.options || null,
                        correctOption: interaction.question?.correctAnswer || snapshot.correctOption || '',
                        selectedOption: extractSelectedOption(interaction.studentMessage),
                        isCorrect: interaction.isCorrect,
                        timeSpentSeconds: interaction.timeSpentSeconds || 0,
                        topic: interaction.question?.topic?.name || snapshot.topic || 'General',
                        materials: snapshot.materials || null,
                    };
                }),
            };
        });

        return NextResponse.json({ success: true, history: formattedHistory });
    } catch (error) {
        console.error('Error en GET /api/pruebas-estado:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}

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
        }

        if (action === 'submit') {
            return await handleSubmit(body, session);
        }

        return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
    } catch (error) {
        console.error('Error en POST /api/pruebas-estado:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}

async function handleGenerate({ size = 50 }, session) {
    const questionsCount = parseInt(size, 10);
    if (![15, 30, 50].includes(questionsCount)) {
        return NextResponse.json({ error: 'El tamano de preguntas debe ser 15, 30 o 50' }, { status: 400 });
    }

    const questionBank = loadStateExamQuestionBank();
    if (questionBank.length === 0) {
        return NextResponse.json({
            error: 'No hay un banco JSON de Pruebas de Estado cargado. Agrega archivos JSON en la carpeta "pruebas de estado" e intenta de nuevo.',
        }, { status: 503 });
    }

    const answeredQuestionIds = await getAnsweredJsonQuestionIds(session.user.id);
    let availableQuestions = questionBank.filter(question => !answeredQuestionIds.has(question.id));

    if (availableQuestions.length < questionsCount) {
        const alreadyAnswered = questionBank.filter(question => answeredQuestionIds.has(question.id));
        availableQuestions = [...availableQuestions, ...shuffleQuestions(alreadyAnswered)];
    }

    const selected = shuffleQuestions(availableQuestions)
        .slice(0, Math.min(questionsCount, availableQuestions.length))
        .map((question, index) => ({
            ...question,
            index: index + 1,
        }));

    return NextResponse.json({
        success: true,
        questions: selected,
        source: 'json',
    });
}

async function getAnsweredJsonQuestionIds(userId) {
    const sessions = await prisma.session.findMany({
        where: { userId, sessionType: 'pruebas-estado' },
        select: { summary: true },
    });

    const ids = new Set();
    for (const sessionRecord of sessions) {
        const summary = safeParse(sessionRecord.summary, {});
        for (const question of summary.questionSnapshots || []) {
            if (question.id) ids.add(question.id);
        }
    }
    return ids;
}

async function handleSubmit({ questions, answers, timings, totalTimeMs }, session) {
    const userId = session.user.id;

    if (!questions || !answers || !Array.isArray(questions)) {
        return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
    }

    let totalCorrect = 0;
    const studentAnswers = [];
    const isCorrectArray = [];
    const topicScores = {};

    questions.forEach((question, index) => {
        const rawAnswer = answers[index] || null;
        let selected = null;
        let isCorrect = false;

        if (typeof rawAnswer === 'string') {
            selected = rawAnswer;
            isCorrect = Boolean(
                selected
                && question.correctOption
                && selected.toUpperCase() === question.correctOption.toUpperCase()
            );
        }

        if (isCorrect) totalCorrect++;
        studentAnswers.push(selected);
        isCorrectArray.push(isCorrect);

        const topic = question.topic || 'General';
        if (!topicScores[topic]) topicScores[topic] = { correct: 0, total: 0 };
        topicScores[topic].total++;
        if (isCorrect) topicScores[topic].correct++;
    });

    const questionTimings = timings || [];
    const stateExamResult = await stateExamAnalyzerAgent(
        questions,
        studentAnswers,
        isCorrectArray,
        questionTimings,
        totalTimeMs || 0
    );

    const percentage = questions.length > 0 ? totalCorrect / questions.length : 0;
    const questionSnapshots = questions.map(question => ({
        id: question.id || null,
        text: question.text || '',
        options: question.options || null,
        correctOption: question.correctOption || '',
        topic: question.topic || 'General',
        difficulty: question.difficulty || 'media',
        materials: question.materials || null,
        metadata: question.metadata || null,
    }));

    const sessionRecord = await prisma.session.create({
        data: {
            userId,
            sessionType: 'pruebas-estado',
            endedAt: new Date(),
            questionsAttempted: questions.length,
            questionsCorrect: totalCorrect,
            accuracyRate: percentage,
            summary: JSON.stringify({
                analysis: {
                    totalCorrect: stateExamResult.totalCorrect,
                    totalIncorrect: stateExamResult.totalIncorrect,
                    resumenEjecutivo: stateExamResult.resumenEjecutivo,
                    analisisIndividual: stateExamResult.analisisIndividual,
                    fortalezasEspecificas: stateExamResult.fortalezasEspecificas,
                    debilidadesEspecificas: stateExamResult.debilidadesEspecificas,
                },
                diagnosis: {
                    fortalezas: stateExamResult.fortalezasEspecificas,
                    debilidades: stateExamResult.debilidadesEspecificas,
                    nivelDesempenoICFES: stateExamResult.nivelDesempenoICFES,
                    puntajeEstimadoICFES: stateExamResult.puntajeEstimadoICFES,
                    rendimientoPorCompetencia: stateExamResult.rendimientoPorCompetencia,
                    rendimientoPorComponente: stateExamResult.rendimientoPorComponente,
                },
                recommendations: stateExamResult.recomendacionesSaber11,
                stateExamAnalysis: stateExamResult,
                questionSnapshots,
                answers: studentAnswers,
                timings,
                totalTimeMs,
            }),
        },
    });

    for (let i = 0; i < questions.length; i++) {
        const selected = studentAnswers[i];
        const isCorrect = isCorrectArray[i] === true;
        const question = questions[i];

        await prisma.interaction.create({
            data: {
                sessionId: sessionRecord.id,
                questionId: null,
                studentMessage: `Respuesta: ${selected || 'Sin respuesta'}`,
                tutorResponse: isCorrect ? 'Correcto' : `Incorrecto. Correcta: ${question.correctOption}`,
                isCorrect,
                timeSpentSeconds: questionTimings[i] ? Math.round(questionTimings[i] / 1000) : null,
                attemptNumber: 1,
                difficultyAtTime: question.difficulty === 'dificil' ? 5 : question.difficulty === 'facil' ? 1 : 3,
                errorType: isCorrect ? null : 'simulacro_error',
            },
        });
    }

    return NextResponse.json({
        success: true,
        sessionId: sessionRecord.id,
        score: totalCorrect,
        total: questions.length,
        percentage: Math.round(percentage * 100),
        topicScores,
        analysis: stateExamResult,
        diagnosis: {
            fortalezas: stateExamResult.fortalezasEspecificas,
            debilidades: stateExamResult.debilidadesEspecificas,
            nivelDesempenoICFES: stateExamResult.nivelDesempenoICFES,
            puntajeEstimadoICFES: stateExamResult.puntajeEstimadoICFES,
            rendimientoPorCompetencia: stateExamResult.rendimientoPorCompetencia,
            rendimientoPorComponente: stateExamResult.rendimientoPorComponente,
        },
        recommendations: stateExamResult.recomendacionesSaber11,
        stateExamAnalysis: stateExamResult,
        timeData: stateExamResult.timeData,
    });
}

function safeParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}

function extractSelectedOption(studentMessage) {
    return String(studentMessage || '').replace(/^Respuesta:\s*/i, '');
}

function shuffleQuestions(questions) {
    const copy = [...questions];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}
