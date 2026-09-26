import { describe, expect, it } from 'vitest';
import { decideEntitlement, isBillingEnabled, isBillingExempt, type SubscriptionFacts } from './entitlement';

const on = (sub: SubscriptionFacts | null, exempt = false) => decideEntitlement({ billingEnabled: true, exempt, sub });
const used = new Date('2026-09-26T10:00:00Z');

describe('decideEntitlement', () => {
  it('lets everyone play while billing is switched off, whatever their subscription says', () => {
    expect(decideEntitlement({ billingEnabled: false, exempt: false, sub: null })).toEqual({ canCreateRound: true, reason: 'billing-off' });
    expect(decideEntitlement({ billingEnabled: false, exempt: false, sub: { status: 'canceled', freeRoundUsedAt: used } }).canCreateRound).toBe(true);
  });

  it('lets exempt players play with no card at all', () => {
    expect(on(null, true)).toEqual({ canCreateRound: true, reason: 'exempt' });
    expect(on({ status: 'unpaid', freeRoundUsedAt: used }, true)).toEqual({ canCreateRound: true, reason: 'exempt' });
  });

  it('asks a new player for a card before their first round', () => {
    expect(on(null)).toEqual({ canCreateRound: false, gate: 'claim-free-round' });
    // Customer created, Checkout never finished.
    expect(on({ status: null, freeRoundUsedAt: null })).toEqual({ canCreateRound: false, gate: 'claim-free-round' });
    expect(on({ status: 'incomplete_expired', freeRoundUsedAt: null })).toEqual({ canCreateRound: false, gate: 'claim-free-round' });
  });

  it('with a card on file, the first round is free', () => {
    expect(on({ status: 'trialing', freeRoundUsedAt: null })).toEqual({ canCreateRound: true, reason: 'free-round' });
  });

  it('the boundary: once the free round is spent, round two asks to start the membership', () => {
    expect(on({ status: 'trialing', freeRoundUsedAt: used })).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });

  it('an active member plays; one who has cancelled keeps playing until the period ends', () => {
    expect(on({ status: 'active', freeRoundUsedAt: used })).toEqual({ canCreateRound: true, reason: 'member' });
    expect(on({ status: 'active', freeRoundUsedAt: used, cancelAtPeriodEnd: true })).toEqual({
      canCreateRound: true,
      reason: 'member',
      warning: 'ends-at-period-end',
    });
  });

  it('re-locks when the period ends after cancelling, without offering a second free round', () => {
    expect(on({ status: 'canceled', freeRoundUsedAt: used })).toEqual({ canCreateRound: false, gate: 'rejoin' });
  });

  it('a player who cancelled during the trial without playing still has their free round', () => {
    expect(on({ status: 'canceled', freeRoundUsedAt: null })).toEqual({ canCreateRound: false, gate: 'claim-free-round' });
  });

  it('a failing card warns while Stripe retries, and locks once Stripe gives up', () => {
    expect(on({ status: 'past_due', freeRoundUsedAt: used })).toEqual({ canCreateRound: true, reason: 'member', warning: 'payment-failing' });
    expect(on({ status: 'unpaid', freeRoundUsedAt: used })).toEqual({ canCreateRound: false, gate: 'fix-payment' });
  });

  it('treats paused and unknown statuses as no subscription', () => {
    expect(on({ status: 'paused', freeRoundUsedAt: used })).toEqual({ canCreateRound: false, gate: 'rejoin' });
    expect(on({ status: 'something_new', freeRoundUsedAt: null })).toEqual({ canCreateRound: false, gate: 'claim-free-round' });
  });

  it('a card already used for a free round on another account arrives with the free round spent', () => {
    // store.ts sets freeRoundUsedAt at Checkout when the card fingerprint has been seen before.
    expect(on({ status: 'trialing', freeRoundUsedAt: used })).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });
});

describe('isBillingExempt', () => {
  it('matches case-insensitively and ignores spaces and empty entries', () => {
    const list = ' Pro@Elmpark.ie, ,tester@example.com ';
    expect(isBillingExempt('pro@elmpark.ie', list)).toBe(true);
    expect(isBillingExempt('TESTER@example.com', list)).toBe(true);
    expect(isBillingExempt('someone@example.com', list)).toBe(false);
  });

  it('is false with no list or no email, and an empty entry never matches an empty email', () => {
    expect(isBillingExempt('a@b.c', undefined)).toBe(false);
    expect(isBillingExempt('a@b.c', '')).toBe(false);
    expect(isBillingExempt('', ',')).toBe(false);
    expect(isBillingExempt(null, 'a@b.c')).toBe(false);
  });
});

describe('isBillingEnabled', () => {
  it('is on only for an explicit 1 or true', () => {
    expect(isBillingEnabled('1')).toBe(true);
    expect(isBillingEnabled('true')).toBe(true);
    for (const v of [undefined, null, '', '0', 'false', 'yes']) expect(isBillingEnabled(v)).toBe(false);
  });
});
