#!/usr/bin/env bash
set -uo pipefail

OS="$(uname -s)"
CONFIG_DIR="${CLAUDE_CONFIG_DIR:-$HOME/.claude}"
CRED="$CONFIG_DIR/.credentials.json"
STORE="${CLAUDE_ACCOUNTS_DIR:-$HOME/.claude-accounts}"
MARKER="$STORE/.active"
KC_SERVICE="${CLAUDE_KEYCHAIN_SERVICE:-Claude Code-credentials}"
KC_ACCOUNT="${CLAUDE_KEYCHAIN_ACCOUNT:-$USER}"
STATE="${CLAUDE_STATE_FILE:-$HOME/.claude.json}"
IDENTITY_PY="$(cd "$(dirname "$0")" 2>/dev/null && pwd)/identity.py"

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
  local data py; data="$(cat)"
  [ "${#data}" -ge 50 ] || return 1
  if py="$(py_exe)"; then
    printf '%s' "$data" | "$py" -c 'import json,sys; json.load(sys.stdin)' >/dev/null 2>&1 || return 1
  else
    case "$data" in '{'*) ;; *) return 1 ;; esac
  fi
  return 0
}

valid_file() { [ -f "$1" ] && valid_json < "$1"; }

PY_EXE_CACHE=""
py_exe() {
  if [ -z "$PY_EXE_CACHE" ]; then
    PY_EXE_CACHE="none"
    for c in python3 python; do
      if command -v "$c" >/dev/null 2>&1 && "$c" -c 'pass' >/dev/null 2>&1; then
        PY_EXE_CACHE="$c"; break
      fi
    done
  fi
  [ "$PY_EXE_CACHE" != "none" ] || return 1
  echo "$PY_EXE_CACHE"
}

invoke_identity() {
  local py
  py="$(py_exe)" || return 99
  [ -n "$py" ] || return 99
  [ -f "$IDENTITY_PY" ] || return 98
  "$py" "$IDENTITY_PY" "$@" >/dev/null 2>&1
}

IDENTITY_DIR="$STORE/identities"
identity_path() { echo "$IDENTITY_DIR/$1.json"; }

save_identity() { invoke_identity extract "$STATE" "$1"; }

apply_identity() {
  [ -f "$1" ] || { echo "sem-identidade"; return; }
  invoke_identity apply "$STATE" "$1" "$STORE/_backup-state.json"
  case $? in
    0)  echo ok ;;
    2)  echo estado-ilegivel ;;
    3)  echo identidade-invalida ;;
    4)  echo escrita-falhou ;;
    98) echo helper-ausente ;;
    99) echo sem-python ;;
    *)  echo erro ;;
  esac
}

identify_live() {
  local py
  py="$(py_exe)" || return 1
  [ -f "$IDENTITY_PY" ] || return 1
  "$py" "$IDENTITY_PY" whoami "$STATE" "$IDENTITY_DIR" 2>/dev/null
}

identity_matches() {
  local snap; snap="$(identity_path "$1")"
  [ -f "$snap" ] || return 2
  invoke_identity compare "$STATE" "$snap"
  case $? in 0) return 0 ;; 1) return 1 ;; *) return 2 ;; esac
}

other_session_count() {
  command -v pgrep >/dev/null 2>&1 || return 1
  local mine=" " pid=$$ host_parent="" nm pp n=0
  while [ -n "$pid" ] && [ "$pid" != "0" ] && [ "$pid" != "1" ]; do
    mine="$mine$pid "
    nm="$(ps -o comm= -p "$pid" 2>/dev/null | tr -d ' ')"
    case "$nm" in
      claude|claude.exe)
        [ -n "$host_parent" ] || host_parent="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
        ;;
    esac
    pid="$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')"
  done
  for p in $( { pgrep -x claude 2>/dev/null; pgrep -f 'claude-code' 2>/dev/null; } | sort -u ); do
    case "$mine" in *" $p "*) continue ;; esac
    if [ -n "$host_parent" ]; then
      pp="$(ps -o ppid= -p "$p" 2>/dev/null | tr -d ' ')"
      [ "$pp" = "$host_parent" ] && continue
    fi
    n=$((n+1))
  done
  echo "$n"
}

hash_stdin() {
  if command -v sha256sum >/dev/null 2>&1; then sha256sum | cut -d' ' -f1
  elif command -v shasum >/dev/null 2>&1; then shasum -a 256 | cut -d' ' -f1
  else echo NOHASH; fi
}

active_name() {
  [ -f "$MARKER" ] || return 0
  local v; v="$(cat "$MARKER")"
  v="${v#"${v%%[![:space:]]*}"}"
  v="${v%"${v##*[![:space:]]}"}"
  printf '%s' "$v"
}

valid_name() {
  case "$1" in
    "" ) return 1 ;;
    _* ) return 1 ;;
    *"/"*|*"\\"* ) return 1 ;;
  esac
  case "$1" in *[[:cntrl:]]* ) return 1 ;; esac
  return 0
}

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

