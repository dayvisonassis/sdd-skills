#!/usr/bin/env bash
set -uo pipefail

OS="$(uname -s)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CRED="$CONFIG_DIR/.credentials.json"
STORE="${CLAUDE_ACCOUNTS_DIR:-$HOME/.claude-accounts}"
MARKER="$STORE/.active"
KC_SERVICE="${CLAUDE_KEYCHAIN_SERVICE:-Claude Code-credentials}"
KC_ACCOUNT="${CLAUDE_KEYCHAIN_ACCOUNT:-$USER}"

fail() { echo "ERRO: $*"; exit 1; }

live_where() {
  if [ "$OS" = "Darwin" ]; then echo "Keychain (service '$KC_SERVICE', account '$KC_ACCOUNT')"
  else echo "$CRED"; fi
}

live_read() {
  if [ "$OS" = "Darwin" ]; then
    security find-generic-password -s "$KC_SERVICE" -a "$KC_ACCOUNT" -w 2>/dev/null
  else
    [ -f "$CRED" ] && cat "$CRED"
  fi
}

live_write() {
  local json; json="$(cat)"
  if [ "$OS" = "Darwin" ]; then
    security add-generic-password -U -s "$KC_SERVICE" -a "$KC_ACCOUNT" -w "$json" 2>/dev/null
  else
    printf '%s' "$json" > "$CRED" && chmod 600 "$CRED"
  fi
}

valid_json() {
  local data; data="$(cat)"
  [ "${#data}" -ge 50 ] || return 1
  if command -v python3 >/dev/null 2>&1; then
    printf '%s' "$data" | python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1 || return 1
  else
    case "$data" in '{'*) ;; *) return 1 ;; esac
  fi
  return 0
}

valid_file() { [ -f "$1" ] && valid_json < "$1"; }

hash_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else echo NOHASH; fi
}

active_name() { [ -f "$MARKER" ] && tr -d '[:space:]' < "$MARKER" || true; }

saved_accounts() {
  [ -d "$STORE" ] || return 0
  for f in "$STORE"/*.json; do
    [ -e "$f" ] || continue
    local b; b="$(basename "$f" .json)"
    case "$b" in _*) continue ;; esac
    echo "$b"
  done
}

snapshot_live() {
  local dest="$1"
  live_read | valid_json || return 1
  live_read > "$dest" || return 1
  chmod 600 "$dest" 2>/dev/null
  return 0
}

mkdir -p "$STORE"; chmod 700 "$STORE" 2>/dev/null

[ "$OS" = "Darwin" ] && echo "NOTA: caminho macOS (Keychain) ainda nao validado em hardware Apple - confira o resultado" >&2

case "${1:-}" in
  --status)
    live_read | valid_json || { echo "sem-credenciais"; exit 0; }
    [ -n "$(saved_accounts)" ] || { echo "sem-cadastro"; exit 0; }
    a="$(active_name)"
    [ -n "$a" ] || { echo "sem-ativa"; exit 0; }
    valid_file "$STORE/$a.json" || { echo "diverge:$a"; exit 0; }
    h1="$(live_read | hash_stdin)"; h2="$(hash_stdin < "$STORE/$a.json")"
    if [ "$h1" = "NOHASH" ]; then echo "indeterminado:$a"
    elif [ "$h1" = "$h2" ]; then echo "confere:$a"
    else echo "diverge:$a"; fi
    exit 0
    ;;
  --list)
    a="$(active_name)"; found=0
    while read -r n; do
      [ -n "$n" ] || continue
      found=1; flag=""
      valid_file "$STORE/$n.json" || flag="  [INVALIDA - refaca o --save]"
      if [ "$n" = "$a" ]; then echo "* $n (ativa)$flag"; else echo "  $n$flag"; fi
    done <<< "$(saved_accounts)"
    [ "$found" -eq 1 ] || echo "nenhuma conta salva ainda"
    exit 0
    ;;
  --save)
    name="${2:-}"; [ -n "$name" ] || fail "informe o nome: --save <nome>"
    snapshot_live "$STORE/$name.json" || {
      rm -f "$STORE/$name.json"
      if [ "$OS" = "Darwin" ]; then
        fail "nao consegui ler as credenciais do $(live_where) - faca login primeiro, ou ajuste CLAUDE_KEYCHAIN_SERVICE/CLAUDE_KEYCHAIN_ACCOUNT"
      fi
      fail "credenciais ativas ausentes ou invalidas em $(live_where) - faca login primeiro"
    }
    printf '%s' "$name" > "$MARKER"
    echo "conta '$name' salva e marcada como ativa"; exit 0
    ;;
  ""|--help|-h)
    echo "uso: claude-switch-account.sh --status | --list | --save <nome> | <nome>"; exit 0
    ;;
esac

name="$1"
target="$STORE/$name.json"
valid_file "$target" || fail "conta '$name' nao esta salva ou o arquivo esta invalido - use --list"

a="$(active_name)"
[ "$a" != "$name" ] || { echo "conta '$name' ja esta ativa"; exit 0; }

if snapshot_live "$STORE/_backup-anterior.json"; then
  [ -z "$a" ] || cp -f "$STORE/_backup-anterior.json" "$STORE/$a.json"
elif [ -n "$a" ]; then
  fail "nao consegui ler as credenciais atuais de $(live_where) para salvar a conta '$a' - abortado para nao perder o token"
fi

live_write < "$target" || fail "falha ao gravar as credenciais em $(live_where)"
printf '%s' "$name" > "$MARKER"

echo "conta '$name' ativa"
[ -n "$a" ] || echo "AVISO: a conta anterior nao estava registrada; snapshot bruto em _backup-anterior.json"
echo "reabra com: claude --continue"
