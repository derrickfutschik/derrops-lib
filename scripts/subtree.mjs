#!/usr/bin/env node
import { execSync } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dir = dirname(fileURLToPath(import.meta.url))
const CONFIG = join(__dir, 'subtrees.json')

const registry = JSON.parse(readFileSync(CONFIG, 'utf8'))
const validRepos = Object.keys(registry)
const COMMANDS = ['pull', 'push', 'add', 'create', 'list', 'tag']

function usage() {
  console.error('\nUsage: node scripts/subtree.mjs <command> [args]\n')
  console.error(`  Commands: ${COMMANDS.join(', ')}`)
  console.error(`  Repos:    ${validRepos.join(', ') || '(none registered yet)'}`)
  console.error('\n  Examples:')
  console.error('    pnpm subtree:list')
  console.error('    pnpm subtree:pull derrops-portal')
  console.error('    pnpm subtree:push derrops-portal')
  console.error('    pnpm subtree:add  derrops-lib      # first-time setup')
  console.error(
    '    pnpm subtree:create derrops-hooks packages/derrops-hooks git@github.com:derrickfutschik/derrops-hooks.git',
  )
  console.error('    pnpm subtree:tag   derrops-lib 1.0.1\n')
  process.exit(1)
}

function run(cmd) {
  console.log(`  $ ${cmd}`)
  execSync(cmd, { stdio: 'inherit' })
}

const [, , command, ...rest] = process.argv

if (!command) {
  console.error('Error: command is required')
  usage()
}
if (!COMMANDS.includes(command)) {
  console.error(`Error: Unknown command '${command}'  (valid: ${COMMANDS.join(', ')})`)
  usage()
}

// ── list ──────────────────────────────────────────────────────────────────────
if (command === 'list') {
  console.log('\nRegistered subtrees:\n')
  for (const [name, cfg] of Object.entries(registry)) {
    console.log(`  ${name.padEnd(22)} ${cfg.prefix.padEnd(30)} ${cfg.remote}`)
  }
  console.log()
  process.exit(0)
}

// ── create ────────────────────────────────────────────────────────────────────
if (command === 'create') {
  const [repoName, prefix, remote] = rest
  if (!repoName || !prefix || !remote) {
    console.error('Error: create requires <repo-name> <prefix> <remote-url>')
    console.error(
      '  Example: pnpm subtree:create derrops-hooks packages/derrops-hooks git@github.com:derrickfutschik/derrops-hooks.git',
    )
    process.exit(1)
  }
  if (registry[repoName]) {
    console.error(`Error: '${repoName}' is already registered in scripts/subtrees.json`)
    process.exit(1)
  }
  registry[repoName] = { prefix, remote, branch: 'main' }
  writeFileSync(CONFIG, JSON.stringify(registry, null, 2) + '\n')
  console.log(`\n✓ Registered '${repoName}' in scripts/subtrees.json`)
  console.log(`  prefix: ${prefix}`)
  console.log(`  remote: ${remote}`)
  console.log(`\n  Next steps:`)
  console.log(`    1. Create the GitHub repo if it doesn't exist yet`)
  console.log(`       gh repo create derrickfutschik/${repoName} --public`)
  console.log(`    2. Commit the registry update`)
  console.log(
    `       git add scripts/subtrees.json && git commit -m "chore(subtree): register ${repoName}"`,
  )
  console.log(`    3. Add the subtree to the monorepo`)
  console.log(`       pnpm subtree:add ${repoName}\n`)
  process.exit(0)
}

// ── pull / push / add (repo required) ─────────────────────────────────────────
const [repo] = rest
if (!repo) {
  console.error('Error: repo is required')
  usage()
}
if (!registry[repo]) {
  console.error(`Error: Unknown repo '${repo}'  (valid: ${validRepos.join(', ')})`)
  process.exit(1)
}

const { prefix, remote, branch } = registry[repo]

switch (command) {
  case 'pull':
    console.log(`↓  Pulling ${repo} (${prefix}) from ${remote} [${branch}]...`)
    run(`git subtree pull --prefix=${prefix} ${remote} ${branch} --squash`)
    break

  case 'push': {
    console.log(`↑  Pushing ${repo} (${prefix}) to ${remote} [${branch}]...`)
    const sha = execSync(`git subtree split --prefix=${prefix} HEAD`, { encoding: 'utf8' }).trim()
    run(`git push ${remote} ${sha}:${branch}`)
    break
  }

  case 'add':
    console.log(`+  Adding subtree ${repo} at ${prefix} from ${remote} [${branch}]...`)
    try {
      execSync(`git remote add ${repo} ${remote}`, { stdio: 'inherit' })
    } catch {
      console.log(`   Remote '${repo}' already exists — skipping.`)
    }
    run(`git subtree add --prefix=${prefix} ${remote} ${branch} --squash`)
    break

  case 'tag': {
    const version = rest[1]
    if (!version) {
      console.error('Error: tag requires <repo> <version>')
      console.error('  Example: pnpm subtree:tag derrops-lib 1.0.1')
      process.exit(1)
    }
    const v = version.startsWith('v') ? version.slice(1) : version
    const monoTag = `${repo}@${v}`
    const subTag = `v${v}`

    console.log(`\n⬡  Tagging ${repo} @ ${v}`)

    // Tag monorepo — triggers GitHub Actions publish workflow
    run(`git tag ${monoTag}`)
    run(`git push origin ${monoTag}`)

    // Tag standalone subtree remote
    console.log(`   Splitting subtree prefix ${prefix}...`)
    const sha = execSync(`git subtree split --prefix=${prefix} HEAD`, { encoding: 'utf8' }).trim()
    run(`git push ${remote} ${sha}:refs/tags/${subTag}`)

    console.log(`\n✓  Tagged ${monoTag} on monorepo and ${subTag} on ${remote}\n`)
    break
  }
}
