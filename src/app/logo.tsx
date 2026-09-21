/**
 * The app mark: a terracotta flag on a green, on the ink tile. Same drawing as
 * `src/app/icon.svg` (the browser-tab favicon) so the nav, login page and tab match.
 */
export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label="Strokes Gained"
      className={className}
    >
      <rect width="64" height="64" rx="14" fill="#16221c" />
      <ellipse cx="32" cy="50" rx="17" ry="5" fill="#2d7a4f" />
      <rect x="29" y="12" width="6.5" height="38" rx="2.4" fill="#f3f2ea" />
      <path d="M35.5 12 L52.5 19.5 L35.5 27 Z" fill="#b5432b" />
    </svg>
  );
}
