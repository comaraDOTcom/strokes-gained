import { afterEach, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { freshDb, makeUser } from '../../db/test-helpers';
import type { SubscriptionLike } from './stripe';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
});

const ON = { BILLING_ENABLED: '1' };

function sub(over: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    id: 'sub_alice',
    customer: 'cus_alice',
    status: 'trialing',
    trial_end: 1_790_812_800,
    cancel_at_period_end: false,
    metadata: { userId: 'alice' },
    items: { data: [{ price: { id: 'price_player' }, current_period_end: 1_793_491_200 }] },
    default_payment_method: { card: { fingerprint: 'fp_visa_4242' } },
    ...over,
  };
}

const checkoutCompleted = (id: string, userId: string, subscription: string) => ({
  id,
  type: 'checkout.session.completed',
  data: { object: { object: 'checkout.session', client_reference_id: userId, subscription } },
});
const subscriptionEvent = (id: string, type: string, subscriptionId: string) => ({ id, type, data: { object: { id: subscriptionId, object: 'subscription' } } });

async function arrange() {
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const { applyStripeEvent } = await import('./webhook');
  const store = await import('./store');
  const alice = await makeUser(ctx, 'alice');
  const bob = await makeUser(ctx, 'bob');
  // A fake Stripe: the current state of each subscription, as `subscriptions.retrieve` would return it.
  const stripe = new Map<string, SubscriptionLike>([['sub_alice', sub()]]);
  const deps = {
    conn: ctx.db,
    fetchSubscription: async (id: string) => {
      const s = stripe.get(id);
      if (!s) throw new Error(`no such subscription ${id}`);
      return s;
    },
  };
  const rowFor = async (userId: string) => (await ctx.db.select().from(ctx.schema.subscriptions).where(eq(ctx.schema.subscriptions.userId, userId)))[0];
  const entitlementOf = (u: { id: string; email: string }) => store.getEntitlement({ ...u, isAdmin: false }, ctx.db, ON);
  return { ...ctx, applyStripeEvent, store, alice, bob, stripe, deps, rowFor, entitlementOf };
}

describe('applyStripeEvent', () => {
  it('Checkout puts the card on file: a trialing row, the fingerprint, member number 1, four free rounds', async () => {
    const t = await arrange();
    expect(await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps)).toBe('applied');
    expect(await t.rowFor('alice')).toMatchObject({
      stripeCustomerId: 'cus_alice',
      stripeSubscriptionId: 'sub_alice',
      status: 'trialing',
      priceId: 'price_player',
      cardFingerprint: 'fp_visa_4242',
      memberNo: 1,
      freeRoundsUsed: 0,
    });
    expect(await t.entitlementOf(t.alice)).toEqual({ canCreateRound: true, reason: 'free-round', freeRoundsLeft: 4 });
  });

  it('the same event delivered twice is applied once', async () => {
    const t = await arrange();
    expect(await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps)).toBe('applied');
    expect(await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps)).toBe('duplicate');
    expect((await t.rowFor('alice'))?.memberNo).toBe(1);
  });

  it('writes the subscription as Stripe has it now, so a late, older event cannot roll it back', async () => {
    const t = await arrange();
    await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps);
    t.stripe.set('sub_alice', sub({ status: 'active', trial_end: null }));
    await t.applyStripeEvent(subscriptionEvent('evt_3', 'customer.subscription.updated', 'sub_alice'), t.deps);
    // evt_2 (the trial starting) arrives last. Stripe still says active.
    await t.applyStripeEvent(subscriptionEvent('evt_2', 'customer.subscription.created', 'sub_alice'), t.deps);
    expect(await t.rowFor('alice')).toMatchObject({ status: 'active', trialEnd: null });
  });

  it('a failed renewal blocks new rounds, and cancelling re-locks once Stripe ends it', async () => {
    const t = await arrange();
    await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps);
    for (let i = 0; i < 4; i++) await t.store.spendFreeRound('alice', t.db);

    t.stripe.set('sub_alice', sub({ status: 'past_due' }));
    await t.applyStripeEvent(subscriptionEvent('evt_2', 'customer.subscription.updated', 'sub_alice'), t.deps);
    expect(await t.entitlementOf(t.alice)).toEqual({ canCreateRound: false, gate: 'fix-payment' });

    t.stripe.set('sub_alice', sub({ status: 'active', cancel_at_period_end: true }));
    await t.applyStripeEvent(subscriptionEvent('evt_3', 'customer.subscription.updated', 'sub_alice'), t.deps);
    expect(await t.entitlementOf(t.alice)).toEqual({ canCreateRound: true, reason: 'member', endsAtPeriodEnd: true });

    t.stripe.set('sub_alice', sub({ status: 'canceled' }));
    await t.applyStripeEvent(subscriptionEvent('evt_4', 'customer.subscription.deleted', 'sub_alice'), t.deps);
    expect(await t.entitlementOf(t.alice)).toEqual({ canCreateRound: false, gate: 'rejoin' });
  });

  it('a card that already used its free rounds on another account gets none on this one', async () => {
    const t = await arrange();
    await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps);
    for (let i = 0; i < 4; i++) await t.store.spendFreeRound('alice', t.db);

    t.stripe.set('sub_bob', sub({ id: 'sub_bob', customer: 'cus_bob', metadata: { userId: 'bob' } })); // same card
    await t.applyStripeEvent(checkoutCompleted('evt_2', 'bob', 'sub_bob'), t.deps);
    expect(await t.rowFor('bob')).toMatchObject({ freeRoundsUsed: 4, memberNo: 2 });
    expect(await t.entitlementOf(t.bob)).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });

  it('a different card on another account gets its own four free rounds', async () => {
    const t = await arrange();
    await t.applyStripeEvent(checkoutCompleted('evt_1', 'alice', 'sub_alice'), t.deps);
    for (let i = 0; i < 4; i++) await t.store.spendFreeRound('alice', t.db);
    t.stripe.set('sub_bob', sub({ id: 'sub_bob', customer: 'cus_bob', metadata: { userId: 'bob' }, default_payment_method: { card: { fingerprint: 'fp_mastercard' } } }));
    await t.applyStripeEvent(checkoutCompleted('evt_2', 'bob', 'sub_bob'), t.deps);
    expect(await t.entitlementOf(t.bob)).toEqual({ canCreateRound: true, reason: 'free-round', freeRoundsLeft: 4 });
  });

  it('records but ignores events it does not handle, and subscriptions it did not create', async () => {
    const t = await arrange();
    expect(await t.applyStripeEvent({ id: 'evt_x', type: 'invoice.paid', data: { object: {} } }, t.deps)).toBe('ignored');
    t.stripe.set('sub_other', sub({ id: 'sub_other', customer: 'cus_other', metadata: {} }));
    expect(await t.applyStripeEvent(subscriptionEvent('evt_y', 'customer.subscription.updated', 'sub_other'), t.deps)).toBe('ignored');
    expect(await t.applyStripeEvent({ id: 'evt_x', type: 'invoice.paid', data: { object: {} } }, t.deps)).toBe('duplicate');
    expect(await t.db.select().from(t.schema.subscriptions)).toEqual([]);
  });
});
