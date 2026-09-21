'use client';

import { useMemo, useState } from 'react';
import type { Lie } from '@/lib/sg/baseline-scratch';
import type { PenaltyType } from '@/lib/sg/compute';
import { yardsToFeet } from '@/lib/units';
import { defaultResultLie, describeEntry, type Commitment, type Focus } from '@/lib/rounds/entry';

const LIES: Lie[] = ['TEE', 'FAIRWAY', 'ROUGH', 'SAND', 'RECOVERY', 'GREEN'];

const RECOVERY_DEFINITION =
  'no realistic shot at the green — must play sideways, out or lay up';

export type HoleMeta = { holeNo: number; par: number; strokeIndex: number | null; yards: number };

export type ShotRow = {
  id: number;
  holeNo: number;
  shotNo: number;
  startLie: string;
  startYards: number;
  endLie: string | null;
  endYards: number;
  holed: boolean;
  penaltyStrokes: number;
  penaltyType: string | null;
  sg: number | null;
  category: string | null;
  bunkerSubtype: string | null;
  focus: string | null;
  commitment: string | null;
};

function displayDistance(lie: Lie, yards: number): number {
  const v = lie === 'GREEN' ? yardsToFeet(yards) : yards;
  return Math.round(v * 10) / 10;
}

function unitFor(lie: Lie | null): string {
  return lie === 'GREEN' ? 'ft' : 'y';
}

/** Optional two-way tag. Tap the selected option again to clear it. */
function TagRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; text: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={`${label} (optional)`}>
      <span className="w-14 shrink-0 font-mono text-xs uppercase tracking-wide text-muted">{label}</span>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? null : o.value)}
            className={`flex-1 rounded-lg border px-2 py-1.5 text-sm ${
              on ? 'bg-accent-soft border-accent text-ink font-medium' : 'bg-paper border-line-strong text-ink-2'
            }`}
          >
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

