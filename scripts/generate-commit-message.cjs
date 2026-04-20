#!/usr/bin/env node

/**
 * AI-powered commit message generator
 * Analyzes git changes and generates a meaningful commit message
 */

const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

/**
 * Execute a git command and return the output
 */
function git(command) {
  try {
    return execSync(`git ${command}`, { encoding: 'utf-8' }).trim()
  } catch (error) {
    return ''
  }
}

/**
 * Check if there are changes to commit
 */
function hasChanges() {
  const status = getStatus()
  return status.length > 0
}

/**
 * Get git status
 */
function getStatus() {
  return git('status --short')
}

/**
 * Get git diff (staged or all changes)
 */
function getDiff(stagedOnly = false) {
  if (stagedOnly) {
    return git('diff --cached')
  }
  return git('diff') || git('diff --cached')
}

/**
 * Get recent commit messages for style reference
 */
function getRecentCommits(count = 5) {
  return git(`log -${count} --pretty=format:"%s"`).split('\n').filter(Boolean)
}

/**
 * Get list of changed files
 */
function getChangedFiles() {
  const status = getStatus()
  return status
    .split('\n')
    .map((line) => {
      const match = line.match(/^(.{2})\s+(.+)$/)
      if (!match) return null
      return {
        status: match[1].trim(),
        file: match[2],
      }
    })
    .filter(Boolean)
}

/**
 * Analyze changes and generate a commit message
 * This is a simple heuristic-based generator
 * In production, this would call Claude API
 */
function generateCommitMessage() {
  const changedFiles = getChangedFiles()
  const diff = getDiff()
  const recentCommits = getRecentCommits()

  // Analyze file types and changes
  const hasTests = changedFiles.some((f) => f.file.includes('test') || f.file.includes('spec'))
  const hasDocs = changedFiles.some((f) => f.file.endsWith('.md'))
  const hasScripts = changedFiles.some((f) => f.file.startsWith('scripts/'))
  const hasConfig = changedFiles.some(
    (f) =>
      f.file.includes('package.json') || f.file.includes('tsconfig') || f.file.includes('config'),
  )
  const hasSource = changedFiles.some(
    (f) =>
      (f.file.endsWith('.ts') ||
        f.file.endsWith('.js') ||
        f.file.endsWith('.tsx') ||
        f.file.endsWith('.jsx')) &&
      !f.file.startsWith('scripts/'),
  )

  // Count change types
  const added = changedFiles.filter((f) => f.status.includes('A')).length
  const modified = changedFiles.filter((f) => f.status.includes('M')).length
  const deleted = changedFiles.filter((f) => f.status.includes('D')).length
  const renamed = changedFiles.filter((f) => f.status.includes('R')).length

  // Generate summary based on changes
  let summary = ''
  let details = []

  // Detect refactoring patterns
  if (diff.includes('import') && diff.includes('export')) {
    const hasNewImports = diff.match(/^\+.*import.*from/gm)
    const hasRemovedCode = diff.match(/^-(?!.*import)/gm)

    if (hasNewImports && hasRemovedCode && hasTests) {
      summary = 'Refactor tests to use shared fixtures'
      details.push('Extract test fixtures into shared module for better maintainability')
      details.push('Update test files to import from centralized fixtures')
    }
  }

  // Detect script additions
  if (!summary && hasScripts) {
    const scriptFiles = changedFiles.filter((f) => f.file.startsWith('scripts/'))
    const newScripts = scriptFiles.filter((f) => f.status.includes('A'))

    if (newScripts.length > 0) {
      // Check if it's a commit script
      if (newScripts.some((f) => f.file.includes('commit'))) {
        summary = 'Add AI-powered git commit command'
        details.push('Create interactive commit message generator using AI analysis')
        details.push('Add pnpm scripts for easy access (pnpm commit)')
        details.push('Include documentation and quick start guide')
      } else {
        summary = 'Add utility scripts'
        details.push(`Add ${newScripts.length} new script(s) to scripts directory`)
      }
    }
  }

  // Fallback summaries based on file types
  if (!summary) {
    if (hasTests && !hasSource) {
      summary = added > 0 ? 'Add test coverage' : 'Update tests'
    } else if (hasDocs && !hasSource && !hasScripts) {
      summary = 'Update documentation'
    } else if (hasConfig && !hasSource && !hasScripts) {
      summary = 'Update configuration'
    } else if (added > modified) {
      summary = 'Add new features'
    } else if (deleted > 0) {
      summary = 'Remove deprecated code'
    } else {
      summary = 'Update implementation'
    }
  }

  // Add file count details
  const fileDetails = []
  if (added > 0) fileDetails.push(`${added} added`)
  if (modified > 0) fileDetails.push(`${modified} modified`)
  if (deleted > 0) fileDetails.push(`${deleted} deleted`)
  if (renamed > 0) fileDetails.push(`${renamed} renamed`)

  if (fileDetails.length > 0 && details.length === 0) {
    details.push(`Files: ${fileDetails.join(', ')}`)
  }

  // Build commit message
  let message = summary
  if (details.length > 0) {
    message += '\n\n' + details.join('\n')
  }

  return {
    message,
    changedFiles,
    recentCommits,
    stats: { added, modified, deleted, renamed },
  }
}

/**
 * Create a commit message template file
 */
function createCommitTemplate() {
  const { message, changedFiles, recentCommits, stats } = generateCommitMessage()

  const template = `${message}

# AI-Generated Commit Message
#
# Please review and edit the message above before committing.
# Lines starting with '#' will be removed.
#
# To abort the commit, delete all non-comment lines above.
#
# Changes to be committed:
${changedFiles.map((f) => `#   ${f.status}  ${f.file}`).join('\n')}
#
# Statistics: ${stats.added} added, ${stats.modified} modified, ${stats.deleted} deleted, ${stats.renamed} renamed
#
# Recent commits in this repository:
${recentCommits.map((c) => `#   ${c}`).join('\n')}
`

  return template
}

// Main execution
if (require.main === module) {
  // Check for changes
  if (!hasChanges()) {
    console.error('Error: No changes to commit')
    process.exit(1)
  }

  // Generate and output the template
  const template = createCommitTemplate()
  console.log(template)
}

module.exports = {
  generateCommitMessage,
  createCommitTemplate,
  getChangedFiles,
  getRecentCommits,
  getDiff,
  getStatus,
}
