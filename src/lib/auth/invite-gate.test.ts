/**
 * The invite gate, exercised through the REAL Better Auth sign-up path (test-mode
 * email+password instead of Google — the `user.create.before` hook is the same
 * code path either way).
 */
import { describe, expect, it, afterEach, vi } from 'vitest';
import { freshDb } from '../../db/test-helpers';

let closers: (() => Promise<void>)[] = [];
afterEach(async () => {
  await Promise.all(closers.map((c) => c()));
  closers = [];
  vi.unstubAllEnvs();
});

async function arrange() {
  vi.stubEnv('AUTH_TEST_MODE', '1');
  vi.stubEnv('INVITE_TOKEN', 'alpha-invite');
  vi.stubEnv('ADMIN_EMAIL', 'conor@omni.co');
  vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-test-secret-test-secret-123');
  const ctx = await freshDb();
  closers.push(ctx.closeDb);
  const { auth } = await import('./auth');
  const signUp = (email: string, cookie?: string) =>
    auth.api.signUpEmail({
      body: { email, password: 'correct-horse-battery', name: email.split('@')[0]! },
      headers: new Headers(cookie ? { cookie } : {}),
    });
  const emails = async () => (await ctx.db.select().from(ctx.schema.user)).map((u) => u.email);
  return { ...ctx, auth, signUp, emails };
}

describe('invite gate', () => {
  it('rejects a new account with no invite cookie — and creates no user', async () => {
    const { signUp, emails } = await arrange();
    await expect(signUp('stranger@example.com')).rejects.toBeDefined();
    expect(await emails()).toEqual([]);
  });

  it('rejects a wrong invite token', async () => {
    const { signUp, emails } = await arrange();
    await expect(signUp('stranger@example.com', 'sg_invite=guess')).rejects.toBeDefined();
    expect(await emails()).toEqual([]);
  });

  it('accepts a new account carrying the valid invite cookie', async () => {
    const { signUp, emails } = await arrange();
    await signUp('friend@example.com', 'sg_invite=alpha-invite');
    expect(await emails()).toEqual(['friend@example.com']);
  });

  it('the invite cookie is not enough to become the admin', async () => {
    const { signUp, emails, db, schema } = await arrange();
    // An unverified sign-up claiming the admin address gets in only via the invite, and is NOT admin-verified.
    await signUp('conor@omni.co', 'sg_invite=alpha-invite');
    const [u] = await db.select().from(schema.user);
    expect(u!.emailVerified).toBe(false);
    expect(await emails()).toEqual(['conor@omni.co']);
  });

  it('with no INVITE_TOKEN configured, nobody can sign up (fails closed)', async () => {
    vi.stubEnv('AUTH_TEST_MODE', '1');
    vi.stubEnv('INVITE_TOKEN', '');
    vi.stubEnv('ADMIN_EMAIL', 'conor@omni.co');
    vi.stubEnv('BETTER_AUTH_SECRET', 'test-secret-test-secret-test-secret-123');
    const ctx = await freshDb();
    closers.push(ctx.closeDb);
    const { auth } = await import('./auth');
    await expect(
      auth.api.signUpEmail({
        body: { email: 'x@example.com', password: 'correct-horse-battery', name: 'x' },
        headers: new Headers({ cookie: 'sg_invite=' }),
      }),
    ).rejects.toBeDefined();
  });
});
