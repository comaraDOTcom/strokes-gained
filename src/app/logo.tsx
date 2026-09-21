/**
 * The app mark: a gold flag beside strokes-gained bars — red below the line (strokes
 * lost), green above (strokes gained) — on the ink tile. Same drawing as
 * `src/app/icon.svg` (the browser-tab favicon) so the nav, login page and tab match.
 */
export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Strokes Gained" className={className}>
      <rect width="64" height="64" rx="14" fill="#16221c" />
      <rect x="21" y="39" width="38" height="2" rx="1" fill="#f3f2ea" opacity=".4" />
      <rect x="24" y="40" width="8" height="12" rx="1.5" fill="#c9503a" />
      <rect x="36" y="28" width="8" height="12" rx="1.5" fill="#3a9a63" />
      <rect x="48" y="16" width="8" height="24" rx="1.5" fill="#3a9a63" />
      <rect x="10" y="9" width="6" height="45" rx="2.2" fill="#f3f2ea" />
      <path d="M16 9 L34 16 L16 23 Z" fill="#e9b940" />
    </svg>
  );
}
