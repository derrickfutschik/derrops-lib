#!/bin/bash

# Script to run tests with desktop notifications
# Usage: ./scripts/test-notify.sh [turbo test args...]
# Example: ./scripts/test-notify.sh
#          ./scripts/test-notify.sh --filter @slaops/core

set +e  # Don't exit on test failures

# Colors for terminal output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Store start time
START_TIME=$(date +%s)

echo -e "${BLUE}Starting test suite...${NC}"

# Create temp file for test output
TEMP_OUTPUT=$(mktemp)

# Run turbo test with all provided arguments
turbo run test "$@" 2>&1 | tee "$TEMP_OUTPUT"

# Capture exit code
EXIT_CODE=$?

# Calculate duration
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

# Format duration
if [ $DURATION -ge 60 ]; then
    DURATION_STR="${DURATION}s ($((DURATION / 60))m $((DURATION % 60))s)"
else
    DURATION_STR="${DURATION}s"
fi

# Parse output for summary
TOTAL_TESTS=$(grep -oE "[0-9]+ (tests?|total)" "$TEMP_OUTPUT" | tail -1 | grep -oE "[0-9]+" || echo "0")
PASSED_TESTS=$(grep -oE "[0-9]+ passed" "$TEMP_OUTPUT" | tail -1 | grep -oE "[0-9]+" || echo "0")
FAILED_TESTS=$(grep -oE "[0-9]+ failed" "$TEMP_OUTPUT" | tail -1 | grep -oE "[0-9]+" || echo "0")

# Clean up temp file
rm -f "$TEMP_OUTPUT"

# Determine notification content
if [ $EXIT_CODE -eq 0 ]; then
    # Tests passed
    TITLE="✅ Tests Passed"
    MESSAGE="All tests passed successfully!"
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        MESSAGE="$PASSED_TESTS/$TOTAL_TESTS tests passed in $DURATION_STR"
    fi
    SOUND="Glass"

    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}✅ TEST SUITE PASSED${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        echo -e "  Total:  $TOTAL_TESTS"
    fi
    echo -e "  Duration: $DURATION_STR"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
else
    # Tests failed
    TITLE="❌ Tests Failed"
    MESSAGE="Some tests failed"
    if [ "$FAILED_TESTS" -gt 0 ]; then
        MESSAGE="$FAILED_TESTS/$TOTAL_TESTS tests failed in $DURATION_STR"
    fi
    SOUND="Basso"

    echo ""
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${RED}❌ TEST SUITE FAILED${NC}"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  Failed: ${RED}$FAILED_TESTS${NC}"
    echo -e "  Passed: ${GREEN}$PASSED_TESTS${NC}"
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        echo -e "  Total:  $TOTAL_TESTS"
    fi
    echo -e "  Duration: $DURATION_STR"
    echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

# Send desktop notification using node-notifier
if command -v node &> /dev/null && [ -f "$(dirname "$0")/send-notification.cjs" ]; then
    node "$(dirname "$0")/send-notification.cjs" "$TITLE" "$MESSAGE" "$SOUND"
else
    echo -e "${YELLOW}Warning: node-notifier not available${NC}"
fi

# Exit with the same code as the tests
exit $EXIT_CODE
