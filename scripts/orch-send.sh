#!/usr/bin/env bash
set -euo pipefail

SESSION="${1:?Usage: orch-send.sh <session> <pane> <message-or-file>}"
PANE="${2:?Missing pane number}"
MSG="$3"

# If argument is a file, load it into buffer then paste
if [[ -f "$MSG" ]]; then
  tmux load-buffer "$MSG"
  tmux paste-buffer -t "$SESSION:0.$PANE"
else
  tmux send-keys -t "$SESSION:0.$PANE" "$MSG"
fi

# Always send Enter separately (agents need it to process)
sleep 0.5
tmux send-keys -t "$SESSION:0.$PANE" Enter
