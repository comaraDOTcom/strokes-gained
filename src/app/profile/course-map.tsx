'use client';

import { useEffect, useRef } from 'react';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { DirectoryCourse } from '@/lib/directory/build';
import { CHROME, DIVERGING } from '@/lib/insights/chart-colors';

/** Island of Ireland, with a little sea around it. */
const IRELAND_BOUNDS: [[number, number], [number, number]] = [
  [51.35, -10.7],
  [55.45, -5.35],
];

export type MapCourse = DirectoryCourse & {
  played: boolean;
  ticked: boolean;
  rounds: number;
  /** Position in the top-100 ranking, or null. */
  rank: number | null;
};

/** Gold ring = in the top 100 (the eagle colour from globals.css). */
const TOP100_RING = '#e9b31c';

const style = (c: Pick<MapCourse, 'played' | 'rank'>) => {
  const ranked = c.rank !== null;
  return c.played
    ? { radius: ranked ? 8 : 7, color: ranked ? TOP100_RING : CHROME.surface, weight: ranked ? 3 : 1.5, fillColor: DIVERGING.positive, fillOpacity: 1 }
    : { radius: ranked ? 6 : 4, color: ranked ? TOP100_RING : CHROME.mutedInk, weight: ranked ? 2.5 : 1, fillColor: CHROME.surface, fillOpacity: 0.9 };
};

/**
 * Every course in the directory as a dot — green when played, gold-ringed when in the top 100. Tap one for its details and a
 * played / not-played toggle. Leaflet is loaded on the client only (it touches `window`).
 *
 * Basemap: CARTO "Positron" (light, low-contrast, so the dots carry the colour), © OpenStreetMap
 * contributors — the attribution control must stay on.
 */
export function CourseMap({
  courses,
  onToggle,
  focus,
  top100Label = 'Top 100',
}: {
  courses: MapCourse[];
  onToggle: (key: string, played: boolean) => void;
  /** Pan to this course and open its popup (set when a course is picked from the list). */
  focus: { key: string; n: number } | null;
  /** e.g. "Golf Digest Ireland Top 100 (2023)" — shown in the popup of a ranked course. */
  top100Label?: string;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const markers = useRef(new Map<string, CircleMarker>());
  const latest = useRef({ courses, onToggle });
  latest.current = { courses, onToggle };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
      m.fitBounds(IRELAND_BOUNDS);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 18,
      }).addTo(m);
      // Wheel zoom only once the map has been clicked, so it never hijacks page scrolling.
      m.once('focus', () => m.scrollWheelZoom.enable());
      map.current = m;
      syncMarkers(L);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      markers.current.clear();
    };
  }, []);

  // Keep dots and popups in step with the played state.
  useEffect(() => {
    if (!map.current) return;
    import('leaflet').then(({ default: L }) => syncMarkers(L));
  }, [courses]);

  useEffect(() => {
    if (!focus || !map.current) return;
    const mk = markers.current.get(focus.key);
    if (!mk) return;
    map.current.setView(mk.getLatLng(), Math.max(map.current.getZoom(), 11));
    mk.openPopup();
  }, [focus]);

  function syncMarkers(L: typeof import('leaflet')) {
    const m = map.current;
    if (!m) return;
    const seen = new Set<string>();
    for (const c of latest.current.courses) {
      seen.add(c.key);
      let mk = markers.current.get(c.key);
      if (!mk) {
        mk = L.circleMarker([c.lat, c.lng], style(c)).addTo(m);
        mk.bindTooltip(c.name, { direction: 'top', offset: [0, -4] });
        markers.current.set(c.key, mk);
      } else {
        mk.setStyle(style(c));
      }
      if (c.played || c.rank !== null) mk.bringToFront();
      const popupOpen = mk.isPopupOpen();
      mk.unbindPopup().bindPopup(popupContent(c), { closeButton: true, minWidth: 200 });
      if (popupOpen) mk.openPopup();
    }
    for (const [key, mk] of markers.current) {
      if (!seen.has(key)) {
        mk.remove();
        markers.current.delete(key);
      }
    }
  }

  /** Built with DOM calls, not an HTML string: names come from OpenStreetMap. */
  function popupContent(c: MapCourse): HTMLElement {
    const root = document.createElement('div');
    root.className = 'font-sans text-ink space-y-1.5';
    const title = document.createElement('p');
    title.className = 'font-semibold text-sm !m-0';
    title.textContent = c.name;
    const meta = document.createElement('p');
    meta.className = 'font-mono text-xs text-muted !m-0';
    meta.textContent = [c.county ? `Co. ${c.county}` : null, c.holes ? `${c.holes} holes` : null, c.country === 'NI' ? 'Northern Ireland' : null]
      .filter(Boolean)
      .join(' · ');
    root.append(title, meta);
    if (c.rank !== null) {
      const r = document.createElement('p');
      r.className = 'font-mono text-xs !m-0';
      r.textContent = `#${c.rank} · ${top100Label}`;
      root.append(r);
    }
    if (c.rounds > 0) {
      const r = document.createElement('p');
      r.className = 'text-xs text-pos !m-0';
      r.textContent = `${c.rounds} round${c.rounds === 1 ? '' : 's'} logged here`;
      root.append(r);
    }
    // A logged round is proof enough, so only hand-ticked courses get the toggle.
    if (c.rounds === 0) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = c.ticked
        ? 'rounded-lg border border-line-strong px-2.5 py-1 text-xs'
        : 'bg-ink text-paper rounded-lg px-2.5 py-1 text-xs font-medium';
      b.textContent = c.ticked ? 'Played ✓ — undo' : 'I’ve played here';
      b.onclick = () => latest.current.onToggle(c.key, !c.ticked);
      root.append(b);
    }
    if (c.website) {
      const a = document.createElement('a');
      a.href = c.website;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'block text-xs underline';
      a.textContent = 'Club website';
      root.append(a);
    }
    return root;
  }

  return <div ref={el} className="isolate h-[22rem] sm:h-[28rem] w-full rounded-lg border bg-paper-2" aria-label="Map of courses" />;
}
