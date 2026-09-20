'use client';

import { useMemo, useState } from 'react';
import type { Lie } from '@/lib/sg/baseline-scratch';
import type { PenaltyType } from '@/lib/sg/compute';
import { yardsToFeet } from '@/lib/units';

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
};

function displayDistance(lie: Lie, yards: number): number {
  const v = lie === 'GREEN' ? yardsToFeet(yards) : yards;
  return Math.round(v * 10) / 10;
}

function unitFor(lie: Lie | null): string {
  return lie === 'GREEN' ? 'ft' : 'y';
}

export function RoundEntry({
  roundId,
  courseName,
  teeName,
  playedOn,
  holes,
  initialShotsByHole,
  initialHoleNo,
}: {
  roundId: number;
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

  const [selectedLie, setSelectedLie] = useState<Lie | null>(null);
  const [distance, setDistance] = useState('');
  const [penaltyOn, setPenaltyOn] = useState(false);
  const [penaltyType, setPenaltyType] = useState<PenaltyType>(null);
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

  function resetForm() {
    setSelectedLie(null);
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
    setError(null);
  }

  async function saveShot(opts: { holed: boolean }) {
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
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Failed to save shot');
        return;
      }
      setShotsByHole((prev) => ({ ...prev, [currentHoleNo]: data.shots }));
      resetForm();
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
      resetForm();
    } finally {
      setBusy(false);
    }
  }

  const canSaveResult = selectedLie !== null && distance !== '' && Number(distance) >= 0;
  const isStrokeAndDistance = penaltyOn && penaltyType === 'STROKE_AND_DISTANCE';

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-semibold">
          {courseName} — {teeName}
        </h1>
        <p className="text-xs text-gray-500">
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
                resetForm();
              }}
              className={[
                'shrink-0 w-9 h-9 rounded text-sm font-medium border',
                h.holeNo === currentHoleNo ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300',
                done && h.holeNo !== currentHoleNo ? 'bg-green-100 border-green-400' : '',
                started && !done && h.holeNo !== currentHoleNo ? 'bg-yellow-50 border-yellow-400' : '',
              ].join(' ')}
            >
              {h.holeNo}
            </button>
          );
        })}
      </nav>

      <section className="border rounded p-3 space-y-3">
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
              </span>
              <button className="text-blue-600 underline text-xs" onClick={() => startEdit(s)} disabled={busy}>
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
            Editing shot {editingShotNo} — saving will replace it and clear any shots after it.{' '}
            <button className="underline" onClick={resetForm}>
              Cancel
            </button>
          </p>
        )}

        {holeDone && editingShotNo === null ? (
          <p className="text-green-700 text-sm">Hole complete.</p>
        ) : start === null ? (
          <p className="text-red-600 text-sm">Can&apos;t enter this shot — the previous shot hasn&apos;t been saved.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
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
                <div className="grid grid-cols-3 gap-2">
                  {LIES.map((lie) => (
                    <button
                      key={lie}
                      type="button"
                      onClick={() => setSelectedLie(lie)}
                      className={[
                        'border rounded py-3 text-sm font-medium',
                        selectedLie === lie ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300',
                      ].join(' ')}
                    >
                      {lie}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void saveShot({ holed: true })}
                    disabled={busy}
                    className="col-span-3 border rounded py-3 text-sm font-semibold bg-green-600 text-white border-green-600 disabled:opacity-50"
                  >
                    Holed
                  </button>
                </div>

                {selectedLie === 'RECOVERY' && (
                  <p className="text-xs text-gray-500 italic">{RECOVERY_DEFINITION}</p>
                )}

                {selectedLie && (
                  <label className="flex flex-col gap-1 text-sm">
                    Distance ({unitFor(selectedLie)})
                    <input
                      type="number"
                      inputMode="numeric"
                      className="border rounded px-3 py-2 text-base"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                    />
                  </label>
                )}
              </>
            )}

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="button"
              disabled={busy || (!isStrokeAndDistance && !canSaveResult)}
              onClick={() => void saveShot({ holed: false })}
              className="w-full bg-blue-600 text-white rounded py-3 text-base font-medium disabled:opacity-50"
            >
              Save shot
            </button>

            {holeShots.length > 0 && editingShotNo === null && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void deleteFrom(holeShots[holeShots.length - 1]!.shotNo)}
                className="w-full text-red-600 text-sm underline"
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
