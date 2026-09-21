import { describe, expect, it, afterEach, vi } from 'vitest';
import { freshDb, makeUser } from '../../db/test-helpers';
import type { SessionUser } from './session';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
  vi.unstubAllEnvs();
});

const asSession = (u: { id: string; name: string; email: string }, isAdmin = false): SessionUser => ({
  id: u.id, name: u.name, email: u.email, image: null, isAdmin,
});

async function arrange() {
  vi.stubEnv('AUTH_TEST_MODE', '1');
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const guards = await import('./guards');
  const { db, schema } = ctx;
  const alice = await makeUser(ctx, 'alice');
  const bob = await makeUser(ctx, 'bob');
  const root = await makeUser(ctx, 'root', { email: 'root@example.com' });

  // Alice created the course; Bob has not played it yet.
  const [course] = await db.insert(schema.courses).values({ name: 'Alice GC', createdByUserId: alice.id }).returning();
  const [tee] = await db.insert(schema.tees).values({ courseId: course!.id, name: 'W', gender: 'M', distanceUnit: 'yards' }).returning();
  const mkRound = async (userId: string | null) =>
    (await db.insert(schema.rounds).values({ userId, courseId: course!.id, teeId: tee!.id, playedOn: '2026-01-01' }).returning())[0]!;

  return { ...ctx, guards, alice: asSession(alice), bob: asSession(bob), root: asSession(root, true), course: course!, tee: tee!, mkRound };
}

describe('round guards', () => {
  it('the owner may change their round', async () => {
    const { guards, alice, mkRound } = await arrange();
    const r = await mkRound(alice.id);
    await expect(guards.requireRoundOwner(r.id, alice)).resolves.toMatchObject({ id: r.id });
  });

  it("another player can neither see nor change it — a 404, so round ids can't be probed", async () => {
    const { guards, alice, bob, mkRound } = await arrange();
    const r = await mkRound(alice.id);
    await expect(guards.getRoundForViewer(r.id, bob)).rejects.toMatchObject({ status: 404 });
    await expect(guards.requireRoundOwner(r.id, bob)).rejects.toMatchObject({ status: 404 });
  });

  it("the admin can look at someone else's round read-only, but still cannot change it", async () => {
    const { guards, alice, root, mkRound } = await arrange();
    const r = await mkRound(alice.id);
    await expect(guards.getRoundForViewer(r.id, root)).resolves.toMatchObject({ isOwner: false });
    await expect(guards.requireRoundOwner(r.id, root)).rejects.toMatchObject({ status: 403 });
  });

  it('a missing round is a 404, not a 403', async () => {
    const { guards, alice } = await arrange();
    await expect(guards.requireRoundOwner(99999, alice)).rejects.toMatchObject({ status: 404 });
  });

  it('an unclaimed legacy round is editable by the admin only, and invisible to everyone else', async () => {
    const { guards, alice, root, mkRound } = await arrange();
    const legacy = await mkRound(null);
    await expect(guards.requireRoundOwner(legacy.id, root)).resolves.toMatchObject({ id: legacy.id });
    // Not even a read-only look until the admin has claimed it: 404, not 403 (don't confirm it exists).
    await expect(guards.requireRoundOwner(legacy.id, alice)).rejects.toMatchObject({ status: 404 });
    await expect(guards.getRoundForViewer(legacy.id, alice)).rejects.toMatchObject({ status: 404 });
  });
});

describe('tee/course guards', () => {
  it('the creator may edit a tee nobody else has played', async () => {
    const { guards, alice, tee, mkRound } = await arrange();
    await mkRound(alice.id); // their own round doesn't lock it
    await expect(guards.requireTeeEditor(tee.id, alice)).resolves.toMatchObject({ tee: { id: tee.id } });
  });

  it("locks once another player has a round on it — creator refused, admin allowed", async () => {
    const { guards, alice, bob, root, tee, mkRound } = await arrange();
    await mkRound(bob.id);
    await expect(guards.requireTeeEditor(tee.id, alice)).rejects.toMatchObject({ status: 403 });
    await expect(guards.requireTeeEditor(tee.id, root)).resolves.toBeDefined();
    expect(await guards.canEditTee(tee.id, alice)).toBe(false);
    expect(await guards.canEditTee(tee.id, root)).toBe(true);
  });

  it('a player who did not add the course cannot edit it', async () => {
    const { guards, bob, tee } = await arrange();
    await expect(guards.requireTeeEditor(tee.id, bob)).rejects.toMatchObject({ status: 403 });
  });

  it('an unclaimed legacy round on the tee also counts as "someone else played it"', async () => {
    const { guards, alice, tee, mkRound } = await arrange();
    await mkRound(null);
    await expect(guards.requireTeeEditor(tee.id, alice)).rejects.toMatchObject({ status: 403 });
  });

  it('a missing tee is a 404', async () => {
    const { guards, alice } = await arrange();
    await expect(guards.requireTeeEditor(424242, alice)).rejects.toMatchObject({ status: 404 });
  });
});

describe('claimLegacyData', () => {
  it('gives every ownerless round to the admin and leaves owned rounds alone', async () => {
    const { db, schema, alice, root, mkRound } = await arrange();
    const { claimLegacyData } = await import('./claim');
    const owned = await mkRound(alice.id);
    const a = await mkRound(null);
    const b = await mkRound(null);

    expect(await claimLegacyData(root.id)).toBe(2);
    const rows = await db.select().from(schema.rounds);
    expect(rows.find((r) => r.id === a.id)!.userId).toBe(root.id);
    expect(rows.find((r) => r.id === b.id)!.userId).toBe(root.id);
    expect(rows.find((r) => r.id === owned.id)!.userId).toBe(alice.id);
    expect(await claimLegacyData(root.id)).toBe(0); // idempotent
  });
});
