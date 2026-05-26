/**
 * CONCEPT-CENTRIC MATURATION ENGINE
 * 
 * Separates biological concepts (APHV, Offset, PAH) from calculation methods.
 * Always operates with ONE active engine at a time.
 * All derived metrics flow from the single selected engine.
 * 
 * Prevents:
 * - Multiple simultaneous APHV displays (scientific redundancy)
 * - Confusing parallel offset systems
 * - Poor UX from duplicated biological representations
 */

import { MaturationResult, UnifiedMaturityProfile, Sex } from "@/lib/types";

export type MaturationEngine = "auto" | "fransen" | "sherar" | "moore" | "mirwald" | "sitar" | "consensus";

/**
 * Auto-selection priority by athlete sex
 * Males: Fransen preferred (best accuracy for boys), fallback Moore, then Mirwald
 * Females: Sherar preferred (best accuracy for girls), fallback Moore, then Mirwald
 */
function selectBestEngine(result: MaturationResult, sex: Sex): MaturationEngine {
  const { methodOutputs } = result;

  if (sex === "male") {
    // Males: Fransen → Moore → Mirwald
    if (methodOutputs.fransenAphv !== null) return "fransen";
    if (methodOutputs.mooreAphv !== null) return "moore";
    if (methodOutputs.mirwaldAphv !== null) return "mirwald";
  } else {
    // Females: Sherar → Moore → Mirwald
    if (methodOutputs.sherarOffset !== null) return "sherar";
    if (methodOutputs.mooreAphv !== null) return "moore";
    if (methodOutputs.mirwaldAphv !== null) return "mirwald";
  }

  // Fallback to Moore if available, else Mirwald
  return methodOutputs.mooreAphv !== null ? "moore" : "mirwald";
}

/**
 * Get APHV and Offset for selected engine
 */
function getEngineMetrics(
  result: MaturationResult,
  engine: MaturationEngine,
  sex: Sex
): { aphv: number | null; offset: number | null } {
  const { methodOutputs } = result;

  switch (engine) {
    case "fransen":
      return {
        aphv: methodOutputs.fransenAphv,
        offset: methodOutputs.fransenOffset,
      };

    case "moore":
      return {
        aphv: methodOutputs.mooreAphv,
        offset: methodOutputs.mooreOffset,
      };

    case "mirwald":
      return {
        aphv: methodOutputs.mirwaldAphv,
        offset: methodOutputs.mirwaldOffset,
      };

    case "sherar":
      return {
        aphv: methodOutputs.sherarOffset ? result.derivedMetrics.chronologicalAge + methodOutputs.sherarOffset : null,
        offset: methodOutputs.sherarOffset,
      };

    case "consensus":
      // Dynamic consensus: reweight available methods
      // Preference weights: Fransen/Sherar 50%, Moore 30%, Mirwald 20%
      const availableMethods: Array<{ name: string; aphv: number | null; weight: number }> = [
        { name: "Fransen", aphv: methodOutputs.fransenAphv, weight: 0.5 },
        { name: "Sherar", aphv: methodOutputs.sherarOffset ? result.derivedMetrics.chronologicalAge + methodOutputs.sherarOffset : null, weight: 0.5 },
        { name: "Moore", aphv: methodOutputs.mooreAphv, weight: 0.3 },
        { name: "Mirwald", aphv: methodOutputs.mirwaldAphv, weight: 0.2 },
      ];

      const validMethods = availableMethods.filter((m) => m.aphv !== null);
      if (validMethods.length === 0) return { aphv: null, offset: null };

      // Reweight: normalize to sum to 1
      const totalWeight = validMethods.reduce((sum, m) => sum + m.weight, 0);
      const reweightedMethods = validMethods.map((m) => ({
        ...m,
        weight: m.weight / totalWeight,
      }));

      const consensusAphv = reweightedMethods.reduce((sum, m) => sum + (m.aphv! * m.weight), 0);
      const consensusOffset = consensusAphv - result.derivedMetrics.chronologicalAge;

      return {
        aphv: consensusAphv,
        offset: consensusOffset,
      };

    case "sitar":
      // SITAR requires longitudinal data (multiple measurements over time)
      // Currently returns null - needs integration with history analysis
      // To enable SITAR: pass array of MaturationResult[] to optimization engine
      return { aphv: null, offset: null };

    case "auto":
      const autoEngine = selectBestEngine(result, sex);
      if (autoEngine === "auto") return { aphv: null, offset: null };
      return getEngineMetrics(result, autoEngine, sex);

    default:
      return { aphv: null, offset: null };
  }
}

/**
 * Classify maturity band from offset
 */
