/**
 * Stripe webhook. Public (see src/middleware.ts): Stripe has no session cookie, so the signature
 * is the only authentication. Everything after verification lives in src/lib/billing/webhook.ts.
 *
 *   Local:  stripe listen --forward-to localhost:3000/api/billing/webhook \
 *             --events checkout.session.completed,customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,customer.subscription.paused,customer.subscription.resumed
 *           (prints the whsec_… for STRIPE_WEBHOOK_SECRET; CLI 1.52+ requires --events)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/billing/stripe';
import { applyStripeEvent } from '@/lib/billing/webhook';

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get('stripe-signature');
  if (!secret) return NextResponse.json({ error: 'Webhook not configured' }, { status: 503 });
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const stripe = getStripe();
  let event;
  try {
    // The raw body, byte for byte: the signature is over it, so it must not be parsed first.
    event = stripe.webhooks.constructEvent(await req.text(), signature, secret);
  } catch {
    return NextResponse.json({ error: 'Bad signature' }, { status: 400 });
  }

  const outcome = await applyStripeEvent(event, {
    fetchSubscription: (id) => stripe.subscriptions.retrieve(id, { expand: ['default_payment_method'] }),
  });
  return NextResponse.json({ received: true, outcome });
}
