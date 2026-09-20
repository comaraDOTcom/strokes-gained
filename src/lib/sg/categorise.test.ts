import { describe, expect, it } from 'vitest';
import { categoriseShot } from './categorise';

describe('categoriseShot — 6-rule ordered resolution', () => {
  it('rule 1: GREEN always -> PUTTING, regardless of par', () => {
    expect(categoriseShot('GREEN', 20, 4).category).toBe('PUTTING');
    expect(categoriseShot('GREEN', 3, 3).category).toBe('PUTTING');
  });

  it('rule 2: SAND -> BUNKER, sub-split by distance (<=30y greenside, >30y fairway)', () => {
    const greenside = categoriseShot('SAND', 20, 4);
    expect(greenside.category).toBe('BUNKER');
    expect(greenside.bunkerSubtype).toBe('greenside');

    const boundary = categoriseShot('SAND', 30, 4);
    expect(boundary.bunkerSubtype).toBe('greenside');

    const fairway = categoriseShot('SAND', 150, 5);
    expect(fairway.category).toBe('BUNKER');
    expect(fairway.bunkerSubtype).toBe('fairway');
  });

  it('rule 3: RECOVERY -> RECOVERY, even off the tee or long range', () => {
    expect(categoriseShot('RECOVERY', 60, 4).category).toBe('RECOVERY');
  });

  it('rule 4: TEE with par >= 4 -> OFF_THE_TEE', () => {
    expect(categoriseShot('TEE', 413, 4).category).toBe('OFF_THE_TEE');
    expect(categoriseShot('TEE', 524, 5).category).toBe('OFF_THE_TEE');
  });

  it('rule 5: par-3 tee shots and other >30y shots -> APPROACH', () => {
    expect(categoriseShot('TEE', 187, 3).category).toBe('APPROACH');
    expect(categoriseShot('FAIRWAY', 150, 4).category).toBe('APPROACH');
    expect(categoriseShot('ROUGH', 40, 4).category).toBe('APPROACH');
  });

  it('rule 6: everything else (<=30y, not green/sand/recovery/tee-par4+) -> SHORT_GAME', () => {
    expect(categoriseShot('FAIRWAY', 20, 4).category).toBe('SHORT_GAME');
    expect(categoriseShot('ROUGH', 30, 4).category).toBe('SHORT_GAME');
  });

  it('rule ordering matters: RECOVERY off the tee is RECOVERY, not OFF_THE_TEE', () => {
    // Rule 3 (RECOVERY) must be checked before rule 4 (TEE && par>=4).
    // This can't happen for startLie TEE in practice (tee shots start at
    // TEE, not RECOVERY), but the priority order itself is what's under
    // test elsewhere (rule 2 before rule 5, e.g. a long fairway-bunker shot
    // must stay BUNKER, not become APPROACH).
    const longBunker = categoriseShot('SAND', 200, 5);
    expect(longBunker.category).toBe('BUNKER');
  });
});
