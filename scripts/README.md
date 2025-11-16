# Scripts

Utility scripts for the SLAOps platform monorepo.

## AI Commit (`ai-commit.sh`)

An AI-powered git commit helper that generates meaningful commit messages based on your changes.

### Features

- Analyzes git diff and changed files
- Generates contextual commit messages using Claude AI
- Optional user context to guide message generation
- References recent commit style for consistency
- Interactive editor for message review and editing
- Confirms before committing
- Supports both staged and unstaged changes
- Color-coded terminal output for better readability

### Usage

```bash
# Using pnpm/npm script (recommended)
pnpm commit
# or
pnpm commit:ai

# Direct execution
./scripts/ai-commit.sh

# With optional context about your changes
./scripts/ai-commit.sh "Fixed debug configuration so that now debug is working"

# Or with pnpm (note: you need to use -- to pass arguments)
pnpm commit -- "Added new authentication flow"
```

### Workflow

1. **Change Detection**: The script checks for staged or unstaged changes
2. **Staging Prompt**: If no files are staged, asks if you want to stage all changes
3. **Context Integration**: If you provided an optional context message, it will be shown and included in the prompt
4. **Message Generation**: Analyzes changes and generates a commit message using Claude AI
5. **Preview**: Shows a preview of the generated message
6. **Editor**: Opens your default editor to review and edit the message
7. **Commit**: Creates the commit with the final message

### Optional Context

You can provide an optional context message to help Claude generate a more accurate commit message:

```bash
./scripts/ai-commit.sh "Fixed the authentication bug where tokens were expiring too early"
```

This context will be:
- Displayed before generating the message
- Included in the prompt sent to Claude
- Used to create a more targeted commit message

The context is most helpful when:
- The changes involve complex logic that isn't obvious from the diff
- You want to emphasize the purpose or motivation behind the changes
- The diff is large and you want to highlight the main focus

### Editor Configuration

The script uses your git editor preference in this order:
1. `vim` (if available)
2. `git config core.editor`
3. `EDITOR` environment variable
4. Falls back to `vi`

To change your editor:

```bash
# Set globally for git
git config --global core.editor "code --wait"

# Or set environment variable
export EDITOR="nano"
```

### Message Format

Generated messages follow best practices:
- Concise summary line (50-72 characters)
- Optional detailed description
- Focus on WHY, not just WHAT changed
- Follows your project's commit style

### Aborting a Commit

You can abort at several points:
- When asked to stage files: answer 'n'
- In the editor: delete all non-comment lines and save
- At confirmation prompt: answer 'n'

### Examples

#### Simple refactoring:
```
Refactor tests to use shared fixtures

Extract test fixtures into shared module for better maintainability
Update test files to import from centralized fixtures
```

#### Adding features:
```
Add user authentication endpoints

Implement JWT-based authentication
Add login, logout, and token refresh endpoints
Include rate limiting and security headers
```

#### Documentation updates:
```
Update documentation

Add examples for new API endpoints
Fix typos in getting started guide
```

### Behind the Scenes

The script uses Claude AI to analyze your git diff and generate meaningful commit messages.

The script:
- Captures the git diff of staged changes
- Sends the diff to Claude along with formatting guidelines and optional user context
- Receives a generated commit message
- Opens your editor for review and editing
- Commits with the final message

### Requirements

- Git repository
- Claude Code CLI installed and available in PATH
- Bash shell

### Troubleshooting

**Script says "No changes to commit"**
- Make sure you have modified, added, or deleted files
- Check `git status` to see your changes

**Editor doesn't open**
- Set your `GIT_EDITOR` or `EDITOR` environment variable
- Ensure the editor command is in your PATH

**Commit fails**
- Check if git hooks are preventing the commit
- Ensure you have permission to commit to the repository
- Verify your git configuration is set up correctly

**Generated message isn't accurate**
- Provide optional context when running the script to guide the generation
- Edit the message in the editor to better describe your changes
- The AI is a starting point - human review is important

**Claude not found**
- Make sure Claude Code CLI is installed: see [Claude Code documentation](https://docs.claude.com/claude-code)
- Verify `claude` is in your PATH: `which claude`
