'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Admin: link this scorecard course to its entry in the course directory, so rounds here count it
 * as played on everyone's /profile. Type to search (the datalist), pick, save.
 */
export function DirectoryLink({
  courseId,
  current,
  options,
}: {
  courseId: number;
  current: { key: string; label: string } | null;
  options: { key: string; label: string }[];
}) {
  const router = useRouter();
  const [text, setText] = useState(current?.label ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listId = `directory-options-${courseId}`;

  async function save(directoryKey: string | null) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ directoryKey }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save');
      if (directoryKey === null) setText('');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const match = options.find((o) => o.label === text.trim());
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">On the course map as</p>
      <div className="flex flex-wrap gap-2">
        <input
          list={listId}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Search the directory…"
          aria-label="Directory course"
          className="flex-1 min-w-0 border border-line-strong bg-paper rounded-lg px-3 py-1.5 text-sm placeholder:text-faint"
        />
        <datalist id={listId}>
          {options.map((o) => (
            <option key={o.key} value={o.label} />
          ))}
        </datalist>
        <button
          type="button"
          disabled={busy || !match || match.key === current?.key}
          onClick={() => match && save(match.key)}
          className="rounded-lg border border-line-strong px-3 py-1.5 text-sm disabled:opacity-50"
        >
          Link
        </button>
        {current && (
          <button type="button" disabled={busy} onClick={() => save(null)} className="text-sm underline underline-offset-2 disabled:opacity-50">
            Unlink
          </button>
        )}
      </div>
      <p className="font-mono text-xs text-muted">
        {current ? `Linked: ${current.label}` : 'Not linked — rounds here won’t tick it off on players’ maps.'}
      </p>
      {error && <p className="text-neg text-sm">{error}</p>}
    </div>
  );
}
