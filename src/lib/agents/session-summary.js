// Agente de Resumen de Sesión — Genera resumen con IA al cerrar sesión (Capa 2)
import { callGemini } from '../gemini';
import prisma from '../db';

const SESSION_SUMMARY_PROMPT = [
    "Eres un analista educativo. Tu trabajo es crear un resumen conciso de la sesión de tutoría de un estudiante.",
    "",
    "INSTRUCCIONES:",
    "1. Analiza las interacciones de la sesión proporcionada.",
    "2. Genera un resumen en ESPAÑOL de máximo 200 palabras que incluya:",
    "   - Qué temas se trabajaron",
    "   - Qué errores cometió el estudiante y en qué conceptos",
    "   - Qué estrategias o explicaciones parecieron funcionar mejor",
    "   - Nivel emocional observado (frustración, confianza, motivación)",
    "   - Recomendación clave para la siguiente sesión",
    "",
    "3. Escribe en tercera persona, como si fuera un informe breve para el tutor.",
    "4. Sé específico con los conceptos matemáticos mencionados.",
    "5. NO uses formato markdown, solo texto plano.",
].join("\n");

/**
 * Genera un resumen de sesión usando IA y lo guarda en el StudentProfile.
 * Se llama al cerrar una sesión.
 */
export async function sessionSummaryAgent(sessionId, userId) {
    try {
        // Obtener la sesión con sus interacciones
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: {
                interactions: {
                    orderBy: { createdAt: 'asc' },
                    include: {
                        question: {
                            include: { topic: true },
                        },
                    },
                },
            },
        });

        if (!session || session.interactions.length === 0) return null;

        // Construir contexto de la sesión para la IA
        const interactionsSummary = session.interactions.map((inter, idx) => {
            const topicName = inter.question?.topic?.name || 'General';
            const correct = inter.isCorrect === true ? '✓ Correcto' : inter.isCorrect === false ? '✗ Incorrecto' : '? Sin evaluar';
            const errorInfo = inter.errorType ? ` (Error: ${inter.errorType})` : '';
            const timeInfo = inter.timeSpentSeconds ? ` [${inter.timeSpentSeconds}s]` : '';

            return `${idx + 1}. [${topicName}] ${correct}${errorInfo}${timeInfo}\n   Estudiante: "${inter.studentMessage.substring(0, 100)}"\n   Tutor: "${inter.tutorResponse.substring(0, 100)}"`;
        }).join('\n\n');

        const sessionContext = [
            `Duración de la sesión: ${session.startedAt} a ${session.endedAt || 'en curso'}`,
            `Total de interacciones: ${session.interactions.length}`,
            `Preguntas correctas: ${session.questionsCorrect} de ${session.questionsAttempted}`,
            `Precisión: ${session.accuracyRate ? Math.round(session.accuracyRate * 100) + '%' : 'N/A'}`,
            '',
            'INTERACCIONES:',
            interactionsSummary,
        ].join('\n');

        // Generar resumen con IA
        const summary = await callGemini(
            SESSION_SUMMARY_PROMPT,
            sessionContext,
            []
        );

        if (!summary) return null;

        // Guardar resumen en el perfil del estudiante
        await prisma.studentProfile.upsert({
            where: { userId },
            update: {
                lastSessionSummary: summary,
                totalSessionsCompleted: { increment: 1 },
            },
            create: {
                userId,
                lastSessionSummary: summary,
                totalSessionsCompleted: 1,
            },
        });

        // También guardar en la sesión misma
        await prisma.session.update({
            where: { id: sessionId },
            data: { summary },
        });

        return summary;

    } catch (error) {
        console.error('Session Summary Agent error:', error);
        // No romper el flujo principal si falla el resumen
        return null;
    }
}
