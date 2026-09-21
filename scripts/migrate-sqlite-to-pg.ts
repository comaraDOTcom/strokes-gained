/**
 * One-off: copy the single-user SQLite database into Postgres (Neon when
 * DATABASE_URL is set, otherwise local PGlite), keeping every id.
 *
 *   pnpm db:migrate                       # first: create the tables
 *   pnpm db:import-sqlite                 # data/rounds.db -> local PGlite
 *   DATABASE_URL=postgres://… pnpm db:import-sqlite [--sqlite path/to/rounds.db]
 *
 * Safety:
 *  - the SQLite file is opened READ-ONLY;
 *  - it refuses to run if the target already has courses or rounds;
 *  - everything happens in ONE transaction: rows are inserted, SG is recomputed
 *    from scratch by the app's own engine, and every round's gross score and SG
 *    total must equal what SQLite had stored (within 1e-9), or the whole thing
 *    rolls back and nothing is written.
 *
 * Ownership: imported rounds get `user_id = <the ADMIN_EMAIL user>` if that user
 * already exists, else NULL — and are claimed automatically the first time the
 * admin signs in (see src/lib/auth/claim.ts).
 */
import path from 'node:path';
import Database from 'better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { db, closeDb, isRemoteDb } from '../src/db/client';
import { courses, tees, teeHoles, rounds, shots, user } from '../src/db/schema';
import { recomputeRound } from '../src/lib/sg/recompute';
import { isAdminEmail } from '../src/lib/auth/config';

type Row = Record<string, unknown>;

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));
const chunk = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

