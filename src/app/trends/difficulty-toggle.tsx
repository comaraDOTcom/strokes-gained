'use client';

/**
 * Cross-course difficulty adjustment — BUILD.md Phase 5 "Cross-course
 * caveat". OFF by default: raw SG is what every other page shows, and the
 * baseline is explicitly length-only (it understates Portmarnock, a hard
 * links course, by several shots per the header of baseline-scratch.ts).
 * This toggle is the one place the adjusted numbers are shown, and only
 * when the viewer opts in.
 */
import { useState } from 'react';
import { fmtSg } from '@/lib/insights/chart-colors';

export type AdjustableRound = {
  roundId: number;
  playedOn: string;
  courseName: string;
  teeName: string;
  holesPlayed: number;
  sgTotal: number;
  perHoleAdjustment: number | null;
};

export function DifficultyToggle({ rounds }: { rounds: AdjustableRound[] }) {
  const [applied, setApplied] = useState(false);

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={applied} onChange={(e) => setApplied(e.target.checked)} />
        Apply cross-course difficulty adjustment (off by default)
      </label>
      <p className="text-xs text-gray-500">
        Adjustment = (course rating − Σ E(TEE, hole yardage)) / 18, added back per hole. Needs a course rating on
        file; rounds on a tee with none are shown unadjusted regardless of this toggle.
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 text-xs">
            <th className="py-1">Round</th>
            <th className="py-1">Course — tee</th>
            <th className="py-1">SG {applied ? '(adjusted)' : '(raw)'}</th>
          </tr>
        </thead>
        <tbody>
          {rounds.map((r) => {
            const canAdjust = applied && r.perHoleAdjustment !== null;
            const shown = canAdjust ? r.sgTotal + r.perHoleAdjustment! * r.holesPlayed : r.sgTotal;
            return (
              <tr key={r.roundId} className="border-t">
                <td className="py-1">{r.playedOn}</td>
                <td className="py-1">
                  {r.courseName} — {r.teeName}
                  {applied && r.perHoleAdjustment === null && (
                    <span className="text-amber-600 text-xs block">no course rating on file — shown unadjusted</span>
                  )}
                </td>
                <td className={`py-1 font-medium ${shown >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmtSg(shown)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
