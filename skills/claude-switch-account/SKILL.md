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

Flags differ by convention: `-List` / `-Save -Account <name>` / `-Account <name>`
on PowerShell, `--list` / `--save <name>` / `<name>` on bash.

Snapshots are always plain files under the store on every platform. Only the
*live* credential location differs: a file on Windows and Linux, the login
Keychain on macOS.

## Steps

1. Run the list command. It prints the saved accounts, marking the active one
   with `*` and any unreadable snapshot with `[INVALIDA]`.
2. **Offer a menu.** Registered accounts come first, in the order listed, and
   `Register a new account` is always the last option. With three or fewer
   accounts use the interactive question tool; above that its option cap is
   exceeded, so print a numbered list and ask the user to pick.
   Skip the menu only if the user already named the account when invoking.
3. Chosen an existing account: run the activate command for that name.
4. Chosen `Register a new account`: follow **Registering** below.
5. Report the result and tell the user to reopen with `claude --continue`.

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
   This is the only time the browser is needed for that account.
3. Once logged in, save it under its name.

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
| `[INVALIDA]` next to a name | That snapshot is corrupt. Log into it and save again. |
| macOS: cannot read credentials | Wrong Keychain service or account. See macOS specifics. |

## Not for

Other people's accounts, or shared accounts. This moves one person's own
credentials between their own accounts. Never invoke it unprompted - changing
which account is billed is the user's decision.
