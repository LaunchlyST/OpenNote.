/**
 * Safe synchronisation between the AI tools working on OpenNote.
 *
 *   node scripts/sync.mjs status   one-line report of branch, dirt, drift
 *   node scripts/sync.mjs pull     fast-forward main from origin, or explain why not
 *   node scripts/sync.mjs push     run the tests, then commit and push
 *   node scripts/sync.mjs watch    poll in the background and fast-forward when safe
 *   node scripts/sync.mjs dev      reuse a running dev server, or start one
 *
 * Rules this script will not break, ever:
 *   - never force-push
 *   - never `reset --hard`, never `checkout .`, never stash someone's work
 *   - never touch uncommitted changes: if the tree is dirty, pull stops
 *   - never merge when the branch has diverged, only fast-forward
 *
 * Anything it refuses to do, it prints the reason for instead.
 */
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { appendFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const LOG_FILE = join(ROOT, 'sync.log')
const BRANCH = 'main'
const WATCH_INTERVAL_MS = 20_000

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
}

let quiet = false
function say(line = '') {
  if (!quiet) console.log(line)
}
function log(line) {
  appendFileSync(LOG_FILE, `${new Date().toISOString()} ${line}\n`)
}

/** Runs git and returns trimmed stdout. Never goes through a shell. */
function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      // Never block on a credential prompt from a background watcher.
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim()
  } catch (error) {
    if (allowFailure) return null
    throw new Error(`git ${args.join(' ')} failed: ${error.stderr || error.message}`)
  }
}

function currentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD'])
}

function dirtyFiles() {
  const out = git(['status', '--porcelain'])
  return out ? out.split('\n') : []
}

/** True while a merge, rebase or cherry-pick is part-way through. */
function operationInProgress() {
  return Boolean(git(['rev-parse', '-q', '--verify', 'MERGE_HEAD'], { allowFailure: true }))
}

function hasUnmergedPaths() {
  const out = git(['diff', '--name-only', '--diff-filter=U'], { allowFailure: true })
  return Boolean(out)
}

function syncState() {
  git(['fetch', '--prune', 'origin'], { allowFailure: true })
  const behind = Number(git(['rev-list', '--count', `HEAD..origin/${BRANCH}`], { allowFailure: true }) ?? 0)
  const ahead = Number(git(['rev-list', '--count', `origin/${BRANCH}..HEAD`], { allowFailure: true }) ?? 0)
  return { behind, ahead }
}

/* ------------------------------------------------------------------ */
/* status                                                              */
/* ------------------------------------------------------------------ */

function status() {
  const branch = currentBranch()
  const dirty = dirtyFiles()
  const { behind, ahead } = syncState()

  say(c.bold('OpenNote sync'))
  say(`  branch        ${branch}${branch === BRANCH ? '' : c.yellow('  (not main)')}`)
  say(`  working tree  ${dirty.length === 0 ? c.green('clean') : c.yellow(`${dirty.length} uncommitted change(s)`)}`)
  say(`  vs origin     ${behind === 0 && ahead === 0 ? c.green('in sync') : `${behind} behind, ${ahead} ahead`}`)

  if (dirty.length) {
    say('')
    for (const line of dirty.slice(0, 10)) say(c.dim(`    ${line}`))
    if (dirty.length > 10) say(c.dim(`    …and ${dirty.length - 10} more`))
  }
  return { branch, dirty, behind, ahead }
}

/* ------------------------------------------------------------------ */
/* pull                                                                */
/* ------------------------------------------------------------------ */

/**
 * Fast-forwards from origin. Refuses whenever doing so would touch uncommitted
 * work or when the branch has diverged - those need a human.
 *
 * @returns {'up-to-date'|'updated'|'blocked'}
 */
