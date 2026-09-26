/**
 * Starting Stripe Checkout: "Claim your free rounds" (with the trial) or "Rejoin" (without).
 * Pure: the route (src/app/api/billing/checkout/route.ts) sends these to Stripe, and
 * `ensureCustomer` in ./store.ts keeps one Stripe customer per player.
 */
import type Stripe from 'stripe';
import type { Gate } from './entitlement';

/**
 * What the Player price reads as in our copy. Must match the Stripe price in STRIPE_PRICE_PLAYER
 * (€12.99 a month, set by Conor in the Stripe dashboard); change both together.
 */
export const PLAYER_PRICE_LABEL = '€12.99';

/** Stripe's maximum. The trial is the free rounds; only starting round five ends it (plan D2). */
export const TRIAL_DAYS = 730;

/** Which Checkout, if any, a gate leads to. */
export function checkoutKindFor(gate: Gate): 'claim' | 'rejoin' | null {
  if (gate === 'claim-free-rounds') return 'claim';
  if (gate === 'rejoin') return 'rejoin';
  return null; // start-membership and fix-payment act on the existing subscription, not a new one
}

/**
 * The Checkout Session parameters. The first block is what Conor configured in Stripe's Checkout
 * Studio, used as given; the rest is this app's plan (docs/billing/plan.md, section 3).
 */
export function buildCheckoutParams(input: {
  kind: 'claim' | 'rejoin';
  userId: string;
  customerId: string;
  priceId: string;
  origin: string;
}): Stripe.Checkout.SessionCreateParams {
  const claim = input.kind === 'claim';
  return {
    // --- From Checkout Studio ---
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

    // --- This app ---
    mode: 'subscription',
    line_items: [{ price: input.priceId, quantity: 1 }],
    customer: input.customerId,
    client_reference_id: input.userId,
    subscription_data: {
      metadata: { userId: input.userId },
      ...(claim && {
        trial_period_days: TRIAL_DAYS,
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
      }),
    },
    ...(claim && {
      custom_text: {
        submit: { message: `Nothing is taken today. ${PLAYER_PRICE_LABEL} a month starts only when you tee up round five. Cancel any time.` },
      },
    }),
    success_url: `${input.origin}/billing/welcome?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${input.origin}/rounds/new`,
  };
}
