import { describe, expect, it, afterEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, makeUser } from '../../db/test-helpers';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

async function arrange() {
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const { db, schema } = ctx;
  const { recomputeRound } = await import('../sg/recompute');
  const { applyTeeHoleEdits } = await import('./tee-edit');
  const owner = await makeUser(ctx, 'owner');
  const [course] = await db.insert(schema.courses).values({ name: 'C' }).returning();
  const [tee] = await db
    .insert(schema.tees)
    .values({ courseId: course!.id, name: 'T', gender: 'M', distanceUnit: 'yards' })
    .returning();
  await db.insert(schema.teeHoles).values([
    { teeId: tee!.id, holeNo: 1, par: 4, strokeIndex: 1, yards: 400 },
    { teeId: tee!.id, holeNo: 2, par: 3, strokeIndex: 2, yards: 150 },
  ]);
  const [round] = await db
    .insert(schema.rounds)
    .values({ userId: owner.id, courseId: course!.id, teeId: tee!.id, playedOn: '2026-01-01' })
    .returning();
  return { ...ctx, recomputeRound, applyTeeHoleEdits, tee: tee!, round: round! };
}

const holes = (h1yards: number, h1par = 4) => [
  { holeNo: 1, par: h1par, strokeIndex: 1, yards: h1yards },
  { holeNo: 2, par: 3, strokeIndex: 2, yards: 150 },
];

describe('applyTeeHoleEdits — editing a tee that already has rounds', () => {
  it('rebases shot 1 and keeps SG recomputable when a yardage changes (used to throw)', async () => {
    const { db, schema, recomputeRound, applyTeeHoleEdits, tee, round } = await arrange();
    await db.insert(schema.shots).values([
      { roundId: round.id, holeNo: 1, shotNo: 1, startLie: 'TEE', startYards: 400, endLie: 'FAIRWAY', endYards: 150, holed: false },
      { roundId: round.id, holeNo: 1, shotNo: 2, startLie: 'FAIRWAY', startYards: 150, endLie: null, endYards: 0, holed: true },
    ]);
    await recomputeRound(round.id);
    const before = (await db.select().from(schema.shots).where(eq(schema.shots.roundId, round.id))).sort((a, b) => a.shotNo - b.shotNo);

    const result = await db.transaction((tx) => applyTeeHoleEdits(tx, tee.id, holes(430)));
    expect(result.roundsRecomputed).toBe(1);

    const after = (await db.select().from(schema.shots).where(eq(schema.shots.roundId, round.id))).sort((a, b) => a.shotNo - b.shotNo);
    expect(after[0]!.startYards).toBe(430);
    expect(after[0]!.endYards).toBe(150); // the result the player entered is untouched
    expect(after[1]!.startYards).toBe(150);
    expect(after[0]!.sg).not.toBe(before[0]!.sg); // a longer hole changes the tee shot's SG
    const [hole] = await db.select().from(schema.teeHoles).where(eq(schema.teeHoles.id, (await db.select().from(schema.teeHoles).where(eq(schema.teeHoles.teeId, tee.id))).find((h) => h.holeNo === 1)!.id));
    expect(hole!.yards).toBe(430);

    // And the round is still recomputable afterwards.
    await expect(recomputeRound(round.id)).resolves.toBeUndefined();
  });

  it('carries the change through a stroke-and-distance first shot', async () => {
    const { db, schema, recomputeRound, applyTeeHoleEdits, tee, round } = await arrange();
    await db.insert(schema.shots).values([
      { roundId: round.id, holeNo: 1, shotNo: 1, startLie: 'TEE', startYards: 400, endLie: 'TEE', endYards: 400, holed: false, penaltyStrokes: 1, penaltyType: 'STROKE_AND_DISTANCE' },
      { roundId: round.id, holeNo: 1, shotNo: 2, startLie: 'TEE', startYards: 400, endLie: 'FAIRWAY', endYards: 130, holed: false },
      { roundId: round.id, holeNo: 1, shotNo: 3, startLie: 'FAIRWAY', startYards: 130, endLie: null, endYards: 0, holed: true },
    ]);
    await recomputeRound(round.id);
    await db.transaction((tx) => applyTeeHoleEdits(tx, tee.id, holes(415)));

    const after = (await db.select().from(schema.shots).where(eq(schema.shots.roundId, round.id))).sort((a, b) => a.shotNo - b.shotNo);
    expect(after[0]).toMatchObject({ startYards: 415, endYards: 415 });
    expect(after[1]).toMatchObject({ startYards: 415, endYards: 130 });
    await expect(recomputeRound(round.id)).resolves.toBeUndefined();
  });

  it('a par change alone reclassifies via recompute and leaves yardages alone', async () => {
    const { db, schema, recomputeRound, applyTeeHoleEdits, tee, round } = await arrange();
    await db.insert(schema.shots).values([
      { roundId: round.id, holeNo: 1, shotNo: 1, startLie: 'TEE', startYards: 400, endLie: 'FAIRWAY', endYards: 150, holed: false },
      { roundId: round.id, holeNo: 1, shotNo: 2, startLie: 'FAIRWAY', startYards: 150, endLie: null, endYards: 0, holed: true },
    ]);
    await recomputeRound(round.id);
    const r = await db.transaction((tx) => applyTeeHoleEdits(tx, tee.id, holes(400, 5)));
    expect(r.roundsRecomputed).toBe(1);
    const after = await db.select().from(schema.shots).where(eq(schema.shots.roundId, round.id));
    expect(after.every((s) => s.startYards === 400 || s.startYards === 150)).toBe(true);
  });

  it('does nothing (and recomputes nothing) when only the stroke index changes', async () => {
    const { db, applyTeeHoleEdits, tee } = await arrange();
    const r = await db.transaction((tx) =>
      applyTeeHoleEdits(tx, tee.id, [
        { holeNo: 1, par: 4, strokeIndex: 9, yards: 400 },
        { holeNo: 2, par: 3, strokeIndex: 2, yards: 150 },
      ]),
    );
    expect(r.roundsRecomputed).toBe(0);
  });

  it('is atomic: a failing recompute rolls back the yardage edit', async () => {
    const { db, schema, applyTeeHoleEdits, tee, round } = await arrange();
    // A shot on a hole that has no tee_holes row makes recomputeRound throw.
    await db.insert(schema.shots).values({
      roundId: round.id, holeNo: 9, shotNo: 1, startLie: 'TEE', startYards: 300, endLie: null, endYards: 0, holed: true,
    });
    await expect(db.transaction((tx) => applyTeeHoleEdits(tx, tee.id, holes(500)))).rejects.toThrow();
    const rows = await db.select().from(schema.teeHoles).where(eq(schema.teeHoles.teeId, tee.id));
    expect(rows.find((h) => h.holeNo === 1)!.yards).toBe(400); // unchanged
  });
});
