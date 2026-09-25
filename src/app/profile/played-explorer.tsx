'use client';

import { useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { DirectoryCourse } from '@/lib/directory/build';
import { buildPlayedProfile, matchesQuery, type RoundCourse } from '@/lib/directory/profile';
import type { MapCourse } from './course-map';

// Leaflet needs `window`; render the map on the client only.
const CourseMap = dynamic(() => import('./course-map').then((m) => m.CourseMap), {
  ssr: false,
  loading: () => <div className="h-[22rem] sm:h-[28rem] w-full rounded-lg border bg-paper-2 animate-pulse" />,
});

const SEARCH_LIMIT = 40;

export function PlayedExplorer({
  directory,
  initialTicked,
  roundCourses,
  top100,
}: {
  directory: DirectoryCourse[];
  initialTicked: string[];
  roundCourses: RoundCourse[];
  /** The top-100 challenge: key -> rank pairs and a label ("Golf Digest Ireland Top 100 (2023)"). */
  top100: { ranks: [string, number][]; label: string };
}) {
  const rankOf = useMemo(() => new Map(top100.ranks), [top100.ranks]);
  const hasTop100 = rankOf.size > 0;
  const [onlyTop100, setOnlyTop100] = useState(false);
  const [ticked, setTicked] = useState(() => new Set(initialTicked));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [county, setCounty] = useState('');
  // `n` makes picking the same course twice re-centre the map.
  const [focus, setFocus] = useState<{ key: string; n: number } | null>(null);
  const mapSection = useRef<HTMLElement>(null);
  const focusOn = (key: string) => {
    setFocus((f) => ({ key, n: (f?.n ?? 0) + 1 }));
    mapSection.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const profile = useMemo(
    () => buildPlayedProfile(directory, [...ticked], roundCourses, rankOf),
    [directory, ticked, roundCourses, rankOf],
  );
  const playedByKey = useMemo(() => new Map(profile.played.map((p) => [p.course.key, p])), [profile]);

  const mapCourses: MapCourse[] = useMemo(
    () =>
      directory.map((c) => {
        const p = playedByKey.get(c.key);
        return { ...c, played: Boolean(p), ticked: p?.ticked ?? false, rounds: p?.rounds ?? 0, rank: rankOf.get(c.key) ?? null };
      }),
    [directory, playedByKey, rankOf],
  );

  async function toggle(key: string, played: boolean) {
    // Optimistic: flip now, put it back if the server says no.
    const flip = (on: boolean) =>
      setTicked((prev) => {
        const next = new Set(prev);
        if (on) next.add(key);
        else next.delete(key);
        return next;
      });
    flip(played);
    setError(null);
    setPending((p) => new Set(p).add(key));
    try {
      const res = await fetch('/api/played-courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, played }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not save');
    } catch (e) {
      flip(!played);
      setError(e instanceof Error ? e.message : 'Could not save — try again.');
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(key);
        return next;
      });
    }
  }

  const results = useMemo(() => {
    const hits = directory.filter(
      (c) => (!county || c.county === county) && (!onlyTop100 || rankOf.has(c.key)) && matchesQuery(c, query),
    );
    // The top-100 view reads as the ranking itself: in rank order, all of it.
    if (onlyTop100) {
      hits.sort((a, b) => rankOf.get(a.key)! - rankOf.get(b.key)!);
      return { total: hits.length, shown: hits };
    }
    return { total: hits.length, shown: hits.slice(0, SEARCH_LIMIT) };
  }, [directory, query, county, onlyTop100, rankOf]);

  const { stats } = profile;
  const countiesWithCourses = profile.byCounty.filter((b) => b.total > 0);

  return (
    <div className="space-y-6">
      <div className={`grid grid-cols-2 gap-3 ${hasTop100 ? 'sm:grid-cols-5' : 'sm:grid-cols-4'}`}>
        <Stat label="Courses played" value={stats.played} of={stats.total} />
        {hasTop100 && <Stat label="Top 100" value={stats.top100} of={stats.totalTop100} title={top100.label} />}
        <Stat label="Counties" value={stats.counties} of={stats.totalCounties} />
        <Stat label="18-hole" value={stats.eighteen} />
        <Stat label="9-hole" value={stats.nine} />
      </div>

      <section ref={mapSection} className="border rounded-xl bg-card p-4 space-y-3 scroll-mt-28">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-lg">Map</h2>
          <p className="flex items-center gap-3 font-mono text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-3 rounded-full bg-pos" /> played
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full border border-muted bg-card" /> not yet
            </span>
            {hasTop100 && (
              <span className="flex items-center gap-1.5">
                <span className="inline-block size-3 rounded-full border-2 border-eagle bg-card" /> top 100
              </span>
            )}
          </p>
        </div>
        <CourseMap courses={mapCourses} onToggle={toggle} focus={focus} top100Label={top100.label} />
        <p className="text-xs text-muted">Tap a dot to tick a course off. Click the map first to zoom with your scroll wheel.</p>
      </section>

      {error && <p className="text-neg text-sm">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border rounded-xl bg-card p-4 space-y-3 self-start">
          <h2 className="font-semibold text-lg">Find a course</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or county"
              aria-label="Search courses"
              className="flex-1 min-w-0 border border-line-strong bg-paper rounded-lg px-3 py-2 text-base placeholder:text-faint"
            />
            <select
              value={county}
              onChange={(e) => setCounty(e.target.value)}
              aria-label="County"
              className="border border-line-strong bg-paper rounded-lg px-3 py-2 text-base"
            >
              <option value="">All counties</option>
              {countiesWithCourses.map((b) => (
                <option key={b.county} value={b.county}>
                  {b.county} ({b.played}/{b.total})
                </option>
              ))}
            </select>
          </div>
          {hasTop100 && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyTop100} onChange={(e) => setOnlyTop100(e.target.checked)} />
              {top100.label} only, in rank order
            </label>
          )}
          <ul className="divide-y">
            {results.shown.map((c) => {
              const p = playedByKey.get(c.key);
              const viaRounds = (p?.rounds ?? 0) > 0;
              return (
                <li key={c.key} className="flex items-center justify-between gap-3 py-2">
                  <button type="button" onClick={() => focusOn(c.key)} className="min-w-0 text-left" title="Show on the map">
                    <p className="text-sm font-medium truncate">
                      <RankBadge rank={rankOf.get(c.key)} />
                      {c.name}
                    </p>
                    <p className="font-mono text-xs text-muted">
                      {[c.county, c.holes ? `${c.holes} holes` : null].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </button>
                  {viaRounds ? (
                    <span className="shrink-0 font-mono text-xs text-pos">
                      {p!.rounds} round{p!.rounds === 1 ? '' : 's'}
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={pending.has(c.key)}
                      aria-pressed={Boolean(p)}
                      onClick={() => toggle(c.key, !p)}
                      className={
                        p
                          ? 'shrink-0 rounded-lg bg-pos-soft text-pos px-2.5 py-1 text-xs font-medium'
                          : 'shrink-0 rounded-lg border border-line-strong px-2.5 py-1 text-xs'
                      }
                    >
                      {p ? 'Played ✓' : 'Played?'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted">
            {results.total === 0
              ? 'No courses match.'
              : results.total > SEARCH_LIMIT
                ? `Showing ${SEARCH_LIMIT} of ${results.total} — narrow the search to see the rest.`
                : `${results.total} course${results.total === 1 ? '' : 's'}.`}
          </p>
        </section>

        <section className="border rounded-xl bg-card p-4 space-y-3 self-start">
          <h2 className="font-semibold text-lg">Your courses</h2>
          {profile.played.length === 0 ? (
            <p className="text-sm text-muted">None yet. Search for a course or tap one on the map to start your list.</p>
          ) : (
            <PlayedByCounty profile={profile} onFocus={focusOn} rankOf={rankOf} />
          )}
        </section>
      </div>
    </div>
  );
}

/** "#12" in the top-100 gold, before a ranked course's name. */
function RankBadge({ rank }: { rank: number | undefined }) {
  if (rank === undefined) return null;
  return (
    <span className="mr-1.5 inline-block rounded bg-eagle/20 px-1 font-mono text-[11px] text-ink align-[1px]" title={`Top 100: #${rank}`}>
      #{rank}
    </span>
  );
}

function Stat({ label, value, of, title }: { label: string; value: number; of?: number; title?: string }) {
  return (
    <div className="border rounded-xl bg-card px-4 py-3" title={title}>
      <p className="font-mono text-xs text-muted uppercase tracking-wide">{label}</p>
      <p className="font-mono text-2xl">
        {value}
        {of !== undefined && <span className="text-sm text-muted"> / {of}</span>}
      </p>
    </div>
  );
}

function PlayedByCounty({
  profile,
  onFocus,
  rankOf,
}: {
  profile: ReturnType<typeof buildPlayedProfile>;
  onFocus: (key: string) => void;
  rankOf: ReadonlyMap<string, number>;
}) {
  const groups = new Map<string, typeof profile.played>();
  for (const p of profile.played) {
    const k = p.course.county ?? 'Unknown county';
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(p);
  }
  const ordered = [...groups].sort(([a], [b]) => (a === 'Unknown county' ? 1 : b === 'Unknown county' ? -1 : a.localeCompare(b)));
  return (
    <div className="space-y-3">
      {ordered.map(([county, list]) => (
        <div key={county}>
          <p className="font-mono text-xs text-muted uppercase tracking-wide">
            {county} · {list.length}
          </p>
          <ul>
            {list.map((p) => (
              <li key={p.course.key} className="flex items-baseline justify-between gap-3 py-0.5">
                <button type="button" onClick={() => onFocus(p.course.key)} className="text-sm text-left hover:underline truncate">
                  <RankBadge rank={rankOf.get(p.course.key)} />
                  {p.course.name}
                </button>
                <span className="shrink-0 font-mono text-xs text-muted">
                  {p.rounds > 0 ? `${p.rounds} round${p.rounds === 1 ? '' : 's'} · last ${p.lastPlayed}` : p.course.holes ? `${p.course.holes} holes` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
