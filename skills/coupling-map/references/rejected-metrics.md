# Metrics that were tried and rejected

Every entry here was implemented or measured against a real codebase and then removed. They are
recorded because each one is the *obvious* next suggestion, and rediscovering why they fail costs
a day.

Read this before adding a metric or an axis. The full argument, with the session that produced
it, is in `docs/Skill_Coupling_Map.md` of the **sdd-skills** repository — which is not part of an
installed copy, so the essentials are repeated here.

The reference measurements come from a monorepo of 959 analysable files: 679 TypeScript
(Angular) and 280 JavaScript (Node/Express).

---

## `A` — abstractness, and everything built on it

**Robert Martin's `A` = abstract types / total types.** Rejected: it is bimodal in TypeScript and
absent in JavaScript.

Measured on the reference codebase:

| | |
|---|---|
| `export abstract class` | **0** in 678 TypeScript files |
| files with `export interface` | 182, and every one of them a DTO |
| files with `export class` | 542 |
| the JavaScript half | 280 files with no such concept at all |

A TypeScript file is usually *all* interface or *all* implementation, so `A` lands on 0 or 1 and
never in between — the middle ground Martin's model assumes belongs to languages where an
abstract class with concrete methods is routine.

**Before proposing `A` for another project, count its abstract classes.** If the answer is a
handful, the axis will be a horizontal line of dots.

## `D` — distance from the main sequence

`D = |A + I − 1|`. With `A = 0` almost everywhere this collapses to `D = 1 − I`: a second axis
that restates the first. A two-dimensional chart plotting one variable twice.

## The main sequence line

The diagonal is meaningful in Martin's diagram because `A` and `I` have a theorised ideal
relationship. The axes this report uses — blast radius against size — have none, and a line drawn
to fill the visual slot would be decoration.

An honest analogue was attempted: risk as `caStar × loc`, which on log-log axes is a straight
line of slope −1, geometrically identical to Martin's. It selects **62 files against the pain
zone's 12**, and the extras are led by the healthiest files in the repository — a 168-line
snackbar component, an 82-line error handler, a 71-line model. The product is dominated by
`caStar` whenever a file is tiny and widely imported, so the line puts the foundation of the
system on the wrong side. Rejected on measurement, not on taste.

## The zone of uselessness

Defined as `A ≈ 1` and `I ≈ 1`. With `A = 0` it is unreachable by construction. Drawing an empty
region and labelling it is worse than omitting it.

## LCOM — lack of cohesion of methods

The classic single-responsibility metric, and the one that seems most obviously right. It
degenerates on data-access code.

The largest file in the reference codebase is 4402 lines with **three fields**, all of them
database handles, and every method touches one of them. Under LCOM4 the methods are all connected
through a shared field, so the class scores as **perfectly cohesive**. The worst file in the
repository would be reported as healthy.

It discriminated usefully on the UI half — components have many independent fields — so the
failure is asymmetric, which makes it worse: a metric that is meaningful in one half of a
codebase and inverted in the other produces a ranking nobody can read.

## A weighted "God class" score

`Ce ≥ 8 → +2`, `many methods → +2`, and so on. Rejected for two reasons: the weights are invented,
and the terms are undefined ("many"). It produces a number with the appearance of precision and
no defensible meaning. Replaced by measured quantities plotted directly, where every position on
the chart traces back to a count.

## A composite health score, `82/100`

Aggregates incommensurable things and cannot be acted on: nobody can say what to do to move 82 to
85. It also invites being gamed, since the cheapest way to raise it is rarely the most useful
work. Removed in favour of the counters, which each name one thing.

## A persisted time series of snapshots

Two failures. Percentile-based thresholds cannot improve (see `calibrating-cuts.md`). And a
snapshot keyed on file path turns any refactoring that moves files into "N modules deleted, N
created" — the diff is destroyed precisely in the case the history exists for.

"Before and after" is obtained by running the tool again. That is why the output is byte-identical
across runs over an unchanged tree, and why nothing timestamped is written into
`architecture.json`.

## A "hostage" detector — low direct `Ce`, high `Ce*`

Designed, implemented, measured, deleted. The idea: a file that looks isolated but sits on top of
a tall dependency tower.

It fired on **37 files, every one of them an Angular NgModule** — and on **zero** once those were
excluded. A module with a small direct fan-out and a large transitive one is not a hostage; it is
what a module is. A detector that only fires on normal framework structure is noise.

`Ce*` survived as a column and as the queue's tiebreak, which was always its real job: it is the
*difficulty* of a refactoring, against `Ca*` as the *benefit*.

## `component` in `leafLayers`

Not a metric, but the same category of mistake and the most instructive one.

The `leafAsDependency` detector flags a layer that should be called rather than imported. Adding
`component` to that list flagged a 72-line breadcrumb used by 69 files, a 12-line loading spinner
used by 42, and a pagination control used by 41 — shared UI components with a high fan-in
*because reuse is their purpose*.

That is the exact error this whole design exists to prevent: sending someone to refactor the
foundation of the system. The rule holds for backend controllers, which should be reached through
a route, and not for frontend components.

---

## The shape of every rejection above

Each one was rejected by measuring it against a real codebase and looking at which files it named.
None was rejected by argument alone, and none should be reinstated by argument alone.

The test is always the same: **run it, read the list of files it produces, and ask whether you
would tell a colleague to go work on them.**
