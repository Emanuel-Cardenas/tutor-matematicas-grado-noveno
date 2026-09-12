// API: Reportes grupales sobre un contenido del profesor
// GET — Generar reporte grupal con IA
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { contentReportAgent } from '@/lib/agents/content-report-agent';

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
            results: {
                include: {
                    user: { select: { fullName: true, username: true, schoolGrade: true } },
                },
                orderBy: { completedAt: 'desc' },
            },
        },
    });

    if (!content) {
        return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 });
    }

    // Agrupar por estudiante (usar mejor intento)
    const byStudent = {};
    for (const r of content.results) {
        if (!byStudent[r.userId] || r.percentage > byStudent[r.userId].percentage) {
            byStudent[r.userId] = {
                studentName: r.user.fullName || r.user.username,
                score: r.score,
                totalQuestions: r.totalQuestions,
                percentage: r.percentage,
                attemptNumber: r.attemptNumber,
                aiDiagnosis: r.aiDiagnosis,
            };
        }
    }

    const studentResults = Object.values(byStudent);

    if (studentResults.length === 0) {
        return NextResponse.json({
            report: null,
            message: 'No hay resultados de estudiantes para generar un reporte.',
        });
    }

    // Generar reporte con IA
    const report = await contentReportAgent(
        studentResults,
        content.title,
        content.topic,
        content.schoolGrade
    );

    return NextResponse.json({ report, totalStudents: studentResults.length });
}
