import { requirePageUser } from '@/lib/auth/session';
import { isConfigured } from '@/lib/voice/transcribe';
import { VoiceRecorder } from './recorder';

export const dynamic = 'force-dynamic';

/**
 * Voice test bench (step 1 of voice round entry): does speech-to-text actually hear golf?
 * Say a hole out loud, read back what came out. Nothing is saved to a round from here.
 */
export default async function VoicePage() {
  await requirePageUser();
  const serverReady = isConfigured();

  return (
    <main className="mx-auto max-w-lg space-y-5 p-4 sm:p-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Voice test</h1>
        <p className="text-sm text-ink-2">
          Tap the button, say a hole the way you&apos;d say it to a mate, then tap Stop. This only shows what was heard — it
          doesn&apos;t log anything yet.
        </p>
      </div>

      <VoiceRecorder serverReady={serverReady} />

      <section className="space-y-3 rounded-xl border bg-card p-4">
        <div>
          <h2 className="font-semibold">How to say it</h2>
          <p className="text-xs text-muted">
            Say where each shot was played <strong>from</strong>. The app already knows where the last one finished, so
            that&apos;s all it needs.
          </p>
        </div>

        <ol className="space-y-2 text-sm">
          <li className="rounded-lg bg-paper p-3">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Start</span>
            <p className="font-medium">&ldquo;Hole four, par four.&rdquo;</p>
          </li>
          <li className="rounded-lg bg-paper p-3">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Each shot after the tee</span>
            <p className="font-medium">&ldquo;Second shot, 157 yards from the fairway, left.&rdquo;</p>
            <p className="text-xs text-muted">&ldquo;Third, 20 feet on the green.&rdquo;</p>
          </li>
          <li className="rounded-lg bg-paper p-3">
            <span className="font-mono text-[11px] uppercase tracking-wide text-muted">Finish</span>
            <p className="font-medium">&ldquo;Two putts.&rdquo; or &ldquo;Holed it.&rdquo;</p>
          </li>
        </ol>

        <div className="space-y-1 rounded-lg border border-line-strong bg-paper p-3">
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">A whole hole</p>
          <p className="text-sm">
            &ldquo;Hole four, par four. Second shot, 157 yards from the fairway, left. Third, 20 feet on the green. Two
            putts.&rdquo;
          </p>
        </div>

        <ul className="space-y-1.5 text-sm text-ink-2">
          <li>
            <strong>Number every shot.</strong> &ldquo;Second&rdquo;, &ldquo;third&rdquo;, &ldquo;fourth&rdquo; — if one goes
            missing, the app can tell, rather than quietly logging a wrong score.
          </li>
          <li>
            <strong>Always say the unit.</strong> &ldquo;157 <em>yards</em>&rdquo;, &ldquo;20 <em>feet</em>&rdquo;. A bare
            number is the single hardest thing for any recogniser to get right.
          </li>
          <li>
            <strong>Say the lie.</strong> Fairway, rough, bunker, green, or trees. Add a side if you like —
            &ldquo;left&rdquo;, &ldquo;long&rdquo; — and it&apos;s recorded as your miss.
          </li>
          <li>
            <strong>Penalties out loud.</strong> &ldquo;In the water, dropped&rdquo; or &ldquo;out of bounds,
            reloaded&rdquo;.
          </li>
        </ul>

        <p className="text-xs text-muted">
          You don&apos;t have to say it this way — it just makes the numbers and lies far more likely to survive.
        </p>
      </section>

    </main>
  );
}
