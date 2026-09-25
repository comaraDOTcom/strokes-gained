import { describe, expect, it } from 'vitest';
import { parseScenePreference, resolveScene, sceneForDate } from './scene';

describe('sceneForDate', () => {
  it.each([
    [0, 'winter'], [1, 'winter'], [2, 'spring'], [4, 'spring'], [5, 'summer'],
    [7, 'summer'], [8, 'autumn'], [10, 'autumn'], [11, 'winter'],
  ] as const)('month %i is %s', (month, scene) => {
    expect(sceneForDate(new Date(2026, month, 15))).toBe(scene);
  });
});

describe('parseScenePreference', () => {
  it('accepts the four scenes', () => {
    expect(parseScenePreference('winter')).toBe('winter');
    expect(parseScenePreference('summer')).toBe('summer');
  });
  it('falls back to auto for anything else', () => {
    expect(parseScenePreference(undefined)).toBe('auto');
    expect(parseScenePreference('')).toBe('auto');
    expect(parseScenePreference('monsoon')).toBe('auto');
    expect(parseScenePreference('auto')).toBe('auto');
  });
});

describe('resolveScene', () => {
  it('uses the chosen scene whatever the date', () => {
    expect(resolveScene('winter', new Date(2026, 6, 1))).toBe('winter');
  });
  it('follows the season on auto', () => {
    expect(resolveScene('auto', new Date(2026, 9, 1))).toBe('autumn');
  });
});
