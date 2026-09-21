'use client';

import { authClient } from '@/lib/auth/auth-client';

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={async () => {
        await authClient.signOut();
        window.location.href = '/login';
      }}
      className="text-ink-2 hover:text-ink underline-offset-4 hover:underline"
    >
      Sign out
    </button>
  );
}
