import { buildAlerts, detectRapidGrowth } from "@/lib/maturation/analysis-helpers";
import { formatDate, formatNumber } from "@/lib/utils";
import type {
  AppState,
  Insight,
  InsightCategory,
  InsightSeverity,
  MaturationResult,
  MaturityBand,
  PerformanceEntry,
} from "@/lib/types";

type LocalizedText = {
  es: string;
  en: string;
};

type TrendItem = {
  id: string;
  title: string;
  description: string;
};

type RecommendationItem = {
  id: string;
  title: string;
  description: string;
  relatedInsightIds: string[];
};

type PerformanceIntelligenceSummary = {
  criticalAlerts: number;
  patternsDetected: number;
  athletesToMonitor: number;
  emergingTalents: number;
};

export type PerformanceIntelligenceResult = {
  insights: Insight[];
  summary: PerformanceIntelligenceSummary;
  trends: TrendItem[];
  recommendations: RecommendationItem[];
};

const severityPriority: Record<InsightSeverity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

const lowerIsBetterTokens = ["sprint", "agility", "illinois", "slalom", "time"];

function copy(locale: string, text: LocalizedText) {
  return locale === "es" ? text.es : text.en;
}

function clampConfidence(value: number) {
  return Math.max(0.55, Math.min(0.96, value));
}

function trendDirection(entry: PerformanceEntry) {
  const token = `${entry.testName} ${entry.unit}`.toLowerCase();
  if (entry.unit.toLowerCase() === "s") return -1;
  return lowerIsBetterTokens.some((candidate) => token.includes(candidate)) ? -1 : 1;
}

function normalisePerformanceChange(previous: PerformanceEntry, current: PerformanceEntry) {
  if (previous.value === 0) return 0;
  const rawChange = (current.value - previous.value) / Math.abs(previous.value);
  return rawChange * trendDirection(current);
}

function buildRiskRecommendation(locale: string, athleteName: string) {
  return copy(locale, {
    es: `Reducir impacto y revisar la planificación de ${athleteName} durante las próximas 1-2 semanas.`,
    en: `Reduce impact work and review ${athleteName}'s plan over the next 1-2 weeks.`,
  });
}

