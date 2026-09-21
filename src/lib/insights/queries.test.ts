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
