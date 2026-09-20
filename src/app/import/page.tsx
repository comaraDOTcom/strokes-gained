'use client';

import { useMemo, useState } from 'react';
import type { ParsedHole } from '@/lib/import/parse-course-sheet';
import type { TeeMeta } from '@/lib/import/validate-parsed-sheet';

type RowError = { row: number; message: string };

type ParseResponse = {
  layout: 'wide' | 'long';
  teeNames: string[];
  holes: ParsedHole[];
  errors: RowError[];
  preview: { headers: string[]; rows: unknown[][] };
};

type ChecksumError = { courseName: string; teeName: string; kind: string; message: string };

type TeeForm = Omit<TeeMeta, 'gender' | 'distanceUnit'> & {
  gender: TeeMeta['gender'];
  distanceUnit: TeeMeta['distanceUnit'];
};

export default function ImportPage() {
  const [parsed, setParsed] = useState<ParseResponse | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [courseName, setCourseName] = useState('');
  const [location, setLocation] = useState('');
  const [teeForms, setTeeForms] = useState<TeeForm[]>([]);
  const [commitErrors, setCommitErrors] = useState<ChecksumError[] | string | null>(null);
  const [committedCourseId, setCommittedCourseId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const totalYardsByTee = useMemo(() => {
    const totals = new Map<string, number>();
    for (const name of parsed?.teeNames ?? []) {
      const total = (parsed?.holes ?? []).reduce((sum, h) => sum + (h.yards[name] ?? 0), 0);
      totals.set(name, total);
    }
    return totals;
  }, [parsed]);

  const totalPar = useMemo(
    () => (parsed?.holes ?? []).reduce((sum, h) => sum + h.par, 0),
    [parsed],
  );

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setParseError(null);
    setCommitErrors(null);
    setCommittedCourseId(null);
    try {
      const formData = new FormData();
      formData.set('file', file);
      const res = await fetch('/api/import/parse', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setParseError(data.error ?? 'Failed to parse file');
        setParsed(null);
        return;
      }
      const result = data as ParseResponse;
      setParsed(result);
      setTeeForms(
        result.teeNames.map((name) => ({
          name,
          gender: 'M',
          distanceUnit: 'yards',
          courseRating: null,
          slopeRating: null,
          expectedTotalYards: result.holes.reduce((sum, h) => sum + (h.yards[name] ?? 0), 0),
          expectedPar: result.holes.reduce((sum, h) => sum + h.par, 0),
        })),
      );
    } finally {
      setBusy(false);
    }
  }

  function updateTeeForm(index: number, patch: Partial<TeeForm>) {
    setTeeForms((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  async function onImport() {
    if (!parsed) return;
    setBusy(true);
    setCommitErrors(null);
    try {
      const res = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName,
          location,
          holes: parsed.holes,
          teeMeta: teeForms,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommitErrors(data.errors ?? data.error ?? 'Import failed');
        return;
      }
      setCommittedCourseId(data.courseId);
    } finally {
      setBusy(false);
    }
  }

  const hasBlockingErrors = (parsed?.errors.length ?? 0) > 0;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Import a course</h1>
      <p className="text-sm text-ink-2">
        Upload a .xlsx or .csv course card. Both layouts are supported: one column per tee
        (<code>hole | white tees | greens tees | par</code>), or one row per hole/tee pair
        (<code>hole | tee | yards | par | stroke index</code>).
      </p>

      <div>
        <input type="file" accept=".xlsx,.csv" onChange={onFileChange} disabled={busy} />
      </div>

      {parseError && <p className="text-neg">{parseError}</p>}

      {parsed && (
        <section className="space-y-4">
          <p>
            Detected layout: <strong>{parsed.layout}</strong>. Tees found:{' '}
            <strong>{parsed.teeNames.join(', ') || '(none)'}</strong>. Holes parsed:{' '}
            <strong>{parsed.holes.length}</strong>.
          </p>

          {parsed.errors.length > 0 && (
            <div className="border border-neg bg-neg-soft p-3 rounded">
              <p className="font-semibold text-neg">
                {parsed.errors.length} problem(s) found — fix the sheet and re-upload:
              </p>
              <ul className="list-disc pl-5 text-sm text-neg">
                {parsed.errors.map((e, i) => (
                  <li key={i}>
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="text-sm border-collapse">
              <thead>
                <tr>
                  {parsed.preview.headers.map((h, i) => (
                    <th key={i} className="border px-2 py-1 text-left bg-paper-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsed.preview.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j} className="border px-2 py-1">
                        {String(cell)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="flex gap-3">
              <label className="flex flex-col text-sm">
                Course name
                <input
                  className="border px-2 py-1"
                  value={courseName}
                  onChange={(e) => setCourseName(e.target.value)}
                />
              </label>
              <label className="flex flex-col text-sm">
                Location
                <input
                  className="border px-2 py-1"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </label>
            </div>

            <p className="text-sm text-ink-2">
              Confirm each tee&apos;s totals against the physical card — this is the checksum
              the import is rejected on if it doesn&apos;t match the holes above (parsed total par:{' '}
              {totalPar}).
            </p>

            {teeForms.map((tee, i) => (
              <fieldset key={tee.name} className="border p-3 rounded space-y-2">
                <legend className="font-semibold">{tee.name}</legend>
                <div className="flex gap-3 flex-wrap text-sm">
                  <label className="flex flex-col">
                    Gender
                    <select
                      className="border px-2 py-1"
                      value={tee.gender}
                      onChange={(e) => updateTeeForm(i, { gender: e.target.value as TeeMeta['gender'] })}
                    >
                      <option value="M">M</option>
                      <option value="F">F</option>
                    </select>
                  </label>
                  <label className="flex flex-col">
                    Course rating
                    <input
                      className="border px-2 py-1 w-24"
                      type="number"
                      step="0.1"
                      value={tee.courseRating ?? ''}
                      onChange={(e) =>
                        updateTeeForm(i, { courseRating: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    Slope rating
                    <input
                      className="border px-2 py-1 w-24"
                      type="number"
                      value={tee.slopeRating ?? ''}
                      onChange={(e) =>
                        updateTeeForm(i, { slopeRating: e.target.value === '' ? null : Number(e.target.value) })
                      }
                    />
                  </label>
                  <label className="flex flex-col">
                    Expected total yards (from card)
                    <input
                      className="border px-2 py-1 w-28"
                      type="number"
                      value={tee.expectedTotalYards}
                      onChange={(e) => updateTeeForm(i, { expectedTotalYards: Number(e.target.value) })}
                    />
                  </label>
                  <label className="flex flex-col">
                    Expected par (from card)
                    <input
                      className="border px-2 py-1 w-20"
                      type="number"
                      value={tee.expectedPar}
                      onChange={(e) => updateTeeForm(i, { expectedPar: Number(e.target.value) })}
                    />
                  </label>
                </div>
                <p className="text-xs text-muted">
                  Parsed sum: {totalYardsByTee.get(tee.name) ?? 0} yards, par {totalPar}.
                </p>
              </fieldset>
            ))}

            <button
              className="bg-ink text-white px-4 py-2 rounded disabled:opacity-50"
              disabled={busy || hasBlockingErrors || !courseName.trim() || teeForms.length === 0}
              onClick={onImport}
            >
              Import
            </button>

            {commitErrors && (
              <div className="border border-neg bg-neg-soft p-3 rounded text-sm text-neg">
                {typeof commitErrors === 'string' ? (
                  <p>{commitErrors}</p>
                ) : (
                  <ul className="list-disc pl-5">
                    {commitErrors.map((e, i) => (
                      <li key={i}>
                        [{e.teeName}] {e.kind}: {e.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {committedCourseId !== null && (
              <p className="text-pos">
                Imported as course #{committedCourseId}. <a className="underline" href="/courses">Go to the course editor</a>.
              </p>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
