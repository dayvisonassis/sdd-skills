---
name: coupling-map
description: Answers which files to refactor first to reduce systemic risk, by crossing blast radius (how many modules stop working if this one breaks) against size. On first use it asks permission, installs its own tooling and writes a config by reading the project; on every run after that it executes a versioned script and reads only that script's JSON output, never the source tree again. Produces a standalone HTML report with a scatter chart, a ranked queue and structural detectors. Unlike architecture-analyzer and deep-analyzer, which write prose about a codebase, this one measures it.
---

# Coupling Map

Answers one operational question: **which files should be refactored first to reduce systemic
risk.** A file qualifies when both conditions hold — it does too much, and enough of the system
depends on it that breaking it breaks several other parts.

The output is a standalone HTML report. It is **diagnostic, not a gate**: it fails no build and
blocks no commit.

> References, loaded on demand, all of which travel with this skill:
> `references/config-schema.md` (every field of `arch.config.json`),
> `references/report-contract.md` (the shape of `architecture.json`),
> `references/calibrating-cuts.md` (deriving thresholds for a new codebase),
> `references/rejected-metrics.md` (**read before proposing any metric or axis**).
>
> The full design argument lives in `docs/Skill_Coupling_Map.md` of the **sdd-skills**
> repository, which is not part of an installed copy. Everything needed to run is in the folder
> you are reading.

**The point of the split is cost.** The model inspects the tree exactly once, to write a config
of about thirty lines. From then on it reads a single JSON file. On the codebase this was built
against that is one file instead of 959, and the numbers are identical either way because the
script computed them, not the model.

## INPUT

Nothing required. Optionally a path to scope the run, `--config` / `--out` to override
locations, and `--open` to launch the finished report in the default browser.

## OUTPUT

- `architecture-report/index.html` — the report, opened straight from disk. The script prints
  it as an absolute `file://` URL, which most terminals turn into a link and which pastes into a
  browser as-is. **Hand that link to the reader**; a relative path leaves them working out where
  the file went.
- `architecture-report/architecture.json` — the data, and the only file this skill reads on
  later runs
- A short spoken summary: the queue, what moved since the previous run, and what needs a human

## PHASE 1 — Preflight

Three checks, in this order. **All three passing means skip straight to Phase 3.**

```bash
node -e "require.resolve('madge')" && echo "madge ok"
test -f scripts/arch-report.mjs && echo "script ok"
test -f arch.config.json && node -e "JSON.parse(require('fs').readFileSync('arch.config.json','utf8'))" && echo "config ok"
```

Never reinstall or regenerate what already answers. If only some pass, do only the missing part
of Phase 2.

## PHASE 2 — First run only

### 2.1 Ask permission before installing anything

Say what will be installed, where, and that nothing else changes. Wait for an answer.

### 2.2 Install madge at the repository ROOT

```bash
npm install --save-dev madge
```

**At the root, not inside a sub-app.** A monorepo app frequently carries peer conflicts of its
own, and installing there drags the tool into somebody else's dependency argument.

**Graphviz is not needed.** It is required only by `madge --image`, which this never uses — the
script reads `obj()` and draws the chart itself. That removes the one system binary most likely
to fail to install.

### 2.3 Copy the script into the project

```bash
cp <skill>/scripts/arch-report.mjs scripts/
cp -r <skill>/scripts/coupling-map scripts/
```

Copy, never rewrite. See the rules.

### 2.4 Write `arch.config.json` by reading the project

This is the one moment the tree is inspected. Load `references/config-schema.md` and determine:

- **the apps** — every independently resolved source tree, one entry each
- **`extensions` and `exclude`** — and remember that migrations, fixtures, generated JSON and
  test folders are not application code
- **`tsConfig`** — for any TypeScript app. Omitting it is the most damaging single mistake
  available here
- **`importPrefixes`** — the non-relative prefixes the project resolves internally, read out of
  `baseUrl` and `paths`
- **`domainFrom` / `layerFrom` / `layers` / `layerOrder`** — how this project names things,
  which is rarely how the last one did
- **`leafLayers`** — layers meant to be *called*, never *imported*

Write it with a file tool, never a shell heredoc: the exclude patterns carry backslashes.

### 2.5 Calibrate the cuts