function buildPerformanceIntelligenceInsights(
  latestAssessments: MaturationResult[],
  allAssessments: MaturationResult[],
  state: AppState,
  locale: string,
): Insight[] {
  const insights: Insight[] = [];
  const latestByAthlete = new Map(latestAssessments.map((assessment) => [assessment.inputs.athleteId, assessment]));
  const athleteNames = new Map(latestAssessments.map((assessment) => [assessment.inputs.athleteName, assessment.inputs.athleteId]));
  const alerts = buildAlerts(latestAssessments);
  const rapidGrowthItems = detectRapidGrowth(allAssessments);

  // Pre-calculate training load ratios for all athletes to allow cross-checks
  const athleteLoadRatios = new Map<string, number>();
  latestAssessments.forEach((assessment) => {
    const athleteId = assessment.inputs.athleteId;
    const athleteLoad = state.trainingLoadEntries
      .filter((entry) => entry.athleteId === athleteId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (athleteLoad.length >= 8) {
      const recent = athleteLoad.slice(-4);
      const baseline = athleteLoad.slice(-8, -4);
      const recentAvg = recent.reduce((sum, entry) => sum + entry.load, 0) / recent.length;
      const baselineAvg = baseline.reduce((sum, entry) => sum + entry.load, 0) / baseline.length;
      const increaseRatio = baselineAvg > 0 ? recentAvg / baselineAvg : 1;
      athleteLoadRatios.set(athleteId, increaseRatio);
    }
  });

  // Group rapid growth alerts by athlete and keep only the most priority one
  const rapidGrowthByAthlete = new Map<string, typeof rapidGrowthItems[0][]>();
  rapidGrowthItems.forEach((item) => {
    const list = rapidGrowthByAthlete.get(item.athleteId) ?? [];
    list.push(item);
    rapidGrowthByAthlete.set(item.athleteId, list);
  });

  const dedupedRapidGrowthItems: typeof rapidGrowthItems = [];
  rapidGrowthByAthlete.forEach((items) => {
    // Sort:
    // 1. dateTo descending (latest first)
    // 2. hasElevatedLoad first (loadRatio >= 1.22)
    // 3. monthlyRate descending
    items.sort((a, b) => {
      const dateCompare = b.dateTo.localeCompare(a.dateTo);
      if (dateCompare !== 0) return dateCompare;

      const aLoad = (athleteLoadRatios.get(a.athleteId) ?? 1) >= 1.22;
      const bLoad = (athleteLoadRatios.get(b.athleteId) ?? 1) >= 1.22;
      if (aLoad !== bLoad) return bLoad ? 1 : -1;

      return b.monthlyRate - a.monthlyRate;
    });

    // Keep only the first one
    dedupedRapidGrowthItems.push(items[0]);
  });

  // 1. Process Alerts from Maturation Assessment (like invalid measurements)
  alerts.forEach((alert) => {
    const athleteId = athleteNames.get(alert.athleteName);
    const athlete = athleteId ? latestByAthlete.get(athleteId) : undefined;
    
    // Default to medium (Yellow/Seguimiento) and growth (Maturation)
    let severity: InsightSeverity = "medium";
    let category: InsightCategory = "growth";
    
    if (alert.severity === "critical") {
      severity = "critical"; // Red/Riesgo
    }
    
    if (alert.category === "highLoadRisk") {
      category = "load"; // Training Load area
    }

    insights.push({
      id: `alert-${alert.id}`,
      severity,
      category,
      athleteId,
      teamName: alert.teamName,
      title: copy(locale, {
        es: alert.category === "highLoadRisk"
          ? `${alert.athleteName}: Riesgo de sobrecarga en PHV`
          : `${alert.athleteName}: ${alert.message}`,
        en: `${alert.athleteName}: ${alert.message}`,
      }),
      description: copy(locale, {
        es: alert.category === "highLoadRisk"
          ? `El atleta se encuentra en el pico de crecimiento rápido (Mid-PHV). Se recomienda moderar las cargas de impacto.`
          : alert.detail ?? "La revisión de datos requiere atención del staff.",
        en: alert.detail ?? "This data issue needs staff review.",
      }),
      confidence: severity === "critical" ? 0.96 : 0.83,
      recommendation: alert.category === "highLoadRisk"
        ? copy(locale, {
            es: "Ajustar el volumen de saltos, aceleraciones rápidas y priorizar la recuperación neuromuscular.",
            en: "Adjust jumping volume, quick accelerations, and prioritize neuromuscular recovery.",
          })
        : athleteId && athlete
          ? buildRiskRecommendation(locale, athlete.inputs.athleteName)
          : undefined,
      createdAt: athlete?.inputs.dataCollectionDate ?? new Date().toISOString().slice(0, 10),
      sourceIds: [alert.id],
    });
  });

  // 2. Process Rapid Growth
  dedupedRapidGrowthItems.forEach((item) => {
    const loadRatio = athleteLoadRatios.get(item.athleteId) ?? 1;
    const hasElevatedLoad = loadRatio >= 1.22;
    
    // Intertwined Growth + Load
    const severity: InsightSeverity = hasElevatedLoad ? "critical" : "medium";

    insights.push({
      id: `growth-${item.id}`,
      severity,
      category: "growth", // Maturation
      athleteId: item.athleteId,
      teamName: item.teamName,
      title: copy(locale, {
        es: hasElevatedLoad
          ? `${item.athleteName}: crecimiento acelerado con carga elevada`
          : `${item.athleteName}: crecimiento acelerado detectado`,
        en: hasElevatedLoad
          ? `${item.athleteName}: Rapid growth with elevated load`
          : `${item.athleteName}: Accelerated growth detected`,
      }),
      description: copy(locale, {
        es: hasElevatedLoad
          ? `+${formatNumber(item.statureGain, 1)} cm en ${formatNumber(item.monthsBetween, 1)} meses (${formatNumber(item.monthlyRate, 2)} cm/mes) coincidiendo con un aumento de carga del ${Math.round((loadRatio - 1) * 100)}%.`
          : `+${formatNumber(item.statureGain, 1)} cm entre ${formatDate(item.dateFrom)} y ${formatDate(item.dateTo)} (${formatNumber(item.monthlyRate, 2)} cm/mes).`,
        en: hasElevatedLoad
          ? `+${formatNumber(item.statureGain, 1)} cm in ${formatNumber(item.monthsBetween, 1)} months (${formatNumber(item.monthlyRate, 2)} cm/month) with a ${Math.round((loadRatio - 1) * 100)}% load increase.`
          : `+${formatNumber(item.statureGain, 1)} cm between ${formatDate(item.dateFrom)} and ${formatDate(item.dateTo)} (${formatNumber(item.monthlyRate, 2)} cm/month).`,
      }),
      confidence: clampConfidence(0.78 + Math.min(item.monthlyRate / 10, 0.1)),
      recommendation: copy(locale, {
        es: hasElevatedLoad
          ? `Reducir de inmediato la carga excéntrica e impactos fuertes para proteger los cartílagos de crecimiento.`
          : `Monitorizar flexibilidad, rango de movimiento y reportar posibles molestias en tendones.`,
        en: hasElevatedLoad
          ? `Immediately reduce eccentric load and high impact exercises to protect growth plates.`
          : `Monitor flexibility, range of motion, and report potential tendon discomfort.`,
      }),
      createdAt: item.dateTo,
      sourceIds: [item.id],
    });
  });

  // 3. Process Individual Maturation status & training load & performance
  latestAssessments.forEach((assessment) => {
    const athleteId = assessment.inputs.athleteId;
    const athleteName = assessment.inputs.athleteName;
    const band = assessment.classification.maturityBand;
    const hasPHV = band === "Mid-PHV";

    // Growth peak window status (yellow/seguimiento in maturation)
    if (hasPHV) {
      insights.push({
        id: `phv-${athleteId}`,
        severity: "medium", // Yellow
        category: "growth", // Maturation
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, {
          es: `${athleteName}: Ventana PHV activa (Pico de Crecimiento)`,
          en: `${athleteName}: Active PHV window (Growth Spurt)`,
        }),
        description: copy(locale, {
          es: `El atleta está en banda ${band}. Etapa de máxima velocidad de crecimiento y cambios coordinativos rápidos.`,
          en: `The athlete is in the ${band} band. Peak growth velocity stage with fast coordination changes.`,
        }),
        confidence: 0.76,
        recommendation: copy(locale, {
          es: `Priorizar control de movimiento, técnica y estabilidad articular sobre carga de fuerza bruta.`,
          en: `Prioritize movement control, technique, and joint stability over raw strength training.`,
        }),
        createdAt: assessment.inputs.dataCollectionDate,
        sourceIds: [assessment.inputs.id],
      });
    }

    // Training load evaluation
    const increaseRatio = athleteLoadRatios.get(athleteId) ?? 1;
    if (increaseRatio >= 1.22) {
      // Intertwine Maturation + Load:
      // High load in Mid-PHV is Red (critical); otherwise normal high load is Red if >= 1.4, else Yellow (medium)
      const severity: InsightSeverity = (increaseRatio >= 1.4 || hasPHV) ? "critical" : "medium";

      insights.push({
        id: `load-${athleteId}`,
        severity,
        category: "load", // Carga
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, {
          es: hasPHV 
            ? `${athleteName}: Riesgo de sobrecarga en pico de crecimiento`
            : increaseRatio >= 1.4 
              ? `${athleteName}: Aumento excesivo de carga`
              : `${athleteName}: Carga reciente en aumento`,
          en: hasPHV 
            ? `${athleteName}: High load risk during growth peak`
            : increaseRatio >= 1.4 
              ? `${athleteName}: Excessive training load increase`
              : `${athleteName}: Rising recent load`,
        }),
        description: copy(locale, {
          es: hasPHV
            ? `La carga de las últimas 4 sesiones ha aumentado un ${Math.round((increaseRatio - 1) * 100)}% en comparación con las 4 anteriores, coincidiendo con el pico de crecimiento.`
            : `La carga de las últimas 4 sesiones está un ${Math.round((increaseRatio - 1) * 100)}% por encima del bloque anterior.`,
          en: hasPHV
            ? `Training load over the last 4 sessions is ${Math.round((increaseRatio - 1) * 100)}% above baseline while the athlete is in their peak growth window.`
            : `Training load over the last 4 sessions is ${Math.round((increaseRatio - 1) * 100)}% above the previous block.`,
        }),
        confidence: clampConfidence(0.73 + Math.min((increaseRatio - 1) / 2, 0.12)),
        recommendation: copy(locale, {
          es: hasPHV
            ? `Disminuir el volumen de saltos/impactos. Coordinar con preparador físico para programar sesiones de bajo impacto.`
            : increaseRatio >= 1.4
              ? `Revisar planificación semanal. Programar sesión de descarga y monitorizar fatiga neuromuscular.`
              : `Seguimiento de RPE y fatiga subjetiva. Mantener la carga actual sin progresión por el momento.`,
          en: hasPHV
            ? `Reduce jumping/impact volume. Coordinate with trainer to schedule low-impact sessions.`
            : increaseRatio >= 1.4
              ? `Review weekly planning. Schedule a deload session and monitor neuromuscular fatigue.`
              : `Follow RPE and subjective fatigue. Maintain current load with no progression for now.`,
        }),
        createdAt: assessment.inputs.dataCollectionDate,
        sourceIds: [],
      });
    }

    // Performance evaluation
    const groupedPerformance = new Map<string, PerformanceEntry[]>();
    state.performanceEntries
      .filter((entry) => entry.athleteId === athleteId)
      .forEach((entry) => {
        const group = groupedPerformance.get(entry.testName) ?? [];
        group.push(entry);
        groupedPerformance.set(entry.testName, group);
      });

    const performanceSignals: Array<{
      testName: string;
      change: number;
      latest: PerformanceEntry;
      previous: PerformanceEntry;
    }> = [];

    groupedPerformance.forEach((entries, testName) => {
      const sorted = [...entries].sort((a, b) => a.measurementDate.localeCompare(b.measurementDate));
      if (sorted.length < 2) return;
      const previous = sorted[sorted.length - 2];
      const latest = sorted[sorted.length - 1];
      const change = normalisePerformanceChange(previous, latest);
      performanceSignals.push({ testName, change, latest, previous });
    });

    const strongestImprovement = performanceSignals
      .filter((signal) => signal.change >= 0.08)
      .sort((left, right) => right.change - left.change)[0];
    const strongestDrop = performanceSignals
      .filter((signal) => signal.change <= -0.08)
      .sort((left, right) => left.change - right.change)[0];

    // Intertwined Performance Drop + Load + Maturation
    if (strongestDrop) {
      const hasElevatedLoad = increaseRatio >= 1.22;
      const severity: InsightSeverity = (hasElevatedLoad || hasPHV || Math.abs(strongestDrop.change) >= 0.15) ? "critical" : "medium";
      const pctChange = Math.round(Math.abs(strongestDrop.change) * 100);

      let titleEs = "";
      let titleEn = "";
      let descEs = "";
      let descEn = "";
      let recEs = "";
      let recEn = "";

      if (hasElevatedLoad && hasPHV) {
        titleEs = `${athleteName}: Alerta crítica: Caída de rendimiento por sobrecarga en PHV`;
        titleEn = `${athleteName}: Critical: Performance drop under overload in PHV`;
        descEs = `El rendimiento en ${strongestDrop.testName} ha bajado un ${pctChange}% debido a la combinación de crecimiento acelerado (Mid-PHV) y aumento reciente de carga de entrenamiento.`;
        descEn = `Performance in ${strongestDrop.testName} dropped by ${pctChange}% due to peak growth (Mid-PHV) and recent training load increase.`;
        recEs = `Reducir de inmediato la intensidad y volumen. Programar descanso neuromuscular y vigilar molestias en articulaciones.`;
        recEn = `Reduce intensity and volume immediately. Schedule neuromuscular rest and watch for joint pain.`;
      } else if (hasElevatedLoad) {
        titleEs = `${athleteName}: Caída de rendimiento por fatiga neuromuscular`;
        titleEn = `${athleteName}: Performance drop due to neuromuscular fatigue`;
        descEs = `Descenso del ${pctChange}% en ${strongestDrop.testName} coincidiendo con carga reciente en aumento. Fatiga acumulada probable.`;
        descEn = `Performance in ${strongestDrop.testName} decreased by ${pctChange}% alongside elevated training load. Fatigue is likely.`;
        recEs = `Introducir descarga y sesiones de recuperación activa. Posponer el próximo test máximo.`;
        recEn = `Introduce deload and active recovery sessions. Postpone the next maximal test.`;
      } else if (hasPHV) {
        titleEs = `${athleteName}: Descenso de rendimiento en pico de crecimiento`;
        titleEn = `${athleteName}: Performance drop during growth spurt`;
        descEs = `Descenso del ${pctChange}% en ${strongestDrop.testName}. El pico de crecimiento (Mid-PHV) suele alterar transitoriamente el control motor fino ("adolescent awkwardness").`;
        descEn = `Drop of ${pctChange}% in ${strongestDrop.testName}. Peak growth (Mid-PHV) often temporarily alters fine motor control ("adolescent awkwardness").`;
        recEs = `Reducir la exigencia de fuerza/coordinación extrema. Enfocar en re-entrenar gestos técnicos y estabilidad corporal.`;
        recEn = `Reduce extreme strength/coordination demands. Focus on retraining technique and body stability.`;
      } else {
        const isBigDrop = Math.abs(strongestDrop.change) >= 0.15;
        titleEs = isBigDrop 
          ? `${athleteName}: Descenso significativo en ${strongestDrop.testName}`
          : `${athleteName}: Descenso moderado en ${strongestDrop.testName}`;
        titleEn = isBigDrop
          ? `${athleteName}: Significant performance drop in ${strongestDrop.testName}`
          : `${athleteName}: Moderate performance drop in ${strongestDrop.testName}`;
        descEs = `Descenso del ${pctChange}% en ${strongestDrop.testName} respecto a la última medición.`;
        descEn = `Drop of ${pctChange}% in ${strongestDrop.testName} vs the previous test.`;
        recEs = isBigDrop 
          ? `Descartar mala ejecución de la prueba o molestias físicas. Valorar repetir el test en unos días.`
          : `Hacer seguimiento en las siguientes sesiones. Comprobar si el rendimiento se estabiliza.`;
        recEn = isBigDrop
          ? `Rule out poor test execution or physical discomfort. Consider re-testing in a few days.`
          : `Monitor in the next sessions. Check if performance stabilizes.`;
      }

      insights.push({
        id: `performance-drop-${athleteId}-${strongestDrop.testName}`,
        severity,
        category: "performance", // Rendimiento tab
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, { es: titleEs, en: titleEn }),
        description: copy(locale, { es: descEs, en: descEn }),
        confidence: clampConfidence(0.72 + Math.min(Math.abs(strongestDrop.change), 0.18)),
        recommendation: copy(locale, { es: recEs, en: recEn }),
        createdAt: strongestDrop.latest.measurementDate,
        sourceIds: [strongestDrop.latest.id, strongestDrop.previous.id],
      });
    }

    // Intertwined Performance Improvement + Load + Maturation
    if (strongestImprovement) {
      const hasElevatedLoad = increaseRatio >= 1.22;
      const isGrowingOrPost = band === "Mid-PHV" || band === "Post-PHV";
      const pctChange = Math.round(strongestImprovement.change * 100);

      let titleEs = "";
      let titleEn = "";
      let descEs = "";
      let descEn = "";
      let recEs = "";
      let recEn = "";

      if (!hasElevatedLoad && isGrowingOrPost) {
        titleEs = `${athleteName}: Mejora por desarrollo biológico (Talento)`;
        titleEn = `${athleteName}: Growth spurt performance gain (Talent)`;
        descEs = `Mejora del ${pctChange}% en ${strongestImprovement.testName} sin aumento de carga, probablemente potenciada por su desarrollo y maduración biológica (banda ${band}).`;
        descEn = `Improvement of ${pctChange}% in ${strongestImprovement.testName} without load increase, likely boosted by physical maturation (band ${band}).`;
        recEs = `Aprovechar para asentar patrones técnicos limpios ahora que tiene mayor palanca y fuerza estructural.`;
        recEn = `Take advantage of new levers to consolidate clean technical patterns and structural strength.`;
      } else if (!hasElevatedLoad) {
        titleEs = `${athleteName}: Mejora limpia de rendimiento (Talento)`;
        titleEn = `${athleteName}: Clean performance improvement (Talent)`;
        descEs = `Mejora del ${pctChange}% en ${strongestImprovement.testName} sin incremento paralelo de carga. Gran respuesta técnica y señal de talento.`;
        descEn = `Improvement of ${pctChange}% in ${strongestImprovement.testName} without a parallel load increase. Great technical response and talent signal.`;
        recEs = `Felicitar al jugador. Mantener su progresión y valorar si se sostiene en el próximo ciclo.`;
        recEn = `Congratulate the player. Maintain progression and see if it holds in the next cycle.`;
      } else {
        titleEs = `${athleteName}: Adaptación positiva al entrenamiento`;
        titleEn = `${athleteName}: Positive training adaptation`;
        descEs = `Mejora del ${pctChange}% en ${strongestImprovement.testName} asimilando bien la carga de entrenamiento elevada.`;
        descEn = `Improvement of ${pctChange}% in ${strongestImprovement.testName} showing positive adaptation under elevated training load.`;
        recEs = `Continuar progresión pero vigilar que no se acumule fatiga excesiva a medio plazo.`;
        recEn = `Continue progression but ensure excess fatigue does not accumulate in the medium term.`;
      }

      insights.push({
        id: `performance-rise-${athleteId}-${strongestImprovement.testName}`,
        severity: "low", // Green (Oportunidad)
        category: "talent", // Rendimiento / Talent tab
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, { es: titleEs, en: titleEn }),
        description: copy(locale, { es: descEs, en: descEn }),
        confidence: clampConfidence(0.68 + Math.min(strongestImprovement.change, 0.2)),
        recommendation: copy(locale, { es: recEs, en: recEn }),
        createdAt: strongestImprovement.latest.measurementDate,
        sourceIds: [strongestImprovement.latest.id, strongestImprovement.previous.id],
      });
    }
  });

  return insights;
}

