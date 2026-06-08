import type { DashboardInsight, MaturationResult, MaturityBand } from "@/lib/types";
import type { MaturationEngine } from "./unified-maturation";

/**
 * Build dashboard insights for a single assessment.
 *
 * @param result         Raw MaturationResult from calculations.
 * @param selectedEngine The engine currently active in the UI (from useMaturationPreferences).
 * @param activeBand     Maturity band derived from the active engine's UnifiedMaturityProfile.
 *                       When provided this is used for band-specific insights instead of the
 *                       raw classification.maturityBand (which reflects the default combined
 *                       engine, not necessarily the user-selected one).
 */
export function buildInsights(
  result: MaturationResult,
  selectedEngine?: MaturationEngine,
  activeBand?: MaturityBand | null
): DashboardInsight[] {
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

  // SITAR active — inform user they are using the SITAR engine, and warn about PHV variability
  if (selectedEngine === "sitar" && result.sitarOutputs?.sitarActive) {
    insights.push({
      id: `${result.inputs.id}-sitar`,
      tone: "success",
      titleKey: "insights.sitarActiveTitle",
      bodyKey: "insights.sitarActiveBody",
    });
    // PHV from SITAR has high variability (SD ±1.78 cm/year, Monasterio 2026).
    // Always surface this warning so users don't over-interpret the PHV value.
    insights.push({
      id: `${result.inputs.id}-sitar-phv-warning`,
      tone: "warning",
      titleKey: "insights.sitarPhvWarningTitle",
      bodyKey: "insights.sitarPhvWarningBody",
    });
  }

  // Band-specific insights.
  // Use `activeBand` (from the active engine's UnifiedMaturityProfile) when available so
  // the insight reflects the engine the user has selected, not the default combined engine.
  const band: MaturityBand | null = activeBand ?? result.classification.maturityBand;

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