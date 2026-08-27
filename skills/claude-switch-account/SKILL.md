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

Flags differ by convention: `-Status` / `-List` / `-Save -Account <name>` /
`-Account <name>` on PowerShell, `--status` / `--list` / `--save <name>` /
`<name>` on bash.

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
   | `indeterminado:<name>` | No SHA-256 tool available; the comparison could not run. |

2. **On `diverge:<name>`, ask - never guess.** Two different events produce it and
   they cannot be told apart without reading the token, which this skill does not do:

   - the *same* account with a token refreshed mid-session, or
   - a *different* account the user just logged into.

   Ask which it was. Same account -> save again under `<name>`. Different account
   -> register it under a new name. Guessing "different account" and re-saving the
   wrong way overwrites a working snapshot, and the user loses browser-free access
   to that account - the exact thing this skill exists to provide.

3. On `sem-cadastro`, offer to register the logged-in account before anything else.

4. Run the list command and **offer a menu**. Registered accounts come first, in
   the order listed, and `Register a new account` is always the last option. With
   three or fewer accounts use the interactive question tool; above that its option
   cap is exceeded, so print a numbered list and ask the user to pick.
   Skip the menu only if the user already named the account when invoking.

5. Chosen an existing account: run the activate command for that name.
   Chosen `Register a new account`: follow **Registering** below.

6. Report the result and tell the user to reopen with `claude --continue`.

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

## Not for

Other people's accounts, or shared accounts. This moves one person's own
credentials between their own accounts. Never invoke it unprompted - changing
which account is billed is the user's decision.
