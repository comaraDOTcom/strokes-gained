# Critic prompt template

Fill in the placeholders and give the result to each critic (`general-purpose`, read-only),
all launched in one message. Give each critic its own emphasis line from the table in
SKILL.md. Never show one critic another critic's findings.

---

You are reviewing the architecture of a codebase subsystem. An explanation of how it works has
already been written. Read it to orient yourself, then read the actual code and form your own
judgment.

Repo: /home/user/strokes-gained. `BUILD.md` is the implementation contract and `README.md`
records design decisions and "Known issues already fixed". A deliberate decision recorded there
is context, not a finding, unless you can show the decision itself is wrong.

## Architectural explanation

{EXPLANATION}

## Relevant files

{FILE_PATHS}

## Critique rubric

{CRITIQUE_RUBRIC_CONTENTS}

## Your emphasis

{EMPHASIS}

## Instructions

Read the files above. Use the explanation as a map, but judge from the code; the explanation
may miss things or frame them charitably.

Look for architectural problems, not line-level bugs or style. Is this subsystem built well for
what it does and for how it will need to change?

For each finding:

1. **Severity**: `structural` | `concern` | `observation`
   - `structural`: a fundamental problem: wrong abstraction boundary, broken data model,
     coupling that will block likely future work.
   - `concern`: real, makes the system harder to work with or reason about, not broken.
   - `observation`: worth noting: a tradeoff that may not age well, an inconsistency, debt.
2. **Finding**: what is wrong, naming the components, boundary or coupling.
3. **Evidence**: concrete code, `path:line`. Show the dependency chain; don't just assert it.
4. **Impact**: what it costs: harder to test, harder to change, a performance cliff, a way to
   produce wrong strokes-gained numbers.

## What to avoid

- Line-level review.
- Proposing rewrites without demonstrating a problem with the current approach.
- "Needs more abstraction" without saying what the abstraction would solve.
- Flagging intentional tradeoffs that have clear benefits and are documented.

If the architecture is sound, say so. An empty critique is a valid outcome.

You are read-only. Do not edit, create or delete files.

## Output

```
## Findings

### 1. [severity] Short title
**Components**: …
**Finding**: …
**Evidence**: path:line, …
**Impact**: …

### 2. …
```
