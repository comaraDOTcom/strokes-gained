/**
 * `pnpm sg:recompute --all` — rebuilds every round's SG (e.g. after a
 * baseline edit). `pnpm sg:recompute <roundId>` recomputes just one round
 * (mainly for debugging; the app itself calls `recomputeRound` directly on
 * every shot mutation).
 */
import { recomputeRound, recomputeAllRounds } from './recompute';
import { closeDb } from '../../db/client';

async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--all')) {
    const count = await recomputeAllRounds();
    console.log(`[sg:recompute] Recomputed ${count} round(s).`);
    return;
  }

  const roundIdArg = args[0];
  if (!roundIdArg) {
    console.error('[sg:recompute] Usage: pnpm sg:recompute --all | pnpm sg:recompute <roundId>');
    process.exitCode = 1;
    return;
  }

  const roundId = Number(roundIdArg);
  if (!Number.isInteger(roundId)) {
    console.error(`[sg:recompute] Invalid roundId: ${roundIdArg}`);
    process.exitCode = 1;
    return;
  }

  await recomputeRound(roundId);
  console.log(`[sg:recompute] Recomputed round ${roundId}.`);
}

main()
  .then(() => closeDb())
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });

export {};
