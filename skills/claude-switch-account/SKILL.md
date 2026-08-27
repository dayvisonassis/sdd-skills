---
name: claude-switch-account
description: Use when the active Claude Code account must change - the work account hit its 5-hour usage limit, the session should continue under a personal account, or a new account must be registered for later switching. Windows, Linux and macOS; only for accounts belonging to the same person.
argument-hint: "[account name, optional]"
disable-model-invocation: true
---

# Claude switch account

Switches the active Claude Code account by swapping saved copies of
`.credentials.json`, with no browser OAuth round-trip.

There is still a single `~/.claude`: settings, memory, `projects/`, skills and
plugins stay shared. Only the credentials file changes.

## Pick the script for the platform

| Platform | Command prefix |
|---|---|
| Windows | `powershell -NoProfile -File <skill-dir>/claude-switch-account.ps1` |
| Linux, macOS | `bash <skill-dir>/claude-switch-account.sh` |

Flags differ by convention: `-Sessions` / `-Status` / `-List` /
`-Save -Account <name>` / `-Account <name>` on PowerShell, `--sessions` /
`--status` / `--list` / `--save <name>` / `<name>` on bash.

Snapshots are always plain files under the store on every platform. Only the
*live* credential location differs: a file on Windows and Linux, the login
Keychain on macOS.

## Steps

1. **Run the status command first.** It prints exactly one token:

   | Output | Meaning |
   |---|---|
   | `sem-credenciais` | Nobody is logged in. Nothing to do but log in. |
   | `sem-cadastro` | Someone is logged in, no account is registered yet. |
   | `sem-ativa` | Snapshots exist but none is marked active. |
   | `confere:<name>` | The live credentials are the `<name>` snapshot, unchanged. |
   | `diverge:<name>` | The live credentials differ from the `<name>` snapshot. |
   | `marcador-desatualizado:<real>` | The live account is `<real>`, not what the marker says. |
| `identidade-divergente:<name>` | Token matches, but the identity record does not. |
| `sem-identidade:<name>` | No identity snapshot for that account, or it cannot be compared. |
| `indeterminado:<name>` | No SHA-256 tool available; the comparison could not run. |

2. **Run the sessions command before activating anything.** It prints
   `outras-sessoes:N` - live Claude processes outside this one's own ancestry -
   or `indeterminado` when it cannot tell.

   If N is above zero, **stop and ask the user before switching.** Explain what
   they are choosing (see the next section), and do not proceed on your own
   judgement. `indeterminado` is not a green light: say the check could not run.

   N counts processes, not people. Processes belonging to the caller's own host -
   its ancestry, and the siblings that host spawned alongside it - are excluded,
   because an editor window starts more than one and counting them would make the
   warning fire on every single switch. Treat N as "something else is running",
   never as an exact tally.

3. **On `diverge:<name>`, ask - never guess.** Two different events produce it and
   they cannot be told apart without reading the token, which this skill does not do:

   - the *same* account with a token refreshed mid-session, or
   - a *different* account the user just logged into.

   Ask which it was. Same account -> save again under `<name>`. Different account
   -> register it under a new name. Guessing "different account" and re-saving the
   wrong way overwrites a working snapshot, and the user loses browser-free access
   to that account - the exact thing this skill exists to provide.

4. On `sem-cadastro`, offer to register the logged-in account before anything else.

5. Run the list command and **offer a menu**. Registered accounts come first, in
   the order listed, and `Register a new account` is always the last option. With
   three or fewer accounts use the interactive question tool; above that its option
   cap is exceeded, so print a numbered list and ask the user to pick.
   Skip the menu only if the user already named the account when invoking.

6. Chosen an existing account: run the activate command for that name.
   Chosen `Register a new account`: follow **Registering** below.

7. Report the result and tell the user to reopen with `claude --continue`.

## The marker is a record, not the truth

`<store>/.active` records the last account **this tool** activated. It says
nothing about what happened afterwards, and it goes stale the moment someone
switches by any other means - the built-in `/switch account`, a fresh login, a
different machine syncing in. Doing that is normal and correct; people do it
when the tool is not at hand.

So the marker is never used to decide which account is live. The identity is:
it is written by whoever logged in and it survives token refresh, unlike the
token itself. `whoami` compares the live identity against every registered
identity snapshot and names the match.

