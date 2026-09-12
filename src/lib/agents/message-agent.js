/**
 * 📨 Message Agent — Chat Admin ↔ Estudiante (sin roles de profesor)
 * 
 * El Admin puede chatear con CUALQUIER estudiante sin asignación previa.
 * Los estudiantes solo ven conversaciones donde el admin les ha escrito.
 */

import prisma from '@/lib/db';

// ═══════════════════════════════════════════
// GESTIÓN DE CONVERSACIONES
// ═══════════════════════════════════════════

/**
 * Obtener todas las conversaciones de un usuario
 */
export async function getConversations(userId, userRole) {
    const whereClause = userRole === 'admin'
        ? { adminId: userId }
        : { studentId: userId };

    const conversations = await prisma.conversation.findMany({
        where: whereClause,
        include: {
            admin: { select: { id: true, fullName: true, username: true } },
            student: { select: { id: true, fullName: true, username: true, currentLevel: true, schoolGrade: true } },
            messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: { content: true, createdAt: true, senderId: true, messageType: true, isRead: true },
            },
        },
        orderBy: { lastMessageAt: 'desc' },
    });

    const withUnread = await Promise.all(conversations.map(async (conv) => {
        const unreadCount = await prisma.directMessage.count({
            where: {
                conversationId: conv.id,
                senderId: { not: userId },
                isRead: false,
            },
        });

        const contact = userRole === 'admin' ? conv.student : conv.admin;
        const lastMsg = conv.messages[0] || null;

        return {
            id: conv.id,
            contact: {
                id: contact.id,
                name: contact.fullName || contact.username,
                username: contact.username,
                level: contact.currentLevel,
                grade: contact.schoolGrade,
            },
            lastMessage: lastMsg ? {
                content: lastMsg.messageType === 'text' ? lastMsg.content : `📎 ${lastMsg.messageType === 'image' ? 'Imagen' : 'Archivo'}`,
                time: lastMsg.createdAt,
                isOwn: lastMsg.senderId === userId,
                isRead: lastMsg.isRead,
            } : null,
            unreadCount,
            createdAt: conv.createdAt,
        };
    }));

    return withUnread;
}

/**
 * Crear o recuperar una conversación entre admin y estudiante
 * NO requiere asignación previa — el admin puede chatear con cualquiera
 */
export async function getOrCreateConversation(adminId, studentId) {
    let conversation = await prisma.conversation.findUnique({
        where: {
            adminId_studentId: { adminId, studentId },
        },
    });

    if (!conversation) {
        conversation = await prisma.conversation.create({
            data: { adminId, studentId },
        });
        console.log(`[MESSAGE-AGENT] Nueva conversación admin-estudiante: ${conversation.id}`);
    }

    return conversation;
}

// ═══════════════════════════════════════════
// ENVÍO Y RECEPCIÓN DE MENSAJES
// ═══════════════════════════════════════════

/**
 * Enviar un mensaje en una conversación
 */
export async function sendMessage({ conversationId, senderId, content, messageType = 'text', fileUrl = null, fileName = null }) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    });

    if (!conversation) {
        throw new Error('Conversación no encontrada');
    }

    if (conversation.adminId !== senderId && conversation.studentId !== senderId) {
        throw new Error('No tienes permiso para enviar mensajes en esta conversación');
    }

    const message = await prisma.directMessage.create({
        data: {
            conversationId,
            senderId,
            content: content || '',
            messageType,
            fileUrl,
            fileName,
        },
        include: {
            sender: { select: { id: true, fullName: true, username: true, role: true } },
        },
    });

    await prisma.conversation.update({
        where: { id: conversationId },
        data: {
            lastMessage: messageType === 'text' ? content.substring(0, 100) : `📎 ${messageType === 'image' ? 'Imagen' : 'Archivo'}`,
            lastMessageAt: new Date(),
        },
    });

    return {
        id: message.id,
        content: message.content,
        messageType: message.messageType,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        isRead: false,
        createdAt: message.createdAt,
        sender: {
            id: message.sender.id,
            name: message.sender.fullName || message.sender.username,
            role: message.sender.role,
        },
    };
}

/**
 * Obtener mensajes de una conversación y marcar como leídos
 */
export async function getMessages(conversationId, userId, { page = 1, limit = 50 } = {}) {
    const conversation = await prisma.conversation.findUnique({
        where: { id: conversationId },
    });

    if (!conversation) throw new Error('Conversación no encontrada');
    if (conversation.adminId !== userId && conversation.studentId !== userId) {
        throw new Error('No tienes acceso a esta conversación');
    }

    const messages = await prisma.directMessage.findMany({
        where: { conversationId },
        include: {
            sender: { select: { id: true, fullName: true, username: true, role: true } },
        },
        orderBy: { createdAt: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
    });

    // Marcar como leídos los del otro usuario
    await prisma.directMessage.updateMany({
        where: {
            conversationId,
            senderId: { not: userId },
            isRead: false,
        },
        data: { isRead: true },
    });

    return messages.map(m => ({
        id: m.id,
        content: m.content,
        messageType: m.messageType,
        fileUrl: m.fileUrl,
        fileName: m.fileName,
        isRead: m.isRead,
        isOwn: m.senderId === userId,
        createdAt: m.createdAt,
        sender: {
            id: m.sender.id,
            name: m.sender.fullName || m.sender.username,
            role: m.sender.role,
        },
    }));
}
