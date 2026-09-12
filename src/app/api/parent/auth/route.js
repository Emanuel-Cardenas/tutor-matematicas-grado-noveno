import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';

export async function POST(request) {
    try {
        const body = await request.json();
        const username = body.username?.trim();
        const password = body.password;

        if (!username || !password) {
            return NextResponse.json(
                { error: 'Usuario y contraseña son requeridos' },
                { status: 400 }
            );
        }

        // Buscar padre
        const parent = await prisma.parent.findUnique({
            where: { username },
            include: {
                child: {
                    select: {
                        id: true,
                        fullName: true,
                        username: true,
                        schoolGrade: true,
                        currentLevel: true,
                    },
                },
            },
        });

        if (!parent) {
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Verificar contraseña
        const isValid = await bcrypt.compare(password, parent.passwordHash);
        if (!isValid) {
            return NextResponse.json(
                { error: 'Usuario o contraseña incorrectos' },
                { status: 401 }
            );
        }

        // Actualizar último login
        await prisma.parent.update({
            where: { id: parent.id },
            data: { lastLogin: new Date() },
        });

        // Generar token simple (codificado en base64)
        const tokenData = {
            parentId: parent.id,
            childId: parent.childId,
            name: parent.fullName || parent.username,
            childName: parent.child.fullName || parent.child.username,
            ts: Date.now(),
        };
        const token = Buffer.from(JSON.stringify(tokenData)).toString('base64');

        return NextResponse.json({
            token,
            parent: {
                id: parent.id,
                name: parent.fullName || parent.username,
                username: parent.username,
            },
            child: {
                id: parent.child.id,
                name: parent.child.fullName || parent.child.username,
                username: parent.child.username,
                schoolGrade: parent.child.schoolGrade,
                currentLevel: parent.child.currentLevel,
            },
        });
    } catch (error) {
        console.error('Error en login de padre:', error);
        return NextResponse.json(
            { error: 'Error interno del servidor' },
            { status: 500 }
        );
    }
}
