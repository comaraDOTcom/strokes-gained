# Ticket

One ticket per cook. Everything a cook needs is on the ticket; a cook never has to ask.

```
## Ticket <id>: <one-line goal>

**Station:** <from stations.md>
**Branch / worktree:** <the cook's isolated worktree; the chef fills this in from the Agent result>
**Base commit:** <sha ci-local.sh fast was green on>

### Goal
<Two to five sentences. What must be true when this is done, in behaviour terms.>

### Contract
<The BUILD.md / README.md sections that govern this, quoted or linked by heading. If the
change alters documented behaviour, say which doc line must change and that the CHEF will
change it (docs are lead-only).>

### Owned files (the only files you may change)
- src/lib/rounds/save-shot.ts
- src/lib/rounds/save-shot.test.ts

### Forbidden
- Everything else, and in particular: <any file a neighbouring ticket owns>.
- If you need another file, STOP and report why. Do not touch it.

### Acceptance criteria (each one is a command or a test name)
- [ ] `ci-local.sh tests src/lib/rounds` green
- [ ] new test `save-shot.test.ts › marking an edited shot holed deletes the shots after it` exists and passes
- [ ] `ci-local.sh fast` green on your final commit
- [ ] no change to any file outside "Owned files"

### Tests to add or keep
<Named cases. Include the invariant the station owns.>

### Out of scope (seen, not for you)
<Things the chef already knows about so the cook doesn't "helpfully" fix them.>
```
