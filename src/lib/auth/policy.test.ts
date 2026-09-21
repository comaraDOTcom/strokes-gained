import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { isAdminEmail, isValidInvite, mayCreateAccount } from './config';
import { canEditRound, canEditCourse } from './permissions';

describe('isAdminEmail', () => {
  it('matches case-insensitively and ignores surrounding space', () => {
    expect(isAdminEmail('Conor@Omni.co', 'conor@omni.co')).toBe(true);
    expect(isAdminEmail(' conor@omni.co ', 'conor@omni.co')).toBe(true);
  });
  it('is false for others, empty input and when no admin is configured', () => {
    expect(isAdminEmail('friend@example.com', 'conor@omni.co')).toBe(false);
    expect(isAdminEmail('', 'conor@omni.co')).toBe(false);
    expect(isAdminEmail(null, 'conor@omni.co')).toBe(false);
    expect(isAdminEmail('conor@omni.co', undefined)).toBe(false);
    expect(isAdminEmail('conor@omni.co', '')).toBe(false);
  });
  it('does not treat a lookalike or suffix as the admin', () => {
    expect(isAdminEmail('xconor@omni.co', 'conor@omni.co')).toBe(false);
    expect(isAdminEmail('conor@omni.co.evil.com', 'conor@omni.co')).toBe(false);
  });
});

describe('isValidInvite', () => {
  it('accepts only the exact token', () => {
    expect(isValidInvite('s3cret', 's3cret')).toBe(true);
    expect(isValidInvite('s3cret ', 's3cret')).toBe(false);
    expect(isValidInvite('S3CRET', 's3cret')).toBe(false);
    expect(isValidInvite('s3cre', 's3cret')).toBe(false);
  });
  it('fails closed when either side is missing', () => {
    expect(isValidInvite(undefined, 's3cret')).toBe(false);
    expect(isValidInvite(null, 's3cret')).toBe(false);
    expect(isValidInvite('', 's3cret')).toBe(false);
    expect(isValidInvite('anything', undefined)).toBe(false);
    expect(isValidInvite('', '')).toBe(false);
  });
});

describe('mayCreateAccount', () => {
  beforeEach(() => {
    vi.stubEnv('ADMIN_EMAIL', 'conor@omni.co');
    vi.stubEnv('INVITE_TOKEN', 'tok');
  });
  afterEach(() => vi.unstubAllEnvs());

  it('lets a new player in with a valid invite cookie', () => {
    expect(mayCreateAccount({ email: 'a@b.com', emailVerified: true, inviteCookie: 'tok' })).toBe(true);
  });
  it('blocks a new player with no cookie or a wrong one', () => {
    expect(mayCreateAccount({ email: 'a@b.com', emailVerified: true, inviteCookie: null })).toBe(false);
    expect(mayCreateAccount({ email: 'a@b.com', emailVerified: true, inviteCookie: 'nope' })).toBe(false);
  });
  it('always lets the VERIFIED admin in, but not an unverified claim to be the admin', () => {
    expect(mayCreateAccount({ email: 'conor@omni.co', emailVerified: true, inviteCookie: null })).toBe(true);
    expect(mayCreateAccount({ email: 'conor@omni.co', emailVerified: false, inviteCookie: null })).toBe(false);
  });

});

describe('canEditRound', () => {
  const me = { id: 'me', isAdmin: false };
  const admin = { id: 'root', isAdmin: true };
  it('owner can, others cannot', () => {
    expect(canEditRound(me, { userId: 'me' })).toBe(true);
    expect(canEditRound(me, { userId: 'someone-else' })).toBe(false);
  });
  it('admin cannot edit other people\'s rounds', () => {
    expect(canEditRound(admin, { userId: 'someone-else' })).toBe(false);
  });
  it('an unclaimed legacy round is admin-only', () => {
    expect(canEditRound(admin, { userId: null })).toBe(true);
    expect(canEditRound(me, { userId: null })).toBe(false);
  });
});

describe('canEditCourse', () => {
  const me = { id: 'me', isAdmin: false };
  const admin = { id: 'root', isAdmin: true };
  it('admin can always edit', () => {
    expect(canEditCourse(admin, { createdByUserId: 'me' }, true)).toBe(true);
    expect(canEditCourse(admin, { createdByUserId: null }, true)).toBe(true);
  });
  it('the creator can edit until someone else has played the tee', () => {
    expect(canEditCourse(me, { createdByUserId: 'me' }, false)).toBe(true);
    expect(canEditCourse(me, { createdByUserId: 'me' }, true)).toBe(false);
  });
  it('non-creators and seeded (null-owner) courses are read-only for normal users', () => {
    expect(canEditCourse(me, { createdByUserId: 'other' }, false)).toBe(false);
    expect(canEditCourse(me, { createdByUserId: null }, false)).toBe(false);
  });
});
