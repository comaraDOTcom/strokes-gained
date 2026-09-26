---
name: how
description: Explain how a subsystem, feature or flow works in this codebase (parallel read-only explorers, one explainer), and optionally critique its architecture with independent critics. Use for "how does X work", "walk me through", "what happens when", "is X well built", or before touching an area you don't know.
argument-hint: "how does <subsystem or flow> work? [--critique]"
---

# How

Answer "how does X work?" for this codebase at the level of a senior engineer onboarding onto
the area: enough to build a working mental model, not annotated source. Ported from
[poteto/how](https://github.com/poteto/how) (MIT) and adapted to Claude Code and to this repo.

Two modes:

1. **Explain** (default) — explore, then produce a clear explanation.
2. **Critique** — explain first, then spawn independent critics to find architectural problems.

The question is `$ARGUMENTS`. If it contains `--critique`, or asks about problems, issues,
risks, "is this well built", or improvements, run Critique mode.

## Explain mode

### Step 1 — Understand the question and assess complexity

Parse what's being asked: a subsystem ("how does the shot chain work?"), a feature flow ("how
does an invite become an account?"), an architectural overview ("how is auth structured?"), or a
runtime trace ("what happens when I tap Holed?"). If the scope is ambiguous, state your
interpretation and go; don't ask.

Orient first, cheaply: `README.md` has a section on almost every area, and `BUILD.md` is the
implementation contract. Skim the relevant section before deciding the approach.

- **Simple** (one module, one pure function, one page): skip explorers. Go to Step 2b.
- **Complex** (spans `src/lib/*` and `src/app/*`, crosses the API boundary, touches the DB or
  the SG engine, or is a whole-area overview): spawn explorers. Go to Step 2a.

When in doubt, take the simple path; you can spawn explorers if the explainer hits a wall.

### Step 2a — Explore (complex questions)

Decompose into 2–4 exploration angles that cover distinct slices. Typical splits here:

- **Entry → validation → guard** (a page or component in `src/app/`, its API route, the
  `src/lib/**/entry.ts`-style validator, `src/lib/auth/guards.ts`).
- **Persistence and invariants** (the `src/lib/*` module that writes, the tables in
  `src/db/schema.ts`, transactions, chain/checksum invariants).
- **Engine or computation** (`src/lib/sg/*`, `src/lib/insights/*`: pure functions and what
  calls them).
- **Readers** (which pages and queries consume the result).

Spawn all explorers in one message, each with `references/explorer-prompt.md` filled in:

- `subagent_type`: `Explore` (read-only by construction)
- `model`: inherit for a hard question; `sonnet` when running many at once
- `run_in_background`: `true`, then wait for all of them

Every explorer returns the same structured report (components, flow, files read, boundaries,
**tests covering this**, non-obvious things, open questions). Overlap is fine; the explainer
reconciles it. The "Tests covering this" section is a deliberate addition for this repo: the
test suite is the most reliable statement of intended behaviour, and an area with no tests is
a fact the reader needs.

### Step 2b — Direct explain (simple questions)

Spawn one `general-purpose` subagent with `references/explainer-prompt.md`, telling it there
are no explorer findings and it must explore itself with Read, Grep and Glob only. It must not
edit files.

### Step 3 — Synthesise (complex questions)

Spawn one `general-purpose` subagent with `references/explainer-prompt.md`, passing every
explorer's findings verbatim. It reconciles overlaps, resolves contradictions by reading the
code, and writes the explanation. Read-only; it must not edit files.

### Step 4 — Present

Present the explainer's output, lightly edited at most. If the user asked to keep it, or it
would help the next session, save it as `docs/how/<slug>.md` with a one-line header giving the
question and the commit it was written against (`git rev-parse --short HEAD`). An explanation
in `docs/how/` is a snapshot: re-run `/how` rather than trusting one older than the code it
describes.

### Output format

**Overview** · **Key concepts** · **How it works** (the longest section; prose, file and
function names, a mermaid or ASCII diagram only when it clarifies) · **Where things live** ·
**Tests and invariants** (what the suite pins down, what it doesn't) · **Gotchas**. Drop a
section when it has nothing to say.

## Critique mode

### Step 1 — Explain first

Run the full Explain flow. You can't critique what you haven't mapped.

### Step 2 — Spawn critics

Launch three critics in one message, each `general-purpose`, read-only, with
`references/critic-prompt.md` filled in. They get the explanation, the file list from the
explorers' "Files read" sections, and `references/critique-rubric.md`.

| Critic | `model` | Emphasis |
|---|---|---|
| A | inherit | whole rubric |
| B | `opus` | data model, boundary discipline, contract fit |
| C | `sonnet` | evolution readiness, complexity vs value, consistency |

poteto/how sends critics to three different vendors' models for independence. Claude Code
can't do that, so independence comes from different models within the family, different rubric
emphasis, and separate context windows. Never share one critic's findings with another.

### Step 3 — Lead judgment

You are a pragmatic lead, not an aggregator. For each finding, read the evidence yourself,
then file it under **Act on**, **Consider**, **Noted**, or **Dismissed** (with the reason).
Two critics agreeing is not evidence; the code is. A finding that contradicts `BUILD.md` or a
"Known issues already fixed" entry in `README.md` is Dismissed unless the critic shows the
contract itself is wrong.

Present the explanation first, then the verdict beneath it, so the explanation stands alone.

## Rules

- Explorers, explainers and critics never edit files. Explanation is not a licence to fix.
- Cite `path:line` for every claim about behaviour. "It probably" is an open question, not a
  finding.
- Don't paper over gaps. An honest "couldn't trace how X reaches Y" is part of the product.
