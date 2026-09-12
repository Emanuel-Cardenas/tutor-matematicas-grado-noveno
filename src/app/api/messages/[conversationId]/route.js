import { NextResponse } from 'next/server';
import { getMessagingUser } from '@/lib/auth-helper';
import { getMessages, sendMessage } from '@/lib/agents/message-agent';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

/**
 * GET /api/messages/[conversationId]
 */
export async function GET(request, { params }) {
    try {
        const user = await getMessagingUser(request);
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const { conversationId } = await params;
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');

        const messages = await getMessages(conversationId, user.id, { page });
        return NextResponse.json({ messages });
    } catch (error) {
        console.error('[API] Error mensajes:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}

/**
 * POST /api/messages/[conversationId]
 */
export async function POST(request, { params }) {
    try {
        const user = await getMessagingUser(request);
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const { conversationId } = await params;
        const body = await request.json();
        const { content, messageType = 'text', fileData, fileName } = body;

        if (!content && !fileData) {
            return NextResponse.json({ error: 'Mensaje o archivo requerido' }, { status: 400 });
        }

        let fileUrl = null;
        let savedFileName = null;

        if (fileData && fileName) {
            const sizeBytes = Buffer.byteLength(fileData, 'base64');
            const maxSize = messageType === 'image' ? 5 * 1024 * 1024 : 10 * 1024 * 1024;
            if (sizeBytes > maxSize) {
                return NextResponse.json({ error: `Archivo demasiado grande. Máximo: ${messageType === 'image' ? '5MB' : '10MB'}` }, { status: 400 });
            }

            const uploadDir = path.resolve(process.cwd(), 'uploads', 'messages');
            await mkdir(uploadDir, { recursive: true });
            const uniqueName = `${Date.now()}-${fileName}`;
            await writeFile(path.join(uploadDir, uniqueName), Buffer.from(fileData, 'base64'));

            fileUrl = `/api/uploads/messages/${uniqueName}`;
            savedFileName = fileName;
        }

        const message = await sendMessage({
            conversationId,
            senderId: user.id,
            content: content || '',
            messageType,
            fileUrl,
            fileName: savedFileName,
        });

        return NextResponse.json({ message });
    } catch (error) {
        console.error('[API] Error enviando:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }
}
