import { callGemini } from '../gemini';
import { SOCRATIC_TUTOR_PROMPT, buildSocraticContext } from '../prompts';

export async function socraticTutorAgent({
    studentMessage,
    studentLevel,
    currentTopic,
    currentQuestion,
    correctAnswer,
    conversationHistory,
    attemptNumber,
    studentProfile,
    lastSessionSummary,
    topicMasteryInfo,
    evaluationResult,
    studyPlanContext = null, // contexto del plan de estudio (opcional)
}) {
    const contextBlock = buildSocraticContext({
        studentLevel,
        currentTopic,
        currentQuestion: currentQuestion || 'Sin pregunta activa',
        correctAnswer: correctAnswer || 'N/A',
        conversationHistory: conversationHistory
            .slice(-10)
            .map(m => `${m.role}: ${m.content}`)
            .join('\n'),
        attemptNumber: attemptNumber || 1,
        studentProfile,
        lastSessionSummary,
        topicMasteryInfo,
        evaluationResult,
    });

    // Incluir contexto del plan de estudio si está activo
    const planContext = studyPlanContext || '';
    const fullPrompt = SOCRATIC_TUTOR_PROMPT + '\n\n' + contextBlock + planContext;

    const history = conversationHistory.slice(-8).map(m => ({
        role: m.role === 'student' ? 'user' : 'model',
        content: m.content,
    }));

    const response = await callGemini(fullPrompt, studentMessage, history);
    return response;
}
