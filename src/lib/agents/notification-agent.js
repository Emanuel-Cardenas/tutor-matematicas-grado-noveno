/**
 * 🔔 Notification Agent — Sistema de Notificaciones In-App
 * 
 * Funcionalidades:
 * - Conteo de mensajes no leídos (existente)
 * - Creación de notificaciones in-app
 * - Notificaciones por eventos del sistema (badges, exámenes, mensajes)
 * - Obtener notificaciones del usuario
 * - Marcar como leídas
 */

import prisma from '@/lib/db';

// ═══════════════════════════════════════
// TIPOS DE NOTIFICACIÓN
// ═══════════════════════════════════════
const NOTIFICATION_TYPES = {
    badge_earned: {
        icon: '🏆',
        color: '#ffd700',
        priority: 'high',
    },
    level_up: {
        icon: '⬆️',
        color: '#22c55e',
        priority: 'high',
    },
    exam_completed: {
        icon: '📋',
        color: '#3b82f6',
        priority: 'medium',
    },
    new_message: {
        icon: '💬',
        color: '#ff6900',
        priority: 'medium',
    },
    streak_milestone: {
        icon: '🔥',
        color: '#ef4444',
        priority: 'medium',
    },
    daily_reminder: {
        icon: '📅',
        color: '#8b5cf6',
        priority: 'low',
    },
    review_needed: {
        icon: '📖',
        color: '#f59e0b',
        priority: 'medium',
    },
    teacher_content: {
        icon: '📄',
        color: '#06b6d4',
        priority: 'medium',
    },
    system: {
        icon: 'ℹ️',
        color: '#6b7280',
        priority: 'low',
    },
};

/**
 * Obtener conteo de mensajes no leídos (EXISTENTE — sin cambios)
 */
export async function getUnreadCount(userId, userRole) {
    const conversations = await prisma.conversation.findMany({
        where: userRole === 'admin'
            ? { adminId: userId }
            : { studentId: userId },
        select: { id: true },
    });

    const conversationIds = conversations.map(c => c.id);
    if (conversationIds.length === 0) return { total: 0, byConversation: [] };

    const unreadMessages = await prisma.directMessage.groupBy({
        by: ['conversationId'],
        where: {
            conversationId: { in: conversationIds },
            senderId: { not: userId },
            isRead: false,
        },
        _count: { id: true },
    });

    return {
        total: unreadMessages.reduce((sum, g) => sum + g._count.id, 0),
        byConversation: unreadMessages.map(g => ({
            conversationId: g.conversationId,
            count: g._count.id,
        })),
    };
}

/**
 * Crea una notificación in-app para un usuario.
 *
 * @param {string} userId — ID del usuario destinatario
 * @param {string} type — tipo de notificación (ver NOTIFICATION_TYPES)
 * @param {string} title — título corto de la notificación
 * @param {string} message — mensaje descriptivo
 * @param {object} metadata — datos adicionales opcionales
 * @returns {object|null} — notificación creada o null si falla
 */
export async function createNotification(userId, type, title, message, metadata = {}) {
    try {
        const config = NOTIFICATION_TYPES[type] || NOTIFICATION_TYPES.system;

        // Guardar en la tabla de perfil como JSON (sin esquema adicional)
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) return null;

        const notifications = safeParseJSON(profile.notificationsData, []);

        const notification = {
            id: generateId(),
            type,
            icon: config.icon,
            color: config.color,
            priority: config.priority,
            title,
            message,
            metadata,
            isRead: false,
            createdAt: new Date().toISOString(),
        };

        // Agregar al inicio (más reciente primero)
        notifications.unshift(notification);

        // Limitar a 50 notificaciones
        const trimmed = notifications.slice(0, 50);

        await prisma.studentProfile.update({
            where: { userId },
            data: {
                notificationsData: JSON.stringify(trimmed),
            },
        });

        console.log(`[NOTIFICATION] 🔔 ${config.icon} → ${userId}: "${title}"`);
        return notification;

    } catch (error) {
        console.error('[NOTIFICATION] Error creating notification:', error);
        return null;
    }
}

/**
 * Obtiene las notificaciones no leídas de un usuario.
 *
 * @param {string} userId
 * @param {number} limit — máximo de notificaciones a retornar
 * @returns {Promise<object[]>}
 */
export async function getNotifications(userId, limit = 20) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });

        if (!profile) return [];

        const notifications = safeParseJSON(profile.notificationsData, []);
        return notifications.slice(0, limit);

    } catch (error) {
        console.error('[NOTIFICATION] Error getting notifications:', error);
        return [];
    }
}

/**
 * Obtiene solo la CUENTA de notificaciones no leídas.
 */
export async function getUnreadNotificationCount(userId) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });
        if (!profile) return 0;

        const notifications = safeParseJSON(profile.notificationsData, []);
        return notifications.filter(n => !n.isRead).length;

    } catch (error) {
        return 0;
    }
}

/**
 * Marca una o todas las notificaciones como leídas.
 *
 * @param {string} userId
 * @param {string|null} notificationId — ID específico, o null para todas
 */
export async function markNotificationsRead(userId, notificationId = null) {
    try {
        const profile = await prisma.studentProfile.findUnique({
            where: { userId },
        });
        if (!profile) return;

        const notifications = safeParseJSON(profile.notificationsData, []);

        for (const n of notifications) {
            if (notificationId === null || n.id === notificationId) {
                n.isRead = true;
            }
        }

        await prisma.studentProfile.update({
            where: { userId },
            data: {
                notificationsData: JSON.stringify(notifications),
            },
        });

    } catch (error) {
        console.error('[NOTIFICATION] Error marking as read:', error);
    }
}

/**
 * Crea notificaciones automáticas para eventos comunes del sistema.
 * Se llama desde otros agentes (gamification, telemetry, etc.)
 */
export async function notifyBadgeEarned(userId, badge) {
    return createNotification(userId, 'badge_earned',
        `¡Badge desbloqueado: ${badge.name}!`,
        badge.description,
        { badgeId: badge.id, icon: badge.icon }
    );
}

export async function notifyLevelUp(userId, newRank) {
    return createNotification(userId, 'level_up',
        `¡Subiste a ${newRank.name}!`,
        `Tu nuevo rango es ${newRank.icon} ${newRank.name}. ¡Sigue así!`,
        { rank: newRank.name, icon: newRank.icon }
    );
}

export async function notifyExamCompleted(userId, score, total) {
    const percentage = Math.round((score / total) * 100);
    const emoji = percentage >= 80 ? '🎉' : percentage >= 60 ? '👍' : '💪';
    return createNotification(userId, 'exam_completed',
        `Examen completado: ${percentage}%`,
        `${emoji} Obtuviste ${score}/${total} respuestas correctas.`,
        { score, total, percentage }
    );
}

export async function notifyStreakMilestone(userId, days) {
    return createNotification(userId, 'streak_milestone',
        `🔥 ¡Racha de ${days} días!`,
        `Llevas ${days} días consecutivos estudiando. ¡Increíble!`,
        { days }
    );
}

export async function notifyReviewNeeded(userId, topics) {
    const topicNames = topics.map(t => t.topicName).slice(0, 3).join(', ');
    return createNotification(userId, 'review_needed',
        'Temas para repasar hoy',
        `${topicNames}${topics.length > 3 ? ` y ${topics.length - 3} más` : ''}`,
        { topicCount: topics.length }
    );
}

// ═══════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
}

function safeParseJSON(str, fallback) {
    if (!str) return fallback;
    try { return JSON.parse(str); }
    catch { return fallback; }
}

export { NOTIFICATION_TYPES };
