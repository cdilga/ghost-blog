#!/bin/bash
#
# Start the Beads Agent in a tmux session
#
# This script:
# 1. Creates a new tmux session called "beads-agent"
# 2. Runs the beads processing loop
# 3. Provides instructions for safe observation
#

SESSION_NAME="beads-agent"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${GREEN}=== Beads Agent Launcher ===${NC}"
echo ""

# Check if session already exists
if tmux has-session -t "$SESSION_NAME" 2>/dev/null; then
    echo -e "${YELLOW}Session '$SESSION_NAME' already exists.${NC}"
    echo ""
    echo "Options:"
    echo "  1. Attach read-only:  tmux attach -t $SESSION_NAME -r"
    echo "  2. Attach full:       tmux attach -t $SESSION_NAME"
    echo "  3. Kill existing:     tmux kill-session -t $SESSION_NAME"
    echo ""
    read -p "Kill existing session and start fresh? [y/N]: " choice
    if [[ "$choice" =~ ^[Yy]$ ]]; then
        tmux kill-session -t "$SESSION_NAME"
        echo "Session killed."
    else
        echo "Exiting. Use commands above to interact with existing session."
        exit 0
    fi
fi

echo -e "${BLUE}Starting beads agent in tmux session: $SESSION_NAME${NC}"
echo ""

# Create new detached tmux session and run the agent
tmux new-session -d -s "$SESSION_NAME" -c "$SCRIPT_DIR" \
    "bash -c './run-beads-agent.sh; echo; echo \"=== Agent complete. Press Enter to close ===\"; read'"

echo -e "${GREEN}Agent started!${NC}"
echo ""
echo "=========================================="
echo -e "${YELLOW}HOW TO OBSERVE WITHOUT BREAKING:${NC}"
echo "=========================================="
echo ""
echo -e "  ${GREEN}RECOMMENDED - Read-only attach:${NC}"
echo "    tmux attach -t $SESSION_NAME -r"
echo ""
echo "  This lets you watch without accidentally sending keystrokes."
echo "  Press Ctrl+B then D to detach."
echo ""
echo -e "  ${BLUE}Full attach (allows interaction):${NC}"
echo "    tmux attach -t $SESSION_NAME"
echo ""
echo "  WARNING: Any keystrokes will go to the running Claude!"
echo "  Only use if you need to interrupt. Ctrl+C to stop agent."
echo "  Ctrl+B then D to detach safely."
echo ""
echo -e "  ${BLUE}View logs in another terminal:${NC}"
echo "    tail -f $SCRIPT_DIR/beads-agent.log"
echo ""
echo -e "  ${BLUE}Check if session is still running:${NC}"
echo "    tmux ls"
echo ""
echo -e "  ${BLUE}Kill the session:${NC}"
echo "    tmux kill-session -t $SESSION_NAME"
echo ""
echo "=========================================="
