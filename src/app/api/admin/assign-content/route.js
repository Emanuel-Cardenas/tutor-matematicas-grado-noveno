// POST /api/admin/assign-content
// Asigna un contenido del profesor a un grado completo o estudiantes específicos.
// Autenticación: Bearer token de admin (no sesión NextAuth).
import { NextResponse } from 'next/server';
import prisma from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function verifyAdmin(request) {
    const auth = request.headers.get('Authorization') || '';
    return Boolean(ADMIN_PASSWORD) && auth.replace('Bearer ', '') === ADMIN_PASSWORD;
}

export async function POST(request) {
    if (!verifyAdmin(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    let body;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
    }

    const {
        contentId,
        assignToGrade,     // número de grado, e.g. "11"  → asignar a todo el grado
        assignToStudents,  // array de IDs de usuario       → asignar a estudiantes específicos
        assignmentType,    // 'quiz' | 'tarea' | 'evaluacion'
        deadline,          // ISO date string (opcional)
        note,              // string (opcional)
    } = body;

    if (!contentId) {
        return NextResponse.json({ error: 'contentId requerido' }, { status: 400 });
    }
    if (!assignToGrade && (!assignToStudents || assignToStudents.length === 0)) {
        return NextResponse.json({ error: 'Debes indicar un grado o lista de estudiantes' }, { status: 400 });
    }

    // Verificar que el contenido exista y tenga preguntas aprobadas
    const content = await prisma.teacherContent.findUnique({
        where: { id: contentId },
        include: {
            questions: {
                where: { isApproved: true },
                select: { id: true },
            },
        },
    });

    if (!content) {
        return NextResponse.json({ error: 'Contenido no encontrado' }, { status: 404 });
    }
    if (content.questions.length === 0) {
        return NextResponse.json({
            error: 'El contenido no tiene preguntas aprobadas. Aprueba al menos una pregunta antes de publicar.',
        }, { status: 400 });
    }

    // Resolver lista de estudiantes a asignar
    let studentIds = [];

    if (assignToGrade) {
        const grade = parseInt(assignToGrade, 10);
        if (isNaN(grade)) {
            return NextResponse.json({ error: 'Grado inválido' }, { status: 400 });
        }
        const students = await prisma.user.findMany({
            where: { role: 'student', schoolGrade: grade },
            select: { id: true },
        });
        studentIds = students.map(s => s.id);

        if (studentIds.length === 0) {
            return NextResponse.json({
                error: `No hay estudiantes registrados en el grado ${grade}°.`,
            }, { status: 400 });
        }
    } else {
        // Verificar que los estudiantes existen
        const students = await prisma.user.findMany({
            where: { id: { in: assignToStudents }, role: 'student' },
            select: { id: true },
        });
        studentIds = students.map(s => s.id);

        if (studentIds.length === 0) {
            return NextResponse.json({ error: 'Ninguno de los estudiantes seleccionados existe.' }, { status: 400 });
        }
    }

    // Crear asignaciones (upsert: si ya existe, actualizar)
    const deadlineDate = deadline ? new Date(deadline) : null;
    let created = 0;
    let updated = 0;

    for (const studentId of studentIds) {
        try {
            // Verificar si ya existe una asignación activa
            const existing = await prisma.contentAssignment.findFirst({
                where: { contentId, studentId },
            });

            if (existing) {
                await prisma.contentAssignment.update({
                    where: { id: existing.id },
                    data: {
                        assignmentType: assignmentType || 'quiz',
                        deadline:       deadlineDate,
                        note:           note || null,
                        status:         'assigned',
                        updatedAt:      new Date(),
                    },
                });
                updated++;
            } else {
                await prisma.contentAssignment.create({
                    data: {
                        contentId,
                        studentId,
                        assignmentType: assignmentType || 'quiz',
                        deadline:       deadlineDate,
                        note:           note || null,
                        status:         'assigned',
                    },
                });
                created++;
            }
        } catch (e) {
            // Si el modelo no existe aún en la BD, ignorar y continuar
            console.warn('[ASSIGN] Error al crear asignación:', e.message);
        }
    }

    return NextResponse.json({
        success: true,
        message: `Contenido asignado exitosamente.`,
        stats: {
            totalStudents: studentIds.length,
            created,
            updated,
            grade:    assignToGrade || null,
            type:     assignmentType || 'quiz',
            deadline: deadlineDate?.toISOString() || null,
        },
    });
}
