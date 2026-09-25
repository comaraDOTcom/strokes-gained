/**
 * Snap a transcript onto golf words.
 *
 * Phone and cloud recognisers don't know this is golf, so they pick the commoner English word
 * every time: "eight iron" becomes "eight hour", "two putts" becomes "two pots", "holed it"
 * becomes "hold it", "40 yards" becomes "40 hours". Every one of those is a near-homophone of a
 * word from a small closed vocabulary — which is exactly the case where matching the text back to
 * that vocabulary gives the biggest accuracy gain available, at no cost and with no model change.
 *
 * Deliberately conservative: only fix a word when the surrounding context makes the golf reading
 * near-certain. A wrong "fix" is worse than a wrong transcript, because it looks correct.
 *
 * NUMBERS ARE NEVER TOUCHED. They survive recognition well and are the one thing we must not
 * invent — the only change made to a number is writing a spoken one as digits.
 */

export type Fix = { from: string; to: string };
export type FixedTranscript = { text: string; fixes: Fix[] };

/** Clubs, so "eight hour" can only mean "eight iron". */
const CLUB_NUMBER_MAX = 14;

const SPOKEN_NUMBERS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

/**
 * Straight word swaps that are unambiguous in a golf sentence. Order matters: longer phrases first.
 * `/i` on every pattern; `\b` keeps them from eating the insides of other words.
 */
const PHRASE_FIXES: [RegExp, string][] = [
  [/\bt[- ]?shirts?\b/gi, 'tee shot'],
  [/\btee shirts?\b/gi, 'tee shot'],
  [/\bsandwich\b/gi, 'sand wedge'],
  [/\bsand which\b/gi, 'sand wedge'],
  [/\bpitching which\b/gi, 'pitching wedge'],
  [/\bhold (it|out)\b/gi, 'holed $1'],
  [/\bhole it\b/gi, 'holed it'],
  [/\bwhole\b/gi, 'hole'],
  [/\bputs\b/gi, 'putts'],
  [/\bpots\b/gi, 'putts'],
  [/\bpot\b/gi, 'putt'],
  [/\bthree putted\b/gi, 'three putts'],
  [/\bup and down\b/gi, 'up and down'],
  [/\bthe ruff\b/gi, 'the rough'],
  [/\brough grass\b/gi, 'rough'],
  [/\bfare way\b/gi, 'fairway'],
  [/\bbunk[ae]r\b/gi, 'bunker'],
  [/\bgimmie\b/gi, 'gimme'],
];

/** `40 hours` → `40 yards`, `eight hour` → `eight iron`: same misheard word, split by the number. */
function fixHours(text: string, fixes: Fix[]): string {
  return text.replace(/\b(\d{1,3}|[a-z]+)\s+hours?\b/gi, (whole, numRaw: string) => {
    const n = /^\d+$/.test(numRaw) ? Number(numRaw) : SPOKEN_NUMBERS[numRaw.toLowerCase()];
    if (n === undefined) return whole;
    const replacement = n <= CLUB_NUMBER_MAX ? `${numRaw} iron` : `${numRaw} yards`;
    fixes.push({ from: whole, to: replacement });
    return replacement;
  });
}

/**
 * `one foot` → `one putt`, but ONLY when it isn't a distance. "to six feet" and "inside a foot"
 * are real distances and must survive untouched.
 */
function fixFootPutt(text: string, fixes: Fix[]): string {
  return text.replace(/(\b(?:to|at|inside|within|from)\s+)?\b(one|two|three|four|1|2|3|4)\s+foot\b/gi, (whole, lead: string | undefined, numRaw: string) => {
    if (lead) return whole; // a distance, e.g. "to one foot"
    const replacement = `${numRaw} putt`;
    fixes.push({ from: whole.trim(), to: replacement });
    return replacement;
  });
}

/** "one fifty" → "150", "a hundred and forty" → "140". Only combinations that can't mean anything else. */
export function normaliseSpokenNumbers(text: string): string {
  let out = text;
  // "one fifty" / "two twenty five" → 150 / 225
  out = out.replace(/\b(one|two|three|four|five)\s+(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety)(\s+(one|two|three|four|five|six|seven|eight|nine))?\b/gi,
    (whole, h: string, t: string, _u, u?: string) => {
      const hundreds = SPOKEN_NUMBERS[h.toLowerCase()]! * 100;
      const tens = SPOKEN_NUMBERS[t.toLowerCase()]!;
      const units = u ? SPOKEN_NUMBERS[u.toLowerCase()]! : 0;
      const n = hundreds + tens + units;
      return n >= 100 && n <= 600 ? String(n) : whole;
    });
  // "a hundred and fifty" / "one hundred fifty" → 150
  out = out.replace(/\b(a|one|two|three|four|five)\s+hundred(\s+and)?(\s+(ten|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety))?(\s+(one|two|three|four|five|six|seven|eight|nine))?\b/gi,
    (_whole, h: string, _and, _t, t?: string, _u?: string, u?: string) => {
      const hundreds = (h.toLowerCase() === 'a' ? 1 : SPOKEN_NUMBERS[h.toLowerCase()]!) * 100;
      return String(hundreds + (t ? SPOKEN_NUMBERS[t.toLowerCase()]! : 0) + (u ? SPOKEN_NUMBERS[u.toLowerCase()]! : 0));
    });
  return out;
}

/** Repair the golf words in a transcript, and say what was changed. */
export function fixGolfWords(raw: string): FixedTranscript {
  const fixes: Fix[] = [];
  let text = raw;

  for (const [pattern, replacement] of PHRASE_FIXES) {
    text = text.replace(pattern, (whole, ...groups) => {
      const out = replacement.replace(/\$(\d)/g, (_m, i: string) => String(groups[Number(i) - 1] ?? ''));
      if (out.toLowerCase() !== whole.toLowerCase()) fixes.push({ from: whole, to: out });
      return out;
    });
  }

  text = fixHours(text, fixes);
  text = fixFootPutt(text, fixes);
  text = normaliseSpokenNumbers(text);

  return { text: text.replace(/\s+/g, ' ').trim(), fixes };
}
