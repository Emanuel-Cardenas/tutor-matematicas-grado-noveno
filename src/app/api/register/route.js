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

        if (!username || !email || !password) {
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

        // Verificar si ya existe
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ username }, { email }],
            },
        });

        if (existingUser) {
            return NextResponse.json(
                { error: 'El usuario o email ya está registrado' },
                { status: 400 }
            );
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const user = await prisma.user.create({
            data: {
                username,
                email,
                passwordHash,
                fullName: fullName || username,
                role: 'student',
            },
        });

        return NextResponse.json(
            {
                message: 'Usuario creado exitosamente',
                user: { id: user.id, username: user.username, email: user.email },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error('Error en registro:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
