import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Fraunces, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';
import { cookies } from 'next/headers';
import { getSessionUser } from '@/lib/auth/session';
import { SCENE_COOKIE, parseScenePreference, resolveScene } from '@/lib/scene/scene';
import { SignOutButton } from './sign-out-button';
import { Wordmark } from './logo';
import { BRAND_NAME, BRAND_SHORT, BRAND_TAGLINE } from '@/lib/brand';
import './globals.css';

// The brand faces (docs/brand/HANDOVER.md): Fraunces for headings, Source Serif 4 for text, IBM Plex
// Mono for every number. Wired to the font tokens in globals.css through these CSS variables.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz', 'SOFT'],
  variable: '--font-fraunces',
});
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  axes: ['opsz'],
  variable: '--font-source-serif',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  // A page that sets its own title gets "<title> · Better Than Most".
  title: { default: BRAND_NAME, template: `%s · ${BRAND_NAME}` },
  applicationName: BRAND_NAME,
  description: `${BRAND_TAGLINE}: log every shot and see where your round loses strokes to a scratch golfer.`,
  manifest: '/manifest.webmanifest',
  // iOS: "Add to Home Screen" opens full screen, titled, with apple-icon.png. The home-screen label
  // is the short form, BTM: "Better Than Most" is truncated under the icon.
  appleWebApp: { capable: true, title: BRAND_SHORT, statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Lets the page extend under the iPhone notch and home indicator when installed; the nav and the
  // welcome tour's bottom bar pad themselves with env(safe-area-inset-*).
  viewportFit: 'cover',
  // The nav's card colour, per theme (globals.css --color-card).
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf7ee' },
    { media: '(prefers-color-scheme: dark)', color: '#1a2721' },
  ],
};

const NAV_LINKS: { href: string; label: string; adminOnly?: boolean }[] = [
  { href: '/', label: 'Rounds' },
  { href: '/scoring', label: 'Scoring' },
  { href: '/insights', label: 'Insights' },
  { href: '/trends', label: 'Trends' },
  { href: '/learn', label: 'Learn' },
  { href: '/courses', label: 'Courses' },
  { href: '/profile', label: 'Played' },
  { href: '/players', label: 'Players', adminOnly: true },
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  // Which illustrated backdrop to paint (sets --golf-scene for every .golf-scene below).
  const scene = resolveScene(parseScenePreference((await cookies()).get(SCENE_COOKIE)?.value));
  return (
    <html lang="en" className={`${fraunces.variable} ${sourceSerif.variable} ${plexMono.variable}`}>
      <body className={`scene-${scene} font-sans text-ink min-h-screen flex flex-col`}>
        {/* Phone/tablet: logo + actions pinned on the first row, links on their own row below,
            wrapping rather than scrolling (nothing out of reach). From `lg` up it's a single row:
            logo · links · actions. */}
        <nav className="border-b bg-card sticky top-0 z-10 pt-[env(safe-area-inset-top)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 max-w-5xl mx-auto text-sm font-medium">
            <Link href="/" className="mr-auto" aria-label={`${BRAND_NAME} home`}>
              <Wordmark size={28} />
            </Link>
            {user && (
              <>
                <ul className="order-last lg:order-none w-full lg:w-auto flex flex-wrap items-center gap-x-4 gap-y-1">
                  {NAV_LINKS.filter((link) => !link.adminOnly || user.isAdmin).map((link) => (
                    <li key={link.href}>
                      <Link className="text-ink-2 hover:text-ink underline-offset-4 hover:underline" href={link.href}>
                        {link.label}
                        {link.adminOnly && (
                          <span className="ml-1 align-middle font-mono text-[9px] uppercase tracking-wide text-accent">admin</span>
                        )}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3">
                  <Link href="/rounds/new" className="bg-green text-on-fill rounded px-3 py-1.5 font-semibold whitespace-nowrap hover:bg-green-deep">
                    + Log a round
                  </Link>
                  <span className="hidden md:inline text-muted" title={user.email}>
                    {user.name}
                  </span>
                  <SignOutButton />
                </div>
              </>
            )}
          </div>
        </nav>
        {/* Column flex so a page can fill the height (the sign-in backdrop). `w-full` on the page is
            essential: a centred (`mx-auto`) flex item otherwise shrink-wraps to its widest child —
            e.g. the 18-hole strip — and the page ends up wider than a phone. */}
        <div className="flex-1 flex flex-col min-w-0 [&>*]:w-full [&>*]:min-w-0">{children}</div>
        {user && (
          // Decorative footer; its edges fade into the page (see .golf-scene-strip).
          <div
            aria-hidden="true"
            className="golf-scene golf-scene-strip h-56 sm:h-80 mt-10 shrink-0 w-full max-w-5xl mx-auto"
          />
        )}
      </body>
    </html>
  );
}
