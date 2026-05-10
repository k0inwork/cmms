#!/usr/bin/env bash
set -euo pipefail
# cc-send.sh — Send task to CC agent in current tmux session
# Usage:
#   cc-send.sh 1 "fix the login bug"
#   cc-send.sh 1 /tmp/task.txt      # send file contents
#   cc-send.sh --list                # list panes

SESSION="$(tmux display-message -p '#{session_name}')"

case "${1:-}" in
  --list|-l)
    tmux list-panes -t "$SESSION" -F '#{pane_index}: #{pane_current_command} (#{pane_width}x#{pane_height})'
    ;;
  *)
    PANE="${1:?Usage: cc-send.sh <pane> <message-or-file>}"
    MSG="${2:?Usage: cc-send.sh <pane> <message-or-file>}"
    TARGET="$SESSION:0.$PANE"

    if [[ -f "$MSG" ]]; then
      tmux load-buffer "$MSG"
      tmux paste-buffer -t "$TARGET"
    else
      tmux send-keys -t "$TARGET" "$MSG"
    fi
    # Send Enter to submit
    tmux send-keys -t "$TARGET" Enter
    echo "Sent to pane $PANE"
    ;;
esac
