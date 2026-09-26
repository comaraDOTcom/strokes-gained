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
  const q = await import('./sessions');
  const alice = await makeUser(ctx, 'alice');
  const bob = await makeUser(ctx, 'bob');
  return { ...ctx, q, alice, bob };
}


describe('the practice log', () => {
  it('decides pass/fail from the drill and stores its pass mark', async () => {
    const { q, alice } = await arrange();
    const pass = await q.logSession(alice.id, { practisedOn: '2026-09-20', drillId: 'circle-putting', score: 16 });
    const fail = await q.logSession(alice.id, { practisedOn: '2026-09-21', drillId: 'circle-putting', score: 15 });
    expect(pass).toMatchObject({ score: 16, outOf: 20, passMark: 16, passed: true });
    expect(fail).toMatchObject({ score: 15, passed: false });
  });

  it("lists only the player's own sessions, oldest first", async () => {
    const { q, alice, bob } = await arrange();
    await q.logSession(alice.id, { practisedOn: '2026-09-22', drillId: 'lag-putting', score: 8 });
    await q.logSession(alice.id, { practisedOn: '2026-09-20', drillId: 'bunker-to-10ft', score: 3 });
    await q.logSession(bob.id, { practisedOn: '2026-09-21', drillId: 'wedge-matrix', score: 9 });
    expect((await q.listSessions(alice.id)).map((s) => s.drillId)).toEqual(['bunker-to-10ft', 'lag-putting']);
    expect((await q.listSessions(bob.id)).map((s) => s.drillId)).toEqual(['wedge-matrix']);
  });

  it("deletes a player's own session, never someone else's", async () => {
    const { q, alice, bob } = await arrange();
    const s = await q.logSession(alice.id, { practisedOn: '2026-09-22', drillId: 'lag-putting', score: 8 });
    expect(await q.sessionOwner(s.id)).toBe(alice.id);
    expect(await q.deleteSession(bob.id, s.id)).toBe(false);
    expect(await q.listSessions(alice.id)).toHaveLength(1);
    expect(await q.deleteSession(alice.id, s.id)).toBe(true);
    expect(await q.listSessions(alice.id)).toEqual([]);
    expect(await q.sessionOwner(s.id)).toBeNull();
  });

  it("goes when the player's account does", async () => {
    const { q, db, schema, alice } = await arrange();
    const { eq } = await import('drizzle-orm');
    await q.logSession(alice.id, { practisedOn: '2026-09-22', drillId: 'lag-putting', score: 8 });
    await db.delete(schema.user).where(eq(schema.user.id, alice.id));
    expect(await db.select().from(schema.practiceSessions)).toEqual([]);
  });
});
