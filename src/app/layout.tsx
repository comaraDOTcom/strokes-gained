import type { Metadata } from 'next';
import Link from 'next/link';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { getSessionUser } from '@/lib/auth/session';
import { SignOutButton } from './sign-out-button';
import { Logo } from './logo';
import './globals.css';

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-plex-mono',
});

export const metadata: Metadata = {
  title: 'Strokes Gained',
  description: 'Strokes-gained golf tracking',
};

const NAV_LINKS = [
  { href: '/', label: 'Rounds' },
  { href: '/insights', label: 'Insights' },
  { href: '/trends', label: 'Trends' },
  { href: '/courses', label: 'Courses' },
  { href: '/players', label: 'Players' },
];

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getSessionUser();
  return (
    <html lang="en" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body className="font-sans text-ink min-h-screen flex flex-col">
        {/* Phone: logo + actions pinned on the first row, links on their own row below (nothing
            scrolls out of reach). From `sm` up it's a single row: logo · links · actions. */}
        <nav className="border-b bg-card sticky top-0 z-10">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2 max-w-3xl mx-auto text-sm font-medium">
            <Link href="/" className="flex items-center gap-2 mr-auto" aria-label="Strokes Gained home">
              <Logo size={28} />
              <span className="font-semibold">Strokes Gained</span>
            </Link>
            {user && (
              <>
                <ul className="order-last sm:order-none w-full sm:w-auto flex items-center justify-between sm:justify-start gap-3 sm:gap-4">
                  {NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <Link className="text-ink-2 hover:text-ink underline-offset-4 hover:underline" href={link.href}>
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-3">
                  <Link href="/rounds/new" className="bg-ink text-paper rounded-lg px-3 py-1.5 font-medium whitespace-nowrap">
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
