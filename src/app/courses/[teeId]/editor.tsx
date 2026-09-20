'use client';

import { useState } from 'react';

export type HoleRow = { holeNo: number; par: number; strokeIndex: number | null; yards: number };

export function CourseHoleEditor({
  teeId,
  expectedTotalYards,
  expectedPar,
  initialHoles,
}: {
  teeId: number;
  expectedTotalYards: number | null;
  expectedPar: number | null;
  initialHoles: HoleRow[];
}) {
  const [holes, setHoles] = useState<HoleRow[]>(initialHoles);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[] | null>(null);

  function updateHole(holeNo: number, patch: Partial<HoleRow>) {
    setHoles((prev) => prev.map((h) => (h.holeNo === holeNo ? { ...h, ...patch } : h)));
  }

  const front = holes.filter((h) => h.holeNo <= 9);
  const back = holes.filter((h) => h.holeNo > 9);
  const sum = (rows: HoleRow[], key: 'yards' | 'par') => rows.reduce((s, h) => s + h[key], 0);

  const outYards = sum(front, 'yards');
  const inYards = sum(back, 'yards');
  const totalYards = outYards + inYards;
  const outPar = sum(front, 'par');
  const inPar = sum(back, 'par');
  const totalPar = outPar + inPar;

  const yardsMismatch = expectedTotalYards != null && totalYards !== expectedTotalYards;
  const parMismatch = expectedPar != null && totalPar !== expectedPar;

  async function onSave() {
    setSaving(true);
    setMessage(null);
    setErrors(null);
    try {
      const res = await fetch(`/api/tees/${teeId}/holes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ holes }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrors(
          Array.isArray(data.errors)
            ? data.errors.map((e: { message: string }) => e.message)
            : [data.error ?? 'Save failed'],
        );
        return;
      }
      setMessage('Saved.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <table className="text-sm border-collapse w-full">
        <thead>
          <tr>
            <th className="border px-2 py-1">Hole</th>
            <th className="border px-2 py-1">Par</th>
            <th className="border px-2 py-1">SI</th>
            <th className="border px-2 py-1">Yards</th>
          </tr>
        </thead>
        <tbody>
          {holes.map((h) => (
            <tr key={h.holeNo}>
              <td className="border px-2 py-1 text-center">{h.holeNo}</td>
              <td className="border px-1 py-1">
                <input
                  className="w-12 border px-1"
                  type="number"
                  value={h.par}
                  onChange={(e) => updateHole(h.holeNo, { par: Number(e.target.value) })}
                />
              </td>
              <td className="border px-1 py-1">
                <input
                  className="w-12 border px-1"
                  type="number"
                  value={h.strokeIndex ?? ''}
                  onChange={(e) =>
                    updateHole(h.holeNo, { strokeIndex: e.target.value === '' ? null : Number(e.target.value) })
                  }
                />
              </td>
              <td className="border px-1 py-1">
                <input
                  className="w-20 border px-1"
                  type="number"
                  value={h.yards}
                  onChange={(e) => updateHole(h.holeNo, { yards: Number(e.target.value) })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="text-sm space-y-1">
        <p>
          Out: {outYards}y / par {outPar} — In: {inYards}y / par {inPar} — Total:{' '}
          <strong className={yardsMismatch || parMismatch ? 'text-red-600' : ''}>
            {totalYards}y / par {totalPar}
          </strong>
        </p>
        {expectedTotalYards != null && (
          <p className={yardsMismatch || parMismatch ? 'text-red-600' : 'text-green-700'}>
            Card total: {expectedTotalYards}y / par {expectedPar}.{' '}
            {yardsMismatch || parMismatch ? 'Does not match — check for a typo above.' : 'Matches.'}
          </p>
        )}
      </div>

      {errors && (
        <ul className="list-disc pl-5 text-sm text-red-700">
          {errors.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      )}
      {message && <p className="text-green-700 text-sm">{message}</p>}

      <button
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={saving}
        onClick={onSave}
      >
        Save
      </button>
    </div>
  );
}
