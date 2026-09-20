import { describe, expect, it, vi, afterEach, afterAll } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { feetToYards } from '../units';

const tmpDirs: string[] = [];

afterEach(() => {
  delete process.env.SG_DB_PATH;
  vi.resetModules();
});

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

async function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-recompute-test-'));
  tmpDirs.push(dir);
  process.env.SG_DB_PATH = path.join(dir, 'test.db');
  vi.resetModules();
  const clientMod = await import('../../db/client');
  const schemaMod = await import('../../db/schema');
  const recomputeMod = await import('./recompute');
  return {
    db: clientMod.db,
    schema: schemaMod,
    recomputeRound: recomputeMod.recomputeRound,
  };
}

describe('recomputeRound — DB-backed, golden hole (Elm Park Blue hole 2)', () => {
  it('persists sg/category/baselineId matching the hand-derived golden numbers', async () => {
    const { db, schema, recomputeRound } = await freshDb();

    const course = db.insert(schema.courses).values({ name: 'Elm Park', location: 'Dublin' }).returning().get();
    const tee = db
      .insert(schema.tees)
      .values({
        courseId: course.id,
        name: 'Blue',
        gender: 'M',
        distanceUnit: 'yards',
        courseRating: 68.5,
        slopeRating: 118,
        expectedTotalYards: 6006,
        expectedPar: 69,
      })
      .returning()
      .get();
    db.insert(schema.teeHoles).values({ teeId: tee.id, holeNo: 2, par: 4, strokeIndex: 2, yards: 413 }).run();

    const round = db
      .insert(schema.rounds)
      .values({ courseId: course.id, teeId: tee.id, playedOn: '2026-01-01' })
      .returning()
      .get();

    // Storage is canonically yards, even for GREEN — 20ft is stored as 20/3 yards.
    db.insert(schema.shots)
      .values([
        {
          roundId: round.id, holeNo: 2, shotNo: 1,
          startLie: 'TEE', startYards: 413,
          endLie: 'FAIRWAY', endYards: 150,
          holed: false, penaltyStrokes: 0, penaltyType: null,
        },
        {
          roundId: round.id, holeNo: 2, shotNo: 2,
          startLie: 'FAIRWAY', startYards: 150,
          endLie: 'GREEN', endYards: feetToYards(20),
          holed: false, penaltyStrokes: 0, penaltyType: null,
        },
        {
          roundId: round.id, holeNo: 2, shotNo: 3,
          startLie: 'GREEN', startYards: feetToYards(20),
          endLie: null, endYards: 0,
          holed: true, penaltyStrokes: 0, penaltyType: null,
        },
      ])
      .run();

    recomputeRound(round.id);

    const stored = db
      .select()
      .from(schema.shots)
      .where(eq(schema.shots.roundId, round.id))
      .all()
      .sort((a: { shotNo: number }, b: { shotNo: number }) => a.shotNo - b.shotNo);

    expect(stored).toHaveLength(3);
    expect(stored[0]!.sg).toBeCloseTo(0.032, 3);
    expect(stored[0]!.category).toBe('OFF_THE_TEE');
    expect(stored[1]!.sg).toBeCloseTo(0.18, 3);
    expect(stored[1]!.category).toBe('APPROACH');
    expect(stored[2]!.sg).toBeCloseTo(0.93, 3);
    expect(stored[2]!.category).toBe('PUTTING');
    for (const shot of stored) {
      expect(shot.baselineId).toBe('scratch-v1');
    }

    const total = stored.reduce((sum: number, s: { sg: number | null }) => sum + (s.sg ?? 0), 0);
    expect(total).toBeCloseTo(1.142, 3);
  });
});
