import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        const username = body.username?.trim();
        const email = body.email?.trim();
        const password = body.password;
        const fullName = body.fullName?.trim();
        const childUsername = body.childUsername?.trim();

        // Validaciones
        if (!username || !email || !password || !childUsername) {
            return NextResponse.json(
                { error: 'Todos los campos son obligatorios' },
                { status: 400 }
            );
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'La contraseña debe tener al menos 6 caracteres' },
                { status: 400 }
            );
        }

        // Buscar al hijo (estudiante) por username
        const child = await prisma.user.findUnique({
            where: { username: childUsername },
            select: { id: true, fullName: true, username: true },
        });

        if (!child) {
            return NextResponse.json(
                { error: `No se encontró un estudiante con usuario "${childUsername}". Verifica que tu hijo ya esté registrado en la plataforma.` },
                { status: 404 }
            );
        }

        // Verificar que no haya otro padre vinculado a este estudiante
        const existingParentForChild = await prisma.parent.findUnique({
            where: { childId: child.id },
        });

        if (existingParentForChild) {
            return NextResponse.json(
                { error: 'Este estudiante ya tiene un padre/acudiente vinculado.' },
                { status: 400 }
            );
        }

        // Verificar que el padre no esté ya registrado
        const existingParent = await prisma.parent.findFirst({
            where: {
                OR: [{ username }, { email }],
            },
        });

        if (existingParent) {
            return NextResponse.json(
                { error: 'El usuario o email ya está registrado' },
                { status: 400 }
            );
        }

        // Crear padre
        const passwordHash = await bcrypt.hash(password, 12);

        const parent = await prisma.parent.create({
            data: {
                username,
                email,
                passwordHash,
                fullName: fullName || username,
                childId: child.id,
            },
        });

        return NextResponse.json(
            {
                message: '¡Cuenta de padre creada exitosamente!',
                parent: { id: parent.id, username: parent.username },
                child: { name: child.fullName || child.username },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error en registro de padre:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
