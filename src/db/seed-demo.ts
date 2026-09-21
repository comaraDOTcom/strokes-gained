/**
 * `pnpm db:seed:demo` — BUILD.md Verification step 3.
 *
 * Builds one synthetic, fully hand-worked 18-hole round on Elm Park Blue in
 * a throwaway in-memory Postgres (PGlite — never touches your real DB), writes it through
 * the exact same code path the app uses (insertCourse -> insert shots ->
 * recomputeRound), then asserts the Phase 4 dashboard aggregates
 * (`src/lib/insights`) match the hand-computed totals below. Exits
 * non-zero with a diff on any mismatch — same "fail loudly" contract as
 * `db:seed`'s checksum validation.
 *
 * The single source of truth for each hole is the `HOLES` table below: one
 * entry per hole with its shot-by-shot outcomes. The exact same outcomes
 * are used to (a) build the DB rows that go through recomputeRound(), and
 * (b) build a ShotInput[] fed directly to computeHole() with no DB
 * involved at all — so the assertions cross-check the DB/query pipeline
 * against the pure engine, not just against itself.
 */
import type { ShotInput } from '../lib/sg/compute';

// Must be set before ./client is first imported (it is, dynamically, in main()).
process.env.PGLITE_DIR = 'memory://';
delete process.env.DATABASE_URL;

type Outcome = {
  endLie: 'TEE' | 'FAIRWAY' | 'ROUGH' | 'SAND' | 'RECOVERY' | 'GREEN' | null;
  /** Display units: feet if endLie is GREEN, yards otherwise. Ignored (and
   * forced back to the start position) when penaltyType is STROKE_AND_DISTANCE. */
  endDistance: number;
  holed?: boolean;
  penaltyStrokes?: number;
  penaltyType?: 'LATERAL' | 'STROKE_AND_DISTANCE' | null;
};

type HoleSpec = { holeNo: number; par: number; yards: number; steps: Outcome[] };

