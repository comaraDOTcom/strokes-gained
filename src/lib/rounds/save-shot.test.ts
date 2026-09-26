import { afterEach, describe, expect, it } from 'vitest';
import { and, asc, eq } from 'drizzle-orm';
import { freshDb, makeUser } from '../../db/test-helpers';
import { expectedStrokes } from '../sg/interpolate';
import type { ShotResultInput } from './save-shot';
import type { ShotTags } from './entry';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

const NO_TAGS: ShotTags = { focus: undefined, commitment: undefined, missDirection: undefined, puttSlope: undefined, puttBreak: undefined };

/** Elm Park Blue hole 2 (413y par 4): the golden hole from recompute.test.ts. */
async function setup() {
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const { db, schema } = ctx;
  const { saveShotResult } = await import('./save-shot');
  const owner = await makeUser(ctx, 'owner');
  const [course] = await db.insert(schema.courses).values({ name: 'Elm Park' }).returning();
  const [tee] = await db
    .insert(schema.tees)
    .values({ courseId: course!.id, name: 'Blue', gender: 'M', distanceUnit: 'yards' })
    .returning();
  await db.insert(schema.teeHoles).values({ teeId: tee!.id, holeNo: 2, par: 4, strokeIndex: 2, yards: 413 });
  const [round] = await db
    .insert(schema.rounds)
    .values({ userId: owner.id, courseId: course!.id, teeId: tee!.id, playedOn: '2026-01-01' })
    .returning();
  const r = { id: round!.id, teeId: tee!.id };

  const save = async (o: Partial<Omit<ShotResultInput, 'tags'>> & { shotNo: number; tags?: Partial<ShotTags> }) =>
    db.transaction((tx) =>
      saveShotResult(tx, r, {
        holeNo: 2,
        endLie: null,
        endDistance: 0,
        holed: false,
        penaltyStrokes: 0,
        penaltyType: null,
        ...o,
        tags: { ...NO_TAGS, ...o.tags },
      }),
    );
  const read = async () =>
    db
      .select()
      .from(schema.shots)
      .where(and(eq(schema.shots.roundId, r.id), eq(schema.shots.holeNo, 2)))
      .orderBy(asc(schema.shots.shotNo));
  return { save, read };
}

/** Drive to the fairway at 150y, approach to 20ft, holed putt. */
async function playGoldenHole(save: Awaited<ReturnType<typeof setup>>['save'], tags: Partial<Record<1 | 2 | 3, Partial<ShotTags>>> = {}) {
  expect(await save({ shotNo: 1, endLie: 'FAIRWAY', endDistance: 150, tags: tags[1] })).not.toHaveProperty('error');
  expect(await save({ shotNo: 2, endLie: 'GREEN', endDistance: 20, tags: tags[2] })).not.toHaveProperty('error');
  expect(await save({ shotNo: 3, holed: true, tags: tags[3] })).not.toHaveProperty('error');
}

describe('saveShotResult — tags', () => {
  it('stores every tag on a new shot and reads it back', async () => {
    const { save, read } = await setup();
    await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 160, tags: { focus: 'EXTERNAL', commitment: 'COMMITTED', missDirection: 'LEFT' } });
    await save({ shotNo: 2, endLie: 'GREEN', endDistance: 25 });
    await save({ shotNo: 3, endLie: 'GREEN', endDistance: 3, tags: { puttSlope: 'UPHILL', puttBreak: 'LEFT_TO_RIGHT', missDirection: 'SHORT' } });
    const rows = await read();
    expect(rows[0]).toMatchObject({ focus: 'EXTERNAL', commitment: 'COMMITTED', missDirection: 'LEFT', puttSlope: null });
    expect(rows[2]).toMatchObject({ puttSlope: 'UPHILL', puttBreak: 'LEFT_TO_RIGHT', missDirection: 'SHORT' });
  });

  it('on an edit, keeps tags that were not sent and clears tags sent as null', async () => {
    const { save, read } = await setup();
    await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 160, tags: { focus: 'INTERNAL', missDirection: 'RIGHT' } });
    await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 155 }); // nothing sent
    expect((await read())[0]).toMatchObject({ endYards: 155, focus: 'INTERNAL', missDirection: 'RIGHT' });
    await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 155, tags: { missDirection: null } });
    expect((await read())[0]).toMatchObject({ focus: 'INTERNAL', missDirection: null });
  });

  it('editing an earlier shot keeps a later shot’s tags', async () => {
    const { save, read } = await setup();
    await save({ shotNo: 1, endLie: 'FAIRWAY', endDistance: 150 });
    await save({ shotNo: 2, endLie: 'SAND', endDistance: 15, tags: { missDirection: 'SHORT' } });
    await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 140, tags: { missDirection: 'LEFT' } });
    const rows = await read();
    expect(rows[1]).toMatchObject({ startLie: 'ROUGH', startYards: 140, missDirection: 'SHORT' });
  });

  it('drops a later shot’s putt tags when an edit means it is no longer a putt', async () => {
    const { save, read } = await setup();
    await save({ shotNo: 1, endLie: 'FAIRWAY', endDistance: 150 });
    await save({ shotNo: 2, endLie: 'GREEN', endDistance: 30 });
    await save({ shotNo: 3, endLie: 'GREEN', endDistance: 4, tags: { puttSlope: 'DOWNHILL', puttBreak: 'STRAIGHT', missDirection: 'LONG' } });
    await save({ shotNo: 2, endLie: 'ROUGH', endDistance: 12 }); // shot 3 now starts in the rough
    const rows = await read();
    expect(rows[2]).toMatchObject({ startLie: 'ROUGH', puttSlope: null, puttBreak: null });
  });

  it('refuses long or short of a fairway and writes nothing', async () => {
    const { save, read } = await setup();
    const r = await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 160, tags: { missDirection: 'LONG' } });
    expect(r).toEqual({ error: expect.stringMatching(/LEFT or RIGHT/) });
    expect(await read()).toHaveLength(0);
  });

  it('never changes strokes gained', async () => {
    const plain = await setup();
    await playGoldenHole(plain.save);
    const tagged = await setup();
    await playGoldenHole(tagged.save, {
      1: { focus: 'EXTERNAL', commitment: 'COMMITTED' },
      2: { focus: 'INTERNAL', commitment: 'HESITANT' },
      3: { puttSlope: 'DOWNHILL', puttBreak: 'RIGHT_TO_LEFT' },
    });
    const a = await plain.read();
    const b = await tagged.read();
    expect(b.map((s) => [s.sg, s.category])).toEqual(a.map((s) => [s.sg, s.category]));
    expect(b[0]!.sg).toBeCloseTo(0.032, 3); // the golden numbers
    expect(b[1]!.sg).toBeCloseTo(0.18, 3);
    expect(b[2]!.sg).toBeCloseTo(0.93, 3);
    expect(b[2]).toMatchObject({ puttSlope: 'DOWNHILL', puttBreak: 'RIGHT_TO_LEFT' }); // and the tags survived recompute
  });
});