function buildTrends(insights: Insight[], latestAssessments: MaturationResult[], locale: string): TrendItem[] {
  const trends: TrendItem[] = [];
  const byTeam = new Map<string, Insight[]>();

  insights.forEach((insight) => {
    if (!insight.teamName) return;
    const teamInsights = byTeam.get(insight.teamName) ?? [];
    teamInsights.push(insight);
    byTeam.set(insight.teamName, teamInsights);
  });

  byTeam.forEach((teamInsights, teamName) => {
    const loadCount = teamInsights.filter((insight) => insight.category === "load" && insight.severity !== "low").length;
    if (loadCount >= 2) {
      trends.push({
        id: `trend-load-${teamName}`,
        title: copy(locale, {
          es: `${teamName}: presión de carga colectiva`,
          en: `${teamName}: collective load pressure`,
        }),
        description: copy(locale, {
          es: `${loadCount} hallazgos de carga relevantes en el mismo grupo. Conviene revisar la densidad semanal.`,
          en: `${loadCount} meaningful load findings in the same group. Review weekly density.`,
        }),
      });
    }
  });

  const byBand = new Map<MaturityBand, number>();
  latestAssessments.forEach((assessment) => {
    const band = assessment.classification.maturityBand;
    if (!band) return;
    byBand.set(band, (byBand.get(band) ?? 0) + 1);
  });

  byBand.forEach((count, band) => {
    const bandInsights = insights.filter((insight) => insight.category === "growth").filter((insight) => {
      const athleteAssessment = latestAssessments.find((assessment) => assessment.inputs.athleteId === insight.athleteId);
      return athleteAssessment?.classification.maturityBand === band;
    });

    if (count > 0 && bandInsights.length >= 2) {
      trends.push({
        id: `trend-band-${band}`,
        title: copy(locale, {
          es: `${band}: concentración de señales`,
          en: `${band}: signal concentration`,
        }),
        description: copy(locale, {
          es: `${bandInsights.length} hallazgos de crecimiento/riesgo dentro de ${count} atletas en esta banda madurativa.`,
          en: `${bandInsights.length} growth/risk findings across ${count} athletes in this maturity band.`,
        }),
      });
    }
  });

  const talentInsights = insights.filter((insight) => insight.category === "talent");
  if (talentInsights.length > 0) {
    trends.push({
      id: "trend-talent",
      title: copy(locale, {
        es: "Talento emergente detectado",
        en: "Emerging talent detected",
      }),
      description: copy(locale, {
        es: `${talentInsights.length} atleta${talentInsights.length === 1 ? "" : "s"} mejora${talentInsights.length === 1 ? "" : "n"} sin incremento paralelo de carga.`,
        en: `${talentInsights.length} athlete${talentInsights.length === 1 ? "" : "s"} show improvement without a parallel load increase.`,
      }),
    });
  }

  return trends.slice(0, 5);
}