This matters at exactly one place, and it is destructive if got wrong. Before
switching, the outgoing account's snapshot is refreshed so a token renewed
mid-session is not lost. Choosing that account by the marker means that when the
marker is stale, **the live credentials are written into a different account's
snapshot** - the other account's saved login is destroyed, and `_backup-anterior`
holds the same wrong content, so nothing recovers it. Only another browser login
would.

Two consequences follow:

- The outgoing snapshot is written to the *identified* account. When that differs
  from the marker, the skill says so rather than hiding the correction.
- When the live account cannot be identified - no identity snapshot yet, more
  than one match, no usable Python - **no snapshot is rewritten at all.** Losing
  a refreshed token costs one browser login later; writing over the wrong
  snapshot costs one now, and silently.

The same rule governs "this account is already active": that is answered from
the identity too, since a stale marker would otherwise make the skill decline a
switch that genuinely needs to happen. When that path finds the marker naming
the wrong account, it corrects the marker before returning - otherwise the
record stays wrong for as long as the user keeps using the account they are
already on, which is exactly when nobody would think to look.

## Another live session will undo the switch

Every Claude process on the machine reads and writes the same two files. They
are neither isolated from each other nor synchronised with each other, which is
the worst of both:

- A process already running keeps its old token, held in memory. Switching does
  not disturb it, and it does not disturb the switch - yet.
- When that process refreshes its token, it writes its own credentials back to
  the shared file, **silently reverting the switch**. It writes to
  `~/.claude.json` in normal use too, so the identity can be reverted the same
  way.

So the risk is not that the other session breaks. It is that the switch quietly
comes undone, leaving a state nobody can read: `--status` will say `diverge` and
the user will not know why.

Tell the user this and let them decide. Waiting until the other session is
closed is the clean answer. Genuinely concurrent sessions on different accounts
need separate `CLAUDE_CONFIG_DIR` values, not this skill - and note that whether
`CLAUDE_CONFIG_DIR` also relocates `~/.claude.json` is **unverified**; if it does
not, two instances still collide over the identity.

## An account is two things, not one

Claude Code splits the account across two files:

| File | Holds |
|---|---|
| `~/.claude/.credentials.json` | the OAuth token |
| `~/.claude.json` | the identity: `userID` and `oauthAccount` (email, org, seat tier) |

Swapping only the token leaves the app **authenticated as one account and
displaying another** - the usage panel keeps showing the old email, and the two
records disagree. So a switch moves both, and `--save` snapshots both:
credentials to `<store>/<name>.json`, identity to
`<store>/identities/<name>.json`.

**What moves and what identifies are not the same set.** The whole
`oauthAccount` moves, but only `userID`, `accountUuid` and `organizationUuid`
identify an account. `oauthAccount` also carries `profileFetchedAt`, a timestamp
the app rewrites whenever it revalidates the profile - compare the whole object
and an account stops recognising itself minutes later, for no reason a user
could ever guess. Matching ignores anything that moves on its own, and a record
with none of the stable fields is treated as unidentifiable rather than matching
every other record that also lacks them.

`~/.claude.json` also holds unrelated state (project history, flags), which is
never swapped. Only `userID` and `oauthAccount` are patched in place, the file
is backed up to `_backup-state.json` first, and the write is atomic.

**This needs a working Python 3.** Not a style choice: PowerShell 5.1's
`ConvertFrom-Json` builds a case-insensitive map and aborts on real state files,
which do contain project keys differing only in case (`C:/...` and `c:/...`).
Presence is not enough either - macOS ships a `python3` stub that fails until
the Command Line Tools are installed, so the interpreter is probed before use.

Without a usable Python the token still switches, and the skill says loudly that
the identity did not. Report that verbatim; the user is then logged in as the
new account while every screen names the old one.

## What `--continue` does and does not preserve

The swap does not affect the running process - its token is already in memory.
A new process is required.

`claude --continue` reloads the full transcript from `~/.claude/projects/`, so
**the conversation is preserved in full** - it is not a compaction or a summary.
What does not survive is anything that lived only in memory: background
processes, attached log tails, shell variables. Say this plainly rather than
promising nothing changes.

The prompt cache is lost either way, including via the built-in
`/switch account`, because it is scoped per account.

### Which process to restart depends on the host

| Host | How to pick up the new account |
|---|---|
| Terminal | Exit the session, then `claude --continue` |
| VS Code extension | Restart VS Code |

