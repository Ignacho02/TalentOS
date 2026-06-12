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

  alerts.forEach((alert) => {
    const athleteId = athleteNames.get(alert.athleteName);
    const athlete = athleteId ? latestByAthlete.get(athleteId) : undefined;
    const severity: InsightSeverity =
      alert.severity === "critical" ? "critical" : alert.severity === "warning" ? "high" : "medium";

    insights.push({
      id: `alert-${alert.id}`,
      severity,
      category: "risk",
      athleteId,
      teamName: alert.teamName,
      title: copy(locale, {
        es: `${alert.athleteName}: ${alert.message}`,
        en: `${alert.athleteName}: ${alert.message}`,
      }),
      description: alert.detail ?? copy(locale, {
        es: "La revisión de datos requiere atención del staff.",
        en: "This data issue needs staff review.",
      }),
      confidence: severity === "critical" ? 0.96 : 0.83,
      recommendation:
        athleteId && athlete
          ? buildRiskRecommendation(locale, athlete.inputs.athleteName)
          : undefined,
      createdAt: athlete?.inputs.dataCollectionDate ?? new Date().toISOString().slice(0, 10),
      sourceIds: [alert.id],
    });
  });

  rapidGrowthItems.forEach((item) => {
    insights.push({
      id: `growth-${item.id}`,
      severity: item.monthlyRate >= 1.2 ? "high" : "medium",
      category: "growth",
      athleteId: item.athleteId,
      teamName: item.teamName,
      title: copy(locale, {
        es: `${item.athleteName}: crecimiento acelerado detectado`,
        en: `${item.athleteName}: accelerated growth detected`,
      }),
      description: copy(locale, {
        es: `+${formatNumber(item.statureGain, 1)} cm entre ${formatDate(item.dateFrom)} y ${formatDate(item.dateTo)} (${formatNumber(item.monthlyRate, 2)} cm/mes).`,
        en: `+${formatNumber(item.statureGain, 1)} cm between ${formatDate(item.dateFrom)} and ${formatDate(item.dateTo)} (${formatNumber(item.monthlyRate, 2)} cm/month).`,
      }),
      confidence: clampConfidence(0.78 + Math.min(item.monthlyRate / 10, 0.1)),
      recommendation: copy(locale, {
        es: `Monitorizar coordinación y limitar exposición excéntrica alta para ${item.athleteName}.`,
        en: `Monitor coordination and limit high eccentric exposure for ${item.athleteName}.`,
      }),
      createdAt: item.dateTo,
      sourceIds: [item.id],
    });
  });

  latestAssessments.forEach((assessment) => {
    const athleteId = assessment.inputs.athleteId;
    const athleteName = assessment.inputs.athleteName;
    const band = assessment.classification.maturityBand;

    if (band === "Mid-PHV") {
      insights.push({
        id: `phv-${athleteId}`,
        severity: "medium",
        category: "growth",
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, {
          es: `${athleteName}: ventana PHV activa`,
          en: `${athleteName}: active PHV window`,
        }),
        description: copy(locale, {
          es: `El atleta está en banda ${band}. Conviene revisar cargas de impacto y coordinación fina.`,
          en: `The athlete is in the ${band} band. Review impact loading and fine coordination.`,
        }),
        confidence: 0.76,
        recommendation: copy(locale, {
          es: `Priorizar técnica, coordinación y seguimiento de molestias de crecimiento.`,
          en: `Prioritise technique, coordination, and monitoring for growth-related soreness.`,
        }),
        createdAt: assessment.inputs.dataCollectionDate,
        sourceIds: [assessment.inputs.id],
      });
    }

    const athleteLoad = state.trainingLoadEntries
      .filter((entry) => entry.athleteId === athleteId)
      .sort((a, b) => a.date.localeCompare(b.date));
    if (athleteLoad.length >= 8) {
      const recent = athleteLoad.slice(-4);
      const baseline = athleteLoad.slice(-8, -4);
      const recentAvg = recent.reduce((sum, entry) => sum + entry.load, 0) / recent.length;
      const baselineAvg = baseline.reduce((sum, entry) => sum + entry.load, 0) / baseline.length;
      const increaseRatio = baselineAvg > 0 ? recentAvg / baselineAvg : 1;

      if (increaseRatio >= 1.22) {
        const severity: InsightSeverity = increaseRatio >= 1.4 || band === "Mid-PHV" ? "high" : "medium";
        insights.push({
          id: `load-${athleteId}`,
          severity,
          category: "load",
          athleteId,
          teamName: assessment.inputs.teamName,
          title: copy(locale, {
            es: `${athleteName}: carga reciente elevada`,
            en: `${athleteName}: elevated recent load`,
          }),
          description: copy(locale, {
            es: `La carga de las últimas 4 sesiones está ${Math.round((increaseRatio - 1) * 100)}% por encima del bloque previo.`,
            en: `Load across the last 4 sessions is ${Math.round((increaseRatio - 1) * 100)}% above the prior block.`,
          }),
          confidence: clampConfidence(0.73 + Math.min((increaseRatio - 1) / 2, 0.12)),
          recommendation: copy(locale, {
            es: `Revisar minutos, RPE y densidad competitiva antes de seguir progresando la carga.`,
            en: `Review minutes, RPE, and competition density before progressing load further.`,
          }),
          createdAt: recent[recent.length - 1]?.date ?? assessment.inputs.dataCollectionDate,
          sourceIds: recent.map((entry) => entry.id),
        });
      }
    }

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

    if (strongestDrop) {
      const linkedLoad = insights.find((entry) => entry.athleteId === athleteId && entry.category === "load");
      const severity: InsightSeverity =
        linkedLoad || band === "Mid-PHV" ? "high" : Math.abs(strongestDrop.change) >= 0.15 ? "high" : "medium";
      insights.push({
        id: `performance-drop-${athleteId}-${strongestDrop.testName}`,
        severity,
        category: linkedLoad ? "risk" : "performance",
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, {
          es: `${athleteName}: descenso en ${strongestDrop.testName}`,
          en: `${athleteName}: drop in ${strongestDrop.testName}`,
        }),
        description: copy(locale, {
          es: `Cambio de ${Math.round(Math.abs(strongestDrop.change) * 100)}% respecto a la medición previa${linkedLoad ? " con carga elevada en paralelo" : ""}.`,
          en: `${Math.round(Math.abs(strongestDrop.change) * 100)}% change vs. the previous measurement${linkedLoad ? " with elevated load in parallel" : ""}.`,
        }),
        confidence: clampConfidence(0.72 + Math.min(Math.abs(strongestDrop.change), 0.18)),
        recommendation: copy(locale, {
          es: `Revisar fatiga neuromuscular y decidir si conviene descargar o repetir el test.`,
          en: `Review neuromuscular fatigue and decide whether to deload or repeat the test.`,
        }),
        createdAt: strongestDrop.latest.measurementDate,
        sourceIds: [strongestDrop.latest.id, strongestDrop.previous.id, ...(linkedLoad?.sourceIds ?? [])],
      });
    }

    if (strongestImprovement) {
      const linkedLoad = insights.find((entry) => entry.athleteId === athleteId && entry.category === "load");
      const category: InsightCategory = linkedLoad ? "performance" : "talent";
      insights.push({
        id: `performance-rise-${athleteId}-${strongestImprovement.testName}`,
        severity: category === "talent" ? "medium" : "low",
        category,
        athleteId,
        teamName: assessment.inputs.teamName,
        title: copy(locale, {
          es: `${athleteName}: mejora en ${strongestImprovement.testName}`,
          en: `${athleteName}: improvement in ${strongestImprovement.testName}`,
        }),
        description: copy(locale, {
          es: `Mejora del ${Math.round(strongestImprovement.change * 100)}% respecto a la medición previa${linkedLoad ? " sin ser todavía una señal limpia de talento por el aumento de carga" : " sin incremento paralelo de carga"}.`,
          en: `${Math.round(strongestImprovement.change * 100)}% improvement vs. the previous measurement${linkedLoad ? " although the load increase weakens the talent signal" : " without a parallel load increase"}.`,
        }),
        confidence: clampConfidence(0.68 + Math.min(strongestImprovement.change, 0.2)),
        recommendation:
          category === "talent"
            ? copy(locale, {
                es: `Abrir análisis individual y validar si la mejora se sostiene en el siguiente ciclo.`,
                en: `Open the individual analysis and validate whether the improvement holds in the next cycle.`,
              })
            : undefined,
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
    const bandInsights = insights.filter((insight) => insight.category === "risk" || insight.category === "growth").filter((insight) => {
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
