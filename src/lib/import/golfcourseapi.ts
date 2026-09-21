/**
 * Map a GolfCourseAPI (golfcourseapi.com, v1) course payload onto our `SeedCourse`, so
 * API data goes through exactly the same `validateCourseChecksums` -> `insertCourse`
 * path as the seed file and the .xlsx import. Pure: no network, no DB.
 *
 * Their model: tees split male/female, each TeeBox carrying its own 18 holes
 * {par, yardage, handicap}. Ours: one par/stroke-index per hole shared by every tee, and
 * tee names unique within a course. So this REFUSES (rather than guesses) when tees
 * disagree on a hole's par, and de-duplicates tee names across genders.
 */
import type { SeedCourse } from '../../db/seed-courses';

export type ApiHole = { par?: number; yardage?: number; handicap?: number | null };
export type ApiTeeBox = {
  tee_name?: string;
  course_rating?: number | null;
  slope_rating?: number | null;
  total_yards?: number | null;
  par_total?: number | null;
  number_of_holes?: number | null;
  holes?: ApiHole[];
};
export type ApiCourse = {
  id?: string;
  club_name?: string;
  course_name?: string;
  location?: { address?: string; city?: string; country?: string };
  tees?: { male?: ApiTeeBox[] | null; female?: ApiTeeBox[] | null };
};

export type MapResult = { ok: true; course: SeedCourse } | { ok: false; errors: string[] };

/** "Stackstown Golf Club" + "Cottage" -> "Stackstown Golf Club (Cottage)"; no suffix when they match. */
export function courseDisplayName(api: ApiCourse): string {
  const club = (api.club_name ?? '').trim();
  const course = (api.course_name ?? '').trim();
  if (!course || course.toLowerCase() === club.toLowerCase()) return club || course;
  return club ? `${club} (${course})` : course;
}

export function mapApiCourse(api: ApiCourse, opts: { genders?: ('M' | 'F')[] } = {}): MapResult {
  const genders = opts.genders ?? ['M', 'F'];
  const errors: string[] = [];

  const boxes: { gender: 'M' | 'F'; box: ApiTeeBox }[] = [
    ...(genders.includes('M') ? (api.tees?.male ?? []).map((box) => ({ gender: 'M' as const, box })) : []),
    ...(genders.includes('F') ? (api.tees?.female ?? []).map((box) => ({ gender: 'F' as const, box })) : []),
  ];
  if (boxes.length === 0) return { ok: false, errors: ['No tees in the API data for the requested gender(s).'] };

  const usable = boxes.filter(({ box }) => {
    const n = box.holes?.length ?? 0;
    if (n !== 18) errors.push(`Tee "${box.tee_name}" has ${n} holes — only 18-hole tees can be imported.`);
    return n === 18;
  });
  if (usable.length === 0) return { ok: false, errors };

  // Tee names must be unique per course: "Red" (M) + "Red" (F) -> "Red", "Red (Ladies)".
  const seen = new Set<string>();
  const named = usable.map(({ gender, box }) => {
    const base = (box.tee_name ?? '').trim() || 'Tee';
    let name = base;
    if (seen.has(name.toLowerCase())) name = `${base} (${gender === 'F' ? 'Ladies' : 'Men'})`;
    for (let i = 2; seen.has(name.toLowerCase()); i++) name = `${base} (${i})`;
    seen.add(name.toLowerCase());
    return { gender, box, name };
  });

  // One par and stroke index per hole, shared by all tees — refuse if the tees disagree on par.
  const first = named[0]!.box.holes!;
  const holes: SeedCourse['holes'] = first.map((h, i) => {
    const pars = new Set(named.map((t) => t.box.holes![i]!.par));
    if (pars.size > 1) {
      errors.push(`Hole ${i + 1}: tees disagree on par (${[...pars].join(' vs ')}) — import the genders separately.`);
    }
    const si = named.map((t) => t.box.holes![i]!.handicap).find((v) => typeof v === 'number' && v > 0);
    const yards: Record<string, number> = {};
    for (const t of named) {
      const y = t.box.holes![i]!.yardage;
      if (typeof y !== 'number' || y <= 0) errors.push(`Hole ${i + 1}, tee "${t.name}": missing yardage.`);
      else yards[t.name] = y;
    }
    return { holeNo: i + 1, par: h.par ?? 0, strokeIndex: si ?? null, yards };
  });
  if (errors.length > 0) return { ok: false, errors };

  const loc = api.location ?? {};
  return {
    ok: true,
    course: {
      name: courseDisplayName(api),
      location: [loc.city, loc.country].filter(Boolean).join(', ') || (loc.address ?? ''),
      tees: named.map(({ gender, box, name }) => ({
        name,
        gender,
        distanceUnit: 'yards' as const,
        courseRating: box.course_rating ?? null,
        slopeRating: box.slope_rating ?? null,
        // The club-card totals the API reports are the checksum targets for the hole sums.
        // (Falls back to the hole sums when the API omits a total, which then trivially passes.)
        expectedTotalYards: box.total_yards ?? box.holes!.reduce((n, h) => n + (h.yardage ?? 0), 0),
        expectedPar: box.par_total ?? box.holes!.reduce((n, h) => n + (h.par ?? 0), 0),
      })),
      holes,
    },
  };
}
