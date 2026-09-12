import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import prisma from '@/lib/db';

export async function POST(req) {
  try {
    const session = await getServerSession();
    // Guard clause without crashing if authOptions requires it
    if (!session || !session.user || !session.user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { theme } = await req.json();
    
    await prisma.user.update({
      where: { email: session.user.email },
      data: { themePreference: theme }
    });

    return NextResponse.json({ success: true, theme });
  } catch (error) {
    console.error('Error updating theme preference:', error);
    // Return gracefully so the frontend component doesn't crash on theme toggle
    return NextResponse.json({ success: false, error: 'Internal server error or session unconfigured' }, { status: 200 });
  }
}
