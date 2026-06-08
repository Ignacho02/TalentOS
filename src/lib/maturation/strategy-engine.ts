/**
 * @deprecated This file is no longer used in production.
 *
 * The canonical maturation engine is `unified-maturation.ts`.
 * All components should import from there.
 *
 * This file is kept only to avoid breaking any future imports that may reference it,
 * but all functions here are stubs or corrected legacy versions.
 * It will be removed in a future cleanup pass.
 *
 * Known issues (fixed below, but the file itself is obsolete):
 * - getSelectedAphv() was returning the offset, not the APHV.
 * - getSelectedPah() was referencing non-existent fields (khamisRochePah, pahEstimate).
 * - METHOD_DESCRIPTIONS["sherar"] had wrong title/year (was "Sherar"/2005, should be "Mirwald (♀)"/2002).
 */

import type { MaturationResult } from "@/lib/types";

export type MaturationStrategy = {
  aphvMethod: "auto" | "fransen" | "sherar" | "moore" | "mirwald" | "consensus";
  pahMethod: "auto" | "khamis-roche" | "fallback";
  bioBandingMethod: "offset" | "pah";
  showSecondaryMethods: boolean;
  useConsensus: boolean;
};

export const DEFAULT_STRATEGY: MaturationStrategy = {
  aphvMethod: "auto",
  pahMethod: "auto",
  bioBandingMethod: "offset",
  showSecondaryMethods: false,
  useConsensus: false,
};

export function getAphvMethodPriority(
  sex: "male" | "female"
): ("fransen" | "sherar" | "moore" | "mirwald")[] {
  if (sex === "male") {
    return ["fransen", "moore", "mirwald"];
  }
  return ["sherar", "moore", "mirwald"];
}

export function selectBestAphvMethod(
  result: MaturationResult,
  sex: "male" | "female"
): "fransen" | "sherar" | "moore" | "mirwald" | null {
  const priority = getAphvMethodPriority(sex);

  for (const method of priority) {
    if (method === "fransen" && result.methodOutputs.fransenOffset !== null) {
      return "fransen";
    }
    if (method === "sherar" && result.methodOutputs.sherarOffset !== null) {
      return "sherar";
    }
    if (method === "moore" && result.methodOutputs.mooreOffset !== null) {
      return "moore";
    }
    if (method === "mirwald" && result.methodOutputs.mirwaldOffset !== null) {
      return "mirwald";
    }
  }

  return null;
}

/**
 * @deprecated Use `createUnifiedProfile` from `unified-maturation.ts` instead.
 *
 * Returns the maturity OFFSET (years from PHV) for the selected method.
 * Note: this function was previously called getSelectedAphv() but returned the offset —
 * that naming error is preserved here for backward compatibility but marked clearly.
 */
export function getSelectedOffset(
  result: MaturationResult,
  sex: "male" | "female",
  strategy: MaturationStrategy
): { value: number | null; method: string } {
  let method: "fransen" | "sherar" | "moore" | "mirwald" | null = null;
  let value: number | null = null;

  if (strategy.aphvMethod === "consensus" && strategy.useConsensus) {
    const values: Array<[number, number]> = [];

    if (result.methodOutputs.fransenOffset !== null) {
      values.push([result.methodOutputs.fransenOffset, 0.5]);
    }
    if (result.methodOutputs.mooreOffset !== null) {
      values.push([result.methodOutputs.mooreOffset, 0.3]);
    }
    if (result.methodOutputs.mirwaldOffset !== null) {
      values.push([result.methodOutputs.mirwaldOffset, 0.2]);
    }

    if (values.length > 0) {
      const totalWeight = values.reduce((sum, [, w]) => sum + w, 0);
      value = values.reduce((sum, [v, w]) => sum + v * w, 0) / totalWeight;
      method = null; // consensus has no single method
    }
  } else if (strategy.aphvMethod === "auto") {
    method = selectBestAphvMethod(result, sex);
    if (method === "fransen") value = result.methodOutputs.fransenOffset;
    else if (method === "sherar") value = result.methodOutputs.sherarOffset;
    else if (method === "moore") value = result.methodOutputs.mooreOffset;
    else if (method === "mirwald") value = result.methodOutputs.mirwaldOffset;
  } else if (strategy.aphvMethod === "fransen") {
    method = "fransen";
    value = result.methodOutputs.fransenOffset;
  } else if (strategy.aphvMethod === "sherar") {
    method = "sherar";
    value = result.methodOutputs.sherarOffset;
  } else if (strategy.aphvMethod === "moore") {
    method = "moore";
    value = result.methodOutputs.mooreOffset;
  } else if (strategy.aphvMethod === "mirwald") {
    method = "mirwald";
    value = result.methodOutputs.mirwaldOffset;
  }

  return { value, method: method || "unknown" };
}

