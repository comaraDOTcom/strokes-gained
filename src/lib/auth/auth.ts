/**
 * Better Auth server instance: Google sign-in, magic-link (emailed) sign-in, sessions in our
 * Postgres, and an invite gate on account creation.
 *
 * Environment:
 *   BETTER_AUTH_SECRET   required in production (`openssl rand -base64 32`)
 *   BETTER_AUTH_URL      the site's public origin (e.g. https://strokes-gained.vercel.app)
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   ADMIN_EMAIL          the admin's address; may always sign up, and inherits legacy rounds
 *   RESEND_API_KEY       sends the magic-link emails (see src/lib/notify.ts); without it no link
 *                        is emailed, and outside production the URL is logged instead
 *   NOTIFY_FROM          sender address on a Resend-verified domain — REQUIRED to email anyone
 *                        other than the Resend account owner
 *   INVITE_TOKEN         the secret in the WhatsApp link `/join/<token>`; rotate to revoke
 *   AUTH_TEST_MODE=1     ONLY for local tests/dev: enables email+password so flows can be
 *                        exercised without Google. Hard-disabled when NODE_ENV=production.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import { db } from '../../db/client';
import { user, session, account, verification } from '../../db/schema';
import { INVITE_COOKIE, isAdminEmail, isValidInvite, mayCreateAccount } from './config';
import { claimLegacyData } from './claim';
import { captureMagicLink, isInvitedEmail, magicLinkEmail, normaliseEmail, rememberInvitedEmail, userExists } from './magic-link';
import { sendEmail } from '../notify';

const testMode = process.env.AUTH_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

const MAGIC_LINK_MINUTES = 15;

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema: { user, session, account, verification } }),

  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID as string,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
        },
      }
    : {},

  emailAndPassword: { enabled: testMode },

  // Every sign-in reads the session; cache it in a signed cookie so a Neon cold
  // start isn't paid on each navigation.
  session: { cookieCache: { enabled: true, maxAge: 5 * 60 } },

  // A rejected sign-up (no invite) comes back to /login?error=…
  onAPIError: { errorURL: '/login' },

  databaseHooks: {
    user: {
      create: {
        // THE INVITE GATE. Runs only when a new account would be created, so
        // existing members always sign in freely. Returning false aborts it.
        before: async (newUser, ctx) => {
          const allowed =
            mayCreateAccount({
              email: newUser.email,
              emailVerified: Boolean(newUser.emailVerified),
              inviteCookie: ctx?.getCookie(INVITE_COOKIE) ?? null,
            }) ||
            // A magic link opened in another browser has no invite cookie; the address was
            // pre-authorised when the link was requested (see ./magic-link.ts).
            (await isInvitedEmail(newUser.email));
          if (!allowed) return false;
        },
        // The admin inherits the pre-auth rounds the moment their account exists.
        after: async (created) => {
          if (created.emailVerified && isAdminEmail(created.email)) {
            await claimLegacyData(created.id);
          }
        },
      },
    },
  },

  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_MINUTES * 60,
      /**
       * A link is only ever emailed to someone who may actually sign in: an existing member, the
       * admin, or an address carrying a valid invite. Anything else is dropped silently — the
       * endpoint still answers the same way, so this never reveals who has an account.
       */
      sendMagicLink: async ({ email, url }, ctx) => {
        const to = normaliseEmail(email);
        const known = await userExists(to);
        const invited = isValidInvite(ctx?.getCookie(INVITE_COOKIE)) || isAdminEmail(to);
        if (!known && !invited) {
          console.warn('[magic-link] ignored a request for an address with no invite');
          return;
        }
        if (!known) await rememberInvitedEmail(to);
        captureMagicLink(to, url); // dev/test only — never populated in production
        const mail = magicLinkEmail(url, MAGIC_LINK_MINUTES, !known);
        const result = await sendEmail({ to, ...mail });
        if (result !== 'sent') console.warn(`[magic-link] email ${result}`);
        if (result === 'skipped' && process.env.NODE_ENV !== 'production') console.log(`[magic-link] ${url}`);
      },
    }),
    nextCookies(),
  ],
});
