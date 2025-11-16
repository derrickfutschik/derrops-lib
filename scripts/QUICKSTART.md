# AI Commit - Quick Start

Get started with AI-powered git commits in seconds!

## Installation

Already included! The AI commit script is part of the SLAOps platform monorepo.

## Usage

```bash
# Simple - just run this command
pnpm commit
```

## What Happens?

1. **Detects your changes** - Finds modified, added, or deleted files
2. **Stages files** - Asks if you want to stage unstaged changes
3. **Generates message** - Creates a smart commit message based on your diff
4. **Opens editor** - Review and edit the message
5. **Confirms** - Shows final message and asks for confirmation
6. **Commits** - Creates the git commit

## Example Session

```
$ pnpm commit

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🤖 AI Commit Message Generator
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No files are staged. Would you like to stage all changes? (y/n)
> y

Staging all changes...
Analyzing changes and generating commit message...

Generated commit message preview:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Refactor tests to use shared fixtures

Extract test fixtures into shared module for better maintainability
Update test files to import from centralized fixtures
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Opening editor for review and editing...

[Editor opens - you review and edit the message]

Final commit message:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Refactor tests to use shared fixtures

Extract test fixtures into shared module for better maintainability
Update test files to import from centralized fixtures
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Proceed with commit? (y/n)
> y

✓ Commit successful!

abc1234 Refactor tests to use shared fixtures
```

## Tips

### Set Your Preferred Editor

```bash
# VS Code
git config --global core.editor "code --wait"

# Nano
export EDITOR="nano"

# Vim (default)
export EDITOR="vim"
```

### Abort at Any Point

- When asked to stage: press 'n'
- In editor: delete all text and save
- At confirmation: press 'n'

### Use Regular git commit

You can still use `git commit` as normal - the AI commit is just an optional helper!

```bash
git commit -m "Regular commit"  # Still works!
pnpm commit                      # Or use AI helper
```

## What Makes a Good Commit Message?

The AI tries to generate messages that:

- Start with a verb (Add, Update, Fix, Refactor, Remove)
- Are concise but descriptive
- Focus on WHY, not just WHAT
- Follow your project's style

But **you're in control** - always review and edit the generated message!

## Next Steps

- Read [README.md](README.md) for detailed documentation
- Customize [generate-commit-message.cjs](generate-commit-message.cjs) to fit your style
- Share feedback on what works and what doesn't

Happy committing! 🎉
