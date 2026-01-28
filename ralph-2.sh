#!/bin/bash
#
# Beads Agent Runner (ralph-2.sh)
# Runs Claude interactively in tmux, injecting prompts via send-keys
#
# Usage: ./ralph-2.sh [--dry-run] [--no-tmux]
#
# By default, launches everything in tmux for safe detachment.
# Use --no-tmux to run controller in current terminal.
#
# To observe:
#   tmux attach -t beads-agent -r    # Read-only (safe)
#   tmux attach -t beads-agent       # Full attach (Ctrl+B D to detach)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "${BASH_SOURCE[0]}")"
cd "$SCRIPT_DIR"

SESSION_NAME="beads-agent"
CLAUDE_WINDOW="claude"
CONTROLLER_WINDOW="controller"
PROMPT_FILE="${SCRIPT_DIR}/prompt.md"
LOG_FILE="${SCRIPT_DIR}/beads-agent.log"
BEADS_PREFIX=$(basename "$SCRIPT_DIR")

# Timing settings
CLAUDE_STARTUP_WAIT=5        # Seconds to wait for Claude to start
IDLE_CHECK_INTERVAL=10       # Seconds between idle checks
IDLE_THRESHOLD=120           # Seconds of no output = Claude is done/stuck (2 min)
ITERATION_PAUSE=5            # Seconds between iterations

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

# Parse arguments
DRY_RUN=false
NO_TMUX=false
INSIDE_TMUX_CONTROLLER=false

for arg in "$@"; do
    case $arg in
        --dry-run) DRY_RUN=true ;;
        --no-tmux) NO_TMUX=true ;;
        --controller) INSIDE_TMUX_CONTROLLER=true ;;  # Internal: running as controller inside tmux
    esac
done

# =============================================================================
# TMUX SELF-LAUNCH: Launch controller inside tmux if not already there
# =============================================================================
if [[ "$NO_TMUX" != "true" && "$INSIDE_TMUX_CONTROLLER" != "true" ]]; then
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
            sleep 1
        else
            echo "Exiting. Use commands above to interact with existing session."
            exit 0
        fi
    fi

    echo -e "${BLUE}Starting beads agent in tmux session: $SESSION_NAME${NC}"

    # Build args to pass through
    PASSTHROUGH_ARGS="--controller"
    [[ "$DRY_RUN" == "true" ]] && PASSTHROUGH_ARGS+=" --dry-run"

    # Create tmux session with controller running in it
    tmux new-session -d -s "$SESSION_NAME" -n "$CONTROLLER_WINDOW" -c "$SCRIPT_DIR" \
        "bash -c './$SCRIPT_NAME $PASSTHROUGH_ARGS; echo; echo \"=== Agent complete. Press Enter to close ===\"; read'"

    echo ""
    echo -e "${GREEN}Agent started in background!${NC}"
    echo ""
    echo "=========================================="
    echo -e "${YELLOW}HOW TO OBSERVE:${NC}"
    echo "=========================================="
    echo ""
    echo -e "  ${GREEN}RECOMMENDED - Read-only attach:${NC}"
    echo "    tmux attach -t $SESSION_NAME -r"
    echo ""
    echo "  Press Ctrl+B then D to detach safely."
    echo ""
    echo -e "  ${BLUE}Switch windows inside tmux:${NC}"
    echo "    Ctrl+B then N (next) or P (previous)"
    echo "    Window 0: controller | Window 1: claude"
    echo ""
    echo -e "  ${BLUE}View logs:${NC}"
    echo "    tail -f $LOG_FILE"
    echo ""
    echo -e "  ${BLUE}Kill the session:${NC}"
    echo "    tmux kill-session -t $SESSION_NAME"
    echo ""
    echo "=========================================="
    exit 0
fi

# =============================================================================
# CONTROLLER LOGIC (runs inside tmux)
# =============================================================================

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

check_ready_beads() {
    bd ready 2>/dev/null | grep -oE "${BEADS_PREFIX}-[a-z0-9]+" | wc -l | tr -d '[:space:]'
}

check_open_beads() {
    bd list --status=open 2>/dev/null | grep -oE "${BEADS_PREFIX}-[a-z0-9]+" | wc -l | tr -d '[:space:]'
}

check_in_progress() {
    bd list --status=in_progress 2>/dev/null | grep -oE "${BEADS_PREFIX}-[a-z0-9]+" | wc -l | tr -d '[:space:]'
}

get_pane_content_hash() {
    # Get a hash of the Claude window pane content to detect changes
    tmux capture-pane -t "$SESSION_NAME:$CLAUDE_WINDOW" -p 2>/dev/null | tail -50 | md5sum | cut -d' ' -f1
}

wait_for_claude_idle() {
    # Wait until Claude stops producing output (idle)
    local last_hash=""
    local current_hash=""
    local idle_seconds=0

    log "Waiting for Claude to finish..."

    while true; do
        sleep "$IDLE_CHECK_INTERVAL"

        current_hash=$(get_pane_content_hash)

        if [[ "$current_hash" == "$last_hash" ]]; then
            ((idle_seconds += IDLE_CHECK_INTERVAL))
            if [[ $idle_seconds -ge $IDLE_THRESHOLD ]]; then
                log "Claude idle for ${idle_seconds}s - ready for next prompt"
                return 0
            fi
        else
            idle_seconds=0
            last_hash="$current_hash"
        fi

        # Check if Claude window still exists
        if ! tmux list-windows -t "$SESSION_NAME" 2>/dev/null | grep -q "$CLAUDE_WINDOW"; then
            log "${RED}Claude window died unexpectedly${NC}"
            return 1
        fi
    done
}

