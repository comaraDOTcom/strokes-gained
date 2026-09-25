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

      <section className="space-y-2 rounded-xl border bg-card p-4">
        <h2 className="font-semibold">Try these</h2>
        <ul className="space-y-1 text-sm text-ink-2">
          <li>&ldquo;Driver into the left rough, 150 left, eight iron to twenty feet, two putts.&rdquo;</li>
          <li>&ldquo;Drove it 250 down the fairway, seven iron to 15 feet, one putt.&rdquo;</li>
          <li>&ldquo;Tee shot in the bunker, splashed out to 40 yards, wedge to six feet, holed it.&rdquo;</li>
        </ul>
        <p className="text-xs text-muted">
          What matters is whether the <strong>numbers</strong> and the <strong>lies</strong> come back right — the rest
          of the words don&apos;t affect your stats.
        </p>
      </section>
    </main>
  );
}
