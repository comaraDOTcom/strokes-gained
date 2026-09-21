/**
 * Pure auth policy helpers — no DB, no framework — so the rules that decide who
 * gets in and who is the admin can be unit-tested exhaustively.
 */
import { timingSafeEqual } from 'node:crypto';

/** Cookie set by `/join/<token>`; the sign-up gate reads it. */
export const INVITE_COOKIE = 'sg_invite';

/**
 * Is `email` the admin (Conor)? Compares case-insensitively to `ADMIN_EMAIL`.
 * Callers must ALSO require a verified email before granting admin powers — an
 * unverified address proves nothing (see `SessionUser.isAdmin`).
 */
export function isAdminEmail(email: string | null | undefined, adminEmail = process.env.ADMIN_EMAIL): boolean {
  if (!email || !adminEmail) return false;
  return email.trim().toLowerCase() === adminEmail.trim().toLowerCase();
}

/**
 * Does `candidate` match the current invite token? Constant-time, and always
 * false when no `INVITE_TOKEN` is configured (so a missing env var closes
 * sign-up rather than opening it).
 */
export function isValidInvite(candidate: string | null | undefined, expected = process.env.INVITE_TOKEN): boolean {
  if (!candidate || !expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * The sign-up gate: may a NEW account be created?
 * Existing users never reach this (it only runs on user creation).
 */
export function mayCreateAccount(input: {
  email: string;
  emailVerified: boolean;
  inviteCookie: string | null | undefined;
}): boolean {
  // The admin can always create their own account — but only with a verified email.
  if (input.emailVerified && isAdminEmail(input.email)) return true;
  return isValidInvite(input.inviteCookie);
}
