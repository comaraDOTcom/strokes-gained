/**
 * The illustrated backdrop (public/golf-scene-<season>.svg). A player picks one on the Rounds page,
 * or leaves it on Auto, which follows the season. Stored in a cookie rather than the database: it's
 * a per-device look, not round data, and the sign-in page can read it before anyone is signed in.
 */
export const SCENES = ['spring', 'summer', 'autumn', 'winter'] as const;
export type Scene = (typeof SCENES)[number];
export type ScenePreference = Scene | 'auto';

export const SCENE_COOKIE = 'sg-scene';

export const SCENE_LABELS: Record<Scene, { name: string; weather: string }> = {
  spring: { name: 'Spring', weather: 'Windy' },
  summer: { name: 'Summer', weather: 'Sunny' },
  autumn: { name: 'Autumn', weather: 'Windy' },
  winter: { name: 'Winter', weather: 'Rainy' },
};

/** Meteorological seasons, northern hemisphere (the courses are in Ireland): Mar–May is spring. */
export function sceneForDate(date: Date): Scene {
  const m = date.getMonth(); // 0 = January
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'autumn';
  return 'winter';
}

/** Anything that isn't one of the four scenes (missing, stale, tampered) means Auto. */
export function parseScenePreference(value: string | undefined | null): ScenePreference {
  return SCENES.includes(value as Scene) ? (value as Scene) : 'auto';
}

export function resolveScene(pref: ScenePreference, now: Date = new Date()): Scene {
  return pref === 'auto' ? sceneForDate(now) : pref;
}
