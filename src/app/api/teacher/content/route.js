// API: Gestion de contenido del profesor.
// GET se conserva para consultar contenido existente.
// POST queda desactivado para evitar generar preguntas desde documentos.
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function verifyAdmin(request) {
    const auth = request.headers.get('Authorization') || '';
    const token = auth.replace('Bearer ', '');
    return Boolean(ADMIN_PASSWORD) && token === ADMIN_PASSWORD;
}

export async function GET(request) {
    if (!verifyAdmin(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const grade = searchParams.get('grade');

    const where = {};
    if (grade && grade !== 'all') {
        where.schoolGrade = parseInt(grade, 10);
    }

    const contents = await prisma.teacherContent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            _count: {
                select: {
                    questions: true,
                    results: true,
                },
            },
        },
    });

    return NextResponse.json({ contents });
}

export async function POST(request) {
    if (!verifyAdmin(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    return NextResponse.json({
        error: 'La generacion automatica de preguntas desde documentos fue desactivada. Carga el nuevo banco exclusivamente como JSON en Pruebas de Estado.',
    }, { status: 410 });
}
