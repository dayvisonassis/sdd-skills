# `arch.config.json` — field reference

The only per-project artefact this skill generates. It lives at the **repository root**, next to
where `node scripts/arch-report.mjs` is run from, and it is declarative: no code, no glob
gymnastics, nothing that has to be re-derived on each run.

Two rules govern every field below.

1. **The cuts are absolute and frozen.** They are thresholds calibrated against a real
   distribution, never percentiles. A percentile cut always finds the same number of files, so a
   report before a refactoring and a report after it would look identical — which destroys the
   only comparison the tool exists to support.
2. **Nothing here is a formatting preference.** Each field changes which files are read, how they
   are named, and therefore which files reach the refactoring queue. Changing one changes the
   answer.

---

## Top level

| Field | Type | Required | Meaning |
|---|---|---|---|
| `minCoveragePct` | number | no (default `85`) | Coverage floor. Below it the run **aborts** and writes nothing. See "The coverage floor" below. |
| `maxCoveragePct` | number | no (default `130`) | Coverage ceiling. Above it the run **aborts** too. More edges than declared imports means the denominator is blind to a form the project uses — nearly always a missing `importPrefixes`. |
| `apps` | array of app objects | yes | One entry per independently resolved source tree. Each one is a separate `madge` invocation. |
| `leafLayers` | array of strings | yes | Layer names that are supposed to be *called*, never *imported*. Feeds the `leafAsDependency` detector. |
| `cuts` | object | yes | The six calibrated thresholds. |

## App object

| Field | Type | Required | Meaning |
|---|---|---|---|
| `name` | string | yes | Appears in the report as `file.app`, and is how `layerOrder` is looked up. |
| `root` | string | yes | Repo-relative directory handed to `madge`. Paths in the report are re-anchored to the repo root, so `root` is a scan boundary, not a display prefix. |
| `extensions` | array of strings | yes | Without the dot: `["ts"]`, `["js"]`. Files outside this list are invisible to the graph — an app with `.tsx` files and `["ts"]` here silently loses them. |
| `exclude` | array of strings | yes | Regex **sources**, as strings. `madge` runs them through `new RegExp(...)`, so a string keeps the file JSON-serialisable, and a backslash has to be escaped for JSON: `"\\.spec\\.ts$"`. Matched against the path **relative to `root`**, which is why `"/docs/"` catches `../docs/swagger.json` but not `docs/index.js` directly under `root`. |
| `tsConfig` | string | no | Repo-relative path to a `tsconfig.json`. Read with the TypeScript compiler API so that non-relative imports resolved through `baseUrl`/`paths` become edges. **Omitting it on a TypeScript app is the single most damaging mistake possible here** — see below. |
| `importPrefixes` | array of strings | no (default `[]`) | The non-relative prefixes this app resolves internally, taken from `baseUrl`/`paths`: `["app/", "@app/", "~/"]`. Relative forms are always counted and never listed. Feeds the coverage denominator only — the graph itself comes from `madge`. **Getting this wrong does not fail loudly on its own**, which is why the ceiling exists. |
| `domainFrom` | `"firstFolderUnder"` \| `"basename"` | yes | How the domain name is derived. |
| `domainBase` | string | with `firstFolderUnder` | The folder whose immediate child names the domain. |
| `layerFrom` | `"suffix"` \| `"folder"` | yes | How the layer is derived. |
| `layers` | array of strings | yes | The closed vocabulary of layer names. Anything not on the list yields `layer: null`. |
| `layerOrder` | array of strings | yes | The permitted direction of dependency, from outermost to innermost. An edge that points from a lower index to a higher one is a direction violation. Layers absent from this list are never judged. |
| `requireLayerForDomain` | boolean | no (default `false`) | When true, a file with no layer gets no domain either: it goes to the `(sem domínio)` bucket instead of inventing one. |

### `domainFrom`

- **`firstFolderUnder`** — the domain is the folder immediately below `domainBase`. For
  `app/agent-dashboard/webphone/webphone.component.ts` with `domainBase: "app"`, the domain is
  `agent-dashboard`. A file sitting directly in `domainBase` uses its own basename, stripped of
  the layer suffix. A file with no `domainBase` segment at all goes to `(sem domínio)`.
- **`basename`** — the domain is the file's own name with the layer suffix removed:
  `models/user.model.js` is domain `user`. This is what fits a backend organised
  layer-first (`controllers/`, `models/`, `routes/`), where the folder names the layer and the
  file names the subject.

### `layerFrom`

- **`suffix`** — the second-to-last dot-separated segment of the filename, when it is in
  `layers`. `toast.service.ts` is layer `service`. A file with fewer than three segments
  (`main.ts`) has no layer.
- **`folder`** — the first path segment that appears in `layers`. `api/v2/models/user.model.js`
  is layer `models`.

