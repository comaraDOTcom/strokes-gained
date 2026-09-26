---
name: brigade
description: Run many subagents on this codebase at once (from 3 to 100) the way a restaurant brigade runs a service. Partitions the work into tickets by station, gives every cook a strict ticket and return contract, keeps writers in their own worktrees, and passes every plate through an independent verifier before the lead merges. Use when asked to parallelise, fan out, "use lots of subagents", audit the whole codebase, or land several independent changes in one session.
argument-hint: "<what to build or audit> [--cooks N] [--dry-run]"
---

# Brigade

A Michelin kitchen runs 20 cooks on one service without chaos because every plate has a
ticket, every cook has a station, mise en place is done before service, and nothing reaches
the dining room without passing the pass. This skill is that system for subagents on this
repo. It composes two other skills: `/how` (runners: read-only explorers) and `/verify` (the
pass: gates plus an independent verifier).

Read `references/stations.md` (the station map: what lives where, the invariants each station
owns, and which files only the lead may touch) before planning.

## Roles

| Kitchen | Here | Agent | Writes? |
|---|---|---|---|
| Chef | the lead: you, in this session | — | merges only |
| Runner | explorer / researcher | `Explore` | never |
| Cook | implements one ticket | `general-purpose`, `isolation: worktree` | its ticket's files only |
| Pass | verifier, one per ticket | `general-purpose`, read-only by instruction | never |
| Sous-chef | a lead for one station when there are more than ~8 tickets | `general-purpose` | merges its station's branch only |

The rule that makes the rest work: **the cook who made the plate never checks it.**

## Service, step by step

### 1. Mise en place (before any cook is spawned)

1. Confirm the kitchen is clean: `.claude/skills/verify/scripts/ci-local.sh fast` is green on
   the base commit. Never start service on a red base; you won't be able to tell whose fault a
   failure is.
2. If you don't already know the area, run `/how` on it. Runners are cheap; a cook working
   from a wrong mental model is not.
3. Write the tickets, using `references/ticket-template.md`. Every ticket has: goal, station,
   **owned files** (the only files the cook may change), **forbidden files**, contract
   references (`BUILD.md` / `README.md` sections), acceptance criteria as commands, and the
   tests it must add or keep green.
4. Check the partition: **no two tickets own the same file**, and no ticket owns a lead-only
   file (see stations.md). If two tickets need the same file, merge them or sequence them.
5. Decide scale (below), and write the plan down before spawning anything: ticket list,
   ownership table, order of merges.

### 2. Service (spawn the cooks)

- Spawn every cook of a wave in one message. Each cook gets its ticket verbatim plus
  `references/cook-prompt.md`. Each cook works in its own worktree (`isolation: "worktree"`)
  and never touches the shared checkout.
- Cooks run **targeted** tests while working (`ci-local.sh tests <their files>`) and the
  **fast** gate once before reporting. They never run `full`; the pass does.
- Cooks report in the return contract (`references/return-contract.md`): files changed, what
  changed and why, tests added, gate output quoted, anything left undone, anything they
  noticed outside their ticket (reported, not fixed).
- A cook that needs a file outside its ticket **stops and reports**. It never widens its own
  scope. The chef re-tickets.

### 3. The pass (verify every plate)

- For each cook's report, spawn a verifier with `/verify`'s `references/verifier-prompt.md`,
  pointed at that cook's worktree and given the ticket and the report. Verifiers for different
  tickets run in parallel.
- FAIL goes back to the **same cook** (continue it with SendMessage so it keeps context) with
  the verifier's problems list, then to a **fresh verifier**. Two FAILs in a row: the chef reads
  the diff personally and either re-tickets or drops the ticket.
- Nothing merges on the cook's word. Only a PASS or a PASS WITH NOTES the chef has read.

### 4. Plating (merge, in order)

- Merge verified branches into the integration branch one at a time, in the order the plan
  set (dependencies first, schema tickets first and alone).
- After each merge, run `ci-local.sh fast`; after the last, `ci-local.sh full`. A merge
  that goes red is reverted, not patched in place: the ticket goes back to its cook with the
  failure.
- Lead-only files are edited once, by the chef, after the merges: `CHANGELOG.md` entry,
  `package.json` version bump, `README.md` status line, `docs/`.
- Then `/verify full` on the integrated result before any push.

### 5. Debrief

Report in the chef's own return contract: what shipped, what didn't and why, the verifier
verdicts, gate output on the final commit, and every "noticed outside my ticket" item the
cooks raised, as a list the user can turn into new tickets.

## Scale

| Tickets | How |
|---|---|
| 1–3 | Just do it, or one cook plus one verifier. Not a brigade. |
| 3–8 | One wave of `Agent` calls in one message; verifiers in a second wave. This is the sweet spot for a single chef. |
| 8–16 | Two or more waves, or sous-chefs: one `general-purpose` lead per station that runs its own cooks and pass, and hands the chef one verified station branch. The chef merges stations. |
| 16–100 | Use the `Workflow` tool (the user must opt in: "use a workflow" or "ultracode"). Load `workflow-authoring` first. The script holds the plan: `pipeline(tickets, cook, verify)` so each ticket's pass runs the moment its cook finishes. Default concurrency is 16 agents; raise `CLAUDE_CODE_WORKFLOW_MAX_CONCURRENT_AGENTS` only if the container can take it (see the next section). |

For work that is truly independent (a hundred pages to migrate, a hundred modules to audit),
remote sibling sessions (`create_session` with `outcome_branch`) give each cook its own
container, CPU and branch. The chef then merges branches with the same pass. Reach for this
when the bottleneck is the container, not the plan.

## What this container can take

Measured on a clean checkout in a cloud session: `pnpm tsc --noEmit` ≈ 9s, `pnpm test`
≈ 43s wall (about 2 CPU-minutes; every DB-backed test file boots an in-memory Postgres).
Eight cooks each running the full suite at once will make every one of them slow, and a
timeout looks like a failure. So:

- Cooks run **targeted** tests (`ci-local.sh tests src/lib/sg`), not the suite.
- Only the pass runs `fast`; only the chef runs `full`, once, after merging.
- Stagger waves: verifiers for wave 1 while cooks of wave 2 write.
- A worktree needs its own `node_modules`: cooks run `pnpm install --frozen-lockfile
  --offline` first (the store is shared, so it's seconds), and never `pnpm install` without
  `--frozen-lockfile`.

## Hard rules

- **One writer per file.** Enforced by the ticket partition, checked by the verifier.
- **Lead-only files** (stations.md) are never in a ticket: `src/db/schema.ts` and `drizzle/`
  (one schema ticket at a time, run by the chef or a single cook and merged first, because
  two parallel `db:generate` runs both produce the next migration number), `package.json`,
  `pnpm-lock.yaml`, `CHANGELOG.md`, `README.md`, `BUILD.md`, `.github/`, `src/app/layout.tsx`,
  `src/app/globals.css`, `src/middleware.ts`, `src/lib/auth/*`.
- **Auth and the SG engine change only with the chef's eyes on the diff**, whatever the
  verifier says.
- **No cook widens its scope, skips a test, or marks a test `.skip` / `.todo`.** A cook that
  can't make a test pass reports that; the chef decides.
- **No push from a cook.** Cooks commit on their worktree branch; the chef pushes the
  integration branch after `/verify full`.
- **Reports quote, they don't assert.** "Tests pass" without the gate line is an unverified
  claim, and the pass treats it as one.
- **Dry run first when the plan is new**: `--dry-run` means write the tickets, the ownership
  table and the merge order, show them to the user, and spawn nothing.