Placeholder thresholds first, then follow `references/calibrating-cuts.md`. **The values from
another project do not transfer.** Aim for a queue somebody can work through — on a 959-file
codebase, twelve.

### 2.6 Run it and check the run before believing it

```bash
node scripts/arch-report.mjs --open
```

`--open` launches the report in the default browser once it is written. Without it the script
only prints the link, which is the better default when the run is not being watched.

Confirm, in order:

1. **Coverage sits between the floor and the ceiling.** Below, the graph lost edges — check
   `tsConfig`. Above, the denominator is blind — check `importPrefixes`. The script aborts on
   either and writes nothing.
2. **`Σ Ca*` equals `Σ Ce*`.** Printed on every run. They count the same pairs from opposite
   ends, so a mismatch is a traversal bug, never a property of the code.
3. **The `(sem domínio)` count is small.** A large bucket means the taxonomy does not fit this
   project.
4. **Read the queue and sanity-check it.** If it names small widely-used utilities, `painLoc` is
   too low.

## PHASE 3 — Every run

```bash
node scripts/arch-report.mjs
```

Add `--open` when a person is at the screen and wants to look; leave it off otherwise, and give
them the printed link instead.

Then **read `architecture-report/architecture.json` and nothing else.** Do not open source
files. Every number the answer needs is already computed.

Report:

- **the queue** — the pain-zone files in order, with `Ca*`, `LOC` and any second detector
- **what moved**, if a previous `architecture.json` is available: files entering or leaving the
  queue, cycles opened or closed, coverage drift
- **the counters** — amplifiers, controllers used as dependencies, direction violations, cycles,
  orphans
- **what the numbers cannot decide.** The report ranks by risk; whether a given refactoring is
  worth doing now is a human call

When reporting, say `Ca*` and `Ce*` in words. The reader is not required to know the vocabulary,
and the sidebar of the report spells both out.

## RULES

**Never regenerate the script.** It is versioned in this skill and copied verbatim. A script
written fresh per project produces as many divergent variants as there are projects, none
reviewed, none fixable centrally, and all of them outside the repository the team receives skills
from.

**Never read the source tree in Phase 3.** Reading hundreds of files to produce numbers the
script already computed is exactly the cost this skill exists to avoid.

**Never lower a coverage limit to make a run pass.** Both limits mark a broken run, not a strict
one. Fix the resolution or the denominator.

**Cuts are absolute and frozen; never percentiles.** A percentile always finds the same share of
files, so a report that exists to show improvement becomes incapable of showing it.

**High `Ca` alone is not a defect.** A 43-line utility that 131 files import is correct. Say so
when reporting, or someone will refactor the foundation of the system. That risk is the reason
the chart has two axes.

**Read `references/rejected-metrics.md` before proposing a metric.** Abstractness, distance from
the main sequence, LCOM, a weighted God-class score and a composite health rating were each
implemented or measured against a real codebase and removed. Every one is the obvious next
suggestion.

**Leave the report where it can be reopened.** It is a single self-contained file that makes no
external request; it needs no server and no network, and it opens from `file://` — there is
nothing to serve and nothing to automate a browser for.

**Never open the report without being asked.** `--open` exists because the reader asked for it.
A run that nobody is watching should not seize the screen.

## Edge cases

**A single-app project.** One entry in `apps`. Nothing else changes.

**No `tsconfig.json`.** Fine for a JavaScript project — omit `tsConfig`. If the project *is*
TypeScript and has none, say so rather than running without it; coverage will abort anyway.

**Apps that genuinely import each other.** The default assumes separately deployed trees with no
edges between them. If they do share code, they belong in one app entry, or the graph will be
cut where the imports really run.

**A first run with no cycles and no violations.** A real and good result. Report it as such
rather than hunting for something to flag.

**A previous run used different cuts.** `meta.cuts` records them. Comparing across a cut change
compares two different questions — say so instead of reporting movement that is an artefact.

**`--open` does nothing, or opens the wrong application.** The report is still written and the
link still printed — the flag is a convenience over the operating system's default handler, and a
headless machine or a container has none. Never treat a failed open as a failed run.

**The project already has a `scripts/` entry point of its own.** Copy under a subfolder and pass
`--config` and `--out` explicitly rather than overwriting anything.