async function main() {
  const sqlitePath = path.resolve(arg('--sqlite') ?? 'data/rounds.db');
  const src = new Database(sqlitePath, { readonly: true, fileMustExist: true });
  console.log(`Source : ${sqlitePath} (read-only)`);
  console.log(`Target : ${isRemoteDb ? 'Neon (DATABASE_URL)' : 'local PGlite'}`);

  const cols = (t: string) => new Set((src.prepare(`pragma table_info(${t})`).all() as Row[]).map((r) => String(r.name)));
  for (const need of ['mental_balance', 'focus']) {
    if (!cols('rounds').has(need) && !cols('shots').has(need)) {
      throw new Error(`SQLite file is missing column "${need}" — start the old app once so its migrations run, then retry.`);
    }
  }

  const [existingCourses, existingRounds] = await Promise.all([db.select({ id: courses.id }).from(courses), db.select({ id: rounds.id }).from(rounds)]);
  if (existingCourses.length > 0 || existingRounds.length > 0) {
    throw new Error('Target already has courses or rounds — refusing to import over them.');
  }

  const all = (t: string) => src.prepare(`select * from ${t} order by id`).all() as Row[];
  const sCourses = all('courses');
  const sTees = all('tees');
  const sHoles = all('tee_holes');
  const sRounds = all('rounds');
  const sShots = all('shots');
  console.log(`Read   : ${sCourses.length} courses, ${sTees.length} tees, ${sHoles.length} tee holes, ${sRounds.length} rounds, ${sShots.length} shots`);

  // The SQLite truth we must reproduce, per round.
  const expected = new Map<number, { gross: number; sg: number }>();
  for (const r of sRounds) {
    const rs = sShots.filter((s) => Number(s.round_id) === Number(r.id));
    expected.set(Number(r.id), {
      gross: rs.length + rs.reduce((n, s) => n + Number(s.penalty_strokes ?? 0), 0),
      sg: rs.reduce((n, s) => n + Number(s.sg ?? 0), 0),
    });
  }

  await db.transaction(async (tx) => {
    // Owner for imported rounds: the admin, if they've already signed in.
    let ownerId: string | null = null;
    if (process.env.ADMIN_EMAIL) {
      const users = await tx.select().from(user);
      ownerId = users.find((u) => u.emailVerified && isAdminEmail(u.email))?.id ?? null;
    }
    console.log(`Owner  : ${ownerId ? `admin (${ownerId})` : 'none yet — rounds will be claimed at the admin\'s first sign-in'}`);

    await tx.insert(courses).values(sCourses.map((c) => ({ id: Number(c.id), name: String(c.name), location: str(c.location) })));
    await tx.insert(tees).values(
      sTees.map((t) => ({
        id: Number(t.id),
        courseId: Number(t.course_id),
        name: String(t.name),
        gender: String(t.gender),
        distanceUnit: String(t.distance_unit),
        courseRating: num(t.course_rating),
        slopeRating: num(t.slope_rating),
        expectedTotalYards: num(t.expected_total_yards),
        expectedPar: num(t.expected_par),
      })),
    );
    await tx.insert(teeHoles).values(
      sHoles.map((h) => ({
        id: Number(h.id),
        teeId: Number(h.tee_id),
        holeNo: Number(h.hole_no),
        par: Number(h.par),
        strokeIndex: num(h.stroke_index),
        yards: Number(h.yards),
      })),
    );
    if (sRounds.length > 0) {
      await tx.insert(rounds).values(
        sRounds.map((r) => ({
          id: Number(r.id),
          userId: ownerId,
          courseId: Number(r.course_id),
          teeId: Number(r.tee_id),
          playedOn: String(r.played_on),
          weather: str(r.weather),
          notes: str(r.notes),
          name: str(r.name),
          mentalBalance: num(r.mental_balance),
          mentalTempo: num(r.mental_tempo),
          mentalTension: num(r.mental_tension),
          mentalConfidence: num(r.mental_confidence),
          mentalFocus: num(r.mental_focus),
          mentalComposure: num(r.mental_composure),
        })),
      );
    }
    for (const part of chunk(sShots, 300)) {
      await tx.insert(shots).values(
        part.map((s) => ({
          id: Number(s.id),
          roundId: Number(s.round_id),
          holeNo: Number(s.hole_no),
          shotNo: Number(s.shot_no),
          startLie: String(s.start_lie),
          startYards: Number(s.start_yards),
          endLie: str(s.end_lie),
          endYards: Number(s.end_yards),
          holed: Boolean(s.holed),
          penaltyStrokes: Number(s.penalty_strokes ?? 0),
          penaltyType: str(s.penalty_type),
          // sg/category/etc. are re-derived below by the app's own engine.
          focus: str(s.focus),
          commitment: str(s.commitment),
        })),
      );
    }

    // Identity sequences must continue after the highest imported id.
    for (const t of ['courses', 'tees', 'tee_holes', 'rounds', 'shots'] as const) {
      await tx.execute(sql.raw(`select setval(pg_get_serial_sequence('${t}', 'id'), greatest((select coalesce(max(id), 0) from ${t}), 1))`));
    }

    // Recompute SG with the engine and prove it reproduces what SQLite had.
    let bad = 0;
    console.log('\nround | gross (sqlite → pg) | SG total (sqlite → pg)');
    for (const r of sRounds) {
      const id = Number(r.id);
      await recomputeRound(id, tx);
      const rs = await tx.select().from(shots).where(eq(shots.roundId, id));
      const gross = rs.length + rs.reduce((n, s) => n + s.penaltyStrokes, 0);
      const sg = rs.reduce((n, s) => n + (s.sg ?? 0), 0);
      const want = expected.get(id)!;
      const ok = gross === want.gross && Math.abs(sg - want.sg) < 1e-9;
      if (!ok) bad++;
      console.log(`${String(id).padStart(5)} | ${want.gross} → ${gross} | ${want.sg.toFixed(6)} → ${sg.toFixed(6)} ${ok ? 'OK' : 'MISMATCH'}`);
    }
    if (bad > 0) throw new Error(`${bad} round(s) did not reproduce their SQLite score/SG — rolling everything back.`);
  });

  console.log('\nImported and verified.');
  src.close();
  await closeDb();
}

main().catch(async (err) => {
  console.error('\nFAILED:', err instanceof Error ? err.message : err);
  await closeDb().catch(() => {});
  process.exit(1);
});
