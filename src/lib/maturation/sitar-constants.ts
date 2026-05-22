// SITAR (SuperImposition by Translation and Rotation) Constants
// Based on typical parameters for Elite Male Football Players
// APHV ~ 13.8 years, PHV ~ 9.5 cm/year, Adult Height ~ 180cm

export const SITAR_BASE = {
  meanAphv: 13.8,
  meanPhv: 9.5,
  meanAdultHeight: 180.0,
};

/**
 * Returns the mean stature M(t) at a given age `t`.
 * This is a simplified logistical/spline approximation of the mean growth curve
 * for male football players.
 * 
 * Formula (Preece-Baines type 1 curve approx):
 * h(t) = h_1 - (2 * (h_1 - h_theta)) / (exp(s_0 * (t - theta)) + exp(s_1 * (t - theta)))
 * 
 * We use a simplified Gompertz or logistic function that matches the normative PHV.
 */
export function getMeanStature(age: number): number {
  // Logistic approximation
  // Height = Asymptote / (1 + exp(-k * (t - t0)))
  // To make it more realistic for childhood + puberty, we use a double logistic or just a tuned single for puberty.
  
  // Very rough approximation focused on the pubertal spurt (ages 10-18)
  const adultHeight = SITAR_BASE.meanAdultHeight;
  const t0 = SITAR_BASE.meanAphv;
  // Maximum slope at t0 is AdultHeight * k / 4. 
  // We want max slope (PHV) to be 9.5. 
  // 9.5 = 180 * k / 4 => k = 38 / 180 = 0.211
  // But children are not 0 cm at age 0. 
  
  // Let's use a simpler known standard growth model approximation:
  // Base height before spurt + spurt
  const baseGrowth = 50 + 6 * age; // Simple linear for childhood
  const spurt = 40 / (1 + Math.exp(-0.8 * (age - t0))); 
  
  // Tuned curve to reach ~180
  // At age 18: 50 + 108 + 40/(1+exp(-3.36)) = 158 + 38 = 196 (too high)
  
  // Instead, let's use a simple lookup table with linear interpolation for the mean curve,
  // which is much safer and closer to actual natural cubic splines used in SITAR.
  const splineNodes = [
    { age: 5, height: 110.0 },
    { age: 6, height: 116.0 },
    { age: 7, height: 122.0 },
    { age: 8, height: 128.0 },
    { age: 9, height: 133.5 },
    { age: 10, height: 138.5 },
    { age: 11, height: 144.0 },
    { age: 12, height: 150.0 },
    { age: 13, height: 158.0 }, // Acceleration
    { age: 14, height: 167.0 }, // Peak velocity around 13.8
    { age: 15, height: 173.0 }, // Deceleration
    { age: 16, height: 176.5 },
    { age: 17, height: 178.5 },
    { age: 18, height: 179.5 },
    { age: 19, height: 180.0 },
    { age: 25, height: 180.0 },
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

  return 180;
}
