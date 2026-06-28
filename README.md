# SDD Skills — Spec-Driven Development for Claude Code

A portable set of Claude Code skills that run a full **spec-driven development** flow:
from product requirements to specs/contracts, implementation, and an external
contract-based evaluation with automatic correction.

> New here? Read **[docs/GUIA_DO_WORKFLOW.md](docs/GUIA_DO_WORKFLOW.md)** — it explains, in
> plain terms, what each skill does, when to call it, and what goes in/out, so you can use
> the whole flow without opening every `SKILL.md`.

---

## What's inside

```
sdd-skills/
├── skills/
│   ├── architecture-analyzer/   # map an existing codebase (surface area)
│   ├── deep-analyzer/           # exhaustive per-unit analysis (needs the arch report)
│   ├── gate-builder/            # build the quality gates (typecheck/lint/build/tests/arch/deadcode)
│   ├── prd-writer/              # generate the product PRD
│   ├── spec-writer/             # per feature: spec.md + plan.md + contract.md
│   ├── implement-feature/       # implement, test, satisfy the contract gates, write progress.json
│   ├── evaluator/               # evaluate against contract.md; owns the fix loop + state
│   └── fix-runner/              # minimal corrector (dispatched by evaluator on FAIL)
└── docs/                        # base/reference docs + the workflow guide
```

All skills are **self-contained**: paths between them are relative within this package, so
copying the package (or installing it) is enough — no external repo is required.

---

## Install

Skills are discovered by convention: any folder under a skills directory that contains a
valid `SKILL.md` is loaded. There are two scopes:

| Scope | Location | Applies to |
|---|---|---|
| **User (global)** | `~/.claude/skills/` (Windows: `C:\Users\<you>\.claude\skills\`) | every project |
| **Project** | `<project>/.claude/skills/` | that project only |

### Option A — `npx skills` (recommended for sharing)

Publish this package to a Git repository, then in the target project run:

```bash
npx skills add <owner>/<repo> --skill "*"   # install all SDD skills
# or pick specific ones:
npx skills add <owner>/<repo> --skill spec-writer,implement-feature,evaluator,fix-runner
```

Add `-g` for a global (user-level) install where supported. The installer finds each
`SKILL.md` under `skills/`.

### Option B — copy the folders

Copy the contents of `skills/` into a skills directory:

```bash
# global, all projects:
cp -r skills/* ~/.claude/skills/

# or just one project:
cp -r skills/* <project>/.claude/skills/
```

> Copy the **whole skill folder** (including any `references/`), not just `SKILL.md`. The
> `docs/` folder is optional reference material — copy it alongside if you want the guide and
> base docs available; the skills also link to it via `../../docs/`, so keeping the package
> structure intact preserves those links.

### Verify

In the target project, the skills should appear in Claude Code's available-skills list. A
quick check:

```bash
npx skills list           # if installed via npx skills
# or just open Claude Code in the project and look for the skill names
```

---

## The flow at a glance

```
SETUP (once):
  architecture-analyzer → deep-analyzer → gate-builder      (brownfield)
  gate-builder                                              (greenfield)

PER FEATURE (repeat):
  prd-writer → spec-writer → implement-feature → evaluator ⇄ fix-runner
```

- **You invoke** every skill directly **except `fix-runner`** — the `evaluator` dispatches it
  automatically when an evaluation fails, then re-evaluates until **CLEAN**, **PENDING**, or
  **ABORTED**.
- The `contract.md` (produced by `spec-writer`) is the single source of acceptance criteria
  and quality gates; `implement-feature` satisfies it and `evaluator` checks against it.
- Shared state lives in `progress.json` (at the root of the project's `docs/`).

See **[docs/GUIA_DO_WORKFLOW.md](docs/GUIA_DO_WORKFLOW.md)** for the full, step-by-step guide
and ready-made recipes (greenfield, brownfield, batch).

---

## Notes

- **Analyzers are optional for greenfield.** `gate-builder` can build gates from your stack's
  conventions when there's no code to analyze yet.
- **Skills only write what they own.** `gate-builder` writes gate config/scripts (not app
  code); `implement-feature`/`fix-runner` write code (not gate infrastructure); `evaluator`
  writes state/reports (it never edits code). Keeping these roles separate is intentional.
- **Reference docs** in `docs/` explain the rationale behind each piece — read them when you
  want the "why"; the guide is enough for day-to-day use.

---

## License

[MIT](LICENSE) © dayvisonassis
