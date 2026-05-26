import { boysRegressionTable, girlsRegressionTable } from "@/lib/maturation/coefficients";
import type {
  AnthropometricRecord,
  MaturityBand,
  MaturationResult,
  Sex,
} from "@/lib/types";
import { calculateAge, roundHalf } from "@/lib/utils";
import { getWhoBmiZScore } from "./who-coefficients";

function getRegressionEntry(age: number, sex: Sex) {
  const targetAge = roundHalf(age);
  const table = sex === "male" ? boysRegressionTable : girlsRegressionTable;
  let entry = table[0];

  for (const row of table) {
    if (row.age <= targetAge) {
      entry = row;
    }
  }

  return entry;
}

function adjustMotherHeight(cm: number) {
  // Khamis-Roche method: Adjust parental heights to target child height units
  // Formula: ((cm * 0.3937 * 0.953) + 2.803) * 2.54
  // Source: Khamis & Roche (1994) - Predicting adult stature
  return ((cm * 0.3937 * 0.953) + 2.803) * 2.54;
}

function adjustFatherHeight(cm: number) {
  // Khamis-Roche method: Adjust parental heights to target child height units
  // Formula: ((cm * 0.3937 * 0.955) + 2.316) * 2.54
  // Source: Khamis & Roche (1994) - Predicting adult stature
  return ((cm * 0.3937 * 0.955) + 2.316) * 2.54;
}

function classifyBand(primaryOffset: number): MaturityBand {
  if (primaryOffset <= -1) return "Pre-PHV";
  if (primaryOffset >= 1) return "Post-PHV";
  return "Mid-PHV";
}

function classifyPahBand(percentage: number | null): "≤ 85%" | "85-90%" | "90-95%" | "≥ 95%" {
  if (!percentage) return "85-90%";
  if (percentage < 85) return "≤ 85%";
  if (percentage < 90) return "85-90%";
  if (percentage < 95) return "90-95%";
  return "≥ 95%";
}

/**
 * Calculate maturation status using multiple scientific methods
 * @param record Anthropometric measurement record
 * @returns MaturationResult with calculated offsets, classifications, and warnings
 */