send_to_claude() {
    local text="$1"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN - Would send: ${text:0:100}..."
        return 0
    fi

    # Send text to Claude window, then press Enter
    # Using send-keys with literal flag for special characters
    tmux send-keys -t "$SESSION_NAME:$CLAUDE_WINDOW" -l "$text"
    tmux send-keys -t "$SESSION_NAME:$CLAUDE_WINDOW" Enter

    log "Sent prompt to Claude (${#text} chars)"
}

start_claude_session() {
    # Check if Claude window already exists, kill it if so
    if tmux list-windows -t "$SESSION_NAME" 2>/dev/null | grep -q "$CLAUDE_WINDOW"; then
        log "Killing existing Claude window..."
        tmux kill-window -t "$SESSION_NAME:$CLAUDE_WINDOW" 2>/dev/null || true
        sleep 1
    fi

    log "Starting Claude in tmux window: $CLAUDE_WINDOW"

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY RUN - Would start: claude --dangerously-skip-permissions"
        tmux new-window -t "$SESSION_NAME" -n "$CLAUDE_WINDOW" -c "$SCRIPT_DIR" "bash"
    else
        # Start Claude interactively in a new tmux window
        tmux new-window -t "$SESSION_NAME" -n "$CLAUDE_WINDOW" -c "$SCRIPT_DIR" \
            "claude --dangerously-skip-permissions 2>&1 | tee -a '$LOG_FILE'"
    fi

    log "Waiting ${CLAUDE_STARTUP_WAIT}s for Claude to initialize..."
    sleep "$CLAUDE_STARTUP_WAIT"

    # Verify window exists
    if ! tmux list-windows -t "$SESSION_NAME" 2>/dev/null | grep -q "$CLAUDE_WINDOW"; then
        log "${RED}Failed to start Claude window${NC}"
        return 1
    fi

    log "${GREEN}Claude session started${NC}"
    return 0
}

build_prompt() {
    local prompt="/beads:prime"
    prompt+=$'\n\n'
    prompt+="IMPORTANT: Work autonomously. Do NOT ask for clarification - make reasonable decisions and proceed. If you encounter any issue, log it and move to the next task. Complete as much work as possible in this session."

    if [[ -f "$PROMPT_FILE" ]]; then
        prompt+=$'\n\n'
        prompt+="$(cat "$PROMPT_FILE")"
    fi

    echo "$prompt"
}

run_iteration() {
    local iteration=$1

    log "${BLUE}========================================${NC}"
    log "${BLUE}=== Iteration $iteration ===${NC}"
    log "${BLUE}========================================${NC}"

    local ready=$(check_ready_beads)
    local open=$(check_open_beads)
    local in_progress=$(check_in_progress)

    ready=${ready:-0}
    open=${open:-0}
    in_progress=${in_progress:-0}

    log "Status - Ready: $ready, Open: $open, In-progress: $in_progress"

    # Check completion conditions
    if [[ "$ready" -eq 0 && "$open" -eq 0 && "$in_progress" -eq 0 ]]; then
        log "${GREEN}All beads complete!${NC}"
        return 1
    fi

    if [[ "$ready" -eq 0 && "$in_progress" -eq 0 && "$open" -gt 0 ]]; then
        log "${RED}All $open beads are blocked. Cannot proceed.${NC}"
        bd blocked 2>/dev/null || true
        return 1
    fi

    # Build and send prompt
    local prompt
    prompt=$(build_prompt)

    send_to_claude "$prompt"

    # Wait for Claude to finish processing
    if ! wait_for_claude_idle; then
        log "${YELLOW}Session ended unexpectedly, restarting...${NC}"
        start_claude_session || return 1
    fi

    log "Pausing ${ITERATION_PAUSE}s before next iteration..."
    sleep "$ITERATION_PAUSE"

    return 0
}

main() {
    log "${GREEN}========================================${NC}"
    log "${GREEN}=== Beads Agent Runner Started ===${NC}"
    log "${GREEN}========================================${NC}"
    log "Working directory: $SCRIPT_DIR"
    log "Beads prefix: $BEADS_PREFIX"
    log "Idle threshold: ${IDLE_THRESHOLD}s"

    # Verify beads directory exists
    if [[ ! -d ".beads" ]]; then
        log "${RED}Error: No .beads directory found${NC}"
        exit 1
    fi

    # Show initial status
    log "Initial status:"
    bd stats 2>/dev/null || log "Could not get stats"
    echo ""

    # Start Claude session
    if ! start_claude_session; then
        log "${RED}Failed to start Claude session${NC}"
        exit 1
    fi

    log ""
    log "Controller running. Claude in window '$CLAUDE_WINDOW'"
    log "Switch windows: Ctrl+B then N/P"
    log ""

    local iteration=1
    local max_iterations=1000

    while [[ $iteration -le $max_iterations ]]; do
        if ! run_iteration $iteration; then
            break
        fi
        ((iteration++))
    done

    log "${GREEN}========================================${NC}"
    log "${GREEN}=== Agent Complete ===${NC}"
    log "${GREEN}========================================${NC}"
    log "Total iterations: $((iteration - 1))"

    # Clean up - kill Claude window if it's still running
    if tmux list-windows -t "$SESSION_NAME" 2>/dev/null | grep -q "$CLAUDE_WINDOW"; then
        log "Killing Claude window..."
        tmux kill-window -t "$SESSION_NAME:$CLAUDE_WINDOW" 2>/dev/null || true
    fi

    log "Agent finished. Session will close when you press Enter."
}

main
