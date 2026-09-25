import Link from 'next/link';

/**
 * The Rounds page for a player with no rounds anywhere: a three-step start rather than an empty
 * list, with the welcome tour one tap away for anyone who skipped it.
 */
export function GettingStarted({ name }: { name: string }) {
  const first = name.trim().split(/\s+/)[0] || 'there';
  const steps = [
    {
      title: 'Check your course is in the library',
      text: 'Pick it on Courses. If it isn’t there, request it and it’ll be added for you.',
      href: '/courses',
      cta: 'Courses',
    },
    {
      title: 'Log your first round',
      text: 'Per shot: where it finished, how far to the hole, and Holed when it drops. Start with Brief. About ten seconds a hole.',
      href: '/rounds/new',
      cta: 'New round',
    },
    {
      title: 'Watch the recap',
      text: 'Your score, strokes gained against scratch, your strongest area and the one to work on. One round is enough to start.',
      href: null,
      cta: null,
    },
  ];
  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-5" aria-label="Getting started">
      <div>
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">Getting started</p>
        <h2 className="text-xl font-semibold">Hi {first}. Three steps to your first numbers.</h2>
      </div>
      <ol className="space-y-2">
        {steps.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-2 rounded-xl border bg-paper p-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-sm text-paper">{i + 1}</span>
            <div className="min-w-0">
              <p className="font-medium">{s.title}</p>
              <p className="mt-0.5 text-sm text-ink-2">{s.text}</p>
              {s.href && s.cta && (
                <Link
                  href={s.href}
                  className={`mt-2 inline-block rounded-lg px-3 py-1.5 text-sm font-medium ${
                    i === 1 ? 'bg-ink text-paper' : 'border border-line-strong text-ink'
                  }`}
                >
                  {s.cta}
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="text-sm text-ink-2">
        New to strokes gained?{' '}
        <Link href="/welcome?again=1" className="underline underline-offset-2">
          Take the two-minute welcome tour
        </Link>
        {' · '}
        <Link href="/learn" className="underline underline-offset-2">
          Learn how the numbers work
        </Link>
      </p>
    </section>
  );
}
