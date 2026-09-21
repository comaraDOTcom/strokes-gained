import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth/session';
import { GoogleButton, TestLoginForm } from './login-forms';
import { Logo } from '../logo';

export const dynamic = 'force-dynamic';

const testMode = process.env.AUTH_TEST_MODE === '1' && process.env.NODE_ENV !== 'production';

function messageFor(error: string | undefined): string | null {
  if (!error) return null;
  if (error === 'bad_invite') return 'That invite link isn’t valid any more. Ask Conor for a fresh one.';
  // Better Auth reports a rejected sign-up (our invite gate) as a user-creation failure.
  if (/create|signup|sign_up|forbidden/i.test(error)) {
    return 'You need an invite link to join. Ask Conor to send you one, then open it and sign in again.';
  }
  return 'Sign-in didn’t work. Try again.';
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; invited?: string }>;
}) {
  if (await getSessionUser()) redirect('/');
  const { error, invited } = await searchParams;
  const message = messageFor(error);

  return (
    <main className="golf-scene flex-1 px-4 pt-10 sm:pt-16 pb-72">
      <div className="max-w-sm mx-auto space-y-6 rounded-2xl border bg-card/95 backdrop-blur-sm p-6 shadow-sm">
        <div className="space-y-3">
          <Logo size={44} />
          <h1 className="text-3xl font-semibold leading-tight">Every shot, scored against a scratch baseline.</h1>
          <p className="text-ink-2">
            Log your rounds shot by shot and see where practice actually pays off.
          </p>
        </div>

        {invited && (
          <p className="text-sm rounded-lg bg-pos-soft text-pos px-3 py-2">You’re invited — sign in with Google to join.</p>
        )}
        {message && <p className="text-sm rounded-lg bg-neg-soft text-neg px-3 py-2">{message}</p>}

        <GoogleButton label={invited ? 'Join with Google' : 'Continue with Google'} />
        {testMode && <TestLoginForm />}

        <p className="text-xs text-muted">
          Alpha, invite-only. Your rounds are private to you. Other players can&apos;t see them; the organiser can see
          scores and strokes gained to help with feedback, but never your notes.
        </p>
      </div>
    </main>
  );
}
