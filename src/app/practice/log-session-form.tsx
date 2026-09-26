'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export type FormDrill = { id: string; name: string; outOf: number; passMark: number; scoreUnit: string; inPlan: boolean };

/** Log a practice session: date, drill, score. Pass or fail shows as you type; the server decides. */
export function LogSessionForm({ drills, today, defaultDrillId }: { drills: FormDrill[]; today: string; defaultDrillId: string }) {
  const router = useRouter();
  const [practisedOn, setPractisedOn] = useState(today);
  const [drillId, setDrillId] = useState(defaultDrillId);
  const [score, setScore] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const drill = drills.find((d) => d.id === drillId) ?? drills[0]!;
  const n = score === '' ? null : Number(score);
  const valid = n !== null && Number.isInteger(n) && n >= 0 && n <= drill.outOf;
  const planned = drills.filter((d) => d.inPlan);
  const others = drills.filter((d) => !d.inPlan);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    setSaved(null);
    try {
      const res = await fetch('/api/practice/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ practisedOn, drillId, score: n }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Could not save the session.');
        return;
      }
      setSaved(`${drill.name}: ${n} of ${drill.outOf}, ${data.passed ? 'passed' : 'not passed yet'}. Saved.`);
      setScore('');
      router.refresh();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const field = 'border border-line-strong bg-paper rounded-lg px-3 py-2 text-base';
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Date</span>
          <input type="date" required max={today} value={practisedOn} onChange={(e) => setPractisedOn(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-sm font-medium">Drill</span>
          <select value={drillId} onChange={(e) => setDrillId(e.target.value)} className={field}>
            {planned.length > 0 && (
              <optgroup label="In your plan">
                {planned.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label={planned.length > 0 ? 'Other drills' : 'Drills'}>
              {others.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Score <span className="font-normal text-muted">({drill.scoreUnit}, out of {drill.outOf})</span>
        </span>
        <div className="flex items-center gap-3">
          <input
            type="number"
            inputMode="numeric"
            required
            min={0}
            max={drill.outOf}
            step={1}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className={`${field} w-24 font-mono`}
          />
          <span className="font-mono text-sm text-muted">/ {drill.outOf}</span>
          {valid && (
            <span
              className={`rounded px-2 py-0.5 font-mono text-xs uppercase tracking-wide ${
                n! >= drill.passMark ? 'bg-pos-soft text-pos' : 'bg-paper-2 text-ink-2'
              }`}
            >
              {n! >= drill.passMark ? 'Pass' : 'Not yet'} · {drill.passMark} to pass
            </span>
          )}
        </div>
      </label>
      {error && <p className="text-sm text-neg">{error}</p>}
      {saved && <p className="text-sm text-pos">{saved}</p>}
      <button type="submit" disabled={busy || !valid} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-50">
        {busy ? 'Saving…' : 'Log session'}
      </button>
    </form>
  );
}

/** Delete one logged session, after a confirm. */
export function DeleteSessionButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      aria-label={`Delete ${label}`}
      onClick={async () => {
        if (!window.confirm(`Delete ${label}?`)) return;
        setBusy(true);
        await fetch(`/api/practice/sessions/${id}`, { method: 'DELETE' });
        router.refresh();
      }}
      className="shrink-0 rounded-lg border border-line-strong px-2 py-0.5 text-xs text-ink-2 disabled:opacity-50"
    >
      {busy ? '…' : 'Delete'}
    </button>
  );
}
