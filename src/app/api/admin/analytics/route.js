import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { adminAnalyticsAgent } from '@/lib/agents/admin-analytics';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAdminAuth(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;
    return Boolean(ADMIN_PASSWORD) && authHeader.replace('Bearer ', '') === ADMIN_PASSWORD;
}

export async function GET(request) {
    if (!checkAdminAuth(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const diagnostics = await prisma.diagnosticResult.findMany({
            include: {
                answers: true,
                user: {
                    select: { username: true, fullName: true, schoolGrade: true },
                },
            },
            orderBy: { completedAt: 'desc' },
        });

        const analytics = adminAnalyticsAgent(diagnostics);

        return NextResponse.json({ success: true, analytics });
    } catch (error) {
        console.error('Admin analytics error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
