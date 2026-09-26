import { describe, expect, it } from 'vitest';
import { stripeKeyProblem, subscriptionToRow, userIdOf, type SubscriptionLike } from './stripe';

function fakeSubscription(over: Partial<SubscriptionLike> = {}): SubscriptionLike {
  return {
    id: 'sub_1',
    customer: 'cus_1',
    status: 'trialing',
    trial_end: 1_790_812_800, // 2026-10-01T00:00:00Z
    cancel_at_period_end: false,
    metadata: { userId: 'alice' },
    items: { data: [{ price: { id: 'price_player' }, current_period_end: 1_793_491_200 }] }, // period ends 2026-11-01T00:00:00Z
    default_payment_method: { card: { fingerprint: 'fp_visa_4242' } },
    ...over,
  };
}

describe('subscriptionToRow', () => {
  it('maps the fields we store, with times from Unix seconds and the period end from the item', () => {
    expect(subscriptionToRow(fakeSubscription())).toEqual({
      stripeCustomerId: 'cus_1',
      stripeSubscriptionId: 'sub_1',
      status: 'trialing',
      priceId: 'price_player',
      trialEnd: new Date('2026-10-01T00:00:00Z'),
      currentPeriodEnd: new Date('2026-11-01T00:00:00Z'),
      cancelAtPeriodEnd: false,
      cardFingerprint: 'fp_visa_4242',
    });
  });

  it('reads an expanded customer, and has no fingerprint when the payment method is not expanded', () => {
    const row = subscriptionToRow(fakeSubscription({ customer: { id: 'cus_2' }, default_payment_method: 'pm_123', trial_end: null }));
    expect(row).toMatchObject({ stripeCustomerId: 'cus_2', cardFingerprint: null, trialEnd: null });
  });

  it('copes with no items and no payment method', () => {
    const row = subscriptionToRow(fakeSubscription({ items: { data: [] }, default_payment_method: null }));
    expect(row).toMatchObject({ priceId: null, currentPeriodEnd: null, cardFingerprint: null });
  });
});

describe('userIdOf', () => {
  it('reads our user id from the metadata, or null', () => {
    expect(userIdOf(fakeSubscription())).toBe('alice');
    expect(userIdOf(fakeSubscription({ metadata: {} }))).toBeNull();
    expect(userIdOf(fakeSubscription({ metadata: null }))).toBeNull();
  });
});

describe('stripeKeyProblem', () => {
  it('accepts a test key anywhere and a live key only in production', () => {
    expect(stripeKeyProblem('sk_test_abc', 'development')).toBeNull();
    expect(stripeKeyProblem('sk_live_abc', 'production')).toBeNull();
    expect(stripeKeyProblem('sk_live_abc', 'development')).toBe('A live Stripe key is refused outside production');
  });

  it('refuses a missing key and a publishable key', () => {
    expect(stripeKeyProblem(undefined, 'production')).toBe('STRIPE_SECRET_KEY is not set');
    expect(stripeKeyProblem('pk_test_abc', 'development')).toBe('STRIPE_SECRET_KEY is not a Stripe secret key (sk_… or rk_…)');
  });
});
