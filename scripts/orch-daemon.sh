#!/usr/bin/env bash
set -uo pipefail
# orch-daemon — Reads /tmp/orch-monitor-state.txt, detects state changes, injects into orchestrator pane
# Started by: orch monitor
# Stopped by: orch monitor-stop, or session death

INTERVAL="${1:-45}"
SESSION="${2:-$(tmux display-message -p '#{session_name}' 2>/dev/null || echo '')}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONFIG_FILE="${JULES_KEYS_FILE:-$SCRIPT_DIR/jules.keys.json}"
PROJECT_NAME="$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('project',{}).get('name','orch'))" 2>/dev/null || echo orch)"
BEAD_PREFIX="$(python3 -c "import json; print(json.load(open('$CONFIG_FILE')).get('project',{}).get('beadPrefix','orch'))" 2>/dev/null || echo orch)"
STATE_FILE="/tmp/orch-monitor-state-${PROJECT_NAME}.txt"
PID_FILE="/tmp/orch-daemon-${PROJECT_NAME}.pid"
LOG_FILE="/tmp/orch-daemon-${PROJECT_NAME}.log"

[[ -z "$SESSION" ]] && { echo "[orch-daemon] not in tmux"; exit 1; }

cleanup() {
  [[ -f "$PID_FILE" ]] && grep -q "^$$" "$PID_FILE" 2>/dev/null && rm -f "$PID_FILE"
  log "stopped (pid $$)"
}
trap cleanup EXIT

log() {
  echo "[$(date '+%H:%M:%S')] [orch-daemon] $*" >> "$LOG_FILE"
}

inject() {
  local msg="$1"
  log "inject: $msg"
  tmux send-keys -t "${SESSION}:0.0" "$msg" Enter 2>/dev/null || true
  osascript -e "display notification \"$msg\" with title \"orch\"" 2>/dev/null || true
}

# Extract normalized "bead status" pairs from monitor state file
extract_states() {
  grep -E '^'"$BEAD_PREFIX"'-\S+\s+' "$STATE_FILE" 2>/dev/null | awk '{print $1, $5}' | tail -r | awk '!seen[$1]++' | sort || true
}

# --- Main ---

echo $$ > "$PID_FILE"

log "started pid=$$ interval=${INTERVAL}s session=$SESSION"
log "reading state from $STATE_FILE"

old_states=""

while true; do
  tmux has-session -t "$SESSION" 2>/dev/null || { log "session gone"; exit 0; }

  new_states="$(extract_states)"

  log "old=$(echo "$old_states" | wc -l | tr -d ' ') new=$(echo "$new_states" | wc -l | tr -d ' ')"

  if [[ -n "$old_states" && -n "$new_states" ]]; then
    # Diff: find lines that changed (sort to ignore reorder from refreshes)
    diff_out="$(diff <(echo "$old_states") <(echo "$new_states") 2>/dev/null || true)"

    if [[ -n "$diff_out" ]]; then
      log "state change detected"
      # Find new/changed beads (> lines from diff)
      changed="$(echo "$diff_out" | grep '^>' | sed 's/^> //')"
      if [[ -n "$changed" ]]; then
        while IFS= read -r line; do
          [[ -z "$line" ]] && continue
          bead="$(echo "$line" | awk '{print $1}')"
          executor="$(echo "$line" | awk '{print $2}')"

          # Only notify on actual state transitions
          prev_exec="$(echo "$old_states" | grep "^$bead " | awk '{print $2}')"
          if [[ "$prev_exec" != "$executor" ]]; then
            inject "[ORCH] $bead: ${prev_exec:-NEW} -> $executor"
          fi
        done <<< "$changed"
      fi
    fi
  fi

  # Rotate
  old_states="$new_states"

  # --- Poll bd for CC completion ---
  # Find CC beads tracked as running, check if bd closed them
  TRACKER="${ORCH_TRACKER:-/tmp/orch-tasks-${PROJECT_NAME}.jsonl}"
  cc_running="$(grep '"type":"cc"' "$TRACKER" 2>/dev/null | grep '"status":"running"' || true)"
  if [[ -n "$cc_running" ]]; then
    closed_beads="$(bd list --status=closed --format=json 2>/dev/null | python3 -c "
import json, sys
try:
    for issue in json.load(sys.stdin):
        print(issue.get('id', ''))
except: pass
" 2>/dev/null || true)"
    if [[ -n "$closed_beads" ]]; then
      while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        bead="$(echo "$line" | grep -oE '"bead":"[^"]+"' | head -1 | cut -d'"' -f4)"
        [[ -z "$bead" ]] && continue
        if echo "$closed_beads" | grep -q "$bead"; then
          log "CC bead $bead closed in bd, marking completed"
          # Update tracker directly
          tmp="$(mktemp)"
          sed "s/\"bead\":\"$bead\".*\"status\":\"running\"/\"bead\":\"$bead\",\"type\":\"cc\",\"status\":\"completed\"/" "$TRACKER" > "$tmp" && mv "$tmp" "$TRACKER"
          inject "[ORCH] $bead: running -> completed (bd closed)"
        fi
      done <<< "$cc_running"
    fi
  fi

  log "cycle done, next in ${INTERVAL}s"
  sleep "$INTERVAL"
done
