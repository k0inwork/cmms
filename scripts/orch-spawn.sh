#!/usr/bin/env bash
set -euo pipefail

SESSION="${1:?Usage: orch-spawn.sh <session> <project-dir> [agents=3]}"
PROJECT_DIR="${2:?Missing project-dir}"
AGENTS="${3:-3}"

# Kill existing session if any
tmux kill-session -t "$SESSION" 2>/dev/null || true

# Create session with orchestrator pane
tmux new-session -d -s "$SESSION" -c "$PROJECT_DIR"

# Split off agent panes (vertical splits stack them on the right)
for i in $(seq 1 "$AGENTS"); do
  tmux split-window -t "$SESSION:0" -h -c "$PROJECT_DIR"
done

# Layout: pane 0 large on left, agents stacked on right
tmux select-layout -t "$SESSION:0" main-vertical
tmux resize-pane -t "$SESSION:0.0" -x 70%

# Launch agents in panes 1..N
for pane in $(seq 1 "$AGENTS"); do
  tmux send-keys -t "$SESSION:0.$pane" 'openclaude --dangerously-skip-permissions' Enter
done

# Accept bypass for all agent panes (arrow down + enter)
sleep 10
for pane in $(seq 1 "$AGENTS"); do
  tmux send-keys -t "$SESSION:0.$pane" Down
  sleep 1
  tmux send-keys -t "$SESSION:0.$pane" Enter
done

echo "Session '$SESSION' ready. $AGENTS agents in panes 1-$AGENTS."
echo "Attach: tmux attach -t $SESSION"
