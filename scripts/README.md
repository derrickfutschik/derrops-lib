# Scripts

Utility scripts for the SLAOps platform monorepo.

## AI Commit (`ai-commit.sh`)

An AI-powered git commit helper that generates meaningful commit messages based on your changes.

### Features

- Analyzes git diff and changed files
- Generates contextual commit messages using heuristics
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
```

### Workflow

1. **Change Detection**: The script checks for staged or unstaged changes
2. **Staging Prompt**: If no files are staged, asks if you want to stage all changes
3. **Message Generation**: Analyzes changes and generates a commit message
4. **Preview**: Shows a preview of the generated message
5. **Editor**: Opens your default editor to review and edit the message
6. **Confirmation**: Shows the final message and asks for confirmation
7. **Commit**: Creates the commit using `git commit -F -`

### Editor Configuration

The script uses your git editor preference in this order:
1. `GIT_EDITOR` environment variable
2. `VISUAL` environment variable
3. `EDITOR` environment variable
4. Falls back to `vi`

To change your editor:

```bash
# Set globally for git
git config --global core.editor "code --wait"

# Or set environment variable
export GIT_EDITOR="nano"
export VISUAL="code --wait"
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

The script uses two components:

1. **[ai-commit.sh](ai-commit.sh)**: Main shell script that handles the workflow
2. **[generate-commit-message.cjs](generate-commit-message.cjs)**: Node.js module that analyzes changes

The Node.js module examines:
- Changed file types (tests, docs, config, source)
- Types of changes (added, modified, deleted, renamed)
- Code patterns in the diff
- Recent commit messages for style consistency

### Requirements

- Git repository
- Node.js >= 22.0.0 (for the message generator)
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
- Edit the message in the editor to better describe your changes
- The AI is a starting point - human review is important

### Contributing

To improve the message generation:
1. Edit [generate-commit-message.cjs](generate-commit-message.cjs)
2. Add new heuristics or patterns
3. Test with various types of changes
4. Submit a PR with examples

### Future Enhancements

Potential improvements:
- Integration with Claude API for more intelligent message generation
- Conventional commit format support
- Custom templates per repository
- Issue/ticket number extraction
- Co-author support
- Multi-language commit message support
