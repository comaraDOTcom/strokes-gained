/**
 * Speech to text for dictating a round.
 *
 * The audio goes to Cloudflare Workers AI (`@cf/openai/whisper-large-v3-turbo`) over plain REST.
 * Why Cloudflare: the free allowance is ~3.5 audio-hours a DAY and renews daily, and Cloudflare
 * states it neither trains on nor stores what you send. Ten players logging two rounds a week uses
 * roughly 9% of one day's allowance.
 *
 * NEVER store the audio. The transcript is the only thing that comes back out of here, and the
 * caller is expected to persist that (or nothing at all) — a clip of someone's voice is the most
 * personal thing this app could hold and it has no use after the words are out.
 *
 * Environment:
 *   CF_ACCOUNT_ID   Cloudflare account id
 *   CF_API_TOKEN    scoped token with Workers AI Read + Edit
 * Without them `transcribeAudio` returns `{ ok: false, reason: 'not-configured' }` so the UI can
 * offer the browser's own recogniser instead of failing.
 */

const MODEL = '@cf/openai/whisper-large-v3-turbo';

export type TranscribeResult =
  | { ok: true; text: string; model: string }
  | { ok: false; reason: 'not-configured' | 'too-large' | 'empty' | 'failed'; detail?: string };

/** Cloudflare doesn't document a ceiling; its own chunking guide slices at ~1MB, so refuse above that. */
export const MAX_AUDIO_BYTES = 1_000_000;
/** Shorter than this and there's no speech in it — and Whisper invents words when given silence. */
const MIN_AUDIO_BYTES = 1_000;

export function isConfigured(): boolean {
  return Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN);
}

/**
 * Whisper transcribes silence into plausible sentences ("Thank you.", "Bye."), a documented failure
 * mode rather than a quirk — roughly 1% of segments in one study. Drop the known stock phrases so a
 * mis-tap can't invent a shot out of nothing.
 */
const HALLUCINATED_SILENCE = [
  'thank you', 'thanks for watching', 'thank you for watching', 'bye', 'bye bye', 'you',
  'subscribe', 'please subscribe', 'music', 'applause', 'silence', 'okay', 'ok',
];

export function isProbablySilence(text: string): boolean {
  const cleaned = text
    .toLowerCase()
    .replace(/[.,!?¡¿'"]/g, '')
    .replace(/\[.*?\]|\(.*?\)/g, '')
    .trim();
  if (cleaned.length === 0) return true;
  return HALLUCINATED_SILENCE.includes(cleaned);
}

/** Tidy the raw transcript without changing any word: trim, collapse whitespace, drop stray brackets. */
export function cleanTranscript(raw: string): string {
  return raw
    .replace(/\[(?:music|applause|silence|laughter|inaudible)\]/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Send one clip. `audio` is the raw bytes of whatever the browser recorded (webm/opus, m4a, wav).
 * Errors never throw: a failed transcription must not take down the request that asked for it.
 */
export async function transcribeAudio(audio: ArrayBuffer | Uint8Array): Promise<TranscribeResult> {
  const accountId = process.env.CF_ACCOUNT_ID;
  const token = process.env.CF_API_TOKEN;
  if (!accountId || !token) return { ok: false, reason: 'not-configured' };

  const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio);
  if (bytes.byteLength < MIN_AUDIO_BYTES) return { ok: false, reason: 'empty' };
  if (bytes.byteLength > MAX_AUDIO_BYTES) return { ok: false, reason: 'too-large' };

  try {
    const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/octet-stream' },
      body: bytes as unknown as BodyInit,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      // Never log the body: it can echo the audio payload back.
      console.error(`[voice] Cloudflare responded ${res.status}`);
      return { ok: false, reason: 'failed', detail: `upstream ${res.status}` };
    }
    const body = (await res.json()) as { result?: { text?: string }; success?: boolean };
    const text = cleanTranscript(body.result?.text ?? '');
    if (!text || isProbablySilence(text)) return { ok: false, reason: 'empty' };
    return { ok: true, text, model: MODEL };
  } catch (err) {
    console.error('[voice] transcription failed:', err instanceof Error ? err.message : err);
    return { ok: false, reason: 'failed' };
  }
}
