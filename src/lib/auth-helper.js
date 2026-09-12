/**
 * 🔐 Auth Helper — Autenticación unificada para el sistema de mensajería
 * 
 * Soporta dos modos:
 * 1. NextAuth session (para estudiantes logueados)
 * 2. Admin token via Bearer header (para el admin desde el panel)
 */

import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/lib/db';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

/**
 * Buscar o crear el usuario Admin del sistema para mensajería
 */
export async function getOrCreateAdminUser() {
    let admin = await prisma.user.findFirst({ where: { role: 'admin' } });

    if (!admin) {
        admin = await prisma.user.create({
            data: {
                username: 'admin',
                email: 'admin@yedatech.local',
                passwordHash: 'SYSTEM_ADMIN_NO_LOGIN',
                fullName: 'Administrador',
                role: 'admin',
            },
        });
        console.log('[AUTH] Usuario admin del sistema creado:', admin.id);
    }

    return admin;
}

/**
 * Obtener el usuario autenticado para mensajería
 * Soporta NextAuth (estudiantes) y Bearer token (admin)
 * 
 * @returns {{ id: string, role: string, name: string } | null}
 */
export async function getMessagingUser(request) {
    // 1. PRIMERO verificar admin token (Bearer) — prioridad sobre NextAuth
    //    Esto evita que la sesión NextAuth de un estudiante interfiera
    //    cuando el admin opera desde el mismo navegador.
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        if (ADMIN_PASSWORD && token === ADMIN_PASSWORD) {
            const adminUser = await getOrCreateAdminUser();
            return {
                id: adminUser.id,
                role: 'admin',
                name: 'Administrador',
            };
        }
    }

    // 2. Intentar NextAuth session (estudiantes)
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
        return {
            id: session.user.id,
            role: session.user.role || 'student',
            name: session.user.name || session.user.username,
        };
    }

    return null;
}
