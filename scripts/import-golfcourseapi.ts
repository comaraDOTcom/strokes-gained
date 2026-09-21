/**
 * Add courses from GolfCourseAPI to the shared course library.
 *
 *   pnpm courses:api search "stackstown"            # find course ids (1 API request)
 *   pnpm courses:api add <id> [<id>…] [--mens]      # DRY RUN: fetch, map, validate, print
 *   pnpm courses:api add <id> … --commit            # actually insert
 *
 * Needs GOLFCOURSEAPI_KEY. Writes to whatever `src/db/client.ts` connects to (DATABASE_URL =
 * Neon, else local PGlite). Same path as every other import: mapApiCourse ->
 * validateCourseChecksums -> insertCourse; a course whose name already exists is skipped.
 * Imported courses are owned by the ADMIN_EMAIL user when that user exists.
 */
import { db, closeDb, isRemoteDb } from '../src/db/client';
import { courses, user } from '../src/db/schema';
import { validateCourseChecksums } from '../src/db/checksum';
import { insertCourse } from '../src/db/insert-course';
import { isAdminEmail } from '../src/lib/auth/config';
import { mapApiCourse, type ApiCourse } from '../src/lib/import/golfcourseapi';

const API = 'https://api.golfcourseapi.com/v1';

async function api(path: string): Promise<any> {
  const key = process.env.GOLFCOURSEAPI_KEY;
  if (!key) throw new Error('GOLFCOURSEAPI_KEY is not set');
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}` } });
  if (!res.ok) throw new Error(`GolfCourseAPI ${path} -> HTTP ${res.status}`);
  return res.json();
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const flags = new Set(rest.filter((a) => a.startsWith('--')));
  const args = rest.filter((a) => !a.startsWith('--'));

  if (cmd === 'search') {
    const d = await api(`/search?search_query=${encodeURIComponent(args.join(' '))}`);
    for (const c of d.courses ?? []) {
      console.log(`${c.id}  ${c.club_name} — ${c.course_name}  (${c.location?.city}, ${c.location?.country})  tees ${JSON.stringify(c.tees)}`);
    }
    if (!d.courses?.length) console.log('No results.');
    return;
  }
  if (cmd !== 'add' || args.length === 0) {
    console.error('Usage: courses:api search "<name>"  |  courses:api add <id> [<id>…] [--mens] [--commit]');
    process.exitCode = 1;
    return;
  }

  const commit = flags.has('--commit');
  console.log(`${commit ? 'COMMIT' : 'DRY RUN'} -> ${isRemoteDb ? 'Neon (DATABASE_URL)' : 'local PGlite'}\n`);

  const existing = (await db.select({ name: courses.name }).from(courses)).map((c) => c.name.trim().toLowerCase());
  const users = await db.select().from(user);
  const owner = users.find((u) => u.emailVerified && isAdminEmail(u.email)) ?? null;
  console.log(`Owner: ${owner ? owner.email : 'none (ADMIN_EMAIL user not found) — course will be admin-only to edit'}\n`);

  for (const id of args) {
    const d = await api(`/courses/${id}`);
    const mapped = mapApiCourse((d.course ?? d) as ApiCourse, { genders: flags.has('--mens') ? ['M'] : ['M', 'F'] });
    if (!mapped.ok) {
      console.log(`✗ ${id}: cannot import\n   - ${mapped.errors.join('\n   - ')}\n`);
      process.exitCode = 1;
      continue;
    }
    const c = mapped.course;
    console.log(`${c.name}  [${c.location}]`);
    for (const t of c.tees) {
      console.log(`   ${t.gender} ${t.name.padEnd(14)} ${t.expectedTotalYards}y  par ${t.expectedPar}  CR ${t.courseRating ?? '—'} / SR ${t.slopeRating ?? '—'}`);
    }
    const si = c.holes.filter((h) => h.strokeIndex !== null).length;
    console.log(`   stroke indexes: ${si}/18${si === 0 ? ' (not in the API — add them later in the course editor if you want them)' : ''}`);

    const errors = validateCourseChecksums(c);
    if (errors.length > 0) {
      console.log(`   ✗ checksum FAILED — not imported:\n${errors.map((e) => `      [${e.teeName}] ${e.kind}: ${e.message}`).join('\n')}\n`);
      process.exitCode = 1;
      continue;
    }
    if (existing.includes(c.name.trim().toLowerCase())) {
      console.log('   • already in the library — skipped\n');
      continue;
    }
    if (!commit) {
      console.log('   ✓ valid — would be added (re-run with --commit)\n');
      continue;
    }
    const newId = await insertCourse(c, owner?.id ?? null);
    existing.push(c.name.trim().toLowerCase());
    console.log(`   ✓ added as course #${newId}\n`);
  }
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error('FAILED:', err instanceof Error ? err.message : err);
    await closeDb().catch(() => {});
    process.exit(1);
  });
