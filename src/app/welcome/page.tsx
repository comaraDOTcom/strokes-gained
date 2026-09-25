/**
 * The welcome tour: where a new player lands after signing in. Five short screens — why strokes
 * gained, how a shot is scored (the real engine's numbers), how to log a round, what comes back,
 * and putting the app on the phone's home screen — then straight into their first round.
 *
 * Shown unasked only to a player with no rounds who hasn't skipped it in this browser; anyone can
 * reopen it from Learn (`?again=1`).
 */
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { count, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { courses, rounds } from '@/db/schema';
import { requirePageUser } from '@/lib/auth/session';
import { buildTour } from '@/lib/learn/tour';
import { WELCOME_COOKIE, greeting, shouldShowWelcome } from '@/lib/learn/onboarding';
import { WelcomeTour } from './welcome-tour';

export const dynamic = 'force-dynamic';

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ again?: string }> }) {
  const user = await requirePageUser();
  const { again } = await searchParams;
  const [[mine], [library], jar] = await Promise.all([
    db.select({ n: count() }).from(rounds).where(eq(rounds.userId, user.id)),
    db.select({ n: count() }).from(courses),
    cookies(),
  ]);
  const hasRounds = (mine?.n ?? 0) > 0;
  if (!shouldShowWelcome({ hasRounds, welcomed: jar.get(WELCOME_COOKIE)?.value === '1', again: again === '1' })) {
    redirect('/');
  }

  return (
    <main className="mx-auto w-full max-w-lg p-3 sm:p-6">
      <WelcomeTour greeting={greeting(user.name)} tour={buildTour()} hasRounds={hasRounds} courseCount={library?.n ?? 0} />
    </main>
  );
}
