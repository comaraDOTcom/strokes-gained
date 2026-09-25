/**
 * First-run onboarding (`/welcome`): the pure parts, so they're tested without a browser.
 *
 *  - whether a signed-in player should see the tour at all,
 *  - which "add to home screen" instructions fit their phone,
 *  - the copy shared by the tour, the Learn hub and the first-round tip (one source, so the
 *    three can't drift apart).
 */

/** Set (for a year) once the player has finished or skipped the tour in this browser. */
export const WELCOME_COOKIE = 'sg_welcomed';

/**
 * Show the tour to someone who has no rounds and hasn't dismissed it here; `again` (the Learn
 * page's "Welcome tour" link) always shows it. A player with rounds never gets it unasked.
 */
export function shouldShowWelcome(input: { hasRounds: boolean; welcomed: boolean; again: boolean }): boolean {
  if (input.again) return true;
  return !input.hasRounds && !input.welcomed;
}

/** Move between steps; never off either end. */
export function clampStep(current: number, delta: number, count: number): number {
  return Math.min(Math.max(current + delta, 0), Math.max(count - 1, 0));
}

export type Platform = 'standalone' | 'ios' | 'ios-other-browser' | 'android' | 'other';

/**
 * Which phone this is, for the install guide. `standalone` = already opened from the home screen.
 * iPadOS reports itself as a Mac, so touch points are the tell. On iOS every browser is WebKit, but
 * only Safari can add to the home screen: Chrome, Firefox, Edge, Opera and DuckDuckGo carry their
 * own tokens (an in-app browser, e.g. WhatsApp's, shares Safari's user agent and is handled in the
 * copy).
 */
export function detectPlatform(input: { userAgent: string; standalone: boolean; maxTouchPoints: number }): Platform {
  if (input.standalone) return 'standalone';
  const ua = input.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && input.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo|Ddg\//.test(ua) ? 'ios-other-browser' : 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'other';
}

export type InstallGuide = { title: string; steps: string[]; note: string | null };

/** Step-by-step "add to home screen" for that platform. */
export function installGuide(platform: Platform): InstallGuide {
  switch (platform) {
    case 'standalone':
      return {
        title: 'Done: it opens from your home screen',
        steps: [],
        note: 'You already added it. It opens straight to your rounds, full screen, like an app.',
      };
    case 'ios':
      return {
        title: 'Add it to your iPhone home screen',
        steps: [
          'Tap the Share button (the square with an arrow) at the bottom of Safari.',
          'Scroll the list and tap "Add to Home Screen".',
          'Tap "Add". Open it from there from now on.',
        ],
        note: 'Reading this inside WhatsApp or Mail? Tap the Safari icon in the bottom-right corner first. Only Safari can add to the home screen.',
      };
    case 'ios-other-browser':
      return {
        title: 'Add it to your iPhone home screen',
        steps: [
          'Open this page in Safari (only Safari can add to the home screen).',
          'Tap the Share button (the square with an arrow) at the bottom.',
          'Scroll the list and tap "Add to Home Screen", then "Add".',
        ],
        note: null,
      };
    case 'android':
      return {
        title: 'Add it to your home screen',
        steps: [
          'In Chrome, tap the ⋮ menu in the top-right.',
          'Tap "Add to Home screen" (or "Install app").',
          'Tap "Add". Open it from there from now on.',
        ],
        note: 'Reading this inside WhatsApp? Tap ⋮ and "Open in Chrome" first.',
      };
    default:
      return {
        title: 'On your phone, add it to your home screen',
        steps: [
          'Open this address on your phone, in Safari (iPhone) or Chrome (Android).',
          'iPhone: Share → "Add to Home Screen". Android: ⋮ → "Add to Home screen".',
        ],
        note: 'On a laptop, a bookmark is all you need.',
      };
  }
}

/** The three things the app asks for on every shot. Shown on the tour, Learn and the first-round tip. */
export const LOGGING_STEPS: readonly { title: string; text: string }[] = [
  {
    title: 'Where did it finish?',
    text: 'Tap Tee, Fairway, Rough, Sand, Recovery or Green. Recovery means no realistic shot at the green: you have to chip out sideways or lay up.',
  },
  {
    title: 'How far to the hole?',
    text: 'The distance you had left, in yards, or in feet once you are on the green. Not how far you hit it. A GPS watch or app, a rangefinder or a sprinkler head is ideal; a good guess is fine.',
  },
  {
    title: 'Holed.',
    text: 'When it drops, tap Holed instead of a lie. The next hole opens.',
  },
];

/** The first-name greeting: "Welcome, Conor." from a full name; falls back to a plain welcome. */
export function greeting(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? `Welcome, ${first}.` : 'Welcome.';
}
