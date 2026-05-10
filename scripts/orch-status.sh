#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TRACKER_FILE="${ORCH_TRACKER:-/tmp/orch-jules-tasks.jsonl}"

show_snapshot() {
  local session="${1:?Usage: orch-status.sh [--watch] <session> [agents=3] [interval=60]}"
  local agents="${2:-3}"

  bd list --status=in_progress 2>/dev/null || echo "(no bd issues in progress)"
  echo
  bd ready 2>/dev/null || echo "(no unblocked issues)"
}

show_tracker_state() {
  "$SCRIPT_DIR/orch" status 2>/dev/null || echo "(orch status unavailable)"
}

cmd_watch() {
  local session="${1:?Usage: orch-status.sh --watch <session> [agents=3] [interval=60]}"
  local agents="${2:-3}"
  local interval="${3:-60}"

  echo "Watching: tmux=$session agents=$agents jules=all interval=${interval}s"
  echo "Press Ctrl+C to stop"
  echo

  while true; do
    clear
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') ==="
    echo
    show_snapshot "$session" "$agents"
    echo
    show_tracker_state
    echo
    echo "Next refresh in ${interval}s (Ctrl+C to stop)"
    sleep "$interval"
  done
}

# Parse args
MODE="snapshot"
SESSION=""
AGENTS="3"
INTERVAL="60"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --watch|-w) MODE="watch"; shift ;;
    --interval) INTERVAL="$2"; shift 2 ;;
    -*) echo "Unknown flag: $1"; exit 1 ;;
    *)
      if [[ -z "$SESSION" ]]; then
        SESSION="$1"
      elif [[ "$AGENTS" == "3" ]]; then
        AGENTS="$1"
      else
        INTERVAL="$1"
      fi
      shift
      ;;
  esac
done

[[ -z "$SESSION" ]] && { echo "Usage: orch-status.sh [--watch] <session> [agents=3] [interval=60]"; exit 1; }

case "$MODE" in
  snapshot) show_snapshot "$SESSION" "$AGENTS" && echo && show_tracker_state ;;
  watch) cmd_watch "$SESSION" "$AGENTS" "$INTERVAL" ;;
esac