### `exclude` — patterns are matched against the path **relative to that app's root**

This is the field most likely to be got wrong on a new project, because the patterns look like
repo-relative paths and are not. `madge` tests each pattern against the path it uses internally,
which is relative to that app's `root`. Consequences worth knowing before writing a config:

- `"/docs/"` on an app rooted at `apps/backend/src` matches `../docs/swagger.json` — a file
  *above* the root, reached because `madge` follows imports out of it — and does **not** match
  `docs/index.js` sitting directly under the root. Here that is exactly right: the first is a
  55,580-line generated artefact, the second is real routing code.
- A pattern written as `"apps/backend/src/legacy/"` matches nothing at all. Write `"legacy/"`.
- Anchors behave accordingly: `"^config/"` anchors at the root, not at the repository.

When a pattern seems not to work, print the paths first — an app whose files come back as
`../../shared/x.ts` is telling you the `root` is narrower than the code it is pulling in.

### `requireLayerForDomain` — why the backend sets it and the frontend does not

On a layer-first backend, `domainFrom: "basename"` applied to a file that lives outside every
layer folder manufactures a domain out of nothing: `database.js`, `knexfile.js`, `ami.js` and
`api/v2/index.js` would become four single-file domains, and `index` would appear on the chart as
if it were a feature. Those files are infrastructure. `requireLayerForDomain: true` sends them to
the visible `(sem domínio)` bucket, where they are counted and reported rather than disguised.

On the frontend the domain comes from the folder, so a file with no layer suffix still has a real
domain. The flag would only throw information away there.

---

### `importPrefixes` — the denominator has to know the project's aliases

Coverage is resolved edges over declared imports, and the counter finds a declared import by the
shape of its specifier: `'./x'`, `'../x'`, or a prefix this field lists. `madge` resolves
`baseUrl` and `paths` aliases into real edges regardless, so an app that uses them and does not
declare them here produces **more edges than declared imports**.

Measured on this monorepo: removing `importPrefixes` from the frontend moves its coverage from
100.0% to **176.5%**. Nothing about that number is subtle, and yet a guard with only a floor
would let it through — which is exactly why `maxCoveragePct` was added. Read the two together:

- **below the floor** — the graph is missing edges. Usually `tsConfig`.
- **above the ceiling** — the denominator is missing imports. Usually `importPrefixes`.

## The coverage floor

`madge` **discards** an import it cannot resolve instead of leaving the edge dangling. Counting
"edge targets that are not in the file set" therefore returns 0.00% both when everything resolved
and when half the graph vanished — it measures zero in exactly the failure mode it would exist to
catch. So coverage is measured differently: **resolved edges against internal imports declared in
the source text**, per app and in total. The run aborts if either falls below the floor.

Measured on the PABX monorepo, dropping `tsConfig` from the frontend app:

| | edges | declared | coverage |
|---|---|---|---|
| frontend **with** `tsConfig` | 2468 | 2469 | 100.0% |
| frontend **without** | 1394 | 2469 | 56.5% |
| backend | 671 | 692 | 97.0% |

43.5% of the frontend graph disappears, and the report still renders and still looks plausible.
That is the worst failure this tool can have, and the floor is what prevents it.

Coverage is a floor, never an equality — the denominator is a regex count, so treat anything in
the high nineties as healthy. Do not "fix" it into an equality, and **never lower the floor to
make a run pass**: a failing run means the resolution is broken, and the fix is the `tsConfig`
path or the `extensions` list.

`countDeclared` **anchors on the specifier, not on the statement**, which is what keeps the list
of misses short. It counts four forms — `from '<internal>'`, a bare `import '<internal>'`,
`import('<internal>')` and `require('<internal>')` — all sharing one prefix alternation. Because
`from` always sits on the same line as the specifier it introduces, static imports, `export * from`,
`export { a } from` and every multi-line form are covered by a single pattern that never crosses a
newline. An earlier version matched `import`/`export` and then walked to `from`, and multi-line
imports were invisible to it; at `printWidth: 80` that is most of a TypeScript file.

**The direction of an error here is counter-intuitive.** Coverage is `edges / declared`, so
undercounting `declared` makes coverage read *higher* and the guard *less* likely to fire — the
broken report ships, which is the precise failure the floor exists to prevent. Overcounting only
aborts a healthy run and sends someone to look, which is cheap and self-correcting. When in
doubt, count it — a `from './x'` inside a comment or a template literal is counted, and that is
the acceptable side of the trade. The one thing never to count is a **package** import: `rxjs`,
`@angular/core` and `fs` never become edges, so counting them would depress coverage against a
denominator `madge` was never going to resolve. `@angular/core` and `core-js/stable` are both
pinned as negative cases in `scripts/test/declared.test.mjs`, because they are exactly what a
loosely anchored prefix swallows.

