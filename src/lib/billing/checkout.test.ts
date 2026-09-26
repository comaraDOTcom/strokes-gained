import { describe, expect, it } from 'vitest';
import { buildCheckoutParams, checkoutKindFor, TRIAL_DAYS } from './checkout';

const base = { userId: 'alice', customerId: 'cus_alice', priceId: 'price_player', origin: 'https://btm.example' };

describe('checkoutKindFor', () => {
  it('claims with a card before the free rounds, rejoins after them, and never starts a second subscription', () => {
    expect(checkoutKindFor('claim-free-rounds')).toBe('claim');
    expect(checkoutKindFor('rejoin')).toBe('rejoin');
    expect(checkoutKindFor('start-membership')).toBeNull();
    expect(checkoutKindFor('fix-payment')).toBeNull();
  });
});

describe('buildCheckoutParams', () => {
  it('uses the Checkout Studio settings as configured', () => {
    expect(buildCheckoutParams({ ...base, kind: 'claim' })).toMatchObject({
      ui_mode: 'hosted_page',
      billing_address_collection: 'auto',
      phone_number_collection: { enabled: true },
      automatic_tax: { enabled: false },
      allow_promotion_codes: false,
      payment_method_collection: 'always',
      submit_type: 'auto',
      name_collection: { individual: { enabled: true, optional: true } },
      integration_identifier: 'hosted_web_0001',
      origin_context: 'web',
    });
  });

  it('claiming: a €12.99 subscription on a trial that only round five ends, linked to the player', () => {
    const p = buildCheckoutParams({ ...base, kind: 'claim' });
    expect(p).toMatchObject({
      mode: 'subscription',
      line_items: [{ price: 'price_player', quantity: 1 }],
      customer: 'cus_alice',
      client_reference_id: 'alice',
      subscription_data: {
        metadata: { userId: 'alice' },
        trial_period_days: TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      },
      success_url: 'https://btm.example/billing/welcome?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: 'https://btm.example/rounds/new',
    });
    expect(TRIAL_DAYS).toBe(730);
    expect(p.custom_text).toEqual({ submit: { message: 'Nothing is taken today. €12.99 a month starts only when you tee up round five. Cancel any time.' } });
  });

  it('rejoining: no trial and no "nothing today" line, because the first €12.99 is taken at once', () => {
    const p = buildCheckoutParams({ ...base, kind: 'rejoin' });
    expect(p.subscription_data).toEqual({ metadata: { userId: 'alice' } });
    expect(p.custom_text).toBeUndefined();
  });
});