function pull({ silent = false } = {}) {
  const sayIt = silent ? () => {} : say

  if (operationInProgress()) {
    sayIt(c.red('Sync blocked: a merge, rebase or cherry-pick is in progress.'))
    sayIt(c.dim('  Finish or abort it first: git merge --abort  /  git rebase --abort'))
    return 'blocked'
  }
  if (hasUnmergedPaths()) {
    sayIt(c.red('Sync blocked: there are unresolved merge conflicts.'))
    sayIt(c.dim('  Resolve them and commit, then try again.'))
    return 'blocked'
  }

  const branch = currentBranch()
  if (branch !== BRANCH) {
    sayIt(c.yellow(`Sync skipped: on "${branch}", not "${BRANCH}".`))
    return 'blocked'
  }

  const dirty = dirtyFiles()
  if (dirty.length > 0) {
    sayIt(c.yellow(`Sync skipped: ${dirty.length} uncommitted change(s) in the working tree.`))
    sayIt(c.dim('  Those are left untouched. Commit them ("push it") or stash them yourself.'))
    for (const line of dirty.slice(0, 8)) sayIt(c.dim(`    ${line}`))
    if (dirty.length > 8) sayIt(c.dim(`    …and ${dirty.length - 8} more`))
    return 'blocked'
  }

  const { behind, ahead } = syncState()

  if (behind === 0) {
    sayIt(c.green('Already up to date with origin/main.'))
    return 'up-to-date'
  }
  if (ahead > 0) {
    sayIt(c.red(`Sync blocked: main has diverged — ${ahead} local commit(s), ${behind} remote.`))
    sayIt(c.dim('  Nothing was changed. Decide which side to keep, then merge or reset deliberately.'))
    return 'blocked'
  }

  const before = git(['rev-parse', '--short', 'HEAD'])
  const result = spawnSync('git', ['merge', '--ff-only', `origin/${BRANCH}`], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    sayIt(c.red('Fast-forward failed. Nothing was force-changed.'))
    return 'blocked'
  }

  const after = git(['rev-parse', '--short', 'HEAD'])
  sayIt(c.green(`Fast-forwarded ${before} → ${after} (${behind} new commit(s)).`))
  sayIt(c.dim('  If the dev server is running, Vite has already picked the change up.'))
  return 'updated'
}

/* ------------------------------------------------------------------ */
/* push                                                                */
/* ------------------------------------------------------------------ */

/**
 * Runs npm.
 *
 * On Windows npm is a .cmd shim, and since Node 18.20 / 20.12 spawning a .cmd
 * without a shell throws EINVAL (the CVE-2024-27980 fix). So a shell is
 * required there. Every argument below is a fixed literal — nothing the user
 * types is ever interpolated into a shell string — and commit messages go to
 * git through execFileSync, which never uses a shell.
 */
const NPM = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const NPM_OPTS = { shell: process.platform === 'win32' }

function runChecks() {
  const steps = [
    ['type-check + build', ['run', 'build']],
    ['app tests', ['test']],
    ['deployment tests', ['run', 'test:deploy']],
  ]

  for (const [label, args] of steps) {
    process.stdout.write(c.dim(`  ${label}… `))
    const result = spawnSync(NPM, args, { cwd: ROOT, encoding: 'utf8', ...NPM_OPTS })
    if (result.status !== 0) {
      process.stdout.write(c.red('failed\n'))
      if (result.error) say(c.red(`  ${result.error.message}`))
      say('')
      say(result.stdout ? result.stdout.split('\n').slice(-20).join('\n') : '')
      if (result.stderr) say(result.stderr.split('\n').slice(-10).join('\n'))
      say(c.red(`Not pushing: "${label}" did not pass.`))
      return false
    }
    process.stdout.write(c.green('ok\n'))
  }
  return true
}

function defaultMessage() {
  const files = dirtyFiles()
  const n = files.length
  const when = new Date().toISOString().replace('T', ' ').slice(0, 16)
  return `chore: sync ${n} change${n === 1 ? '' : 's'} from the editor (${when})`
}

