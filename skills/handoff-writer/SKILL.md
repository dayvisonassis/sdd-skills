---
name: handoff-writer
description: Compacts the current conversation into a handoff document a fresh agent can pick up from, and asks where to save it before writing anything. Use when a session ends with work unfinished, when switching branch or machine, or when passing the work to another person. Records what is not already written down elsewhere and points at what is. Never invoked on its own initiative — a handoff is a deliberate act, and only the person having the conversation knows when it is worth one.
argument-hint: "What will the next session be used for?"
disable-model-invocation: true
---

# Handoff Writer

Write a handoff document summarising the current conversation so that a fresh agent — with no
memory of any of it — can continue the work.

> **Derived from `handoff` by Matt Pocock** (`mattpocock/skills`, MIT), which saves to the
> operating system's temporary directory. This version asks where to save instead, because the
> right place depends on how long the handoff needs to live and who else should see it. The rest
> of the instruction is his.

## ASK BEFORE WRITING

**Do not write the file until the destination is settled.** Offer these, with the trade-off
stated, and recommend the one that fits what the person just told you they are doing:

| Where | Good for | Cost |
|---|---|---|
| **Repository root**, untracked | Work resuming in this repo, possibly after a branch switch — an untracked file survives `checkout` | Shows up in `git status` and can be committed by accident |
| **The OS temp directory** | A handoff nobody else needs and nothing should outlive | Easy to lose; some systems clear it on reboot |
| **A path they name** | Anything else — a docs folder, a shared drive, a scratchpad | Theirs to manage |

If they choose the repository root, **offer to add the file to `.git/info/exclude`**. That keeps
`git status` clean without touching `.gitignore`, which would carry the entry to the remote and
to everyone else. Use the **common** git directory, so the exclusion also applies in worktrees:

```bash
git rev-parse --git-common-dir
```

Append the file name there only if they say yes. It is per-clone and reversible; say so.

## WHAT TO WRITE

**Do not duplicate content already captured in other artifacts** — specs, plans, ADRs, issues,
commits, diffs. Reference them by path or URL instead. A handoff that restates a committed
document goes stale the moment that document changes, and the reader cannot tell which copy is
true.

Write down what exists **nowhere else**: the decisions taken and why, what was tried and
abandoned, the state of anything half-finished, and the traps discovered along the way.

Include a **suggested skills** section naming which skills the next agent should call the Skill
tool for.

**Redact anything sensitive** — API keys, passwords, tokens, personally identifiable information.
A handoff is written to be read by someone who was not in the room.

If the user passed arguments, treat them as a description of what the next session will focus on,
and tailor the document to that.

## RULES

**Ask where, every time.** Not a default with a chance to object — a question with an answer.
Even in the same project as last time: a handoff meant to survive a branch switch and one meant
to be thrown away belong in different places.

**Say what the file is for, inside the file.** Whoever opens it may not know why it exists, and
if it sits untracked in a repository root, whether it should be committed is the first question
they will have.

**State what is unfinished, plainly.** The value of a handoff is concentrated in what is still
broken. Ending on a summary of what went well wastes the reader's first minute.

**Never write it unasked.** The frontmatter disables model invocation on purpose.

## EDGE CASES

**Not inside a git repository.** The repository-root option and the `.git/info/exclude` offer do
not apply — say so rather than offering them and failing.

**A handoff already exists at the chosen path.** Ask before overwriting. The old one may describe
a different piece of work, and losing it silently is the one failure this skill cannot recover
from.

**The conversation is short or the work is finished.** Say so and write nothing. An empty handoff
costs the next reader time and teaches them not to trust the next one.

**The work spans more than one repository.** Name every one, with its branch and its state.
A handoff that describes a single repository when the work touched three is worse than none: the
reader will act on the part it names.
