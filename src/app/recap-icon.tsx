import Link from 'next/link';

/** Film strip with a play triangle — the "watch the recap" mark. Inherits the text colour. */
export function ReelIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2.75" y="3.75" width="18.5" height="16.5" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7.25 3.75v16.5M16.75 3.75v16.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M2.75 8h4.5M2.75 12h4.5M2.75 16h4.5M16.75 8h4.5M16.75 12h4.5M16.75 16h4.5"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M10.4 9.3v5.4l4.2-2.7-4.2-2.7Z" fill="currentColor" />
    </svg>
  );
}

/** The round's recap, as an icon button (44px touch target) with a text label for screen readers. */
export function RecapIconLink({ roundId, className = '' }: { roundId: number; className?: string }) {
  return (
    <Link
      href={`/rounds/${roundId}/recap`}
      aria-label="Watch the round recap"
      title="Round recap"
      className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong bg-paper text-ink hover:bg-ink hover:text-paper ${className}`}
    >
      <ReelIcon size={22} />
    </Link>
  );
}
