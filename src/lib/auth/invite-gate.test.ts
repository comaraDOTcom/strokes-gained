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
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000'); // the magic link needs an origin
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

describe('magic-link sign-in', () => {
  async function arrangeMagic() {
    const ctx = await arrange();
    const { lastMagicLink } = await import('./magic-link');
    const request = (email: string, cookie?: string) =>
      ctx.auth.api.signInMagicLink({
        body: { email, callbackURL: '/' },
        headers: new Headers(cookie ? { cookie } : {}),
      });
    /** Follow the emailed link, as a browser that may not carry the invite cookie. */
    const follow = async (cookie?: string) => {
      const url = new URL(lastMagicLink()!.url);
      return ctx.auth.api.magicLinkVerify({
        query: { token: url.searchParams.get('token')!, callbackURL: '/' },
        headers: new Headers(cookie ? { cookie } : {}),
        asResponse: true,
      });
    };
    return { ...ctx, request, follow, lastMagicLink };
  }

  it('emails no link to an address with no invite, and creates nothing', async () => {
    const { request, lastMagicLink, emails } = await arrangeMagic();
    await request('stranger@example.com');
    expect(lastMagicLink()).toBeNull();
    expect(await emails()).toEqual([]);
  });

  it('signs a new player up when the request carried the invite', async () => {
    const { request, follow, emails, lastMagicLink } = await arrangeMagic();
    await request('friend@example.com', 'sg_invite=alpha-invite');
    expect(lastMagicLink()!.email).toBe('friend@example.com');
    await follow('sg_invite=alpha-invite');
    expect(await emails()).toEqual(['friend@example.com']);
  });

  it('still works when the link is opened in a browser without the invite cookie', async () => {
    // The common case: the invite is clicked in Safari, the email opens in Gmail's own browser.
    const { request, follow, emails, db, schema } = await arrangeMagic();
    await request('friend@example.com', 'sg_invite=alpha-invite');
    await follow(); // no cookie at all
    expect(await emails()).toEqual(['friend@example.com']);
    const [u] = await db.select().from(schema.user);
    expect(u!.emailVerified).toBe(true); // clicking the emailed link proves the address
  });

  it('lets the admin in without an invite, and hands them the legacy rounds', async () => {
    const { request, follow, emails, lastMagicLink } = await arrangeMagic();
    await request('conor@omni.co');
    expect(lastMagicLink()!.email).toBe('conor@omni.co');
    await follow();
    expect(await emails()).toEqual(['conor@omni.co']);
  });

  it('emails an existing member a link without needing an invite', async () => {
    const { signUp, request, follow, emails, lastMagicLink } = await arrangeMagic();
    await signUp('member@example.com', 'sg_invite=alpha-invite');
    await request('member@example.com'); // no invite cookie, already a member
    expect(lastMagicLink()!.email).toBe('member@example.com');
    await follow();
    expect(await emails()).toEqual(['member@example.com']); // signed in, not duplicated
  });

  it('a token only works once — the second use is refused and mints no session', async () => {
    const { request, follow, db, schema } = await arrangeMagic();
    await request('friend@example.com', 'sg_invite=alpha-invite');
    const first = await follow();
    expect(first.headers.get('location')).not.toContain('error');
    const second = await follow();
    expect(second.headers.get('location')).toContain('error=INVALID_TOKEN');
    expect(await db.select().from(schema.session)).toHaveLength(1);
  });
});
