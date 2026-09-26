'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/** Owner-only "Delete round". Two taps: the first arms it and says what will go, the second
 * deletes the round and every shot on it, then returns to the rounds list. */
export function DeleteRoundButton({ roundId, shotCount }: { roundId: number; shotCount: number }) {
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Could not delete the round');
        return;
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Could not reach the server — try again.');
    } finally {
      setBusy(false);
    }
  }

  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className="text-sm text-neg underline underline-offset-2">
        Delete this round
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-neg p-4 space-y-3" role="alertdialog" aria-labelledby="delete-round-q">
      <p id="delete-round-q" className="text-sm">
        Delete this round
        {shotCount > 0 ? ` and its ${shotCount} shot${shotCount === 1 ? '' : 's'}` : ''}? This can&apos;t be undone.
      </p>
      {error && <p className="text-neg text-sm">{error}</p>}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className="bg-neg text-paper rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          {busy ? 'Deleting…' : 'Delete round'}
        </button>
        <button
          type="button"
          onClick={() => setArmed(false)}
          disabled={busy}
          className="rounded-lg border px-4 py-2 text-sm"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
