import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import prisma from '@/lib/db';

/**
 * GET /api/teacher/students
 * Listar estudiantes asignados al profesor (basado en conversaciones existentes)
 */
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Solo profesores o admins pueden acceder' }, { status: 403 });
        }

        // Obtener estudiantes que tienen conversación con este usuario (admin/teacher)
        const conversations = await prisma.conversation.findMany({
            where: { adminId: session.user.id },
            include: {
                student: {
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        fullName: true,
                        currentLevel: true,
                        schoolGrade: true,
                        lastLogin: true,
                    },
                },
            },
        });

        const students = conversations.map(conv => ({
            id: conv.student.id,
            username: conv.student.username,
            email: conv.student.email,
            name: conv.student.fullName || conv.student.username,
            currentLevel: conv.student.currentLevel,
            schoolGrade: conv.student.schoolGrade,
            lastLogin: conv.student.lastLogin,
        }));

        return NextResponse.json({ students });
    } catch (error) {
        console.error('[API] Error listando estudiantes:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/teacher/students
 * Asignar estudiante al profesor (crea una conversación)
 * Body: { identifier: string } (username o email del estudiante)
 */
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Solo profesores pueden asignar estudiantes' }, { status: 403 });
        }

        const { identifier } = await request.json();
        if (!identifier) {
            return NextResponse.json({ error: 'Username o email del estudiante requerido' }, { status: 400 });
        }

        // Buscar el estudiante por username o email
        const student = await prisma.user.findFirst({
            where: {
                OR: [
                    { username: identifier.trim() },
                    { email: identifier.trim() },
                ],
                role: 'student',
            },
        });

        if (!student) {
            return NextResponse.json({ error: 'Estudiante no encontrado' }, { status: 404 });
        }

        // Verificar si ya existe la conversación (ya asignado)
        const existing = await prisma.conversation.findUnique({
            where: {
                adminId_studentId: {
                    adminId: session.user.id,
                    studentId: student.id,
                },
            },
        });

        if (existing) {
            return NextResponse.json({ error: 'Este estudiante ya está asignado' }, { status: 400 });
        }

        // Crear conversación = asignar estudiante
        await prisma.conversation.create({
            data: {
                adminId: session.user.id,
                studentId: student.id,
            },
        });

        return NextResponse.json({
            student: {
                id: student.id,
                name: student.fullName || student.username,
                username: student.username,
                email: student.email,
            },
            message: 'Estudiante asignado correctamente',
        }, { status: 201 });
    } catch (error) {
        console.error('[API] Error asignando estudiante:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

/**
 * DELETE /api/teacher/students
 * Desasignar estudiante (elimina la conversación y mensajes)
 * Body: { studentId: string }
 */
export async function DELETE(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }
        if (session.user.role !== 'teacher' && session.user.role !== 'admin') {
            return NextResponse.json({ error: 'Solo profesores pueden desasignar estudiantes' }, { status: 403 });
        }

        const { studentId } = await request.json();
        if (!studentId) {
            return NextResponse.json({ error: 'studentId requerido' }, { status: 400 });
        }

        // Buscar la conversación
        const conversation = await prisma.conversation.findUnique({
            where: {
                adminId_studentId: {
                    adminId: session.user.id,
                    studentId,
                },
            },
        });

        if (!conversation) {
            return NextResponse.json({ error: 'Estudiante no asignado' }, { status: 404 });
        }

        // Eliminar la conversación (cascade eliminará mensajes)
        await prisma.conversation.delete({
            where: { id: conversation.id },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('[API] Error desasignando estudiante:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
