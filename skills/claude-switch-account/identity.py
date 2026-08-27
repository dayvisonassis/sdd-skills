"""Move the account identity record between Claude Code state files.

The OAuth token lives in .credentials.json, but the account identity lives in
.claude.json under userID/oauthAccount. Swapping only the token leaves the app
authenticated as one account and displaying another.

This runs on every platform because neither PowerShell 5.1 nor portable shell
can parse the real file safely: ConvertFrom-Json builds a case-insensitive map
and aborts on project keys that differ only in case, which real state files do
contain.

Exit codes: 0 ok / 1 differs or not identified / 2 state unreadable / 3 source
invalid / 4 write failed / 5 no identity present
"""
import json
import os
import sys

KEYS = ("userID", "oauthAccount")


def load(path):
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def dump(path, data, indented):
    tmp = path + ".tmp"
    text = json.dumps(data, ensure_ascii=False, indent=2 if indented else None)
    with open(tmp, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    with open(tmp, encoding="utf-8") as fh:
        json.load(fh)
    os.replace(tmp, path)


def is_indented(path):
    with open(path, encoding="utf-8") as fh:
        return "\n" in fh.read(4096)


def extract(state, dest):
    try:
        data = load(state)
    except Exception:
        return 2
    out = {k: data[k] for k in KEYS if k in data}
    if not out:
        return 5
    try:
        dump(dest, out, True)
    except Exception:
        return 4
    return 0


def apply(state, src, backup):
    try:
        data = load(state)
    except Exception:
        return 2
    try:
        ident = load(src)
    except Exception:
        return 3
    if not any(k in ident for k in KEYS):
        return 3
    try:
        indented = is_indented(state)
        with open(state, encoding="utf-8") as fh:
            raw = fh.read()
        with open(backup, "w", encoding="utf-8", newline="") as fh:
            fh.write(raw)
        for k in KEYS:
            if k in ident:
                data[k] = ident[k]
        dump(state, data, indented)
    except Exception:
        return 4
    return 0


def compare(state, snap):
    try:
        data = load(state)
        ident = load(snap)
    except Exception:
        return 2
    for k in KEYS:
        if json.dumps(data.get(k), sort_keys=True) != json.dumps(ident.get(k), sort_keys=True):
            return 1
    return 0


def whoami(state, identities_dir):
    """Name the account the live identity belongs to.

    The marker file records the last account this tool activated, so it goes
    stale the moment someone switches by any other means. The identity does
    not: it survives token refresh and is written by whoever logged in. It is
    therefore the only trustworthy answer to "which account is live".

    Ambiguity is reported as failure, never as a guess: acting on the wrong
    name here overwrites another account's snapshot.
    """
    try:
        data = load(state)
    except Exception:
        return 2
    try:
        names = sorted(os.listdir(identities_dir))
    except Exception:
        return 1
    matches = []
    for fn in names:
        if not fn.endswith(".json"):
            continue
        try:
            ident = load(os.path.join(identities_dir, fn))
        except Exception:
            continue
        same = all(
            json.dumps(data.get(k), sort_keys=True) == json.dumps(ident.get(k), sort_keys=True)
            for k in KEYS
        )
        if same:
            matches.append(fn[:-5])
    if len(matches) != 1:
        return 1
    sys.stdout.write(matches[0])
    return 0


def main(argv):
    if len(argv) < 2:
        return 2
    cmd = argv[1]
    if cmd == "extract" and len(argv) == 4:
        return extract(argv[2], argv[3])
    if cmd == "apply" and len(argv) == 5:
        return apply(argv[2], argv[3], argv[4])
    if cmd == "compare" and len(argv) == 4:
        return compare(argv[2], argv[3])
    if cmd == "whoami" and len(argv) == 4:
        return whoami(argv[2], argv[3])
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
