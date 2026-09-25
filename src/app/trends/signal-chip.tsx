import type { SignalStrength } from '@/lib/insights/signal';

const SIGNAL_STYLE: Record<SignalStrength, string> = {
  signal: 'bg-accent-soft text-accent',
  limited: 'bg-amber-100 text-amber-800',
  noise: 'bg-paper-2 text-ink-2',
};

const SIGNAL_LABEL: Record<SignalStrength, { long: string; short: string }> = {
  signal: { long: 'signal', short: 'signal' },
  limited: { long: 'limited data', short: 'limited data' },
  noise: { long: 'noise — too few shots to read anything into this', short: 'too few shots' },
};

/** How much to trust a change: signal / limited data / noise. Shared by the trend and roadmap sections. */
export function SignalChip({ signal, short = false }: { signal: SignalStrength; short?: boolean }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${SIGNAL_STYLE[signal]}`}>
      {short ? SIGNAL_LABEL[signal].short : SIGNAL_LABEL[signal].long}
    </span>
  );
}
