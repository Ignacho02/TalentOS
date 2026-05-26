import type { MaturationResult } from "@/lib/types";

/**
 * Maturation Strategy Engine
 * 
 * Defines which calculation methods to use for different maturation concepts.
 * Separates "biological concepts" (APHV, Offset, PAH) from "calculation methods".
 */

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

/**
 * Get APHV method priority based on sex
 * Male: Fransen → Moore → Mirwald
 * Female: Sherar → Moore → Mirwald
 */
export function getAphvMethodPriority(
  sex: "male" | "female"
): ("fransen" | "sherar" | "moore" | "mirwald")[] {
  if (sex === "male") {
    return ["fransen", "moore", "mirwald"];
  }
  return ["sherar", "moore", "mirwald"];
}

/**
 * Select best APHV method for athlete based on available data
 */
export function selectBestAphvMethod(
  result: MaturationResult,
  sex: "male" | "female"
): "fransen" | "sherar" | "moore" | "mirwald" | null {
  const priority = getAphvMethodPriority(sex);

  for (const method of priority) {
    if (method === "fransen" && result.methodOutputs.fransenOffset !== null) {
      return "fransen";
    }
    if (method === "sherar" && result.methodOutputs.shearOffset !== null) {
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
 * Get selected APHV value based on strategy
 */
export function getSelectedAphv(
  result: MaturationResult,
  sex: "male" | "female",
  strategy: MaturationStrategy
): { value: number | null; method: string } {
  let method: "fransen" | "sherar" | "moore" | "mirwald" | null = null;
  let value: number | null = null;

  if (strategy.aphvMethod === "consensus" && strategy.useConsensus) {
    // Calculate weighted consensus
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
      const totalWeight = values.reduce((sum, [_, w]) => sum + w, 0);
      value = values.reduce((sum, [v, w]) => sum + v * w, 0) / totalWeight;
      method = "consensus";
    }
  } else if (strategy.aphvMethod === "auto") {
    method = selectBestAphvMethod(result, sex);
    if (method === "fransen") value = result.methodOutputs.fransenOffset;
    else if (method === "sherar") value = result.methodOutputs.shearOffset;
    else if (method === "moore") value = result.methodOutputs.mooreOffset;
    else if (method === "mirwald") value = result.methodOutputs.mirwaldOffset;
  } else if (strategy.aphvMethod === "fransen") {
    method = "fransen";
    value = result.methodOutputs.fransenOffset;
  } else if (strategy.aphvMethod === "sherar") {
    method = "sherar";
    value = result.methodOutputs.shearOffset;
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
 * Get offset value (Maturity Offset) - derived from APHV selection
 */
export function getSelectedOffset(
  result: MaturationResult,
  sex: "male" | "female",
  strategy: MaturationStrategy
): { value: number | null; method: string } {
  // Offset is the same calculation as APHV in our current model
  return getSelectedAphv(result, sex, strategy);
}

/**
 * Get PAH (Predicted Adult Height) based on strategy
 */
export function getSelectedPah(
  result: MaturationResult,
  strategy: MaturationStrategy
): { value: number | null; method: string } {
  if (strategy.pahMethod === "auto") {
    // Prefer Khamis-Roche if available (requires parent heights)
    if (result.methodOutputs.khamisRochePah !== null) {
      return { value: result.methodOutputs.khamisRochePah, method: "khamis-roche" };
    }
    // Fallback to estimate
    if (result.methodOutputs.pahEstimate !== null) {
      return { value: result.methodOutputs.pahEstimate, method: "estimate" };
    }
  } else if (strategy.pahMethod === "khamis-roche") {
    return { value: result.methodOutputs.khamisRochePah, method: "khamis-roche" };
  } else if (strategy.pahMethod === "fallback") {
    return { value: result.methodOutputs.pahEstimate, method: "estimate" };
  }

  return { value: null, method: "none" };
}

/**
 * Get all available secondary APHV methods (for expandable section)
 */
export function getSecondaryAphvMethods(
  result: MaturationResult
): Array<{ method: string; value: number }> {
  const methods: Array<{ method: string; value: number }> = [];

  if (result.methodOutputs.fransenOffset !== null) {
    methods.push({ method: "Fransen", value: result.methodOutputs.fransenOffset });
  }
  if (result.methodOutputs.shearOffset !== null) {
    methods.push({ method: "Sherar", value: result.methodOutputs.shearOffset });
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
 * Get method descriptions for UI display
 */
export const METHOD_DESCRIPTIONS: Record<string, { title: string; year: number; description: string }> = {
  fransen: {
    title: "Fransen",
    year: 2018,
    description:
      "Maturity ratio method (males only). Predicts APHV using sitting height to standing height ratio and current age.",
  },
  sherar: {
    title: "Sherar",
    year: 2005,
    description:
      "Maturity offset adjustment for females. Enhances prediction accuracy using anthropometric indicators.",
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
