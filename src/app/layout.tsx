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
      <body className="font-sans text-ink">
        <nav className="border-b bg-card sticky top-0 z-10 overflow-x-auto">
          <ul className="flex items-center gap-3 sm:gap-4 px-3 py-2 max-w-3xl mx-auto text-sm font-medium whitespace-nowrap">
            <li className="flex items-center gap-2 mr-auto">
              <Link href="/" className="flex items-center gap-2" aria-label="Strokes Gained home">
                <Logo size={28} />
                <span className="font-semibold hidden sm:inline">Strokes Gained</span>
              </Link>
            </li>
            {user && (
              <>
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <Link className="text-ink-2 hover:text-ink underline-offset-4 hover:underline" href={link.href}>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link href="/rounds/new" className="bg-ink text-paper rounded-lg px-3 py-1.5 font-medium">
                    <span className="sm:hidden">+ Log</span>
                    <span className="hidden sm:inline">Log a round</span>
                  </Link>
                </li>
                <li className="hidden sm:block text-muted" title={user.email}>
                  {user.name}
                </li>
                <li>
                  <SignOutButton />
                </li>
              </>
            )}
          </ul>
        </nav>
        {children}
      </body>
    </html>
  );
}
