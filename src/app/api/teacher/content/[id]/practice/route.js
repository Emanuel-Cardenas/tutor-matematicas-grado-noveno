// API: Práctica del Estudiante sobre Contenido del Profesor
// GET  — Obtener preguntas aprobadas para practicar
// POST — Enviar respuestas + evaluar con IA
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';
import { contentEvaluatorAgent } from '@/lib/agents/content-evaluator';

// GET: Obtener preguntas aprobadas del contenido
export async function GET(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { id } = await params;

        // Verificar que el contenido existe y está listo
        const content = await prisma.teacherContent.findUnique({
            where: { id },
            select: {
                id: true,
                title: true,
                topic: true,
                description: true,
                schoolGrade: true,
                status: true,
            },
        });

        if (!content) {
            return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 });
        }

        if (content.status !== 'ready') {
            return NextResponse.json({
                error: 'El contenido aún se está procesando',
                status: content.status,
            }, { status: 400 });
        }

        // Obtener preguntas APROBADAS
        const questions = await prisma.contentQuestion.findMany({
            where: { contentId: id, isApproved: true },
            orderBy: { createdAt: 'asc' },
        });

        if (questions.length === 0) {
            return NextResponse.json({
                error: 'No hay preguntas aprobadas para este contenido',
            }, { status: 400 });
        }

        // Obtener intentos previos del estudiante
        const previousResults = await prisma.contentDiagnosticResult.findMany({
            where: { userId: session.user.id, contentId: id },
            orderBy: { completedAt: 'desc' },
            select: {
                attemptNumber: true,
                score: true,
                totalQuestions: true,
                percentage: true,
                completedAt: true,
            },
        });

        return NextResponse.json({
            content: {
                id: content.id,
                title: content.title,
                topic: content.topic,
                description: content.description,
                schoolGrade: content.schoolGrade,
            },
            questions: questions.map(q => ({
                id: q.id,
                text: q.text,
                options: JSON.parse(q.options),
                topic: q.topic,
                difficulty: q.difficulty,
                conceptRelated: q.conceptRelated,
                // No enviar correctOption al estudiante
            })),
            previousAttempts: previousResults,
        });

    } catch (error) {
        console.error('[CONTENT-PRACTICE] Error GET:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}

// POST: Enviar respuestas del estudiante
export async function POST(request, { params }) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const { id: contentId } = await params;
        const body = await request.json();
        const { answers, timings, totalTimeMs } = body;

        if (!answers || typeof answers !== 'object') {
            return NextResponse.json({ error: 'Respuestas no proporcionadas' }, { status: 400 });
        }

        // Obtener contenido y preguntas aprobadas
        const content = await prisma.teacherContent.findUnique({
            where: { id: contentId },
        });

        if (!content) {
            return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 });
        }

        const questions = await prisma.contentQuestion.findMany({
            where: { contentId, isApproved: true },
            orderBy: { createdAt: 'asc' },
        });

        // Calcular resultados
        let totalCorrect = 0;
        const detailedAnswers = questions.map((q, i) => {
            const selected = answers[q.id] || answers[i] || null;
            const isCorrect = selected && selected.toUpperCase() === q.correctOption.toUpperCase();
            if (isCorrect) totalCorrect++;

            return {
                questionId: q.id,
                selectedOption: selected,
                isCorrect,
                timeSpentMs: timings?.[i] || timings?.[q.id] || 0,
                question: {
                    ...q,
                    options: JSON.parse(q.options),
                },
            };
        });

        const percentage = Math.round((totalCorrect / questions.length) * 100);

        // Determinar número de intento
        const prevAttempts = await prisma.contentDiagnosticResult.count({
            where: { userId: session.user.id, contentId },
        });
        const attemptNumber = prevAttempts + 1;

        // Evaluar con IA (Agente 3)
        console.log(`[CONTENT-PRACTICE] Evaluando intento #${attemptNumber} del estudiante ${session.user.id}...`);
        const parsedQuestions = questions.map(q => ({
            ...q,
            options: JSON.parse(q.options),
        }));
        const studentAnswers = questions.map(q => answers[q.id] || answers[questions.indexOf(q)] || null);

        const aiDiagnosis = await contentEvaluatorAgent(
            parsedQuestions,
            studentAnswers,
            content.title,
            content.schoolGrade
        );

        // Guardar resultado
        const result = await prisma.contentDiagnosticResult.create({
            data: {
                userId: session.user.id,
                contentId,
                attemptNumber,
                score: totalCorrect,
                totalQuestions: questions.length,
                percentage,
                aiDiagnosis: JSON.stringify(aiDiagnosis),
                totalTimeMs: totalTimeMs || null,
            },
        });

        // Guardar respuestas individuales
        for (const a of detailedAnswers) {
            await prisma.contentDiagnosticAnswer.create({
                data: {
                    resultId: result.id,
                    questionId: a.questionId,
                    selectedOption: a.selectedOption,
                    isCorrect: a.isCorrect,
                    timeSpentMs: a.timeSpentMs,
                },
            });
        }

        return NextResponse.json({
            success: true,
            attemptNumber,
            score: totalCorrect,
            total: questions.length,
            percentage,
            aiDiagnosis,
            answers: detailedAnswers.map(a => ({
                questionId: a.questionId,
                text: a.question.text,
                options: a.question.options,
                selectedOption: a.selectedOption,
                correctOption: a.question.correctOption,
                isCorrect: a.isCorrect,
                explanation: a.question.explanation,
            })),
        });

    } catch (error) {
        console.error('[CONTENT-PRACTICE] Error POST:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}
