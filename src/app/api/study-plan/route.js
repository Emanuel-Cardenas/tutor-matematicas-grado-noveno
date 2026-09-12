import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import prisma from '@/lib/db';

/**
 * Convierte temasPorPrioridad del diagnóstico en 8 semanas estructuradas.
 * Prioridad: alta → media → baja. Distribuye temas equilibradamente.
 */
function buildWeeksFromRecommendations(recommendations) {
    const alta = (recommendations?.temasPorPrioridad?.alta || []);
    const media = (recommendations?.temasPorPrioridad?.media || []);
    const baja = (recommendations?.temasPorPrioridad?.baja || []);
    const estrategia = recommendations?.estrategia || [];
    const planDeEstudio = recommendations?.planDeEstudio || {};

    // Aplanar todos los temas en orden de prioridad
    const allTopics = [
        ...alta.map(t => ({ ...t, prioridad: 'alta' })),
        ...media.map(t => ({ ...t, prioridad: 'media' })),
        ...baja.map(t => ({ ...t, prioridad: 'baja' })),
    ];

    const weeks = [];
    const totalWeeks = 8;
    const topicsPerWeek = Math.max(1, Math.ceil(allTopics.length / totalWeeks));

    for (let w = 1; w <= totalWeeks; w++) {
        const startIdx = (w - 1) * topicsPerWeek;
        const endIdx = startIdx + topicsPerWeek;
        const weekTopics = allTopics.slice(startIdx, endIdx);

        // Usar estrategia semanal si existe para esa semana
        const estrategiaIndex = w - 1;
        const estrategiaWeek = estrategia[estrategiaIndex] || null;

        // Construir descripción de la semana
        let weekTitle;
        let weekFocus;

        if (weekTopics.length === 0) {
            // Semanas de repaso si no hay temas nuevos
            weekTitle = `Semana ${w} — Repaso y Consolidación`;
            weekFocus = 'Repaso integral y ejercicios mixtos de todos los temas anteriores.';
        } else {
            const prioridadLabel = weekTopics[0]?.prioridad === 'alta'
                ? '🔴 Alta Prioridad'
                : weekTopics[0]?.prioridad === 'media'
                ? '🟡 Nivelación'
                : '🟢 Enriquecimiento';

            weekTitle = `Semana ${w} — ${weekTopics.map(t => t.tema).join(' & ')}`;
            weekFocus = estrategiaWeek || weekTopics.map(t => t.tema).join(', ');
        }

        // Recopilar ejercicios específicos de los temas de esa semana
        const ejercicios = weekTopics.flatMap(t =>
            (t.ejerciciosRecomendados || []).map(ej => ({
                enunciado: ej,
                tema: t.tema,
                tiempoEstimado: t.tiempoEstimado || '30 min',
                senalExito: t.senalExito || null,
            }))
        );

        // Meta de la semana
        const metaSemana = weekTopics.length > 0
            ? weekTopics.map(t => t.senalExito).filter(Boolean).join(' | ') ||
              `Dominar: ${weekTopics.map(t => t.tema).join(', ')}`
            : 'Repaso y consolidación de conceptos previos';

        weeks.push({
            weekNumber: w,
            title: weekTitle,
            focus: weekFocus,
            topics: weekTopics,
            ejercicios,
            metaSemana,
            duracionEstimada: weekTopics[0]?.tiempoEstimado || '2-3 sesiones',
            prioridad: weekTopics[0]?.prioridad || 'media',
        });
    }

    return {
        weeks,
        planDeEstudio,
        consejos: recommendations?.consejos || [],
        mensajeFinal: recommendations?.mensajeFinal || '',
        metodologiaEstudio: recommendations?.metodologiaEstudio || null,
    };
}

