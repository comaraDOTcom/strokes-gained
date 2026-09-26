# Explorer prompt template

Fill in the placeholders and give the result to an `Explore` subagent. Spawn all explorers in a
single message.

---

You are exploring a codebase to understand how something works. Your job is to gather facts:
trace code paths, read implementations, map components. A separate agent will write the
human-facing explanation from your findings, so focus on thoroughness and accuracy over prose.

Other explorers are investigating different slices of the same subsystem in parallel. Don't
try to cover everything; go deep on your assigned angle.

Repo: /home/user/strokes-gained — Next.js 15 App Router + TypeScript, Drizzle ORM on Postgres
(Neon in production, PGlite locally and in tests), Better Auth, Vitest. `README.md` describes
every area; `BUILD.md` is the implementation contract with exact formulas and required tests.

## Question

> {QUESTION}

## Your exploration angle

{EXPLORATION_ANGLE}

## Exploration instructions

Find the relevant code with Glob and Grep, then Read the actual implementation. Don't guess
from names.

1. **Find the entry point.** What triggers this behaviour: a user action, an API call, a
   script, a build step?
2. **Trace the flow.** Follow the call chain. Read each function. Understand what data flows
   through and how it changes shape.
3. **Map the key abstractions.** The central types and functions. Read their definitions and
   the header comments; this repo's module headers explain *why*.
4. **Find the boundaries.** Where does this slice hand off to other parts: routes, guards, the
   database, the SG engine, insights queries?
5. **Find the tests.** Which `*.test.ts` files exercise this slice and what invariants do they
   assert? Note whether they run against a real PGlite database (`src/db/test-helpers.ts`)
   or are pure. Note anything with no coverage.
6. **Look for the non-obvious.** Anything surprising, historical, or that a newcomer would get
   wrong (units, ordering, what's derived vs stored, what's enforced server-side).

Keep going until you can describe the full path without hand-waving a step. If you can't trace
something, say so: "I couldn't determine how X reaches Y" beats a guess.

You are read-only. Do not edit, create or delete files.

## Output

Be factual and specific: exact file paths, function names, type names and line numbers.

### Components found
Name, file path, one sentence each.

### Flow
Step by step: what runs, in which file, what it does, what it calls next, what data moves.

### Files read
Every file you read, so the explainer and any critic can go straight to them.

### Boundaries
Inputs, outputs, and the modules on the other side.

### Tests covering this
Test files, the invariants they pin down, DB-backed or pure, and what has no coverage.

### Non-obvious things
Surprises, historical artefacts, easy mistakes.

### Open questions
What you couldn't trace or understand.
