/**
 * Validation for the "log a session" form on `/practice` (issue #55). Pure, so the rules are
 * unit-tested without a database; `sessions.ts` stores what passes.
 */
import { drillById } from './drills';

export type SessionEntry = { practisedOn: string; drillId: string; score: number };
export type ParsedSessionEntry = ({ ok: true } & SessionEntry) | { ok: false; error: string };

/** The earliest date a session can carry: anything older is a typo. */
export const EARLIEST_PRACTICE_DATE = '2000-01-01';

function isRealDate(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

/** Validate `{ practisedOn, drillId, score }`. `today` is the player's date (YYYY-MM-DD). */
export function parseSessionEntry(body: unknown, today: string): ParsedSessionEntry {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return { ok: false, error: 'Body must be a JSON object' };
  const { practisedOn, drillId, score } = body as Record<string, unknown>;
  const drill = typeof drillId === 'string' ? drillById(drillId) : undefined;
  if (!drill) return { ok: false, error: 'Pick a drill from the list.' };
  if (typeof practisedOn !== 'string' || !isRealDate(practisedOn)) return { ok: false, error: 'Give the date as YYYY-MM-DD.' };
  if (practisedOn > today) return { ok: false, error: "That date hasn't happened yet." };
  if (practisedOn < EARLIEST_PRACTICE_DATE) return { ok: false, error: 'That date is too far back.' };
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > drill.outOf) {
    return { ok: false, error: `Score must be a whole number from 0 to ${drill.outOf}.` };
  }
  return { ok: true, practisedOn, drillId: drill.id, score };
}
