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
