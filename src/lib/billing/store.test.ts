import { afterEach, describe, expect, it } from 'vitest';
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
  const putCardOnFile = (status = 'trialing') =>
    ctx.db.insert(ctx.schema.subscriptions).values({ userId: alice.id, stripeCustomerId: 'cus_alice', status });
  return { ...ctx, store, viewer, putCardOnFile };
}

describe('getEntitlement', () => {
  it('billing off: everyone may start a round, no lookup needed', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.getEntitlement(viewer, db, {})).toEqual({ canCreateRound: true, reason: 'billing-off' });
  });

  it('the admin and listed players are exempt', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.getEntitlement({ ...viewer, isAdmin: true }, db, ON)).toMatchObject({ reason: 'exempt' });
    expect(await store.getEntitlement({ ...viewer, email: 'PRO@club.ie' }, db, ON)).toMatchObject({ reason: 'exempt' });
  });

  it('first round with a card is free, round two asks to start the membership', async () => {
    const { store, db, viewer, putCardOnFile } = await arrange();
    expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: false, gate: 'claim-free-round' });

    await putCardOnFile();
    expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: true, reason: 'free-round' });

    expect(await store.spendFreeRound(viewer.id, db)).toBe(true);
    expect(await store.getEntitlement(viewer, db, ON)).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });
});

describe('spendFreeRound', () => {
  it('only the first spend succeeds, even when two land together', async () => {
    const { store, db, viewer, putCardOnFile } = await arrange();
    await putCardOnFile();
    const results = await Promise.all([store.spendFreeRound(viewer.id, db), store.spendFreeRound(viewer.id, db)]);
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await store.spendFreeRound(viewer.id, db)).toBe(false);
  });

  it('is false for a player with no card on file', async () => {
    const { store, db, viewer } = await arrange();
    expect(await store.spendFreeRound(viewer.id, db)).toBe(false);
  });
});