function buildRecommendations(insights: Insight[], locale: string): RecommendationItem[] {
  return insights
    .filter((insight) => insight.recommendation)
    .slice()
    .sort((left, right) => severityPriority[left.severity] - severityPriority[right.severity] || right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5)
    .map((insight) => ({
      id: `rec-${insight.id}`,
      title: copy(locale, {
        es: `Recomendación: ${insight.title}`,
        en: `Recommendation: ${insight.title}`,
      }),
      description: insight.recommendation ?? copy(locale, {
        es: "Sin recomendación disponible.",
        en: "No recommendation available.",
      }),
      relatedInsightIds: [insight.id],
    }));
}

export function buildPerformanceIntelligence(
  latestAssessments: MaturationResult[],
  allAssessments: MaturationResult[],
  state: AppState,
  locale: string,
): PerformanceIntelligenceResult {
  const insights = buildPerformanceIntelligenceInsights(latestAssessments, allAssessments, state, locale)
    .sort((left, right) => severityPriority[left.severity] - severityPriority[right.severity] || right.createdAt.localeCompare(left.createdAt));

  const monitoredAthletes = new Set(
    insights
      .filter((insight) => insight.severity !== "low" && insight.athleteId)
      .map((insight) => insight.athleteId as string),
  );

  return {
    insights,
    summary: {
      criticalAlerts: insights.filter((insight) => insight.severity === "critical").length,
      patternsDetected: insights.length,
      athletesToMonitor: monitoredAthletes.size,
      emergingTalents: insights.filter((insight) => insight.category === "talent").length,
    },
    trends: buildTrends(insights, latestAssessments, locale),
    recommendations: buildRecommendations(insights, locale),
  };
}