// ═══════════════════════════════════
// GET — Obtener plan de estudio completo con progreso
// ═══════════════════════════════════
export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const userId = session.user.id;

        // 1. Buscar último diagnóstico completado
        const diagnostic = await prisma.diagnosticResult.findFirst({
            where: { userId },
            orderBy: { completedAt: 'desc' },
        });

        if (!diagnostic) {
            return NextResponse.json({
                hasDiagnostic: false,
                message: 'Necesitas completar el diagnóstico primero para activar tu plan de estudio.',
            });
        }

        // 2. Parsear recomendaciones del diagnóstico
        const recommendations = diagnostic.aiRecommendations
            ? JSON.parse(diagnostic.aiRecommendations)
            : null;

        if (!recommendations || !recommendations.temasPorPrioridad) {
            return NextResponse.json({
                hasDiagnostic: true,
                hasPlan: false,
                message: 'El diagnóstico no contiene un plan de estudio. Repite el diagnóstico para generarlo.',
                diagnosticId: diagnostic.id,
            });
        }

        // 3. Construir estructura de 8 semanas
        const planData = buildWeeksFromRecommendations(recommendations);

        // 4. Obtener o inicializar progreso del estudiante
        let progressRecords = await prisma.studyPlanProgress.findMany({
            where: { userId, diagnosticId: diagnostic.id },
            orderBy: { weekNumber: 'asc' },
        });

        // Si no existe progreso aún, crear registros para las 8 semanas
        if (progressRecords.length === 0) {
            const creates = planData.weeks.map((w, i) =>
                prisma.studyPlanProgress.create({
                    data: {
                        userId,
                        diagnosticId: diagnostic.id,
                        weekNumber: w.weekNumber,
                        isUnlocked: i === 0, // Solo semana 1 desbloqueada al inicio
                        isCompleted: false,
                        exercisesDone: 0,
                        exercisesGoal: 3,
                        topicsData: JSON.stringify(w.topics),
                    },
                })
            );
            progressRecords = await Promise.all(creates);
        }

        // 5. Combinar datos del plan con progreso
        const weeksWithProgress = planData.weeks.map(week => {
            const progress = progressRecords.find(p => p.weekNumber === week.weekNumber);
            return {
                ...week,
                isUnlocked: progress?.isUnlocked ?? (week.weekNumber === 1),
                isCompleted: progress?.isCompleted ?? false,
                exercisesDone: progress?.exercisesDone ?? 0,
                exercisesGoal: progress?.exercisesGoal ?? 3,
                startedAt: progress?.startedAt ?? null,
                completedAt: progress?.completedAt ?? null,
                progressId: progress?.id ?? null,
            };
        });

        // 6. Calcular semana activa (primera desbloqueada y no completada)
        const activeWeek = weeksWithProgress.find(w => w.isUnlocked && !w.isCompleted)?.weekNumber
            || weeksWithProgress.filter(w => w.isCompleted).length + 1;

        const totalCompleted = weeksWithProgress.filter(w => w.isCompleted).length;
        const overallProgress = Math.round((totalCompleted / 8) * 100);

        return NextResponse.json({
            hasDiagnostic: true,
            hasPlan: true,
            diagnosticId: diagnostic.id,
            schoolGrade: diagnostic.schoolGrade,
            weeks: weeksWithProgress,
            activeWeek: Math.min(activeWeek, 8),
            totalCompleted,
            overallProgress,
            planDeEstudio: planData.planDeEstudio,
            consejos: planData.consejos,
            mensajeFinal: planData.mensajeFinal,
            metodologiaEstudio: planData.metodologiaEstudio,
        });

    } catch (error) {
        console.error('[STUDY-PLAN GET] Error:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}

// ═══════════════════════════════════
// POST — Acciones sobre el plan de estudio
// ═══════════════════════════════════
export async function POST(request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
        }

        const userId = session.user.id;
        const body = await request.json();
        const { action, weekNumber, diagnosticId } = body;

        if (!action) {
            return NextResponse.json({ error: 'Acción requerida' }, { status: 400 });
        }

        // ── Acción: Iniciar una semana ──
        if (action === 'startWeek') {
            if (!weekNumber || !diagnosticId) {
                return NextResponse.json({ error: 'weekNumber y diagnosticId requeridos' }, { status: 400 });
            }

            const progress = await prisma.studyPlanProgress.findFirst({
                where: { userId, diagnosticId, weekNumber },
            });

            if (!progress) {
                return NextResponse.json({ error: 'Semana no encontrada' }, { status: 404 });
            }

            if (!progress.isUnlocked) {
                return NextResponse.json({ error: 'Esta semana aún está bloqueada' }, { status: 403 });
            }

            // Marcar como iniciada si no lo estaba
            if (!progress.startedAt) {
                await prisma.studyPlanProgress.update({
                    where: { id: progress.id },
                    data: { startedAt: new Date() },
                });
            }

            return NextResponse.json({ success: true, message: `Semana ${weekNumber} iniciada` });
        }

        // ── Acción: Registrar ejercicio correcto ──
        if (action === 'recordExercise') {
            if (!weekNumber || !diagnosticId) {
                return NextResponse.json({ error: 'weekNumber y diagnosticId requeridos' }, { status: 400 });
            }

            const progress = await prisma.studyPlanProgress.findFirst({
                where: { userId, diagnosticId, weekNumber },
            });

            if (!progress) {
                return NextResponse.json({ error: 'Semana no encontrada' }, { status: 404 });
            }

            if (!progress.isUnlocked) {
                return NextResponse.json({ error: 'Esta semana está bloqueada' }, { status: 403 });
            }

            if (progress.isCompleted) {
                return NextResponse.json({ success: true, alreadyCompleted: true, message: 'Semana ya completada' });
            }

            const newDone = progress.exercisesDone + 1;
            const nowCompleted = newDone >= progress.exercisesGoal;
            let weekUnlocked = null;

            // Actualizar progreso de la semana actual
            await prisma.studyPlanProgress.update({
                where: { id: progress.id },
                data: {
                    exercisesDone: newDone,
                    isCompleted: nowCompleted,
                    startedAt: progress.startedAt || new Date(),
                    completedAt: nowCompleted ? new Date() : null,
                },
            });

            // Si se completó la semana, desbloquear la siguiente
            if (nowCompleted && weekNumber < 8) {
                const nextWeek = await prisma.studyPlanProgress.findFirst({
                    where: { userId, diagnosticId, weekNumber: weekNumber + 1 },
                });

                if (nextWeek && !nextWeek.isUnlocked) {
                    await prisma.studyPlanProgress.update({
                        where: { id: nextWeek.id },
                        data: { isUnlocked: true },
                    });
                    weekUnlocked = weekNumber + 1;
                }
            }

            return NextResponse.json({
                success: true,
                exercisesDone: newDone,
                exercisesGoal: progress.exercisesGoal,
                weekCompleted: nowCompleted,
                weekUnlocked,
                message: nowCompleted
                    ? `🎉 ¡Semana ${weekNumber} completada! ${weekUnlocked ? `Se desbloqueó la Semana ${weekUnlocked}` : 'Has completado el plan.'}`
                    : `Ejercicio registrado: ${newDone}/${progress.exercisesGoal}`,
            });
        }

        // ── Acción: Resetear plan (para nuevo diagnóstico) ──
        if (action === 'resetPlan') {
            if (!diagnosticId) {
                return NextResponse.json({ error: 'diagnosticId requerido' }, { status: 400 });
            }

            await prisma.studyPlanProgress.deleteMany({
                where: { userId, diagnosticId },
            });

            return NextResponse.json({ success: true, message: 'Plan reseteado' });
        }

        return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });

    } catch (error) {
        console.error('[STUDY-PLAN POST] Error:', error);
        return NextResponse.json({ error: 'Error interno: ' + error.message }, { status: 500 });
    }
}
