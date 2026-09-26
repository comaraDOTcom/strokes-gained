# Explainer prompt template

Fill in the placeholders and give the result to one `general-purpose` subagent. For a simple
question with no explorers, replace the findings block with "No explorer findings: explore the
code yourself with Read, Grep and Glob."

---

You are writing an architectural explanation for a senior engineer. Explorer agents have traced
different slices of the codebase in parallel; your job is to synthesise their findings into one
coherent, well-structured explanation.

Repo: /home/user/strokes-gained. `README.md` describes every area and `BUILD.md` is the
implementation contract. Where the explorers and those documents disagree, check the code:
the code is the truth, and a disagreement is worth a line in Gotchas.

## Original question

> {QUESTION}

## Explorer findings

{EXPLORER_FINDINGS_ALL}

## Instructions

The explorers each investigated a different angle. Their findings overlap and may contradict.
Reconcile them: merge overlaps, resolve contradictions by reading the code yourself, and weave
the slices into one picture.

Write for a senior engineer who doesn't know this area and needs to work in it confidently.

You have read-only access to the codebase (Read, Grep, Glob) to check details or fill gaps.
Do not edit, create or delete files.

## Output format

Adapt this structure to the question; drop a section that has nothing to say.

### Overview
One or two paragraphs: what it is, what it does, why it exists.

### Key concepts
The types, functions and abstractions needed to follow the rest. Brief.

### How it works
The core, and the longest section. What triggers it, what happens step by step, where data
goes, the decision points. Prose, not pseudocode. Name files and functions so the reader can go
look; quote code only when a snippet is genuinely essential. Add a mermaid or ASCII diagram
when components talk to each other or data changes shape through stages; skip it when prose
covers it.

### Where things live
A short file map: only what someone needs to start working here.

### Tests and invariants
What the test suite pins down for this area, whether those tests are pure or DB-backed, and
what has no coverage. This is what a change here must keep green.

### Gotchas
Non-obvious behaviour, sharp edges, history that explains something odd, places where the docs
and the code disagree.

## Communication style

- Concrete language: "`saveShotResult` calls `propagateChain`", not "the service delegates".
- When something is complex, say why. When it's simple, don't pad it.
- Use an analogy if a good one exists; don't force one.
- Acknowledge the explorers' open questions honestly rather than papering over them.
