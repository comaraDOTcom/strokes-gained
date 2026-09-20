/**
 * Drizzle schema (SQLite via better-sqlite3). Written to be Postgres-portable:
 * only `text`, `integer`, and `real` column types are used (no SQLite-only
 * affinities/types), so a future move to `drizzle-orm/pg-core` is a
 * near-mechanical swap of table/column constructors, not a redesign.
 *
 * Canonical storage unit is YARDS (`real`) for every lie, including GREEN.
 * Feet<->yards conversion happens in exactly one place: `src/lib/units.ts`
 * (feet on write for GREEN, yards->feet on display). Nothing else in the
 * app should do that arithmetic inline.
 *
 * `sg` / `category` / `baseline_id` on `shots` are DERIVED, denormalised
 * columns — always produced by `recomputeRound()` (see
 * `src/lib/sg/recompute.ts`), never written directly by a form. Hole score
 * is likewise always derived from `shots`, never stored as its own input.
 */
import { sqliteTable, text, integer, real, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  location: text('location'),
});

export const tees = sqliteTable(
  'tees',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    courseId: integer('course_id')
      .notNull()
      .references(() => courses.id),
    name: text('name').notNull(),
    gender: text('gender').notNull(), // 'M' | 'F'
    distanceUnit: text('distance_unit').notNull(), // 'yards' | 'metres'
    courseRating: real('course_rating'), // nullable — not every card publishes one
    slopeRating: real('slope_rating'),
    // Reference totals used as the editor's "does this still add up" check
    // and (at import/seed time) as the checksum target. Not re-derived on
    // every read — they're the club-card truth the grid is checked against.
    expectedTotalYards: real('expected_total_yards'),
    expectedPar: integer('expected_par'),
  },
  (table) => ({
    courseTeeUnique: uniqueIndex('tees_course_id_name_unique').on(table.courseId, table.name),
  }),
);

export const teeHoles = sqliteTable(
  'tee_holes',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    teeId: integer('tee_id')
      .notNull()
      .references(() => tees.id),
    holeNo: integer('hole_no').notNull(),
    par: integer('par').notNull(),
    strokeIndex: integer('stroke_index'), // nullable — not every card publishes one
    yards: real('yards').notNull(),
  },
  (table) => ({
    teeHoleUnique: uniqueIndex('tee_holes_tee_id_hole_no_unique').on(table.teeId, table.holeNo),
  }),
);

export const rounds = sqliteTable('rounds', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  courseId: integer('course_id')
    .notNull()
    .references(() => courses.id),
  teeId: integer('tee_id')
    .notNull()
    .references(() => tees.id),
  playedOn: text('played_on').notNull(), // ISO date (YYYY-MM-DD) — portable, sortable as text
  weather: text('weather'),
  // Free-text round commentary (typed, or a dictated/transcribed voice note).
  notes: text('notes'),
  // Optional human label, e.g. "Medal Final 2026". Null falls back to course/date in the UI.
  name: text('name'),
  // Overall mentality/feel for the round, each 1 (poor) – 5 (excellent); null = not rated.
  // Pia Nilsson's balance / tempo / tension. For tension, 5 = relaxed (low tension), so
  // every scale reads "higher is better". Validated in src/lib/rounds/details.ts, not by a
  // DB CHECK, to stay Postgres-portable.
  mentalBalance: integer('mental_balance'),
  mentalTempo: integer('mental_tempo'),
  mentalTension: integer('mental_tension'),
  // LEGACY: the first mentality design (confidence / focus / composure). No longer shown or
  // written; kept only so already-saved values aren't destroyed by a migration.
  mentalConfidence: integer('mental_confidence'),
  mentalFocus: integer('mental_focus'),
  mentalComposure: integer('mental_composure'),
});

export const shots = sqliteTable(
  'shots',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    roundId: integer('round_id')
      .notNull()
      .references(() => rounds.id),
    holeNo: integer('hole_no').notNull(),
    shotNo: integer('shot_no').notNull(),
    startLie: text('start_lie').notNull(),
    startYards: real('start_yards').notNull(),
    endLie: text('end_lie'), // nullable — null when holed
    endYards: real('end_yards').notNull(),
    holed: integer('holed', { mode: 'boolean' }).notNull(),
    penaltyStrokes: integer('penalty_strokes').notNull().default(0),
    penaltyType: text('penalty_type'), // nullable: 'LATERAL' | 'STROKE_AND_DISTANCE'

    // Derived — see recomputeRound(). Nullable only for the instant between
    // insert and the recompute call that always follows it in the same
    // mutation.
    sg: real('sg'),
    category: text('category'),
    bunkerSubtype: text('bunker_subtype'),
    baselineId: text('baseline_id'),

    // Optional per-shot mentality tags, entered by the user (never derived).
    // 'INTERNAL' (swing thoughts / mechanics) | 'EXTERNAL' (target / feel); null = not recorded.
    focus: text('focus'),
    // 'COMMITTED' (clear decision, fully committed) | 'HESITANT'; null = not recorded.
    commitment: text('commitment'),
  },
  (table) => ({
    roundHoleShotUnique: uniqueIndex('shots_round_id_hole_no_shot_no_unique').on(
      table.roundId,
      table.holeNo,
      table.shotNo,
    ),
  }),
);

export type Course = typeof courses.$inferSelect;
export type NewCourse = typeof courses.$inferInsert;
export type Tee = typeof tees.$inferSelect;
export type NewTee = typeof tees.$inferInsert;
export type TeeHole = typeof teeHoles.$inferSelect;
export type NewTeeHole = typeof teeHoles.$inferInsert;
export type Round = typeof rounds.$inferSelect;
export type NewRound = typeof rounds.$inferInsert;
export type Shot = typeof shots.$inferSelect;
export type NewShot = typeof shots.$inferInsert;
