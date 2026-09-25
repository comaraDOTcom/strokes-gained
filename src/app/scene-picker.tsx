'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { SCENES, SCENE_COOKIE, SCENE_LABELS, type Scene, type ScenePreference } from '@/lib/scene/scene';

/**
 * The Rounds page's backdrop chooser: Auto (follows the season) or one of the four scenes. Saves a
 * year-long cookie and refreshes, so the layout repaints every backdrop (hero, footer, sign-in).
 */
export function ScenePicker({ preference, autoScene }: { preference: ScenePreference; autoScene: Scene }) {
  const router = useRouter();
  const [selected, setSelected] = useState(preference);
  const [pending, startTransition] = useTransition();

  function choose(pref: ScenePreference) {
    setSelected(pref);
    document.cookie = `${SCENE_COOKIE}=${pref}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  }

  const options: { pref: ScenePreference; scene: Scene; name: string; sub: string }[] = [
    { pref: 'auto', scene: autoScene, name: 'Auto', sub: SCENE_LABELS[autoScene].name },
    ...SCENES.map((s) => ({ pref: s, scene: s, name: SCENE_LABELS[s].name, sub: SCENE_LABELS[s].weather })),
  ];

  return (
    <fieldset className={`space-y-2 ${pending ? 'opacity-70' : ''}`} aria-busy={pending}>
      <legend className="font-mono text-[10px] uppercase tracking-wide text-muted">Backdrop</legend>
      <div className="grid grid-cols-5 gap-2">
        {options.map((o) => {
          const isSelected = o.pref === selected;
          return (
            <button
              key={o.pref}
              type="button"
              onClick={() => choose(o.pref)}
              aria-pressed={isSelected}
              className={`group rounded-lg border p-1 text-left ${
                isSelected ? 'bg-accent-soft border-accent/50' : 'bg-card border-line-strong hover:bg-paper-2'
              }`}
            >
              <span
                aria-hidden="true"
                className={`scene-${o.scene} golf-scene golf-scene-hero block h-10 sm:h-14 rounded-md border`}
              />
              <span className="block px-0.5 pt-1 text-xs sm:text-sm font-medium leading-tight">{o.name}</span>
              <span className="block px-0.5 font-mono text-[10px] text-muted leading-tight truncate">{o.sub}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
