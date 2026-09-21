/**
 * Round "details" — the human layer on top of the shots: a name, free-text
 * commentary, and self-rated mentality. None of this feeds strokes gained; it
 * exists so a round can be read back later ("Medal Final 2026 — felt rushed
 * from the 6th") and, once there are enough rounds, lined up against SG.
 *
 * Validation lives here rather than in a DB CHECK constraint to stay
 * Postgres-portable (see the header of `src/db/schema.ts`).
 */

export const MAX_NAME_LENGTH = 80;
/** Generous on purpose — a transcribed voice note of a whole round is long. */
export const MAX_NOTES_LENGTH = 50_000;

/**
 * Pia Nilsson's balance / tempo / tension, rated for the round overall. Every
 * scale reads "higher is better" — for tension, 5 means relaxed. (Per-shot
 * focus and commitment tags live in `entry.ts`.)
 */
export const MENTAL_FIELDS = ['mentalBalance', 'mentalTempo', 'mentalTension'] as const;
export type MentalField = (typeof MENTAL_FIELDS)[number];

export type RoundDetails = {
  name: string | null;
  notes: string | null;
  mentalBalance: number | null;
  mentalTempo: number | null;
  mentalTension: number | null;
};

/** Everything a round PATCH may change: the human layer plus the date played. */
export type RoundPatch = Partial<RoundDetails> & { playedOn?: string; trackMentality?: boolean };

export type ParseResult =
  | { ok: true; patch: RoundPatch }
  | { ok: false; error: string };

/**
 * Parse a partial update. Only keys present in `body` end up in the patch, so a
 * PATCH that sends just `{ notes }` can't null out the ratings. Empty/blank
 * strings become `null` ("cleared"); ratings must be an integer 1–5 or `null`.
 */
export function parseRoundDetailsPatch(body: unknown): ParseResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, error: 'Body must be a JSON object' };
  }
  const input = body as Record<string, unknown>;
  const patch: RoundPatch = {};

  if ('playedOn' in input) {
    const v = input.playedOn;
    if (typeof v !== 'string' || !isRealIsoDate(v)) {
      return { ok: false, error: 'playedOn must be a real date in YYYY-MM-DD form' };
    }
    patch.playedOn = v;
  }

  if ('trackMentality' in input) {
    if (typeof input.trackMentality !== 'boolean') {
      return { ok: false, error: 'trackMentality must be true or false' };
    }
    patch.trackMentality = input.trackMentality;
  }

  for (const key of ['name', 'notes'] as const) {
    if (!(key in input)) continue;
    const v = input[key];
    if (v === null) {
      patch[key] = null;
      continue;
    }
    if (typeof v !== 'string') return { ok: false, error: `${key} must be a string or null` };
    const max = key === 'name' ? MAX_NAME_LENGTH : MAX_NOTES_LENGTH;
    // Name is a single-line label, so trim it; commentary keeps its own
    // whitespace/paragraphs and is only blanked if it's nothing but whitespace.
    const cleaned = key === 'name' ? v.trim() : v.trim() === '' ? '' : v;
    if (cleaned.length > max) return { ok: false, error: `${key} must be at most ${max} characters` };
    patch[key] = cleaned === '' ? null : cleaned;
  }

  for (const key of MENTAL_FIELDS) {
    if (!(key in input)) continue;
    const v = input[key];
    if (v === null) {
      patch[key] = null;
      continue;
    }
    if (typeof v !== 'number' || !Number.isInteger(v) || v < 1 || v > 5) {
      return { ok: false, error: `${key} must be a whole number from 1 to 5, or null` };
    }
    patch[key] = v;
  }

  return { ok: true, patch };
}

/** YYYY-MM-DD that is also a real calendar date (rejects 2026-02-30). */
export function isRealIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/** What to call a round in lists/headers: its name, else "Course — Tee". */
export function roundTitle(round: { name: string | null }, fallback: string): string {
  return round.name ?? fallback;
}
