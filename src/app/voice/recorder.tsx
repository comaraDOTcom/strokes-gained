'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tap to start, tap to stop. NOT hold-to-talk: on iOS a long press on any element starts text
 * selection, which put a selection highlight and the "done" callout bubble over the button. Tap
 * to toggle also survives a finger sliding off mid-sentence.
 *
 * It is still explicit capture — the mic only runs between the two taps, never open.
 *
 * Two routes to text, tried in order:
 *  1. the server (Cloudflare Whisper) — accurate, needs a key and a signal;
 *  2. the browser's own recogniser — free and instant, on-device on iOS, but can't be nudged
 *     towards golf words. Used when the server isn't configured, so this is testable today.
 */

const MAX_SECONDS = 45;

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
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
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
  const [state, setState] = useState<'idle' | 'listening' | 'working'>('idle');
  /** A problem worth a red box (permission, no support). */
  const [error, setError] = useState<string | null>(null);
  /** "Didn't catch that" — expected, not alarming. */
  const [nothing, setNothing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [canRecord, setCanRecord] = useState(true);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const asrRef = useRef<SpeechRecognitionLike | null>(null);
  const gotResultRef = useRef(false);

  useEffect(() => {
    const recorder = typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
    setCanRecord(recorder || speechRecognition() !== null);
  }, []);

  // Timer while listening, with a hard stop so a forgotten tap can't record all afternoon.
  useEffect(() => {
    if (state !== 'listening') return;
    const id = setInterval(() => {
      const s = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) stop();
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const add = useCallback(
    (a: Omit<Attempt, 'id'>) => setAttempts((prev) => [{ ...a, id: Date.now() }, ...prev].slice(0, 20)),
    [],
  );

  async function sendToServer(blob: Blob, seconds: number) {
    setState('working');
    const started = performance.now();
    try {
      const res = await fetch('/api/voice/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': blob.type || 'application/octet-stream' },
        body: blob,
      });
      const data = (await res.json()) as { text?: string; error?: string; reason?: string };
      if (!res.ok || !data.text) {
        if (data.reason === 'empty') setNothing(true);
        else setError(data.error ?? 'Transcription failed.');
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
    asr.continuous = true; // keep listening through the pauses between shots
    asr.interimResults = false;
    asr.maxAlternatives = 1;
    gotResultRef.current = false;
    asrRef.current = asr;
    startedAtRef.current = Date.now();
    setState('listening');

    asr.onresult = (e) => {
      const text = e.results[0][0].transcript.trim();
      if (!text) return;
      gotResultRef.current = true;
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      add({ text, source: 'browser', seconds, bytes: null, ms: Math.round(seconds * 1000) });
    };
    asr.onerror = (e) => {
      // "aborted" just means we stopped it, and "no-speech" means it heard nothing — neither is a fault.
      if (e.error === 'aborted' || e.error === 'no-speech') return;
      setError(
        e.error === 'not-allowed'
          ? 'Microphone permission was refused. Allow it in Settings, then try again.'
          : e.error === 'network'
            ? 'Speech recognition needs a connection on this browser.'
            : `Recognition failed (${e.error ?? 'unknown'}).`,
      );
    };
    asr.onend = () => {
      asrRef.current = null;
      if (!gotResultRef.current) setNothing(true);
      setState('idle');
    };
    asr.start();
  }

  async function start() {
    setError(null);
    setNothing(false);
    setElapsed(0);
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
          setNothing(true);
          setState('idle');
          return;
        }
        void sendToServer(blob, seconds);
      };
      recorderRef.current = rec;
      startedAtRef.current = Date.now();
      rec.start();
      setState('listening');
    } catch {
      setError('Microphone permission was refused. Allow it in Settings, then try again.');
      setState('idle');
    }
  }

  function stop() {
    if (asrRef.current) {
      asrRef.current.stop(); // stop, never abort: stop still delivers what it heard
      return;
    }
    const rec = recorderRef.current;
    if (rec && rec.state === 'recording') rec.stop();
    recorderRef.current = null;
  }

  const listening = state === 'listening';
  const label = listening ? 'Stop' : state === 'working' ? 'Transcribing…' : 'Tap to speak';

  return (
    <div className="space-y-4">
      <button
        type="button"
        disabled={state === 'working' || !canRecord}
        onClick={() => (listening ? stop() : void start())}
        onContextMenu={(e) => e.preventDefault()}
        style={{ WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: 'manipulation' }}
        className={`w-full touch-manipulation select-none rounded-2xl py-9 text-lg font-semibold transition-colors ${
          listening
            ? 'bg-accent-soft text-ink ring-2 ring-accent'
            : state === 'working'
              ? 'bg-paper-2 text-muted'
              : 'bg-ink text-paper'
        }`}
      >
        <span className="flex items-center justify-center gap-3">
          {listening && <span className="h-3 w-3 animate-pulse rounded-full bg-neg" aria-hidden="true" />}
          {label}
          {listening && <span className="font-mono text-base tabular-nums text-ink-2">{elapsed.toFixed(0)}s</span>}
        </span>
      </button>

      <p className="text-xs text-muted">
        {listening
          ? 'Listening. Say the hole, then tap Stop.'
          : serverReady
            ? 'Recorded here, transcribed on the server, then the audio is thrown away — nothing is stored.'
            : 'Using your browser’s own speech recognition (no server key set). On an iPhone this runs on the phone itself.'}
      </p>

      {error && <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg">{error}</p>}
      {nothing && !error && (
        <p className="rounded-lg bg-paper-2 px-3 py-2 text-sm text-ink-2">
          Didn’t catch anything. Tap again and speak a little closer to the phone.
        </p>
      )}
      {!canRecord && <p className="rounded-lg bg-neg-soft px-3 py-2 text-sm text-neg">This browser can’t record audio.</p>}

      {attempts.length > 0 && (
        <ul className="space-y-2">
          {attempts.map((a) => (
            <li key={a.id} className="rounded-lg border bg-paper p-3">
              <p className="text-base">{a.text}</p>
              <p className="mt-1 font-mono text-[11px] text-muted">
                {a.source} · {a.seconds.toFixed(1)}s
                {a.bytes !== null && ` · ${(a.bytes / 1024).toFixed(0)}KB`} · {a.ms}ms
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
