import type { MetadataRoute } from 'next';
import { BRAND_NAME, BRAND_SHORT } from '@/lib/brand';

/**
 * Web app manifest, so "Add to Home Screen" (iOS Safari) / "Install app" (Android Chrome) gives a
 * full-screen app with our icon, opening on Rounds. Served at /manifest.webmanifest; the auth
 * middleware lets it through (a home-screen install fetches it without a session).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_SHORT,
    description: 'Log every shot; see where the strokes went, against a scratch golfer.',
    start_url: '/',
    display: 'standalone',
    background_color: '#f2ebdc',
    theme_color: '#fbf7ee',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
  };
}
