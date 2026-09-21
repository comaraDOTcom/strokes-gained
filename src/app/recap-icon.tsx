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
