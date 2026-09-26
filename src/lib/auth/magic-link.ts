/**
 * Magic-link sign-in: the email itself, and the dev/test capture of the last link.
 *
 * Why an `invited_emails` table exists: the invite arrives as a cookie from `/join/<token>`, but
 * the emailed link is very often opened in a DIFFERENT browser (a mail app's in-app browser),
 * where that cookie doesn't exist. So the moment someone with a valid invite asks for a link, the
 * address is recorded as pre-authorised, and the sign-up gate accepts it wherever the link opens.
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { invitedEmails, user } from '../../db/schema';
import { BRAND_NAME } from '../brand';

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

/** The sign-in email. Plain, short, and says how long the link lasts. */
export function magicLinkEmail(url: string, minutes: number, isNewAccount: boolean): { subject: string; text: string; html: string } {
  const subject = isNewAccount ? `Join ${BRAND_NAME}` : `Your ${BRAND_NAME} sign-in link`;
  const lead = isNewAccount
    ? `Tap the link below to set up your ${BRAND_NAME} account. No password needed.`
    : `Tap the link below to sign in to ${BRAND_NAME}. No password needed.`;
  const footer = `The link works once and expires in ${minutes} minutes. If you didn't ask for it, ignore this email.`;
  return {
    subject,
    text: `${lead}\n\n${url}\n\n${footer}`,
    html: `<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#1C2620">
  <p>${lead}</p>
  <p><a href="${url}" style="display:inline-block;background:#144433;color:#F6F0DE;padding:12px 20px;border-radius:4px;text-decoration:none">Sign in</a></p>
  <p style="font-size:13px;color:#5F6B63">${footer}</p>
  <p style="font-size:13px;color:#5F6B63">Or paste this into your browser:<br><span style="word-break:break-all">${url}</span></p>
</div>`,
  };
}

export async function userExists(email: string): Promise<boolean> {
  const [row] = await db.select({ id: user.id }).from(user).where(eq(user.email, normaliseEmail(email))).limit(1);
  return Boolean(row);
}

/** Remember that this address proved it had a valid invite, so the link can open in any browser. */
export async function rememberInvitedEmail(email: string): Promise<void> {
  await db.insert(invitedEmails).values({ email: normaliseEmail(email) }).onConflictDoNothing();
}

export async function isInvitedEmail(email: string): Promise<boolean> {
  const [row] = await db
    .select({ email: invitedEmails.email })
    .from(invitedEmails)
    .where(eq(invitedEmails.email, normaliseEmail(email)))
    .limit(1);
  return Boolean(row);
}

/**
 * The last link generated, kept in memory OUTSIDE production so local dev and tests can follow it
 * without a mail provider. Never populated in production.
 */
let lastLink: { email: string; url: string } | null = null;
export const captureMagicLink = (email: string, url: string) => {
  if (process.env.NODE_ENV !== 'production') lastLink = { email, url };
};
export const lastMagicLink = () => lastLink;
