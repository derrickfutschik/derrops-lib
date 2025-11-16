#!/bin/bash

# Script to generate git commit messages using Claude
# Usage: ./git-commit-ai.sh

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}Error: Not a git repository${NC}"
    exit 1
fi

# Check if there are staged changes
if git diff --cached --quiet; then
    echo -e "${YELLOW}No staged changes found.${NC}"
    
    # Check if there are any unstaged changes
    if git diff --quiet && git ls-files --others --exclude-standard | grep -q .; then
        # Only untracked files
        echo -e "${YELLOW}Found untracked files.${NC}"
        read -p "$(echo -e ${YELLOW}Would you like to stage all files? [y/N] ${NC})" -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add -A
            echo -e "${GREEN}✓ All files staged${NC}"
        else
            echo -e "${RED}Aborted: No changes staged${NC}"
            exit 1
        fi
    elif ! git diff --quiet; then
        # Unstaged changes exist
        echo -e "${YELLOW}Found unstaged changes.${NC}"
        read -p "$(echo -e ${YELLOW}Would you like to stage all files? [y/N] ${NC})" -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add -A
            echo -e "${GREEN}✓ All files staged${NC}"
        else
            echo -e "${RED}Aborted: No changes staged${NC}"
            exit 1
        fi
    else
        # No changes at all
        echo -e "${RED}No changes to commit${NC}"
        exit 1
    fi
else
    # We have staged changes, but check if there are also unstaged changes
    if ! git diff --quiet || git ls-files --others --exclude-standard | grep -q .; then
        echo -e "${YELLOW}Some changes are staged, but there are also unstaged/untracked changes.${NC}"
        read -p "$(echo -e ${YELLOW}Would you like to stage all remaining changes? [y/N] ${NC})" -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git add -A
            echo -e "${GREEN}✓ All files staged${NC}"
        else
            echo -e "${BLUE}Proceeding with currently staged changes only${NC}"
        fi
    fi
fi

# Check if claude is available
if ! command -v claude &> /dev/null; then
    echo -e "${RED}Error: claude not found${NC}"
    echo -e "${YELLOW}Please install Claude Code first${NC}"
    exit 1
fi

echo -e "${BLUE}Analyzing staged changes...${NC}"

# Get the diff of staged changes
DIFF=$(git diff --cached)

# Create the full prompt
PROMPT="You are helping me write git commit messages for this repository. Please follow these guidelines:

**Format:**
- Use conventional commit format: \`type(scope): description\`
- Types: feat, fix, docs, style, refactor, test, chore, perf
- Keep the first line under 72 characters
- Add a brief body paragraph if the change needs more context (optional)

**Style:**
- Use emojis to make messages more visual and scannable:
  - 🐛 for bug fixes
  - ✨ for new features
  - 📝 for documentation
  - ♻️ for refactoring
  - 🎨 for code style/formatting
  - ⚡ for performance improvements
  - ✅ for tests
  - 🔧 for configuration changes
  - 🚀 for deployments
  - 🔥 for removing code/files
  - 💥 for breaking changes
- Be descriptive but concise - aim for the \"sweet spot\" between too vague and overly detailed
- Use imperative mood (\"add feature\" not \"added feature\")
- Don't end the subject line with a period

**Examples:**
- \`✨ feat(auth): add OAuth2 login flow\`
- \`🐛 fix(api): handle null response in user endpoint\`
- \`📝 docs: update installation instructions for Docker setup\`
- \`♻️ refactor(database): simplify query builder logic\`
- \`⚡ perf(search): add caching layer for frequent queries\`

---

Based on the following git diff of staged changes, generate an appropriate commit message following the guidelines above. 

**IMPORTANT:** 
- Output ONLY the commit message itself
- Do NOT include any explanations, meta-commentary, or markdown formatting
- Do NOT wrap the message in code blocks or quotes
- Just output the raw commit message text

Here is the diff:

$DIFF"

# Call claude with the prompt
echo -e "${BLUE}Generating commit message with Claude...${NC}"
TEMP_RESPONSE=$(mktemp)

echo "$PROMPT" | claude > "$TEMP_RESPONSE" 2>&1 || {
    echo -e "${RED}Error: Failed to generate commit message${NC}"
    echo -e "${YELLOW}Claude output:${NC}"
    cat "$TEMP_RESPONSE"
    rm -f "$TEMP_RESPONSE"
    exit 1
}

# Extract the commit message (remove any potential markdown formatting)
COMMIT_MSG=$(cat "$TEMP_RESPONSE" | sed 's/^```.*$//' | sed '/^$/d' | grep -v '^#')

# Clean up temp files
rm -f "$TEMP_RESPONSE"

# Check if we got a message
if [ -z "$COMMIT_MSG" ]; then
    echo -e "${RED}Error: Failed to generate commit message${NC}"
    exit 1
fi

echo -e "${GREEN}Generated commit message:${NC}"
echo "---"
echo "$COMMIT_MSG"
echo "---"
echo ""

# Create a temporary file with the generated message
TEMP_MSG=$(mktemp)
echo "$COMMIT_MSG" > "$TEMP_MSG"

# Add git-style comment lines
echo "" >> "$TEMP_MSG"
echo "# Please enter the commit message for your changes. Lines starting" >> "$TEMP_MSG"
echo "# with '#' will be ignored, and an empty message aborts the commit." >> "$TEMP_MSG"
echo "#" >> "$TEMP_MSG"
echo "# Changes to be committed:" >> "$TEMP_MSG"
git diff --cached --name-status | sed 's/^/# /' >> "$TEMP_MSG"

# If there are unstaged changes, show them too
if ! git diff --quiet; then
    echo "#" >> "$TEMP_MSG"
    echo "# Changes not staged for commit:" >> "$TEMP_MSG"
    git diff --name-status | sed 's/^/# /' >> "$TEMP_MSG"
fi

# If there are untracked files, show them too
if git ls-files --others --exclude-standard | grep -q .; then
    echo "#" >> "$TEMP_MSG"
    echo "# Untracked files:" >> "$TEMP_MSG"
    git ls-files --others --exclude-standard | sed 's/^/# /' >> "$TEMP_MSG"
fi

# Store the original content to detect if user made changes
ORIGINAL_CONTENT=$(cat "$TEMP_MSG")

# Open in user's editor (prioritize vim, then fall back to git's core.editor, then EDITOR, then vi)
if command -v vim &> /dev/null; then
    vim "$TEMP_MSG"
elif [ -n "$(git config core.editor)" ]; then
    $(git config core.editor) "$TEMP_MSG"
elif [ -n "$EDITOR" ]; then
    $EDITOR "$TEMP_MSG"
else
    vi "$TEMP_MSG"
fi

# Read the edited content, removing comment lines and empty lines
EDITED_MSG=$(grep -v '^#' "$TEMP_MSG" | sed '/^$/d')

# Check if the message is empty (user exited without saving a meaningful message)
if [ -z "$EDITED_MSG" ]; then
    echo -e "${YELLOW}Commit aborted: empty commit message${NC}"
    rm -f "$TEMP_MSG"
    exit 1
fi

# Create a clean message file without comments for git commit
CLEAN_MSG=$(mktemp)
echo "$EDITED_MSG" > "$CLEAN_MSG"

# Commit with the cleaned message
git commit -F "$CLEAN_MSG"
rm -f "$TEMP_MSG" "$CLEAN_MSG"

echo -e "${GREEN}✓ Committed successfully${NC}"