// Hand-worked shot-by-shot plan. Each hole's rationale for the traditional
// stats it's designed to produce is in the comment above it; the full
// hand-derived round-level totals are asserted at the bottom of this file.
const HOLES: HoleSpec[] = [
  // Par, GIR via tee shot, 2-putt.
  { holeNo: 1, par: 3, yards: 127, steps: [
    { endLie: 'GREEN', endDistance: 15 },
    { endLie: 'GREEN', endDistance: 3 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // The Phase 1 golden hole (Elm Park Blue hole 2) — birdie, fairway hit, GIR, 1-putt.
  { holeNo: 2, par: 4, yards: 413, steps: [
    { endLie: 'FAIRWAY', endDistance: 150 },
    { endLie: 'GREEN', endDistance: 20 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway miss (rough) but still GIR in 2 — birdie, 1-putt.
  { holeNo: 3, par: 4, yards: 406, steps: [
    { endLie: 'ROUGH', endDistance: 150 },
    { endLie: 'GREEN', endDistance: 10 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway hit, greenside sand miss, SUCCESSFUL sand save for par.
  { holeNo: 4, par: 4, yards: 425, steps: [
    { endLie: 'FAIRWAY', endDistance: 200 },
    { endLie: 'SAND', endDistance: 15 },
    { endLie: 'GREEN', endDistance: 4 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway hit, GIR, 2-putt par.
  { holeNo: 5, par: 4, yards: 358, steps: [
    { endLie: 'FAIRWAY', endDistance: 120 },
    { endLie: 'GREEN', endDistance: 25 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Miss green (rough), SUCCESSFUL up-and-down (not sand) for par.
  { holeNo: 6, par: 3, yards: 142, steps: [
    { endLie: 'ROUGH', endDistance: 20 },
    { endLie: 'GREEN', endDistance: 6 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Par 5, drive into a FAIRWAY (>30y) bunker, still reaches green in 3 -> GIR, par.
  { holeNo: 7, par: 5, yards: 466, steps: [
    { endLie: 'FAIRWAY', endDistance: 220 },
    { endLie: 'SAND', endDistance: 40 },
    { endLie: 'GREEN', endDistance: 15 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Tee to green (GIR), 3-putt bogey.
  { holeNo: 8, par: 3, yards: 187, steps: [
    { endLie: 'GREEN', endDistance: 30 },
    { endLie: 'GREEN', endDistance: 5 },
    { endLie: 'GREEN', endDistance: 1 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Par 5, drive+layup in fairway, 3rd shot blocked out (RECOVERY) — the
  // punch-out lie itself. FAILED up-and-down (3 shots from the miss, and
  // gross > par anyway) — double bogey.
  { holeNo: 9, par: 5, yards: 524, steps: [
    { endLie: 'FAIRWAY', endDistance: 250 },
    { endLie: 'FAIRWAY', endDistance: 60 },
    { endLie: 'RECOVERY', endDistance: 30 },
    { endLie: 'GREEN', endDistance: 10 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // OB tee shot (stroke-and-distance), fairway miss on the re-tee's own
  // record (endLie forced to TEE), then FAILED up-and-down — double bogey.
  { holeNo: 10, par: 4, yards: 450, steps: [
    { endLie: null, endDistance: 0, penaltyStrokes: 1, penaltyType: 'STROKE_AND_DISTANCE' },
    { endLie: 'FAIRWAY', endDistance: 200 },
    { endLie: 'GREEN', endDistance: 20 },
    { endLie: 'GREEN', endDistance: 3 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway hit, GIR, 2-putt par.
  { holeNo: 11, par: 4, yards: 361, steps: [
    { endLie: 'FAIRWAY', endDistance: 100 },
    { endLie: 'GREEN', endDistance: 15 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Tee to green, 2-putt par.
  { holeNo: 12, par: 3, yards: 183, steps: [
    { endLie: 'GREEN', endDistance: 20 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway hit, GIR, 2-putt par.
  { holeNo: 13, par: 4, yards: 341, steps: [
    { endLie: 'FAIRWAY', endDistance: 90 },
    { endLie: 'GREEN', endDistance: 12 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway miss (rough), still GIR in 2, 2-putt par.
  { holeNo: 14, par: 4, yards: 365, steps: [
    { endLie: 'ROUGH', endDistance: 140 },
    { endLie: 'GREEN', endDistance: 25 },
    { endLie: 'GREEN', endDistance: 3 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Short par 4, fairway hit, GIR, 1-putt birdie.
  { holeNo: 15, par: 4, yards: 309, steps: [
    { endLie: 'FAIRWAY', endDistance: 60 },
    { endLie: 'GREEN', endDistance: 10 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Fairway hit, greenside sand miss, FAILED sand save (3 shots from the
  // miss) — bogey.
  { holeNo: 16, par: 4, yards: 347, steps: [
    { endLie: 'FAIRWAY', endDistance: 100 },
    { endLie: 'SAND', endDistance: 10 },
    { endLie: 'GREEN', endDistance: 15 },
    { endLie: 'GREEN', endDistance: 3 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Long par 3, greenside sand off the tee, SUCCESSFUL sand save for par.
  { holeNo: 17, par: 3, yards: 212, steps: [
    { endLie: 'SAND', endDistance: 8 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
  // Closing hole: fairway hit, GIR, 2-putt par.
  { holeNo: 18, par: 4, yards: 390, steps: [
    { endLie: 'FAIRWAY', endDistance: 150 },
    { endLie: 'GREEN', endDistance: 20 },
    { endLie: 'GREEN', endDistance: 2 },
    { endLie: null, endDistance: 0, holed: true },
  ] },
];

type Lie = 'TEE' | 'FAIRWAY' | 'ROUGH' | 'SAND' | 'RECOVERY' | 'GREEN';

let failures = 0;
function assertEqual(label: string, actual: unknown, expected: unknown, tolerance = 0) {
  const ok =
    typeof actual === 'number' && typeof expected === 'number'
      ? Math.abs(actual - expected) <= tolerance
      : JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`[db:seed:demo] FAIL ${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  } else {
    console.log(`[db:seed:demo] ok   ${label} = ${JSON.stringify(actual)}`);
  }
}

async function main() {
  const { feetToYards, yardsToFeet } = await import('../lib/units');
  const { db, closeDb } = await import('./client');
  const { runMigrations } = await import('./migrate');
  const schema = await import('./schema');
  const { eq } = await import('drizzle-orm');
  const { ELM_PARK } = await import('./seed-courses');
  const { insertCourse } = await import('./insert-course');
  const { recomputeRound } = await import('../lib/sg/recompute');
  const { computeHole } = await import('../lib/sg/compute');
  const { roundSummaries } = await import('../lib/insights/aggregate');
  const { getAllEnrichedShots } = await import('../lib/insights/queries');

  await runMigrations();

  const [demoUser] = await db
    .insert(schema.user)
    .values({ id: 'demo-user', name: 'Demo', email: 'demo@example.com', emailVerified: true })
    .returning();
  const courseId = await insertCourse(ELM_PARK);
  const blueTee = (await db.select().from(schema.tees).where(eq(schema.tees.courseId, courseId))).find(
    (t) => t.name === 'Blue',
  )!;

  const [round] = await db
    .insert(schema.rounds)
    .values({
      userId: demoUser!.id,
      courseId,
      teeId: blueTee.id,
      playedOn: '2026-01-01',
      notes: 'db:seed:demo synthetic round',
    })
    .returning();
  if (!round) throw new Error('failed to insert demo round');

  // Build DB rows AND the pure-engine ShotInput[] from the same HOLES spec.
  let handGrossTotal = 0;
  let handParTotal = 0;
  let independentSgTotal = 0;
  const independentSgByCategory: Record<string, number> = {};

  for (const hole of HOLES) {
    let curLie: Lie = 'TEE';
    let curYards = hole.yards;
    const dbRows: (typeof schema.shots.$inferInsert)[] = [];
    const engineInputs: ShotInput[] = [];

    hole.steps.forEach((step, i) => {
      const shotNo = i + 1;
      const startLie = curLie;
      const startYards = curYards;

      let endLie: Lie | null;
      let endYards: number;
      let holed = step.holed ?? false;
      const penaltyStrokes = step.penaltyStrokes ?? 0;
      const penaltyType = step.penaltyType ?? null;

      if (penaltyType === 'STROKE_AND_DISTANCE') {
        endLie = startLie;
        endYards = startYards;
        holed = false;
      } else if (holed) {
        endLie = null;
        endYards = 0;
      } else {
        endLie = step.endLie as Lie;
        endYards = endLie === 'GREEN' ? feetToYards(step.endDistance) : step.endDistance;
      }

      dbRows.push({
        roundId: round.id,
        holeNo: hole.holeNo,
        shotNo,
        startLie,
        startYards,
        endLie,
        endYards,
        holed,
        penaltyStrokes,
        penaltyType,
      });

      engineInputs.push({
        holeNo: hole.holeNo,
        shotNo,
        startLie,
        startDistance: startLie === 'GREEN' ? yardsToFeet(startYards) : startYards,
        endLie,
        endDistance: endLie === 'GREEN' ? yardsToFeet(endYards) : endYards,
        holed,
        penaltyStrokes,
        penaltyType,
      });

      curLie = endLie ?? curLie;
      curYards = endYards;
    });

    await db.insert(schema.shots).values(dbRows);

    // Independent cross-check: run the pure engine directly on the same
    // shot chain, with no DB involved, and accumulate its totals.
    const results = computeHole(engineInputs, hole.yards, hole.par);
    for (const r of results) {
      independentSgTotal += r.sg;
      independentSgByCategory[r.category] = (independentSgByCategory[r.category] ?? 0) + r.sg;
    }

    const grossScore = dbRows.length + dbRows.reduce((s, r) => s + r.penaltyStrokes!, 0);
    handGrossTotal += grossScore;
    handParTotal += hole.par;
  }

  await recomputeRound(round.id);

  const shots = await getAllEnrichedShots(demoUser!.id);
  const [summary] = roundSummaries(shots);
  if (!summary) {
    console.error('[db:seed:demo] FAIL: roundSummaries returned nothing for the seeded round.');
    process.exitCode = 1;
    return;
  }

  console.log(`[db:seed:demo] Seeded round ${round.id} on ${ELM_PARK.name} Blue with ${shots.length} shots.\n`);

  // --- Hand-computed totals (see the per-hole comments in HOLES above) ---
  assertEqual('gross score total', summary.grossScore, 71);
  assertEqual('gross score matches hand total', summary.grossScore, handGrossTotal);
  assertEqual('par total', summary.par, 69);
  assertEqual('par total matches hand total', summary.par, handParTotal);
  assertEqual('GIR count/18', summary.traditional.girCount, 12);
  assertEqual('putts total', summary.traditional.putts, 31);
  assertEqual('fairways hit', summary.traditional.fairwaysHit, 10);
  assertEqual('fairways eligible', summary.traditional.fairwaysTotal, 13);
  assertEqual('up-and-down attempted', summary.traditional.upAndDown.attempted, 6);
  assertEqual('up-and-down converted', summary.traditional.upAndDown.converted, 3);
  assertEqual('sand save attempted', summary.traditional.sandSave.attempted, 3);
  assertEqual('sand save converted', summary.traditional.sandSave.converted, 2);

  const penaltyStrokesTotal = shots.reduce((s, x) => s + x.penaltyStrokes, 0);
  assertEqual('penalty strokes total', penaltyStrokesTotal, 1);
  const recoveryShotCount = shots.filter((s) => s.startLie === 'RECOVERY').length;
  assertEqual('recovery shot count', recoveryShotCount, 1);

  // --- Cross-check: DB/aggregate pipeline vs. the pure engine, independently computed ---
  assertEqual('SG total: aggregate.roundSummaries vs. pure computeHole', summary.sgTotal, independentSgTotal, 1e-6);
  for (const category of Object.keys(independentSgByCategory)) {
    assertEqual(
      `SG[${category}]: aggregate.roundSummaries vs. pure computeHole`,
      summary.sgByCategory[category as keyof typeof summary.sgByCategory],
      independentSgByCategory[category],
      1e-6,
    );
  }

  console.log('');
  if (failures > 0) {
    console.error(`[db:seed:demo] FAILED — ${failures} assertion(s) did not match.`);
    process.exitCode = 1;
  } else {
    console.log('[db:seed:demo] All dashboard aggregates match the hand-computed totals.');
  }

  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

export {};
