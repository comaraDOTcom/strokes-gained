/**
 * Turn a pasted top-100 list into `src/lib/directory/data/top100.json`, matched to directory keys.
 *
 *   pnpm directory:top100 list.txt [--source "<where the list came from>"]
 *
 * `list.txt`: one course per line, "1. Royal County Down" (or just the names, in rank order). Keeps
 * the title/year already in top100.json. Prints every name it couldn't match confidently, with its
 * best guesses: fix those by editing the `key` in top100.json by hand (or add the missing course to
 * overrides.json, refresh the directory, and run this again).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DIRECTORY } from '../src/lib/directory';
import { matchTop100, parseRankedLines, validateTop100, type Top100File } from '../src/lib/directory/top100';

const OUT = resolve(import.meta.dirname, '../src/lib/directory/data/top100.json');

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const sourceAt = args.indexOf('--source');
  if (!file) {
    console.error('Usage: pnpm directory:top100 <list.txt> [--source "<url or magazine issue>"]');
    process.exitCode = 1;
    return;
  }
  const current = JSON.parse(readFileSync(OUT, 'utf8')) as Top100File;
  const ranked = parseRankedLines(readFileSync(file, 'utf8'));
  const { entries, unmatched } = matchTop100(ranked, DIRECTORY);
  const next: Top100File = { ...current, source: sourceAt >= 0 ? (args[sourceAt + 1] ?? null) : current.source, entries };

  const problems = validateTop100(next, DIRECTORY);
  if (problems.length) {
    console.error(`Not written — fix the list first:\n  ${problems.join('\n  ')}`);
    process.exitCode = 1;
    return;
  }
  writeFileSync(OUT, `${JSON.stringify({ ...next, entries: [] }, null, 2).replace('"entries": []', `"entries": [\n${entries.map((e) => `    ${JSON.stringify(e)}`).join(',\n')}\n  ]`)}\n`);
  console.log(`Wrote ${entries.length} ranked courses (${entries.length - unmatched.length} matched) to ${OUT}`);
  if (unmatched.length) {
    console.log(`\nNo confident match (${unmatched.length}) — set "key" by hand in top100.json:`);
    for (const u of unmatched) console.log(`  #${u.rank} ${u.name}\n      ${u.guesses.join('\n      ') || '(nothing close)'}`);
  }
}

main();
