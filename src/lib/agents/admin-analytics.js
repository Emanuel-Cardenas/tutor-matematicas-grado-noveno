// Agente de Analitica para Admin Panel
// Calcula metricas avanzadas a partir de los datos de diagnosticos

export function adminAnalyticsAgent(diagnosticResults) {
    if (!diagnosticResults || diagnosticResults.length === 0) {
        return {
            totalDiagnosticos: 0,
            promedioGeneral: 0,
            distribucionPorGrado: {},
            erroresMasComunes: [],
            tiempoPromedio: 0,
            preguntasMasFalladas: [],
            distribucionDificultad: { facil: 0, media: 0, dificil: 0 },
        };
    }

    // Promedio general
    const totalScore = diagnosticResults.reduce((sum, d) => sum + (d.score || 0), 0);
    const totalQuestions = diagnosticResults.reduce((sum, d) => sum + (d.totalQuestions || 0), 0);
    const promedioGeneral = totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : 0;

    // Distribucion por grado
    const distribucionPorGrado = {};
    diagnosticResults.forEach(d => {
        const grade = d.schoolGrade || 'Sin grado';
        if (!distribucionPorGrado[grade]) {
            distribucionPorGrado[grade] = { count: 0, totalScore: 0, totalQuestions: 0 };
        }
        distribucionPorGrado[grade].count++;
        distribucionPorGrado[grade].totalScore += d.score || 0;
        distribucionPorGrado[grade].totalQuestions += d.totalQuestions || 0;
    });

    // Calcular promedio por grado
    Object.keys(distribucionPorGrado).forEach(grade => {
        const g = distribucionPorGrado[grade];
        g.promedio = g.totalQuestions > 0 ? Math.round((g.totalScore / g.totalQuestions) * 100) : 0;
    });

    // Errores mas comunes (de los answers)
    const errorCounts = {};
    const topicErrorCounts = {};
    const difficultyErrorCounts = { facil: 0, media: 0, dificil: 0 };
    let totalTimeMs = 0;
    let timeCount = 0;
    const questionFailCounts = {};

    diagnosticResults.forEach(d => {
        if (d.answers) {
            d.answers.forEach(a => {
                // Tiempo promedio
                if (a.timeSpentMs > 0) {
                    totalTimeMs += a.timeSpentMs;
                    timeCount++;
                }

                if (!a.isCorrect) {
                    // Errores por tema
                    const topic = a.topic || 'General';
                    topicErrorCounts[topic] = (topicErrorCounts[topic] || 0) + 1;

                    // Errores por dificultad
                    const diff = (a.difficulty || 'media').toLowerCase();
                    if (difficultyErrorCounts[diff] !== undefined) {
                        difficultyErrorCounts[diff]++;
                    }

                    // Preguntas mas falladas
                    const qKey = a.questionText?.substring(0, 80) || `Pregunta ${a.questionIndex}`;
                    questionFailCounts[qKey] = (questionFailCounts[qKey] || 0) + 1;
                }
            });
        }

        // Analisis de IA
        if (d.aiAnalysis) {
            try {
                const analysis = JSON.parse(d.aiAnalysis);
                if (analysis.patrones) {
                    analysis.patrones.forEach(p => {
                        errorCounts[p.patron] = (errorCounts[p.patron] || 0) + (p.frecuencia || 1);
                    });
                }
            } catch { }
        }
    });

    // Top errores por tema
    const erroresMasComunes = Object.entries(topicErrorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([tema, count]) => ({ tema, count }));

    // Preguntas mas falladas
    const preguntasMasFalladas = Object.entries(questionFailCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([pregunta, count]) => ({ pregunta, count }));

    // Patrones de error globales
    const patronesGlobales = Object.entries(errorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([patron, count]) => ({ patron, count }));

    return {
        totalDiagnosticos: diagnosticResults.length,
        promedioGeneral,
        distribucionPorGrado,
        erroresMasComunes,
        tiempoPromedio: timeCount > 0 ? Math.round(totalTimeMs / timeCount) : 0,
        preguntasMasFalladas,
        distribucionDificultad: difficultyErrorCounts,
        patronesGlobales,
    };
}
