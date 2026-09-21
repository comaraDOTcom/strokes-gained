import Link from 'next/link';
import { notFound } from 'next/navigation';
import { requirePageUser } from '@/lib/auth/session';
import { getPlayers } from '@/lib/insights/queries';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const me = await requirePageUser();
  if (!me.isAdmin) notFound(); // the player list is admin-only
  const players = await getPlayers();

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Players</h1>
      <p className="text-sm text-ink-2">
        Admin only. Everyone who has joined; you can open their rounds read-only (scores and strokes gained —
        never their notes or ratings). Players can&apos;t see each other.
      </p>
      <ul className="space-y-2">
        {players.map((p) => (
          <li key={p.userId}>
            <Link
              href={p.userId === me.id ? '/' : `/players/${p.userId}`}
              className="flex items-center justify-between border rounded-xl bg-card px-4 py-3 hover:bg-paper-2"
            >
              <span className="font-medium">
                {p.name}
                {p.userId === me.id && <span className="text-muted font-normal"> (you)</span>}
              </span>
              <span className="font-mono text-xs text-muted">
                {p.roundCount} round{p.roundCount === 1 ? '' : 's'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