This distinction is not cosmetic. Running `claude --continue` in VS Code's
integrated terminal does **not** switch the extension's account: it starts a
second, independent Claude beside it. The user then has two sessions live on two
different accounts, and the panel - which belongs to the extension - keeps
showing the old one. Name the host before telling anyone what to restart.

## Account names

Any name works, spaces included, as long as it has no slash, no control
character, and does not start with `_` - that prefix marks the store's own
files, and an account using it would be invisible in every listing. Names are
rejected up front rather than producing a store that half works.

Whitespace inside a name is content, not padding. Only the ends are trimmed when
the marker is read back, on both platforms: stripping all whitespace turns
`Trabalho 2` into `Trabalho2`, the marker then matches nothing, and the account
can never be shown as active nor reconciled - a break that is silent, permanent,
and only on POSIX.

## Registering

1. If an account is currently logged in and unsaved, save it first:
   `-Save -Account <name>` / `--save <name>`.
2. Ask the user to run `/switch account` and log into the account being added.
   This is the only time the browser is needed for that account, and it is the
   one step this skill cannot perform: `/switch account` is a client command, not
   an agent tool, and the OAuth flow needs a human at a browser by design. Say so
   plainly rather than leaving the user wondering why the skill stopped.
3. Once logged in, save it under its name.

The user may not come back to say they are done - the login can restart the
session. That is what step 1's status check is for: on the next invocation
`diverge:<name>` surfaces the unregistered login on its own, so a half-finished
registration cannot pass unnoticed.

## Guarantees

- Rewrites the outgoing account's snapshot before switching, so a token
  refreshed mid-session is not lost.
- Refuses a missing, empty or non-JSON snapshot instead of writing garbage over
  working credentials.
- Keeps `_backup-anterior.json` from every switch.
- Honours `CLAUDE_CONFIG_DIR`; `CLAUDE_ACCOUNTS_DIR` overrides the store.
- On Linux and macOS, stored snapshots are `chmod 600` and the store is `700`.
- Aborts instead of switching if the outgoing account's credentials cannot be
  read, so a token is never silently dropped.
- Backs up `~/.claude.json` before patching it, writes atomically, and validates
  the result parses before replacing the original.
- Identity snapshots live in their own `identities/` directory, so they can
  never be listed as accounts nor activated over a credentials file.

## macOS specifics - READ BEFORE RELYING ON IT

The Keychain path has been exercised only against a stubbed `security` command.
**It has never run on Apple hardware.** The first Mac user to try it should
verify the result before trusting it, and report back so this notice can go.

- The Keychain item defaults to service `Claude Code-credentials`, account
  `$USER`. If that is wrong, `--save` fails with a message naming both, and the
  values are overridable via `CLAUDE_KEYCHAIN_SERVICE` and
  `CLAUDE_KEYCHAIN_ACCOUNT`. Find the real one with:
  `security dump-keychain | grep -i -A2 claude`
- Writing goes through `security add-generic-password -U ... -w <json>`, so the
  token is briefly visible in `ps` output. Acceptable on a single-user Mac;
  worth knowing on a shared one.
- macOS may prompt for Keychain access on each call. That prompt is not
  modelled by the tests.
- A wrong service name is a *safe* failure - it cannot read, so it refuses to
  write. It does not damage the existing login.

## Troubleshooting

| Symptom | Cause |
|---|---|
| Switched, still on the old account | The process was not reopened. Run `claude --continue`. |
| Asks for login despite a saved account | Snapshot too old, refresh token expired. Run `/switch account` once, then save again. |
| List shows nothing | No account registered yet. See Registering. |
| `diverge:` and the user is unsure | Ask when they last logged in. If they did not, it is a refreshed token. |
| `[INVALIDA]` next to a name | That snapshot is corrupt. Log into it and save again. |
| macOS: cannot read credentials | Wrong Keychain service or account. See macOS specifics. |
| Restarted, still shows the old account | Either the wrong process was restarted (see the host table) or the identity did not move - run status. |
| `identidade-divergente` | Token and identity disagree. Switch again to the intended account to reconcile both. |
| `marcador-desatualizado` | Someone switched outside this tool. Not an error - switching again reconciles it. |
| Switched, and later it is back on the old account | Another live session refreshed its token over the shared file. See the section above. |
| `AVISO ... (sem-python)` | No usable Python 3. The token moved, the identity did not; every screen will name the old account. |

## Not for

Other people's accounts, or shared accounts. This moves one person's own
credentials between their own accounts. Never invoke it unprompted - changing
which account is billed is the user's decision.
