'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hold to record, release to transcribe. Push-to-talk on purpose: it captures only speech you
 * meant to say, which keeps clips short, keeps the battery cost near zero, and avoids feeding
 * Whisper silence (which it answers with invented sentences).
 *
 * Two routes to text, tried in order:
 *  1. the server (Cloudflare Whisper) — accurate, needs a key and a signal;
 *  2. the browser's own recogniser — free and instant, on-device on iOS, but can't be nudged
 *     towards golf words. Used when the server isn't configured, so this is testable today.
 */

type Attempt = {
  id: number;
  text: string;
  source: 'server' | 'browser';
  seconds: number;
  bytes: number | null;
  ms: number;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
};

function speechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** Safari records mp4, everything else webm/opus. */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const t of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return undefined;
}

export function VoiceRecorder({ serverReady }: { serverReady: boolean }) {
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [supported, setSupported] = useState<{ recorder: boolean; browserAsr: boolean } | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const asrRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported({
      recorder: typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
      browserAsr: speechRecognition() !== null,
    });
  }, []);

  const add = useCallback((a: Omit<Attempt, 'id'>) => setAttempts((prev) => [{ ...a, id: Date.now() }, ...prev].slice(0, 20)), []);

  async function sendToServer(blob: Blob, seconds: number) {
    setState('working');
    const started = performance.now();
    try {
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || !data.text) {
        setError(data.error ?? 'Transcription failed.');
        return;
      }
      add({ text: data.text, source: 'server', seconds, bytes: blob.size, ms: Math.round(performance.now() - started) });
    } catch {
      setError('Could not reach the server. Are you offline?');
    } finally {
      setState('idle');
    }
  }

  /** The browser's own recogniser: no upload, no clip — it listens live and hands back words. */
  function listenInBrowser() {
    const asr = speechRecognition();
    if (!asr) {
      setError('This browser has no speech recognition.');
      return;
    }
    asr.lang = 'en-IE';
    asr.continuous = false;
    asr.interimResults = false;
    asr.maxAlternatives = 1;
    const started = performance.now();
    asrRef.current = asr;
    setError(null);
    setState('recording');

    asr.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      if (text) add({ text, source: 'browser', seconds: (performance.now() - started) / 1000, bytes: null, ms: Math.round(performance.now() - started) });
    };
    asr.onerror = (e) => setError(e.error === 'not-allowed' ? 'Microphone permission was refused.' : `Recognition failed (${e.error ?? 'unknown'}).`);
    asr.onend = () => {
      asrRef.current = null;
      setState('idle');
    };
    asr.start();
  }

  async function startRecording() {
    setError(null);
    if (!serverReady) return listenInBrowser();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // Wind is the enemy outdoors; let the OS clean up what it can at the capture stage.
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true },
      });
      const mimeType = pickMimeType();
      const rec = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const seconds = (Date.now() - startedAtRef.current) / 1000;
        const blob = new Blob(chunksRef.current, { type: rec.mimeType });
        if (blob.size < 1000) {
          setError('That was too short to hear anything.');
          setState('idle');
          return;
        }
        void sendToServer(blob, seconds);
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setState('recording');
    } catch {
      setError('Microphone permission was refused.');
      setState('idle');
    }
  }

  function stopRecording() {
    if (asrRef.current) {
      asrRef.current.stop();
      return;
    }
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    recorderRef.current = null;
  }

  const holding = state === 'recording';

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={state === 'working'}
        onPointerDown={(e) => {
          e.preventDefault();
          void startRecording();
        }}
        onPointerUp={() => stopRecording()}
        onPointerLeave={() => holding && stopRecording()}
        className={`w-full rounded-2xl py-10 text-lg font-semibold transition-colors ${
          holding ? 'bg-neg text-paper' : state === 'working' ? 'bg-paper-2 text-muted' : 'bg-ink text-paper'
        }`}
      >
        {holding ? 'Listening — release when done' : state === 'working' ? 'Transcribing…' : 'Hold to speak'}
      </button>

      <p className="text-xs text-muted">
        {serverReady
          ? 'Recorded here, transcribed on the server, then the audio is thrown away — nothing is stored.'
          : 'Using your browser’s own speech recognition (no server key set). On an iPhone this runs on the phone itself.'}
      </p>

      {error && <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}

      {supported && !supported.recorder && !supported.browserAsr && (
        <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg">This browser can’t record audio at all.</p>
      )}

      {attempts.length > 0 && (
        <ul className="space-y-2">
          {attempts.map((a) => (
            <li key={a.id} className="rounded-lg border bg-paper p-3">
              <p className="text-base">{a.text}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {a.source === 'server' ? 'server' : 'browser'} · {a.seconds.toFixed(1)}s spoken
                {a.bytes !== null && ` · ${(a.bytes / 1024).toFixed(0)}KB`} · {a.ms}ms
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
