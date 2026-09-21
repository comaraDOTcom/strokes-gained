/**
 * Email the admin. Optional: does nothing unless RESEND_API_KEY is set (resend.com — the free
 * tier can send to the account owner's own address from onboarding@resend.dev with no domain
 * setup, which is exactly this use). NEVER throws: a notification failing must not fail the
 * action that triggered it — the request is already saved and shows in the admin's Courses page.
 */
export async function notifyAdmin(subject: string, text: string): Promise<'sent' | 'skipped' | 'failed'> {
  const key = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  if (!key || !to) return 'skipped';
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.NOTIFY_FROM ?? 'Strokes Gained <onboarding@resend.dev>',
        to: [to],
        subject,
        text,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error(`[notify] Resend responded ${res.status}`);
      return 'failed';
    }
    return 'sent';
  } catch (err) {
    console.error('[notify] failed:', err instanceof Error ? err.message : err);
    return 'failed';
  }
}
