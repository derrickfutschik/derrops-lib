#!/bin/bash

# AI-powered git commit script
# Generates a commit message using AI analysis and allows user to edit before committing

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if there are staged changes
if ! git diff --cached --quiet 2>/dev/null; then
    HAS_STAGED=true
elif ! git diff --quiet 2>/dev/null || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    HAS_STAGED=false
else
    echo -e "${RED}Error: No changes to commit${NC}"
    exit 1
fi

# Create a temporary file for the commit message
TEMP_MSG=$(mktemp)
trap "rm -f $TEMP_MSG" EXIT

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}🤖 AI Commit Message Generator${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Stage files if needed and user agrees
if [ "$HAS_STAGED" = false ]; then
    echo -e "${YELLOW}No files are staged. Would you like to stage all changes? (y/n)${NC}"
    read -r STAGE_ALL
    if [ "$STAGE_ALL" = "y" ] || [ "$STAGE_ALL" = "Y" ]; then
        echo -e "${YELLOW}Staging all changes...${NC}"
        git add -A
        HAS_STAGED=true
    else
        echo -e "${RED}Aborted: No files staged for commit${NC}"
        exit 1
    fi
fi

echo -e "${YELLOW}Analyzing changes and generating commit message...${NC}"
echo ""

# Generate the commit message using the Node.js script
if ! node "$SCRIPT_DIR/generate-commit-message.cjs" > "$TEMP_MSG" 2>/dev/null; then
    echo -e "${RED}Error: Failed to generate commit message${NC}"
    exit 1
fi

# Show preview of generated message
echo -e "${GREEN}Generated commit message preview:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
grep -v '^#' "$TEMP_MSG" | head -5
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Opening editor for review and editing...${NC}"
echo ""

# Open the editor
EDITOR=${GIT_EDITOR:-${VISUAL:-${EDITOR:-vi}}}
$EDITOR "$TEMP_MSG"

# Extract the commit message (remove comments and leading/trailing empty lines)
FINAL_MSG=$(grep -v '^#' "$TEMP_MSG" | sed -e '/./,$!d' -e :a -e '/^\n*$/{$d;N;ba' -e '}')

# Check if message is empty
if [ -z "$FINAL_MSG" ]; then
    echo -e "${RED}Commit aborted: empty commit message${NC}"
    exit 1
fi

# Show final message and confirm
echo ""
echo -e "${GREEN}Final commit message:${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo "$FINAL_MSG"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}Proceed with commit? (y/n)${NC}"
read -r CONFIRM

if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
    echo -e "${RED}Commit aborted by user${NC}"
    exit 1
fi

# Create the commit using git commit (which will allow hooks to run)
echo "$FINAL_MSG" | git commit -F -

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✓ Commit successful!${NC}"
    echo ""
    # Show the commit
    git log -1 --oneline
else
    echo -e "${RED}✗ Commit failed${NC}"
    exit 1
fi