export function RoundEntry({
  roundId,
  roundName,
  trackMentality,
  courseName,
  teeName,
  playedOn,
  holes,
  initialShotsByHole,
  initialHoleNo,
}: {
  roundId: number;
  roundName: string | null;
  /** Round setting: show the per-shot mentality tags open by default? */
  trackMentality: boolean;
  courseName: string;
  teeName: string;
  playedOn: string;
  holes: HoleMeta[];
  initialShotsByHole: Record<number, ShotRow[]>;
  initialHoleNo: number;
}) {
  const [currentHoleNo, setCurrentHoleNo] = useState(initialHoleNo);
  const [shotsByHole, setShotsByHole] = useState<Record<number, ShotRow[]>>(initialShotsByHole);
  const [editingShotNo, setEditingShotNo] = useState<number | null>(null);

  const [selectedLie, setSelectedLie] = useState<Lie | null>(() =>
    defaultResultLie(initialShotsByHole[initialHoleNo] ?? []),
  );
  const [distance, setDistance] = useState('');
  const [penaltyOn, setPenaltyOn] = useState(false);
  const [penaltyType, setPenaltyType] = useState<PenaltyType>(null);
  // Optional per-shot mentality tags. Reset after every shot: they describe *that* shot.
  const [focus, setFocus] = useState<Focus | null>(null);
  const [commitment, setCommitment] = useState<Commitment | null>(null);
  // Collapsed-but-expandable when the round wasn't set up to track mentality.
  const [tagsOpen, setTagsOpen] = useState(trackMentality);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hole = holes.find((h) => h.holeNo === currentHoleNo)!;
  const holeShots = shotsByHole[currentHoleNo] ?? [];
  const holeDone = holeShots.some((s) => s.holed);

  const nextShotNo = editingShotNo ?? holeShots.length + 1;

  const start = useMemo(() => {
    if (nextShotNo === 1) return { lie: 'TEE' as Lie, yards: hole.yards };
    const prev = holeShots.find((s) => s.shotNo === nextShotNo - 1);
    if (!prev || prev.endLie === null) return null;
    return { lie: prev.endLie as Lie, yards: prev.endYards };
  }, [nextShotNo, holeShots, hole.yards]);

  const roundTotals = useMemo(() => {
    let shotsCount = 0;
    let penalties = 0;
    let sg = 0;
    for (const list of Object.values(shotsByHole)) {
      shotsCount += list.length;
      for (const s of list) {
        penalties += s.penaltyStrokes;
        sg += s.sg ?? 0;
      }
    }
    return { grossScore: shotsCount + penalties, sg };
  }, [shotsByHole]);

  const holeTotals = useMemo(() => {
    const penalties = holeShots.reduce((sum, s) => sum + s.penaltyStrokes, 0);
    const sg = holeShots.reduce((sum, s) => sum + (s.sg ?? 0), 0);
    return { grossScore: holeShots.length + penalties, sg };
  }, [holeShots]);

  /** `holeShots` = the shots now on the hole the form will point at, so the result
   * lie can default to GREEN after a shot that finished on the green. */
  function resetForm(holeShots: readonly ShotRow[]) {
    setSelectedLie(defaultResultLie(holeShots));
    setFocus(null);
    setCommitment(null);
    setDistance('');
    setPenaltyOn(false);
    setPenaltyType(null);
    setEditingShotNo(null);
    setError(null);
  }

  function startEdit(shot: ShotRow) {
    setEditingShotNo(shot.shotNo);
    setSelectedLie(shot.holed ? null : (shot.endLie as Lie | null));
    setDistance(shot.holed || !shot.endLie ? '' : String(displayDistance(shot.endLie as Lie, shot.endYards)));
    setPenaltyOn(shot.penaltyStrokes > 0);
    setPenaltyType(shot.penaltyType as PenaltyType);
    setFocus(shot.focus as Focus | null);
    setCommitment(shot.commitment as Commitment | null);
    if (shot.focus || shot.commitment) setTagsOpen(true); // never hide a value that's set
    setError(null);
  }

  async function saveShot(opts: { holed: boolean }) {
    const laterShots = editingShotNo !== null ? holeShots.filter((s) => s.shotNo > editingShotNo).length : 0;
    if (opts.holed && laterShots > 0 && !window.confirm(`Marking this shot holed removes the ${laterShots} shot${laterShots === 1 ? '' : 's'} after it. Continue?`)) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/shots`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          holeNo: currentHoleNo,
          shotNo: nextShotNo,
          endLie: opts.holed ? null : selectedLie,
          endDistance: opts.holed ? 0 : Number(distance || 0),
          holed: opts.holed,
          penaltyStrokes: penaltyOn ? 1 : 0,
          penaltyType: penaltyOn ? penaltyType : null,
          focus,
          commitment,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save shot');
        return;
      }
      setShotsByHole((prev) => ({ ...prev, [currentHoleNo]: data.shots }));
      resetForm(data.shots);
      if (opts.holed && currentHoleNo < 18) {
        setCurrentHoleNo(currentHoleNo + 1);
      }
    } finally {
      setBusy(false);
    }
  }

  async function deleteFrom(shotNo: number) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/rounds/${roundId}/shots`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holeNo: currentHoleNo, shotNo }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to delete shot');
        return;
      }
      setShotsByHole((prev) => ({ ...prev, [currentHoleNo]: data.shots }));
      resetForm(data.shots);
    } finally {
      setBusy(false);
    }
  }

  // Live read-back of what the typed distance implies (catches "typed how far I hit it").
  const entryNote =
    start && selectedLie && distance !== '' ? describeEntry(start, selectedLie, Number(distance)) : null;

  const canSaveResult = selectedLie !== null && distance !== '' && Number(distance) >= 0;
  const isStrokeAndDistance = penaltyOn && penaltyType === 'STROKE_AND_DISTANCE';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">{roundName ?? `${courseName} — ${teeName}`}</h1>
        <p className="text-xs text-muted font-mono">
          {roundName ? `${courseName} — ${teeName} · ` : ''}
          {playedOn} · Round score so far: {roundTotals.grossScore} · SG {roundTotals.sg.toFixed(2)}
        </p>
      </header>

      <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Holes">
        {holes.map((h) => {
          const done = (shotsByHole[h.holeNo] ?? []).some((s) => s.holed);
          const started = (shotsByHole[h.holeNo] ?? []).length > 0;
          return (
            <button
              key={h.holeNo}
              onClick={() => {
                setCurrentHoleNo(h.holeNo);
                resetForm(shotsByHole[h.holeNo] ?? []);
              }}
              className={[
                'shrink-0 w-9 h-9 rounded text-sm font-medium border',
                h.holeNo === currentHoleNo ? 'border-ink bg-ink text-white' : 'border-line-strong',
                done && h.holeNo !== currentHoleNo ? 'bg-pos-soft border-pos' : '',
                started && !done && h.holeNo !== currentHoleNo ? 'bg-yellow-50 border-yellow-400' : '',
              ].join(' ')}
            >
              {h.holeNo}
            </button>
          );
        })}
      </nav>

      <section className="border rounded-xl bg-card p-3 space-y-3">
        <h2 className="font-semibold">
          Hole {hole.holeNo} · Par {hole.par} · {hole.yards}y
          {hole.strokeIndex !== null ? ` · SI ${hole.strokeIndex}` : ''}
        </h2>

        <ul className="text-sm space-y-1">
          {holeShots.map((s) => (
            <li key={s.shotNo} className="flex justify-between items-center gap-2">
              <span>
                Shot {s.shotNo}: {s.startLie} {displayDistance(s.startLie as Lie, s.startYards)}
                {unitFor(s.startLie as Lie)} → {s.holed ? 'HOLED' : `${s.endLie} ${displayDistance(s.endLie as Lie, s.endYards)}${unitFor(s.endLie as Lie)}`}
                {s.penaltyStrokes > 0 ? ` (+${s.penaltyStrokes} penalty)` : ''}
                {' · SG '}
                {(s.sg ?? 0).toFixed(2)}
                {(s.focus || s.commitment) && (
                  <span className="font-mono text-xs text-muted">
                    {' · '}
                    {[s.focus && s.focus.toLowerCase(), s.commitment && s.commitment.toLowerCase()].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <button className="text-accent underline text-xs" onClick={() => startEdit(s)} disabled={busy}>
                Edit
              </button>
            </li>
          ))}
        </ul>

        <p className="text-sm font-medium">
          Derived score so far: {holeTotals.grossScore} (par {hole.par}) · Hole SG {holeTotals.sg.toFixed(2)}
        </p>

        {editingShotNo !== null && (
          <p className="text-xs text-amber-700">
            Editing shot {editingShotNo} — later shots keep their results; their starting positions follow this one. (Marking it Holed removes the shots after it.){' '}
            <button className="underline" onClick={() => resetForm(holeShots)}>
              Cancel
            </button>
          </p>
        )}

        {holeDone && editingShotNo === null ? (
          <p className="text-pos text-sm">Hole complete.</p>
        ) : start === null ? (
          <p className="text-neg text-sm">Can&apos;t enter this shot — the previous shot hasn&apos;t been saved.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-ink-2">
              Shot {nextShotNo} from {start.lie} {displayDistance(start.lie, start.yards)}
              {unitFor(start.lie)}
            </p>

            <fieldset className="space-y-1">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={penaltyOn}
                  onChange={(e) => {
                    setPenaltyOn(e.target.checked);
                    if (!e.target.checked) setPenaltyType(null);
                  }}
                />
                Penalty on this shot
              </label>
              {penaltyOn && (
                <div className="flex gap-4 text-sm pl-1">
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="penaltyType"
                      checked={penaltyType === 'LATERAL'}
                      onChange={() => setPenaltyType('LATERAL')}
                    />
                    Lateral (enter drop position below)
                  </label>
                  <label className="flex items-center gap-1">
                    <input
                      type="radio"
                      name="penaltyType"
                      checked={penaltyType === 'STROKE_AND_DISTANCE'}
                      onChange={() => setPenaltyType('STROKE_AND_DISTANCE')}
                    />
                    Stroke &amp; distance (replay from {start.lie} {displayDistance(start.lie, start.yards)}
                    {unitFor(start.lie)})
                  </label>
                </div>
              )}
            </fieldset>

            {!isStrokeAndDistance && (
              <>
                {!tagsOpen ? (
                  <button
                    type="button"
                    onClick={() => setTagsOpen(true)}
                    aria-expanded={false}
                    className="text-xs text-muted underline underline-offset-2"
                  >
                    + Mentality (focus, commitment)
                  </button>
                ) : (
                <div className="space-y-1.5">
                  <TagRow
                    label="Focus"
                    options={[
                      { value: 'INTERNAL', text: 'Internal' },
                      { value: 'EXTERNAL', text: 'External' },
                    ]}
                    value={focus}
                    onChange={setFocus}
                  />
                  <TagRow
                    label="Commit"
                    options={[
                      { value: 'COMMITTED', text: 'Committed' },
                      { value: 'HESITANT', text: 'Hesitant' },
                    ]}
                    value={commitment}
                    onChange={setCommitment}
                  />
                  {!trackMentality && (
                    <button
                      type="button"
                      onClick={() => {
                        setTagsOpen(false);
                        setFocus(null);
                        setCommitment(null);
                      }}
                      className="text-xs text-muted underline underline-offset-2"
                    >
                      Hide mentality
                    </button>
                  )}
                </div>
                )}

                <div className="grid grid-cols-3 gap-2">
                  {LIES.map((lie) => (
                    <button
                      key={lie}
                      type="button"
                      onClick={() => setSelectedLie(lie)}
                      className={[
                        'border rounded py-3 text-sm font-medium',
                        selectedLie === lie ? 'bg-ink text-white border-ink' : 'border-line-strong',
                      ].join(' ')}
                    >
                      {lie}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void saveShot({ holed: true })}
                    disabled={busy}
                    className="col-span-3 border rounded py-3 text-sm font-semibold bg-pos text-white border-pos disabled:opacity-50"
                  >
                    Holed
                  </button>
                </div>

                {/* Always visible, not only once RECOVERY is picked: consistency of this
                    label over time matters more than any other input (BUILD.md Phase 3). */}
                <p className={`text-xs italic ${selectedLie === 'RECOVERY' ? 'text-ink' : 'text-muted'}`}>
                  <span className="font-semibold not-italic">RECOVERY</span> = {RECOVERY_DEFINITION}
                </p>

                {selectedLie && (
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">
                      {selectedLie === 'GREEN' ? 'Length of the putt you have left (ft)' : 'Distance LEFT to the hole (y)'}
                    </span>
                    <span className="text-xs text-muted">
                      {selectedLie === 'GREEN'
                        ? 'How far from the hole the ball finished, in feet.'
                        : start.lie === 'TEE' && start.yards >= 330
                          ? `Where the ball finished — not how far you hit it. A 290y drive on this ${Math.round(start.yards)}y hole leaves ${Math.round(start.yards) - 290}.`
                          : 'Where the ball finished — not how far you hit it.'}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder={selectedLie === 'GREEN' ? 'e.g. 15' : 'what you had left, e.g. 100'}
                      className="border rounded px-3 py-2 text-base placeholder:text-faint"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                    />
                    {entryNote && (
                      <span className={`text-xs ${entryNote.kind === 'warning' ? 'text-neg font-medium' : 'text-muted font-mono'}`}>
                        {entryNote.kind === 'travelled' ? `→ ${entryNote.text}` : entryNote.text}
                      </span>
                    )}
                  </label>
                )}
              </>
            )}

            {error && <p className="text-neg text-sm">{error}</p>}

            <button
              type="button"
              disabled={busy || (!isStrokeAndDistance && !canSaveResult)}
              onClick={() => void saveShot({ holed: false })}
              className="w-full bg-ink text-white rounded py-3 text-base font-medium disabled:opacity-50"
            >
              Save shot
            </button>

            {holeShots.length > 0 && editingShotNo === null && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteFrom(holeShots[holeShots.length - 1]!.shotNo)}
                className="w-full text-neg text-sm underline"
              >
                Undo last shot
              </button>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
