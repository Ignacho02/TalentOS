import type { MaturationResult, SitarOutputs } from "@/lib/types";
import { getMeanStature, SITAR_BASE } from "./sitar-constants";

/**
 * Runs the SITAR optimizer to find individual parameters a, b, c
 * a: size shift (cm)
 * b: timing shift (years)
 * c: velocity shift (fractional)
 * 
 * y_i = a + M((t_i - b) * exp(c))
 */
export function runSitarOptimization(history: MaturationResult[]): SitarOutputs | undefined {
  if (history.length < 3) return undefined;

  const points = history.map(r => ({
    t: r.derivedMetrics.chronologicalAge,
    y: r.inputs.statureCm
  }));

  // Loss function: Mean Squared Error
  function mse(a: number, b: number, c: number): number {
    let sum = 0;
    const expC = Math.exp(c);
    for (const p of points) {
      const adjustedTime = (p.t - b) * expC;
      const expectedHeight = a + getMeanStature(adjustedTime);
      const error = expectedHeight - p.y;
      sum += error * error;
    }
    return sum / points.length;
  }

  // Grid Search for initial approximation
  let bestA = 0, bestB = 0, bestC = 0;
  let minLoss = Infinity;

  const aRange = [-15, -10, -5, 0, 5, 10, 15]; // Size difference from average
  const bRange = [-1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5]; // Maturity offset (years)
  const cRange = [-0.2, -0.1, 0, 0.1, 0.2]; // Velocity stretch

  for (const a of aRange) {
    for (const b of bRange) {
      for (const c of cRange) {
        const loss = mse(a, b, c);
        if (loss < minLoss) {
          minLoss = loss;
          bestA = a;
          bestB = b;
          bestC = c;
        }
      }
    }
  }

  // Simple Hill Climbing for fine-tuning
  let step = 1.0;
  let a = bestA;
  let b = bestB;
  let c = bestC;

  for (let iteration = 0; iteration < 100; iteration++) {
    let improved = false;
    const steps = [
      { da: step, db: 0, dc: 0 },
      { da: -step, db: 0, dc: 0 },
      { da: 0, db: step * 0.1, dc: 0 },
      { da: 0, db: -step * 0.1, dc: 0 },
      { da: 0, db: 0, dc: step * 0.01 },
      { da: 0, db: 0, dc: -step * 0.01 },
    ];

    for (const s of steps) {
      const loss = mse(a + s.da, b + s.db, c + s.dc);
      if (loss < minLoss) {
        minLoss = loss;
        a += s.da;
        b += s.db;
        c += s.dc;
        improved = true;
      }
    }

    if (!improved) {
      step *= 0.5; // Reduce step size
    }
    if (step < 0.001) break; // Converged
  }

  // Calculate SITAR specific outputs
  // Individual APHV = meanAphv + b
  const sitarAphv = SITAR_BASE.meanAphv + b;
  
  // Individual PHV = meanPhv * exp(-c)
  // (Because time is stretched by exp(c), velocity is scaled by exp(-c))
  const sitarPhv = SITAR_BASE.meanPhv * Math.exp(-c);

  // Individual PAH = a + meanAdultHeight
  const sitarPah = a + SITAR_BASE.meanAdultHeight;

  return {
    sitarAphv,
    sitarPhv,
    sitarPah,
    sitarActive: true
  };
}