mkdir -p "$STORE" "$IDENTITY_DIR"; chmod 700 "$STORE" "$IDENTITY_DIR" 2>/dev/null

[ "$OS" = "Darwin" ] && echo "NOTA: caminho macOS (Keychain) ainda nao validado em hardware Apple - confira o resultado" >&2

case "${1:-}" in
  --sessions)
    if n="$(other_session_count)"; then echo "outras-sessoes:$n"; else echo "indeterminado"; fi
    exit 0
    ;;
  --status)
    live_read | valid_json || { echo "sem-credenciais"; exit 0; }
    [ -n "$(saved_accounts)" ] || { echo "sem-cadastro"; exit 0; }
    a="$(active_name)"
    [ -n "$a" ] || { echo "sem-ativa"; exit 0; }
    if real="$(identify_live)" && [ -n "$real" ] && [ "$real" != "$a" ]; then
      echo "marcador-desatualizado:$real"; exit 0
    fi
    valid_file "$STORE/$a.json" || { echo "diverge:$a"; exit 0; }
    h1="$(live_read | hash_stdin)"; h2="$(hash_stdin < "$STORE/$a.json")"
    if [ "$h1" = "NOHASH" ]; then echo "indeterminado:$a"; exit 0; fi
    if [ "$h1" != "$h2" ]; then echo "diverge:$a"; exit 0; fi
    identity_matches "$a"; rc=$?
    case $rc in
      0) echo "confere:$a" ;;
      1) echo "identidade-divergente:$a" ;;
      *) echo "sem-identidade:$a" ;;
    esac
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
    valid_name "$name" || fail "nome invalido: '$name' - sem barras, sem caracteres de controle, e nao pode comecar com _"
    snapshot_live "$STORE/$name.json" || {
      rm -f "$STORE/$name.json"
      if [ "$OS" = "Darwin" ]; then
        fail "nao consegui ler as credenciais do $(live_where) - faca login primeiro, ou ajuste CLAUDE_KEYCHAIN_SERVICE/CLAUDE_KEYCHAIN_ACCOUNT"
      fi
      fail "credenciais ativas ausentes ou invalidas em $(live_where) - faca login primeiro"
    }
    if ! save_identity "$(identity_path "$name")"; then
      echo "AVISO: identidade nao extraida de $STATE - a troca vai levar so o token"
    fi
    printf '%s' "$name" > "$MARKER"
    echo "conta '$name' salva e marcada como ativa"; exit 0
    ;;
  ""|--help|-h)
    echo "uso: claude-switch-account.sh --sessions | --status | --list | --save <nome> | <nome>"; exit 0
    ;;
esac

name="$1"
valid_name "$name" || fail "nome invalido: '$name' - sem barras, sem caracteres de controle, e nao pode comecar com _"
target="$STORE/$name.json"
valid_file "$target" || fail "conta '$name' nao esta salva ou o arquivo esta invalido - use --list"

a="$(active_name)"
outgoing=""
if real="$(identify_live)" && [ -n "$real" ]; then outgoing="$real"; fi
stale_note=""

current="${outgoing:-$a}"
if [ "$current" = "$name" ]; then
  if [ "$a" != "$name" ]; then
    printf '%s' "$name" > "$MARKER"
    echo "conta '$name' ja esta ativa (marcador corrigido: dizia '$a')"
  else
    echo "conta '$name' ja esta ativa"
  fi
  exit 0
fi

if snapshot_live "$STORE/_backup-anterior.json"; then
  if [ -n "$outgoing" ]; then
    cp -f "$STORE/_backup-anterior.json" "$STORE/$outgoing.json"
    save_identity "$(identity_path "$outgoing")" || true
    [ "$outgoing" = "$a" ] || stale_note="stale"
  else
    stale_note="skip"
  fi
elif [ -n "$a" ]; then
  fail "nao consegui ler as credenciais atuais de $(live_where) para salvar a conta '$a' - abortado para nao perder o token"
fi

live_write < "$target" || fail "falha ao gravar as credenciais em $(live_where)"
id_result="$(apply_identity "$(identity_path "$name")")"
printf '%s' "$name" > "$MARKER"

echo "conta '$name' ativa"
if [ "$stale_note" = "skip" ]; then
  echo "AVISO: nao identifiquei a conta que estava ativa - NAO regravei nenhum snapshot, para nao gravar por cima do errado"
elif [ "$stale_note" = "stale" ]; then
  echo "NOTA: a conta que saiu era '$outgoing' (o marcador dizia '$a') - salvei nela, nao no que o marcador dizia"
fi
[ "$id_result" = "ok" ] || echo "AVISO: o token trocou mas a identidade NAO ($id_result) - o app vai exibir a conta antiga"
[ -n "$a" ] || echo "AVISO: a conta anterior nao estava registrada; snapshot bruto em _backup-anterior.json"
echo "reabra com: claude --continue"
