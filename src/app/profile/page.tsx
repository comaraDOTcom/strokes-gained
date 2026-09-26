import { cookies } from 'next/headers';
import { requirePageUser } from '@/lib/auth/session';
import { DIRECTORY, DIRECTORY_FETCHED_AT, TOP100, TOP100_RANK } from '@/lib/directory';
import { loadPlayedInputs } from '@/lib/directory/queries';
import { SCENE_COOKIE, SCENE_LABELS, parseScenePreference, resolveScene } from '@/lib/scene/scene';
import { PlayedExplorer } from './played-explorer';
import { ScenePicker } from './scene-picker';

export const dynamic = 'force-dynamic';

/**
 * Your golf profile: every course you've played, on a map. Private to you, like your rounds.
 * The directory is every course on the island of Ireland (src/lib/directory); courses where you've
 * logged a round count automatically once they're linked to it. Below the map: your account and
 * the backdrop setting (the nav's name/initial links straight to #settings).
 */
export default async function ProfilePage() {
  const me = await requirePageUser();
  const { tickedKeys, roundCourses } = await loadPlayedInputs(me.id);
  const scenePref = parseScenePreference((await cookies()).get(SCENE_COOKIE)?.value);
  const scene = resolveScene(scenePref);
  const autoScene = resolveScene('auto');

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
        <PlayedExplorer
          directory={[...DIRECTORY]}
          initialTicked={tickedKeys}
          roundCourses={roundCourses}
          top100={{ ranks: [...TOP100_RANK], label: `${TOP100.title}${TOP100.year ? ` (${TOP100.year})` : ''}` }}
        />
      )}

      <p className="text-xs text-muted">
        Course list from{' '}
        <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">
          © OpenStreetMap contributors
        </a>{' '}
        (ODbL){DIRECTORY_FETCHED_AT ? `, updated ${DIRECTORY_FETCHED_AT.slice(0, 10)}` : ''}. Missing a course, or something
        wrong? Request it from the Courses page.
      </p>

      <section id="settings" className="scroll-mt-28 border-t pt-6 space-y-4">
        <h2 className="text-xl font-semibold">Settings</h2>

        <div className="border rounded-xl bg-card p-4">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Name</dt>
              <dd className="font-medium">{me.name}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Email</dt>
              <dd className="font-medium break-all">{me.email}</dd>
            </div>
          </dl>
        </div>

        {/* The layout sets the scene on <body>, so this preview, the footer and the sign-in page
            all show the same one. */}
        <div className="border rounded-xl bg-card p-4 space-y-4">
          <div className="space-y-1">
            <h3 className="font-semibold">Backdrop</h3>
            <p className="text-sm text-ink-2">
              The course scene at the bottom of every page and on the sign-in page. <strong>Auto</strong> changes
              with the season. Saved on this device.
            </p>
          </div>
          <div
            role="img"
            aria-label={`${SCENE_LABELS[scene].weather} ${SCENE_LABELS[scene].name.toLowerCase()} on the course`}
            className="golf-scene golf-scene-hero h-36 sm:h-52 rounded-lg border relative overflow-hidden"
          >
            <span className="absolute left-3 bottom-3 rounded-md bg-card/90 backdrop-blur-sm px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-2">
              {SCENE_LABELS[scene].weather} {SCENE_LABELS[scene].name}
            </span>
          </div>
          <ScenePicker preference={scenePref} autoScene={autoScene} />
        </div>
      </section>
    </main>
  );
}
