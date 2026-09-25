import { describe, expect, it } from 'vitest';
import { LOGGING_STEPS, clampStep, detectPlatform, greeting, installGuide, shouldShowWelcome } from './onboarding';

describe('shouldShowWelcome', () => {
  it('shows the tour to a new player with no rounds who has not dismissed it', () => {
    expect(shouldShowWelcome({ hasRounds: false, welcomed: false, again: false })).toBe(true);
  });
  it('never interrupts someone who already has rounds', () => {
    expect(shouldShowWelcome({ hasRounds: true, welcomed: false, again: false })).toBe(false);
  });
  it('respects a skip or finish in this browser', () => {
    expect(shouldShowWelcome({ hasRounds: false, welcomed: true, again: false })).toBe(false);
  });
  it('always shows it when asked for again from Learn', () => {
    expect(shouldShowWelcome({ hasRounds: true, welcomed: true, again: true })).toBe(true);
  });
});

describe('clampStep', () => {
  it('moves forward and back inside the deck', () => {
    expect(clampStep(0, 1, 5)).toBe(1);
    expect(clampStep(3, -1, 5)).toBe(2);
  });
  it('stops at either end', () => {
    expect(clampStep(0, -1, 5)).toBe(0);
    expect(clampStep(4, 1, 5)).toBe(4);
    expect(clampStep(0, 1, 0)).toBe(0);
  });
});

describe('detectPlatform', () => {
  const iphoneSafari =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  const iphoneChrome =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.80 Mobile/15E148 Safari/604.1';
  const ipad = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
  const android =
    'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36';
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

  it('iPhone Safari (and the in-app browsers that share its user agent)', () => {
    expect(detectPlatform({ userAgent: iphoneSafari, standalone: false, maxTouchPoints: 5 })).toBe('ios');
  });
  it('another browser on iOS cannot add to the home screen', () => {
    expect(detectPlatform({ userAgent: iphoneChrome, standalone: false, maxTouchPoints: 5 })).toBe('ios-other-browser');
  });
  it('iPadOS says it is a Mac; touch points give it away', () => {
    expect(detectPlatform({ userAgent: ipad, standalone: false, maxTouchPoints: 5 })).toBe('ios');
    expect(detectPlatform({ userAgent: mac, standalone: false, maxTouchPoints: 0 })).toBe('other');
  });
  it('Android', () => {
    expect(detectPlatform({ userAgent: android, standalone: false, maxTouchPoints: 5 })).toBe('android');
  });
  it('already on the home screen wins over everything', () => {
    expect(detectPlatform({ userAgent: iphoneSafari, standalone: true, maxTouchPoints: 5 })).toBe('standalone');
  });
});

describe('installGuide', () => {
  it('gives numbered steps for every phone and none once installed', () => {
    for (const p of ['ios', 'ios-other-browser', 'android', 'other'] as const) {
      expect(installGuide(p).steps.length).toBeGreaterThanOrEqual(2);
    }
    expect(installGuide('standalone').steps).toEqual([]);
    expect(installGuide('standalone').note).toMatch(/already/);
  });
  it('tells iPhone users inside WhatsApp or Mail to get to Safari first', () => {
    expect(installGuide('ios').note).toMatch(/Safari/);
    expect(installGuide('ios-other-browser').steps[0]).toMatch(/Safari/);
  });
});

describe('copy', () => {
  it('logging has three steps: lie, distance left, holed', () => {
    expect(LOGGING_STEPS.map((s) => s.title)).toEqual(['Where did it finish?', 'How far to the hole?', 'Holed.']);
    expect(LOGGING_STEPS[1]!.text).toMatch(/Not how far you hit it/);
  });
  it('greets by first name', () => {
    expect(greeting('Conor Mara')).toBe('Welcome, Conor.');
    expect(greeting('  ')).toBe('Welcome.');
    expect(greeting(null)).toBe('Welcome.');
  });
});
