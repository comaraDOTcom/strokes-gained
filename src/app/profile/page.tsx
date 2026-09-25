import { cookies } from 'next/headers';
import { requirePageUser } from '@/lib/auth/session';
import { SCENE_COOKIE, SCENE_LABELS, parseScenePreference, resolveScene } from '@/lib/scene/scene';
import { ScenePicker } from './scene-picker';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requirePageUser();
  const scenePref = parseScenePreference((await cookies()).get(SCENE_COOKIE)?.value);
  const scene = resolveScene(scenePref);
  const autoScene = resolveScene('auto');

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Profile</h1>

      <section className="border rounded-xl bg-card p-4 space-y-3">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Name</dt>
            <dd className="font-medium">{user.name}</dd>
          </div>
          <div>
            <dt className="font-mono text-[10px] uppercase tracking-wide text-muted">Email</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
        </dl>
      </section>

      {/* The layout sets the scene on <body>, so this preview, the footer and the sign-in page
          all show the same one. */}
      <section className="border rounded-xl bg-card p-4 space-y-4">
        <div className="space-y-1">
          <h2 className="font-semibold">Backdrop</h2>
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
      </section>
    </main>
  );
}
