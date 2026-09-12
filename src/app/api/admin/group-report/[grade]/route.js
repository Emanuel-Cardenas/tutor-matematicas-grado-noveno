import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { groupReportAgent } from '@/lib/agents/group-report-agent';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function checkAdminAuth(request) {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;
    return Boolean(ADMIN_PASSWORD) && authHeader.replace('Bearer ', '') === ADMIN_PASSWORD;
}

function safeParseJSON(str) {
    if (!str) return null;
    try { return JSON.parse(str); } catch { return null; }
}

export async function GET(request, { params }) {
    if (!checkAdminAuth(request)) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    try {
        const { grade } = await params;
        const gradeNum = parseInt(grade, 10);

        if (isNaN(gradeNum) || gradeNum < 6 || gradeNum > 11) {
            return NextResponse.json({ error: 'Grado inválido. Debe ser entre 6 y 11.' }, { status: 400 });
        }

        // Obtener estudiantes del grado con todos sus datos
        const students = await prisma.user.findMany({
            where: { schoolGrade: gradeNum },
            select: {
                id: true,
                username: true,
                fullName: true,
                email: true,
                currentLevel: true,
                currentTopic: true,
                schoolGrade: true,
                createdAt: true,
                lastLogin: true,
                diagnosticResults: {
                    orderBy: { completedAt: 'desc' },
                    select: {
                        id: true,
                        score: true,
                        totalQuestions: true,
                        assignedLevel: true,
                        schoolGrade: true,
                        totalTimeMs: true,
                        aiAnalysis: true,
                        aiDiagnosis: true,
                        aiRecommendations: true,
                        completedAt: true,
                        answers: true,
                    },
                },
                sessions: {
                    include: {
                        interactions: {
                            select: {
                                isCorrect: true,
                                timeSpentSeconds: true,
                                errorType: true,
                                difficultyAtTime: true,
                            },
                        },
                    },
                },
                topicMasteries: true,
                studentProfile: {
                    select: {
                        weakTopics: true,
                        strongTopics: true,
                        commonErrorPatterns: true,
                        totalSessionsCompleted: true,
                        totalTimeMinutes: true,
                    },
                },
            },
        });

        if (students.length === 0) {
            return NextResponse.json({
                success: true,
                grade: gradeNum,
                totalStudents: 0,
                report: null,
                message: `No hay estudiantes registrados en el grado ${gradeNum}°`,
            });
        }

        // === MÉTRICAS GENERALES ===
        const totalStudents = students.length;
        
        // Sesiones y interacciones totales
        const allSessions = students.flatMap(s => s.sessions);
        const allInteractions = allSessions.flatMap(s => s.interactions);
        const totalSessions = allSessions.length;
        const totalInteractions = allInteractions.length;

        // Rendimiento promedio (% de aciertos)
        const evaluatedInteractions = allInteractions.filter(i => i.isCorrect !== null);
        const correctInteractions = evaluatedInteractions.filter(i => i.isCorrect === true);
        const rendimientoPromedio = evaluatedInteractions.length > 0
            ? Math.round((correctInteractions.length / evaluatedInteractions.length) * 100)
            : 0;

        // Tiempo promedio por pregunta (segundos)
        const timesSpent = allInteractions.filter(i => i.timeSpentSeconds > 0).map(i => i.timeSpentSeconds);
        const tiempoPromedio = timesSpent.length > 0
            ? Math.round(timesSpent.reduce((a, b) => a + b, 0) / timesSpent.length)
            : 0;

        // Nivel de dificultad promedio alcanzado
        const difficulties = allInteractions.filter(i => i.difficultyAtTime > 0).map(i => i.difficultyAtTime);
        const nivelDificultadPromedio = difficulties.length > 0
            ? parseFloat((difficulties.reduce((a, b) => a + b, 0) / difficulties.length).toFixed(1))
            : 0;

        // Nivel promedio de los estudiantes
        const nivelPromedio = parseFloat(
            (students.reduce((sum, s) => sum + (s.currentLevel || 1), 0) / totalStudents).toFixed(1)
        );

        // === DIAGNÓSTICOS ===
        const studentsWithDiag = students.filter(s => s.diagnosticResults.length > 0);
        const diagnosticosCompletados = studentsWithDiag.length;
        const diagnosticosPendientes = totalStudents - diagnosticosCompletados;

        // Score promedio de diagnósticos
        let diagnosticoScorePromedio = 0;
        if (studentsWithDiag.length > 0) {
            const diagScores = studentsWithDiag.map(s => {
                const latestDiag = s.diagnosticResults[0];
                return latestDiag.totalQuestions > 0
                    ? (latestDiag.score / latestDiag.totalQuestions) * 100
                    : 0;
            });
            diagnosticoScorePromedio = Math.round(
                diagScores.reduce((a, b) => a + b, 0) / diagScores.length
            );
        }

        // Nivel asignado promedio en diagnóstico
        let diagnosticoNivelPromedio = 0;
        if (studentsWithDiag.length > 0) {
            diagnosticoNivelPromedio = parseFloat(
                (studentsWithDiag.reduce((sum, s) => sum + (s.diagnosticResults[0]?.assignedLevel || 0), 0) / studentsWithDiag.length).toFixed(1)
            );
        }

        // === DISTRIBUCIÓN DE ERRORES ===
        const errorTypes = {};
        allInteractions.forEach(i => {
            if (i.errorType && i.errorType !== 'none' && i.errorType !== 'diagnostic_error') {
                errorTypes[i.errorType] = (errorTypes[i.errorType] || 0) + 1;
            }
        });

        // Errores desde diagnósticos también
        const allDiagAnswers = students.flatMap(s =>
            s.diagnosticResults.flatMap(d => d.answers || [])
        );
        const erroresPorTemaGlobal = {};
        allDiagAnswers.forEach(a => {
            if (!a.isCorrect) {
                const topic = a.topic || 'General';
                erroresPorTemaGlobal[topic] = (erroresPorTemaGlobal[topic] || 0) + 1;
            }
        });

        // === PROGRESO POR TEMAS (TopicMastery) ===
        const allMasteries = students.flatMap(s => s.topicMasteries);
        const topicAggregation = {};
        allMasteries.forEach(m => {
            if (!topicAggregation[m.topicName]) {
                topicAggregation[m.topicName] = {
                    totalMastery: 0,
                    totalCorrect: 0,
                    totalQuestions: 0,
                    count: 0,
                    masteredCount: 0,
                };
            }
            topicAggregation[m.topicName].totalMastery += m.masteryLevel;
            topicAggregation[m.topicName].totalCorrect += m.questionsCorrect;
            topicAggregation[m.topicName].totalQuestions += m.questionsTotal;
            topicAggregation[m.topicName].count++;
            if (m.isMastered) topicAggregation[m.topicName].masteredCount++;
        });

        const progresoPorTemas = Object.entries(topicAggregation)
            .map(([topic, data]) => ({
                tema: topic,
                masteryPromedio: parseFloat((data.totalMastery / data.count).toFixed(2)),
                totalPreguntas: data.totalQuestions,
                totalCorrectas: data.totalCorrect,
                porcentajeAciertos: data.totalQuestions > 0
                    ? Math.round((data.totalCorrect / data.totalQuestions) * 100)
                    : 0,
                estudiantesQueLoDomin: data.masteredCount,
                estudiantesQueLoPracticaron: data.count,
            }))
            .sort((a, b) => b.masteryPromedio - a.masteryPromedio);

        // === FORTALEZAS Y DEBILIDADES ===
        const MASTERY_THRESHOLD_STRONG = 0.65;
        const MASTERY_THRESHOLD_WEAK = 0.35;

        const fortalezas = progresoPorTemas
            .filter(t => t.masteryPromedio >= MASTERY_THRESHOLD_STRONG)
            .slice(0, 5)
            .map(t => ({
                tema: t.tema,
                mastery: t.masteryPromedio,
                porcentajeAciertos: t.porcentajeAciertos,
            }));

        const debilidades = progresoPorTemas
            .filter(t => t.masteryPromedio < MASTERY_THRESHOLD_WEAK && t.totalPreguntas > 0)
            .sort((a, b) => a.masteryPromedio - b.masteryPromedio)
            .slice(0, 5)
            .map(t => ({
                tema: t.tema,
                mastery: t.masteryPromedio,
                porcentajeAciertos: t.porcentajeAciertos,
            }));

        // Si no hay data de mastery, usar profiles
        if (fortalezas.length === 0 && debilidades.length === 0) {
            const allStrongTopics = {};
            const allWeakTopics = {};
            students.forEach(s => {
                if (s.studentProfile) {
                    const strong = safeParseJSON(s.studentProfile.strongTopics) || [];
                    const weak = safeParseJSON(s.studentProfile.weakTopics) || [];
                    strong.forEach(t => { allStrongTopics[t] = (allStrongTopics[t] || 0) + 1; });
                    weak.forEach(t => { allWeakTopics[t] = (allWeakTopics[t] || 0) + 1; });
                }
            });

            Object.entries(allStrongTopics)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .forEach(([tema, count]) => {
                    fortalezas.push({ tema, mastery: null, mencionadoPor: count });
                });

            Object.entries(allWeakTopics)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .forEach(([tema, count]) => {
                    debilidades.push({ tema, mastery: null, mencionadoPor: count });
                });
        }

        // === ERRORES MÁS COMUNES POR TEMA (de diagnósticos) ===
        const erroresPorTema = Object.entries(erroresPorTemaGlobal)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 10)
            .map(([tema, count]) => ({ tema, errores: count }));

        // === DISTRIBUCIÓN POR DIFICULTAD EN DIAGNÓSTICO ===
        const distribucionDificultad = { facil: 0, media: 0, dificil: 0 };
        allDiagAnswers.forEach(a => {
            const diff = (a.difficulty || 'media').toLowerCase();
            if (distribucionDificultad[diff] !== undefined) {
                if (!a.isCorrect) distribucionDificultad[diff]++;
            }
        });

        // === LISTA DE ESTUDIANTES RESUMIDA ===
        const listaEstudiantes = students.map(s => {
            const latestDiag = s.diagnosticResults[0] || null;
            const studentInteractions = s.sessions.flatMap(ses => ses.interactions);
            const evaluated = studentInteractions.filter(i => i.isCorrect !== null);
            const correct = evaluated.filter(i => i.isCorrect === true);

            return {
                id: s.id,
                nombre: s.fullName || s.username,
                username: s.username,
                nivel: s.currentLevel,
                diagnosticoCompletado: !!latestDiag,
                diagnosticoScore: latestDiag
                    ? Math.round((latestDiag.score / latestDiag.totalQuestions) * 100)
                    : null,
                rendimiento: evaluated.length > 0
                    ? Math.round((correct.length / evaluated.length) * 100)
                    : null,
                totalSesiones: s.sessions.length,
                ultimoAcceso: s.lastLogin,
            };
        }).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        // === TIEMPO PROMEDIO DE DIAGNÓSTICO ===
        const diagTimes = allDiagAnswers.filter(a => a.timeSpentMs > 0).map(a => a.timeSpentMs);
        const tiempoPromedioDiagnostico = diagTimes.length > 0
            ? Math.round(diagTimes.reduce((a, b) => a + b, 0) / diagTimes.length)
            : 0;

        // === ANÁLISIS IA GRUPAL ===
        // Consolidar reportes individuales de diagnóstico para el agente IA
        let aiGroupReport = null;
        const individualReports = studentsWithDiag.map(s => {
            const diag = s.diagnosticResults[0];
            return {
                studentName: s.fullName || s.username,
                score: diag.score,
                totalQuestions: diag.totalQuestions,
                assignedLevel: diag.assignedLevel,
                aiAnalysis: safeParseJSON(diag.aiAnalysis),
                aiDiagnosis: safeParseJSON(diag.aiDiagnosis),
                aiRecommendations: safeParseJSON(diag.aiRecommendations),
            };
        }).filter(r => r.aiDiagnosis || r.aiAnalysis); // Solo incluir los que tienen datos IA

        if (individualReports.length > 0) {
            try {
                aiGroupReport = await groupReportAgent(individualReports, gradeNum);
            } catch (err) {
                console.error('Group AI agent error:', err);
                aiGroupReport = null;
            }
        }

        return NextResponse.json({
            success: true,
            grade: gradeNum,
            totalStudents,
            report: {
                // Métricas generales
                rendimientoPromedio,
                nivelPromedio,
                nivelDificultadPromedio,
                tiempoPromedio,
                totalSessions,
                totalInteractions,

                // Diagnósticos
                diagnosticos: {
                    completados: diagnosticosCompletados,
                    pendientes: diagnosticosPendientes,
                    scorePromedio: diagnosticoScorePromedio,
                    nivelPromedio: diagnosticoNivelPromedio,
                    tiempoPromedioMs: tiempoPromedioDiagnostico,
                },

                // Temas
                progresoPorTemas,
                fortalezas,
                debilidades,
                erroresPorTema,

                // Distribución de errores
                distribucionErrores: errorTypes,
                distribucionDificultad,

                // Lista de estudiantes
                estudiantes: listaEstudiantes,

                // Análisis IA del grupo
                aiGroupReport,
            },
        });
    } catch (error) {
        console.error('Group report error:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}
