// SITAR (SuperImposition by Translation and Rotation) Constants
// Based on elite male football players (Monasterio et al., 2026, SPSR 287)
// Updated from Berkeley dataset: meanAphv 13.8→13.5, meanPhv 9.5→10.1, meanAdultHeight 180.0→179.5
// The Berkeley dataset introduced a systematic bias of −1.08 cm/year in PHV vs. this football-specific dataset.

export const SITAR_BASE = {
  meanAphv: 13.5,       // Monasterio (2026): 13.5 vs Berkeley 13.8
  meanPhv: 10.1,        // Monasterio (2026): 10.1 vs Berkeley 9.5 — corrects −1.08 cm/year bias
  meanAdultHeight: 179.5, // Monasterio (2026): 179.5 vs Berkeley 180.0
};

// ---------------------------------------------------------------------------
// Growth rate categorisation (cm/year)
// Source: Monasterio, X., Cumming, S.P., Larruskain, J., Johnson, D.M., Gil, S.M.,
// Bidaurrazaga-Letona, I., Lekue, J.A., Diaz-Beitia, G., Santisteban, J.M., & Williams, S. (2023).
// The combined effects of growth and maturity status on injury risk in an elite football academy.
// Biology of Sport, 41(1), 235–244. https://doi.org/10.5114/biolsport.2024.129472
//
// Growth rate was categorised into three groups: fast (> 7.2 cm/year),
// moderate (3.5–7.2 cm/year) and slow (< 3.5 cm/year).
// ---------------------------------------------------------------------------

export const GROWTH_RATE_THRESHOLDS_CM_PER_YEAR = {
  fast: 7.2,    // > 7.2 cm/year
  slow: 3.5,    // < 3.5 cm/year (3.5–7.2 cm/year = moderate)
};

export type GrowthRateCategory = "fast" | "moderate" | "slow";

/**
 * Categorises a growth velocity (cm/year) into fast / moderate / slow bands
 * following Monasterio et al. (2024, Biology of Sport).
 */
export function categorizeGrowthRate(cmPerYear: number): GrowthRateCategory {
  if (cmPerYear > GROWTH_RATE_THRESHOLDS_CM_PER_YEAR.fast) return "fast";
  if (cmPerYear < GROWTH_RATE_THRESHOLDS_CM_PER_YEAR.slow) return "slow";
  return "moderate";
}

/**
 * Returns the mean stature M(t) at a given age `t`.
 * This is a simplified logistical/spline approximation of the mean growth curve
 * for male football players (updated spline nodes calibrated to meanAphv=13.5, meanPhv=10.1).
 */
export function getMeanStature(age: number): number {
  // Spline lookup calibrated to Monasterio (2026) parameters:
  // PHV peak at ~13.5 years, max velocity ~10.1 cm/year, adult height ~179.5 cm
  const splineNodes = [
    { age: 5,  height: 110.0 },
    { age: 6,  height: 116.0 },
    { age: 7,  height: 122.0 },
    { age: 8,  height: 128.0 },
    { age: 9,  height: 133.5 },
    { age: 10, height: 138.5 },
    { age: 11, height: 144.0 },
    { age: 12, height: 150.5 },
    { age: 13, height: 158.5 }, // Acceleration — PHV now at ~13.5 (shifted −0.3 from Berkeley)
    { age: 14, height: 167.5 }, // PHV ~10.1 cm/year (peak between 13–14)
    { age: 15, height: 173.5 }, // Deceleration
    { age: 16, height: 177.0 },
    { age: 17, height: 178.8 },
    { age: 18, height: 179.3 },
    { age: 19, height: 179.5 },
    { age: 25, height: 179.5 },
  ];

  if (age <= splineNodes[0].age) return splineNodes[0].height;
  if (age >= splineNodes[splineNodes.length - 1].age) return splineNodes[splineNodes.length - 1].height;

  for (let i = 0; i < splineNodes.length - 1; i++) {
    const p1 = splineNodes[i];
    const p2 = splineNodes[i + 1];
    if (age >= p1.age && age <= p2.age) {
      const t = (age - p1.age) / (p2.age - p1.age);
      return p1.height + t * (p2.height - p1.height);
    }
  }

  return 179.5;
}