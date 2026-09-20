import Link from 'next/link';
import type { CourseOption } from '@/lib/insights/course-filter';

/**
 * Two-or-more named buttons with a mono round count — deliberately not a
 * dropdown (see the design mock's course-filter row). Plain links to
 * `?course=<id>`, so it's a Server Component and the selection survives
 * reload/share.
 */
export function CourseFilter({
  options,
  selectedCourseId,
  basePath,
}: {
  options: CourseOption[];
  selectedCourseId: number | null;
  basePath: string;
}) {
  if (options.length === 0) return null;
  return (
    <nav aria-label="Course" className="flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = o.courseId === selectedCourseId;
        return (
          <Link
            key={o.courseId}
            href={`${basePath}?course=${o.courseId}`}
            aria-current={selected ? 'page' : undefined}
            className={`text-sm px-3.5 py-2 border rounded-lg ${
              selected
                ? 'bg-accent-soft border-accent/50 text-ink font-medium'
                : 'bg-card border-line-strong text-ink-2 hover:bg-paper-2'
            }`}
          >
            {o.name}{' '}
            <span className="font-mono text-xs text-muted">
              {o.roundCount} round{o.roundCount === 1 ? '' : 's'}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
