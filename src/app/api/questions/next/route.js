import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';
import { getNextQuestion } from '@/lib/agents/adaptive';

export async function GET(req) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const url = new URL(req.url);
        const studyPlanWeek = url.searchParams.get('studyPlanWeek') ? parseInt(url.searchParams.get('studyPlanWeek')) : null;
        const diagnosticId = url.searchParams.get('diagnosticId');

        const question = await getNextQuestion(session.user.id, null, studyPlanWeek, diagnosticId);

        if (!question) {
            return NextResponse.json({ question: null });
        }

        return NextResponse.json({
            question: {
                id: question.id,
                content: question.content,
                topic: question.topic?.name,
                difficulty: question.difficultyLevel,
            },
        });
    } catch (error) {
        console.error('Error getting next question:', error);
        return NextResponse.json({ error: 'Error interno' }, { status: 500 });
    }
}
