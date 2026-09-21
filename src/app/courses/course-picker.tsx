'use client';

import Link from 'next/link';
import { useState } from 'react';

type Item = { id: number; name: string; location: string | null; teeCount: number };

/** Searchable course list; choosing one loads its details (`?course=<id>`). */
export function CoursePicker({ courses, selectedId }: { courses: Item[]; selectedId: number | null }) {
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? courses.filter((c) => `${c.name} ${c.location ?? ''}`.toLowerCase().includes(needle))
    : courses;

  return (
    <div className="space-y-2">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search courses"
        aria-label="Search courses"
        className="w-full border border-line-strong bg-card rounded-lg px-3 py-2 text-base placeholder:text-faint"
      />
      <ul className="space-y-1.5 max-h-72 sm:max-h-[28rem] overflow-y-auto">
        {shown.map((c) => {
          const on = c.id === selectedId;
          return (
            <li key={c.id}>
              <Link
                href={`/courses?course=${c.id}`}
                scroll={false}
                aria-current={on ? 'true' : undefined}
                className={`block rounded-lg border px-3 py-2 ${
                  on ? 'bg-accent-soft border-accent/50' : 'bg-card border-line-strong hover:bg-paper-2'
                }`}
              >
                <span className="block text-sm font-medium">{c.name}</span>
                <span className="block font-mono text-xs text-muted">
                  {[c.location, `${c.teeCount} tee${c.teeCount === 1 ? '' : 's'}`].filter(Boolean).join(' · ')}
                </span>
              </Link>
            </li>
          );
        })}
        {shown.length === 0 && (
          <li className="text-sm text-muted px-1 py-2">No course matches “{q}”. You can request it below.</li>
        )}
      </ul>
    </div>
  );
}
