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

export const MENTAL_FIELDS = ['mentalConfidence', 'mentalFocus', 'mentalComposure'] as const;
export type MentalField = (typeof MENTAL_FIELDS)[number];

export type RoundDetails = {
  name: string | null;
  notes: string | null;
  mentalConfidence: number | null;
  mentalFocus: number | null;
  mentalComposure: number | null;
};

export type ParseResult =
  | { ok: true; patch: Partial<RoundDetails> }
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
  const patch: Partial<RoundDetails> = {};

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

/** What to call a round in lists/headers: its name, else "Course — Tee". */
export function roundTitle(round: { name: string | null }, fallback: string): string {
  return round.name ?? fallback;
}