function push(message) {
  say(c.bold('Pushing OpenNote'))

  if (operationInProgress()) {
    say(c.red('Push blocked: a merge, rebase or cherry-pick is in progress.'))
    return 1
  }
  if (currentBranch() !== BRANCH) {
    say(c.red(`Push blocked: on "${currentBranch()}", not "${BRANCH}".`))
    return 1
  }

  // Bring in anything remote before committing, so we never push from behind.
  const dirtyAtStart = dirtyFiles().length
  if (dirtyAtStart === 0) {
    if (pull() === 'blocked') return 1
    if (syncState().ahead === 0) {
      say(c.green('Nothing to push - working tree is clean and in sync with origin/main.'))
      return 0
    }
  }

  say(c.dim('  Running checks first…'))
  if (!runChecks()) return 1

  if (dirtyFiles().length > 0) {
    git(['add', '-A'])
    const msg = message || defaultMessage()
    git(['commit', '-m', msg])
    say(c.green(`  Committed: ${msg}`))
  } else {
    say(c.dim('  Nothing new to commit.'))
  }

  // The remote may have moved while the checks were running. Now that the
  // tree is clean, integrate it - but only by fast-forward. If both sides have
  // commits, that is a real divergence and needs a human decision.
  let state = syncState()
  if (state.behind > 0 && state.ahead > 0) {
    say(c.red(`Push blocked: main has diverged - ${state.ahead} local, ${state.behind} remote.`))
    say(c.dim('  Your commit is saved. Nothing was force-pushed.'))
    say(c.dim('  Resolve it deliberately, e.g.:  git pull --rebase origin main'))
    return 1
  }
  if (state.behind > 0) {
    say(c.dim(`  origin/main moved ${state.behind} commit(s) ahead; fast-forwarding first…`))
    const result = spawnSync('git', ['merge', '--ff-only', `origin/${BRANCH}`], {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: 'inherit',
    })
    if (result.status !== 0) {
      say(c.red('  Could not fast-forward. Nothing was force-changed.'))
      return 1
    }
    state = syncState()
  }

  if (state.ahead === 0) {
    say(c.green('Already in sync with origin/main.'))
    return 0
  }

  // Plain push only. A non-fast-forward is refused rather than forced.
  const result = spawnSync('git', ['push', 'origin', BRANCH], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'inherit',
  })
  if (result.status !== 0) {
    say(c.red('Push rejected by GitHub. Nothing was force-pushed.'))
    say(c.dim('  Someone else pushed first - run: npm run sync:pull'))
    return 1
  }

  const now = git(['rev-parse', '--short', 'HEAD'])
  say(c.green(`Pushed. origin/${BRANCH} is now ${now}.`))
  say(c.dim('  The other tool picks this up on its next session start or within ~20s of the watcher.'))
  return 0
}

/* ------------------------------------------------------------------ */
/* watch                                                               */
/* ------------------------------------------------------------------ */

function watch() {
  writeFileSync(LOG_FILE, '')
  log(`watcher started on ${BRANCH}`)
  say(c.bold(`Watching origin/${BRANCH} every ${WATCH_INTERVAL_MS / 1000}s.`))
  say(c.dim('  Fast-forwards only when the working tree is clean. Nothing else is ever touched.'))
  say(c.dim(`  Log: ${LOG_FILE}`))

  let last = git(['rev-parse', 'HEAD'])
  const tick = () => {
    const outcome = pull({ silent: true })
    if (outcome === 'updated') {
      const now = git(['rev-parse', 'HEAD'])
      const who = git(['log', '-1', '--pretty=%an: %s'])
      log(`updated ${now.slice(0, 7)} ${who}`)
      say(`${c.green('updated')} ${now.slice(0, 7)}  ${who}`)
      last = now
    } else if (outcome === 'blocked') {
      log('blocked')
    }
  }

  // Settle immediately rather than waiting a full interval on start.
  setTimeout(tick, 2000)
  setInterval(tick, WATCH_INTERVAL_MS)

  process.on('SIGINT', () => {
    log('watcher stopped')
    process.exit(0)
  })
}

/* ------------------------------------------------------------------ */
/* dev                                                                 */
/* ------------------------------------------------------------------ */

/**
 * Vite is already strictPort, so a second `npm run dev` just fails with a
 * confusing "port in use". Reuse the running server instead.
 */
async function dev() {
  const port = 5173
  try {
    const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2500) })
    if (res.ok) {
      say(c.green(`Dev server already running at http://localhost:${port}`))
      say(c.dim('  Reusing it. Stop it first if you meant to restart.'))
      return 0
    }
  } catch {
    /* nothing listening - fall through and start one */
  }

  say(c.dim(`Starting the dev server at http://localhost:${port} …`))
  const child = spawn(NPM, ['run', 'dev'], { cwd: ROOT, stdio: 'inherit', ...NPM_OPTS })
  child.on('exit', (code) => process.exit(code ?? 0))
  return new Promise(() => {})
}

/* ------------------------------------------------------------------ */

const [command = 'status', ...rest] = process.argv.slice(2)
quiet = rest.includes('--quiet')
const message = rest.find((a) => !a.startsWith('--'))

/** Long-running commands hold the process open; one-shot commands exit. */
let keepAlive = false

let code = 0
try {
  switch (command) {
    case 'status': status(); break
    case 'pull': code = pull() === 'blocked' ? 1 : 0; break
    case 'push': code = push(message); break
    case 'watch': watch(); keepAlive = true; break
    case 'dev': code = await dev(); keepAlive = true; break
    default:
      say(c.red(`Unknown command "${command}".`))
      say(c.dim('  Try: status | pull | push | watch | dev'))
      code = 1
  }
} catch (error) {
  say(c.red(error instanceof Error ? error.message : String(error)))
  code = 1
}

// `watch` and `dev` keep running until interrupted. Calling process.exit()
// here would kill the watcher the instant its timers were armed.
if (!keepAlive) process.exit(code)