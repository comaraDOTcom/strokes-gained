import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, makeUser } from '../../db/test-helpers';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

const ON = { BILLING_ENABLED: '1', BILLING_EXEMPT_EMAILS: 'pro@club.ie' };

async function arrange() {
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const store = await import('./store');
  const alice = await makeUser(ctx, 'alice');
  const viewer = { id: alice.id, email: alice.email, isAdmin: false };
  const putCardOnFile = (userId = alice.id, status = 'trialing') =>
    ctx.db.insert(ctx.schema.subscriptions).values({ userId, stripeCustomerId: `cus_${userId}`, status });
  return { ...ctx, store, alice, viewer, putCardOnFile };
}

describe('getEntitlement', () => {
  it('billing off: everyone may start a round', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.getEntitlement(viewer, db, {})).toEqual({ canCreateRound: true, reason: 'billing-off' });
  });

  it('the admin, listed players and players who joined before the cutoff are exempt', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.getEntitlement({ ...viewer, isAdmin: true }, db, ON)).toMatchObject({ reason: 'exempt' });
    expect(await store.getEntitlement({ ...viewer, email: 'PRO@club.ie' }, db, ON)).toMatchObject({ reason: 'exempt' });
    // makeUser creates Alice "now", so a cutoff in the future covers her and one in the past doesn't.
    expect(await store.getEntitlement(viewer, db, { ...ON, BILLING_EXEMPT_JOINED_BEFORE: '2999-01-01' })).toMatchObject({ reason: 'exempt' });
    expect(await store.getEntitlement(viewer, db, { ...ON, BILLING_EXEMPT_JOINED_BEFORE: '2000-01-01' })).toMatchObject({ gate: 'claim-free-rounds' });
  });

  it('four free rounds with a card on file, then round five asks to start the membership', async () => {
    const { store, db, viewer, putCardOnFile } = await arrange();
    expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: false, gate: 'claim-free-rounds' });

    await putCardOnFile();
    for (const left of [4, 3, 2, 1]) {
      expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: true, reason: 'free-round', freeRoundsLeft: left });
      expect(await store.spendFreeRound(viewer.id, db)).toBe(true);
    }
    expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });

  it('deleting rounds does not give free rounds back', async () => {
    const { store, db, schema, alice, viewer, putCardOnFile } = await arrange();
    await putCardOnFile();
    const [course] = await db.insert(schema.courses).values({ name: 'Elm Park' }).returning();
    const [tee] = await db.insert(schema.tees).values({ courseId: course!.id, name: 'White', gender: 'M', distanceUnit: 'yards' }).returning();
    for (let i = 0; i < 4; i++) {
      await db.insert(schema.rounds).values({ userId: alice.id, courseId: course!.id, teeId: tee!.id, playedOn: '2026-09-26' });
      await store.spendFreeRound(viewer.id, db);
    }
    await db.delete(schema.rounds).where(eq(schema.rounds.userId, alice.id));
    expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });
});

describe('spendFreeRound', () => {
  it('stops at four, and two taps on the last free round only count once', async () => {
    const { store, db, viewer, putCardOnFile } = await arrange();
    await putCardOnFile();
    for (let i = 0; i < 3; i++) await store.spendFreeRound(viewer.id, db);
    const results = await Promise.all([store.spendFreeRound(viewer.id, db), store.spendFreeRound(viewer.id, db)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.spendFreeRound(viewer.id, db)).toBe(false);
  });

  it('is false for a player with no card on file', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.spendFreeRound(viewer.id, db)).toBe(false);
  });
});

describe('assignMemberNumber', () => {
  it('numbers members in the order their cards go on file, and keeps a number once given', async () => {
    const ctx = await arrange();
    const bob = await makeUser(ctx, 'bob');
    await ctx.putCardOnFile(ctx.alice.id);
    await ctx.putCardOnFile(bob.id);
    expect(await ctx.store.assignMemberNumber(bob.id, ctx.db)).toBe(1);
    expect(await ctx.store.assignMemberNumber(ctx.alice.id, ctx.db)).toBe(2);
    expect(await ctx.store.assignMemberNumber(bob.id, ctx.db)).toBe(1);
  });

  it('is null for a player with no card on file', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.assignMemberNumber(viewer.id, db)).toBeNull();
  });
});
