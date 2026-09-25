import { afterEach, describe, expect, it } from 'vitest';
import { freshDb, makeUser } from '../../db/test-helpers';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

async function arrange() {
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const q = await import('./queries');
  const { db, schema } = ctx;
  const alice = await makeUser(ctx, 'alice');
  const bob = await makeUser(ctx, 'bob');
  const [linked] = await db.insert(schema.courses).values({ name: 'Elm Park', directoryKey: 'osm:way/2' }).returning();
  const [unlinked] = await db.insert(schema.courses).values({ name: 'Somewhere' }).returning();
  const teeOf = async (courseId: number) =>
    (await db.insert(schema.tees).values({ courseId, name: 'W', gender: 'M', distanceUnit: 'yards' }).returning())[0]!;
  const [t1, t2] = [await teeOf(linked!.id), await teeOf(unlinked!.id)];
  const round = (userId: string, courseId: number, teeId: number, playedOn: string) =>
    db.insert(schema.rounds).values({ userId, courseId, teeId, playedOn });
  await round(alice.id, linked!.id, t1.id, '2026-05-01');
  await round(alice.id, unlinked!.id, t2.id, '2026-05-02');
  await round(bob.id, linked!.id, t1.id, '2026-06-01');
  return { q, alice, bob };
}

describe('played courses', () => {
  it('ticks and un-ticks, idempotently, per player', async () => {
    const { q, alice, bob } = await arrange();
    await q.setPlayed(alice.id, 'osm:way/3', true);
    await q.setPlayed(alice.id, 'osm:way/3', true);
    await q.setPlayed(alice.id, 'osm:way/4', true);
    await q.setPlayed(alice.id, 'osm:way/4', false);
    await q.setPlayed(alice.id, 'osm:way/9', false); // un-ticking something never ticked is fine
    expect((await q.loadPlayedInputs(alice.id)).tickedKeys).toEqual(['osm:way/3']);
    expect((await q.loadPlayedInputs(bob.id)).tickedKeys).toEqual([]);
  });

  it("only the player's own rounds on linked courses count", async () => {
    const { q, alice } = await arrange();
    expect((await q.loadPlayedInputs(alice.id)).roundCourses).toEqual([{ directoryKey: 'osm:way/2', playedOn: '2026-05-01' }]);
  });
});
