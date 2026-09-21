/**
 * Better Auth server instance: Google sign-in, sessions in our Postgres, and an
 * invite gate on account creation.
 *
 * Environment:
 *   BETTER_AUTH_SECRET   required in production (`openssl rand -base64 32`)
 *   BETTER_AUTH_URL      the site's public origin (e.g. https://strokes-gained.vercel.app)
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 *   ADMIN_EMAIL          the admin's Google address; may always sign up, and inherits legacy rounds
 *   INVITE_TOKEN         the secret in the WhatsApp link `/join/<token>`; rotate to revoke
 *   AUTH_TEST_MODE=1     ONLY for local tests/dev: enables email+password so flows can be
 *                        exercised without Google. Hard-disabled when NODE_ENV=production.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { db } from '../../db/client';
import { user, session, account, verification } from '../../db/schema';
import { INVITE_COOKIE, isAdminEmail, mayCreateAccount } from './config';
import { claimLegacyData } from './claim';

const testMode = process.env.AUTH_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';

const googleConfigured = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

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
          const allowed = mayCreateAccount({
            email: newUser.email,
            emailVerified: Boolean(newUser.emailVerified),
            inviteCookie: ctx?.getCookie(INVITE_COOKIE) ?? null,
          });
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

  plugins: [nextCookies()],
});
