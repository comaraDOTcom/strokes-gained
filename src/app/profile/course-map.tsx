'use client';

import { useEffect, useRef } from 'react';
import type { Map as LeafletMap, Marker, MarkerClusterGroup } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import type { DirectoryCourse } from '@/lib/directory/build';

/** Island of Ireland, with a little sea around it. */
const IRELAND_BOUNDS: [[number, number], [number, number]] = [
  [51.35, -10.7],
  [55.45, -5.35],
];

/**
 * Basemap tiles. Default: OpenStreetMap's own standard tiles — no key needed (CARTO's basemaps now
 * return an "API key required" image without one). Swap providers without a code change with
 * NEXT_PUBLIC_MAP_TILE_URL (+ NEXT_PUBLIC_MAP_TILE_ATTRIBUTION), e.g. a MapTiler or Stadia URL with
 * its key. OSM's tile policy asks for the attribution to stay visible and for light use — fine for
 * a small invite-only app; move to a keyed provider if traffic grows.
 */
const TILES = {
  url: process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  attribution:
    process.env.NEXT_PUBLIC_MAP_TILE_ATTRIBUTION ||
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
};

/** From this zoom in, every course is its own pin (roughly county level). */
const UNCLUSTER_AT_ZOOM = 11;

export type MapCourse = DirectoryCourse & {
  played: boolean;
  ticked: boolean;
  rounds: number;
  /** Position in the top-100 ranking, or null. */
  rank: number | null;
};

/** A small flag in a disc — green when played, gold-ringed when in the top 100 (styles: globals.css). */
function pinHtml(c: Pick<MapCourse, 'played' | 'rank'>): string {
  const cls = ['course-pin', c.played ? 'course-pin--played' : '', c.rank !== null ? 'course-pin--ranked' : ''].join(' ');
  return `<span class="${cls}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 2.5v11" /><path d="M6 2.8l5.5 2.3L6 7.4z" /></svg></span>`;
}

/**
 * Every course in the directory on a map. Zoomed out, nearby courses gather into count bubbles
 * (Leaflet.markercluster) — a green badge on a bubble says how many inside are played. From
 * `UNCLUSTER_AT_ZOOM` in, each course is its own flag pin: green when played, gold-ringed when in the
 * top 100. Tap a pin for its details and a played toggle. Leaflet is loaded on the client only.
 *
 * Basemap: see `TILES` — the attribution control must stay on.
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
  const cluster = useRef<MarkerClusterGroup | null>(null);
  const markers = useRef(new Map<string, Marker>());
  /** Marker -> course, so a cluster bubble can count the played courses inside it. */
  const courseOf = useRef(new WeakMap<Marker, MapCourse>());
  const latest = useRef({ courses, onToggle });
  latest.current = { courses, onToggle };

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import('leaflet')).default;
      // The clustering plugin extends the global `L`.
      (window as unknown as { L: typeof L }).L = L;
      await import('leaflet.markercluster');
      if (cancelled || !el.current || map.current) return;
      const m = L.map(el.current, { scrollWheelZoom: false, zoomSnap: 0.25, attributionControl: true });
      m.fitBounds(IRELAND_BOUNDS);
      L.tileLayer(TILES.url, { attribution: TILES.attribution, maxZoom: 19 }).addTo(m);
      const group = L.markerClusterGroup({
        showCoverageOnHover: false,
        maxClusterRadius: 60,
        disableClusteringAtZoom: UNCLUSTER_AT_ZOOM,
        spiderfyOnMaxZoom: false,
        iconCreateFunction: (c) => {
          const children = c.getAllChildMarkers();
          const count = children.length;
          const played = children.filter((mk) => courseOf.current.get(mk)?.played).length;
          const size = count < 10 ? 28 : count < 40 ? 34 : 42;
          const badge = played > 0 ? `<span class="course-cluster__played" title="${played} played">${played}</span>` : '';
          return L.divIcon({
            html: `<span class="course-cluster" style="width:${size}px;height:${size}px">${count}${badge}</span>`,
            className: 'course-cluster-icon',
            iconSize: [size, size],
          });
        },
      });
      group.addTo(m);
      // Wheel zoom only once the map has been clicked, so it never hijacks page scrolling.
      m.once('focus', () => m.scrollWheelZoom.enable());
      map.current = m;
      cluster.current = group;
      syncMarkers(L);
    })();
    return () => {
      cancelled = true;
      map.current?.remove();
      map.current = null;
      cluster.current = null;
      markers.current.clear();
    };
  }, []);

  // Keep pins, bubbles and popups in step with the played state.
  useEffect(() => {
    if (!map.current) return;
    import('leaflet').then(({ default: L }) => syncMarkers(L));
  }, [courses]);

  useEffect(() => {
    if (!focus || !cluster.current) return;
    const mk = markers.current.get(focus.key);
    if (!mk) return;
    // Zooms in (or spiderfies) until the pin is out of its bubble, then opens it.
    cluster.current.zoomToShowLayer(mk, () => mk.openPopup());
  }, [focus]);

  function syncMarkers(L: typeof import('leaflet')) {
    const group = cluster.current;
    if (!group) return;
    const seen = new Set<string>();
    const added: Marker[] = [];
    for (const c of latest.current.courses) {
      seen.add(c.key);
      let mk = markers.current.get(c.key);
      const icon = L.divIcon({ html: pinHtml(c), className: 'course-pin-icon', iconSize: [22, 22], iconAnchor: [11, 11], popupAnchor: [0, -10] });
      if (!mk) {
        mk = L.marker([c.lat, c.lng], { icon, title: c.name, keyboard: true });
        markers.current.set(c.key, mk);
        added.push(mk);
      } else {
        const was = courseOf.current.get(mk);
        if (!was || was.played !== c.played || was.rank !== c.rank) mk.setIcon(icon);
      }
      // Played and ranked pins sit above the rest where they overlap.
      mk.setZIndexOffset(c.played ? 1000 : c.rank !== null ? 500 : 0);
      courseOf.current.set(mk, c);
      const popupOpen = mk.isPopupOpen();
      mk.unbindPopup().bindPopup(popupContent(c), { closeButton: true, minWidth: 200 });
      if (popupOpen) mk.openPopup();
    }
    if (added.length) group.addLayers(added);
    for (const [key, mk] of markers.current) {
      if (!seen.has(key)) {
        group.removeLayer(mk);
        markers.current.delete(key);
      }
    }
    // Bubble badges count played courses, so redraw them after a toggle.
    group.refreshClusters();
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
