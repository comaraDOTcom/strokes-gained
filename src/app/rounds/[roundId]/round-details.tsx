'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MAX_NAME_LENGTH, MAX_NOTES_LENGTH, type MentalField, type RoundDetails } from '@/lib/rounds/details';

const RATINGS: { key: MentalField; label: string; hint: string }[] = [
  { key: 'mentalConfidence', label: 'Confidence', hint: 'trusted your swing and your decisions' },
  { key: 'mentalFocus', label: 'Focus', hint: 'stayed in the shot, not the score' },
  { key: 'mentalComposure', label: 'Composure', hint: 'reset quickly after a bad shot' },
];

type Draft = { name: string; notes: string } & Pick<RoundDetails, MentalField>;

function toDraft(d: RoundDetails): Draft {
  return {
    name: d.name ?? '',
    notes: d.notes ?? '',
    mentalConfidence: d.mentalConfidence,
    mentalFocus: d.mentalFocus,
    mentalComposure: d.mentalComposure,
  };
}

const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

export function RoundDetailsForm({ roundId, initial }: { roundId: number; initial: RoundDetails }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Draft>(() => toDraft(initial));
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const dirty = !same(saved, draft);

  // A long dictated note is easy to lose — warn before a reload/close drops it.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function update(patch: Partial<Draft>) {
    setDraft((d) => ({ ...d, ...patch }));
    setJustSaved(false);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name,
          notes: draft.notes,
          mentalConfidence: draft.mentalConfidence,
          mentalFocus: draft.mentalFocus,
          mentalComposure: draft.mentalComposure,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save');
        return;
      }
      const next = toDraft(data as RoundDetails);
      setSaved(next);
      setDraft(next);
      setJustSaved(true);
      router.refresh(); // header + rounds list pick up the new name
    } catch {
      setError('Could not reach the server — your text is still here, try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border rounded-xl bg-card p-4 space-y-5" aria-labelledby="round-details-heading">
      <div>
        <h2 id="round-details-heading" className="font-semibold text-lg">
          Round notes
        </h2>
        <p className="text-xs text-muted">Name it, write it up, and rate your head. Doesn&apos;t affect strokes gained.</p>
      </div>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-muted">Round name</span>
        <input
          type="text"
          value={draft.name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="e.g. Medal Final 2026"
          onChange={(e) => update({ name: e.target.value })}
          className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-base"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-xs uppercase tracking-wide text-muted">Commentary</span>
        <textarea
          value={draft.notes}
          maxLength={MAX_NOTES_LENGTH}
          rows={10}
          placeholder="How it went, how you felt, what you'd change. Paste a transcribed voice note here, or use your keyboard's dictation."
          onChange={(e) => update({ notes: e.target.value })}
          className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-base leading-relaxed"
        />
        <span className="text-xs text-faint self-end font-mono">{draft.notes.length.toLocaleString()} chars</span>
      </label>

      <fieldset className="space-y-3">
        <legend className="font-mono text-xs uppercase tracking-wide text-muted mb-1">Mentality</legend>
        {RATINGS.map(({ key, label, hint }) => (
          <div key={key} className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{label}</span> <span className="text-muted">— {hint}</span>
            </p>
            <div className="flex gap-1.5" role="group" aria-label={`${label}, 1 poor to 5 excellent`}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = draft[key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={on}
                    // Tap the selected value again to clear it.
                    onClick={() => update({ [key]: on ? null : n })}
                    className={`w-11 h-11 rounded-lg border font-mono text-sm ${
                      on ? 'bg-accent-soft border-accent text-ink font-medium' : 'bg-paper border-line-strong text-ink-2'
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <p className="text-xs text-faint font-mono">1 = poor · 5 = excellent · tap again to clear</p>
      </fieldset>

      {error && <p className="text-neg text-sm">{error}</p>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void save()}
          disabled={busy || !dirty}
          className="bg-ink text-paper rounded-lg px-5 py-3 text-base font-medium disabled:opacity-40"
        >
          {busy ? 'Saving…' : !dirty && justSaved ? 'Saved ✓' : 'Save notes'}
        </button>
        <span className={`text-sm ${dirty ? 'text-neg' : justSaved ? 'text-pos' : 'text-muted'}`} aria-live="polite">
          {dirty ? 'Unsaved changes' : justSaved ? 'Stored in your database' : 'Up to date'}
        </span>
      </div>
    </section>
  );
}
