import type { MaturationResult, SitarOutputs } from "@/lib/types";
import { getMeanStature, SITAR_BASE } from "./sitar-constants";

/**
 * Runs the SITAR optimizer to find individual parameters a, b, c
 * a: size shift (cm)
 * b: timing shift (years) — b < 0 = early maturer, b > 0 = late maturer
 * c: velocity shift (fractional)
 *
 * Model: y_i = a + M((t_i - b) * exp(c))
 *
 * Fixes vs. original:
 *  1. bRange extended from ±1.5 to ±3.0 years so extreme early/late maturers
 *     are captured correctly (grid was the starting point for hill climbing;
 *     clamping it at ±1.5 caused the optimizer to converge to the wrong local region).
 *  2. Hill climbing now evaluates ALL neighbour directions each iteration and picks
 *     the best one (steepest descent), instead of breaking on the first improvement.
 *     This eliminates premature convergence when 'a' kept winning over 'b' steps.
 *  3. Iterations raised from 100 → 200 and convergence threshold tightened
 *     from 0.001 → 0.0005 for better precision at no meaningful cost.
 */
export function runSitarOptimization(history: MaturationResult[]): SitarOutputs | undefined {
  if (history.length < 3) return undefined;

  const points = history.map(r => ({
    t: r.derivedMetrics.chronologicalAge,
    y: r.inputs.statureCm,
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

  // Grid search for initial approximation.
  // bRange extended to ±3.0 years — covers virtually all realistic cases
  // (95th percentile maturity timing range is ~±2 years around the mean).
  const aRange = [-15, -10, -5, 0, 5, 10, 15];
  const bRange = [-3.0, -2.5, -2.0, -1.5, -1.0, -0.5, 0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0];
  const cRange = [-0.2, -0.1, 0, 0.1, 0.2];

  let bestA = 0, bestB = 0, bestC = 0;
  let minLoss = Infinity;

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

  // Steepest-descent hill climbing.
  // Each iteration evaluates all 6 neighbours and picks the best move
  // (rather than breaking on the first improvement), which prevents 'a'
  // updates from blocking 'b' from reaching its true minimum.
  let step = 1.0;
  let a = bestA;
  let b = bestB;
  let c = bestC;

  for (let iteration = 0; iteration < 200; iteration++) {
    const neighbours = [
      { da: step,       db: 0,          dc: 0 },
      { da: -step,      db: 0,          dc: 0 },
      { da: 0,          db: step * 0.1, dc: 0 },
      { da: 0,          db: -step * 0.1, dc: 0 },
      { da: 0,          db: 0,          dc: step * 0.01 },
      { da: 0,          db: 0,          dc: -step * 0.01 },
    ];

    let bestNeighborLoss = minLoss;
    let bestDA = 0, bestDB = 0, bestDC = 0;

    for (const s of neighbours) {
      const loss = mse(a + s.da, b + s.db, c + s.dc);
      if (loss < bestNeighborLoss) {
        bestNeighborLoss = loss;
        bestDA = s.da;
        bestDB = s.db;
        bestDC = s.dc;
      }
    }

    if (bestNeighborLoss < minLoss) {
      minLoss = bestNeighborLoss;
      a += bestDA;
      b += bestDB;
      c += bestDC;
    } else {
      step *= 0.5; // No improvement in any direction — reduce step size
    }

    if (step < 0.0005) break; // Converged
  }

  // Individual APHV = meanAphv + b
  // (b is the timing shift: negative = earlier than average, positive = later)
  const sitarAphv = SITAR_BASE.meanAphv + b;

  // Individual PHV = meanPhv * exp(-c)
  // (Time is stretched by exp(c), so velocity is scaled by exp(-c))
  const sitarPhv = SITAR_BASE.meanPhv * Math.exp(-c);

  // Individual PAH = a + meanAdultHeight
  const sitarPah = a + SITAR_BASE.meanAdultHeight;

  return {
    sitarAphv,
    sitarPhv,
    sitarPah,
    sitarActive: true,
  };
}