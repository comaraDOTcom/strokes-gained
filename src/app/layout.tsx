import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Strokes Gained',
  description: 'Strokes-gained golf tracking',
};

const NAV_LINKS = [
  { href: '/', label: 'Rounds' },
  { href: '/insights', label: 'Insights' },
  { href: '/trends', label: 'Trends' },
  { href: '/rounds/new', label: 'New round' },
  { href: '/courses', label: 'Courses' },
];

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="text-gray-900">
        <nav className="border-b bg-white sticky top-0 z-10 overflow-x-auto">
          <ul className="flex gap-4 px-3 py-2 max-w-3xl mx-auto text-sm font-medium whitespace-nowrap">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <Link className="text-blue-700 hover:underline" href={link.href}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        {children}
      </body>
    </html>
  );
}
