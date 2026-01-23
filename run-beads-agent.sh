#!/bin/bash
#
# Beads Agent Runner
# Continuously processes beads issues until all are complete
#
# Usage: ./run-beads-agent.sh [--dry-run]
#
# To observe without breaking:
#   tmux attach -t beads-agent -r    # Read-only attach
#   OR
#   tmux attach -t beads-agent       # Full attach (Ctrl+B D to detach safely)

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

PROMPT_FILE="${SCRIPT_DIR}/prompt.md"
SESSION_NAME="beads-agent"
LOG_FILE="${SCRIPT_DIR}/beads-agent.log"
DRY_RUN=false

# Timeout settings (in seconds)
ITERATION_TIMEOUT=1800   # 30 minutes max per iteration
STUCK_TIMEOUT=120        # 2 minutes of no output = stuck

# Parse arguments
if [[ "$1" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "DRY RUN MODE - will show what would be executed"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() {
    local msg="[$(date '+%Y-%m-%d %H:%M:%S')] $1"
    echo -e "$msg" | tee -a "$LOG_FILE"
}

check_ready_beads() {
    # Check if there are any ready beads to work on
    local ready_count
    ready_count=$(bd ready 2>/dev/null | grep -c "^beads-" || echo "0")
    echo "$ready_count"
}

check_open_beads() {
    # Check if there are any open beads at all
    local open_count
    open_count=$(bd list --status=open 2>/dev/null | grep -c "^beads-" || echo "0")
    echo "$open_count"
}

check_in_progress() {
    # Check if there are any in-progress beads
    local in_progress
    in_progress=$(bd list --status=in_progress 2>/dev/null | grep -c "^beads-" || echo "0")
    echo "$in_progress"
}

build_prompt() {
    # Build the full prompt: /beads:prime + prompt.md content + instructions
    local prompt="/beads:prime"

    prompt+=$'\n\n'
    prompt+="IMPORTANT: Work autonomously. Do NOT ask for clarification - make reasonable decisions and proceed. If you encounter any issue, log it and move to the next task. Complete as much work as possible in this session."

    if [[ -f "$PROMPT_FILE" ]]; then
        prompt+=$'\n\n'
        prompt+="$(cat "$PROMPT_FILE")"
    fi

    echo "$prompt"
}

run_claude_with_timeout() {
    local prompt="$1"
    local output_file
    output_file=$(mktemp)
    local pid
    local last_size=0
    local stuck_counter=0

    log "Starting Claude with ${ITERATION_TIMEOUT}s timeout, ${STUCK_TIMEOUT}s stuck detection..."

    # Start Claude in background
    # - Pipe prompt via stdin
    # - timeout kills if exceeds ITERATION_TIMEOUT
    # - Capture exit code for crash detection
    (
        set +e  # Don't exit on error within subshell
        echo "$prompt" | timeout "$ITERATION_TIMEOUT" claude --dangerously-skip-permissions 2>&1
        exit_code=$?
        echo ""
        echo "EXIT_CODE:$exit_code"
        # Exit codes: 0=success, 124=timeout, 130=SIGINT, 137=SIGKILL, other=crash
        if [[ $exit_code -ne 0 && $exit_code -ne 124 ]]; then
            echo "CRASH_DETECTED:$exit_code"
        fi
    ) > "$output_file" 2>&1 &
    pid=$!

    # Monitor for stuck state (no output for STUCK_TIMEOUT seconds)
    while kill -0 "$pid" 2>/dev/null; do
        sleep 5

        # Stream output to log and terminal
        local current_size
        current_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")

        if [[ "$current_size" -gt "$last_size" ]]; then
            # New output - show it and reset stuck counter
            tail -c +$((last_size + 1)) "$output_file"
            tail -c +$((last_size + 1)) "$output_file" >> "$LOG_FILE"
            last_size=$current_size
            stuck_counter=0
        else
            # No new output
            ((stuck_counter+=5))
            if [[ $stuck_counter -ge $STUCK_TIMEOUT ]]; then
                log "${YELLOW}No output for ${STUCK_TIMEOUT}s - Claude may be stuck. Terminating...${NC}"
                kill -TERM "$pid" 2>/dev/null || true
                sleep 2
                kill -9 "$pid" 2>/dev/null || true
                break
            fi
        fi
    done

    # Wait for process to fully exit
    wait "$pid" 2>/dev/null || true

    # Show any remaining output
    local final_size
    final_size=$(stat -f%z "$output_file" 2>/dev/null || stat -c%s "$output_file" 2>/dev/null || echo "0")
    if [[ "$final_size" -gt "$last_size" ]]; then
        tail -c +$((last_size + 1)) "$output_file"
        tail -c +$((last_size + 1)) "$output_file" >> "$LOG_FILE"
    fi

    # Check exit code from output
    local exit_line
    exit_line=$(grep "EXIT_CODE:" "$output_file" | tail -1 || echo "")
    local exit_code
    exit_code=$(echo "$exit_line" | sed 's/EXIT_CODE://' || echo "1")

    rm -f "$output_file"

    log "Claude session ended with code: $exit_code"
    return 0
}

run_agent_iteration() {
    local iteration=$1
    log "${BLUE}========================================${NC}"
    log "${BLUE}=== Iteration $iteration ===${NC}"
    log "${BLUE}========================================${NC}"

    # Check for ready work
    local ready=$(check_ready_beads)
    local open=$(check_open_beads)
    local in_progress=$(check_in_progress)

    log "Status - Ready: $ready, Open: $open, In-progress: $in_progress"

    # All done check
    if [[ "$ready" -eq 0 && "$open" -eq 0 && "$in_progress" -eq 0 ]]; then
        log "${GREEN}All beads complete! No open work remaining.${NC}"
        return 1  # Signal to stop
    fi

    # Only in-progress but none ready - might be blocked
    if [[ "$ready" -eq 0 && "$in_progress" -gt 0 ]]; then
        log "${YELLOW}Warning: $in_progress beads in-progress but none ready.${NC}"
        log "Checking blocked status..."
        bd blocked 2>/dev/null || true
        # Continue anyway - Claude might be able to make progress
    fi

    # No ready and no in-progress, but still open = all blocked
    if [[ "$ready" -eq 0 && "$in_progress" -eq 0 && "$open" -gt 0 ]]; then
        log "${YELLOW}All $open open beads are blocked. Checking...${NC}"
        bd blocked 2>/dev/null || true
        log "${RED}Cannot proceed - all remaining beads are blocked.${NC}"
        return 1
    fi

    local full_prompt
    full_prompt=$(build_prompt)

    if [[ "$DRY_RUN" == "true" ]]; then
        log "Would run claude with prompt:"
        echo "---"
        echo "$full_prompt" | head -30
        echo "... (truncated)"
        echo "---"
        sleep 2
        return 0
    fi

    # Run Claude with timeout and stuck detection
    run_claude_with_timeout "$full_prompt"

    # Brief pause between iterations
    log "Pausing 10s before next iteration..."
    sleep 10

    return 0
}

main() {
    log "${GREEN}========================================${NC}"
    log "${GREEN}=== Beads Agent Runner Started ===${NC}"
    log "${GREEN}========================================${NC}"
    log "Working directory: $SCRIPT_DIR"
    log "Prompt file: $PROMPT_FILE"
    log "Log file: $LOG_FILE"
    log "Iteration timeout: ${ITERATION_TIMEOUT}s"
    log "Stuck detection: ${STUCK_TIMEOUT}s"

    # Verify we're in a git repo with beads
    if [[ ! -d ".beads" ]]; then
        log "${RED}Error: No .beads directory found. Are you in the right directory?${NC}"
        exit 1
    fi

    # Show initial status
    log "Initial beads status:"
    bd stats 2>/dev/null || log "Could not get stats"
    echo ""
    log "Ready beads:"
    bd ready 2>/dev/null || log "None ready"
    echo ""

    local iteration=1
    local max_iterations=100  # Safety limit

    while [[ $iteration -le $max_iterations ]]; do
        if ! run_agent_iteration $iteration; then
            break
        fi
        ((iteration++))
    done

    if [[ $iteration -gt $max_iterations ]]; then
        log "${RED}Reached maximum iterations ($max_iterations). Stopping.${NC}"
    fi

    log "${GREEN}========================================${NC}"
    log "${GREEN}=== Beads Agent Runner Complete ===${NC}"
    log "${GREEN}========================================${NC}"
    log "Total iterations: $((iteration - 1))"
    log "Final status:"
    bd stats 2>/dev/null || true
}

# Run main
main
