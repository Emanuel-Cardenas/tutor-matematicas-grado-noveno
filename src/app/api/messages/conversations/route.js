import { NextResponse } from 'next/server';
import { getMessagingUser } from '@/lib/auth-helper';
import { getConversations, getOrCreateConversation } from '@/lib/agents/message-agent';

/**
 * GET /api/messages/conversations
 * Listar conversaciones del usuario autenticado (admin o estudiante)
 */
export async function GET(request) {
    try {
        const user = await getMessagingUser(request);
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const conversations = await getConversations(user.id, user.role);
        return NextResponse.json({ conversations });
    } catch (error) {
        console.error('[API] Error conversaciones:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/messages/conversations
 * Crear/obtener conversación con un estudiante
 * Body: { studentId: string }
 */
export async function POST(request) {
    try {
        const user = await getMessagingUser(request);
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const { studentId } = await request.json();
        if (!studentId) return NextResponse.json({ error: 'studentId requerido' }, { status: 400 });

        // Admin abre chat con estudiante, o estudiante abre chat con admin
        const adminId = user.role === 'admin' ? user.id : studentId;
        const studId = user.role === 'admin' ? studentId : user.id;

        const conversation = await getOrCreateConversation(adminId, studId);
        return NextResponse.json({ conversation });
    } catch (error) {
        console.error('[API] Error creando conversación:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
