'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type TeeOption = { id: number; courseId: number; name: string };
type CourseOption = { id: number; name: string };

export function NewRoundForm({
  courses,
  tees,
  defaultDetailedEntry,
  initialCourseId,
}: {
  /** From `/rounds/new?course=<id>` (the Courses page's "Log a round here"). */
  initialCourseId: number | null;
  courses: CourseOption[];
  tees: TeeOption[];
  /** The player's choice on their most recent round, so they don't have to re-tick it. */
  defaultDetailedEntry: boolean;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState<number | ''>(initialCourseId ?? courses[0]?.id ?? '');
  const [teeId, setTeeId] = useState<number | ''>('');
  const [playedOn, setPlayedOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [name, setName] = useState('');
  const [detailedEntry, setDetailedEntry] = useState(defaultDetailedEntry);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const teesForCourse = useMemo(() => tees.filter((t) => t.courseId === courseId), [tees, courseId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!courseId || !teeId) {
      setError('Pick a course and tee.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/rounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, teeId, playedOn, name, detailedEntry }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to start round');
        return;
      }
      router.push(`/rounds/${data.roundId}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-sm">
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">
          Round name <span className="text-muted font-normal">(optional)</span>
        </span>
        <input
          type="text"
          className="border rounded px-3 py-2 text-base"
          placeholder="e.g. St Georges Cup Rd 1"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Course</span>
        <select
          className="border rounded px-3 py-2 text-base"
          value={courseId}
          onChange={(e) => {
            setCourseId(Number(e.target.value));
            setTeeId('');
          }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Tee</span>
        <select
          className="border rounded px-3 py-2 text-base"
          value={teeId}
          onChange={(e) => setTeeId(Number(e.target.value))}
        >
          <option value="">Choose a tee…</option>
          {teesForCourse.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">Date</span>
        <input
          type="date"
          className="border rounded px-3 py-2 text-base"
          value={playedOn}
          onChange={(e) => setPlayedOn(e.target.value)}
        />
      </label>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">How much do you want to log?</legend>
        <div className="grid grid-cols-2 gap-2" role="radiogroup">
          {[
            {
              value: false,
              title: 'Brief',
              text: 'Lie and distance per shot. The extra tags stay one tap away.',
            },
            {
              value: true,
              title: 'Detailed',
              text: "Also asks focus and commitment, where each shot missed, and each putt's slope, break and miss.",
            },
          ].map((o) => (
            <button
              key={o.title}
              type="button"
              role="radio"
              aria-checked={detailedEntry === o.value}
              aria-label={`${o.title}: ${o.text}`}
              onClick={() => setDetailedEntry(o.value)}
              className={[
                'rounded-lg border px-3 py-3 text-left',
                detailedEntry === o.value ? 'bg-accent-soft border-accent' : 'bg-card border-line-strong',
              ].join(' ')}
            >
              <span className="block text-sm font-medium">{o.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{o.text}</span>
            </button>
          ))}
        </div>
      </fieldset>

      {error && <p className="text-neg text-sm">{error}</p>}

      <button
        type="submit"
        disabled={busy}
        className="w-full bg-ink text-paper rounded py-3 text-base font-medium disabled:opacity-50"
      >
        Start round
      </button>
    </form>
  );
}
