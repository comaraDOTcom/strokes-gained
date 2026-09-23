'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth/auth-client';

export function GoogleButton({ label }: { label: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const res = await authClient.signIn.social({ provider: 'google', callbackURL: '/' });
    // On success the browser is already navigating to Google; only failures land here.
    if (res?.error) {
      setError(res.error.message ?? 'Could not start Google sign-in.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void go()}
        disabled={busy}
        className="w-full bg-ink text-paper rounded-lg py-3 text-base font-medium disabled:opacity-50"
      >
        {busy ? 'Opening Google…' : label}
      </button>
      {error && <p className="text-neg text-sm">{error}</p>}
    </div>
  );
}

/**
 * Email me a link — no password, no Google. The reply is deliberately the same whether or not the
 * address may sign in, so the page never reveals who has an account.
 */
export function MagicLinkForm({ invited }: { invited: boolean }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState('sending');
    setError(null);
    const res = await authClient.signIn.magicLink({
      email: email.trim(),
      callbackURL: '/',
      // A used or expired link lands back here with an explanation, not on a home page it can't open.
      errorCallbackURL: '/login?error=link_used',
    });
    if (res?.error) {
      setError(res.error.message ?? 'Could not send the link. Try again.');
      setState('idle');
      return;
    }
    setState('sent');
  }

  if (state === 'sent') {
    return (
      <div className="space-y-1 rounded-lg bg-pos-soft px-3 py-3 text-sm text-pos">
        <p className="font-medium">Check your email.</p>
        <p>
          If <span className="font-mono">{email.trim()}</span> can sign in, a link is on its way. It works once and
          lasts 15 minutes.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="magic-email" className="block text-sm text-ink-2">
        Or use your email — no password
      </label>
      <input
        id="magic-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="w-full rounded-lg border border-line-strong bg-paper px-3 py-3 text-base"
      />
      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-lg border border-line-strong py-3 text-base font-medium disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : invited ? 'Email me a join link' : 'Email me a sign-in link'}
      </button>
      {error && <p className="text-sm text-neg">{error}</p>}
    </form>
  );
}

/** LOCAL DEV / TESTS ONLY (rendered only when AUTH_TEST_MODE=1 outside production). */
export function TestLoginForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const password = 'test-password-123';
    const name = email.split('@')[0] || 'tester';
    const signedIn = await authClient.signIn.email({ email, password });
    if (!signedIn.error) {
      window.location.href = '/';
      return;
    }
    const signedUp = await authClient.signUp.email({ email, password, name });
    if (signedUp.error) setError(signedUp.error.message ?? 'Sign-in failed');
    else window.location.href = '/';
  }

  return (
    <form onSubmit={submit} className="border border-dashed border-line-strong rounded-lg p-3 space-y-2">
      <p className="font-mono text-xs uppercase tracking-wide text-muted">Test mode — not Google</p>
      <input
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="tester@example.com"
        className="w-full border border-line-strong bg-paper rounded-lg px-3 py-2 text-base"
      />
      <button type="submit" className="w-full border border-line-strong rounded-lg py-2 text-sm">
        Sign in / sign up (test)
      </button>
      {error && <p className="text-neg text-sm">{error}</p>}
    </form>
  );
}
