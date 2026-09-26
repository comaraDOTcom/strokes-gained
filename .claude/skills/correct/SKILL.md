---
name: correct
description: Turn a correction from the user (a mistake Claude or a subagent made, a rule stated in review, a "don't do that again") into a permanent fix at the lowest possible level of the ladder — codebase, static analysis, rules/hooks, skills, style guide — and record it in docs/corrections.md so it is never fixed twice. Use whenever the user corrects you, says "always/never", repeats an instruction, or a verifier catches the same class of mistake a second time.
argument-hint: "<what was wrong and what should have happened>"
---

# Correct

Every correction is a design flaw in the system that let the mistake happen, not a fact for
Claude to remember. Push it down the ladder until the mistake is categorically impossible,
or as close to that as the repo allows, and log where it landed.

The ladder, strongest first (from Lauren Tan's "whenever you correct your agent"):

| Level | Mechanism | What it guarantees | Examples here |
|---|---|---|---|
| 1 | **Codebase** | The wrong thing can't be written or won't compile or run | A `parseLie()` at the API boundary so an invalid lie can't reach the DB; `@/` alias in `vitest.config.ts` so route handlers become testable; a DB enum or CHECK |
| 2 | **Static analysis** | The wrong thing fails `tsc`, lint, a test, or a CI gate | A test that pins the invariant; a lint rule banning inline `* 3` / `/ 3` outside `units.ts`; the `ci-local.sh` gates |
| 3 | **Rules and hooks** | Claude is told at the moment it matters, or the tool call is blocked | `CLAUDE.md` conventions; a hook on edits to `src/db/schema.ts` that says "run `pnpm db:generate`"; Claude Code Review on PRs |
| 4 | **Skills** | The workflow that would have avoided it is the default workflow | A line in `/verify`'s repo-specific checks; a lead-only file in `/brigade`'s station map; a rubric lens in `/how` |
| 5 | **Style guide** | Someone might read it | `README.md` prose. Last resort, and usually a sign the correction hasn't landed yet |

Trust is the inverse of the level: a level-1 or level-2 correction never needs checking
again; a level-5 correction will need repeating.

## Procedure

1. **State the correction as a rule**, in one sentence, with the mistake it prevents.
   "Shot bodies are parsed by `parseShotBody` before they reach `saveShotResult`; the route
   never casts `req.json()`."
2. **Check the ledger first.** `grep -i` the key words in `docs/corrections.md`. If it's
   there, the previous fix landed too high on the ladder: this is a repeat, and the job is to
   push it lower, not add another line. Say so in the report.
3. **Pick the lowest feasible level**, and say why the levels below it aren't feasible. A
   correction about behaviour lands at level 1 or 2 (a type, a parser, a test). A correction
   about process (what to run, what to quote, who verifies) lands at level 3 or 4. Level 5 is
   allowed only with a ledger note saying what would be needed to go lower.
4. **Implement it at that level**, and where the level is 3 or 4, also add the level-2 check
   that proves the rule is followed if one is possible (a test, a gate in `ci-local.sh`).
5. **Log it** in `docs/corrections.md`: date, rule, level, where it lives (path), the commit,
   and the mistake that prompted it. One line each.
6. **Run `/verify`** on the change like any other change. A correction that breaks the gates
   is not landed.

## When the correction is about a skill

Skills are code: they change in the same commit as the code they describe, and they are
checked by `ci-local.sh skills` (paths and commands they cite must exist). So:

- Cite functions and files, never line numbers, in `SKILL.md` and `references/`; line numbers
  rot within a week.
- Put the rule in the narrowest place it applies: a repo-specific check in `/verify` rather
  than a general sentence in `CLAUDE.md`; a station row in `/brigade` rather than a paragraph.
- Delete the sentence the rule replaces. A skill that grows by accretion is a style guide.
- Add a `Corrections encoded` line at the bottom of the skill that points at the ledger entry,
  so the next editor knows why the line exists before removing it.

## Report

```
Correction: <the rule>
Landed at: level N — <path or mechanism>
Why not lower: <one sentence, or "n/a">
Ledger: docs/corrections.md, <date> — <first words>
Proof: <the test, gate or hook, and the gate line showing it green>
```
