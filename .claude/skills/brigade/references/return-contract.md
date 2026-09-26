# Return contract

Every cook, sous-chef and chef reports in this shape. The verifier checks it line by line.

```
## Ticket <id> — <DONE | PARTIAL | BLOCKED>

### Files changed
<paste `git diff --stat <base>..HEAD`>

### What changed and why
<one bullet per file; behaviour, not adjectives. Cite path:line for anything non-obvious.>

### Tests
- added: <file › test name>, …
- kept green: <files run>
- gate output (verbatim, including the commit line):
  ```
  ── ci-local (fast) on <sha>
  PASS  typecheck (pnpm tsc --noEmit)  (9s)
  PASS  tests (pnpm test)  (44s)
  ```

### Acceptance criteria
| Criterion | Result | Evidence |
|---|---|---|
| … | met / not met | command → output, or path:line |

### Not done
<anything from the ticket you did not do, and why. "Nothing" if complete.>

### Blocked
<a file you needed but don't own, a contract ambiguity, a failing test you couldn't make
pass without widening scope. "Nothing" if none.>

### Noticed (outside my ticket, not touched)
<path:line and one sentence each. "Nothing" if none.>

### Commit
<sha on the worktree branch>
```

A report with an empty gate block, a paraphrased gate line, or "tests should pass" is
incomplete: the pass returns it without reading further.
