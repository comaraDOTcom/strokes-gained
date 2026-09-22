import { describe, expect, it, afterEach } from 'vitest';
import { freshDb, makeUser } from '../../db/test-helpers';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

describe('getCourseOptions', () => {
  it("lists only courses the player has logged a round on — not the whole shared library, not other players' courses", async () => {
    const ctx = await freshDb();
    closers.push(ctx.closeDb);
    const { db, schema } = ctx;
    const { getCourseOptions } = await import('./queries');
    const me = await makeUser(ctx, 'me');
    const other = await makeUser(ctx, 'other');

    const mk = async (name: string) => {
      const [c] = await db.insert(schema.courses).values({ name }).returning();
      const [t] = await db.insert(schema.tees).values({ courseId: c!.id, name: 'W', gender: 'M', distanceUnit: 'yards' }).returning();
      return { courseId: c!.id, teeId: t!.id };
    };
    const played = await mk('Played by me');
    const theirs = await mk('Played only by someone else');
    await mk('Played by nobody');

    await db.insert(schema.rounds).values([
      { userId: me.id, ...played, playedOn: '2026-09-01' },
      { userId: me.id, ...played, playedOn: '2026-09-20' },
      { userId: other.id, ...theirs, playedOn: '2026-09-21' },
    ]);

    const mine = await getCourseOptions(me.id);
    expect(mine.map((o) => [o.name, o.roundCount, o.lastRound?.playedOn])).toEqual([['Played by me', 2, '2026-09-20']]);

    expect((await getCourseOptions(other.id)).map((o) => o.name)).toEqual(['Played only by someone else']);
  });

  it('is empty for a player with no rounds', async () => {
    const ctx = await freshDb();
    closers.push(ctx.closeDb);
    const { getCourseOptions } = await import('./queries');
    const me = await makeUser(ctx, 'me');
    await ctx.db.insert(ctx.schema.courses).values({ name: 'Library course' });
    expect(await getCourseOptions(me.id)).toEqual([]);
  });
});

describe('getAllEnrichedShots + getTeeHoleMetaForCourse (single-query reads)', () => {
  it("joins each shot to its round, course, tee and hole par, in round/hole/shot order, and only the player's own", async () => {
    const ctx = await freshDb();
    closers.push(ctx.closeDb);
    const { db, schema } = ctx;
    const { getAllEnrichedShots, getTeeHoleMetaForCourse } = await import('./queries');
    const me = await makeUser(ctx, 'me');
    const other = await makeUser(ctx, 'other');

    const [c] = await db.insert(schema.courses).values({ name: 'Elm Park' }).returning();
    const [t] = await db.insert(schema.tees).values({ courseId: c!.id, name: 'Blue', gender: 'M', distanceUnit: 'yards' }).returning();
    await db.insert(schema.teeHoles).values([
      { teeId: t!.id, holeNo: 1, par: 4, strokeIndex: 5, yards: 400 },
      { teeId: t!.id, holeNo: 2, par: 3, strokeIndex: 11, yards: 150 },
    ]);
    const [mine] = await db.insert(schema.rounds).values({ userId: me.id, courseId: c!.id, teeId: t!.id, playedOn: '2026-09-13' }).returning();
    const [theirs] = await db.insert(schema.rounds).values({ userId: other.id, courseId: c!.id, teeId: t!.id, playedOn: '2026-09-14' }).returning();
    const base = { holed: false, endLie: 'GREEN', category: 'APPROACH', penaltyStrokes: 0 } as const;
    await db.insert(schema.shots).values([
      { ...base, roundId: mine!.id, holeNo: 2, shotNo: 1, startLie: 'TEE', startYards: 150, endYards: 3, sg: 0.2 },
      { ...base, roundId: mine!.id, holeNo: 1, shotNo: 2, startLie: 'FAIRWAY', startYards: 150, endYards: 5, sg: -0.1 },
      { ...base, roundId: mine!.id, holeNo: 1, shotNo: 1, startLie: 'TEE', startYards: 400, endLie: 'FAIRWAY', endYards: 150, sg: -0.3, category: 'OFF_THE_TEE' },
      { ...base, roundId: mine!.id, holeNo: 1, shotNo: 3, startLie: 'GREEN', startYards: 5, endYards: 0, sg: null }, // not yet recomputed: dropped
      { ...base, roundId: theirs!.id, holeNo: 1, shotNo: 1, startLie: 'TEE', startYards: 400, endYards: 150, sg: 1 },
    ]);

    const shots = await getAllEnrichedShots(me.id, c!.id);
    expect(shots.map((s) => [s.holeNo, s.shotNo, s.par, s.courseName, s.teeName])).toEqual([
      [1, 1, 4, 'Elm Park', 'Blue'],
      [1, 2, 4, 'Elm Park', 'Blue'],
      [2, 1, 3, 'Elm Park', 'Blue'],
    ]);
    expect(shots[1]!.endDistance).toBeCloseTo(15); // green distances come back in feet

    const meta = await getTeeHoleMetaForCourse(me.id, c!.id);
    expect(meta.get(t!.id)).toEqual([
      { holeNo: 1, par: 4, strokeIndex: 5 },
      { holeNo: 2, par: 3, strokeIndex: 11 },
    ]);
    expect((await getTeeHoleMetaForCourse(me.id, c!.id + 999)).size).toBe(0);
  });
});
