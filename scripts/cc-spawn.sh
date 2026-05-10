#!/usr/bin/env bash
set -euo pipefail
# cc-spawn.sh — Spawn CC agent in current tmux session
# Usage:
#   cc-spawn.sh              # new pane (split right)
#   cc-spawn.sh 1            # in specific pane (replaces current process)
#   cc-spawn.sh --kill 1     # kill pane

SESSION="$(tmux display-message -p '#{session_name}')"

case "${1:-}" in
  --kill|-k)
    PANE="${2:?Usage: cc-spawn.sh --kill <pane>}"
    tmux kill-pane -t "$SESSION:0.$PANE"
    ;;
  [0-9]*)
    # Spawn in specific pane
    tmux send-keys -t "$SESSION:0.$1" "openclaude --dangerously-skip-permissions" Enter
    echo "CC spawned in pane $1"
    ;;
  *)
    # New pane split right
    tmux split-window -h "openclaude --dangerously-skip-permissions"
    echo "CC spawned in new pane"
    ;;
esac
