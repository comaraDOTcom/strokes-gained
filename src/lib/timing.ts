/**
 * Request timing for server pages: wrap each piece of work in `span()`, then `done()` writes ONE
 * log line — `[timing] /insights total=412ms session=38ms options=77ms …` — which shows up in
 * `vercel logs -x -q "[timing]"`. Spans that run in parallel overlap, so they can add up to more
 * than `total`. Logs only labels and milliseconds, never data.
 */
export function requestTimer(route: string) {
  const start = performance.now();
  const spans: [string, number][] = [];
  return {
    async span<T>(label: string, fn: () => Promise<T>): Promise<T> {
      const t = performance.now();
      try {
        return await fn();
      } finally {
        spans.push([label, performance.now() - t]);
      }
    },
    done(extra = ''): void {
      if (process.env.NODE_ENV === 'test') return;
      const total = performance.now() - start;
      const parts = spans.map(([l, ms]) => `${l}=${Math.round(ms)}ms`).join(' ');
      console.log(`[timing] ${route} total=${Math.round(total)}ms ${parts}${extra ? ` ${extra}` : ''}`);
    },
  };
}
