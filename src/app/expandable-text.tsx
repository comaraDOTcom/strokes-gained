'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Commentary preview that can be expanded. Collapsed it's a two-line, flowing
 * excerpt; expanded it keeps the writer's line breaks/bullets. The toggle only
 * appears when the collapsed text is actually cut off, so short notes stay clean.
 */
export function ExpandableText({ text, className = '' }: { text: string; className?: string }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Only meaningful while collapsed (clamped); once expanded, keep the toggle.
    const measure = () => {
      if (!expanded) setOverflows(el.scrollHeight > el.clientHeight + 1);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, expanded]);

  return (
    <div>
      <p ref={ref} className={`${className} ${expanded ? 'whitespace-pre-line' : 'line-clamp-2'}`}>
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="mt-1 text-xs font-medium text-accent underline underline-offset-2"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}
