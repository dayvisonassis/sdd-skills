# `architecture.json` — contract

Written to `<outDir>/architecture.json` (default `architecture-report/architecture.json`) by
`node scripts/arch-report.mjs`. Two consumers, and they are the reason this file exists at all:

- **`index.html`**, rendered from the same object in the same run;
- **the skill itself on a later run**, which reads this file and the previous one and reports
  what moved — without reading the source tree again.

The second consumer is what makes the contract worth pinning: a field renamed between versions
breaks the before-and-after comparison, silently, months later.

---

## Invariants

These hold for every run, and one that breaks is a defect in the tool, not in the code being
measured.

1. **No timestamp is written anywhere.** Two runs over an unchanged tree produce **byte-identical**
   files. Comparing before and after a refactoring must show the refactoring, not the clock.
   `meta.generatedFrom` records the commit instead, which is what actually distinguishes two runs.
2. **Every array is sorted deterministically** — files and domains by path/name, detector lists by
   path, `directionViolations` by `from` then `to`, each cycle's members sorted and the cycles
   sorted by their first member. Nothing depends on filesystem or `madge` traversal order.
3. **`Σ files[].caStar === Σ files[].ceStar`.** Every "I break something" is somebody else's "I get
   broken". The CLI prints this sum on every run and labels it `OK` or `BROKEN`. On the PABX
   monorepo both sides are 15987.
4. **Every file has a `domain` string.** There is no `null` domain and no missing one: a file whose
   domain cannot be derived is placed in the visible bucket `(sem domínio)` and counted in
   `totals.unclassified`. Unclassifiable is a reported state, never an absent one.
5. **Paths are repo-relative, POSIX-separated, and normalised.** No drive letter, no backslash, no
   `../` survives. `madge` follows imports out of the configured root and returns
   `apps/backend/src/../database.js`; that is one node named `apps/backend/database.js`, not a
   second node for the same file.
6. **The file is written only if the run passes the coverage floor.** On abort nothing is written —
   `index.html` included, so there is never a rendered report standing on numbers the tool does not
   trust — and the process exits `1`.

---

## Shape

```jsonc
{
  "meta": {
    "scriptVersion": "1.0.0",     // version of arch-report.mjs, not of the project
    "generatedFrom": "1aec935a…", // git HEAD at generation, or null outside a repo
    "cuts": { }                   // the cuts object copied verbatim from arch.config.json
  },
  "totals": {
    "files": 959,                 // nodes in the graph, after path normalisation
    "edges": 3139,                // resolved import edges
    "declared": 3161,             // internal imports counted in the source text
    "coveragePct": 99.3,          // 100 * edges / declared, one decimal
    "unclassified": 28,           // files whose domain is "(sem domínio)"
    "unreadable": 0,              // files madge listed that could not be read; loc counted as 0
    "coverageByApp": [
      { "name": "frontend", "files": 679, "edges": 2468, "declared": 2469, "unreadable": 0, "coveragePct": 100.0 },
      { "name": "backend",  "files": 280, "edges": 671,  "declared": 692,  "unreadable": 0, "coveragePct": 97.0 }
    ]
  },
  "files": [],
  "domains": [],
  "detectors": {}
}
```

`meta.cuts` is copied in on purpose: reading an old report must not require finding the config that
produced it.

`totals.coveragePct` is a floor, not an equality: `declared` is a regex count over the source, so
it lands near 100% rather than on it, and can sit either side. `countDeclared` anchors on the
specifier rather than the statement, which is what lets one newline-free pattern cover static,
multi-line and re-export forms alike. See `config-schema.md`.

`totals.coverageByApp` exists because the floor is checked per app as well as in total: one small
misconfigured app is otherwise diluted by a large healthy one, and the aggregate alone would not
say which app to fix.

### `files[]` — one entry per node, sorted by `path`

| Field | Type | Meaning |
|---|---|---|
| `path` | string | Repo-relative, POSIX separators. The identity of the node. |
| `app` | string \| null | App name from the config. `null` for a node no app claimed. |
| `domain` | string | Never null. `(sem domínio)` for the visible bucket. |
| `layer` | string \| null | `null` when the file matches no name in the app's `layers`. |
| `loc` | number | `source.split('\n').length`. A newline-terminated file therefore counts one more than `wc -l` reports; the measure is comparative and the convention is stable across runs. `0` means the file could not be read. |
| `ce` | number | Efferent coupling: direct imports out. `dependsOn.length`. |
| `ca` | number | Afferent coupling: direct importers. `dependedOnBy.length`. |
| `ceStar` | number | Transitive dependencies, over the condensed graph. |
| `caStar` | number | Transitive dependents — the blast radius. The primary ranking metric. |
| `i` | number \| null | Instability `ce / (ca + ce)`. **`null`, not `0`, when `ca + ce === 0`** — an orphan has no instability, and `0` would place it at the "maximally stable" end of the axis, next to genuine foundations. |
| `dependsOn` | string[] | Sorted paths. |
| `dependedOnBy` | string[] | Sorted paths. |
| `detectors` | string[] | Which detectors matched: any of `pain`, `amplifier`, `leafAsDependency`, `directionViolation`, `cycle`, `orphan`. Empty array when none. |

**`caStar` and `ceStar` exclude the other members of the node's own strongly connected component.**
A file already in a cycle with another is not "broken by consequence" of it — they are one unit,
and the cycle is reported by its own detector. This is why `audit.model.js` and
`authorization.middleware.js`, which import each other, have `caStar` 100 and not 101.

### `domains[]` — one entry per domain, sorted by `domain`

| Field | Type | Meaning |
|---|---|---|
| `domain` | string | Domain name, `(sem domínio)` included. |
| `apps` | string[] | Sorted, deduplicated, nulls dropped. More than one entry means the domain spans apps. |
| `files` | number | Count of files. |
| `loc`, `ce`, `ca` | number | **Sums** over the domain's files. |
| `caStar`, `ceStar` | number | **Maximums**, not sums. |

The maximum is the load-bearing decision. Summing `caStar` over a domain double-counts every
dependent shared by two of its files and can exceed the number of files in the repository — a
quantity that means nothing. The maximum answers the question actually being asked: how far does
the worst file in this domain reach?

### `detectors`

| Key | Type | Contents |
|---|---|---|
| `pain` | string[] | Paths with `caStar >= painCaStar` **and** `loc >= painLoc`. The refactoring queue. |
| `amplifier` | string[] | Paths with `loc <= ampLoc`, `ce >= ampCe`, `ca >= ampCa`. |
| `leafAsDependency` | string[] | Paths in a `leafLayers` layer with `ca >= leafCa`. |
| `directionViolations` | object[] | `{ from, to, fromLayer, toLayer }`, same-app edges only, where the target sits earlier in `layerOrder` than the source. |
| `cycles` | string[][] | Each strongly connected component of size > 1, plus any self-loop. |
| `orphans` | string[] | `ca === 0 && ce === 0`. |

A path may appear in several lists; `files[].detectors` is the same information indexed the other
way, so the HTML never has to cross-reference six arrays per row.

**High `Ca` alone is in no list, deliberately.** A widely imported 40-line service is a foundation,
not a defect. Only the conjunction with size makes it a problem, which is why the chart has two
axes.

---

## Reading it on a later run

Load the previous `architecture.json` and the new one and diff by `path`. What matters is entries
**entering and leaving `detectors.pain`**, and `caStar` moving on files that stayed. `totals.files`
and `totals.edges` rising together is ordinary growth; `totals.coveragePct` dropping between two
runs means resolution broke, and every other number in the file became an understatement — check
the config before reading anything else.