describe('saveShotResult — editing and the chain', () => {
  it('marking an edited shot holed removes the shots after it', async () => {
    const { save, read } = await setup();
    await playGoldenHole(save);
    expect(await read()).toHaveLength(3);

    const r = await save({ shotNo: 2, holed: true });
    expect(r).not.toHaveProperty('error');
    expect((r as { shots: unknown[] }).shots).toHaveLength(2);

    const rows = await read();
    expect(rows).toHaveLength(2);
    expect(rows.map((s) => s.shotNo)).toEqual([1, 2]);
    expect(rows[1]).toMatchObject({ startLie: 'FAIRWAY', startYards: 150, endLie: null, endYards: 0, holed: true });
    expect(rows.find((s) => s.shotNo === 3)).toBeUndefined();
  });

  it('editing an earlier shot re-derives later starts and stores the recomputed SG for every shot', async () => {
    const { save, read } = await setup();
    await playGoldenHole(save);
    const before = await read();
    expect(before[2]!.sg).toBeCloseTo(0.93, 3);

    expect(await save({ shotNo: 1, endLie: 'ROUGH', endDistance: 140 })).not.toHaveProperty('error');
    const rows = await read();
    expect(rows).toHaveLength(3);

    // Shot 1's own result changed; shot 2 now starts where shot 1 ended; shot 3 is untouched.
    expect(rows[0]).toMatchObject({ startLie: 'TEE', startYards: 413, endLie: 'ROUGH', endYards: 140 });
    expect(rows[1]).toMatchObject({ startLie: 'ROUGH', startYards: 140, endLie: 'GREEN' });
    expect(rows[2]).toMatchObject({ startLie: 'GREEN', endLie: null, holed: true });

    // SG = E(start) − E(end) − 1 (feet on the green, yards elsewhere).
    expect(rows[0]!.sg).toBeCloseTo(expectedStrokes('TEE', 413) - expectedStrokes('ROUGH', 140) - 1, 6);
    expect(rows[1]!.sg).toBeCloseTo(expectedStrokes('ROUGH', 140) - expectedStrokes('GREEN', 20) - 1, 6);
    expect(rows[2]!.sg).toBeCloseTo(0.93, 3);
    expect(rows[2]!.sg).toBe(before[2]!.sg);

    // Invariant on a finished hole: sum(SG) === E('TEE', holeYards) − grossScore, no penalties here.
    const sum = rows.reduce((acc, s) => acc + (s.sg ?? 0), 0);
    expect(Math.abs(sum - (expectedStrokes('TEE', 413) - 3))).toBeLessThan(1e-6);
  });

  it('a stroke-and-distance result forces end = start and not holed, whatever the client sent', async () => {
    const { save, read } = await setup();
    const r = await save({
      shotNo: 1,
      penaltyType: 'STROKE_AND_DISTANCE',
      penaltyStrokes: 1,
      holed: true, // must be ignored
      endLie: 'FAIRWAY', // must be ignored
      endDistance: 250, // must be ignored
    });
    expect(r).not.toHaveProperty('error');

    const [first] = await read();
    expect(first).toMatchObject({
      startLie: 'TEE',
      startYards: 413,
      endLie: 'TEE',
      endYards: 413,
      holed: false,
      penaltyStrokes: 1,
      penaltyType: 'STROKE_AND_DISTANCE',
    });
    // E(start) − E(start) − 1 − 1: the shot costs exactly 2.0.
    expect(first!.sg).toBeCloseTo(-2, 6);

    // The hole is not finished, so the next shot replays from the tee.
    expect(await save({ shotNo: 2, endLie: 'GREEN', endDistance: 20 })).not.toHaveProperty('error');
    const rows = await read();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ shotNo: 2, startLie: 'TEE', startYards: 413, endLie: 'GREEN' });
  });
});
