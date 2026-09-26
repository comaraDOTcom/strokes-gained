import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { decideEntitlement, FREE_FOREVER_SHA256, FREE_ROUNDS, isBillingEnabled, isBillingExempt, parseCutoff, type SubscriptionFacts } from './entitlement';

const on = (sub: SubscriptionFacts | null) => decideEntitlement({ billingEnabled: true, exempt: false, sub });

describe('decideEntitlement', () => {
  it('four free rounds, as agreed for the sign-up stage', () => {
    expect(FREE_ROUNDS).toBe(4);
  });

  it('lets everyone play while billing is switched off, whatever their subscription says', () => {
    expect(decideEntitlement({ billingEnabled: false, exempt: false, sub: null })).toEqual({ canCreateRound: true, reason: 'billing-off' });
    expect(decideEntitlement({ billingEnabled: false, exempt: false, sub: { status: 'unpaid', freeRoundsUsed: 4 } }).canCreateRound).toBe(true);
  });

  it('lets exempt players play with no card, even with a failed payment on file', () => {
    expect(decideEntitlement({ billingEnabled: true, exempt: true, sub: null })).toEqual({ canCreateRound: true, reason: 'exempt' });
    expect(decideEntitlement({ billingEnabled: true, exempt: true, sub: { status: 'past_due', freeRoundsUsed: 4 } })).toEqual({ canCreateRound: true, reason: 'exempt' });
  });

  it('asks a new player for a card before their first round', () => {
    expect(on(null)).toEqual({ canCreateRound: false, gate: 'claim-free-rounds' });
    expect(on({ status: null, freeRoundsUsed: 0 })).toEqual({ canCreateRound: false, gate: 'claim-free-rounds' });
    expect(on({ status: 'incomplete_expired', freeRoundsUsed: 0 })).toEqual({ canCreateRound: false, gate: 'claim-free-rounds' });
  });

  it('with a card on file, rounds one to four are free and say how many are left', () => {
    expect(on({ status: 'trialing', freeRoundsUsed: 0 })).toEqual({ canCreateRound: true, reason: 'free-round', freeRoundsLeft: 4 });
    expect(on({ status: 'trialing', freeRoundsUsed: 3 })).toEqual({ canCreateRound: true, reason: 'free-round', freeRoundsLeft: 1 });
  });

  it('the boundary: round five asks to start the membership', () => {
    expect(on({ status: 'trialing', freeRoundsUsed: 4 })).toEqual({ canCreateRound: false, gate: 'start-membership' });
  });

  it('an active member plays; one who has cancelled keeps playing until the period ends', () => {
    expect(on({ status: 'active', freeRoundsUsed: 4 })).toEqual({ canCreateRound: true, reason: 'member', endsAtPeriodEnd: false });
    expect(on({ status: 'active', freeRoundsUsed: 4, cancelAtPeriodEnd: true })).toEqual({ canCreateRound: true, reason: 'member', endsAtPeriodEnd: true });
  });

  it('re-locks when the period ends after cancelling, without handing the free rounds out again', () => {
    expect(on({ status: 'canceled', freeRoundsUsed: 4 })).toEqual({ canCreateRound: false, gate: 'rejoin' });
  });

  it('a player who cancelled part-way through the free rounds can come back for the rest', () => {
    expect(on({ status: 'canceled', freeRoundsUsed: 2 })).toEqual({ canCreateRound: false, gate: 'claim-free-rounds' });
  });

  it('a failed payment stops new rounds at once, while Stripe retries and after it gives up', () => {
    expect(on({ status: 'past_due', freeRoundsUsed: 4 })).toEqual({ canCreateRound: false, gate: 'fix-payment' });
    expect(on({ status: 'unpaid', freeRoundsUsed: 4 })).toEqual({ canCreateRound: false, gate: 'fix-payment' });
  });

  it('treats paused and unknown statuses as no subscription', () => {
    expect(on({ status: 'paused', freeRoundsUsed: 4 })).toEqual({ canCreateRound: false, gate: 'rejoin' });
    expect(on({ status: 'something_new', freeRoundsUsed: 0 })).toEqual({ canCreateRound: false, gate: 'claim-free-rounds' });
  });
});

describe('isBillingExempt', () => {
  const player = { email: 'someone@example.com', isAdmin: false, createdAt: new Date('2026-10-05T00:00:00Z') };

  it('the admin is exempt with no env at all', () => {
    expect(isBillingExempt({ ...player, isAdmin: true }, {})).toBe(true);
  });

  it('free-forever accounts skip billing with no env at all, matched by hash in any case', () => {
    const founder = new Set([createHash('sha256').update('founder@example.com').digest('hex')]);
    expect(isBillingExempt({ ...player, email: 'founder@example.com' }, {}, founder)).toBe(true);
    expect(isBillingExempt({ ...player, email: ' Founder@Example.com ' }, {}, founder)).toBe(true);
    expect(isBillingExempt({ ...player, email: 'founder2@example.com' }, {}, founder)).toBe(false);
  });

  it('the built-in free-forever list holds hashes, never addresses', () => {
    expect(FREE_FOREVER_SHA256.size).toBe(1);
    for (const h of FREE_FOREVER_SHA256) expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it('matches the exempt list case-insensitively, ignoring spaces and empty entries', () => {
    const env = { BILLING_EXEMPT_EMAILS: ' Pro@Elmpark.ie, ,tester@example.com ' };
    expect(isBillingExempt({ ...player, email: 'pro@elmpark.ie' }, env)).toBe(true);
    expect(isBillingExempt({ ...player, email: 'TESTER@example.com' }, env)).toBe(true);
    expect(isBillingExempt(player, env)).toBe(false);
    expect(isBillingExempt({ ...player, email: '' }, { BILLING_EXEMPT_EMAILS: ',' })).toBe(false);
  });

  it('players who joined before the cutoff are exempt; anyone joining on or after it is not', () => {
    const env = { BILLING_EXEMPT_JOINED_BEFORE: '2026-10-01' };
    expect(isBillingExempt({ ...player, createdAt: new Date('2026-09-21T09:00:00Z') }, env)).toBe(true);
    expect(isBillingExempt({ ...player, createdAt: new Date('2026-10-01T00:00:00Z') }, env)).toBe(false);
    expect(isBillingExempt({ ...player, createdAt: new Date('2026-09-21T09:00:00Z') }, {})).toBe(false);
  });
});

describe('parseCutoff', () => {
  it('reads an ISO date, and treats blank or nonsense as no cutoff', () => {
    expect(parseCutoff('2026-10-01')).toEqual(new Date('2026-10-01T00:00:00Z'));
    expect(parseCutoff(undefined)).toBeNull();
    expect(parseCutoff('  ')).toBeNull();
    expect(parseCutoff('next tuesday')).toBeNull();
  });
});

describe('isBillingEnabled', () => {
  it('is on only for an explicit 1 or true', () => {
    expect(isBillingEnabled('1')).toBe(true);
    expect(isBillingEnabled('true')).toBe(true);
    for (const v of [undefined, '', '0', 'false', 'yes']) expect(isBillingEnabled(v)).toBe(false);
  });
});
