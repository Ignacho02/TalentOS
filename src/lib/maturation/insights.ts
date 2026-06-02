import type { DashboardInsight, MaturationResult } from "@/lib/types";

export function buildInsights(result: MaturationResult): DashboardInsight[] {
  const insights: DashboardInsight[] = [];

  // Extreme offset warning — error multiplies ×2–6 (Koziel & Malina 2018)
  if (result.warnings.includes("offset-extreme-early")) {
    insights.push({
      id: `${result.inputs.id}-extreme-early`,
      tone: "warning",
      titleKey: "insights.extremeEarlyTitle",
      bodyKey: "insights.extremeEarlyBody",
    });
  }
  if (result.warnings.includes("offset-extreme-late")) {
    insights.push({
      id: `${result.inputs.id}-extreme-late`,
      tone: "warning",
      titleKey: "insights.extremeLateTitle",
      bodyKey: "insights.extremeLateBody",
    });
  }

  if (result.warnings.includes("missing-parent-heights")) {
    insights.push({
      id: `${result.inputs.id}-parents`,
      tone: "warning",
      titleKey: "insights.missingParentsTitle",
      bodyKey: "insights.missingParentsBody",
    });
  }

  // Moore-2 fallback active (sitting height was missing)
  if (result.methodOutputs.mooreMethod === "moore-2") {
    insights.push({
      id: `${result.inputs.id}-moore2`,
      tone: "info",
      titleKey: "insights.moore2Title",
      bodyKey: "insights.moore2Body",
    });
  }

  // SITAR active — inform user which engine is running
  if (result.sitarOutputs?.sitarActive) {
    insights.push({
      id: `${result.inputs.id}-sitar`,
      tone: "success",
      titleKey: "insights.sitarActiveTitle",
      bodyKey: "insights.sitarActiveBody",
    });
  }

  const band = result.classification.maturityBand;
  if (band === "Pre-PHV") {
    insights.push({
      id: `${result.inputs.id}-pre`,
      tone: "info",
      titleKey: "insights.preTitle",
      bodyKey: "insights.preBody",
    });
  }
  if (band === "Mid-PHV") {
    insights.push({
      id: `${result.inputs.id}-mid`,
      tone: "warning",
      titleKey: "insights.midTitle",
      bodyKey: "insights.midBody",
    });
  }
  if (band === "Post-PHV") {
    insights.push({
      id: `${result.inputs.id}-post`,
      tone: "success",
      titleKey: "insights.postTitle",
      bodyKey: "insights.postBody",
    });
  }

  return insights;
}