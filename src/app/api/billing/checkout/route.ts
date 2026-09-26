/**
 * "Claim your free rounds" / "Rejoin": sends the player to Stripe's hosted Checkout.
 * A plain form POST, answered with a 303 to the Checkout page (no Stripe.js, so no publishable key).
 * Stripe returns them to /billing/welcome; the webhook writes the result.
 */
import { NextResponse } from 'next/server';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { buildCheckoutParams, checkoutKindFor } from '@/lib/billing/checkout';
import { ensureCustomer, getEntitlement } from '@/lib/billing/store';
import { getStripe } from '@/lib/billing/stripe';

export async function POST() {
  try {
    const user = await requireApiUser();
    const priceId = process.env.STRIPE_PRICE_PLAYER;
    const origin = process.env.BETTER_AUTH_URL;
    if (!priceId || !origin) return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });

    const entitlement = await getEntitlement(user);
    const kind = entitlement.canCreateRound ? null : checkoutKindFor(entitlement.gate);
    if (!kind) return NextResponse.json({ error: 'Nothing to check out' }, { status: 409 });

    const stripe = getStripe();
    const customerId = await ensureCustomer(user, (p) => stripe.customers.create(p));
    const session = await stripe.checkout.sessions.create(
      buildCheckoutParams({ kind, userId: user.id, customerId, priceId, origin: origin.replace(/\/$/, '') }),
    );
    if (!session.url) return NextResponse.json({ error: 'Stripe returned no Checkout page' }, { status: 502 });
    return NextResponse.redirect(session.url, 303);
  } catch (e) {
    return toErrorResponse(e);
  }
}
