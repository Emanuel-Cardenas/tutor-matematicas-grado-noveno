// API: detalle, edicion y eliminacion de contenido individual.
// La regeneracion automatica de preguntas con IA esta desactivada.
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import fs from 'fs';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function verifyAdmin(request) {
    const auth = request.headers.get('Authorization') || '';
    return Boolean(ADMIN_PASSWORD) && auth.replace('Bearer ', '') === ADMIN_PASSWORD;
}

export async function GET(request, { params }) {
    if (!verifyAdmin(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;

    const content = await prisma.teacherContent.findUnique({
        where: { id },
        include: {
            questions: {
                orderBy: { createdAt: 'asc' },
            },
            results: {
                include: {
                    user: { select: { id: true, fullName: true, username: true, schoolGrade: true } },
                    answers: true,
                },
                orderBy: { completedAt: 'desc' },
            },
        },
    });

    if (!content) {
        return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 });
    }

    const parsed = {
        ...content,
        keyConcepts: content.keyConcepts ? safeParse(content.keyConcepts, null) : null,
        questions: content.questions.map(question => ({
            ...question,
            options: safeParse(question.options, {}),
        })),
        results: content.results.map(result => ({
            ...result,
            aiAnalysis: result.aiAnalysis ? safeParse(result.aiAnalysis, null) : null,
            aiDiagnosis: result.aiDiagnosis ? safeParse(result.aiDiagnosis, null) : null,
        })),
    };

    return NextResponse.json({ content: parsed });
}

export async function PATCH(request, { params }) {
    if (!verifyAdmin(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'approve_question') {
        const { questionId } = body;
        await prisma.contentQuestion.update({
            where: { id: questionId },
            data: { isApproved: true },
        });
        return NextResponse.json({ success: true });
    }

    if (action === 'reject_question') {
        const { questionId } = body;
        await prisma.contentQuestion.delete({ where: { id: questionId } });
        return NextResponse.json({ success: true });
    }

    if (action === 'edit_question') {
        const { questionId, text, options, correctOption, explanation, difficulty } = body;
        await prisma.contentQuestion.update({
            where: { id: questionId },
            data: {
                text: text || undefined,
                options: options ? JSON.stringify(options) : undefined,
                correctOption: correctOption || undefined,
                explanation: explanation || undefined,
                difficulty: difficulty || undefined,
                isApproved: true,
            },
        });
        return NextResponse.json({ success: true });
    }

    if (action === 'add_manual_question') {
        const { text, options, correctOption, topic, difficulty, explanation } = body;
        const question = await prisma.contentQuestion.create({
            data: {
                contentId: id,
                text,
                options: JSON.stringify(options),
                correctOption: correctOption.toUpperCase(),
                topic: topic || 'General',
                difficulty: difficulty || 'media',
                explanation: explanation || '',
                isApproved: true,
                isManual: true,
            },
        });
        return NextResponse.json({ success: true, question: { ...question, options: safeParse(question.options, {}) } });
    }

    if (action === 'approve_all') {
        await prisma.contentQuestion.updateMany({
            where: { contentId: id },
            data: { isApproved: true },
        });
        return NextResponse.json({ success: true });
    }

    if (action === 'regenerate_questions') {
        return NextResponse.json({
            error: 'La regeneracion automatica de preguntas con IA fue desactivada.',
        }, { status: 410 });
    }

    return NextResponse.json({ error: 'Accion no valida' }, { status: 400 });
}

export async function DELETE(request, { params }) {
    if (!verifyAdmin(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { id } = await params;
    const content = await prisma.teacherContent.findUnique({ where: { id } });

    if (!content) {
        return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
    }

    try {
        if (fs.existsSync(content.filePath)) {
            fs.unlinkSync(content.filePath);
        }
    } catch (error) {
        console.warn('No se pudo eliminar archivo:', error.message);
    }

    await prisma.teacherContent.delete({ where: { id } });

    return NextResponse.json({ success: true });
}

function safeParse(value, fallback) {
    try {
        return value ? JSON.parse(value) : fallback;
    } catch {
        return fallback;
    }
}
