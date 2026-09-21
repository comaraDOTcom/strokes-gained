'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export function CourseRequestForm() {
  const router = useRouter();
  const [courseName, setCourseName] = useState('');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/course-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseName, details }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Could not send the request');
        return;
      }
      setSent(courseName.trim());
      setCourseName('');
      setDetails('');
      router.refresh();
    } catch {
      setError('Could not reach the server — try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Course name</span>
        <input
          type="text"
          required
          minLength={3}
          maxLength={120}
          value={courseName}
          onChange={(e) => setCourseName(e.target.value)}
          placeholder="e.g. The Island Golf Club"
          className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-base placeholder:text-faint"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Anything that helps <span className="text-muted font-normal">(optional)</span>
        </span>
        <textarea
          rows={3}
          maxLength={1000}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Where it is, which tees you play, a link to the scorecard…"
          className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-base placeholder:text-faint"
        />
      </label>
      {error && <p className="text-neg text-sm">{error}</p>}
      {sent && <p className="text-pos text-sm">Request sent for “{sent}”. It&apos;ll appear in the list once it&apos;s added.</p>}
      <button
        type="submit"
        disabled={busy}
        className="bg-ink text-paper rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? 'Sending…' : 'Request this course'}
      </button>
    </form>
  );
}

/** Admin: mark a request done. */
export function RequestDoneButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/course-requests/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        });
        router.refresh();
      }}
      className="shrink-0 rounded-lg border border-line-strong px-2.5 py-1 text-xs disabled:opacity-50"
    >
      {busy ? '…' : 'Mark done'}
    </button>
  );
}
