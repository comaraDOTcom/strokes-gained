import Link from 'next/link';
import { requirePageUser } from '@/lib/auth/session';
import { getPlayers } from '@/lib/insights/queries';

export const dynamic = 'force-dynamic';

export default async function PlayersPage() {
  const me = await requirePageUser();
  const players = await getPlayers();

  return (
    <main className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Players</h1>
      <p className="text-sm text-ink-2">
        Everyone in the group. You can see each other&apos;s scores and strokes gained — never notes or ratings.
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
