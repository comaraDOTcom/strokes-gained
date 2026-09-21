import { describe, expect, it, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { feetToYards } from '../units';
import { freshDb, makeUser } from '../../db/test-helpers';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

describe('recomputeRound — DB-backed, golden hole (Elm Park Blue hole 2)', () => {
  it('persists sg/category/baselineId matching the hand-derived golden numbers', async () => {
    const ctx = await freshDb();
    closers.push(ctx.closeDb);
    const { db, schema } = ctx;
    const { recomputeRound } = await import('./recompute');
    const owner = await makeUser(ctx, 'owner');

    const [course] = await db.insert(schema.courses).values({ name: 'Elm Park', location: 'Dublin' }).returning();
    const [tee] = await db
      .insert(schema.tees)
      .values({
        courseId: course!.id,
        name: 'Blue',
        gender: 'M',
        distanceUnit: 'yards',
        courseRating: 68.5,
        slopeRating: 118,
        expectedTotalYards: 6006,
        expectedPar: 69,
      })
      .returning();
    await db.insert(schema.teeHoles).values({ teeId: tee!.id, holeNo: 2, par: 4, strokeIndex: 2, yards: 413 });

    const [round] = await db
      .insert(schema.rounds)
      .values({ userId: owner.id, courseId: course!.id, teeId: tee!.id, playedOn: '2026-01-01' })
      .returning();

    // Storage is canonically yards, even for GREEN — 20ft is stored as 20/3 yards.
    await db.insert(schema.shots).values([
      {
        roundId: round!.id, holeNo: 2, shotNo: 1,
        startLie: 'TEE', startYards: 413,
        endLie: 'FAIRWAY', endYards: 150,
        holed: false, penaltyStrokes: 0, penaltyType: null,
      },
      {
        roundId: round!.id, holeNo: 2, shotNo: 2,
        startLie: 'FAIRWAY', startYards: 150,
        endLie: 'GREEN', endYards: feetToYards(20),
        holed: false, penaltyStrokes: 0, penaltyType: null,
      },
      {
        roundId: round!.id, holeNo: 2, shotNo: 3,
        startLie: 'GREEN', startYards: feetToYards(20),
        endLie: null, endYards: 0,
        holed: true, penaltyStrokes: 0, penaltyType: null,
      },
    ]);

    await recomputeRound(round!.id);

    const stored = (await db.select().from(schema.shots).where(eq(schema.shots.roundId, round!.id))).sort(
      (a, b) => a.shotNo - b.shotNo,
    );

    expect(stored).toHaveLength(3);
    expect(stored[0]!.sg).toBeCloseTo(0.032, 3);
    expect(stored[0]!.category).toBe('OFF_THE_TEE');
    expect(stored[1]!.sg).toBeCloseTo(0.18, 3);
    expect(stored[1]!.category).toBe('APPROACH');
    expect(stored[2]!.sg).toBeCloseTo(0.93, 3);
    expect(stored[2]!.category).toBe('PUTTING');
    for (const shot of stored) expect(shot.baselineId).toBe('scratch-v1');

    const total = stored.reduce((sum, s) => sum + (s.sg ?? 0), 0);
    expect(total).toBeCloseTo(1.142, 3);

    // Fractional yards must survive the round trip at full double precision
    // (pg `real` would return 6.666667 and break this).
    expect(stored[1]!.endYards).toBe(feetToYards(20));
  });

  it('only writes shots whose derived values changed', async () => {
    const ctx = await freshDb();
    closers.push(ctx.closeDb);
    const { db, schema } = ctx;
    const { recomputeRound } = await import('./recompute');
    const owner = await makeUser(ctx, 'owner');
    const [course] = await db.insert(schema.courses).values({ name: 'C' }).returning();
    const [tee] = await db
      .insert(schema.tees)
      .values({ courseId: course!.id, name: 'T', gender: 'M', distanceUnit: 'yards' })
      .returning();
    await db.insert(schema.teeHoles).values({ teeId: tee!.id, holeNo: 1, par: 4, strokeIndex: 1, yards: 400 });
    const [round] = await db
      .insert(schema.rounds)
      .values({ userId: owner.id, courseId: course!.id, teeId: tee!.id, playedOn: '2026-01-01' })
      .returning();
    await db.insert(schema.shots).values([
      { roundId: round!.id, holeNo: 1, shotNo: 1, startLie: 'TEE', startYards: 400, endLie: 'FAIRWAY', endYards: 120, holed: false },
      { roundId: round!.id, holeNo: 1, shotNo: 2, startLie: 'FAIRWAY', startYards: 120, endLie: null, endYards: 0, holed: true },
    ]);

    await recomputeRound(round!.id);
    const first = await db.select().from(schema.shots).where(eq(schema.shots.roundId, round!.id));
    await recomputeRound(round!.id); // idempotent
    const second = await db.select().from(schema.shots).where(eq(schema.shots.roundId, round!.id));
    expect(second.map((s) => [s.id, s.sg, s.category])).toEqual(first.map((s) => [s.id, s.sg, s.category]));
  });
});
