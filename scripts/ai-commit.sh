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

# Create a temporary file for the prompt
TEMP_PROMPT=$(mktemp)
TEMP_RESPONSE=$(mktemp)

# Write the prompt to the temporary file
cat > "$TEMP_PROMPT" << 'EOF'
You are helping me write git commit messages for this repository. Please follow these guidelines:

**Format:**
- Use conventional commit format: `type(scope): description`
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
- Be descriptive but concise - aim for the "sweet spot" between too vague and overly detailed
- Use imperative mood ("add feature" not "added feature")
- Don't end the subject line with a period

**Examples:**
- `✨ feat(auth): add OAuth2 login flow`
- `🐛 fix(api): handle null response in user endpoint`
- `📝 docs: update installation instructions for Docker setup`
- `♻️ refactor(database): simplify query builder logic`
- `⚡ perf(search): add caching layer for frequent queries`

---

Based on the following git diff of staged changes, generate an appropriate commit message following the guidelines above. 

**IMPORTANT:** 
- Output ONLY the commit message itself
- Do NOT include any explanations, meta-commentary, or markdown formatting
- Do NOT wrap the message in code blocks or quotes
- Just output the raw commit message text

Here is the diff:

EOF

# Append the diff to the prompt
echo "$DIFF" >> "$TEMP_PROMPT"

# Call claude with the prompt
echo -e "${BLUE}Generating commit message with Claude...${NC}"
claude --prompt-file "$TEMP_PROMPT" > "$TEMP_RESPONSE" 2>&1 || {
    echo -e "${RED}Error: Failed to generate commit message${NC}"
    rm -f "$TEMP_PROMPT" "$TEMP_RESPONSE"
    exit 1
}

# Extract the commit message (remove any potential markdown formatting)
COMMIT_MSG=$(cat "$TEMP_RESPONSE" | sed 's/^```.*$//' | sed '/^$/d' | grep -v '^#' | head -20)

# Clean up temp files
rm -f "$TEMP_PROMPT" "$TEMP_RESPONSE"

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

# Ask user for confirmation
read -p "$(echo -e ${YELLOW}Do you want to [e]dit, [c]ommit as-is, or [a]bort? ${NC})" -n 1 -r
echo ""

case $REPLY in
    e|E)
        # Create a temporary file with the message
        TEMP_MSG=$(mktemp)
        echo "$COMMIT_MSG" > "$TEMP_MSG"
        
        # Open in user's editor
        ${EDITOR:-nano} "$TEMP_MSG"
        
        # Commit with the edited message
        git commit -F "$TEMP_MSG"
        rm -f "$TEMP_MSG"
        
        echo -e "${GREEN}✓ Committed with edited message${NC}"
        ;;
    c|C)
        # Commit with the generated message
        echo "$COMMIT_MSG" | git commit -F -
        echo -e "${GREEN}✓ Committed successfully${NC}"
        ;;
    *)
        echo -e "${YELLOW}Commit aborted${NC}"
        exit 0
        ;;
esac