# Scripts

Utility scripts for the SLAOps platform monorepo.

## Test Notifications (`test-notify.sh`)

Run tests with desktop notifications when the test suite completes.

### Features

- Runs the full test suite via Turborepo
- Captures test results and timing information
- Parses test output to extract pass/fail counts
- Displays a color-coded summary in the terminal
- Sends desktop notifications (macOS/Linux) with:
  - ✅ Success notification with "Glass" sound for passing tests
  - ❌ Failure notification with "Basso" sound for failing tests
  - Test counts and duration

### Usage

```bash
# Using pnpm/npm script (recommended)
pnpm run test:notify

# Run tests for a specific package with notifications
pnpm run test:notify --filter @slaops/private
pnpm run test:notify --filter @slaops/public

# Direct execution
./scripts/test-notify.sh
```

### Terminal Output

When tests complete, you'll see a formatted summary:

**Passing tests:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TEST SUITE PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Passed: 56
  Total:  56
  Duration: 3s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Failing tests:**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ TEST SUITE FAILED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Failed: 2
  Passed: 54
  Total:  56
  Duration: 3s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Desktop Notifications

The script automatically sends desktop notifications:

- **macOS**: Uses built-in `osascript` with system sounds
- **Linux**: Uses `notify-send` if available
- **Fallback**: Gracefully continues without notifications if not available

### Platform Support

- ✅ macOS (native support via osascript)
- ✅ Linux (requires notify-send)
- ✅ Terminal-only mode (if notifications unavailable)

## Test Watch with Notifications (`test-watch-notify.sh`)

Run tests in watch mode with desktop notifications after each test run.

### Features

- Runs tests in continuous watch mode via Turborepo
- Automatically detects when tests complete
- Sends notifications after each test run
- Color-coded terminal summaries
- Watches for file changes and re-runs tests
- Press Ctrl+C to exit

### Usage

```bash
# Using pnpm/npm script (recommended)
pnpm run test:watch:notify

# Watch tests for a specific package with notifications
pnpm run test:watch:notify --filter @slaops/private

# Direct execution
./scripts/test-watch-notify.sh
```

### Workflow

1. Starts tests in watch mode
2. Displays initial test run results with notification
3. Watches for file changes
4. Automatically re-runs tests when files change
5. Sends a notification after each test run
6. Press Ctrl+C to exit watch mode

### Terminal Output

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 Starting test watch mode with notifications
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Notifications will appear after each test run
Press Ctrl+C to exit watch mode

[test output...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ TEST RUN PASSED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Passed: 56
  Total:  56
  Duration: 2s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Watching for changes...
```

### Use Cases

- **Development workflow**: Get notified when tests pass/fail while working on code
- **Background testing**: Keep tests running in a terminal while focusing on your editor
- **Quick feedback**: Know immediately when your changes break or fix tests

### Requirements

- Bash shell
- Turborepo (already included in monorepo)
- Desktop notification system:
  - macOS: Built-in (osascript)
  - Linux: notify-send (usually pre-installed)

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

# With optional inline context about your changes
./scripts/ai-commit.sh "Fixed debug configuration so that now debug is working"

# Or with pnpm (note: you need to use -- to pass arguments)
pnpm commit -- "Added new authentication flow"

# Open editor to write context (useful for longer, multi-line context)
./scripts/ai-commit.sh --context
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

You can provide an optional context message to help Claude generate a more accurate commit message in two ways:

**1. Inline context (for short messages):**

```bash
./scripts/ai-commit.sh "Fixed the authentication bug where tokens were expiring too early"
```

**2. Editor context (for longer, detailed context):**

```bash
./scripts/ai-commit.sh --context
# This opens your editor where you can write a multi-line context
# Lines starting with '#' are ignored
# Save the file to continue, or leave it empty to cancel
```

This context will be:

- Displayed before generating the message
- Included in the prompt sent to Claude
- Used to create a more targeted commit message

The context is most helpful when:

- The changes involve complex logic that isn't obvious from the diff
- You want to emphasize the purpose or motivation behind the changes
- The diff is large and you want to highlight the main focus
- You need to provide detailed background information (use `--context` flag for multi-line input)

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
- When using `--context`: leave the context file empty (or delete all content) and save
- In the commit message editor: delete all non-comment lines and save
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
