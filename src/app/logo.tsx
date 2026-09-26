/**
 * The Better Than Most mark: "BTM" in IBM Plex Mono SemiBold, gold-light on a forest-green disc
 * (the landing page's nav mark, docs/brand/landing.html). The letters are outlines, not text, so
 * the favicon and the rasterised PWA icons look the same without the font installed. Same drawing
 * as `src/app/icon.svg`; `public/icon-*.png` and `src/app/apple-icon.png` are rasterised from it
 * by `scripts/make-pwa-icons.sh`. Keep all of them in sync.
 */
const BTM_PATH =
  'M11.1 23.28H17.17Q19.65 23.28 20.99 24.51Q22.32 25.75 22.32 27.88Q22.32 29.38 21.59 30.27Q20.85 31.18 19.5 31.58V31.7Q21.07 32.08 21.99 33.06Q22.9 34.05 22.9 35.85Q22.9 36.95 22.54 37.84Q22.17 38.73 21.51 39.38Q20.85 40.02 19.91 40.38Q18.97 40.73 17.8 40.73H11.1ZM16.8 38.35Q18.17 38.35 18.86 37.84Q19.55 37.33 19.55 36.08V35.25Q19.55 34.02 18.86 33.51Q18.17 33 16.8 33H14.3V38.35ZM16.38 30.73Q17.7 30.73 18.34 30.25Q18.97 29.77 18.97 28.6V27.77Q18.97 26.6 18.34 26.12Q17.7 25.65 16.38 25.65H14.3V30.73ZM33.22 25.98V40.73H29.97V25.98H24.72V23.28H38.47V25.98ZM50.05 32.65 50.2 27.6H49.97L46.6 36.58L43.22 27.6H43L43.15 32.65V40.73H40.3V23.28H44.2L46.62 29.7H46.8L49.25 23.28H52.9V40.73H50.05Z';

export function Logo({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Better Than Most" className={className}>
      <circle cx="32" cy="32" r="32" fill="#144433" />
      <path fill="#E7D6AE" d={BTM_PATH} />
    </svg>
  );
}

/** Mark plus the name, set in the display face, as in the landing page's nav. */
export function Wordmark({ size = 28, className = '' }: { size?: number; className?: string }) {
  return (
    <span className={`flex items-center gap-2.5 ${className}`}>
      <Logo size={size} />
      <span className="font-display font-semibold text-[1.15em] leading-none tracking-[-0.01em]">Better Than Most</span>
    </span>
  );
}
