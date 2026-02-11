#!/bin/bash
# Wrapper for VS Code Jest Runner extension in a pnpm monorepo.
# Detects which package a test file belongs to and runs via pnpm --filter.
#
# The jest-runner extension constructs:
#   {jestCommand} '{filePath}' -t '{testName}'
# This script replaces {jestCommand} so the full invocation becomes:
#   ./scripts/jest-runner.sh '/abs/path/to/file\.test\.ts' -t 'TestName'

set -e

MONOREPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# First argument is the test file path (regex-escaped by jest-runner)
TEST_FILE_PATTERN="$1"
shift

# Remove regex escaping to get the actual file path
ACTUAL_FILE="${TEST_FILE_PATTERN//\\/}"

# Make path relative to monorepo root
RELATIVE_PATH="${ACTUAL_FILE#$MONOREPO_ROOT/}"

# Extract the package directory (apps/<name> or packages/<name>)
PACKAGE_DIR=$(echo "$RELATIVE_PATH" | cut -d'/' -f1,2)

# Get the package name from package.json
PACKAGE_JSON="$MONOREPO_ROOT/$PACKAGE_DIR/package.json"
if [ ! -f "$PACKAGE_JSON" ]; then
    echo "Error: Could not find package.json at $PACKAGE_JSON" >&2
    exit 1
fi
PACKAGE_NAME=$(node -e "console.log(require('$PACKAGE_JSON').name)")

# Get the file path relative to the package root (re-escape dots for jest regex)
FILE_IN_PACKAGE="${RELATIVE_PATH#$PACKAGE_DIR/}"
FILE_IN_PACKAGE_ESCAPED="${FILE_IN_PACKAGE//./\\.}"

echo "Running: pnpm --filter $PACKAGE_NAME run test -- --testPathPattern '$FILE_IN_PACKAGE_ESCAPED' $*"
exec pnpm --filter "$PACKAGE_NAME" run test -- --testPathPattern "$FILE_IN_PACKAGE_ESCAPED" "$@"
