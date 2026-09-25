/**
 * Signal strength: is a change in strokes gained real, or just a few shots
 * going one way? Shared by the category trend and the roadmap (What to work
 * on) on `/trends`. Lives in its own file so `roadmap.ts` and `trends.ts`
 * don't import each other.
 */

export type SignalStrength = 'signal' | 'limited' | 'noise';

/**
 * A practical heuristic, not a rigorous statistical test (BUILD.md asks for
 * "a signal-strength indicator from shot count and variance", not a named
 * procedure). Converts the round-level latest-vs-prior delta into a
 * per-shot rate delta, estimates its standard error from the observed
 * per-shot SG variance in the prior window, and buckets the resulting
 * z-like score — gated by minimum shot counts so a handful of shots can
 * never be labelled anything but noise, regardless of how large the swing
 * looks. This is exactly the failure mode BUILD.md calls out: "a 0.3-stroke
 * move on 6 [bunker] shots must be labelled noise, not improvement."
 */
export function classifySignalStrength(
  latestSg: number,
  latestShotCount: number,
  priorShots: number[], // individual per-shot SG values from the prior window, pooled
): SignalStrength {
  const priorCount = priorShots.length;
  if (latestShotCount < 5 || priorCount < 5) return 'noise';

  const priorMean = priorShots.reduce((a, b) => a + b, 0) / priorCount;
  const variance = priorShots.reduce((a, b) => a + (b - priorMean) ** 2, 0) / Math.max(1, priorCount - 1);
  const stdev = Math.sqrt(variance);

  if (stdev === 0) return latestShotCount >= 10 && priorCount >= 10 ? 'signal' : 'limited';

  const latestRate = latestSg / latestShotCount;
  const priorRate = priorMean;
  const se = stdev * Math.sqrt(1 / latestShotCount + 1 / priorCount);
  const z = se > 0 ? Math.abs(latestRate - priorRate) / se : 0;

  if (z >= 2 && latestShotCount >= 10 && priorCount >= 10) return 'signal';
  if (z >= 1 && latestShotCount >= 8 && priorCount >= 8) return 'limited';
  return 'noise';
}
