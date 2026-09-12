import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import prisma from '@/lib/db';

export const authOptions = {
    providers: [
        CredentialsProvider({
            name: 'Credentials',
            credentials: {
                username: { label: 'Usuario', type: 'text' },
                password: { label: 'Contraseña', type: 'password' },
            },
            async authorize(credentials) {
                if (!credentials?.username || !credentials?.password) {
                    return null;
                }

                try {
                    const trimmedUsername = credentials.username.trim();
                    const user = await prisma.user.findUnique({
                        where: { username: trimmedUsername },
                    });

                    if (!user) {
                        console.log('[AUTH] User not found:', trimmedUsername);
                        return null;
                    }

                    // Verificar contraseña
                    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);

                    if (!isValid) {
                        console.log('[AUTH] Invalid password for:', credentials.username);
                        return null;
                    }

                    console.log('[AUTH] Login successful:', credentials.username);

                    // Actualizar último login
                    await prisma.user.update({
                        where: { id: user.id },
                        data: { lastLogin: new Date() },
                    });

                    return {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        name: user.fullName || user.username,
                        role: user.role || 'student',
                        currentLevel: user.currentLevel,
                        schoolGrade: user.schoolGrade,
                    };
                } catch (error) {
                    console.error('[AUTH] Error:', error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.username = user.username;
                token.role = user.role || 'student';
                token.currentLevel = user.currentLevel;
                token.schoolGrade = user.schoolGrade;
            }

            // Siempre refrescar el nivel desde la DB para reflejar cambios del agente adaptativo
            if (token.id) {
                try {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: token.id },
                        select: { currentLevel: true, schoolGrade: true, role: true },
                    });
                    if (dbUser) {
                        token.currentLevel = dbUser.currentLevel;
                        token.schoolGrade = dbUser.schoolGrade;
                        token.role = dbUser.role || 'student';
                    }
                } catch (e) {
                    // Si falla la consulta, mantener el valor del token
                    console.error('[AUTH] Error refreshing level:', e.message);
                }
            }

            return token;
        },
        async session({ session, token }) {
            if (token) {
                session.user.id = token.id;
                session.user.username = token.username;
                session.user.role = token.role || 'student';
                session.user.currentLevel = token.currentLevel;
                session.user.schoolGrade = token.schoolGrade;
            }
            return session;
        },
    },
    pages: {
        signIn: '/login',
    },
    session: {
        strategy: 'jwt',
    },
    secret: process.env.NEXTAUTH_SECRET,
    debug: true,
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
