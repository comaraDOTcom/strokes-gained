import { requirePageUser } from '@/lib/auth/session';
import { DIRECTORY, DIRECTORY_FETCHED_AT } from '@/lib/directory';
import { loadPlayedInputs } from '@/lib/directory/queries';
import { PlayedExplorer } from './played-explorer';

export const dynamic = 'force-dynamic';

/**
 * Your golf profile: every course you've played, on a map. Private to you, like your rounds.
 * The directory is every course on the island of Ireland (src/lib/directory); courses where you've
 * logged a round count automatically once they're linked to it.
 */
export default async function ProfilePage() {
  const me = await requirePageUser();
  const { tickedKeys, roundCourses } = await loadPlayedInputs(me.id);

  return (
    <main className="max-w-5xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Courses played</h1>
        <p className="text-sm text-ink-2">
          Every golf course in Ireland, North and South. Tick off the ones you&apos;ve played to build your list; courses
          where you&apos;ve logged a round are counted for you.
        </p>
      </div>

      {DIRECTORY.length === 0 ? (
        <section className="border rounded-xl bg-card p-4 text-sm text-ink-2">
          The course directory hasn&apos;t been loaded yet.
          {me.isAdmin && (
            <>
              {' '}
              Run the <span className="font-mono">Course directory</span> workflow in GitHub Actions (or{' '}
              <span className="font-mono">pnpm directory:fetch</span>) and deploy.
            </>
          )}
        </section>
      ) : (
        <PlayedExplorer directory={[...DIRECTORY]} initialTicked={tickedKeys} roundCourses={roundCourses} />
      )}

      <p className="text-xs text-muted">
        Course list from{' '}
        <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          © OpenStreetMap contributors
        </a>{' '}
        (ODbL){DIRECTORY_FETCHED_AT ? `, updated ${DIRECTORY_FETCHED_AT.slice(0, 10)}` : ''}. Missing a course, or something
        wrong? Request it from the Courses page.
      </p>
    </main>
  );
}
