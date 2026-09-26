# Architectural critique rubric

Review through whichever lenses apply. Not every lens fits every subsystem.

## Abstraction fit

- Does each abstraction represent a real concept, or is it indirection "in case"?
- Are boundaries where things change independently?
- Is there accidental coupling, two components sharing implementation details they shouldn't
  need?
- Is business logic separated from framework wiring? (Here: pure functions in `src/lib/*`
  with thin pages and routes in `src/app/*` is the established pattern.)

Over-abstraction costs as much as under-abstraction. Flat and simple is fine for a simple domain.

## Data model

- Do the tables and types fit how data is actually accessed?
- Impedance mismatches: code constantly reshaping data because the model doesn't match use?
- Are types honest about what exists at runtime (nullable columns, legacy columns kept for
  data safety, display units vs stored units)?

## Boundary discipline

- Is validation concentrated at entry points (`entry.ts`, `details.ts`, `requests.ts`) or
  scattered?
- Are errors handled at boundaries (`HttpError` → `toErrorResponse`) and propagated cleanly?
- Does data cross boundaries in well-typed shapes or bags of optionals?
- Does every id from a URL go through `src/lib/auth/guards.ts`? Can the slice be tested in
  isolation (pure, or against PGlite)?

## Contract fit

This repo has an explicit contract. Check the code against it, and the contract against
reality.

- Does the implementation match the relevant `BUILD.md` phase (formulas, ordering rules,
  required tests)? Is a divergence documented in `README.md`?
- Are the stated invariants enforced in code and pinned by a test (the SG chain invariant,
  seed checksums, migration completeness, anonymisation of benchmark data)?
- Is there behaviour the docs describe that the code no longer has, or vice versa?

## Evolution readiness

- If the most plausible next requirement landed (a second country in the directory, a
  non-scratch baseline, a course rating for Portmarnock, multi-tee rounds), what changes: one
  file or everything?
- Hardcoded assumptions that would need relaxing?
- Bolted-on or integrated?
- Legacy paths preserved that nothing depends on?

Don't penalise for hypotheticals; focus on changes plausible from the codebase's trajectory.

## Complexity vs value

- Where is complexity concentrated: in the parts that must be complex (the engine, the chain,
  auth) or in accidental places?
- Simpler ways to get the same behaviour?
- Does every component earn its existence?

## Consistency

- Are similar problems solved the same way here as elsewhere in the repo (validator modules,
  `freshDb()` tests, semantic CSS classes, `[timing]` logs)?
- If patterns differ, is there a reason, or did it drift?
