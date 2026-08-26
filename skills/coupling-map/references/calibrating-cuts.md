# Calibrating the cuts for a new project

The thresholds in `arch.config.json` decide which files the report calls a problem. They were
derived from one real distribution and they do **not** transfer: the same numbers on another
codebase can flag four hundred files or none, and both failures look like the tool working.

Calibrate once, when the skill is first installed. Then freeze them.

---

## Why they cannot be percentiles

The obvious idea is "flag the worst 5%". Do not.

A percentile always finds the same number of files. Fix every one of them and the next run
returns a fresh 5%, indistinguishable from the first. The report exists to be run again after a
refactoring and show that something changed, and a percentile cut is mathematically incapable of
showing that. Absolute thresholds can go to zero; relative ones cannot.

The same argument rules out anything that rescales to the data — z-scores, deciles, "top N by".

---

## The procedure

### 1. Run once with placeholder cuts

Any values that do not abort. The detector lists will be wrong; the distribution will not be.

### 2. Read the distribution out of `architecture.json`

```bash
node -e "
const r = require('./architecture-report/architecture.json');
const p = (k, q) => r.files.map(f => f[k]).sort((a,b) => a-b)[Math.floor(r.files.length*q)];
for (const k of ['caStar','ceStar','loc','ce','ca'])
  console.log(k.padEnd(7),
    'p50', String(p(k,.5)).padStart(5),
    'p90', String(p(k,.9)).padStart(5),
    'p95', String(p(k,.95)).padStart(5),
    'p99', String(p(k,.99)).padStart(5),
    'max', String(Math.max(...r.files.map(f => f[k]))).padStart(6));
"
```

### 3. Choose `painCaStar` and `painLoc` by the size of the queue they produce

These two matter most: together they define the pain zone, which is the whole point of the
report. Sweep them and look at the count, not at the percentile:

```bash
node -e "
const r = require('./architecture-report/architecture.json');
for (const ca of [10, 15, 20, 30, 50])
  console.log(ca + ':', [200, 300, 400, 600].map(loc =>
    'LOC>=' + loc + ' ' + String(r.files.filter(f => f.caStar >= ca && f.loc >= loc).length).padStart(4)
  ).join('   '));
"
```

**Aim for a queue somebody can actually work through.** On a 959-file monorepo, twelve was right:
around 1% of the files, a few weeks of work, short enough to read in one sitting. Forty would be
a backlog nobody starts; three would miss real targets.

Then read the list itself and ask whether the files at the bottom of it belong there. On the
PABX monorepo the cut moved from `caStar >= 20` down to `15` for exactly that reason: at 20 the
queue dropped three 2000-line controllers that obviously belonged.

### 4. Set the remaining cuts against their detector

| Cut | Detector | How to choose |
|---|---|---|
| `ampLoc`, `ampCe`, `ampCa` | `amplifier` | Small file, imported by many, importing many. `ampLoc` below p50 of `loc`; `ampCe` and `ampCa` around p90 of each. Expect very few hits — one, on the reference monorepo. Dozens means the cuts are loose. |
| `leafCa` | `leafAsDependency` | Around p90 of `ca`. Also check `leafLayers` actually names layers that should be leaves in this project. |

### 5. Freeze them, and write down the run they came from

Put the date and the file count next to the values. A cut whose provenance is lost gets
"tidied" by the next person, and the whole series of reports stops being comparable.

---

## The reference calibration

From the PABX monorepo, 2026-08-25, 959 files. Useful as a shape, not as values to copy.

| | p50 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|
| `caStar` | 6 | 25 | 72 | 242 | 425 |
| `ceStar` | 9 | 32 | 70 | 109 | 638 |
| `loc` | 57 | 296 | 538 | 1650 | 4403 |
| `ce` | 2 | 8 | 11 | 22 | 91 |
| `ca` | 2 | 5 | 7 | 42 | 128 |

| Cut | Value | Catches | % of files |
|---|---|---|---|
| `painCaStar` / `painLoc` | 15 / 400 | 12 | 1.25% |
| `ampLoc` / `ampCe` / `ampCa` | 150 / 15 / 30 | 1 | 0.10% |
| `leafCa` | 10 | 3 | 0.31% |

---

## What a bad calibration looks like

**Everything is red.** The cuts are below the middle of the distribution. The report is now a
list of files, which is what `find` is for.

**Nothing is red on a codebase with known problems.** Usually `painLoc` set from intuition
rather than from the data — 1000 lines sounds like a lot until the p99 turns out to be 1650.

**The queue is full of tiny files with enormous `caStar`.** They are the foundation: small,
widely used utilities, exactly what a healthy system has. If they are being flagged, `painLoc`
is too low — that axis exists precisely to keep them out.

**A detector fires on nothing, ever.** Either the cut is unreachable, or the thing it looks for
does not exist in this project. Measure before assuming the first: a detector that was designed
here and deleted after measurement fired on 37 files, every one of them a framework artefact,
and on zero once those were excluded. Deleting it was the right answer.