function classifyMaturityBand(offset: number | null) {
  if (offset === null) return "Mid-PHV";
  if (offset <= -1) return "Pre-PHV";
  if (offset >= 1) return "Post-PHV";
  return "Mid-PHV";
}

/**
 * Classify PAH band from percentage
 */
function classifyPahBand(percentage: number | null) {
  if (!percentage) return "85-90%";
  if (percentage < 85) return "≤ 85%";
  if (percentage < 90) return "85-90%";
  if (percentage < 95) return "90-95%";
  return "≥ 95%";
}

/**
 * Get alternative methods for advanced mode
 */
function getAlternativeMethods(
  result: MaturationResult,
  sex: Sex,
  selectedEngine: MaturationEngine
) {
  const alternatives: UnifiedMaturityProfile["alternativeMethods"] = [];
  const engines: Array<"fransen" | "moore" | "mirwald" | "sherar" | "consensus"> = ["fransen", "moore", "mirwald"];

  if (sex === "female") {
    engines.push("sherar");
  }

  for (const engine of engines) {
    if (engine === selectedEngine) continue;

    const { aphv, offset } = getEngineMetrics(result, engine, sex);
    if (aphv === null) continue;

    alternatives.push({
      engine,
      aphv,
      offset,
      methodLabel: getEngineLabel(engine),
    });
  }

  return alternatives.length > 0 ? alternatives : undefined;
}

/**
 * Get human-readable label for engine
 */
export function getEngineLabel(engine: MaturationEngine): string {
  const labels: Record<MaturationEngine, string> = {
    auto: "Automático",
    fransen: "Fransen",
    moore: "Moore",
    mirwald: "Mirwald",
    sherar: "Sherar",
    sitar: "SITAR",
    consensus: "Consenso",
  };
  return labels[engine];
}

/**
 * Get engine description with year
 */
export function getEngineInfo(engine: MaturationEngine): { label: string; year?: number } {
  const info: Record<MaturationEngine, { label: string; year?: number }> = {
    auto: { label: "Automático" },
    fransen: { label: "Fransen", year: 2011 },
    moore: { label: "Moore", year: 2015 },
    mirwald: { label: "Mirwald", year: 2002 },
    sherar: { label: "Sherar", year: 2007 },
    sitar: { label: "SITAR", year: 2010 },
    consensus: { label: "Consenso ponderado" },
  };
  return info[engine];
}

/**
 * CREATE UNIFIED PROFILE
 * 
 * Converts MaturationResult → UnifiedMaturityProfile
 * This is the main entry point for concept-centric architecture
 */
export function createUnifiedProfile(
  result: MaturationResult,
  selectedEngine: MaturationEngine,
  bioBandingStrategy: "offset" | "pah" = "offset",
  sex: Sex
): UnifiedMaturityProfile {
  // Handle auto-selection
  const resolvedEngine = selectedEngine === "auto" ? selectBestEngine(result, sex) : selectedEngine;

  // Get APHV and Offset for selected engine
  const { aphv, offset } = getEngineMetrics(result, resolvedEngine, sex);

  // Derive all other metrics from the single engine
  const maturityBand = classifyMaturityBand(offset);
  const pah = result.methodOutputs.pahCm;
  const pahPercentage = result.methodOutputs.percentageAdultHeight;
  const pahBand = classifyPahBand(pahPercentage);

  // Get alternative methods for advanced mode
  const alternativeMethods =
    selectedEngine !== "auto" ? getAlternativeMethods(result, sex, resolvedEngine) : undefined;

  const info = getEngineInfo(resolvedEngine);

  return {
    selectedEngine: resolvedEngine,
    aphv,
    offset,
    maturityBand,
    pah,
    pahPercentage,
    pahBand,
    bioBandingStrategy,
    methodLabel: info.label,
    methodYear: info.year,
    alternativeMethods,
    result,
    athleteSex: sex,
  };
}

/**
 * Update engine selection in existing profile
 */
export function updateProfileEngine(
  profile: UnifiedMaturityProfile,
  newEngine: MaturationEngine,
  bioBandingStrategy?: "offset" | "pah"
): UnifiedMaturityProfile {
  return createUnifiedProfile(
    profile.result,
    newEngine,
    bioBandingStrategy ?? profile.bioBandingStrategy,
    profile.athleteSex
  );
}

/**
 * Get the biological banding metric
 * (what actually groups athletes together)
 */
export function getGroupingMetric(profile: UnifiedMaturityProfile): number | null {
  if (profile.bioBandingStrategy === "offset") {
    return profile.offset;
  } else {
    return profile.pahPercentage;
  }
}

/**
 * Get the biological banding label
 */
export function getGroupingLabel(profile: UnifiedMaturityProfile): string {
  if (profile.bioBandingStrategy === "offset") {
    return "Offset";
  } else {
    return "% PAH";
  }
}