export function calculateMaturation(record: AnthropometricRecord): MaturationResult {
  const chronologicalAge = calculateAge(record.dob, record.dataCollectionDate);
  const legLengthCm = record.statureCm - record.sittingHeightCm;
  const sittingHeightRatio = (record.sittingHeightCm / record.statureCm) * 100;
  const ageLookup = getRegressionEntry(chronologicalAge, record.sex);
  const warnings: string[] = [];
  const parentHeightsPresent =
    typeof record.motherHeightCm === "number" &&
    typeof record.fatherHeightCm === "number";

  // Validate inputs and add warnings
  if (chronologicalAge < 5) {
    warnings.push("age-too-young");
  }
  if (chronologicalAge > 17.5) {
    warnings.push("age-out-of-regression-table");
  }
  if (record.sittingHeightCm >= record.statureCm) {
    warnings.push("invalid-sitting-height");
  }
  if (record.dataCollectionDate > new Date().toISOString().split('T')[0]) {
    warnings.push("future-collection-date");
  }
  if (record.statureCm < 100 || record.statureCm > 250) {
    warnings.push("unrealistic-stature");
  }
  if (record.bodyMassKg < 15 || record.bodyMassKg > 200) {
    warnings.push("unrealistic-weight");
  }
  if (legLengthCm < 40 || legLengthCm > 130) {
    warnings.push("unrealistic-leg-length");
  }

  let pahCm: number | null = null;
  let percentageAdultHeight: number | null = null;
  let maturityZScore: number | null = null;

  if (parentHeightsPresent && record.motherHeightCm && record.fatherHeightCm) {
    const adjustedMother = adjustMotherHeight(record.motherHeightCm);
    const adjustedFather = adjustFatherHeight(record.fatherHeightCm);
    const adjustedMidParent = (adjustedMother + adjustedFather) / 2;

    pahCm =
      ageLookup.beta +
      ageLookup.stature * record.statureCm +
      ageLookup.weight * record.bodyMassKg +
      ageLookup.midParentStature * adjustedMidParent;
    percentageAdultHeight = (record.statureCm / pahCm) * 100;

    if (record.sex === "male" && ageLookup.refMean && ageLookup.refSd) {
      maturityZScore =
        (percentageAdultHeight - ageLookup.refMean) / ageLookup.refSd;
    }
  } else {
    warnings.push("missing-parent-heights");
  }

  // Koziel & Malina (Fallback PAH)
  let kozielMalinaPahCm: number | null = null;
  let kozielMalinaPercentageAdultHeight: number | null = null;
  if (!parentHeightsPresent) {
    if (record.sex === "male" && ageLookup.refMean) {
      kozielMalinaPercentageAdultHeight = ageLookup.refMean;
      kozielMalinaPahCm = record.statureCm / (ageLookup.refMean / 100);
    } else {
      // Approximation for girls based on age
      const approxRefMean = 75 + (chronologicalAge - 5) * 1.5; // very rough heuristic
      const boundedMean = Math.min(Math.max(approxRefMean, 75), 99);
      kozielMalinaPercentageAdultHeight = boundedMean;
      kozielMalinaPahCm = record.statureCm / (boundedMean / 100);
    }
  }

  // Sherar et al. (2005) - Specific offset for girls
  // Approximation based on age and sitting height ratio
  let sherarOffset: number | null = null;
  if (record.sex === "female") {
     sherarOffset = -9.376 + 0.0001882 * (legLengthCm * record.sittingHeightCm) + 0.0022 * (chronologicalAge * legLengthCm) + 0.005841 * (chronologicalAge * record.sittingHeightCm) - 0.002658 * (chronologicalAge * record.bodyMassKg) + 0.07693 * ((record.bodyMassKg / record.statureCm) * 100);
  }

  // WHO BMI Z-Score
  const bmi = record.bodyMassKg / Math.pow(record.statureCm / 100, 2);
  const whoBmiZScore = getWhoBmiZScore(chronologicalAge, record.sex, bmi);

  const llSh = legLengthCm * record.sittingHeightCm;
  const ageLl = chronologicalAge * legLengthCm;
  const ageSh = chronologicalAge * record.sittingHeightCm;
  const massStature = record.bodyMassKg / record.statureCm;

  const mirwaldOffset =
    record.sex === "male"
      ? -9.236 +
        0.0002708 * llSh -
        0.001663 * ageLl +
        0.007216 * ageSh +
        0.02292 * (massStature * 100)
      : -9.376 +
        0.0001882 * llSh +
        0.0022 * ageLl +
        0.005841 * ageSh -
        0.002658 * (chronologicalAge * record.bodyMassKg) +
        0.07693 * (massStature * 100);

  const mirwaldAphv = chronologicalAge - mirwaldOffset;
  // Mirwald et al. (2002) - Non-invasive assessment of skeletal age
  // Male: offset = -9.236 + 0.0002708*LL*SH - 0.001663*AGE*LL + 0.007216*AGE*SH + 0.02292*BMI
  // Female: offset = -9.376 + 0.0001882*LL*SH + 0.0022*AGE*LL + 0.005841*AGE*SH - 0.002658*AGE*BM + 0.07693*BMI
  // Where LL = leg length, SH = sitting height, BM = body mass, BMI = body mass/stature

  const mooreOffset =
    record.sex === "male"
      ? -8.128741 + 0.0070346 * (chronologicalAge * record.sittingHeightCm)
      : -7.709133 + 0.0042232 * (chronologicalAge * record.statureCm);
  const mooreAphv = chronologicalAge - mooreOffset;
  // Moore et al. (2015) - Predicting the age of peak height velocity
  // Male: offset = -8.128741 + 0.0070346 * (AGE * SH)
  // Female: offset = -7.709133 + 0.0042232 * (AGE * STATURE)
  // Source: Moore et al. (2015) - Journal of Sports Sciences

  const fransenRatio =
    record.sex === "male"
      ? 6.986547255416 +
        0.115802846632 * chronologicalAge +
        0.001450825199 * chronologicalAge * chronologicalAge +
        0.004518400406 * record.bodyMassKg -
        0.000034086447 * record.bodyMassKg * record.bodyMassKg -
        0.151951447289 * record.statureCm +
        0.000932836659 * record.statureCm * record.statureCm -
        0.000001656585 * record.statureCm * record.statureCm * record.statureCm +
        0.032198263733 * legLengthCm -
        0.000269025264 * legLengthCm * legLengthCm -
        0.000760897942 * (record.statureCm * chronologicalAge)
      : null;

  const fransenAphv =
    fransenRatio && fransenRatio !== 0 ? chronologicalAge / fransenRatio : null;
  const fransenOffset =
    fransenAphv !== null ? chronologicalAge - fransenAphv : null;
  const primaryOffset = fransenOffset ?? mooreOffset;

  return {
    inputs: record,
    derivedMetrics: { 
      chronologicalAge, 
      legLengthCm, 
      sittingHeightRatio,
      growthVelocityCmPerYear: null // Populated externally if history exists
    },
    methodOutputs: {
      pahCm,
      percentageAdultHeight,
      maturityZScore,
      mirwaldOffset,
      mirwaldAphv,
      mooreOffset,
      mooreAphv,
      fransenRatio,
      fransenAphv,
      fransenOffset,
      kozielMalinaPahCm,
      kozielMalinaPercentageAdultHeight,
      sherarOffset,
    },
    classification: {
      maturityBand: classifyBand(primaryOffset),
      pahBand: classifyPahBand(percentageAdultHeight ?? kozielMalinaPercentageAdultHeight),
      primaryOffset,
      whoBmiZScore,
    },
    warnings,
    algorithmVersion: "2026.04-excel-aligned-v1",
  };
}
