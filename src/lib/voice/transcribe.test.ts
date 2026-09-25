import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanTranscript, isConfigured, isProbablySilence, transcribeAudio, MAX_AUDIO_BYTES } from './transcribe';

const clip = (bytes: number) => new Uint8Array(bytes).fill(1);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function configure() {
  vi.stubEnv('CF_ACCOUNT_ID', 'acct');
  vi.stubEnv('CF_API_TOKEN', 'token');
}

describe('isProbablySilence', () => {
  it('catches the phrases Whisper invents when it hears nothing', () => {
    for (const s of ['Thank you.', 'thanks for watching', 'Bye!', '[music]', '  ', 'you']) {
      expect(isProbablySilence(s), s).toBe(true);
    }
  });

  it('keeps anything that could be a real shot', () => {
    for (const s of ['Driver to the fairway', 'two putts', 'Eight iron, 150 left']) {
      expect(isProbablySilence(s), s).toBe(false);
    }
  });
});

describe('cleanTranscript', () => {
  it('tidies whitespace and drops sound tags without touching the words', () => {
    expect(cleanTranscript('  Driver  [music] to the   fairway ')).toBe('Driver to the fairway');
  });
});

describe('transcribeAudio', () => {
  it('says so when no key is configured, instead of failing the request', async () => {
    expect(isConfigured()).toBe(false);
    expect(await transcribeAudio(clip(5000))).toEqual({ ok: false, reason: 'not-configured' });
  });

  it('refuses a clip that is too short to contain speech, without calling out', async () => {
    configure();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await transcribeAudio(clip(10))).toEqual({ ok: false, reason: 'empty' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('refuses a clip over the size ceiling', async () => {
    configure();
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await transcribeAudio(clip(MAX_AUDIO_BYTES + 1))).toEqual({ ok: false, reason: 'too-large' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns the transcript, and sends the audio as bytes with the token', async () => {
    configure();
    const fetchSpy = vi.fn(
      async (_url: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ success: true, result: { text: '  Driver to the   fairway ' } }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);

    const res = await transcribeAudio(clip(5000));
    expect(res).toMatchObject({ ok: true, text: 'Driver to the fairway' });

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(String(url)).toContain('/accounts/acct/ai/run/@cf/openai/whisper-large-v3-turbo');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' });
  });

  it('treats an invented-silence transcript as empty', async () => {
    configure();
    vi.stubGlobal('fetch', async () => new Response(JSON.stringify({ result: { text: 'Thank you.' } }), { status: 200 }));
    expect(await transcribeAudio(clip(5000))).toEqual({ ok: false, reason: 'empty' });
  });

  it('never throws when the upstream fails', async () => {
    configure();
    vi.stubGlobal('fetch', async () => new Response('nope', { status: 500 }));
    expect(await transcribeAudio(clip(5000))).toMatchObject({ ok: false, reason: 'failed' });

    vi.stubGlobal('fetch', async () => {
      throw new Error('network down');
    });
    expect(await transcribeAudio(clip(5000))).toEqual({ ok: false, reason: 'failed' });
  });
});
