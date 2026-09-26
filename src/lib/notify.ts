/**
 * Outgoing email (Resend). Two callers: admin notifications, and the magic-link sign-in.
 *
 * DELIVERABILITY: with no verified domain, Resend's `onboarding@resend.dev` sender only delivers
 * to the Resend account owner's own address. Magic links for anyone else therefore need
 * `NOTIFY_FROM` set to an address on a domain verified in Resend.
 *
 * `sendEmail` NEVER throws — a failed send must not take down the request that triggered it — and
 * never logs the recipient's address.
 */
import { BRAND_NAME } from './brand';

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<'sent' | 'skipped' | 'failed'> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return 'skipped';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM ?? `${BRAND_NAME} <onboarding@resend.dev>`,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        ...(input.html ? { html: input.html } : {}),
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[email] Resend responded ${res.status}`);
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('[email] failed:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}

/**
 * Email the admin. Optional: does nothing unless RESEND_API_KEY is set (resend.com — the free
 * tier can send to the account owner's own address from onboarding@resend.dev with no domain
 * setup, which is exactly this use). NEVER throws: a notification failing must not fail the
 * action that triggered it — the request is already saved and shows in the admin's Courses page.
 */
/** Email the admin (course requests and the like). No-op without RESEND_API_KEY / ADMIN_EMAIL. */
export async function notifyAdmin(subject: string, text: string): Promise<'sent' | 'skipped' | 'failed'> {
  const to = process.env.ADMIN_EMAIL;
  if (!to) return 'skipped';
  return sendEmail({ to, subject, text });
}
