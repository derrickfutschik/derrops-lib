#!/bin/bash

# Script to run tests in watch mode with desktop notifications
# Usage: ./scripts/test-watch-notify.sh [turbo test:watch args...]
# Example: ./scripts/test-watch-notify.sh
#          ./scripts/test-watch-notify.sh --filter @slaops/private

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}🔄 Starting test watch mode with notifications${NC}"
echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Notifications will appear after each test run${NC}"
echo -e "${YELLOW}Press Ctrl+C to exit watch mode${NC}"
echo ""

# Create a temporary directory for our state
TEMP_DIR=$(mktemp -d)
OUTPUT_FILE="$TEMP_DIR/output.txt"
LAST_RESULT_FILE="$TEMP_DIR/last_result.txt"

# Cleanup function
cleanup() {
    echo ""
    echo -e "${BLUE}Stopping watch mode...${NC}"
    rm -rf "$TEMP_DIR"
    exit 0
}

# Set up trap to cleanup on exit
trap cleanup INT TERM EXIT

# Function to send notification using node-notifier
send_notification() {
    local TITLE="$1"
    local MESSAGE="$2"
    local SOUND="$3"

    # Use node-notifier for all notifications
    if command -v node &> /dev/null && [ -f "$(dirname "$0")/send-notification.cjs" ]; then
        node "$(dirname "$0")/send-notification.cjs" "$TITLE" "$MESSAGE" "$SOUND" 2>/dev/null
    else
        echo -e "${YELLOW}Warning: node-notifier not available${NC}"
    fi
}

# Function to parse and display test results
process_test_results() {
    local OUTPUT="$1"
    local START_TIME="$2"

    # Calculate duration
    local END_TIME=$(date +%s)
    local DURATION=$((END_TIME - START_TIME))

    # Format duration
    if [ $DURATION -ge 60 ]; then
        DURATION_STR="${DURATION}s ($((DURATION / 60))m $((DURATION % 60))s)"
    else
        DURATION_STR="${DURATION}s"
    fi

    # Parse output for summary
    local TOTAL_TESTS=$(echo "$OUTPUT" | grep -oE "[0-9]+ (tests?|total)" | tail -1 | grep -oE "[0-9]+" || echo "0")
    local PASSED_TESTS=$(echo "$OUTPUT" | grep -oE "[0-9]+ passed" | tail -1 | grep -oE "[0-9]+" || echo "0")
    local FAILED_TESTS=$(echo "$OUTPUT" | grep -oE "[0-9]+ failed" | tail -1 | grep -oE "[0-9]+" || echo "0")

    # Check if tests failed
    if echo "$OUTPUT" | grep -q "FAIL\|failed\|error" && [ "$FAILED_TESTS" -gt 0 ]; then
        # Tests failed
        local TITLE="❌ Tests Failed"
        local MESSAGE="$FAILED_TESTS/$TOTAL_TESTS tests failed in $DURATION_STR"
        local SOUND="Basso"

        echo ""
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${RED}❌ TEST RUN FAILED${NC}"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
        echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
        [ "$TOTAL_TESTS" -gt 0 ] && echo -e "  Total:  $TOTAL_TESTS"
        echo -e "  Duration: $DURATION_STR"
        echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

        send_notification "$TITLE" "$MESSAGE" "$SOUND"

        echo "FAIL" > "$LAST_RESULT_FILE"
    else
        # Tests passed
        local TITLE="✅ Tests Passed"
        local MESSAGE="All tests passed"
        if [ "$TOTAL_TESTS" -gt 0 ]; then
            MESSAGE="$PASSED_TESTS/$TOTAL_TESTS tests passed in $DURATION_STR"
        fi
        local SOUND="Glass"

        echo ""
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "${GREEN}✅ TEST RUN PASSED${NC}"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
        echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
        [ "$TOTAL_TESTS" -gt 0 ] && echo -e "  Total:  $TOTAL_TESTS"
        echo -e "  Duration: $DURATION_STR"
        echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

        send_notification "$TITLE" "$MESSAGE" "$SOUND"

        echo "PASS" > "$LAST_RESULT_FILE"
    fi

    echo ""
    echo -e "${CYAN}Watching for changes...${NC}"
}

# Start tests in watch mode in background, capturing output
# We'll use unbuffer if available to get real-time output, otherwise use stdbuf
if command -v unbuffer &> /dev/null; then
    unbuffer turbo run test:watch "$@" 2>&1 | while IFS= read -r line; do
        echo "$line"
        echo "$line" >> "$OUTPUT_FILE"

        # Detect when a test run completes (Jest outputs "Ran all test suites" or similar)
        if echo "$line" | grep -qE "Ran all test suites|Test Suites:.*total"; then
            # Give it a moment to finish outputting
            sleep 0.5

            # Process results
            START_TIME=$(date +%s)
            OUTPUT=$(cat "$OUTPUT_FILE")
            process_test_results "$OUTPUT" "$START_TIME" &

            # Clear the output file for next run
            > "$OUTPUT_FILE"
        fi
    done
elif command -v stdbuf &> /dev/null; then
    stdbuf -oL -eL turbo run test:watch "$@" 2>&1 | while IFS= read -r line; do
        echo "$line"
        echo "$line" >> "$OUTPUT_FILE"

        # Detect when a test run completes
        if echo "$line" | grep -qE "Ran all test suites|Test Suites:.*total"; then
            # Give it a moment to finish outputting
            sleep 0.5

            # Process results
            START_TIME=$(date +%s)
            OUTPUT=$(cat "$OUTPUT_FILE")
            process_test_results "$OUTPUT" "$START_TIME" &

            # Clear the output file for next run
            > "$OUTPUT_FILE"
        fi
    done
else
    # Fallback without unbuffering (may have delays)
    turbo run test:watch "$@" 2>&1 | while IFS= read -r line; do
        echo "$line"
        echo "$line" >> "$OUTPUT_FILE"

        # Detect when a test run completes
        if echo "$line" | grep -qE "Ran all test suites|Test Suites:.*total"; then
            # Give it a moment to finish outputting
            sleep 0.5

            # Process results
            START_TIME=$(date +%s)
            OUTPUT=$(cat "$OUTPUT_FILE")
            process_test_results "$OUTPUT" "$START_TIME" &

            # Clear the output file for next run
            > "$OUTPUT_FILE"
        fi
    done
fi