/**
 * @deprecated Use `createUnifiedProfile` from `unified-maturation.ts` instead.
 *
 * Returns the predicted adult height (PAH) based on the strategy.
 * Fixed: now correctly references `pahCm` and `kozielMalinaPahCm` from MethodOutputs
 * (the old version referenced non-existent fields `khamisRochePah` and `pahEstimate`).
 */
export function getSelectedPah(
  result: MaturationResult,
  strategy: MaturationStrategy
): { value: number | null; method: string } {
  if (strategy.pahMethod === "auto" || strategy.pahMethod === "khamis-roche") {
    // Khamis-Roche PAH (requires parental heights)
    if (result.methodOutputs.pahCm !== null) {
      return { value: result.methodOutputs.pahCm, method: "khamis-roche" };
    }
  }
  if (strategy.pahMethod === "auto" || strategy.pahMethod === "fallback") {
    // Koziel-Malina fallback (no parental heights needed)
    if (result.methodOutputs.kozielMalinaPahCm !== null) {
      return { value: result.methodOutputs.kozielMalinaPahCm, method: "fallback" };
    }
  }
  return { value: null, method: "none" };
}

export function getSecondaryAphvMethods(
  result: MaturationResult
): Array<{ method: string; value: number }> {
  const methods: Array<{ method: string; value: number }> = [];

  if (result.methodOutputs.fransenOffset !== null) {
    methods.push({ method: "Fransen", value: result.methodOutputs.fransenOffset });
  }
  if (result.methodOutputs.sherarOffset !== null) {
    // Display label corrected: equation is Mirwald et al. (2002) Eq. 4, not Sherar
    methods.push({ method: "Mirwald (♀)", value: result.methodOutputs.sherarOffset });
  }
  if (result.methodOutputs.mooreOffset !== null) {
    methods.push({ method: "Moore", value: result.methodOutputs.mooreOffset });
  }
  if (result.methodOutputs.mirwaldOffset !== null) {
    methods.push({ method: "Mirwald", value: result.methodOutputs.mirwaldOffset });
  }

  return methods;
}

/**
 * Method descriptions for UI display.
 * Note: "sherar" entry corrected — title is "Mirwald (♀)", year is 2002.
 */
export const METHOD_DESCRIPTIONS: Record<string, { title: string; year: number; description: string }> = {
  fransen: {
    title: "Fransen",
    year: 2018,
    description:
      "Maturity ratio method (males only). Predicts APHV using sitting height to standing height ratio and current age.",
  },
  sherar: {
    // Corrected: this is Mirwald et al. (2002) Eq. 4 — Sherar (2005) uses it internally but
    // does not publish a new offset equation of its own.
    title: "Mirwald (♀)",
    year: 2002,
    description:
      "Female maturity offset equation (Mirwald et al., 2002, Eq. 4). Estimates years from PHV using leg length, sitting height, age, and body mass.",
  },
  moore: {
    title: "Moore",
    year: 2015,
    description:
      "Simplified maturity offset with one interaction term. Fast, accurate prediction across both sexes.",
  },
  mirwald: {
    title: "Mirwald",
    year: 2002,
    description:
      "Classic maturity offset using 5 variables (leg length, sitting height, age, mass). Widely validated across populations.",
  },
  "khamis-roche": {
    title: "Khamis-Roche",
    year: 1994,
    description:
      "PAH prediction using parental heights and current anthropometrics. Most accurate when parent data available.",
  },
  consensus: {
    title: "Consensus",
    year: 2024,
    description:
      "Weighted average of available methods: Fransen (50%), Moore (30%), Mirwald (20%). Reduces method-specific bias.",
  },
};