The check is applied **per app as well as to the total**, because a single misconfigured small app
is otherwise diluted by a large healthy one.

---

## Worked example — the PABX monorepo

```json
{
  "minCoveragePct": 85,
  "apps": [
    {
      "name": "frontend",
      "root": "apps/frontend/src",
      "extensions": ["ts"],
      "exclude": ["\\.spec\\.ts$", "node_modules", "/dist/"],
      "tsConfig": "apps/frontend/tsconfig.json",
      "domainFrom": "firstFolderUnder",
      "domainBase": "app",
      "layerFrom": "suffix",
      "layers": ["component", "service", "model", "module", "guard", "interceptor", "directive", "pipe", "resolver", "helpers"],
      "layerOrder": ["component", "service", "model"]
    },
    {
      "name": "backend",
      "root": "apps/backend/src",
      "extensions": ["js"],
      "exclude": ["node_modules", "__tests__", "/docs/", "\\.json$"],
      "requireLayerForDomain": true,
      "domainFrom": "basename",
      "layerFrom": "folder",
      "layers": ["routes", "controllers", "models", "services", "middleware", "functions", "utils", "config", "jobs", "socket"],
      "layerOrder": ["routes", "controllers", "models"]
    }
  ],
  "leafLayers": ["controllers"],
  "cuts": { "painCaStar": 15, "painLoc": 400, "ampLoc": 150, "ampCe": 15, "ampCa": 30, "leafCa": 10 }
}
```

Four values in it are results, not preferences:

- **`/docs/` and `\.json$` on the backend.** `madge` follows imports *out of* `root`, and without
  these it pulls in `swagger.json` — 55,580 lines — which flattens the LOC axis for everything
  else. With them, the largest file in the graph is `dialer.model.js` at 4,403 lines, which is
  real code.
- **`leafLayers` holds `controllers` only.** With `component` on the list the detector accuses
  `breadcrumbs.component.ts` (Ca 69), `loading.component.ts` (42), `pagination.component.ts` (41)
  and `confirm-dialog.component.ts` (40) — shared components being correctly reused. "A leaf layer
  should not be a dependency" is true of a backend controller, which should be reached through a
  route, and false of a frontend component, where reuse is the point.
- **`painCaStar` is 15, not 20.** At 20 the queue holds 9 files and drops
  `reports.controller.js` (2,027 lines), `reports-agent.model.js` (2,254) and `agents.model.js`
  (1,794). At 15 it holds 12 of 959 files (1.25%) and includes them.
- **`painLoc` is 400.** It is the axis that separates *foundation* from *danger*:
  `toast.service.ts` has the fourth-largest `Ca*` in the repository (409) and stays out of the
  queue, because it is 44 lines and there is nothing to refactor in it.

## The `cuts` object

| Cut | Value | Detector | Fires on |
|---|---|---|---|
| `painCaStar` + `painLoc` | 15 / 400 | `pain` | `caStar >= 15` **and** `loc >= 400` — big blast radius *and* too much code |
| `ampLoc`, `ampCe`, `ampCa` | 150 / 15 / 30 | `amplifier` | small file that imports a lot and is imported by a lot — a hub that propagates change without owning any |
| `leafCa` | 10 | `leafAsDependency` | a file in a `leafLayers` layer with `ca >= 10` |

Cycles and orphans have no cut: a cycle is a strongly connected component of more than one node
(or a self-loop), and an orphan is `ca === 0 && ce === 0`.

---

## Deriving a config for a project that names things differently

Answer four questions by looking at the tree, in this order.

1. **How many independently resolved trees are there?** One `apps` entry per compilation unit —
   per `tsconfig.json`, per language, per package. Two apps that share a resolver are one entry.
2. **Does the folder or the filename carry the layer?** `controllers/user.js` means
   `layerFrom: "folder"`; `user.controller.js` means `layerFrom: "suffix"`. If both are present,
   prefer `folder`: it survives files that were never renamed to the convention.
3. **What is left once the layer is removed?** If a folder remains — `app/<feature>/` — that is
   the domain, so `firstFolderUnder` with `domainBase` set to the folder above it. If nothing
   remains but the filename, use `basename`, and set `requireLayerForDomain: true` so files
   outside every layer folder do not become fake domains.
4. **Which layer is supposed to be an endpoint rather than a dependency?** That, and only that,
   goes in `leafLayers`. If nothing in the project fits, leave the array empty — an empty
   `leafLayers` is a correct answer, and a wrong one produces a list of "problems" that are the
   architecture working as designed.

`layerOrder` is a subset of `layers`, listing only the layers whose direction is actually a rule.
Leaving a layer out means edges into and out of it are never reported as violations, which is the
right default for cross-cutting things like `utils` or `config`.

Do not add a fifth question. The rest of the fields are mechanical.
