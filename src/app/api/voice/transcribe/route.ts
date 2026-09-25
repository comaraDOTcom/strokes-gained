/**
 * POST one audio clip, get its transcript back. Signed-in players only.
 *
 * The clip is transcribed and thrown away — it is never written to disk or to the database.
 * One clip per request: Vercel functions are capped at 60s, and a per-hole clip is a couple of
 * seconds, so there's no reason to batch.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireApiUser, toErrorResponse } from '@/lib/auth/guards';
import { MAX_AUDIO_BYTES, isConfigured, transcribeAudio } from '@/lib/voice/transcribe';

const MESSAGES: Record<string, string> = {
  'not-configured': 'Voice transcription isn’t set up on the server yet.',
  'too-large': 'That recording is too long — record one hole at a time.',
  empty: 'Didn’t catch anything. Try again, closer to the mic.',
  failed: 'Transcription failed. Try again.',
};

export async function POST(req: NextRequest) {
  try {
    await requireApiUser();
  } catch (e) {
    return toErrorResponse(e);
  }

  if (!isConfigured()) {
    return NextResponse.json({ error: MESSAGES['not-configured'], reason: 'not-configured' }, { status: 503 });
  }

  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (contentLength > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: MESSAGES['too-large'], reason: 'too-large' }, { status: 413 });
  }

  const audio = await req.arrayBuffer();
  const started = Date.now();
  const result = await transcribeAudio(audio);
  const ms = Date.now() - started;

  if (!result.ok) {
    const status = result.reason === 'too-large' ? 413 : result.reason === 'empty' ? 422 : 502;
    return NextResponse.json({ error: MESSAGES[result.reason] ?? 'Transcription failed.', reason: result.reason }, { status });
  }

  // Timing only — never the words, and never the audio.
  console.log(`[voice] transcribed ${audio.byteLength}B in ${ms}ms`);
  return NextResponse.json({ text: result.text, ms });
}
