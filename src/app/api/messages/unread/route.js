import { NextResponse } from 'next/server';
import { getMessagingUser } from '@/lib/auth-helper';
import { getUnreadCount } from '@/lib/agents/notification-agent';

/**
 * GET /api/messages/unread
 */
export async function GET(request) {
    try {
        const user = await getMessagingUser(request);
        if (!user) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });

        const unread = await getUnreadCount(user.id, user.role);
        return NextResponse.json(unread);
    } catch (error) {
        console.error('[API] Error unread:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
