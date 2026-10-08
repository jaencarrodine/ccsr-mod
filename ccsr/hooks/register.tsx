import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, ModelCompleteResult, RenderElement, RenderInput, Register } from 'claude-code'

import type { ApiAccount, ApiChatItem, ApiInstall, ApiLobbyItem, ApiMatchSummary, ApiPlayer, ApiQueueState, ApiRankedRow, ApiRecentMatch, ApiRoom, ApiScoreReply, ApiSeason, BacktestRun, RankedMatch, RankedShared, ChatLine, FeedItem, LinkState, Match, ModSettings, OutboxItem, PastSession, Record3, ScanStatus, SavedAccount, ScoredCommit, ServerConfig, Keyring, Surfaces, Tab, WeekTotals } from '../types'
import { DEFAULT_SERVER, backoffMs, errorOf, handleProblem, mergeEvents, retryable, scoreBody } from './api'
import { UPDATE_ARGV, UPDATE_COMMAND, VERSION, standing } from './version'
import {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  JUDGE_SYSTEM,
  PR_SUFFIX,
  RUBRIC,
  START_RATING,
  STORE_VERSION,
  botPlan,
  clean,
  digestText,
  elo,
  hash,
  idKey,
  isNoise,
  isStashTitle,
  myPace,
  oppAt,
  parseVerdict,
  periodStart,
  recentOnSameFiles,
  rng,
  rollCutoff,
  rollUp,
  stepCraft,
  tierOf,
  totals,
} from './pure'
import type { RecentCommit } from './pure'
import { sessionBars } from './svg'
import { banner, bandStrip, chatLog, chatRooms, commitBadge, commitList, feed as feedSvg, grind, ladder, numberOne, queue as queueSvg, queueBar, raceClimb, ratingCard, readyCheck, recentMatches, result, scorecard, setupHero, tabsBase, tabsTop, tierFrieze } from './olympia'
import type { Race, TierKey } from './olympia'
import { ACCOUNT, FULL, LINES, MOD, QUIET, ROASTS, SURFACE_ROWS, SURFACE_WHAT, presetOf, resultText, surfacesFrom } from './copy'
import type { SurfaceKey } from './copy'

// Every function that is handed $ lives in this file: the engine follows $
// into same-file, top-level functions only, and state reads and writes must
// name an atom defined here. Pure helpers live in pure.ts, svg.ts and olympia.ts.

type $ = EngineInterface

// ================================================================== STATE

const SCAN0: ScanStatus = { busy: false, lastAt: 0, note: '', problems: [] }

const tab = atom({ plugin: 'ccsr', key: 'tab' } as const, 'match')
const period = atom({ plugin: 'ccsr', key: 'period' } as const, 'week')
const ledger = atom({ plugin: 'ccsr', key: 'ledger' } as const, [], { shape: 'ledger-2' })
const weekTotals = atom({ plugin: 'ccsr', key: 'weekTotals' } as const, {})
const settings = atom({ plugin: 'ccsr', key: 'settings' } as const, { handle: 'jaen', tracking: true, share: false, model: DEFAULT_MODEL, surfaces: FULL }, { shape: 'settings-2' })
const scan = atom({ plugin: 'ccsr', key: 'scan' } as const, SCAN0, { shape: 'scan-2' })
const sessions = atom({ plugin: 'ccsr', key: 'sessions' } as const, [], { shape: 'sessions-2' })
const sessionsNote = atom({ plugin: 'ccsr', key: 'sessionsNote' } as const, '')
const backtests = atom({ plugin: 'ccsr', key: 'backtests' } as const, {}, { shape: 'backtests-2' })
const match = atom({ plugin: 'ccsr', key: 'match' } as const, null, { shape: 'match-2' })
const history = atom({ plugin: 'ccsr', key: 'history' } as const, [], { shape: 'history-2' })
const now = atom({ plugin: 'ccsr', key: 'now' } as const, 0)
const rating = atom({ plugin: 'ccsr', key: 'rating' } as const, START_RATING)
const record = atom({ plugin: 'ccsr', key: 'record' } as const, { w: 0, l: 0, d: 0 })
const trackingSince = atom({ plugin: 'ccsr', key: 'trackingSince' } as const, 0)
const expanded = atom({ plugin: 'ccsr', key: 'expanded' } as const, null)
const btLimit = atom({ plugin: 'ccsr', key: 'btLimit' } as const, 15)
const labNote = atom({ plugin: 'ccsr', key: 'labNote' } as const, '')
const chatDraft = atom({ plugin: 'ccsr', key: 'chatDraft' } as const, '')
const LINK0: LinkState = { online: null, note: '', me: null, season: null, grind: null, grindRank: null, outbox: 0, queue: null, ranked: null, ladder: null, myRank: null, grindOf: null, rooms: null, room: 'world', lobby: null, recent: null, release: null, updateNote: '', account: null, installs: null, linkCode: null, unknownToken: false, recoveryFresh: false, confirmRemove: false }
const link = atom({ plugin: 'ccsr', key: 'link' } as const, LINK0)
const badges = atom({ plugin: 'ccsr', key: 'badges' } as const, {})
const turnMarks = atom({ plugin: 'ccsr', key: 'turnMarks' } as const, {})
const dirty = atom({ plugin: 'ccsr', key: 'dirty' } as const, null)
const forfeitAsk = atom({ plugin: 'ccsr', key: 'forfeitAsk' } as const, false)
/** Which way in the first-run card shows: a new handle, a link code, or a recovery key. */
const joinMode = atom({ plugin: 'ccsr', key: 'joinMode' } as const, 'new' as 'new' | 'link' | 'recover')

// ================================================================== STORE

// $.store is one JSON file shared by every session on this machine (4 MiB in
// all). Anything another session may also write is re-read right before a
// write, never written back from this session's $.state copy.
const K = {
  version: 'version',
  settings: 'settings',
  ledger: 'ledger',
  weeks: 'weeks',
  cache: 'cache',
  repos: 'repos',
  since: 'trackingSince',
  rating: 'rating',
  record: 'record',
  history: 'history',
  match: 'match',
  claims: 'claims',
  squash: 'squash',
  failures: 'failures',
  band: 'band',
  rubric: 'rubric',
  rebuild: 'rebuild',
  // The CCSR server: where it is and this player's token; scores waiting to send; pids it already has; the salt for repo hashes.
  server: 'server',
  outbox: 'outbox',
  sent: 'sent',
  salt: 'salt',
  // Set when the player removed this install, so the keyring doesn't sign it straight back in.
  optOut: 'optOut',
  // Ranked: idle, queued, offered, live or done, and which match; every session follows it.
  ranked: 'ranked',
  // The newest release the update toast has shown, so it shows once per release.
  updateSeen: 'updateSeen',
} as const

type Verdict = Pick<ScoredCommit, 'points' | 'base' | 'craft' | 'category' | 'reason' | 'judge' | 'asked' | 'rubric' | 'scoredAt'>

const SETTINGS0: ModSettings = { handle: 'jaen', tracking: true, share: false, model: DEFAULT_MODEL, surfaces: FULL }

/** Settings as stored, with every field present. Stores from before the 12 switches held four booleans and a Quiet flag; surfacesFrom carries them over. */
function withDefaults(s: Partial<ModSettings>): ModSettings {
  const { quiet, ...rest } = s
  return { ...SETTINGS0, ...rest, surfaces: surfacesFrom(s.surfaces, !!quiet) }
}

// Module variables reset on every hot reload, which is what a lock wants.
let owner = 'unknown'
let loadedAt = 0
let storeProblem = ''
let scanning: Promise<ScanResult> | null = null
let rescan: { force: boolean } | null = null
let belling: Promise<Match | null> | null = null
let stopTicker: (() => void) | null = null
let scanSoon: { cancel: () => void } | null = null
let lastOppToast = 0
let turnPoints = 0
const lastFingerprint = new Map<string, string>()
const lastFullList = new Map<string, number>()
const skipShas = new Set<string>()

async function storeGet<T>($: $, key: string, fallback: T): Promise<T> {
  const v = (await $.store.get(key)) as T | undefined
  return v === undefined || v === null ? fallback : v
}

/** One place for writes, so a full store says so once instead of failing every commit. */
async function save($: $, key: string, value: unknown) {
  try {
    await $.store.set(key, value)
    storeProblem = ''
    return true
  } catch (err) {
    const msg = `CCSR store write failed (${key}): ${(err as Error).message}`
    if (storeProblem !== msg) $.ui.toast(msg, { timeoutMs: 8000 })
    storeProblem = msg
    return false
  }
}

/**
 * Store v2: commit identity, rubric r2 and the Sonnet judge change what a
 * point is, so v1 scores are dropped and the ledger rebuilds from git on the
 * next scan. Tracking start, repos, settings, rating and history are kept.
 */
async function migrate($: $) {
  const v = await storeGet($, K.version, 1)
  if (v >= STORE_VERSION) {
    // A new rubric changes what a point is: rescore the Grind from git under it.
    // Squash decisions, matches, rating and history are kept.
    const rubric = await storeGet($, K.rubric, '')
    if (rubric === RUBRIC) return false
    // Squash decisions are re-made too, so each records the branch commits it stands for.
    for (const key of [K.ledger, K.cache, K.failures, K.weeks, K.squash]) await $.store.delete(key)
    await save($, K.rubric, RUBRIC)
    await save($, K.rebuild, true)
    return true
  }
  const repos = await storeGet<string[]>($, K.repos, [])
  const roots: string[] = []
  for (const r of repos) {
    const root = await repoRoot($, r)
    if (root && !roots.includes(root)) roots.push(root)
  }
  await save($, K.repos, roots)
  for (const key of [K.ledger, K.cache, K.claims, K.squash, K.failures, K.weeks, K.match]) await $.store.delete(key)
  await save($, K.version, STORE_VERSION)
  await save($, K.rubric, RUBRIC)
  await save($, K.rebuild, true)
  return true
}

async function loadAll($: $) {
  const migrated = await migrate($)
  const s = await storeGet<Partial<ModSettings>>($, K.settings, {})
  await update($, settings, () => withDefaults(s))
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  await update($, ledger, () => rows)
  const weeks = await storeGet<WeekTotals>($, K.weeks, {})
  await update($, weekTotals, () => weeks)
  const r = await storeGet($, K.rating, START_RATING)
  await update($, rating, () => r)
  const rec = await storeGet<Record3>($, K.record, { w: 0, l: 0, d: 0 })
  await update($, record, () => rec)
  const hist = await storeGet<Match[]>($, K.history, [])
  await update($, history, () => hist)
  const m = await storeGet<Match | null>($, K.match, null)
  await update($, match, () => (m && Array.isArray(m.plan) && m.lease ? m : null))
  let since = (await $.store.get(K.since)) as number | undefined
  if (since === undefined) {
    since = await $.clock.now()
    await save($, K.since, since)
  }
  await update($, trackingSince, () => since as number)
  return migrated
}

/** Every session's copy of the shared values, refreshed from the store. */
async function syncFromStore($: $) {
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  await update($, ledger, () => rows)
  const weeks = await storeGet<WeekTotals>($, K.weeks, {})
  await update($, weekTotals, () => weeks)
  const r = await storeGet($, K.rating, START_RATING)
  await update($, rating, () => r)
  const rec = await storeGet<Record3>($, K.record, { w: 0, l: 0, d: 0 })
  await update($, record, () => rec)
  const hist = await storeGet<Match[]>($, K.history, [])
  await update($, history, () => hist)
  const since = await storeGet($, K.since, 0)
  if (since) await update($, trackingSince, () => since)
  const s = await storeGet<Partial<ModSettings>>($, K.settings, {})
  await update($, settings, () => withDefaults(s))
  const m = await storeGet<Match | null>($, K.match, null)
  await update($, match, () => (m && Array.isArray(m.plan) && m.lease ? m : null))
}

/** Settings take a patch, merged into what the store holds now. Display settings stay on this machine. */
type SettingsPatch = Partial<Omit<ModSettings, 'surfaces' | 'quiet'>> & { surfaces?: Partial<Surfaces> }

async function saveSettings($: $, patch: SettingsPatch) {
  const cur = withDefaults(await storeGet<Partial<ModSettings>>($, K.settings, {}))
  const next = { ...cur, ...patch, surfaces: { ...cur.surfaces, ...(patch.surfaces ?? {}) } }
  await save($, K.settings, next)
  await update($, settings, () => next)
  return next
}

/** Read-modify-write on the shared ledger; the atom follows the stored value. */
async function ledgerApply($: $, change: (rows: ScoredCommit[]) => ScoredCommit[]) {
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const next = change(rows)
  if (next !== rows) await save($, K.ledger, next)
  await update($, ledger, () => next)
  return next
}

async function getVerdict($: $, pid: string, model: string): Promise<Verdict | null> {
  const cache = await storeGet<Record<string, Verdict>>($, K.cache, {})
  const v = cache[pid]
  if (!v || v.rubric !== RUBRIC) return null
  if (v.judge !== 'rule' && v.asked !== model) return null
  return v
}

async function putVerdict($: $, pid: string, v: Verdict) {
  const cache = await storeGet<Record<string, Verdict>>($, K.cache, {})
  const t = await $.clock.now()
  cache[pid] = v
  // Prune: other rubrics, and anything older than 70 days (longer than a row stays in the ledger).
  for (const [k, row] of Object.entries(cache)) if (row.rubric !== RUBRIC || t - row.scoredAt > 70 * 86_400_000) delete cache[k]
  await save($, K.cache, cache)
}

async function getRepos($: $) {
  return storeGet<string[]>($, K.repos, [])
}

async function addRepo($: $, root: string) {
  const repos = await getRepos($)
  if (!repos.includes(root)) {
    repos.push(root)
    await save($, K.repos, repos)
    // A new repo's older commits since tracking started still need scoring once.
    await save($, K.rebuild, true)
  }
  return repos
}

async function dropRepo($: $, root: string) {
  const repos = (await getRepos($)).filter(r => r !== root)
  await save($, K.repos, repos)
}

/** A soft lock so two sessions don't pay to judge the same commit; stale after two minutes. */
async function claim($: $, key: string) {
  const t = await $.clock.now()
  const claims = await storeGet<Record<string, { owner: string; at: number }>>($, K.claims, {})
  const held = claims[key]
  if (held && held.owner !== owner && t - held.at < 120_000) return false
  for (const [k, v] of Object.entries(claims)) if (t - v.at > 600_000) delete claims[k]
  claims[key] = { owner, at: t }
  await save($, K.claims, claims)
  return true
}

async function unclaim($: $, key: string) {
  const claims = await storeGet<Record<string, { owner: string; at: number }>>($, K.claims, {})
  if (claims[key]?.owner === owner) {
    delete claims[key]
    await save($, K.claims, claims)
  }
}

/** Three failed judge calls on one commit and it rests for a day instead of failing every scan. */
async function isResting($: $, pid: string) {
  const f = await storeGet<Record<string, { n: number; at: number }>>($, K.failures, {})
  const row = f[pid]
  return !!row && row.n >= 3 && (await $.clock.now()) - row.at < 86_400_000
}

async function noteFailure($: $, pid: string, ok: boolean) {
  const f = await storeGet<Record<string, { n: number; at: number }>>($, K.failures, {})
  if (ok) {
    if (!f[pid]) return
    delete f[pid]
  } else {
    f[pid] = { n: (f[pid]?.n ?? 0) + 1, at: await $.clock.now() }
  }
  await save($, K.failures, f)
}

// ================================================================== GIT

export type RawCommit = RecentCommit & {
  sha: string
  email: string
  /** `noreply@github.com` for commits GitHub made: squash merges, web edits. */
  committer: string
}

async function git($: $, cwd: string, args: string[], timeoutMs = 60_000) {
  return $.process.run(['git', ...args], { cwd, timeoutMs })
}

/** The main working tree for any path inside a repo or one of its worktrees. */
async function repoRoot($: $, cwd: string): Promise<string | null> {
  try {
    const common = await git($, cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'], 15_000)
    if (common.exitCode === 0) {
      const dir = common.stdout.trim()
      if (dir.endsWith('/.git')) return dir.slice(0, -5)
    }
    const top = await git($, cwd, ['rev-parse', '--show-toplevel'], 15_000)
    return top.exitCode === 0 ? top.stdout.trim() : null
  } catch {
    return null
  }
}

function repoName(root: string) {
  return root.split('/').filter(Boolean).pop() ?? root
}

/** Emails that count as you in this repo: its user.email plus the global one. */
async function myEmails($: $, root: string) {
  const out = new Set<string>()
  for (const args of [['config', 'user.email'], ['config', '--global', 'user.email']]) {
    try {
      const r = await git($, root, args, 15_000)
      const v = r.stdout.trim().toLowerCase()
      if (v) out.add(v)
    } catch {}
  }
  return out
}

/** Changes whenever any branch, remote or tag moves: an unchanged repo skips the scan. */
async function refsFingerprint($: $, root: string) {
  const r = await git($, root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes', 'refs/tags'], 30_000)
  const head = await git($, root, ['rev-parse', 'HEAD'], 15_000)
  return String(hash(r.stdout + head.stdout))
}

const SEP = '\x1f'
// Stash entries are commits on refs/stash; --exclude must come before --all.
const REFS = ['--exclude=refs/stash', '--all']

/** Every commit sha reachable from a branch, remote or tag since `from`; `ok` false when git failed (never trust an empty set then). */
async function reachable($: $, root: string, from: number) {
  const r = await git($, root, ['rev-list', ...REFS, `--since=@${Math.floor(from / 1000)}`])
  return { set: new Set(r.stdout.split('\n').filter(Boolean)), ok: r.exitCode === 0 }
}

/**
 * Your commits (author email) with author time in [from, to]. `--since`
 * filters on committer time, which is at or after author time, so it is a
 * safe lower bound; author time is checked here.
 */
async function listCommits($: $, root: string, emails: Set<string>, from: number, to: number) {
  const r = await git($, root, ['log', ...REFS, '--no-merges', `--since=@${Math.floor(from / 1000)}`, `--format=${SEP}%H${SEP}%ae${SEP}%at${SEP}%ce${SEP}%s`, '--numstat'], 90_000)
  if (r.exitCode !== 0) throw new Error(clean(r.stderr.trim().slice(0, 200)) || 'git log failed')
  const out: RawCommit[] = []
  let cur: RawCommit | null = null
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith(SEP)) {
      const [, sha = '', email = '', at = '0', ce = '', title = ''] = line.split(SEP)
      cur = { sha, email: email.toLowerCase(), committer: ce.toLowerCase(), authoredAt: Number(at) * 1000, title: clean(title), added: 0, deleted: 0, files: [] }
      out.push(cur)
    } else if (cur && line.trim()) {
      const [a = '0', d = '0', ...rest] = line.split('\t')
      cur.added += a === '-' ? 0 : Number(a) || 0
      cur.deleted += d === '-' ? 0 : Number(d) || 0
      cur.files.push(rest.join('\t'))
    }
  }
  return out.filter(c => emails.has(c.email) && c.authoredAt >= from && c.authoredAt <= to && !isStashTitle(c.title))
}

/** `git patch-id --stable`: the same change keeps its id across rebase and amend. */
async function patchId($: $, root: string, sha: string) {
  try {
    const show = await git($, root, ['show', '--format=', '--no-color', sha])
    if (!show.stdout.trim()) return sha
    const r = await $.process.run(['git', 'patch-id', '--stable'], { cwd: root, stdin: show.stdout })
    return r.stdout.trim().split(/\s+/)[0] || sha
  } catch {
    return sha
  }
}

async function patchIdOfRange($: $, root: string, from: string, to: string) {
  try {
    const diff = await git($, root, ['diff', '--no-color', from, to])
    if (!diff.stdout.trim()) return ''
    const r = await $.process.run(['git', 'patch-id', '--stable'], { cwd: root, stdin: diff.stdout })
    return r.stdout.trim().split(/\s+/)[0] ?? ''
  } catch {
    return ''
  }
}

async function isAncestor($: $, root: string, a: string, b: string) {
  try {
    const r = await git($, root, ['merge-base', '--is-ancestor', a, b], 15_000)
    return r.exitCode === 0 ? true : r.exitCode === 1 ? false : null
  } catch {
    return null
  }
}

/** A reason to give 0 without asking the judge, or null. */
async function skipReason($: $, root: string, c: RawCommit) {
  if (c.files.length > 0 && c.files.every(isNoise)) return 'lockfile, build or generated files only'
  if (c.added + c.deleted === 0) return 'no line changes'
  try {
    const r = await git($, root, ['show', '-w', '--format=', '--numstat', c.sha])
    const changed = r.stdout
      .split('\n')
      .filter(Boolean)
      .reduce((n, l) => {
        const [a = '0', d = '0'] = l.split('\t')
        return n + (Number(a) || 0) + (Number(d) || 0)
      }, 0)
    if (changed === 0) return 'formatting only'
  } catch {}
  return null
}

async function digest($: $, root: string, c: RawCommit, pool: RawCommit[]) {
  const msg = await git($, root, ['show', '-s', '--format=%B', c.sha])
  const stat = await git($, root, ['show', '--format=', '--numstat', c.sha])
  const patch = await git($, root, ['show', '--format=', '--no-color', '-U2', c.sha], 90_000)
  return digestText({
    authoredAt: c.authoredAt,
    message: msg.stdout,
    numstat: stat.stdout,
    added: c.added,
    deleted: c.deleted,
    fileCount: c.files.length,
    patch: patch.stdout,
    recent: recentOnSameFiles(c, pool),
  })
}

// ================================================================== SQUASH MERGES

type SquashDecision = { d: 'drop' | 'keep'; branch?: string[] }

const isSquashCommit = (c: RawCommit) => c.committer === 'noreply@github.com' && PR_SUFFIX.test(c.title)

async function getSquash($: $) {
  const raw = await storeGet<Record<string, SquashDecision | 'drop' | 'keep'>>($, K.squash, {})
  const out: Record<string, SquashDecision> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'string' ? { d: v } : v
  return out
}

/**
 * GitHub squash merges (committer noreply@github.com, subject ending "(#N)")
 * repeat work whose branch commits are also in the repo. Each decision is kept
 * in the store with the branch commits it stands for, so deleting the branch
 * later can neither bring the double count back nor remove those commits.
 * Drop a squash only on evidence: the ledger already holds a commit of yours
 * with its subject from the two weeks before it; or a commit of yours that is
 * not its ancestor has its subject; or a branch whose combined diff since it
 * forked has the squash's patch-id. Otherwise the squash counts (the work was
 * done on another machine). `evidence` may be a wider listing than `listed`.
 */
async function decideSquashes($: $, root: string, listed: RawCommit[], evidence: RawCommit[] = listed) {
  const name = repoName(root)
  const decided = await getSquash($)
  const pending = evidence.filter(c => isSquashCommit(c) && !decided[`${name}:${c.sha}`]).sort((a, b) => a.authoredAt - b.authoredAt)
  if (pending.length > 0) {
    const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
    const locals = evidence.filter(c => !isSquashCommit(c))
    const consumed = new Set(Object.values(decided).flatMap(v => v.branch ?? []))
    for (const sq of pending) {
      const key = `${name}:${sq.sha}`
      const base = sq.title.replace(PR_SUFFIX, '').trim()
      const from = sq.authoredAt - 14 * 86_400_000
      const inLedger = rows.find(x => x.repoName === name && x.sha !== sq.sha && x.title.trim() === base && x.authoredAt >= from && x.authoredAt <= sq.authoredAt)
      if (inLedger) {
        decided[key] = { d: 'drop', branch: [inLedger.sha] }
        consumed.add(inLedger.sha)
        continue
      }
      const branch = await branchOf($, root, sq, locals, consumed)
      decided[key] = branch ? { d: 'drop', branch } : { d: 'keep' }
    }
    await save($, K.squash, decided)
  }
  const dropped = new Set(listed.filter(c => decided[`${name}:${c.sha}`]?.d === 'drop').map(c => c.sha))
  const protectedShas = new Set(Object.values(decided).flatMap(v => (v.d === 'drop' ? (v.branch ?? []) : [])))
  return { kept: listed.filter(c => !dropped.has(c.sha)), dropped, protectedShas }
}

/**
 * The branch commits a squash merge stands for, or null when there is no
 * evidence they are here. Marks the commits it returns as consumed.
 */
async function branchOf($: $, root: string, sq: RawCommit, locals: RawCommit[], consumed: Set<string>): Promise<string[] | null> {
  const base = sq.title.replace(PR_SUFFIX, '').trim()
  const from = sq.authoredAt - 14 * 86_400_000
  const near: RawCommit[] = []
  for (const c of locals) {
    if (consumed.has(c.sha) || c.authoredAt < from || c.authoredAt > sq.authoredAt) continue
    if ((await isAncestor($, root, c.sha, sq.sha)) === false) near.push(c)
  }
  if (near.length === 0) return null
  const files = new Set(sq.files)
  const overlap = (c: RawCommit) => c.files.filter(f => files.has(f)).length
  const titled = near.filter(c => c.title.trim() === base)
  const ordered = [...titled, ...near.filter(c => !titled.includes(c)).sort((a, b) => overlap(b) - overlap(a) || b.authoredAt - a.authoredAt)]
  const refs: string[] = []
  for (const c of ordered) {
    const r = await git($, root, ['for-each-ref', '--contains', c.sha, '--no-contains', sq.sha, '--format=%(refname)', 'refs/heads', 'refs/remotes'], 30_000)
    for (const ref of r.stdout.split('\n').filter(Boolean)) if (!refs.includes(ref)) refs.push(ref)
    if (titled.length > 0 && refs.length > 0) break
  }
  const take = async (ref: string) => {
    const taken: string[] = []
    for (const c of near) if ((await isAncestor($, root, c.sha, ref)) === true) taken.push(c.sha)
    return taken
  }
  if (titled.length > 0) {
    // The subject matches: the branch holding it is the PR's branch, if it still exists.
    const taken = refs[0] ? await take(refs[0]) : titled.map(c => c.sha)
    const all = taken.length ? taken : titled.map(c => c.sha)
    all.forEach(s => consumed.add(s))
    return all
  }
  const want = await patchId($, root, sq.sha)
  for (const ref of refs.slice(0, 20)) {
    const fork = await git($, root, ['merge-base', ref, `${sq.sha}^`], 15_000)
    const forkAt = fork.stdout.trim()
    if (!forkAt) continue
    if ((await patchIdOfRange($, root, forkAt, ref)) === want) {
      const taken = await take(ref)
      taken.forEach(s => consumed.add(s))
      return taken
    }
  }
  return null
}

// ================================================================== JUDGE

function refused(r: ModelCompleteResult) {
  return !r.isAnswered && r.reason === 'api-error' && (r.status === 404 || r.status === 400 || String(r.error) === 'model_not_found' || String(r.error) === 'invalid_request')
}

/** Rate limits, overload, server errors, timeouts and aborts pass; they never put a commit to rest. */
function isTransient(r: ModelCompleteResult) {
  if (r.isAnswered) return false
  if (r.reason === 'aborted') return true
  if (r.reason !== 'api-error') return false
  const s = r.status
  return s === null || s === 429 || s === 529 || (s >= 500 && s <= 504) || /rate_limit|overloaded|server_error|timeout/.test(String(r.error))
}

type JudgeError = Error & { transient: boolean }

function judgeError(message: string, transient: boolean): JudgeError {
  return Object.assign(new Error(message), { transient })
}

type JudgeOut = { base: number; craft: ScoredCommit['craft']; category: string; reason: string; model: string }

/** One judge call; when the pinned model is refused, the fallback alias answers instead. */
async function judge($: $, model: string, text: string, title: string, size: string): Promise<JudgeOut> {
  const ask = (m: string) => $.model.complete({ model: m, system: JUDGE_SYSTEM, prompt: text, maxTokens: 300, timeoutMs: 120_000 })
  let used = model
  let r: ModelCompleteResult | null = null
  try {
    r = await ask(model)
  } catch {
    r = null
  }
  if ((!r || refused(r)) && model !== FALLBACK_MODEL) {
    used = FALLBACK_MODEL
    try {
      r = await ask(used)
    } catch {
      r = null
    }
  }
  if (!r) throw judgeError('judge: the model call was refused', false)
  if (!r.isAnswered) {
    const why = r.reason === 'api-error' ? `api error ${r.status ?? ''} ${String(r.error)}` : r.reason
    throw judgeError(`judge: ${why}`, isTransient(r))
  }
  const v = parseVerdict(r.text, title, size)
  if (!v) throw judgeError(`judge: unreadable reply "${clean(r.text).slice(0, 80)}"`, false)
  return { ...v, model: used }
}

type ScoreOut = ScoredCommit | { skip: 'claimed' | 'resting' }

/**
 * Scores one commit: a cached verdict for the same change, rubric and model if
 * any session already judged it, else a skip rule or the judge. Skips (and
 * says why) when another session holds the claim or the commit is resting
 * after three real failures. Transient failures never count toward resting.
 * `sends`: this commit's score goes to the server, so the server may be asked
 * about it first; a backtest or a commit kept on this machine never is.
 */
async function scoreRaw($: $, root: string, raw: RawCommit, pool: RawCommit[], sends = false): Promise<ScoreOut> {
  const pid = await patchId($, root, raw.sha)
  const model = (await read($, settings)).model
  const meta = {
    pid,
    sha: raw.sha,
    repoName: repoName(root),
    title: raw.title,
    added: raw.added,
    deleted: raw.deleted,
    files: raw.files.length,
    authoredAt: raw.authoredAt,
  }
  const hit = await getVerdict($, pid, model)
  if (hit) return { ...meta, ...hit }
  if (await isResting($, pid)) return { skip: 'resting' }
  if (!(await claim($, pid))) return { skip: 'claimed' }
  try {
    const skip = await skipReason($, root, raw)
    let v: Verdict
    // Another install of this account may already have judged this change, or be judging it now.
    const remote = skip || !sends ? null : await serverClaim($, pid)
    if (remote === 'taken') return { skip: 'claimed' }
    if (remote && remote !== 'mine') {
      v = { points: remote.points, base: remote.base, craft: remote.craft as Verdict['craft'], category: remote.category, reason: ACCOUNT.scoredElsewhere, judge: remote.model, asked: model, rubric: remote.rubric, scoredAt: await $.clock.now() }
      await putVerdict($, pid, v)
      return { ...meta, ...v }
    }
    if (skip) {
      v = { points: 0, base: 0, craft: 'neutral', category: 'chore', reason: skip, judge: 'rule', asked: model, rubric: RUBRIC, scoredAt: await $.clock.now() }
    } else {
      const size = `+${raw.added} -${raw.deleted} in ${raw.files.length} files`
      const out = await judge($, model, await digest($, root, raw, pool), raw.title, size)
      v = { points: stepCraft(out.base, out.craft), base: out.base, craft: out.craft, category: out.category, reason: out.reason, judge: out.model, asked: model, rubric: RUBRIC, scoredAt: await $.clock.now() }
    }
    await putVerdict($, pid, v)
    await noteFailure($, pid, true)
    return { ...meta, ...v }
  } catch (err) {
    if (!(err as Partial<JudgeError>).transient) await noteFailure($, pid, false)
    throw err
  } finally {
    await unclaim($, pid)
  }
}

type RemoteScore = { fingerprint: string; points: number; base: number; craft: string; category: string; model: string; rubric: string }

/**
 * Asks the server before judging a change: 'mine' to judge it (also whenever
 * there's no account or no answer, so scoring never waits on the server),
 * 'taken' while another install judges it, or the score another install sent.
 */
async function serverClaim($: $, pid: string): Promise<'mine' | 'taken' | RemoteScore> {
  if (!(await serverCfg($)).token) return 'mine'
  const r = await api($, 'POST', '/scores/claims', { fingerprints: [pid] })
  if (r.status !== 200) return 'mine'
  const j = r.json as { claimed: string[]; taken: string[]; scored: RemoteScore[] }
  const done = j.scored?.find(x => x.fingerprint === pid)
  if (done) return done
  return j.taken?.includes(pid) ? 'taken' : 'mine'
}

/** Earlier commits in the pool get the points they already scored, so the judge sees them. */
async function withPoints($: $, pool: RawCommit[]) {
  const scored = new Map((await storeGet<ScoredCommit[]>($, K.ledger, [])).map(x => [x.sha, x.points]))
  for (const c of pool) if (scored.has(c.sha)) c.points = scored.get(c.sha)
  return pool
}

// ================================================================== GRIND SCAN

export type ScanResult = {
  added: ScoredCommit[]
  replaced: number
  removed: number
  errors: string[]
  squashes: number
  pruned: number
  skippedRepos: number
  claimed: { sha: string; authoredAt: number }[]
}

/**
 * The Grind: every commit you authored since tracking started, in every repo a
 * Claude Code session has opened (with tracking off, only commits inside a
 * live match, ranked or practice, kept as match-only rows). Commit identity:
 * - an amended or rebased commit (same author time and subject, old sha gone)
 *   replaces its row; while the old sha is still reachable on another history
 *   (a backup ref), the two count once;
 * - the same change on another sha (cherry-pick) counts once by patch-id;
 * - squash merges whose branch commits count are dropped for good;
 * - after a full listing, rows whose commit is no longer reachable from any
 *   ref leave (local squash, reset), except branch commits a squash stands for.
 * Rows older than the roll-up cutoff are never listed or scored again.
 */
async function scanGrind($: $, force: boolean, notify?: (c: ScoredCommit) => Promise<void>): Promise<ScanResult> {
  const result: ScanResult = { added: [], replaced: 0, removed: 0, errors: [], squashes: 0, pruned: 0, skippedRepos: 0, claimed: [] }
  const s = await read($, settings)
  const stored = await storeGet<Match | null>($, K.match, null)
  const liveMatch = stored && stored.status === 'live' && stored.kind === 'practice' && Array.isArray(stored.plan) ? stored : null
  // A ranked match running on the server (or counting after its bell), its window from the last poll.
  const rk = (await read($, link)).ranked?.summary
  const rankedOn = rk?.status === 'live' || rk?.status === 'grace'
  const rankedWindow = rankedOn && rk?.started_at && rk.deadline ? { startAt: Date.parse(rk.started_at), deadline: Date.parse(rk.deadline) } : null
  // With tracking off only a match's commits are scored: a ranked one, else a practice match here.
  const matchWindow = rankedWindow ?? liveMatch
  if (!s.tracking && !matchWindow) return result
  // The same rule as onScore: the Grind goes to the server while tracking is on, a ranked match's commits whenever one runs.
  const sends = s.tracking || rankedOn
  await update($, scan, cur => ({ ...SCAN0, ...cur, busy: true, note: 'Looking for new commits' }))
  try {
    const since = await storeGet($, K.since, await read($, trackingSince))
    const t = await $.clock.now()
    const cutoff = rollCutoff(t)
    const rebuild = await storeGet($, K.rebuild, false)
    let complete = true
    for (const root of await getRepos($)) {
      try {
        if (!(await $.fs.exists(root))) {
          await dropRepo($, root)
          continue
        }
        const fp = await refsFingerprint($, root)
        if (!force && !rebuild && lastFingerprint.get(root) === fp) {
          result.skippedRepos++
          continue
        }
        const name = repoName(root)
        const emails = await myEmails($, root)
        const floor = rebuild ? since : Math.max(since, cutoff)
        const evidenceFrom = Math.max(since, floor - 14 * 86_400_000)
        const full = force || rebuild || t - (lastFullList.get(root) ?? 0) > 3_600_000
        const from = full ? evidenceFrom : Math.max(evidenceFrom, t - 2 * 86_400_000)
        const listed = await listCommits($, root, emails, from, t + 60_000)
        const reach = await reachable($, root, evidenceFrom)
        let evidence = listed
        if (!full) {
          const decided = await getSquash($)
          const pend = listed.filter(c => isSquashCommit(c) && !decided[`${name}:${c.sha}`])
          if (pend.length > 0) {
            const lo = Math.max(since, Math.min(...pend.map(p => p.authoredAt)) - 14 * 86_400_000)
            evidence = await listCommits($, root, emails, lo, t + 60_000)
          }
        }
        const { kept, dropped, protectedShas } = await decideSquashes($, root, listed, evidence)
        if (dropped.size > 0) {
          result.squashes += dropped.size
          await ledgerApply($, rows => {
            const next = rows.filter(x => !(x.repoName === name && dropped.has(x.sha)))
            result.pruned += rows.length - next.length
            return next.length === rows.length ? rows : next
          })
        }
        await withPoints($, listed)
        const scoreFrom = s.tracking ? floor : Math.max(floor, matchWindow!.startAt)
        const scoreTo = s.tracking ? t + 60_000 : matchWindow!.deadline
        let incomplete = false
        for (const raw of kept.sort((a, b) => a.authoredAt - b.authoredAt)) {
          if (raw.authoredAt < scoreFrom || raw.authoredAt > scoreTo) continue
          const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
          if (skipShas.has(raw.sha) || rows.some(x => x.sha === raw.sha)) continue
          const key = idKey(name, raw.authoredAt, raw.title)
          const twin = rows.find(x => x.repoName === name && x.sha !== raw.sha && idKey(x.repoName, x.authoredAt, x.title) === key)
          let rewriteOf: ScoredCommit | undefined
          if (twin) {
            if (!reach.set.has(twin.sha)) rewriteOf = twin
            else if ((await isAncestor($, root, twin.sha, raw.sha)) === false && (await isAncestor($, root, raw.sha, twin.sha)) === false) {
              // The same commit on two histories (a backup ref kept the pre-rebase one): it counts once.
              continue
            }
          }
          await update($, scan, cur => ({ ...SCAN0, ...cur, busy: true, note: `Scoring "${raw.title.slice(0, 50)}"` }))
          let out: ScoreOut
          try {
            out = await scoreRaw($, root, raw, listed, sends)
          } catch (err) {
            const msg = clean((err as Error).message)
            result.errors.push(`${name} ${raw.sha.slice(0, 7)} "${raw.title.slice(0, 40)}": ${msg}`)
            incomplete = true
            if ((err as Partial<JudgeError>).transient && /rate_limit|overloaded|429|529/.test(msg)) break
            continue
          }
          if ('skip' in out) {
            incomplete = true
            if (out.skip === 'claimed') result.claimed.push({ sha: raw.sha, authoredAt: raw.authoredAt })
            else result.errors.push(`${name} ${raw.sha.slice(0, 7)} "${raw.title.slice(0, 40)}": resting after 3 failed judge calls`)
            continue
          }
          const scored: ScoredCommit = s.tracking ? out : { ...out, matchOnly: true }
          raw.points = scored.points
          let isNew = false
          await ledgerApply($, cur => {
            if (cur.some(x => x.sha === scored.sha)) return cur
            const same = cur.find(x => x.pid === scored.pid)
            if (rewriteOf && !same) {
              result.replaced++
              return cur.map(x => (x.sha === rewriteOf!.sha ? scored : x))
            }
            if (same) {
              // The same change on another sha: move the row to the live one, or remember to skip it.
              if (!reach.set.has(same.sha)) return cur.map(x => (x.sha === same.sha ? { ...x, sha: scored.sha } : x))
              skipShas.add(scored.sha)
              return cur
            }
            isNew = true
            return [...cur, scored]
          })
          if (isNew) {
            result.added.push(scored)
            if (notify) await notify(scored)
          }
        }
        // Commits no longer reachable from any ref (a local squash, a reset) leave the ledger.
        if (full && reach.ok && !incomplete) {
          await ledgerApply($, rows => {
            const next = rows.filter(x => !(x.repoName === name && x.authoredAt >= evidenceFrom && !reach.set.has(x.sha) && !protectedShas.has(x.sha)))
            result.removed += rows.length - next.length
            return next.length === rows.length ? rows : next
          })
        }
        if (incomplete) complete = false
        else {
          lastFingerprint.set(root, fp)
          if (full) lastFullList.set(root, t)
        }
      } catch (err) {
        complete = false
        result.errors.push(`${repoName(root)}: ${clean((err as Error).message)}`)
      }
    }
    if (rebuild && complete) await save($, K.rebuild, false)
    // Roll old rows into week totals so the store stays small.
    const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
    const weeks = await storeGet<WeekTotals>($, K.weeks, {})
    const rolled = rollUp(rows, weeks, t)
    if (rolled.rolled > 0 || rolled.list.length !== rows.length) {
      await save($, K.weeks, rolled.weeks)
      await save($, K.ledger, rolled.list)
    }
    await update($, ledger, () => rolled.list)
    await update($, weekTotals, () => rolled.weeks)
  } catch (err) {
    result.errors.push(`scan: ${clean((err as Error).message)}`)
  } finally {
    const done = await $.clock.now()
    if (storeProblem) result.errors.push(storeProblem)
    const parts = [
      result.added.length > 0 ? `Scored ${result.added.length} new commit${result.added.length === 1 ? '' : 's'}` : 'Up to date',
      result.replaced > 0 ? `${result.replaced} rewritten commit${result.replaced === 1 ? '' : 's'} replaced` : '',
      result.removed > 0 ? `${result.removed} commit${result.removed === 1 ? '' : 's'} no longer on any branch removed` : '',
      result.squashes > 0 ? `${result.squashes} squash merge${result.squashes === 1 ? '' : 's'} skipped (branch commits already count)` : '',
      result.pruned > 0 ? `removed ${result.pruned} double-counted` : '',
      result.claimed.length > 0 ? `${result.claimed.length} being scored in another session` : '',
      result.errors.length > 0 ? `${result.errors.length} problem${result.errors.length === 1 ? '' : 's'}` : '',
    ]
    const note = parts.filter(Boolean).join(' · ')
    const problems = result.errors.map(err => `${new Date(done).toTimeString().slice(0, 5)} ${err}`)
    await update($, scan, () => ({ busy: false, lastAt: done, note, problems }))
  }
  return result
}

// ================================================================== PAST SESSIONS

const SESSION_SCRIPT = `
cd "$HOME/.claude/projects" 2>/dev/null || exit 0
find . -maxdepth 2 -name '*.jsonl' -type f -mtime -__DAYS__ -print0 | xargs -0 ls -t 2>/dev/null | head -n __CAP__ | while IFS= read -r f; do
  id=$(basename "$f" .jsonl)
  head=$(head -c 262144 "$f")
  first=$(printf '%s' "$head" | grep -m1 -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
  last=$(tail -c 40000 "$f" | grep -o '"timestamp":"[^"]*"' | tail -1 | cut -d'"' -f4)
  cwd=$(printf '%s' "$head" | grep -m1 -o '"cwd":"[^"]*"' | cut -d'"' -f4)
  title=$({ printf '%s' "$head"; tail -c 262144 "$f"; } | grep -m1 -o '"customTitle":"\\(\\\\.\\|[^"\\\\]\\)*"' | sed 's/^"customTitle"://')
  [ -z "$title" ] && title=$({ printf '%s' "$head"; tail -c 262144 "$f"; } | grep -m1 -o '"summary":"\\(\\\\.\\|[^"\\\\]\\)*"' | sed 's/^"summary"://')
  [ -z "$title" ] && title=$(printf '%s' "$head" | grep -m1 '"type":"user"' | grep -o '"content":"\\(\\\\.\\|[^"\\\\]\\)\\{1,120\\}' | head -1 | sed 's/^"content"://')
  printf '%s\\037%s\\037%s\\037%s\\037%s\\n' "$id" "$first" "$last" "$cwd" "$title"
done
`

function decodeTitle(raw: string) {
  const q = raw.trim()
  if (!q) return ''
  try {
    return String(JSON.parse(q.endsWith('"') ? q : `${q}"`))
  } catch {
    return q.replace(/^"|"$/g, '').replace(/\\n/g, ' ').replace(/\\"/g, '"')
  }
}

function projectOf(cwd: string) {
  const wt = cwd.split('/.claude/worktrees/')
  const base = (wt[0] ?? cwd).split('/').filter(Boolean).pop() ?? cwd
  return wt.length > 1 ? `${base} (${(wt[1] ?? '').split('/')[0]})` : base
}

/** Past Claude Code sessions from their transcripts' first and last timestamps, one row per session. */
async function discoverSessions($: $, days: number) {
  await update($, sessionsNote, () => `Reading the last ${days} days of sessions`)
  const d = Math.max(1, Math.floor(days))
  let r: { stdout: string }
  try {
    r = await $.process.run(['sh', '-c', SESSION_SCRIPT.replace('__DAYS__', String(d)).replace('__CAP__', '400')], { timeoutMs: Math.min(600_000, 60_000 + d * 15_000) })
  } catch (err) {
    await update($, sessionsNote, () => `Could not read past sessions: ${clean((err as Error).message)}`)
    return []
  }
  const byId = new Map<string, PastSession>()
  const cutoff = (await $.clock.now()) - d * 86_400_000
  for (const line of r.stdout.split('\n')) {
    const [id = '', first = '', last = '', cwd = '', title = ''] = line.split('\x1f')
    const startAt = Date.parse(first)
    const endAt = Date.parse(last)
    if (!id || !cwd || !Number.isFinite(startAt) || !Number.isFinite(endAt) || id === owner) continue
    if (endAt - startAt < 60_000 || endAt < cutoff) continue
    const row: PastSession = { id, title: clean(decodeTitle(title)).trim().slice(0, 90) || 'Untitled session', project: projectOf(cwd), cwd, startAt, endAt }
    const prev = byId.get(id)
    if (!prev) byId.set(id, row)
    else {
      const main = cwd.includes('/.claude/worktrees/') ? prev.cwd : cwd
      byId.set(id, { ...prev, startAt: Math.min(prev.startAt, startAt), endAt: Math.max(prev.endAt, endAt), cwd: main, project: projectOf(main) })
    }
  }
  const list = [...byId.values()].sort((a, b) => b.endAt - a.endAt)
  await update($, sessions, () => list)
  const summary = list.length ? `${list.length} sessions in the last ${d} days` : `No sessions found in the last ${d} days`
  await update($, sessionsNote, () => summary)
  return list
}

/** A worktree that was deleted still has its commits in the main repo. */
async function rootFor($: $, cwd: string) {
  const direct = await repoRoot($, cwd)
  if (direct) return direct
  const main = cwd.split('/.claude/worktrees/')[0]
  return main && main !== cwd ? repoRoot($, main) : null
}

async function setRun($: $, run: BacktestRun) {
  await update($, backtests, all => ({ ...all, [run.sessionId]: run }))
}

/** How a past session would have scored: your commits in its repo inside its own window. */
async function backtestSession($: $, s: PastSession, signal?: AbortSignal): Promise<BacktestRun> {
  let run: BacktestRun = { sessionId: s.id, status: 'running', done: 0, total: 0, points: 0, skipped: 0, failed: 0, deferred: 0, commits: [], note: 'Finding commits' }
  await setRun($, run)
  const root = await rootFor($, s.cwd)
  if (!root) {
    run = { ...run, status: 'error', note: `No git repo at ${s.cwd}` }
    await setRun($, run)
    return run
  }
  try {
    const emails = await myEmails($, root)
    const end = s.endAt + 15 * 60_000
    // List two weeks wider so squash decisions see the branch commits they repeat.
    const wide = await listCommits($, root, emails, s.startAt - 14 * 86_400_000, end)
    const { kept } = await decideSquashes($, root, wide)
    await withPoints($, wide)
    const raws = kept.filter(c => c.authoredAt >= s.startAt && c.authoredAt <= end).sort((a, b) => a.authoredAt - b.authoredAt)
    run = { ...run, total: raws.length, note: raws.length ? 'Scoring' : 'No commits by you in this session' }
    await setRun($, run)
    const seen = new Set<string>()
    const seenKey = new Set<string>()
    const name = repoName(root)
    let firstError = ''
    for (const raw of raws) {
      if (signal?.aborted) break
      // The same commit on two histories (a backup ref of a rebase) counts once.
      const key = idKey(name, raw.authoredAt, raw.title)
      if (seenKey.has(key)) {
        run = { ...run, done: run.done + 1 }
        continue
      }
      let c: ScoredCommit | null = null
      try {
        const out = await scoreRaw($, root, raw, wide)
        if ('skip' in out) {
          if (out.skip === 'claimed') run = { ...run, deferred: run.deferred + 1 }
          else {
            firstError = firstError || 'resting after 3 failed judge calls'
            run = { ...run, failed: run.failed + 1 }
          }
        } else c = out
      } catch (err) {
        firstError = firstError || clean((err as Error).message)
        run = { ...run, failed: run.failed + 1 }
      }
      if (c && !seen.has(c.pid)) {
        seen.add(c.pid)
        seenKey.add(key)
        raw.points = c.points
        run = { ...run, commits: [...run.commits, c], points: run.points + c.points, skipped: run.skipped + (c.judge === 'rule' ? 1 : 0) }
      }
      run = { ...run, done: run.done + 1 }
      await setRun($, run)
    }
    const short = run.failed + run.deferred > 0 || run.done < run.total
    run = {
      ...run,
      status: short ? 'partial' : 'done',
      note: run.total
        ? `${run.points} points from ${run.commits.length} of ${run.total} commits${run.failed ? ` · ${run.failed} failed (${firstError})` : ''}${run.deferred ? ` · ${run.deferred} busy in another session` : ''}`
        : run.note,
    }
  } catch (err) {
    run = { ...run, status: 'error', note: clean((err as Error).message) }
  }
  await setRun($, run)
  return run
}

/** Every repo a past session in the window touched, so the Grind can backfill. */
async function reposFromSessions($: $, list: PastSession[], from: number) {
  const roots = new Set<string>()
  for (const s of list) {
    if (s.endAt < from) continue
    const root = await rootFor($, s.cwd)
    if (root) roots.add(root)
  }
  return [...roots]
}

// ================================================================== MATCH

// Made-up rivals, the same handles every mockup uses.
const RIVALS: readonly { handle: string; rating: number }[] = [
  { handle: '10xgary', rating: 1172 },
  { handle: 'nova_ships', rating: 1712 },
  { handle: 'rk', rating: 1655 },
  { handle: 'vex', rating: 1488 },
  { handle: 'tokyo_drift', rating: 1391 },
]

const TAUNTS = ['gl hf', 'clock is ticking', 'nice one', 'that was a big diff', 'ok that one hurt', 'shipping, brb', 'gg incoming', 'whats your stack']
const REPLIES = ['lol', 'fair', 'we will see', 'no way', 'respect', 'back to work', 'deploying now', 'haha true']
const LEASE_STALE = 30_000

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)] as T
}

function liveOpp(m: Match, t: number) {
  return m.status === 'live' ? oppAt(m.plan, t, m.deadline) : m.oppPoints
}

function resultOf(myPoints: number, oppPoints: number): Match['status'] {
  return myPoints === 0 && oppPoints === 0 ? 'void' : myPoints > oppPoints ? 'won' : myPoints < oppPoints ? 'lost' : 'draw'
}

/**
 * Read-modify-write on the stored match: the store is the source of truth and
 * every session may write (chat, counted commits), so a change is applied to
 * the freshest copy and the atom follows it.
 */
async function matchApply($: $, id: string, change: (m: Match) => Match | null) {
  const cur = await storeGet<Match | null>($, K.match, null)
  if (!cur || cur.id !== id) {
    await update($, match, () => (cur && Array.isArray(cur.plan) ? cur : null))
    return null
  }
  const next = change(cur)
  if (next && next !== cur) await save($, K.match, next)
  const shown = next ?? cur
  await update($, match, () => shown)
  return next
}

async function startPractice($: $, hours: number) {
  const stored = await storeGet<Match | null>($, K.match, null)
  if (stored && stored.status === 'live' && Array.isArray(stored.plan)) return null
  const t = await $.clock.now()
  const mine = await storeGet($, K.rating, START_RATING)
  const r = rng(t)
  const rival = [...RIVALS].sort((a, b) => Math.abs(a.rating - mine) - Math.abs(b.rating - mine))[Math.floor(r() * 2)] ?? RIVALS[0]!
  const sprint = hours < 1
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const pace = sprint ? 150 : myPace(rows, t) * (0.8 + r() * 0.4)
  const deadline = t + hours * 3_600_000
  const m: Match = {
    id: `p-${t}`,
    kind: 'practice',
    hours,
    startAt: t,
    deadline,
    opp: { handle: rival.handle, rating: Math.round(mine + (r() - 0.5) * 120), pace },
    plan: botPlan(t, t, deadline, pace),
    myPoints: 0,
    oppPoints: 0,
    feed: [],
    counted: [],
    chat: [{ at: t, who: rival.handle, text: pick(r, ['gl hf', 'gl', 'lets go', 'hf']) }],
    status: 'live',
    ratingBefore: mine,
    lease: { owner, at: t },
  }
  await save($, K.match, m)
  await update($, match, () => m)
  await update($, now, () => t)
  return m
}

/**
 * My points are derived from the shared ledger every time, not accumulated:
 * the ledger already resolves rewrites (an amend replaces its row), so the
 * match follows it, and every in-window row counts once whichever session
 * scored it. The stored match freezes at the bell.
 */
async function syncMatch($: $) {
  const m = await storeGet<Match | null>($, K.match, null)
  if (!m || m.status !== 'live' || !Array.isArray(m.plan)) return 0
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const inWin = rows.filter(c => c.authoredAt >= m.startAt && c.authoredAt <= m.deadline)
  const fresh = inWin.filter(c => !m.counted.includes(c.pid))
  const pts = inWin.reduce((n, c) => n + c.points, 0)
  if (fresh.length === 0 && pts === m.myPoints && inWin.length === m.counted.length) return 0
  const t = await $.clock.now()
  await matchApply($, m.id, cur => {
    if (cur.status !== 'live') return cur
    const next: Match = {
      ...cur,
      myPoints: pts,
      feed: inWin.map(c => ({ at: c.authoredAt, who: 'me' as const, points: c.points, category: c.category, title: c.title })),
      counted: inWin.map(c => c.pid),
    }
    if (fresh.some(c => c.points >= 5) && Math.random() < 0.5) next.chat = [...cur.chat, { at: t, who: cur.opp.handle, text: pick(Math.random, TAUNTS) }]
    return next
  })
  return fresh.length
}

const BELL_MARKS: readonly [number, string][] = [
  [600, MOD.warn10],
  [60, MOD.warn1],
]
const warned = new Set<string>()
let lastSeenLive = ''

/** A practice result in the approved results table's words (copy.md). */
function resultLine(m: Match) {
  const delta = (m.ratingAfter ?? m.ratingBefore) - m.ratingBefore
  const outcome = m.status === 'won' ? 'won' : m.status === 'lost' || m.status === 'forfeit' ? 'lost' : m.status === 'void' ? 'void' : 'draw'
  return resultText(outcome, m.status === 'forfeit' ? 'forfeit' : 'points', delta, seedOf(m.id))
}

function seedOf(id: string) {
  let n = 0
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) % 9973
  return n
}

async function keepLease($: $, id: string) {
  const t = await $.clock.now()
  await matchApply($, id, cur => (cur.status === 'live' ? { ...cur, lease: { owner, at: t } } : cur))
}

/**
 * One second of a live match, in every session: the clock moves, opponent
 * commits and bell warnings show wherever the player is working, and a result
 * finished elsewhere is announced here once. The session holding the lease
 * also refreshes it, counts commits and rings the bell; another session takes
 * the lease over when it goes stale.
 */
async function tick($: $, onEvent: (text: string) => void) {
  const t = await $.clock.now()
  await update($, now, () => t)
  const m = await storeGet<Match | null>($, K.match, null)
  if (!m || !Array.isArray(m.plan)) {
    await update($, match, () => null)
    return
  }
  if (m.status !== 'live') {
    await update($, match, () => m)
    if (lastSeenLive === m.id && !warned.has(`${m.id}:result`)) {
      warned.add(`${m.id}:result`)
      onEvent(resultLine(m))
    }
    return
  }
  if (m.kind !== 'practice') return
  lastSeenLive = m.id
  // A match the history already holds is finished; converge on that result.
  const hist = await storeGet<Match[]>($, K.history, [])
  const prev = hist.find(x => x.id === m.id)
  if (prev) {
    await save($, K.match, prev)
    await update($, match, () => prev)
    return
  }
  await update($, match, () => m)

  for (const p of m.plan) {
    if (p.at > lastOppToast && p.at <= t && t - p.at < 5_000) onEvent(`${m.opp.handle} +${p.points} · ${p.category}`)
  }
  lastOppToast = Math.max(lastOppToast, t)
  const left = Math.ceil((m.deadline - t) / 1000)
  for (const [mark, text] of BELL_MARKS) {
    const k = `${m.id}:${mark}`
    if (mark === 600 && m.hours < 1) continue
    if (left <= mark && left > mark - 30 && !warned.has(k)) {
      warned.add(k)
      onEvent(text)
    }
  }

  if (belling) return
  const mineLease = m.lease.owner === owner
  if (!mineLease && t - m.lease.at < LEASE_STALE) return
  if (!mineLease || t - m.lease.at > 10_000) await keepLease($, m.id)
  if (t >= m.deadline) {
    await bell($, onEvent)
    return
  }
  if (Math.floor(t / 1000) % 10 === 0) await syncMatch($)
}

/**
 * The bell, once per match. Single-flight in this session; idempotent across
 * sessions (a match already in the history converges on that result). It keeps
 * the lease alive while it works, waits for any scan in flight, runs a fresh
 * forced scan, and waits (up to about two minutes) for in-window commits
 * another session is still judging, so commits authored before the deadline
 * count. Only commits count: uncommitted work scores nothing.
 */
async function bell($: $, onEvent: (text: string) => void, isForfeit = false): Promise<Match | null> {
  if (belling) return belling
  belling = ringBell($, onEvent, isForfeit)
  try {
    return await belling
  } finally {
    belling = null
  }
}

/** Waits until no scan is in flight in this session (a settled scan may chain one more). */
async function settleScans() {
  for (let i = 0; i < 20 && scanning; i++) await scanning.catch(() => null)
}

function waitMs($: $, ms: number) {
  return new Promise<void>(resolve => {
    $.clock.after(ms, () => resolve())
  })
}

async function ringBell($: $, onEvent: (text: string) => void, isForfeit: boolean): Promise<Match | null> {
  const first = await storeGet<Match | null>($, K.match, null)
  if (!first || first.status !== 'live' || !Array.isArray(first.plan)) return null
  const hist0 = await storeGet<Match[]>($, K.history, [])
  const prev = hist0.find(x => x.id === first.id)
  if (prev) {
    await save($, K.match, prev)
    await update($, match, () => prev)
    return prev
  }
  await keepLease($, first.id)
  let pending: Promise<unknown> = Promise.resolve()
  const keeper = $.clock.every(5000, () => {
    pending = keepLease($, first.id)
  })
  try {
    if (!isForfeit) {
      await settleScans()
      let r = await runScan($, true).catch(() => null)
      const giveUp = (await $.clock.now()) + 130_000
      const waiting = () => (r?.claimed ?? []).some(c => c.authoredAt >= first.startAt && c.authoredAt <= first.deadline)
      while (waiting() && (await $.clock.now()) < giveUp) {
        await waitMs($, 5000)
        await settleScans()
        r = await runScan($, true).catch(() => null)
      }
      await syncMatch($)
    }
  } finally {
    keeper.cancel()
    await pending.catch(() => null)
  }
  stopTicker?.()
  stopTicker = null
  const t = await $.clock.now()
  const hist = await storeGet<Match[]>($, K.history, [])
  const m = await storeGet<Match | null>($, K.match, null)
  if (!m || m.id !== first.id) return m
  const done0 = hist.find(x => x.id === m.id)
  if (done0 || m.status !== 'live') {
    const fin = done0 ?? m
    await save($, K.match, fin)
    await update($, match, () => fin)
    return fin
  }
  const oppPoints = oppAt(m.plan, isForfeit ? t : m.deadline, m.deadline)
  const status: Match['status'] = isForfeit ? 'forfeit' : resultOf(m.myPoints, oppPoints)
  const rec = await storeGet<Record3>($, K.record, { w: 0, l: 0, d: 0 })
  const before = await storeGet($, K.rating, START_RATING)
  const result = status === 'won' ? 1 : status === 'draw' ? 0.5 : 0
  const after = status === 'void' ? before : elo(before, m.opp.rating, result, rec.w + rec.l + rec.d)
  const done: Match = {
    ...m,
    oppPoints,
    status,
    ratingBefore: before,
    ratingAfter: after,
    endedAt: t,
    chat: [...m.chat, { at: t, who: m.opp.handle, text: status === 'won' ? 'gg, well played' : 'gg' }],
  }
  // The history is the commit point: written first, so a second bell converges on this result.
  const nextHist = [done, ...hist.filter(x => x.id !== done.id)].slice(0, 30)
  await save($, K.history, nextHist)
  await save($, K.match, done)
  if (status !== 'void') {
    const nextRec = { w: rec.w + (result === 1 ? 1 : 0), l: rec.l + (result === 0 ? 1 : 0), d: rec.d + (result === 0.5 ? 1 : 0) }
    await save($, K.record, nextRec)
    await save($, K.rating, after)
    await update($, record, () => nextRec)
    await update($, rating, () => after)
  }
  await update($, history, () => nextHist)
  await update($, match, () => done)
  warned.add(`${done.id}:result`)
  onEvent(resultLine(done))
  return done
}

async function sendChat($: $, text: string) {
  // The box empties on Send whatever happens next.
  await update($, chatDraft, () => '')
  if ((await read($, settings)).surfaces.chat !== 'on') return false
  const m = await storeGet<Match | null>($, K.match, null)
  const msg = clean(text).trim().slice(0, 280)
  if (!m || !msg || !Array.isArray(m.plan)) return false
  const t = await $.clock.now()
  const me = (await read($, settings)).handle
  const line: ChatLine = { at: t, who: me, text: msg }
  await matchApply($, m.id, cur => ({ ...cur, chat: [...cur.chat, line] }))
  if (m.status === 'live') {
    const reply = pick(Math.random, REPLIES)
    $.clock.after(1500 + Math.random() * 4000, () => void botReply($, m.id, m.opp.handle, reply))
  }
  return true
}

async function botReply($: $, id: string, who: string, text: string) {
  const t = await $.clock.now()
  await matchApply($, id, cur => ({ ...cur, chat: [...cur.chat, { at: t, who, text }] }))
}

/**
 * A past session raced against a bot over the same span: your real scored
 * commits at their real times, the bot seeded by the session id. Unrated.
 */
async function replay($: $, s: PastSession, run: BacktestRun) {
  const r = rng(hash(s.id))
  const mine = await storeGet($, K.rating, START_RATING)
  const rival = pick(r, RIVALS)
  const hours = Math.max(0.25, (s.endAt - s.startAt) / 3_600_000)
  const pace = Math.max(6, (run.points / hours) * (0.75 + r() * 0.5))
  const plan = botPlan(hash(s.id), s.startAt, s.endAt, pace)
  const oppPoints = oppAt(plan, s.endAt, s.endAt)
  const m: Match = {
    id: `r-${s.id}`,
    kind: 'replay',
    hours,
    startAt: s.startAt,
    deadline: s.endAt,
    opp: { handle: rival.handle, rating: Math.round(mine + (r() - 0.5) * 100), pace },
    plan,
    myPoints: run.points,
    oppPoints,
    feed: run.commits.map(c => ({ at: c.authoredAt, who: 'me', points: c.points, category: c.category, title: c.title })),
    counted: run.commits.map(c => c.pid),
    chat: [],
    status: resultOf(run.points, oppPoints),
    ratingBefore: mine,
    ratingAfter: mine,
    lease: { owner, at: await $.clock.now() },
    endedAt: s.endAt,
    label: s.title,
  }
  await save($, K.match, m)
  await update($, match, () => m)
  return m
}

async function clearMatch($: $) {
  const m = await storeGet<Match | null>($, K.match, null)
  if (m && m.status === 'live') return false
  await $.store.delete(K.match)
  await update($, match, () => null)
  return true
}

// ================================================================== CALIBRATION

type CalRow = {
  sha: string
  repo: string
  title: string
  size: string
  runs: { base: number; craft: string; points: number; category: string }[]
  failed: number
  firstError?: string
}

/**
 * Scores real commits several times each with the current judge (no cache)
 * and reports the spread, the distribution and how often craft fires; with
 * `pairs`, compares squash merges against the sum of their branch commits.
 * Exposed to Claude as the mcp__ccsr__calibrate tool. Runs on the player's plan.
 */
async function calibrate($: $, count: number, runs: number, days: number, pairs: boolean) {
  const t = await $.clock.now()
  const model = (await read($, settings)).model
  const from = t - days * 86_400_000
  const pool: { root: string; raw: RawCommit; listed: RawCommit[] }[] = []
  const squashPairs: { root: string; sq: RawCommit; branch: RawCommit[]; listed: RawCommit[] }[] = []
  for (const root of await getRepos($)) {
    try {
      const emails = await myEmails($, root)
      const listed = await listCommits($, root, emails, from - 14 * 86_400_000, t)
      await withPoints($, listed)
      const locals = listed.filter(c => !isSquashCommit(c))
      const consumed = new Set<string>()
      for (const raw of [...listed].sort((a, b) => a.authoredAt - b.authoredAt)) {
        if (raw.authoredAt < from) continue
        if (isSquashCommit(raw)) {
          // The same evidence rules the scan uses decide which branch commits a squash stands for.
          const shas = await branchOf($, root, raw, locals, consumed)
          const branch = shas ? locals.filter(c => shas.includes(c.sha)) : []
          if (branch.length >= 2 && branch.length <= 8) squashPairs.push({ root, sq: raw, branch, listed })
          continue
        }
        if (raw.files.length && !raw.files.every(isNoise) && raw.added + raw.deleted > 0) pool.push({ root, raw, listed })
      }
    } catch {}
  }
  // Spread across sizes: sort by lines changed and take evenly spaced commits.
  pool.sort((a, b) => a.raw.added + a.raw.deleted - (b.raw.added + b.raw.deleted))
  const n = Math.min(count, pool.length)
  const chosen = Array.from({ length: n }, (_, i) => pool[Math.floor((i * pool.length) / Math.max(1, n))]!).filter(Boolean)

  const rows: CalRow[] = []
  const queue = [...chosen]
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift()!
      const text = await digest($, item.root, item.raw, item.listed)
      const size = `+${item.raw.added} -${item.raw.deleted} in ${item.raw.files.length} files`
      const row: CalRow = { sha: item.raw.sha.slice(0, 8), repo: repoName(item.root), title: item.raw.title.slice(0, 70), size, runs: [], failed: 0 }
      for (let k = 0; k < runs; k++) {
        try {
          const v = await judge($, model, text, item.raw.title, size)
          row.runs.push({ base: v.base, craft: v.craft, points: stepCraft(v.base, v.craft), category: v.category })
        } catch (err) {
          row.failed++
          row.firstError = row.firstError || clean((err as Error).message)
        }
      }
      rows.push(row)
      await update($, labNote, () => `Calibration: ${rows.length} of ${chosen.length} commits scored`)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])

  const pairOut: { title: string; squash: number; branchSum: number; branch: number[]; error?: string }[] = []
  if (pairs) {
    for (const p of squashPairs.slice(0, 5)) {
      try {
        const size = `+${p.sq.added} -${p.sq.deleted} in ${p.sq.files.length} files`
        const sqv = await judge($, model, await digest($, p.root, p.sq, []), p.sq.title, size)
        const parts: number[] = []
        for (const c of [...p.branch].sort((a, b) => a.authoredAt - b.authoredAt)) {
          const v = await judge($, model, await digest($, p.root, c, p.listed), c.title, `+${c.added} -${c.deleted} in ${c.files.length} files`)
          parts.push(stepCraft(v.base, v.craft))
        }
        pairOut.push({ title: p.sq.title.slice(0, 70), squash: stepCraft(sqv.base, sqv.craft), branchSum: parts.reduce((a, b) => a + b, 0), branch: parts })
      } catch (err) {
        pairOut.push({ title: p.sq.title.slice(0, 70), squash: -1, branchSum: -1, branch: [], error: clean((err as Error).message) })
      }
    }
  }

  const all = rows.flatMap(r => r.runs)
  const dist: Record<string, number> = {}
  for (const v of all) dist[v.points] = (dist[v.points] ?? 0) + 1
  const multi = rows.filter(r => r.runs.length > 1)
  const stable = multi.filter(r => new Set(r.runs.map(v => v.points)).size === 1).length
  const spreadSteps = multi.map(r => {
    const idx = r.runs.map(v => [0, 1, 2, 3, 5, 8, 13, 21].indexOf(v.points))
    return Math.max(...idx) - Math.min(...idx)
  })
  const spreadPoints = multi.map(r => Math.max(...r.runs.map(v => v.points)) - Math.min(...r.runs.map(v => v.points)))
  const failedRuns = rows.reduce((n, r) => n + r.failed, 0)
  const crafts: Record<string, number> = {}
  for (const v of all) crafts[v.craft] = (crafts[v.craft] ?? 0) + 1
  const summary = {
    model,
    rubric: RUBRIC,
    commits: rows.length,
    runsPerCommit: runs,
    identicalAcrossRuns: `${stable} of ${multi.length}`,
    failedRuns,
    firstError: rows.find(r => r.firstError)?.firstError ?? '',
    maxSpreadSteps: Math.max(0, ...spreadSteps),
    maxSpreadPoints: Math.max(0, ...spreadPoints),
    meanSpreadSteps: spreadSteps.length ? Number((spreadSteps.reduce((a, b) => a + b, 0) / spreadSteps.length).toFixed(2)) : 0,
    distribution: dist,
    craft: crafts,
    meanPoints: all.length ? Number((all.reduce((a, v) => a + v.points, 0) / all.length).toFixed(2)) : 0,
  }
  await update($, labNote, () => `Calibration done: ${summary.identicalAcrossRuns} commits scored the same every run, mean ${summary.meanPoints} points, max spread ${summary.maxSpreadPoints} points${failedRuns ? `, ${failedRuns} failed runs (${summary.firstError})` : ''}.`)
  return { summary, pairs: pairOut, rows }
}

// ================================================================== SERVER
// The CCSR server (docs/api.md). Every request goes through api(); scores wait
// in an outbox in the store until the server has them, so a commit made
// offline still lands once it's back.

const SERVER0: ServerConfig = { url: DEFAULT_SERVER, token: null, handle: null }
let flushing: Promise<void> | null = null

async function serverCfg($: $) {
  return { ...SERVER0, ...(await storeGet<Partial<ServerConfig>>($, K.server, {})) }
}

/** One request: `{ status, json }`, status 0 when the server couldn't be reached. */
async function api($: $, method: string, path: string, body?: unknown, as: { url?: string; token?: string | null } = {}): Promise<{ status: number; json: unknown }> {
  const cfg = { ...(await serverCfg($)), ...as }
  // Which mod and Claude Code this is: below the server's floor, ranked play is refused (docs/api.md, "Versions").
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json', 'x-ccsr-mod': VERSION }
  const claude = await claudeVersion($)
  if (claude) headers['x-ccsr-claude'] = claude
  if (cfg.token) headers.authorization = `Bearer ${cfg.token}`
  let res: { status: number; text: string; headers?: Record<string, string> }
  try {
    res = await $.http.fetch(`${cfg.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (err) {
    await update($, link, l => ({ ...l, online: false, note: `Can't reach ${cfg.url}: ${clean((err as Error).message).slice(0, 100)}` }))
    return { status: 0, json: null }
  }
  let json: unknown = null
  try {
    json = res.text ? JSON.parse(res.text) : null
  } catch {
    json = null
  }
  // A proxy's error page means the server itself isn't answering.
  const reached = res.status < 502 || res.status > 504
  await update($, link, l => (reached ? (l.online === true && !l.note ? l : { ...l, online: true, note: '' }) : { ...l, online: false, note: `The server answered ${res.status}` }))
  const latest = res.headers?.['x-ccsr-latest']
  const min = res.headers?.['x-ccsr-min']
  if (latest && min) await noteRelease($, latest, min)
  return { status: res.status, json }
}

/** This session's Claude Code version for x-ccsr-claude, or null where the API doesn't say. */
async function claudeVersion($: $) {
  try {
    const v = await $.session.version()
    return v.base ?? v.version
  } catch {
    return null
  }
}

/** The server's release line, from its headers: keep it, and toast once per release that an update is out, between matches. */
async function noteRelease($: $, latest: string, min: string) {
  const l = await read($, link)
  if (l.release?.latest !== latest || l.release?.min !== min) await update($, link, x => ({ ...x, release: { latest, min } }))
  if (standing({ latest, min }) === 'current') return
  if ((await rankedShared($)).phase !== 'idle') return
  if ((await storeGet<string>($, K.updateSeen, '')) === latest) return
  await save($, K.updateSeen, latest)
  await ambient($, MOD.updateOut(latest))
}

/**
 * A 426 from the queue or a ready check: true when it was one. A mod below the
 * floor keeps the release line, and the Ranked box shows the update line and
 * button; a Claude Code below its floor gets the server's line as the note.
 */
async function refusedForUpdate($: $, r: { status: number; json: unknown }) {
  if (r.status !== 426) return false
  const u = (r.json as { update?: { what: 'mod' | 'claude'; min: string; latest: string | null } } | null)?.update
  if (u?.what === 'mod') await update($, link, l => ({ ...l, release: { latest: u.latest ?? u.min, min: u.min }, note: '' }))
  else await update($, link, l => ({ ...l, note: errorOf(r.json)?.message ?? 'Update Claude Code to play ranked.' }))
  return true
}

/**
 * Update from the install repo: run the two commands where the mods API runs
 * processes (the terminal), or copy them for a terminal (the desktop app). The
 * new version loads once Claude Code restarts.
 */
async function updateMod($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const say = (text: string) => update($, link, l => ({ ...l, updateNote: text }))
  await say(MOD.updating)
  try {
    for (const argv of UPDATE_ARGV) {
      const r = await $.process.run(argv, { timeoutMs: 120_000 })
      if (r.exitCode !== 0) throw new Error(`exit ${r.exitCode}`)
    }
    await say(MOD.updated)
    await ambient($, MOD.updated, 'match')
  } catch {
    // No processes here, no claude on the PATH, or the update failed: hand over the command instead.
    const c = await $.ui.copy({ text: UPDATE_COMMAND, surface }).catch(() => ({ isCopied: false }))
    await say(c.isCopied ? MOD.updateCopied : UPDATE_COMMAND)
  }
}

async function saltOf($: $) {
  const have = await storeGet<string>($, K.salt, '')
  if (have) return have
  const salt = crypto.randomUUID()
  await save($, K.salt, salt)
  return salt
}

// ------------------------------------------------------------------ accounts and installs
// A handle is one player on the server with one token per install (a Claude
// Code config dir on some machine). The token is the only thing this install
// needs, and it is never dropped on a doubt: only the server saying the install
// was removed (`token_revoked`) forgets it. Three ways back in when it's gone:
// the machine's keyring (~/.ccsr/keyring.json, read by every config dir on the
// machine), a link code from another install, or the account's recovery key.

/** The keyring's path, or null where there's no home directory to keep it in. */
async function keyringPath($: $) {
  const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
  return home ? `${home.replace(/[\\/]+$/, '')}/.ccsr/keyring.json` : null
}

/** The keyring, or an empty one when it's missing, unreadable, or there's no fs here (tests). */
async function readKeyring($: $): Promise<Keyring> {
  const empty: Keyring = { v: 1, servers: {} }
  try {
    const path = await keyringPath($)
    if (!path) return empty
    const k = JSON.parse(String(await $.fs.read(path))) as Keyring
    return k && k.v === 1 && k.servers && typeof k.servers === 'object' ? k : empty
  } catch {
    return empty
  }
}

/** Sets or clears this server's entry. Best effort: a keyring that can't be written never stops a sign-in. */
async function writeKeyring($: $, url: string, entry: Keyring['servers'][string] | null) {
  try {
    const path = await keyringPath($)
    if (!path) return
    const k = await readKeyring($)
    if (entry) k.servers[url] = entry
    else delete k.servers[url]
    await $.fs.write(path, JSON.stringify(k, null, 2) + '\n')
  } catch {
    // No fs on this surface, or the home directory isn't writable.
  }
}

/** What Settings calls this install: its config dir, with the home directory as ~. */
async function installLabel($: $) {
  const home = (await $.env.get('HOME').catch(() => undefined)) ?? ''
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)) || '~/.claude'
  return (home && dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir).slice(0, 64)
}

/**
 * Who we are and the season's judge, from the server, into this session's
 * link. With no token, the keyring may sign this install in on its own.
 */
async function refreshAccount($: $) {
  const cfg = await serverCfg($)
  const season = await api($, 'GET', '/season')
  if (season.status === 200) await update($, link, l => ({ ...l, season: (season.json as { season: ApiSeason }).season }))
  if (!cfg.token) {
    await linkFromKeyring($)
    return
  }
  const me = await api($, 'GET', '/me')
  if (me.status === 200) {
    const j = me.json as { player: ApiPlayer; account?: ApiAccount }
    await update($, link, l => ({ ...l, me: j.player, account: j.account ?? null, unknownToken: false }))
    if (j.account) await adoptSalt($, j.account.salt)
    // Accounts from before the keyring: put this one in it, so the machine's other config dirs find it.
    const k = await readKeyring($)
    if (!k.servers[cfg.url]) await writeKeyring($, cfg.url, { handle: j.player.handle, token: cfg.token, recovery_key: cfg.recoveryKey ?? null })
    await loadInstalls($)
    return
  }
  if (me.status !== 401) return
  if (errorOf(me.json)?.code === 'token_revoked') {
    await forgetHere($, ACCOUNT.removed)
    return
  }
  // Unknown is not gone: a wrong server address or a restored database. Keep the token and offer the ways in.
  await update($, link, l => ({ ...l, me: null, unknownToken: true, note: ACCOUNT.unknown }))
}

/** A new config dir on a machine that already plays: link it with the keyring's token, no code needed. */
async function linkFromKeyring($: $) {
  if (await storeGet<boolean>($, K.optOut, false)) return
  const cfg = await serverCfg($)
  const entry = (await readKeyring($)).servers[cfg.url]
  if (!entry?.token) return
  const code = await api($, 'POST', '/accounts/link-code', {}, { token: entry.token })
  if (code.status === 401) {
    if (errorOf(code.json)?.code === 'token_revoked') await writeKeyring($, cfg.url, null)
    return
  }
  if (code.status !== 201) return
  const r = await api($, 'POST', '/accounts/link', { code: (code.json as { code: string }).code, install: await installLabel($) }, { token: null })
  if (r.status !== 201) return
  await signedIn($, r.json as SignInReply, entry.recovery_key ?? null)
  await update($, link, l => ({ ...l, note: ACCOUNT.autoLinked((r.json as SignInReply).player.handle) }))
}

type SignInReply = { token: string; player: ApiPlayer; salt: string | null; has_recovery_key: boolean; recovery_key?: string }

/** Every way in ends here: keep the token, take the account's salt, write the keyring, send this week's scores. */
async function signedIn($: $, j: SignInReply, knownKey: string | null = null) {
  const cfg = await serverCfg($)
  const handle = j.player.handle
  const recoveryKey = j.recovery_key ?? knownKey ?? (cfg.handle === handle ? (cfg.recoveryKey ?? null) : null)
  await save($, K.server, { ...cfg, token: j.token, handle, recoveryKey })
  await $.store.delete(K.optOut)
  await saveSettings($, { handle })
  await update($, link, l => ({ ...l, me: j.player, note: '', unknownToken: false, confirmRemove: false, recoveryFresh: !!j.recovery_key, linkCode: null }))
  await adoptSalt($, j.salt)
  await writeKeyring($, cfg.url, { handle, token: j.token, recovery_key: recoveryKey })
  await refreshAccount($)
  // This week's scored commits go up with the account, so the Grind starts where the player already is.
  // Last, so what the outbox says (a refused score) is the note left on screen.
  const list = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const since = periodStart('week', await $.clock.now())
  await enqueue(
    $,
    list.filter(c => c.authoredAt >= since && !c.matchOnly),
  )
  await flushOutbox($)
}

/**
 * Every install of an account hashes repo names with the account's salt, so
 * the server sees one repo and one commit identity whichever install sent it.
 * An account from before the server kept salts gets this install's.
 */
async function adoptSalt($: $, serverSalt: string | null) {
  const local = await saltOf($)
  let salt = serverSalt
  if (!salt) {
    const r = await api($, 'POST', '/me/salt', { salt: local })
    if (r.status !== 200) return
    salt = (r.json as { salt: string }).salt
  }
  if (salt === local) return
  await save($, K.salt, salt)
  // Scores still waiting were hashed with the old salt: hash them again.
  const box = await storeGet<OutboxItem[]>($, K.outbox, [])
  if (box.length === 0) return
  const pids = new Set(box.map(b => b.pid))
  const rows = (await storeGet<ScoredCommit[]>($, K.ledger, [])).filter(c => pids.has(c.pid))
  await save($, K.outbox, [])
  await enqueue($, rows)
}

function signInProblem(r: { status: number; json: unknown }) {
  if (r.status === 0) return "Can't reach the server."
  return errorOf(r.json)?.message ?? `The server answered ${r.status}.`
}

/** Joins with a handle. Returns a problem to show, or '' when joined. */
async function signup($: $, raw: string): Promise<string> {
  const handle = raw.trim().toLowerCase()
  const problem = handleProblem(handle)
  if (problem) {
    await update($, link, l => ({ ...l, note: problem }))
    return problem
  }
  const s = await read($, settings)
  let tz = 'UTC'
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    tz = 'UTC'
  }
  const r = await api($, 'POST', '/accounts', { handle, grind_tracking: s.tracking, share_titles: s.share, time_zone: tz, salt: await saltOf($), install: await installLabel($) }, { token: null })
  if (r.status !== 201) {
    const why = errorOf(r.json)?.code === 'handle_taken' ? 'That handle is taken.' : signInProblem(r)
    await update($, link, l => ({ ...l, note: why }))
    return why
  }
  await signedIn($, r.json as SignInReply)
  return ''
}

/** Joins the account another install is signed in to, with the code it showed. */
async function joinWithCode($: $, raw: string) {
  const code = raw.trim()
  if (!code) return
  const r = await api($, 'POST', '/accounts/link', { code, install: await installLabel($) }, { token: null })
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  await signedIn($, r.json as SignInReply)
}

/** Back in with the account's recovery key. */
async function recoverWith($: $, raw: string) {
  const key = raw.trim()
  if (!key) return
  const r = await api($, 'POST', '/accounts/recover', { recovery_key: key, install: await installLabel($) }, { token: null })
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  await signedIn($, r.json as SignInReply, key)
}

/** A code another install can join with, shown in Settings for 10 minutes. */
async function makeLinkCode($: $) {
  const r = await api($, 'POST', '/accounts/link-code', {})
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  const j = r.json as { code: string; expires_at: string }
  await update($, link, l => ({ ...l, linkCode: { code: j.code, expiresAt: j.expires_at } }))
}

/** A new recovery key; the old one stops working. Shown until copied. */
async function newRecoveryKey($: $) {
  const r = await api($, 'POST', '/me/recovery', {})
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  const key = (r.json as { recovery_key: string }).recovery_key
  const cfg = await serverCfg($)
  await save($, K.server, { ...cfg, recoveryKey: key })
  if (cfg.token) await writeKeyring($, cfg.url, { handle: cfg.handle, token: cfg.token, recovery_key: key })
  await update($, link, l => ({ ...l, recoveryFresh: true }))
  await refreshAccount($)
}

async function copyRecoveryKey($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const key = (await serverCfg($)).recoveryKey
  if (!key) return
  const c = await $.ui.copy({ text: key, surface }).catch(() => ({ isCopied: false }))
  await update($, link, l => ({ ...l, recoveryFresh: false, note: c.isCopied ? ACCOUNT.copied : key }))
}

async function loadInstalls($: $) {
  const r = await api($, 'GET', '/me/installs')
  if (r.status === 200) await update($, link, l => ({ ...l, installs: (r.json as { installs: ApiInstall[] }).installs }))
}

/** Removes another install of this account. */
async function removeInstall($: $, id: number) {
  const r = await api($, 'DELETE', `/me/installs/${id}`)
  if (r.status === 200) await update($, link, l => ({ ...l, installs: (r.json as { installs: ApiInstall[] }).installs }))
  else await update($, link, l => ({ ...l, note: signInProblem(r) }))
}

/** Remove this install: the first press warns, the second removes it on the server, then here. */
async function removeThisInstall($: $) {
  const l = await read($, link)
  if (!l.confirmRemove) {
    await update($, link, x => ({ ...x, confirmRemove: true, note: ACCOUNT.removeWarn(l.me?.handle ?? 'your account') }))
    return
  }
  const id = l.account?.install.id
  const r = id ? await api($, 'DELETE', `/me/installs/${id}`) : { status: 401, json: { error: { code: 'token_revoked' } } }
  if (r.status === 200 || (r.status === 401 && errorOf(r.json)?.code === 'token_revoked')) {
    await save($, K.optOut, true)
    await forgetHere($, '')
    return
  }
  await update($, link, x => ({ ...x, confirmRemove: false, note: signInProblem(r) }))
}

/** Forgets this install's sign-in, here and in the keyring when the keyring holds this same token. */
async function forgetHere($: $, note: string) {
  const cfg = await serverCfg($)
  const k = await readKeyring($)
  if (cfg.token && k.servers[cfg.url]?.token === cfg.token) await writeKeyring($, cfg.url, null)
  await save($, K.server, { ...cfg, token: null, handle: null })
  await save($, K.outbox, [])
  await update($, link, () => ({ ...LINK0, online: null, note }))
}

/**
 * Points the mod at another server address. The account for the old address
 * is kept under `saved`; the new address gets its own saved account, or, when
 * the current token works there too (the same server under a new name, like
 * Railway's address moving to api.ccsr.gg), keeps the current one.
 */
async function setServerUrl($: $, url: string) {
  const u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s]+$/.test(u)) return
  const cfg = await serverCfg($)
  if (u === cfg.url) return
  const saved: Record<string, SavedAccount> = { ...(cfg.saved ?? {}) }
  if (cfg.token) saved[cfg.url] = { token: cfg.token, handle: cfg.handle, recoveryKey: cfg.recoveryKey ?? null }
  let next: SavedAccount | null = saved[u] ?? null
  if (!next && cfg.token && (await api($, 'GET', '/me', undefined, { url: u })).status === 200) next = saved[cfg.url]!
  delete saved[u]
  await save($, K.server, { url: u, token: next?.token ?? null, handle: next?.handle ?? null, recoveryKey: next?.recoveryKey ?? null, saved })
  await update($, link, () => ({ ...LINK0 }))
  await refreshAccount($)
}

/** Puts scored commits in the outbox, once each, while there's an account to send them for. */
async function enqueue($: $, rows: ScoredCommit[]) {
  const cfg = await serverCfg($)
  if (!cfg.token || rows.length === 0) return
  const s = await read($, settings)
  const salt = await saltOf($)
  const sent = new Set(await storeGet<string[]>($, K.sent, []))
  const t = await $.clock.now()
  const fresh: OutboxItem[] = []
  for (const c of rows) if (!sent.has(c.pid)) fresh.push({ pid: c.pid, body: await scoreBody(c, salt, s.share), tries: 0, nextAt: t })
  if (fresh.length === 0) return
  const box = await storeGet<OutboxItem[]>($, K.outbox, [])
  const have = new Set(box.map(b => b.pid))
  const next = [...box, ...fresh.filter(f => !have.has(f.pid))]
  await save($, K.outbox, next)
  await update($, link, l => ({ ...l, outbox: next.length }))
}

/**
 * Sends what's due in the outbox. Single-flight per session: a call made while
 * a flush runs gets another one after it, since that flush may have read the
 * outbox before this caller's scores went in. Other sessions sending the same
 * score just get a duplicate.
 */
function flushOutbox($: $): Promise<void> {
  if (flushing) return flushing.then(() => flushOutbox($))
  flushing = flushOnce($).finally(() => (flushing = null))
  return flushing
}

async function flushOnce($: $) {
  const t = await $.clock.now()
  const due = (await storeGet<OutboxItem[]>($, K.outbox, [])).filter(b => b.nextAt <= t).slice(0, 25)
  const done = new Set<string>()
  const retry = new Map<string, OutboxItem>()
  const refused: string[] = []
  let reply: ApiScoreReply | null = null
  for (const item of due) {
    const r = await api($, 'POST', '/scores', item.body)
    if (r.status >= 200 && r.status < 300) {
      done.add(item.pid)
      reply = r.json as ApiScoreReply
      continue
    }
    if (retryable(r.status)) {
      retry.set(item.pid, { ...item, tries: item.tries + 1, nextAt: t + backoffMs(item.tries), lastError: errorOf(r.json)?.code ?? String(r.status) })
      if (r.status === 0) break // offline: the rest wait too
      continue
    }
    // The server refused this score for good (wrong judge, too old, malformed): it stays in the local Grind only.
    done.add(item.pid)
    refused.push(`${errorOf(r.json)?.code ?? r.status} on ${item.body.authored_at.slice(0, 10)}`)
  }
  // Re-read before writing: another session may have added to the outbox meanwhile.
  const box = (await storeGet<OutboxItem[]>($, K.outbox, [])).filter(b => !done.has(b.pid)).map(b => retry.get(b.pid) ?? b)
  await save($, K.outbox, box)
  if (done.size) {
    const sent = await storeGet<string[]>($, K.sent, [])
    await save($, K.sent, [...sent.filter(p => !done.has(p)), ...done].slice(-3000))
  }
  await update($, link, l => ({
    ...l,
    outbox: box.length,
    grind: reply ? reply.grind : l.grind,
    grindRank: reply ? reply.grind_week_rank : l.grindRank,
    note: refused.length ? `The server refused ${refused.length} score${refused.length === 1 ? '' : 's'} (${refused.slice(0, 2).join(', ')}); they count here only.` : l.note,
  }))
}

// ------------------------------------------------------------------ ranked
// The queue, the ready check and the live match, by polling (mods can't hold a
// socket): GET /queue every 2 s while queued or offered, the match's events
// every 2 s while it runs. Every session that sees an active phase polls; the
// server is the source of truth, so two sessions polling agree.

const RANKED0: RankedShared = { phase: 'idle', matchId: null, lengths: [1, 3], since: 0 }
let stopRankedPoll: (() => void) | null = null
const rankedWarned = new Set<string>()

async function rankedShared($: $) {
  return { ...RANKED0, ...(await storeGet<Partial<RankedShared>>($, K.ranked, {})) }
}

async function setRanked($: $, patch: Partial<RankedShared>) {
  const next = { ...(await rankedShared($)), ...patch }
  await save($, K.ranked, next)
  return next
}

function startRankedPoll($: $) {
  if (stopRankedPoll) return
  const timer = $.clock.every(2000, () => void pollRanked($).catch(err => $.ui.log(`CCSR ranked: ${(err as Error).message}`)))
  stopRankedPoll = () => timer.cancel()
}

function stopPolling() {
  stopRankedPoll?.()
  stopRankedPoll = null
}

async function pollRanked($: $) {
  const sh = await rankedShared($)
  if (sh.phase === 'queued' || sh.phase === 'offered') return pollQueue($, sh)
  if (sh.phase === 'live' && sh.matchId) return pollMatch($, sh.matchId)
  stopPolling()
}

async function pollQueue($: $, sh: RankedShared) {
  const r = await api($, 'GET', '/queue')
  if (r.status !== 200) return
  const q = r.json as ApiQueueState
  await update($, link, l => ({ ...l, queue: q }))
  const rel = (await read($, link)).release
  if (q.cancelled?.reason === 'update_required') {
    if (rel) await ambient($, MOD.updateNeeded(rel.min, VERSION), 'match')
  } else if (q.cancelled) await ambient($, q.cancelled.reason === 'you_expired' ? "You didn't accept. Out of the queue." : `${q.cancelled.reason === 'opponent_declined' ? 'They declined' : "They didn't accept"}. Back in the queue.`, 'match')
  if (q.status === 'offered' && q.offer) {
    if (sh.phase !== 'offered' || sh.matchId !== q.offer.match_id) {
      await setRanked($, { phase: 'offered', matchId: q.offer.match_id })
      // Approved line (docs/copy.md): the match-found toast, which no setting turns off.
      await ambient($, LINES.found, 'ready', 10_000)
      await ring($, 'chime')
    }
    await refreshStatus($)
    return
  }
  if (q.status === 'queued') {
    if (sh.phase !== 'queued') await setRanked($, { phase: 'queued', matchId: null })
    await refreshStatus($)
    return
  }
  // Idle: the offer went live (both accepted), or we left or were dropped.
  if (sh.matchId) {
    const m = await api($, 'GET', `/matches/${sh.matchId}`)
    const summary = m.status === 200 ? (m.json as { match: ApiMatchSummary }).match : null
    if (summary && (summary.status === 'live' || summary.status === 'grace')) return enterLive($, summary)
  }
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, queue: null }))
  stopPolling()
}

async function enterLive($: $, summary: ApiMatchSummary) {
  await setRanked($, { phase: 'live', matchId: summary.id })
  await update($, link, l => ({ ...l, queue: null, ranked: { id: summary.id, summary, events: l.ranked?.id === summary.id ? l.ranked.events : [], cursor: l.ranked?.id === summary.id ? l.ranked.cursor : 0, polledAt: 0 } }))
  startRankedPoll($)
  await pollMatch($, summary.id)
}

async function pollMatch($: $, id: string) {
  const cur = (await read($, link)).ranked
  const cursor = cur && cur.id === id ? cur.cursor : 0
  const r = await api($, 'GET', `/matches/${id}/events?cursor=${cursor}`)
  if (r.status !== 200) return
  const page = r.json as { events: RankedMatch['events']; cursor: number; match: ApiMatchSummary }
  const t = await $.clock.now()
  await update($, link, l => {
    const have = l.ranked && l.ranked.id === id ? l.ranked.events : []
    return { ...l, ranked: { id, summary: page.match, events: mergeEvents(have, page.events), cursor: page.cursor, polledAt: t } }
  })
  const s = page.match
  if (s.status === 'live' && s.deadline) {
    const left = Date.parse(s.deadline) - t
    for (const [mark, text] of [
      [10 * 60_000, MOD.warn10],
      [60_000, MOD.warn1],
    ] as const)
      if (left <= mark && left > 0 && !rankedWarned.has(`${id}:${mark}`)) {
        rankedWarned.add(`${id}:${mark}`)
        await ambient($, text, 'match', 8000)
        if (mark === 60_000) await ring($, 'bell')
      }
    if (left <= 10 * 60_000) await checkDirty($)
  }
  if (s.status === 'finished' || s.status === 'void') {
    await setRanked($, { phase: 'done', matchId: id })
    stopPolling()
    if (!rankedWarned.has(`${id}:result`)) {
      rankedWarned.add(`${id}:result`)
      const me = (await serverCfg($)).handle ?? ''
      await ambient($, rankedResultLine(s, me), 'match', 10_000)
      const o = rankedOutcome(s, me)
      if (s.status !== 'void' && o !== 'draw') await ring($, o === 'won' ? 'win' : 'loss')
    }
    void refreshAccount($).then(() => refreshBoards($))
  }
  await refreshStatus($)
}

/** The result in one line, from the approved results table (docs/copy.md). */
function rankedResultLine(s: ApiMatchSummary, me: string) {
  const mine = s.sides.find(x => x.player.handle === me) ?? s.sides[0]
  const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
  if (s.status === 'void') return resultText('void', 'points', 0, 0)
  if (s.result === 'draw') return resultText('draw', 'points', 0, 0)
  return resultText(s.winner === me ? 'won' : 'lost', s.result === 'forfeit' ? 'forfeit' : 'points', delta, seedOf(s.id))
}

async function joinQueue($: $) {
  const sh = await rankedShared($)
  if (sh.lengths.length === 0) return
  const r = await api($, 'POST', '/queue', { lengths: sh.lengths })
  if (await refusedForUpdate($, r)) return
  if (r.status !== 200) {
    await update($, link, l => ({ ...l, note: errorOf(r.json)?.message ?? (r.status === 0 ? "Can't reach the server." : `The server answered ${r.status}.`) }))
    return
  }
  await setRanked($, { phase: 'queued', matchId: null, since: await $.clock.now() })
  startRankedPoll($)
  await pollRanked($)
}

async function leaveQueue($: $) {
  await api($, 'DELETE', '/queue')
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, queue: null }))
  stopPolling()
}

async function toggleLength($: $, h: 1 | 3) {
  const sh = await rankedShared($)
  const lengths = sh.lengths.includes(h) ? sh.lengths.filter(x => x !== h) : ([...sh.lengths, h].sort() as (1 | 3)[])
  await setRanked($, { lengths })
  await update($, link, l => ({ ...l }))
}

async function acceptOffer($: $) {
  const sh = await rankedShared($)
  if (!sh.matchId) return
  const r = await api($, 'POST', `/matches/${sh.matchId}/accept`)
  // Below the floor: decline now rather than hold the opponent for the full minute.
  if (await refusedForUpdate($, r)) return declineOffer($)
  if (r.status === 200) {
    const summary = (r.json as { match: ApiMatchSummary }).match
    if (summary.status === 'live') return enterLive($, summary)
    await update($, link, l => (l.queue?.offer ? { ...l, queue: { ...l.queue, offer: { ...l.queue.offer, you_accepted: true } } } : l))
    return
  }
  // The offer closed under us: the next poll says where we stand.
  await pollRanked($)
}

async function declineOffer($: $) {
  const sh = await rankedShared($)
  if (sh.matchId) await api($, 'POST', `/matches/${sh.matchId}/decline`)
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, queue: null }))
  stopPolling()
}

async function forfeitRanked($: $) {
  await update($, forfeitAsk, () => false)
  const sh = await rankedShared($)
  if (!sh.matchId) return
  const r = await api($, 'POST', `/matches/${sh.matchId}/forfeit`)
  if (r.status === 200) await pollMatch($, sh.matchId)
}

async function sendRankedChat($: $, text: string) {
  await update($, chatDraft, () => '')
  const sh = await rankedShared($)
  const msg = clean(text).trim().slice(0, 280)
  if (!sh.matchId || !msg) return
  const r = await api($, 'POST', `/matches/${sh.matchId}/chat`, { text: msg })
  if (r.status === 200) {
    const item = (r.json as { item: ApiChatItem }).item
    await update($, link, l => (l.ranked && l.ranked.id === sh.matchId ? { ...l, ranked: { ...l.ranked, events: mergeEvents(l.ranked.events, [item]) } } : l))
  } else {
    await update($, link, l => ({ ...l, note: errorOf(r.json)?.message ?? `The server answered ${r.status}.` }))
  }
}

async function clearRanked($: $) {
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, ranked: null }))
}

// ------------------------------------------------------------------ boards and rooms

let stopChatPoll: (() => void) | null = null
let paneSeenAt = 0

/** The Ranked board's top 10, your rank, and the size of this week's Grind, for the Ranked and Grind tabs. */
async function refreshBoards($: $) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const board = await api($, 'GET', '/boards/ranked?limit=10')
  const me = cfg.handle ? await api($, 'GET', `/players/${encodeURIComponent(cfg.handle)}`) : { status: 0, json: null }
  const week = await api($, 'GET', '/boards/grind?period=week&limit=1')
  await update($, link, l => ({
    ...l,
    ladder: board.status === 200 ? (board.json as { items: ApiRankedRow[] }).items : l.ladder,
    myRank: me.status === 200 ? (me.json as { rank: number | null }).rank : l.myRank,
    grindRank: me.status === 200 ? ((me.json as { grind_rank: { week: number | null } }).grind_rank.week ?? l.grindRank) : l.grindRank,
    grindOf: week.status === 200 ? (week.json as { total: number }).total : l.grindOf,
    recent: me.status === 200 ? ((me.json as { recent_matches?: ApiRecentMatch[] }).recent_matches ?? l.recent) : l.recent,
  }))
}

/** Switches tabs, and starts or stops what the tab reads from the server. */
async function selectTab($: $, t: Tab) {
  if (t === 'ranked') roastIndex++
  await update($, tab, () => t)
  if (t === 'ranked' || t === 'grind') void refreshBoards($)
  if (t === 'chat') {
    paneSeenAt = await $.clock.now()
    startChatPoll($)
    await pollRooms($)
    await pollRoom($)
  } else stopChatPolling()
}

function startChatPoll($: $) {
  if (stopChatPoll) return
  let n = 0
  const timer = $.clock.every(2000, () => {
    n++
    void chatTick($, n % 5 === 0).catch(err => $.ui.log(`CCSR chat: ${(err as Error).message}`))
  })
  stopChatPoll = () => timer.cancel()
}

function stopChatPolling() {
  stopChatPoll?.()
  stopChatPoll = null
}

/** Every 2 s while the Chat tab is on screen: the room's lines, and every 10 s the room list. Stops when the pane stops drawing. */
async function chatTick($: $, rooms: boolean) {
  const t = await $.clock.now()
  if ((await read($, tab)) !== 'chat' || t - paneSeenAt > 15_000 || (await read($, settings)).surfaces.chat !== 'on') {
    stopChatPolling()
    return
  }
  if (rooms) await pollRooms($)
  await pollRoom($)
}

async function pollRooms($: $) {
  if (!(await serverCfg($)).token) return
  const r = await api($, 'GET', '/chat/rooms')
  if (r.status !== 200) return
  const rooms = (r.json as { rooms: NonNullable<LinkState['rooms']> }).rooms
  await update($, link, l => {
    // Your room follows your tier: if the room on screen closed to you, go back to World.
    const room = rooms.some(x => x.room === l.room && x.can_post) ? l.room : 'world'
    return { ...l, rooms, room }
  })
}

async function pollRoom($: $) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const l = await read($, link)
  const room = l.room
  const cursor = l.lobby && l.lobby.room === room ? l.lobby.cursor : 0
  const r = await api($, 'GET', `/chat/${room}/events?cursor=${cursor}`)
  if (r.status !== 200) return
  const page = r.json as { events: ApiLobbyItem[]; cursor: number }
  await update($, link, x => {
    const have = x.lobby && x.lobby.room === room ? x.lobby.events : []
    const seen = new Set(have.map(e => e.seq))
    return { ...x, lobby: { room, events: [...have, ...page.events.filter(e => !seen.has(e.seq))].slice(-200), cursor: page.cursor } }
  })
}

async function setRoom($: $, room: ApiRoom) {
  await update($, link, l => ({ ...l, room, lobby: l.lobby?.room === room ? l.lobby : null }))
  await pollRoom($)
}

async function postRoom($: $, text: string) {
  await update($, chatDraft, () => '')
  const msg = clean(text).trim().slice(0, 280)
  const l = await read($, link)
  if (!msg) return
  const r = await api($, 'POST', `/chat/${l.room}`, { text: msg })
  if (r.status === 200) {
    const item = (r.json as { item: ApiLobbyItem }).item
    await update($, link, x => (x.lobby && x.lobby.room === item.room ? { ...x, lobby: { ...x.lobby, events: [...x.lobby.events.filter(e => e.seq !== item.seq), item] } } : x))
  } else {
    await update($, link, x => ({ ...x, note: errorOf(r.json)?.message ?? `The server answered ${r.status}.` }))
  }
}

// ================================================================== UI

type El = Elements['desktop']

export type Actions = {
  setTab: (t: Tab) => void
  setPeriod: (p: 'week' | 'month' | 'all') => void
  scanNow: () => void
  backfillWeek: () => void
  loadSessions: (days: number) => void
  backtest: (id: string) => void
  backtestAll: () => void
  race: (id: string) => void
  expand: (id: string | null) => void
  more: () => void
  start: (hours: number) => void
  forfeit: () => void
  chat: (text: string) => void
  setDraft: (text: string) => void
  clearMatch: () => void
  open: (t?: Tab) => void
  setSurface: (key: SurfaceKey, value: string) => void
  askCommit: () => void
  copyRecap: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  queueAgain: () => void
  setupSeen: () => void
  askForfeit: (isAsking: boolean) => void
  setPreset: (preset: 'full' | 'quiet') => void
  setHandle: (h: string) => void
  setTracking: (isOn: boolean) => void
  setShare: (isOn: boolean) => void
  setModel: (m: string) => void
  resetRating: () => void
  resetGrind: () => void
  lab: (what: string, surface: string) => void
  signup: (handle: string) => void
  joinWithCode: (code: string) => void
  recoverWith: (key: string) => void
  setJoinMode: (mode: 'new' | 'link' | 'recover') => void
  makeLinkCode: () => void
  newRecoveryKey: () => void
  copyRecoveryKey: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  recoverySaved: () => void
  removeInstall: (id: number) => void
  removeThisInstall: () => void
  setServer: (url: string) => void
  queue: () => void
  leaveQueue: () => void
  toggleLength: (h: 1 | 3) => void
  accept: () => void
  decline: () => void
  rankedForfeit: () => void
  rankedChat: (text: string) => void
  rankedClear: () => void
  setRoom: (room: ApiRoom) => void
  roomChat: (text: string) => void
  updateMod: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
}

export const ORANGE = '#FF6A2A'
const STONE = '#9A9286'

// ------------------------------------------------------------------ format

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function dur(ms: number) {
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function when(t: number) {
  const d = new Date(t)
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function ago(t: number, n: number) {
  const s = Math.max(0, Math.round((n - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function bar(share: number, width: number) {
  const n = Math.max(0, Math.min(width, Math.round(share * width)))
  return '█'.repeat(n) + '░'.repeat(width - n)
}

function hoursLabel(h: number) {
  return h < 1 ? `${Math.round(h * 60)}M` : `${h}H`
}

// ------------------------------------------------------------------ olympia adapters
// The drawings in olympia.ts take plain values; these shape the mod's state for them.

/** The badge for a rating, from the mod's own tiers (pure.ts), which match the server's. */
function tierKey(r: number) {
  return tierOf(r).toLowerCase() as TierKey
}

function outcomeOf(m: Match): 'won' | 'lost' | 'draw' {
  return m.status === 'won' ? 'won' : m.status === 'lost' || m.status === 'forfeit' ? 'lost' : 'draw'
}

function modeOf(m: Match) {
  return m.kind === 'replay' ? 'REPLAY' : 'PRACTICE'
}

function hhmm(t: number) {
  return new Date(t).toTimeString().slice(0, 5)
}

/** A match as the race drawings read it: minutes since the start, each side's commits up to now, or up to the bell or forfeit once it has ended. */
function raceOf(m: Match, handle: string, t: number): Race {
  const end = Math.min(m.status === 'live' ? t : (m.endedAt ?? m.deadline), m.deadline)
  const min = (x: number) => (x - m.startAt) / 60_000
  return {
    hours: m.hours,
    mode: modeOf(m),
    now: min(end),
    hot: m.status === 'live' && m.deadline - t < 10 * 60_000,
    me: { handle, commits: m.feed.filter(f => f.who === 'me' && f.at <= end).map(f => ({ t: min(f.at), points: f.points })) },
    them: { handle: m.opp.handle, commits: m.plan.filter(p => p.at <= end).map(p => ({ t: min(p.at), points: p.points })) },
  }
}

/** Running totals at seven even steps across the match, for the recent-matches sparklines. */
function seriesOf(m: Match) {
  const end = Math.min(m.endedAt ?? m.deadline, m.deadline)
  const upTo = (items: FeedItem[], x: number) => items.filter(i => i.at <= x).reduce((n, i) => n + i.points, 0)
  const xs = Array.from({ length: 7 }, (_, i) => m.startAt + ((end - m.startAt) * i) / 6)
  return { mine: xs.map(x => upTo(m.feed, x)), theirs: xs.map(x => upTo(m.plan, Math.min(x, m.deadline))) }
}

/** A ranked match from the server as the race drawings read it: minutes since the start, each side's scores by author time. */
function raceFromServer(r: RankedMatch, me: string, t: number): Race | null {
  const s = r.summary
  if (!s || !s.started_at) return null
  const start = Date.parse(s.started_at)
  const len = s.length * 60
  const mine = s.sides.find(x => x.player.handle === me) ?? s.sides[0]
  const them = s.sides.find(x => x !== mine) ?? s.sides[1]
  const end = s.ended_at ? Math.min(Date.parse(s.ended_at), start + len * 60_000) : t
  const min = (iso: string) => Math.max(0, Math.min(len, (Date.parse(iso) - start) / 60_000))
  const scores = r.events.filter((e): e is Extract<typeof e, { kind: 'score' }> => e.kind === 'score')
  const side = (h: string) => scores.filter(e => e.handle === h).map(e => ({ t: min(e.at), points: e.points, craft: e.craft }))
  const live = s.status === 'live' || s.status === 'grace'
  return {
    hours: s.length,
    now: Math.max(0, Math.min(len, (Math.min(t, end) - start) / 60_000)),
    mode: 'RANKED',
    hot: live && !!s.deadline && Date.parse(s.deadline) - t < 10 * 60_000,
    me: { handle: mine.player.handle, commits: side(mine.player.handle) },
    them: { handle: them.player.handle, commits: side(them.player.handle) },
  }
}

function rankedSides(s: ApiMatchSummary, me: string) {
  const mine = s.sides.find(x => x.player.handle === me) ?? s.sides[0]
  const them = s.sides.find(x => x !== mine) ?? s.sides[1]
  return { mine, them }
}

function rankedOutcome(s: ApiMatchSummary, me: string): 'won' | 'lost' | 'draw' {
  if (s.result === 'draw' || s.status === 'void') return 'draw'
  return s.winner === me ? 'won' : 'lost'
}

function waitLabel(ms: number | null) {
  if (ms === null) return '~?'
  const m = Math.round(ms / 60_000)
  return m < 1 ? '<1 min' : `~${m} min`
}

// ------------------------------------------------------------------ band

export async function renderBand($: $, e: RenderInput<'AbovePrompt'>, a: Actions): Promise<RenderElement | null> {
  const { Box, Text, Button, Svg } = $.ui.resolve(e) as El
  const rich = e.surface !== 'terminal'
  const m = await read($, match)
  const t = (await read($, now)) || (await $.clock.now())
  const s = await read($, settings)
  const p = s.surfaces
  const sh = await rankedShared($)
  const l = await read($, link)
  const cfg = await serverCfg($)
  const me = cfg.handle ?? s.handle
  const chatOk = p.bandChat === 'on' && p.chat === 'on'

  // The ready check ignores every switch: it's the one thing a player has to answer.
  if (sh.phase === 'offered' && l.queue?.offer) {
    const o = l.queue.offer
    const secs = Math.max(0, Math.round((Date.parse(o.expires_at) - t) / 1000))
    const line = `${o.opponent.handle} · ${o.opponent.placement ? 'Mud, placing' : `${o.opponent.tier} ${o.opponent.rating}`} · ${o.opponent_record.w}-${o.opponent_record.l} · win +${o.stakes.win}, loss ${o.stakes.loss}`
    return (
      <Box gap={1} alignItems="center" flexWrap="wrap">
        {rich ? (
          <Svg source={bandStrip({ kind: 'found', me, them: o.opponent.handle, theirRating: o.opponent.rating, seconds: secs })} alt={`Opponent found: ${line}. ${secs} seconds to accept.`} />
        ) : (
          <Text bold color={ORANGE}>
            OPPONENT FOUND
          </Text>
        )}
        <Text wrap="truncate-end">{rich ? line : `${line} · ${secs}s`}</Text>
        {o.you_accepted ? (
          <Text dimColor>Accepted. Waiting for {o.opponent.handle}.</Text>
        ) : (
          <>
            <Button key="band-accept" label="Accept" variant="primary" onPress={() => a.accept()} />
            <Button key="band-decline" label="Decline" onPress={() => a.decline()} />
          </>
        )}
      </Box>
    )
  }

  if (p.bandMatch === 'on') {
    if (sh.phase === 'queued') {
      const secs = Math.max(0, Math.round((t - sh.since) / 1000))
      const half = l.queue?.range ? Math.round((l.queue.range.max - l.queue.range.min) / 2) : 60
      return (
        <Box gap={1} alignItems="center">
          {rich && l.me && !l.me.placement ? (
            <Svg source={bandStrip({ kind: 'queue', seconds: secs, hours: sh.lengths, rating: l.me.rating, range: half })} alt={`In queue ${mmss(secs * 1000)}.`} />
          ) : (
            <Text bold color={ORANGE}>
              CCSR in queue {mmss(secs * 1000)}
            </Text>
          )}
          <Text dimColor wrap="truncate-end">
            {LINES.queue[Math.floor(secs / 8) % LINES.queue.length]}
          </Text>
          <Button key="band-open" label="Open" onPress={() => a.open('match')} />
          <Button key="band-leave" label="Leave" onPress={() => a.leaveQueue()} />
        </Box>
      )
    }

    const rk = l.ranked
    if ((sh.phase === 'live' || sh.phase === 'done') && rk?.summary) {
      const sm = rk.summary
      const { mine, them } = rankedSides(sm, me)
      const closed = sm.status === 'finished' || sm.status === 'void'
      const lastChat = [...rk.events].reverse().find((x): x is Extract<typeof x, { kind: 'chat' }> => x.kind === 'chat' && x.handle !== me)
      const ended = sm.ended_at ? Date.parse(sm.ended_at) : t
      if (closed && t - ended <= 15 * 60_000) {
        const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
        const line = rankedResultLine(sm, me)
        return (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            {rich ? (
              <Svg
                source={bandStrip({ kind: 'result', mode: 'RANKED', outcome: rankedOutcome(sm, me), hours: sm.length, delta, ratingBefore: mine.rating_before, ratingAfter: mine.rating_after ?? mine.rating_before, mine: mine.points, theirs: them.points, placing: placingOfSide(mine) })}
                alt={line}
              />
            ) : (
              <Text bold color={ORANGE}>
                CCSR
              </Text>
            )}
            <Box flexDirection="column">
              <Text bold>{line}</Text>
              {!rich && (
                <Text dimColor>
                  {mine.points} : {them.points} vs {them.player.handle}
                </Text>
              )}
              {lastChat && chatOk && (
                <Text dimColor wrap="truncate-end">
                  {clean(lastChat.handle)}: {clean(lastChat.text)}
                </Text>
              )}
            </Box>
            <Button key="band-again" label="Queue again" variant="primary" onPress={() => a.queueAgain()} />
            <Button key="band-recap" label="Copy recap" onPress={x => a.copyRecap(x.surface)} />
            <Button key="band-clear" label="Dismiss" role="dismiss" onPress={() => a.rankedClear()} />
          </Box>
        )
      }
      if (!closed) {
        const race = raceFromServer(rk, me, t)
        const left = sm.deadline ? Date.parse(sm.deadline) - t : 0
        const hot = sm.status === 'live' && left <= 10 * 60_000
        const behind = them.points - mine.points
        const offline = l.online === false
        const d = await read($, dirty)
        const offlineAgo = offline && rk.polledAt ? `${Math.round((t - rk.polledAt) / 1000)}s` : undefined
        return (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            {rich && race ? (
              <Svg source={bandStrip({ kind: 'race', race, mode: 'RANKED', offlineAgo })} alt={`${mine.player.handle} ${mine.points}, ${them.player.handle} ${them.points}. ${clock(left)} to the bell.`} />
            ) : (
              <Text bold color={hot ? ORANGE : undefined}>
                {hot ? 'BELL' : `CCSR ${sm.length}H`} {clock(left)} · {mine.player.handle} {mine.points} vs {them.points} {them.player.handle}
              </Text>
            )}
            {sm.status === 'grace' ? (
              <Text color={ORANGE}>{MOD.counting}</Text>
            ) : offline ? (
              <Text dimColor wrap="truncate-end">
                {MOD.offline}
              </Text>
            ) : hot ? (
              <Box flexDirection="column">
                {behind > 0 && (
                  <Text bold color={ORANGE}>
                    {LINES.behind(behind)}
                  </Text>
                )}
                {d && d.files > 0 && <Text dimColor>{MOD.uncommitted(d.files, d.repo)}</Text>}
              </Box>
            ) : lastChat && chatOk ? (
              <Text dimColor wrap="truncate-end">
                {clean(lastChat.handle)}: {clean(lastChat.text)}
              </Text>
            ) : null}
            {hot && !offline && p.spinner === 'on' && <Button key="band-commit" label="Ask Claude to commit" variant="primary" onPress={() => a.askCommit()} />}
            {!hot && !offline && lastChat && chatOk && <Button key="band-reply" label="Reply" onPress={() => a.open('match')} />}
            <Button key="band-open" label="Open" onPress={() => a.open('match')} />
          </Box>
        )
      }
    }

    if (m && m.kind === 'practice' && m.status === 'live') {
      const lastChat = m.chat[m.chat.length - 1]
      const w = Math.max(8, Math.min(24, e.props.bodyColumns - 70))
      const opp = liveOpp(m, t)
      const total = m.myPoints + opp
      return (
        <Box flexDirection="column">
          {rich ? (
            <Box gap={1} alignItems="center">
              <Svg source={bandStrip({ kind: 'race', race: raceOf(m, s.handle, t), mode: modeOf(m) })} alt={`${s.handle} ${m.myPoints}, ${m.opp.handle} ${opp}. ${clock(m.deadline - t)} to the bell.`} />
              <Button key="band-open" label="Open" onPress={() => a.open('match')} />
            </Box>
          ) : (
            <Box gap={1} alignItems="center">
              <Text bold color={ORANGE}>
                CCSR {hoursLabel(m.hours)}
              </Text>
              <Text bold>{clock(m.deadline - t)}</Text>
              <Text bold>
                {s.handle} {m.myPoints}
              </Text>
              <Text color={ORANGE}>{bar(total ? m.myPoints / total : 0.5, w)}</Text>
              <Text>
                {opp} {m.opp.handle}
              </Text>
              <Button key="band-open" label="Open" onPress={() => a.open('match')} />
            </Box>
          )}
          {lastChat && chatOk && (
            <Text dimColor wrap="truncate-end">
              {clean(lastChat.who)}: {clean(lastChat.text)}
            </Text>
          )}
        </Box>
      )
    }

    if (m && m.kind === 'practice' && m.status !== 'live' && t - (m.endedAt ?? m.deadline) < 15 * 60_000) {
      const delta = (m.ratingAfter ?? m.ratingBefore) - m.ratingBefore
      if (rich)
        return (
          <Box gap={1} alignItems="center">
            <Svg
              source={bandStrip({ kind: 'result', mode: modeOf(m), outcome: outcomeOf(m), hours: m.hours, delta, ratingBefore: m.ratingBefore, ratingAfter: m.ratingAfter ?? m.ratingBefore, mine: m.myPoints, theirs: m.oppPoints })}
              alt={`${resultWord(m)}, ${m.myPoints} to ${m.oppPoints} vs ${m.opp.handle}.`}
            />
            <Button key="band-open" label="Open" onPress={() => a.open('match')} />
            <Button key="band-clear" label="Dismiss" role="dismiss" onPress={() => a.clearMatch()} />
          </Box>
        )
      return (
        <Box gap={1} alignItems="center">
          <Text bold color={ORANGE}>
            CCSR
          </Text>
          <Text bold>{resultWord(m)}</Text>
          <Text>
            {m.myPoints} to {m.oppPoints} vs {m.opp.handle} · {delta >= 0 ? '+' : ''}
            {delta} · {tierOf(m.ratingAfter ?? m.ratingBefore)} {m.ratingAfter ?? m.ratingBefore}
          </Text>
          <Button key="band-open" label="Open" onPress={() => a.open('match')} />
          <Button key="band-clear" label="Dismiss" role="dismiss" onPress={() => a.clearMatch()} />
        </Box>
      )
    }
  }

  // First run: one prompt, gone for good after either button.
  if (!cfg.token && !s.setupSeen) {
    return (
      <Box gap={1} alignItems="center">
        {rich ? <Svg source={bandStrip({ kind: 'setup' })} alt="CCSR: pick a handle" /> : <Text bold color={ORANGE}>CCSR</Text>}
        <Text>{LINES.handle}</Text>
        <Button
          key="band-setup"
          label="Set up"
          variant="primary"
          onPress={() => {
            a.setupSeen()
            a.open('match')
          }}
        />
        <Button key="band-later" label="Not now" onPress={() => a.setupSeen()} />
      </Box>
    )
  }

  // Between matches: the Grind band, two minutes after a score (or always, or never).
  if (!s.tracking || p.band === 'off') return null
  const list = await read($, ledger)
  const wk = totals(list, periodStart('week', t), await read($, weekTotals))
  const last = list.filter(c => !c.matchOnly).sort((x, y) => y.scoredAt - x.scoredAt)[0]
  if (!last || (p.band === 'after' && t - last.scoredAt > 2 * 60_000)) return null
  const sc = await read($, scan)
  const queueBtn = cfg.token ? <Button key="band-queue" label="Queue" onPress={() => a.open('match')} /> : null
  if (rich)
    return (
      <Box gap={1} alignItems="center">
        <Svg source={bandStrip({ kind: 'grind', points: last.points, category: last.category, craft: last.craft, week: wk.points, rank: l.grindRank ?? undefined })} alt={`Last commit +${last.points} ${last.category}. Grind ${wk.points} points this week.`} />
        <Text wrap="truncate-end">{sc.busy ? sc.note : clean(last.title).slice(0, 60)}</Text>
        {queueBtn}
        <Button key="band-open" label="Open" onPress={() => a.open('grind')} />
      </Box>
    )
  return (
    <Box gap={1} alignItems="center">
      <Text bold color={ORANGE}>
        CCSR +{last.points}
      </Text>
      <Text wrap="truncate-end">
        {last.category}
        {last.craft !== 'neutral' ? ` · ${last.craft === 'clean' ? 'clean +1' : 'sloppy -1'}` : ''} · {clean(last.title).slice(0, 40)} · Grind {wk.points}
        {l.grindRank ? ` · #${l.grindRank}` : ''}
      </Text>
      {queueBtn}
      <Button key="band-open" label="Open" onPress={() => a.open('grind')} />
    </Box>
  )
}

/** Where a ranked side stands on placement, for the result card and band: still placing, or placed by this match. */
function placingOfSide(side: ApiMatchSummary['sides'][number]) {
  if (side.player.placement) return { played: side.player.placement.played, of: side.player.placement.of }
  if (side.tier_before === 'Mud' && side.tier_after && side.tier_after !== 'Mud') return { played: 3, of: 3, placedIn: side.tier_after.toLowerCase() as TierKey }
  return undefined
}

function resultWord(m: Match) {
  return m.status === 'won' ? 'You won' : m.status === 'lost' ? 'You lost' : m.status === 'draw' ? 'Draw' : m.status === 'forfeit' ? 'Forfeit' : m.status === 'void' ? 'Void' : 'Live'
}

// ------------------------------------------------------------------ pane

/** The five tabs in the frame. Backtest opens from the Grind tab ("Score past sessions") and Lab from `/ccsr lab`. */
const TABS: ['match' | 'ranked' | 'grind' | 'chat' | 'settings', string][] = [
  ['match', 'Match'],
  ['ranked', 'Ranked'],
  ['grind', 'Grind'],
  ['chat', 'Chat'],
  ['settings', 'Settings'],
]

export async function renderPane($: $, e: RenderInput<'Pane'>, a: Actions): Promise<RenderElement> {
  const els = $.ui.resolve(e) as El
  const { Box, Text, Button, Svg } = els
  const rich = e.surface !== 'terminal'
  const cur = await read($, tab)
  const s = await read($, settings)
  const t = (await read($, now)) || (await $.clock.now())
  const list = await read($, ledger)
  const r = await read($, rating)
  const l = await read($, link)
  const wk = totals(list, periodStart('week', t), await read($, weekTotals))
  // The chat poller's heartbeat: it stops once the pane stops drawing.
  paneSeenAt = await $.clock.now()

  let body: RenderElement
  if (cur === 'match') body = await matchTab($, e, els, a, t)
  else if (cur === 'ranked') body = await rankedTab($, e, els, a)
  else if (cur === 'chat') body = await chatTab($, e, els, a)
  else if (cur === 'backtest') body = await backtestTab($, e, els, a, t)
  else if (cur === 'lab') body = await labTab($, e, els, a)
  else if (cur === 'settings') body = await settingsTab($, e, els, a)
  else body = await grindTab($, e, els, a, t)

  const me = l.me
  const placing = me?.placement ?? null
  const who = me ? `${me.handle} · ${placing ? `Mud, placing ${placing.played} of ${placing.of}` : `${me.tier} ${me.rating}`}` : `${s.handle} · ${tierOf(r)} ${r} practice`
  const sub = `${who} · Grind ${wk.points}${l.grindRank ? ` · #${l.grindRank}` : ''}`
  const tierK: TierKey = me ? (placing ? 'mud' : (me.tier.toLowerCase() as TierKey)) : tierKey(r)
  const framed = cur === 'backtest' ? 'grind' : cur === 'lab' ? 'settings' : cur
  return (
    <Box flexDirection="column" gap={1}>
      {rich ? (
        <Svg source={banner({ sub, tier: tierK })} alt={`CCSR. ${sub}`} />
      ) : (
        <Box gap={1}>
          <Text bold color={ORANGE}>
            CCSR
          </Text>
          <Text>{sub}</Text>
        </Box>
      )}
      {rich ? (
        <Box flexDirection="column">
          <Svg source={tabsTop(framed)} alt={`Tabs: ${framed} is open`} />
          <Box>
            {TABS.map(([id, label]) => (
              <Box key={`cell-${id}`} width="20%" justifyContent="center">
                <Button key={`tab-${id}`} label={label} variant={framed === id ? 'primary' : 'secondary'} onPress={() => a.setTab(id)} />
              </Box>
            ))}
          </Box>
          <Svg source={tabsBase(framed)} alt="" />
        </Box>
      ) : (
        <Box gap={1} flexWrap="wrap">
          {TABS.map(([id, label]) => (
            <Button key={`tab-${id}`} label={framed === id ? `▸ ${label}` : label} variant={framed === id ? 'primary' : 'secondary'} onPress={() => a.setTab(id)} />
          ))}
        </Box>
      )}
      {body}
    </Box>
  )
}

// ---------------------------------------------------------------- grind tab

async function grindTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg } = els
  const rich = e.surface !== 'terminal'
  const p = await read($, period)
  const srv = await read($, link)
  const list = await read($, ledger)
  const sc = await read($, scan)
  const s = await read($, settings)
  const since = await read($, trackingSince)
  const weeks = await read($, weekTotals)
  const from = periodStart(p, t)
  const tot = totals(list, from, weeks)
  const problems = sc.problems ?? []
  const inPeriod = list.filter(c => c.authoredAt >= from && !c.matchOnly).sort((x, y) => y.authoredAt - x.authoredAt)

  // columns: days of this week, weeks of this month, or the last 8 weeks
  let cols: { label: string; points: number; isToday: boolean }[] = []
  if (p === 'week') {
    cols = DAYS.map((label, i) => {
      const a0 = from + i * 86_400_000
      const pts = list.filter(c => c.authoredAt >= a0 && c.authoredAt < a0 + 86_400_000 && !c.matchOnly).reduce((n, c) => n + c.points, 0)
      return { label, points: pts, isToday: t >= a0 && t < a0 + 86_400_000 }
    })
  } else {
    const wk0 = periodStart('week', t)
    const n = p === 'month' ? Math.ceil((t - from) / (7 * 86_400_000)) + 1 : 8
    cols = Array.from({ length: Math.min(8, Math.max(1, n)) }, (_, k) => {
      const i = Math.min(8, Math.max(1, n)) - 1 - k
      const a0 = wk0 - i * 7 * 86_400_000
      const pts =
        list.filter(c => c.authoredAt >= Math.max(a0, p === 'month' ? from : 0) && c.authoredAt < a0 + 7 * 86_400_000 && !c.matchOnly).reduce((m, c) => m + c.points, 0) +
        (p === 'all' ? (weeks[String(a0)]?.points ?? 0) : 0)
      const d = new Date(a0)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, points: pts, isToday: i === 0 }
    })
  }
  const maxPts = Math.max(1, ...cols.map(c => c.points))
  const barW = Math.max(8, Math.min(30, e.props.bodyColumns - 22))
  const label = p === 'week' ? 'this week' : p === 'month' ? 'this month' : 'all time'

  return (
    <Box flexDirection="column" gap={1}>
      <Box gap={1}>
        <Button key="p-week" label="This week" variant={p === 'week' ? 'primary' : 'secondary'} onPress={() => a.setPeriod('week')} />
        <Button key="p-month" label="Month" variant={p === 'month' ? 'primary' : 'secondary'} onPress={() => a.setPeriod('month')} />
        <Button key="p-all" label="All time" variant={p === 'all' ? 'primary' : 'secondary'} onPress={() => a.setPeriod('all')} />
      </Box>
      {rich ? (
        <Svg
          source={grind({ points: tot.points, commits: tot.commits, caption: `PTS ${label.toUpperCase()}`, rank: p === 'week' ? (srv.grindRank ?? undefined) : undefined, of: srv.grindOf ?? undefined, days: cols.slice(-7).map(c => ({ label: c.label, points: c.points, today: c.isToday })) })}
          alt={`Grind ${label}: ${tot.points} points from ${tot.commits} commits.`}
        />
      ) : (
        <Box flexDirection="column">
          <Text bold>
            {tot.points} pts · {tot.commits} commits {label}
          </Text>
          {cols.map(c => (
            <Text color={c.isToday ? ORANGE : undefined}>
              {c.label.padEnd(6)} {bar(c.points / maxPts, barW)} {c.points}
            </Text>
          ))}
        </Box>
      )}
      <Box gap={1} flexWrap="wrap" alignItems="center">
        <Button key="scan" label={sc.busy ? 'Scanning...' : 'Scan now'} variant="primary" onPress={() => a.scanNow()} />
        <Button key="backfill" label="Score this week" onPress={() => a.backfillWeek()} />
        <Button key="past-sessions" label="Score past sessions" onPress={() => a.setTab('backtest')} />
        <Text dimColor wrap="truncate-end">
          {s.tracking ? `Tracking since ${when(since)}` : 'Tracking is off'} · {sc.note || 'not scanned yet'}
          {sc.lastAt ? ` · ${ago(sc.lastAt, Math.max(t, sc.lastAt))}` : ''}
        </Text>
      </Box>
      {problems.length > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor={ORANGE} paddingX={1}>
          <Text bold color={ORANGE}>
            Problems on the last scan ({problems.length}). They retry on the next scan.
          </Text>
          {problems.slice(0, 8).map(pr => (
            <Text dimColor wrap="wrap">
              {pr}
            </Text>
          ))}
        </Box>
      )}
      {inPeriod.length === 0 ? (
        <Text dimColor>
          Nothing scored {label} yet. Commit something in a repo you use Claude Code in, or press "Score this week" to score your commits since Monday.
        </Text>
      ) : (
        <Box flexDirection="column">
          {rich ? (
            <Svg
              source={commitList(
                inPeriod.slice(0, 14).map(c => ({
                  points: c.points,
                  craft: c.craft,
                  category: c.category,
                  title: clean(c.title),
                  repo: c.repoName,
                  added: c.added,
                  deleted: c.deleted,
                  files: c.files,
                  note: c.points <= 1 ? clean(c.reason).slice(0, 48) : undefined,
                })),
              )}
              alt={`${Math.min(14, inPeriod.length)} scored commits ${label}.`}
            />
          ) : (
            <Box flexDirection="column">
              <Text bold>Scored commits</Text>
              {inPeriod.slice(0, 14).map(c => commitRow(els, c, e.props.bodyColumns))}
            </Box>
          )}
          {inPeriod.length > 14 && <Text dimColor>and {inPeriod.length - 14} more</Text>}
        </Box>
      )}
      <Text dimColor>{LINES.multibox}</Text>
    </Box>
  )
}

function commitRow(els: El, c: ScoredCommit, cols: number) {
  const { Box, Text } = els
  return (
    <Box key={`c-${c.pid}`} flexDirection="column" hover={{ backgroundColor: '#26231F' }}>
      <Box gap={1}>
        <Text bold color={c.points >= 8 ? ORANGE : undefined}>{`+${c.points}`.padStart(3)}</Text>
        <Text color={STONE}>{c.category.padEnd(8)}</Text>
        {c.craft === 'clean' && <Text color={ORANGE}>clean +1</Text>}
        {c.craft === 'sloppy' && <Text color={STONE}>sloppy -1</Text>}
        <Text wrap="truncate-end">{clean(c.title).slice(0, Math.max(20, cols - 40))}</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {'    '}
        {c.repoName} · +{c.added} -{c.deleted} in {c.files} file{c.files === 1 ? '' : 's'} · {clean(c.reason)}
        {c.craft !== 'neutral' ? ` · judged ${c.base}, ${c.craft} moves it to ${c.points}` : ''}
        {c.judge === 'rule' ? ' (rule, no judge call)' : ''}
      </Text>
    </Box>
  )
}

// ---------------------------------------------------------------- match tab

/** Recent ranked matches from the profile, as the recent-matches drawing reads them. */
function recentRow(x: ApiRecentMatch) {
  const result: 'won' | 'lost' | 'draw' = x.result === 'win' ? 'won' : x.result === 'loss' ? 'lost' : x.result === 'forfeit' ? (x.delta >= 0 ? 'won' : 'lost') : 'draw'
  return { day: DAYS[(new Date(Date.parse(x.ended_at)).getDay() + 6) % 7] ?? '', result, hours: x.length, mine: x.score[0], theirs: x.score[1], opponent: x.opponent.handle, opponentRating: x.opponent.rating, delta: x.delta, series: { mine: x.series[0], theirs: x.series[1] } }
}

/**
 * Ranked, from the server (docs/ui-spec.md, States): first run, the queue bar
 * and where you stand, the queue, the ready check, the live match, counting,
 * the result. Every line is approved in docs/copy.md; the mod's own come from MOD in copy.ts.
 */
async function rankedBox($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const body = await rankedBody($, e, els, a, t)
  const banner = await recoveryBanner($, e, els, a)
  if (!banner) return body
  const { Box } = els
  return (
    <Box flexDirection="column" gap={1}>
      {banner}
      {body}
    </Box>
  )
}

/** Right after a recovery key is made: say why it matters and copy it, until copied or waved off. */
async function recoveryBanner($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement | null> {
  const l = await read($, link)
  const cfg = await serverCfg($)
  if (!l.recoveryFresh || !cfg.token || !cfg.recoveryKey) return null
  const { Box, Text, Button } = els
  return (
    <Box flexDirection="column">
      <Text color={ORANGE} wrap="wrap">
        {ACCOUNT.saveKey(cfg.handle ?? '')}
      </Text>
      <Box gap={1}>
        <Button key="recovery-copy" label={ACCOUNT.copyKey} variant="primary" onPress={() => a.copyRecoveryKey(e.surface)} />
        <Button key="recovery-saved" label={ACCOUNT.savedIt} onPress={() => a.recoverySaved()} />
      </Box>
    </Box>
  )
}

/** The ways in: pick a new handle, link with a code from another install, or a recovery key. */
async function joinBlock($: $, e: RenderInput<'Pane'>, els: El, a: Actions, prefix: string): Promise<RenderElement | null> {
  if (e.surface === 'mobile') return null
  const { Box, Button, Input } = els
  const mode = await read($, joinMode)
  return (
    <Box flexDirection="column" gap={1}>
      {mode === 'new' && <Input key={`${prefix}join`} label="Handle" placeholder="2 to 20 of a-z, 0-9 and _" submitLabel="Join" onSubmit={v => a.signup(v)} />}
      {mode === 'link' && <Input key={`${prefix}link`} label={ACCOUNT.codeLabel} placeholder={ACCOUNT.codePlaceholder} submitLabel={ACCOUNT.codeSubmit} onSubmit={v => a.joinWithCode(v)} />}
      {mode === 'recover' && <Input key={`${prefix}recover`} label={ACCOUNT.keyLabel} placeholder={ACCOUNT.keyPlaceholder} submitLabel={ACCOUNT.keySubmit} onSubmit={v => a.recoverWith(v)} />}
      <Box gap={1}>
        {mode !== 'new' && <Button key={`${prefix}mode-new`} label={ACCOUNT.newHandle} onPress={() => a.setJoinMode('new')} />}
        {mode !== 'link' && <Button key={`${prefix}mode-link`} label={ACCOUNT.linkWith} onPress={() => a.setJoinMode('link')} />}
        {mode !== 'recover' && <Button key={`${prefix}mode-recover`} label={ACCOUNT.recoverWith} onPress={() => a.setJoinMode('recover')} />}
      </Box>
    </Box>
  )
}

async function rankedBody($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Input } = els
  const rich = e.surface !== 'terminal'
  const cfg = await serverCfg($)
  const l = await read($, link)
  const sh = await rankedShared($)
  const s = await read($, settings)
  const draft = await read($, chatDraft)
  const me = cfg.handle ?? ''

  if (!cfg.token || l.unknownToken)
    return (
      <Box flexDirection="column" gap={1}>
        {rich ? <Svg source={setupHero({ placementMatches: 3 })} alt={`${LINES.handle} Everyone starts in the mud.`} /> : <Text bold>{LINES.handle}</Text>}
        {await joinBlock($, e, els, a, 'match-')}
        {l.note && (
          <Text color={ORANGE} wrap="wrap">
            {l.note}
          </Text>
        )}
        <Box gap={1} alignItems="center">
          <Text>Grind tracking</Text>
          <Button key="setup-track-on" label="On" variant={s.tracking ? 'primary' : 'secondary'} onPress={() => a.setTracking(true)} />
          <Button key="setup-track-off" label="Off" variant={s.tracking ? 'secondary' : 'primary'} onPress={() => a.setTracking(false)} />
        </Box>
        <Box gap={1} alignItems="center">
          <Text>Show my commit titles to opponents</Text>
          <Button key="setup-share-on" label="On" variant={s.share ? 'primary' : 'secondary'} onPress={() => a.setShare(true)} />
          <Button key="setup-share-off" label="Off" variant={s.share ? 'secondary' : 'primary'} onPress={() => a.setShare(false)} />
        </Box>
        <Text dimColor>{LINES.privacy}</Text>
      </Box>
    )

  const q = l.queue
  if (sh.phase === 'idle') {
    const lanes = ([1, 3] as const).map(h => ({ hours: h, ticked: sh.lengths.includes(h), wait: waitLabel(q?.per_length[String(h) as '1' | '3']?.wait_ms ?? null), waiting: q?.per_length[String(h) as '1' | '3']?.waiting ?? 0 }))
    const mine = l.me
    const placing = mine?.placement ?? undefined
    const recent = (l.recent ?? []).slice(0, 3).map(recentRow)
    // Below the server's floor: Update takes Queue's place (the server would refuse the queue anyway).
    const gated = standing(l.release) === 'required'
    return (
      <Box flexDirection="column" gap={1}>
        {rich ? (
          <Svg source={queueBar({ lanes })} alt={`Queue up. Lose in public. ${lanes.map(x => `${x.hours}h ${x.ticked ? 'ticked' : 'not ticked'}, ${x.wait}, ${x.waiting} waiting`).join('. ')}.`} />
        ) : (
          <Box flexDirection="column">
            <Box gap={1}>
              <Text bold color={ORANGE}>
                QUEUE UP.
              </Text>
              <Text dimColor>Lose in public.</Text>
            </Box>
            <Text dimColor>{LINES.lengths}</Text>
            {lanes.map(x => (
              <Text color={x.ticked ? ORANGE : STONE}>
                {x.ticked ? '◉' : '○'} {x.hours}h · {x.wait} · {x.waiting} waiting{x.ticked ? '' : ' · off'}
              </Text>
            ))}
            <Text dimColor>1 pick lengths › 2 queue › 3 accept in 60s › 4 ship before the bell</Text>
          </Box>
        )}
        <Box gap={1} alignItems="center">
          {lanes.map(x => (
            <Button key={`rl-${x.hours}`} label={`${x.ticked ? '✓ ' : ''}${x.hours}h`} onPress={() => a.toggleLength(x.hours)} />
          ))}
          {gated ? (
            <Button key="ranked-update" label="Update" variant="primary" onPress={x => a.updateMod(x.surface)} />
          ) : (
            <Button key="ranked-queue" label="Queue" variant="primary" onPress={() => a.queue()} />
          )}
        </Box>
        {gated && l.release && (
          <Text color={ORANGE} wrap="wrap">
            {MOD.updateNeeded(l.release.min, VERSION)}
          </Text>
        )}
        {gated && l.updateNote && (
          <Text dimColor wrap="wrap">
            {l.updateNote}
          </Text>
        )}
        {l.note && (
          <Text color={ORANGE} wrap="wrap">
            {l.note}
          </Text>
        )}
        {mine &&
          (rich ? (
            <Svg
              source={ratingCard({ rating: mine.rating, rank: l.myRank ?? undefined, wins: mine.record.w, losses: mine.record.l, placing })}
              alt={placing ? `Mud, placing ${placing.played} of ${placing.of}, ${mine.record.w}-${mine.record.l}.` : `${mine.tier} ${mine.rating}${l.myRank ? `, rank ${l.myRank}` : ''}, ${mine.record.w}-${mine.record.l}.`}
            />
          ) : (
            <Text bold>
              {placing ? `Mud · placing ${placing.played} of ${placing.of}` : `${mine.tier} ${mine.rating}${l.myRank ? ` · #${l.myRank}` : ''}`} · {mine.record.w}-{mine.record.l}
            </Text>
          ))}
        {mine && mine.matches_played === 0 ? (
          <Text dimColor>{LINES.noHistory}</Text>
        ) : recent.length > 0 ? (
          rich ? (
            <Svg source={recentMatches(recent)} alt={`Recent: ${recent.map(x => `${x.result} ${x.mine}-${x.theirs} vs ${x.opponent}`).join('; ')}`} />
          ) : (
            <Box flexDirection="column">
              {recent.map(x => (
                <Text dimColor>
                  {x.day} {x.result === 'won' ? 'W' : x.result === 'lost' ? 'L' : 'D'} {x.hours}h {x.mine}-{x.theirs} vs {x.opponent} {x.delta >= 0 ? '+' : ''}
                  {x.delta}
                </Text>
              ))}
            </Box>
          )
        ) : null}
      </Box>
    )
  }

  if (sh.phase === 'queued') {
    const secs = Math.max(0, Math.round((t - sh.since) / 1000))
    const mine = l.me
    const half = q?.range ? Math.round((q.range.max - q.range.min) / 2) : 60
    const center = q?.range ? Math.round((q.range.max + q.range.min) / 2) : (mine?.rating ?? 1000)
    const widens = (q?.widening ?? []).map(w => ({ range: Math.round((w.range.max - w.range.min) / 2), label: `+${Math.max(1, Math.round(w.after_ms / 60_000))} min` }))
    const waiting = sh.lengths.map(h => ({ hours: h, count: q?.per_length[String(h) as '1' | '3']?.waiting ?? 0, ratings: q?.per_length[String(h) as '1' | '3']?.ratings ?? [] }))
    return (
      <Box flexDirection="column" gap={1}>
        {rich && mine && !mine.placement ? (
          <Svg source={queueSvg({ seconds: secs, hours: sh.lengths, rating: center, range: half, widens, waiting })} alt={`In queue ${mmss(secs * 1000)}, searching ${center} plus or minus ${half}.`} />
        ) : (
          <Box flexDirection="column">
            <Text bold>
              In the queue · {mmss(secs * 1000)} · {sh.lengths.map(h => `${h}h`).join(' and ')}
            </Text>
            {waiting.map(w => (
              <Text dimColor>
                {w.hours}h: {w.count} waiting
              </Text>
            ))}
          </Box>
        )}
        <Text dimColor>{LINES.queue[Math.floor(secs / 8) % LINES.queue.length]}</Text>
        <Box>
          <Button key="ranked-leave" label="Leave queue" onPress={() => a.leaveQueue()} />
        </Box>
      </Box>
    )
  }

  if (sh.phase === 'offered' && q?.offer) {
    const o = q.offer
    const secs = Math.max(0, Math.round((Date.parse(o.expires_at) - t) / 1000))
    const mine = l.me
    return (
      <Box flexDirection="column" gap={1}>
        {rich && mine ? (
          <Svg
            source={readyCheck({
              hours: o.length,
              seconds: secs,
              me: { handle: mine.handle, rating: mine.rating, wins: mine.record.w, losses: mine.record.l, rank: l.myRank ?? 0, placing: mine.placement ?? undefined },
              them: { handle: o.opponent.handle, rating: o.opponent.rating, wins: o.opponent_record.w, losses: o.opponent_record.l, rank: o.opponent_rank ?? 0, placing: o.opponent.placement ?? undefined },
              stakes: o.stakes,
            })}
            alt={`Opponent found: ${o.opponent.handle}, ${o.length}h. ${secs} seconds to accept. Win ${o.stakes.win}, draw ${o.stakes.draw}, loss ${o.stakes.loss}.`}
          />
        ) : (
          <Text bold>
            Opponent found: {o.opponent.handle} ({o.opponent.placement ? 'placing' : o.opponent.tier}) · {o.length}h · {secs}s to accept · win +{o.stakes.win} / loss {o.stakes.loss}
          </Text>
        )}
        <Text>{LINES.found}</Text>
        {o.you_accepted ? (
          <Text dimColor>Accepted. Waiting for {o.opponent.handle}.</Text>
        ) : (
          <Box gap={1}>
            <Button key="ranked-accept" label="Accept" variant="primary" onPress={() => a.accept()} />
            <Button key="ranked-decline" label="Decline" onPress={() => a.decline()} />
          </Box>
        )}
      </Box>
    )
  }

  const r = l.ranked
  if ((sh.phase === 'live' || sh.phase === 'done') && r?.summary) {
    const sm = r.summary
    const race = raceFromServer(r, me, t)
    const { mine, them } = rankedSides(sm, me)
    const live = sm.status === 'live' || sm.status === 'grace'
    const closed = sm.status === 'finished' || sm.status === 'void'
    const left = sm.deadline ? Date.parse(sm.deadline) - t : 0
    const hot = sm.status === 'live' && left <= 10 * 60_000
    const scores = r.events.filter((x): x is Extract<typeof x, { kind: 'score' }> => x.kind === 'score').slice(-12).reverse()
    const chats = r.events.filter((x): x is Extract<typeof x, { kind: 'chat' }> => x.kind === 'chat').slice(-8)
    const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
    const line = closed ? rankedResultLine(sm, me) : ''
    const asking = await read($, forfeitAsk)
    return (
      <Box flexDirection="column" gap={1}>
        {live && l.online === false && <Text color={ORANGE}>{MOD.offline}</Text>}
        {rich && race && !closed && <Svg source={raceClimb(race)} alt={`Ranked ${sm.length}h: ${mine.player.handle} ${mine.points}, ${them.player.handle} ${them.points}. ${clock(left)} to the bell.`} />}
        {rich && race && closed && (
          <Svg
            source={result({
              outcome: rankedOutcome(sm, me),
              mode: 'RANKED',
              race,
              delta,
              ratingBefore: mine.rating_before,
              ratingAfter: mine.rating_after ?? mine.rating_before,
              commits: { mine: mine.commits, theirs: them.commits },
              biggest: { points: mine.biggest_commit?.points ?? 0, craft: (mine.biggest_commit?.craft as 'clean' | 'neutral' | 'sloppy' | undefined) ?? 'neutral' },
              placing: placingOfSide(mine),
            })}
            alt={line}
          />
        )}
        {(!rich || !race) && (
          <Text bold>
            Ranked {sm.length}h · {mine.player.handle} {mine.points} vs {them.points} {them.player.handle} · {closed ? line : sm.deadline ? `${clock(left)} to the bell` : sm.status}
          </Text>
        )}
        {closed && rich && <Text bold>{line}</Text>}
        {sm.status === 'grace' && <Text color={ORANGE}>{MOD.counting}</Text>}
        {hot && them.points > mine.points && (
          <Text bold color={ORANGE}>
            {LINES.behind(them.points - mine.points)}
          </Text>
        )}
        {sm.status === 'live' && asking ? (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Text bold color={ORANGE}>
              {LINES.forfeit}
            </Text>
            <Button key="ranked-forfeit-yes" label="Forfeit" onPress={() => a.rankedForfeit()} />
            <Button key="ranked-forfeit-no" label="Keep playing" variant="primary" onPress={() => a.askForfeit(false)} />
          </Box>
        ) : (
          <Box gap={1} flexWrap="wrap">
            {live && <Button key="ranked-titles" label={`Titles: ${s.share ? 'shown' : 'private'}`} onPress={() => a.setShare(!s.share)} />}
            {sm.status === 'live' && <Button key="ranked-forfeit" label="Forfeit" onPress={() => a.askForfeit(true)} />}
            {closed && <Button key="ranked-again" label="Queue again" variant="primary" onPress={() => a.queueAgain()} />}
            {closed && <Button key="ranked-recap" label="Copy recap" onPress={x => a.copyRecap(x.surface)} />}
            {closed && <Button key="ranked-clear" label="Dismiss" onPress={() => a.rankedClear()} />}
          </Box>
        )}
        {rich && scores.length > 0 ? (
          <Svg
            source={feedSvg(scores.map(x => ({ at: hhmm(Date.parse(x.at)), mine: x.handle === me, handle: x.handle, points: x.points, craft: x.craft, category: x.category, title: x.title, files: x.files, lines: x.lines_added + x.lines_deleted })))}
            alt={`Feed: ${scores.map(x => `${x.handle} +${x.points} ${x.category}`).join('; ')}`}
          />
        ) : scores.length > 0 ? (
          scores.map(x => (
            <Text color={x.handle === me ? undefined : STONE} wrap="truncate-end">
              {hhmm(Date.parse(x.at))} {x.handle.padEnd(11)} +{x.points} {x.category}
              {x.title ? ` · ${clean(x.title)}` : ` · ${x.files} file${x.files === 1 ? '' : 's'}, ${x.lines_added + x.lines_deleted} lines`}
            </Text>
          ))
        ) : (
          <Text dimColor>No commits yet. Only commits score.</Text>
        )}
        {s.surfaces.chat === 'on' ? (
          <Box flexDirection="column">
            <Text dimColor>{LINES.chatExplainer}</Text>
            {!them.chat_enabled && <Text dimColor>{them.player.handle} has chat off.</Text>}
            {chats.map(c => (
              <Box gap={1}>
                <Text bold color={c.handle === me ? ORANGE : undefined}>
                  {clean(c.handle)}:
                </Text>
                <Text wrap="truncate-end">{clean(c.text)}</Text>
              </Box>
            ))}
            {them.chat_enabled && e.surface !== 'mobile' && (
              <Input key="ranked-chat" placeholder={LINES.chatPlaceholder[chats.length % 2]} submitLabel="Send" value={draft} onInput={v => a.setDraft(v)} onSubmit={v => a.rankedChat(v)} />
            )}
          </Box>
        ) : (
          <Text dimColor>Chat is off. {them.player.handle} can see that.</Text>
        )}
      </Box>
    )
  }
  return <Text dimColor>Checking with the server.</Text>
}

async function matchTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Input } = els
  const rich = e.surface !== 'terminal'
  const m = await read($, match)
  const s = await read($, settings)
  const hist = await read($, history)
  const draft = await read($, chatDraft)
  const asking = await read($, forfeitAsk)
  const ranked = await rankedBox($, e, els, a, t)
  // While ranked is busy (queued, a ready check, a match, a result), practice steps aside.
  if ((await rankedShared($)).phase !== 'idle') return ranked

  if (!m) {
    return (
      <Box flexDirection="column" gap={1}>
        {ranked}
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          <Text bold color={STONE}>
            PRACTICE
          </Text>
          <Text dimColor>{MOD.practice}</Text>
          <Box gap={1} flexWrap="wrap">
            <Button key="m-1" label="1h" onPress={() => a.start(1)} />
            <Button key="m-3" label="3h" onPress={() => a.start(3)} />
            <Button key="m-sprint" label="5 min sprint" onPress={() => a.start(1 / 12)} />
          </Box>
          {hist.length > 0 && (
            <Text dimColor wrap="truncate-end">
              Last practice: {resultWord(hist[0] as Match)} {(hist[0] as Match).myPoints}-{(hist[0] as Match).oppPoints} vs {(hist[0] as Match).opp.handle}
            </Text>
          )}
        </Box>
        {rich && hist.length > 0 && (
          <Svg
            source={recentMatches(
              hist.slice(0, 3).map(past => ({
                day: DAYS[(new Date(past.startAt).getDay() + 6) % 7] ?? '',
                result: outcomeOf(past),
                hours: past.hours,
                mine: past.myPoints,
                theirs: past.oppPoints,
                opponent: past.opp.handle,
                opponentRating: past.opp.rating,
                delta: past.kind === 'practice' && past.ratingAfter !== undefined ? past.ratingAfter - past.ratingBefore : 0,
                series: seriesOf(past),
              })),
            )}
            alt={`Recent practice: ${hist.slice(0, 3).map(past => `${resultWord(past)} ${past.myPoints}-${past.oppPoints} vs ${past.opp.handle}`).join('; ')}`}
          />
        )}
      </Box>
    )
  }

  const live = m.status === 'live'
  const oppPts = liveOpp(m, t)
  const span = m.deadline - m.startAt
  const label = m.kind === 'replay' ? `REPLAY · ${(m.label ?? '').toUpperCase().slice(0, 40)}` : `PRACTICE · ${hoursLabel(m.hours)}`
  const clockText = live ? clock(m.deadline - t) : resultWord(m).toUpperCase()
  const statusText = live
    ? `${m.opp.handle} · ${tierOf(m.opp.rating)} ${m.opp.rating} · paces ${Math.round(m.opp.pace)} pts/h`
    : m.kind === 'replay'
      ? `unrated replay over ${dur(span)} · bot seeded from the session`
      : `rating ${m.ratingBefore} -> ${m.ratingAfter ?? m.ratingBefore}`
  const feed = [...m.feed, ...m.plan.filter(p => p.at <= Math.min(t, m.deadline))].sort((x, y) => y.at - x.at)
  const w = Math.max(8, Math.min(30, e.props.bodyColumns - 26))
  const total = m.myPoints + oppPts

  return (
    <Box flexDirection="column" gap={1}>
      {!live && <Text bold>{resultLine(m)}</Text>}
      {rich && !live ? (
        <Svg
          source={result({
            outcome: outcomeOf(m),
            mode: modeOf(m),
            race: raceOf(m, s.handle, t),
            delta: (m.ratingAfter ?? m.ratingBefore) - m.ratingBefore,
            ratingBefore: m.ratingBefore,
            ratingAfter: m.ratingAfter ?? m.ratingBefore,
            commits: { mine: m.feed.filter(f => f.who === 'me').length, theirs: m.plan.filter(p => p.at <= Math.min(m.endedAt ?? m.deadline, m.deadline)).length },
            biggest: { points: Math.max(0, ...m.feed.filter(f => f.who === 'me').map(f => f.points)), craft: 'neutral' },
          })}
          alt={`${resultWord(m)}: ${s.handle} ${m.myPoints}, ${m.opp.handle} ${oppPts}.`}
        />
      ) : rich ? (
        <Box flexDirection="column">
          <Svg source={raceClimb(raceOf(m, s.handle, t))} alt={`${label}. ${s.handle} ${m.myPoints}, ${m.opp.handle} ${oppPts}. ${clockText} to the bell.`} />
          <Text dimColor>{statusText}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box gap={2}>
            <Text bold color={ORANGE}>{label}</Text>
            <Text bold>{clockText}</Text>
          </Box>
          <Text>
            {s.handle.padEnd(12)} <Text color={ORANGE}>{bar(total ? m.myPoints / Math.max(m.myPoints, oppPts) : 0, w)}</Text> {m.myPoints}
          </Text>
          <Text>
            {m.opp.handle.padEnd(12)} {bar(total ? oppPts / Math.max(m.myPoints, oppPts) : 0, w)} {oppPts}
          </Text>
          <Text dimColor>{statusText}</Text>
        </Box>
      )}
      {live && asking ? (
        <Box gap={1} alignItems="center" flexWrap="wrap">
          <Text bold color={ORANGE}>
            {LINES.forfeit}
          </Text>
          <Button key="forfeit-yes" label="Forfeit" onPress={() => a.forfeit()} />
          <Button key="forfeit-no" label="Keep playing" variant="primary" onPress={() => a.askForfeit(false)} />
        </Box>
      ) : (
        <Box gap={1}>
          {live && <Button key="forfeit" label="Forfeit" onPress={() => a.askForfeit(true)} />}
          {!live && <Button key="new" label="New match" variant="primary" onPress={() => a.clearMatch()} />}
          <Button key="share" label={`Titles: ${s.share ? 'shown' : 'private'}`} onPress={() => a.setShare(!s.share)} />
        </Box>
      )}
      {rich && feed.length > 0 ? (
        <Svg
          source={feedSvg(
            feed.slice(0, 12).map(f => ({
              at: hhmm(f.at),
              mine: f.who === 'me',
              handle: f.who === 'me' ? s.handle : m.opp.handle,
              points: f.points,
              craft: 'neutral',
              category: f.category,
              title: f.who === 'me' && f.title ? clean(f.title) : null,
              files: 0,
              lines: 0,
            })),
          )}
          alt={`Feed: ${feed.slice(0, 12).map(f => `${f.who === 'me' ? s.handle : m.opp.handle} +${f.points} ${f.category}`).join('; ')}`}
        />
      ) : (
      <Box flexDirection="column">
        <Text bold>Feed</Text>
        {feed.length === 0 && <Text dimColor>No points yet. The first commit lands here within a couple of seconds.</Text>}
        {feed.slice(0, 12).map(f => (
          <Text color={f.who === 'me' ? undefined : STONE} wrap="truncate-end">
            {new Date(f.at).toTimeString().slice(0, 5)} {f.who === 'me' ? s.handle.padEnd(11) : m.opp.handle.padEnd(11)} +{f.points} {f.category}
            {f.who === 'me' && f.title ? ` · ${clean(f.title)}` : ''}
          </Text>
        ))}
      </Box>
      )}
      {m.kind === 'practice' && s.surfaces.chat !== 'on' && <Text dimColor>Chat is off. Your opponent sees "chat off". Turn it back on in Settings.</Text>}
      {m.kind === 'practice' && s.surfaces.chat === 'on' && (
        <Box flexDirection="column">
          <Text dimColor>{LINES.chatExplainer}</Text>
          {m.chat.slice(-8).map(c => (
            <Box gap={1}>
              <Text bold color={c.who === s.handle ? ORANGE : undefined}>
                {clean(c.who)}:
              </Text>
              <Text wrap="truncate-end">{clean(c.text)}</Text>
            </Box>
          ))}
          {live && e.surface !== 'mobile' && (
            <Input key="chat" placeholder={LINES.chatPlaceholder[m.chat.length % 2]} submitLabel="Send" value={draft} onInput={v => a.setDraft(v)} onSubmit={v => a.chat(v)} />
          )}
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------- ranked tab

// The mock standings everything shares (Jaen, 2026-10-07): jaen is #1 at 1712, 41-9, and
// is the one row left out here, since your own row is your real practice rating.
const SAMPLE: [string, number, string][] = [
  ['10xgary', 1688, '38-12'],
  ['nova_ships', 1655, '36-14'],
  ['rk', 1488, '30-14'],
  ['vex', 1391, '27-15'],
  ['tokyo_drift', 1340, '22-16'],
  ['quietcommit', 902, '5-11'],
]

async function rankedTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Svg } = els
  const rich = e.surface !== 'terminal'
  const l = await read($, link)
  if (l.me && l.ladder) return serverRanked(els, rich, l)
  const r = await read($, rating)
  const rec = await read($, record)
  const s = await read($, settings)
  const rows = [...SAMPLE.map(([handle, rt, wl]) => ({ handle, rt, wl, me: false })), { handle: s.handle, rt: r, wl: `${rec.w}-${rec.l}${rec.d ? `-${rec.d}` : ''}`, me: true }].sort((x, y) => y.rt - x.rt)
  const pw = Math.max(15, ...rows.map(row => row.handle.length + 2))

  const top = rows[0]
  return (
    <Box flexDirection="column" gap={1}>
      {top && numberOneCard(els, rich, { handle: top.handle, rating: top.rt, wins: Number(top.wl.split('-')[0]) || 0, losses: Number(top.wl.split('-')[1]) || 0 })}
      {rich ? <Svg source={ratingCard({ rating: r, wins: rec.w, losses: rec.l })} alt={`Practice rating ${r}, ${tierOf(r)}, ${rec.w}-${rec.l}.`} /> : null}
      {rich ? <Svg source={tierFrieze({ handle: s.handle, rating: r })} alt={`Tiers. You are ${tierOf(r)} at ${r}.`} /> : null}
      {rich ? (
        <Svg
          source={ladder(rows.map((row, i) => ({ rank: i + 1, handle: row.handle, rating: row.rt, wins: Number(row.wl.split('-')[0]) || 0, losses: Number(row.wl.split('-')[1]) || 0, me: row.me })))}
          alt={`Sample ladder: ${rows.map((row, i) => `${i + 1} ${row.handle} ${row.rt}`).join('; ')}`}
        />
      ) : null}
      <Text dimColor>Sample ladder with made-up players. Your row is real: your practice rating and record. The live ladder comes with the server.</Text>
      {!rich && (
        <Box flexDirection="column">
          <Text bold>{'#'.padEnd(4)}{'Player'.padEnd(pw)}{'Tier'.padEnd(10)}{'Elo'.padEnd(6)}W-L</Text>
          {rows.map((row, i) => (
            <Text bold={row.me} color={row.me ? ORANGE : undefined}>
              {String(i + 1).padEnd(4)}
              {row.handle.padEnd(pw)}
              {tierOf(row.rt).padEnd(10)}
              {String(row.rt).padEnd(6)}
              {row.wl}
            </Text>
          ))}
        </Box>
      )}
      <Text dimColor>
        Elo: K 40 for your first 10 matches, then 24. Win, loss or draw only. Tiers: Mud, Iron 650, Bronze 800, Silver 950, Gold 1100, Platinum 1250, Diamond 1400, Master 1600.
      </Text>
    </Box>
  )
}

/** The Ranked tab from the server: your card (Mud while placing), the frieze, the top 10 and your row. */
function serverRanked(els: El, rich: boolean, l: LinkState) {
  const { Box, Text, Svg } = els
  const me = l.me as ApiPlayer
  const placing = me.placement ?? undefined
  const rows = (l.ladder ?? []).map(x => ({ rank: x.rank, handle: x.player.handle, rating: x.player.rating, wins: x.w, losses: x.l, me: x.player.handle === me.handle }))
  const mineShown = rows.some(x => x.me)
  const ladderRows = mineShown || l.myRank === null ? rows : [...rows, null, { rank: l.myRank, handle: me.handle, rating: me.rating, wins: me.record.w, losses: me.record.l, me: true }]
  const top = l.ladder?.[0]
  return (
    <Box flexDirection="column" gap={1}>
      {top && numberOneCard(els, rich, { handle: top.player.handle, rating: top.player.rating, wins: top.w, losses: top.l })}
      {rich && <Svg source={ratingCard({ rating: me.rating, rank: l.myRank ?? undefined, wins: me.record.w, losses: me.record.l, placing })} alt={placing ? `Mud, placing ${placing.played} of ${placing.of}.` : `${me.tier} ${me.rating}${l.myRank ? `, #${l.myRank}` : ''}, ${me.record.w}-${me.record.l}.`} />}
      {rich && <Svg source={tierFrieze({ handle: me.handle, rating: me.rating, placing })} alt={placing ? 'Tiers. You are placing in Mud.' : `Tiers. You are ${me.tier} at ${me.rating}.`} />}
      {rich && ladderRows.length > 0 ? (
        <Svg source={ladder(ladderRows)} alt={`Ranked: ${rows.map(x => `${x.rank} ${x.handle} ${x.rating}`).join('; ')}`} />
      ) : (
        <Box flexDirection="column">
          {ladderRows.length === 0 && <Text dimColor>Nobody is ranked yet.</Text>}
          {ladderRows.map(x =>
            x ? (
              <Text bold={x.me} color={x.me ? ORANGE : undefined}>
                {String(x.rank).padEnd(4)}
                {x.handle.padEnd(16)}
                {String(x.rating).padEnd(6)}
                {x.wins}-{x.losses}
              </Text>
            ) : (
              <Text dimColor>...</Text>
            ),
          )}
        </Box>
      )}
      {placing ? <Text dimColor>{MOD.notRanked}</Text> : l.myRank && l.myRank > 30 ? <Text dimColor>{LINES.farDown(l.myRank)}</Text> : null}
    </Box>
  )
}

let roastIndex = 2

/** The #1 card (copy.md): the #1 player's coin and stat line, and one roast from the pool, a new one each visit to Ranked. */
function numberOneCard(els: El, rich: boolean, top: { handle: string; rating: number; wins: number; losses: number }) {
  const { Box, Text, Svg } = els
  const roast = (ROASTS[roastIndex % ROASTS.length] ?? '').replace(/\{handle\}/g, top.handle)
  if (rich) return <Svg source={numberOne({ ...top, roast })} alt={`${LINES.numberOne}: ${top.handle}, ${top.rating}. ${roast}`} />
  return (
    <Box flexDirection="column">
      <Text dimColor>{LINES.numberOne.toUpperCase()}</Text>
      <Text bold color={ORANGE}>
        {top.handle} · {tierOf(top.rating)} · {top.rating} Elo · {top.wins}-{top.losses}
      </Text>
      <Text>{roast}</Text>
    </Box>
  )
}

// ---------------------------------------------------------------- chat tab

const SYSTEM_LINE: Record<'placed' | 'promoted' | 'reached_number_one', (h: string, tier: string) => string> = {
  // Approved (docs/copy.md, "The mod").
  placed: (h, tier) => `${h} placed in ${tier}.`,
  promoted: (h, tier) => `${h} reached ${tier}.`,
  reached_number_one: h => `${h} is the new #1.`,
}

async function chatTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Input } = els
  const rich = e.surface !== 'terminal'
  const cfg = await serverCfg($)
  const l = await read($, link)
  const s = await read($, settings)
  const draft = await read($, chatDraft)
  if (!cfg.token)
    return (
      <Box flexDirection="column">
        <Text dimColor>Pick a handle in Settings to chat.</Text>
        <Button key="chat-join" label="Open Settings" onPress={() => a.setTab('settings')} />
      </Box>
    )
  if (s.surfaces.chat !== 'on') return <Text dimColor>Chat is off. Turn it on in Settings.</Text>
  const rooms = l.rooms ?? []
  const lines = (l.lobby && l.lobby.room === l.room ? l.lobby.events : []).slice(-12)
  const me = cfg.handle ?? ''
  const msgs = lines.map(x =>
    x.kind === 'chat'
      ? { at: hhmm(Date.parse(x.at)), handle: x.player.handle, tier: x.player.tier.toLowerCase() as TierKey, rank: x.rank ?? undefined, text: x.text, mine: x.player.handle === me }
      : { at: hhmm(Date.parse(x.at)), handle: x.handle, tier: x.tier.toLowerCase() as TierKey, text: SYSTEM_LINE[x.event](x.handle, x.tier), system: true },
  )
  const open = rooms.filter(x => x.can_post)
  const roomName = (r: string) => (r === 'world' ? 'World' : `${r[0]?.toUpperCase()}${r.slice(1)} room`)
  return (
    <Box flexDirection="column" gap={1}>
      {rich && rooms.length > 0 && <Svg source={chatRooms({ rooms: rooms.map(x => ({ key: x.room as 'world' | TierKey, online: x.online, open: x.can_post })), current: l.room as 'world' | TierKey })} alt={`Chat rooms. ${roomName(l.room)}, ${rooms.find(x => x.room === l.room)?.online ?? 0} online.`} />}
      <Box gap={1} alignItems="center" flexWrap="wrap">
        {open.map(x => (
          <Button key={`room-${x.room}`} label={roomName(x.room)} variant={x.room === l.room ? 'primary' : 'secondary'} onPress={() => a.setRoom(x.room)} />
        ))}
        {rooms.length > open.length && <Text dimColor>{MOD.locked}</Text>}
      </Box>
      {rich ? (
        <Svg source={chatLog({ me, messages: msgs })} alt={msgs.length ? msgs.map(m => `${m.handle}: ${m.text}`).join(' / ') : 'No messages yet.'} />
      ) : (
        <Box flexDirection="column">
          {msgs.length === 0 && <Text dimColor>quiet in here</Text>}
          {msgs.map(m => (
            <Text dimColor={!!m.system} color={m.mine ? ORANGE : undefined} wrap="truncate-end">
              {m.at} {m.system ? m.text : `${m.handle}: ${clean(m.text)}`}
            </Text>
          ))}
        </Box>
      )}
      {e.surface !== 'mobile' && <Input key="room-chat" placeholder={LINES.chatPlaceholder[msgs.length % 2]} submitLabel="Send" value={draft} onInput={v => a.setDraft(v)} onSubmit={v => a.roomChat(v)} />}
      <Text dimColor>Drawn here only. Chat never reaches Claude's context.</Text>
      {l.note && <Text color={ORANGE} wrap="wrap">{l.note}</Text>}
    </Box>
  )
}

// ---------------------------------------------------------------- backtest tab

async function backtestTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg } = els
  const rich = e.surface !== 'terminal'
  const list = await read($, sessions)
  const runs = await read($, backtests)
  const note = await read($, sessionsNote)
  const open = await read($, expanded)
  const limit = await read($, btLimit)
  const scored = list.filter(s => ['done', 'partial', 'running'].includes(runs[s.id]?.status ?? ''))
  const sum = scored.reduce((n, s) => n + (runs[s.id]?.points ?? 0), 0)

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Button key="back-grind" label="Back to the Grind" onPress={() => a.setTab('grind')} />
      </Box>
      <Text>How would your past Claude Code sessions have scored? Each session's window is its first to last message; commits you authored in its repo inside that window count.</Text>
      <Box gap={1} flexWrap="wrap" alignItems="center">
        <Button key="bt-7" label="Load 7 days" variant={list.length ? 'secondary' : 'primary'} onPress={() => a.loadSessions(7)} />
        <Button key="bt-14" label="14 days" onPress={() => a.loadSessions(14)} />
        {list.length > 0 && <Button key="bt-all" label={`Score all ${Math.min(list.length, limit)} shown`} variant="primary" onPress={() => a.backtestAll()} />}
        <Text dimColor>{note || 'Nothing loaded yet'}</Text>
      </Box>
      {rich && scored.length > 0 && (
        <Svg
          source={sessionBars(scored.slice(0, 12).map(s => ({ label: s.title, points: runs[s.id]?.points ?? 0, pending: runs[s.id]?.status === 'running' })))}
          alt={`${scored.length} sessions scored, ${sum} points in all.`}
        />
      )}
      {scored.length > 0 && (
        <Text bold>
          {sum} points across {scored.length} scored session{scored.length === 1 ? '' : 's'} (a commit inside two sessions' windows counts in both here)
        </Text>
      )}
      {list.slice(0, limit).map(s => sessionRow(els, s, runs[s.id], open === s.id, a, e.props.bodyColumns, t))}
      {list.length > limit && <Button key="bt-more" label={`Show more (${list.length - limit})`} onPress={() => a.more()} />}
    </Box>
  )
}

function sessionRow(els: El, s: PastSession, run: BacktestRun | undefined, isOpen: boolean, a: Actions, cols: number, t: number) {
  const { Box, Text, Button } = els
  const status = !run
    ? 'not scored'
    : run.status === 'running'
      ? `scoring ${run.done}/${run.total || '?'}`
      : run.status === 'error'
        ? `error: ${run.note}`
        : run.total === 0
          ? 'no commits'
          : `${run.points} pts · ${run.commits.length} commit${run.commits.length === 1 ? '' : 's'}${run.status === 'partial' ? ' · partial' : ''}`
  return (
    <Box key={`s-${s.id}`} flexDirection="column" borderStyle="round" borderColor="#34302B" paddingX={1}>
      <Box justifyContent="space-between" gap={1}>
        <Text bold wrap="truncate-end">{s.title.slice(0, Math.max(20, cols - 34))}</Text>
        <Text color={run?.status === 'done' && run.points > 0 ? ORANGE : STONE}>{status}</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {s.project} · {when(s.startAt)} · {dur(s.endAt - s.startAt)} · {ago(s.endAt, Math.max(t, s.endAt))}
      </Text>
      {run?.status === 'partial' && <Text dimColor wrap="wrap">{run.note}</Text>}
      <Box gap={1}>
        {(!run || run.status !== 'running') && <Button key={`bt-${s.id}`} label={run ? 'Rescore' : 'Score'} onPress={() => a.backtest(s.id)} />}
        {(run?.status === 'done' || run?.status === 'partial') && run.commits.length > 0 && <Button key={`race-${s.id}`} label="Race it" onPress={() => a.race(s.id)} />}
        {(run?.status === 'done' || run?.status === 'partial') && run.commits.length > 0 && (
          <Button key={`ex-${s.id}`} label={isOpen ? 'Hide commits' : 'Commits'} dimColor onPress={() => a.expand(isOpen ? null : s.id)} />
        )}
      </Box>
      {isOpen && run && run.commits.map(c => commitRow(els, c, cols))}
    </Box>
  )
}

// ---------------------------------------------------------------- lab tab

async function labTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Code, Markdown, Link, Select } = els
  const rich = e.surface !== 'terminal'
  const note = await read($, labNote)
  let surfaces: readonly string[] = []
  try {
    surfaces = await $.session.surfaces()
  } catch {}
  return (
    <Box flexDirection="column" gap={1}>
      <Text>Every drawing piece the mods API gives this surface, live. Press things.</Text>
      <Text dimColor>
        surface {e.surface} · pane {e.props.placement} · {e.props.bodyColumns} columns wide{e.viewport ? ` · viewport ${e.viewport.columns}x${e.viewport.rows}` : ''} · session draws on {surfaces.join(', ') || 'nothing'}
      </Text>
      <Box gap={1} flexWrap="wrap">
        <Button key="lab-toast" label="Toast" onPress={p => a.lab('toast', p.surface)} />
        <Button key="lab-status" label="Status line" onPress={p => a.lab('status', p.surface)} />
        <Button key="lab-ask" label="Ask dialog" onPress={p => a.lab('ask', p.surface)} />
        <Button key="lab-copy" label="Copy to clipboard" onPress={p => a.lab('copy', p.surface)} />
        <Button key="lab-dialog" label="Pane as dialog" onPress={p => a.lab('dialog', p.surface)} />
        <Button key="lab-git" label="Git check" variant="primary" onPress={p => a.lab('git', p.surface)} />
        <Button key="lab-judge" label="Judge ping" onPress={p => a.lab('judge', p.surface)} />
        <Button key="lab-calibrate" label="Calibrate (10 commits x2, uses your plan)" onPress={p => a.lab('calibrate', p.surface)} />
      </Box>
      {note ? <Text color={ORANGE} wrap="wrap">{note}</Text> : null}
      <Text bold>Hover card</Text>
      <Box key="hover-demo" flexDirection="column">
        <Text>Point at this row: a card appears over it, no hook runs.</Text>
        <Box position="absolute" top={-3} left={4} display="none" hover={{ display: 'flex' }} borderStyle="round" borderColor={ORANGE} paddingX={1} backgroundColor="#141312">
          <Text color="#E6DED1">+8 · feature · per-workspace rate limits</Text>
        </Box>
      </Box>
      <Text bold>Markdown</Text>
      <Markdown text={'**Story points** add up: ten small commits of one feature earn about what one big commit would.\n\n| pts | typical |\n|---|---|\n| 3 | a fix that took digging |\n| 8 | a feature with a migration |\n\nSite: [ccsr.gg](https://ccsr.gg)'} />
      <Text bold>Code, as a diff</Text>
      <Code format="diff" path="src/rate-limit.ts" language="ts" source={'@@ -1,3 +1,4 @@\n import { Hono } from "hono"\n-const LIMIT = 100\n+const LIMIT = Number(process.env.RATE_LIMIT ?? 100)\n+const perWorkspace = new Map<string, number>()\n export const app = new Hono()'} />
      {e.surface !== 'mobile' && (
        <Select
          key="lab-select"
          label="Select"
          options={[{ value: 'olympia', label: 'Olympia' }, { value: 'stadion', label: 'Stadion' }, { value: 'temple', label: 'Temple' }]}
          onSelect={(v, p) => a.lab(`select:${v}`, p.surface)}
        />
      )}
      <Link href="https://code.claude.com/docs/en/plugins/mods/overview" label="Mods docs" />
      {rich ? (
        <Box flexDirection="column">
          <Text bold>Interactive SVG (CSS hover and SMIL animation, no script)</Text>
          <Svg isInteractive alt="A coin spinning on a column" source={coinSvg()} />
        </Box>
      ) : (
        <Text dimColor>Svg is a desktop element. The terminal gets Raster and Image instead.</Text>
      )}
    </Box>
  )
}

function coinSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="140" viewBox="0 0 720 140"><style>.c{transition:transform .3s;transform-origin:360px 60px}.c:hover{transform:scale(1.25)}</style><rect width="720" height="140" rx="6" fill="#141312"/><g class="c"><ellipse cx="360" cy="60" rx="34" ry="34" fill="#FF6A2A" stroke="#E6DED1" stroke-dasharray="3 3"><animate attributeName="rx" values="34;4;34" dur="2.4s" repeatCount="indefinite"/></ellipse><text x="360" y="66" text-anchor="middle" font-family="ui-monospace,monospace" font-size="16" font-weight="700" fill="#141312">CC<animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite"/></text></g><text x="360" y="124" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#9A9286" letter-spacing="2">HOVER THE COIN</text><text x="24" y="24" font-family="ui-monospace,monospace" font-size="9" fill="#34302B">0110100101101001011010010110100101101001</text></svg>`
}

// ---------------------------------------------------------------- settings tab

/** "4 min ago" from an ISO time. */
function ago(iso: string | null, now: number) {
  if (!iso) return 'never'
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (m < 1) return 'now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

/** Settings, signed in: the recovery key, the account's installs, link another, remove this one. */
async function accountRows($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button } = els
  const l = await read($, link)
  const cfg = await serverCfg($)
  const now = await $.clock.now()
  const has = l.account?.has_recovery_key ?? false
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text dimColor wrap="wrap">
          {!has ? ACCOUNT.noKey : cfg.recoveryKey ? ACCOUNT.hasKey : ACCOUNT.keyElsewhere}
        </Text>
        <Box gap={1}>
          {has && cfg.recoveryKey && <Button key="recovery-copy-settings" label={ACCOUNT.copyKey} onPress={() => a.copyRecoveryKey(e.surface)} />}
          <Button key="recovery-new" label={ACCOUNT.newKey} variant={has ? 'secondary' : 'primary'} onPress={() => a.newRecoveryKey()} />
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold color={STONE}>
          {ACCOUNT.installs.toUpperCase()}
        </Text>
        {(l.installs ?? []).map(i => (
          <Box key={`install-${i.id}`} gap={1} alignItems="center">
            <Text wrap="truncate-end">
              {i.label || 'unnamed'} · {i.this ? ACCOUNT.thisInstall : ACCOUNT.seen(ago(i.last_seen_at, now))}
            </Text>
            {!i.this && <Button key={`install-remove-${i.id}`} label={ACCOUNT.remove} onPress={() => a.removeInstall(i.id)} />}
          </Box>
        ))}
        {l.linkCode && Date.parse(l.linkCode.expiresAt) > now ? (
          <Text color={ORANGE} wrap="wrap">
            {ACCOUNT.codeShown(l.linkCode.code)}
          </Text>
        ) : null}
        <Box gap={1}>
          <Button key="link-another" label={ACCOUNT.linkAnother} onPress={() => a.makeLinkCode()} />
          <Button key="remove-this" label={ACCOUNT.removeThis} variant={l.confirmRemove ? 'primary' : 'secondary'} onPress={() => a.removeThisInstall()} />
        </Box>
      </Box>
    </Box>
  )
}

async function settingsTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button, Input, Select, Link } = els
  const s = await read($, settings)
  const r = await read($, rating)
  const list = await read($, ledger)
  const sw = s.surfaces
  const l = await read($, link)
  const cfg = await serverCfg($)
  // The Server section's lines: approved with the rest of the mod's copy (docs/copy.md, "The mod").
  const server = (
    <Box flexDirection="column">
      <Text bold>Server</Text>
      <Text dimColor wrap="truncate-end">
        {cfg.url} · {l.online === null ? 'not checked yet' : l.online ? 'online' : 'offline'}
        {l.outbox ? ` · ${l.outbox} score${l.outbox === 1 ? '' : 's'} waiting to send` : ''}
        {l.season ? ` · season ${l.season.id}: ${l.season.model}, ${l.season.rubric}` : ''}
      </Text>
      {l.me ? (
        <Text>
          Signed in as {l.me.handle} · {l.me.placement ? `${l.me.tier}, placing ${l.me.placement.played} of ${l.me.placement.of}` : `${l.me.tier} ${l.me.rating}`}
        </Text>
      ) : cfg.token && !l.unknownToken ? (
        <Text dimColor>Signed in as {cfg.handle}; checking with the server.</Text>
      ) : (
        await joinBlock($, e, els, a, '')
      )}
      {l.me && (await accountRows($, e, els, a))}
      {l.note && <Text color={ORANGE} wrap="wrap">{l.note}</Text>}
      {e.surface !== 'mobile' && <Input key="server-url" label="Server URL" value={cfg.url} submitLabel="Use" onSubmit={v => a.setServer(v)} />}
    </Box>
  )
  return (
    <Box flexDirection="column" gap={1}>
      {server}
      {e.surface !== 'mobile' && <Input key="handle" label="Handle" value={s.handle} submitLabel="Save" onSubmit={v => a.setHandle(v)} />}
      <Box gap={1} alignItems="center">
        <Text>Grind tracking</Text>
        <Button key="track-on" label="On" variant={s.tracking ? 'primary' : 'secondary'} onPress={() => a.setTracking(true)} />
        <Button key="track-off" label="Off" variant={s.tracking ? 'secondary' : 'primary'} onPress={() => a.setTracking(false)} />
      </Box>
      <Box gap={1} alignItems="center">
        <Text bold>Surfaces</Text>
        <Button key="preset-full" label="Full" variant={presetOf(sw) === 'full' ? 'primary' : 'secondary'} onPress={() => a.setPreset('full')} />
        <Button key="preset-quiet" label="Quiet" variant={presetOf(sw) === 'quiet' ? 'primary' : 'secondary'} onPress={() => a.setPreset('quiet')} />
        {presetOf(sw) === 'custom' && <Text dimColor>Custom</Text>}
      </Box>
      {SURFACE_ROWS.map(row =>
        row[0] === 'group' ? (
          <Text bold color={STONE}>
            {row[1].toUpperCase()}
          </Text>
        ) : (
          <Box flexDirection="column">
            <Box gap={1} alignItems="center" flexWrap="wrap">
              <Text>{row[1]}</Text>
              {row[2].map(([value, label]) => (
                <Button key={`sw-${row[0]}-${value}`} label={label} variant={sw[row[0] as SurfaceKey] === value ? 'primary' : 'secondary'} onPress={() => a.setSurface(row[0] as SurfaceKey, value)} />
              ))}
            </Box>
            <Text dimColor>{SURFACE_WHAT[row[0] as SurfaceKey]}</Text>
          </Box>
        ),
      )}
      <Text dimColor>These stay on this machine and apply to every session; chat off also tells your opponent. The match-found check can't be turned off.</Text>
      <Box gap={1} alignItems="center">
        <Text>Show my commit titles to opponents</Text>
        <Button key="share-on" label="On" variant={s.share ? 'primary' : 'secondary'} onPress={() => a.setShare(true)} />
        <Button key="share-off" label="Off" variant={s.share ? 'secondary' : 'primary'} onPress={() => a.setShare(false)} />
      </Box>
      {e.surface !== 'mobile' && (
        <Select
          key="model"
          label="Judge model (one per season once ranked exists)"
          value={s.model}
          options={[
            { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (pinned, default)' },
            { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (cheaper)' },
            { value: 'sonnet', label: 'sonnet (alias)' },
          ]}
          onSelect={v => a.setModel(v)}
        />
      )}
      <Box gap={1} flexWrap="wrap">
        <Button key="reset-rating" label={`Reset practice rating (${r})`} onPress={() => a.resetRating()} />
        <Button key="reset-grind" label={`Reset Grind: tracking starts now (${list.length} commits)`} onPress={() => a.resetGrind()} />
      </Box>
      <Text bold>What leaves your machine</Text>
      <Text dimColor>Your code never leaves your machine. Only the points do. And the trash talk.</Text>
      <Text dimColor>
        Each scored commit sends its points, category, size and author time, with salted hashes standing in for the repo and the commit. Its title goes only if you share titles. Each judge call runs on your own Claude plan, one call per new commit. Rubric {RUBRIC}.
      </Text>
      <Text bold>Version</Text>
      <Text dimColor>{MOD.version(VERSION)}</Text>
      <Text dimColor>{MOD.autoUpdate}</Text>
      {l.release && standing(l.release) !== 'current' && (
        <Box gap={1} alignItems="center" flexWrap="wrap">
          <Text>{MOD.updateOut(l.release.latest)}</Text>
          <Button key="settings-update" label="Update" onPress={x => a.updateMod(x.surface)} />
        </Box>
      )}
      {l.updateNote && (
        <Text dimColor wrap="wrap">
          {l.updateNote}
        </Text>
      )}
      <Text bold>Report a bug</Text>
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Text>Tag or DM</Text>
        <Link href="https://x.com/speedrunjaen" label="@speedrunjaen" />
        <Text>on X.</Text>
      </Box>
    </Box>
  )
}


// ================================================================== REGISTER

const PANE = 'ccsr'
const READY = 'ccsr-ready'
const LIVE_WINDOW = 10 * 60_000

const HELP = `CCSR commands:
/ccsr                    open the CCSR pane
/ccsr grind              this week, month and all time
/ccsr scan               look for new commits now
/ccsr backfill           score this week's commits since Monday
/ccsr backtest [days]    score your past sessions (default 7 days)
/ccsr match 1h|3h|sprint practice match against a bot
/ccsr forfeit            give up the live match
/ccsr tracking on|off    Grind tracking
/ccsr share on|off       show your commit titles to opponents
/ccsr band on|off        the bar above the prompt
/ccsr quiet on|off       Quiet: the race band in a match, the noise around it off
/ccsr last               your last result as a scorecard
/ccsr handle <name>      set your handle
/ccsr status             one line of where you stand
Chat lives in the pane only, so it never reaches Claude.`

/**
 * A toast nobody asked for (a score, an opponent commit, a warning, a result):
 * shown only while toasts are on and Quiet is off. `ready` is the match-found
 * ready check, which no setting turns off. Replies to a button press or a
 * command are not ambient and always show.
 */
async function ambient($: $, text: string, kind: 'note' | 'match' | 'ready' = 'note', timeoutMs = 6000) {
  const p = (await read($, settings)).surfaces
  if (kind === 'ready' || p.toasts === 'all' || (p.toasts === 'match' && kind === 'match')) $.ui.toast(text, { timeoutMs })
}

/** One of the mod's sounds (mod/sounds/), while Sounds is on. */
async function ring($: $, name: 'chime' | 'bell' | 'win' | 'loss') {
  if ((await read($, settings)).surfaces.sounds !== 'on') return
  try {
    await $.audio.play({ asset: `sounds/${name}.wav` })
  } catch {
    // No player on this platform (a Linux or Windows terminal): stay quiet.
  }
}

async function refreshStatus($: $) {
  $.ui.status(await statusLine($))
}

function mmss(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** The status line for where the player is (docs/ui-spec.md, States): full, short, or off. */
async function statusLine($: $): Promise<string | undefined> {
  const s = await read($, settings)
  if (s.surfaces.status === 'off') return undefined
  const short = s.surfaces.status === 'short'
  const t = await $.clock.now()
  const cfg = await serverCfg($)
  const l = await read($, link)
  const sh = await rankedShared($)
  const placing = l.me?.placement ?? null
  const tier = l.me ? (placing ? `Mud, placing ${placing.played} of ${placing.of}` : `${l.me.tier} ${l.me.rating}`) : null
  if (sh.phase === 'queued') return short ? `◆ queue ${mmss(t - sh.since)}` : `◆ CCSR  in queue ${mmss(t - sh.since)} · ${sh.lengths.map(h => `${h}h`).join(' ')}`
  if (sh.phase === 'offered' && l.queue?.offer) {
    const left = mmss(Date.parse(l.queue.offer.expires_at) - t)
    return short ? `◆ accept ${left}` : `◆ CCSR  opponent found · accept in ${left}`
  }
  if (sh.phase === 'live' && l.ranked?.summary) {
    const sm = l.ranked.summary
    const { mine, them } = rankedSides(sm, cfg.handle ?? '')
    const score = `${mine.points}-${them.points}`
    if (sm.status === 'grace') return short ? `◆ counting ${score}` : `◆ CCSR  bell · counting · ${score}`
    if (l.online === false) return short ? `◆ offline · ${l.outbox} waiting` : `◆ CCSR  offline · ${l.outbox} score${l.outbox === 1 ? '' : 's'} waiting`
    const left = sm.deadline ? Date.parse(sm.deadline) - t : 0
    if (short) return `◆ ${score} · ${clock(left)}`
    const d = await read($, dirty)
    if (left <= 10 * 60_000 && d && d.files > 0) return `◆ CCSR  live ${score} · ${clock(left)} · ${d.files} file${d.files === 1 ? '' : 's'} uncommitted`
    return `◆ CCSR  live ${score} · ${clock(left)}${tier ? ` · ${tier}` : ''}`
  }
  const m = await read($, match)
  if (m && m.status === 'live' && m.kind === 'practice') {
    const score = `${m.myPoints}-${liveOpp(m, t)}`
    return short ? `◆ ${score} · ${clock(m.deadline - t)}` : `◆ CCSR  practice ${score} · ${clock(m.deadline - t)} · vs ${m.opp.handle}`
  }
  if (!cfg.token) return short ? '◆ CCSR · not set up' : '◆ CCSR · not set up · /ccsr to start'
  const wk = totals(await read($, ledger), periodStart('week', t), await read($, weekTotals))
  if (short) return `◆ ${placing ? `Mud ${placing.played}/${placing.of}` : (l.me?.rating ?? '')} · Grind ${wk.points}`
  return `◆ CCSR  ${tier ?? cfg.handle} · ${s.tracking ? `Grind ${wk.points} this week${l.grindRank ? ` · #${l.grindRank}` : ''}` : 'Grind off'}`
}

let lastDirtyAt = 0

/** Uncommitted files in this session's repo, for the last 10 minutes of a match. Every 30 seconds at most. */
async function checkDirty($: $) {
  const t = await $.clock.now()
  if (t - lastDirtyAt < 30_000) return
  lastDirtyAt = t
  try {
    const root = await repoRoot($, await $.session.cwd())
    if (!root) return
    const r = await git($, root, ['status', '--porcelain'], 10_000)
    if (r.exitCode === 0) await update($, dirty, () => ({ repo: repoName(root), files: r.stdout.split('\n').filter(x => x.trim()).length }))
  } catch {
    // No git here (or the Desktop app refused a process): the band just skips the count.
  }
}

async function onScore($: $, c: ScoredCommit) {
  // To the server: the Grind while tracking is on, and a ranked match whenever one is running.
  const ranked = (await read($, link)).ranked?.summary?.status
  if (!c.matchOnly || ranked === 'live' || ranked === 'grace') {
    await enqueue($, [c])
    void flushOutbox($)
  }
  const counted = (await syncMatch($)) > 0
  const where = counted || ranked === 'live' || ranked === 'grace' ? 'match' : 'grind'
  await update($, badges, all => {
    const hit = Object.entries(all).find(([, b]) => b.status === 'scoring' && c.sha.startsWith(b.sha))
    return hit ? { ...all, [hit[0]]: { ...hit[1], status: 'done' as const, where, points: c.points, base: c.base, category: c.category, craft: c.craft, reason: clean(c.reason) } } : all
  })
  if (c.authoredAt >= loadedAt - LIVE_WINDOW) turnPoints += c.points
  if (c.authoredAt >= loadedAt - LIVE_WINDOW) {
    const craft = c.craft === 'clean' ? ' · clean +1' : c.craft === 'sloppy' ? ' · sloppy -1' : ''
    await ambient($, `+${c.points} points · ${c.category}${craft} · ${clean(c.title).slice(0, 60)}${counted ? ' · counts in your match' : ''}`)
  }
  await refreshStatus($)
}

/**
 * Single-flight per session. A call made while a scan runs gets that scan and
 * asks for one more after it (forced if any caller wanted force), so a commit
 * landing mid-scan is never dropped. The slot clears as soon as the scan
 * settles, before anyone awaiting it resumes, so they can start a fresh one.
 */
function runScan($: $, force = false): Promise<ScanResult> {
  if (scanning) {
    rescan = { force: force || !!rescan?.force }
    return scanning
  }
  const job = scanGrind($, force, c => onScore($, c))
  scanning = job
  const settle = () => {
    if (scanning === job) scanning = null
    if (rescan && !scanning) {
      const again = rescan.force
      rescan = null
      void runScan($, again).catch(() => null)
    }
  }
  job.then(settle, settle)
  void job.then(() => afterScan($)).catch(() => null)
  return job
}

async function afterScan($: $) {
  await syncMatch($)
  await flushOutbox($)
  await refreshStatus($)
}

function scheduleScan($: $, ms = 1500) {
  scanSoon?.cancel()
  scanSoon = $.clock.after(ms, () => void runScan($).catch(err => $.ui.log(`CCSR scan: ${(err as Error).message}`)))
}

function startTicker($: $) {
  stopTicker?.()
  const timer = $.clock.every(1000, () => void tickOnce($, timer))
  stopTicker = () => timer.cancel()
}

async function tickOnce($: $, timer: { cancel: () => void }) {
  await tick($, text => void ambient($, text, 'note', 5000))
  const m = await read($, match)
  if (!m || m.status !== 'live') {
    timer.cancel()
    if (stopTicker) stopTicker = null
  }
  await refreshStatus($)
}

/** Every 30 seconds in every session: the clock moves, shared values refresh, a match another session started gets a ticker here too. */
async function slowSync($: $) {
  const t = await $.clock.now()
  await update($, now, () => t)
  await syncFromStore($)
  const m = await read($, match)
  if (m && m.status === 'live' && m.kind === 'practice' && !stopTicker) startTicker($)
  // Another session joined the queue or a match: follow it here too.
  const sh = await rankedShared($)
  if ((sh.phase === 'queued' || sh.phase === 'offered' || sh.phase === 'live') && !stopRankedPoll) startRankedPoll($)
  await flushOutbox($)
  await refreshStatus($)
}

async function openPane($: $, t?: Tab) {
  if (t) await update($, tab, () => t)
  return $.ui.open({ id: PANE, title: 'CCSR' })
}

async function startMatch($: $, hours: number) {
  const m = await startPractice($, hours)
  if (!m) {
    $.ui.toast('Finish or forfeit the live match first.')
    return null
  }
  startTicker($)
  await ambient($, `Match found: ${m.opp.handle} (${tierOf(m.opp.rating)} ${m.opp.rating}). Bell in ${clock(m.deadline - m.startAt)}. Only commits count.`, 'ready')
  await refreshStatus($)
  return m
}

/** One surface switch. Chat off is the one the server hears about, so the opponent sees "chat off". */
async function setSurface($: $, key: SurfaceKey, value: string) {
  await saveSettings($, { surfaces: { [key]: value } as Partial<Surfaces> })
  if (key === 'chat') await tellChat($)
  await refreshStatus($)
}

/** Full turns every surface on; Quiet keeps the race band in a match and cuts the noise around it. */
async function setPreset($: $, preset: 'full' | 'quiet') {
  await saveSettings($, { surfaces: { ...(preset === 'full' ? FULL : QUIET) } })
  await tellChat($)
  await refreshStatus($)
}

async function tellChat($: $) {
  if (!(await serverCfg($)).token) return
  const on = (await read($, settings)).surfaces.chat === 'on'
  if ((await read($, link)).me?.chat_enabled === on) return
  const r = await api($, 'PATCH', '/me', { chat_enabled: on })
  if (r.status === 200) await update($, link, l => ({ ...l, me: (r.json as { player: ApiPlayer }).player }))
}

/** Ask Claude to commit (the band at the bell): a line in the chat box. The player presses Enter; the mod never sends it. */
async function askCommit($: $) {
  try {
    await $.prompt.fill({ text: MOD.fill, mode: 'insert' })
  } catch {
    // The chat box isn't there (a headless session): nothing to fill.
  }
}

/** Copy recap: the last result in one line, scores and handles only. */
async function copyRecap($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const text = await recapText($)
  if (text) await $.ui.copy({ text, surface })
}

async function recapText($: $): Promise<string | null> {
  const l = await read($, link)
  const me = (await serverCfg($)).handle ?? ''
  const sm = l.ranked?.summary
  if (sm && (sm.status === 'finished' || sm.status === 'void')) {
    const { mine, them } = rankedSides(sm, me)
    const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
    const placing = mine.player.placement
    return `CCSR ${sm.length}h: ${mine.player.handle} ${mine.points}, ${them.player.handle} ${them.points}. ${placing ? `Mud, placing ${placing.played} of ${placing.of}` : `${delta >= 0 ? '+' : ''}${delta} to ${mine.rating_after ?? mine.rating_before}`}.`
  }
  const last = (await read($, history))[0]
  if (!last) return null
  const s = await read($, settings)
  return `CCSR practice ${hoursLabel(last.hours).toLowerCase()}: ${s.handle} ${last.myPoints}, ${last.opp.handle} ${last.oppPoints}.`
}

async function queueAgain($: $) {
  await clearRanked($)
  await joinQueue($)
}

async function setupSeen($: $) {
  await saveSettings($, { setupSeen: true })
}

async function backfill($: $) {
  const t = await $.clock.now()
  const monday = periodStart('week', t)
  const since = Math.min(await storeGet($, K.since, t), monday)
  await save($, K.since, since)
  await update($, trackingSince, () => since)
  const list = await discoverSessions($, 8)
  for (const root of await reposFromSessions($, list, monday)) await addRepo($, root)
  await settleScans()
  rescan = null
  const before = loadedAt
  loadedAt = Number.MAX_SAFE_INTEGER // no toast per commit during a backfill
  try {
    const r = await runScan($, true)
    const pts = r.added.reduce((n, c) => n + c.points, 0)
    $.ui.toast(
      `Scored this week: ${r.added.length} new commits, ${pts} points${r.errors.length ? ` · ${r.errors.length} problem${r.errors.length === 1 ? '' : 's'}, see the Grind tab` : ''}`,
      { timeoutMs: 6000 },
    )
    return r
  } finally {
    loadedAt = before
  }
}

async function backtestAll($: $) {
  const list = await read($, sessions)
  const limit = await read($, btLimit)
  const runs = await read($, backtests)
  for (const s of list.slice(0, limit)) {
    if (runs[s.id]?.status === 'done') continue
    await backtestSession($, s)
  }
}

async function resetGrind($: $) {
  const live = await storeGet<Match | null>($, K.match, null)
  if (live && live.status === 'live') return $.ui.toast('Finish or forfeit the live match first: its points come from the Grind ledger.')
  const t = await $.clock.now()
  await save($, K.since, t)
  await save($, K.ledger, [])
  await save($, K.weeks, {})
  await update($, trackingSince, () => t)
  await update($, ledger, () => [])
  await update($, weekTotals, () => ({}))
  await refreshStatus($)
}

async function resetRating($: $) {
  await save($, K.rating, START_RATING)
  await save($, K.record, { w: 0, l: 0, d: 0 })
  await update($, rating, () => START_RATING)
  await update($, record, () => ({ w: 0, l: 0, d: 0 }))
  await refreshStatus($)
}

async function raceSession($: $, id: string) {
  const stored = await storeGet<Match | null>($, K.match, null)
  if (stored && stored.status === 'live') return $.ui.toast('Finish or forfeit the live match first.')
  const s = (await read($, sessions)).find(x => x.id === id)
  const run = (await read($, backtests))[id]
  if (!s || !run) return
  const m = await replay($, s, run)
  await update($, tab, () => 'match')
  $.ui.toast(`Replay: ${m.myPoints} to ${m.oppPoints} vs ${m.opp.handle}`)
}

async function backtestOne($: $, id: string) {
  const s = (await read($, sessions)).find(x => x.id === id)
  if (s) await backtestSession($, s)
}

async function forfeit($: $) {
  await update($, forfeitAsk, () => false)
  await bell($, text => $.ui.toast(text, { timeoutMs: 6000 }), true)
  await refreshStatus($)
}

async function setHandle($: $, h: string) {
  const name = h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20)
  if (name.length < 2) return $.ui.toast('Handles are 2 to 20 of a-z, 0-9 and _.')
  await saveSettings($, { handle: name })
  $.ui.toast(`Handle set: ${name}`)
}

function actions($: $): Actions {
  const go = (p: Promise<unknown>) => {
    p.catch(err => $.ui.toast(`CCSR: ${clean((err as Error).message)}`))
  }
  return {
    setTab: t => go(selectTab($, t)),
    setPeriod: p => go(update($, period, () => p)),
    scanNow: () => go(runScan($, true)),
    backfillWeek: () => go(backfill($)),
    loadSessions: days => go(discoverSessions($, days)),
    backtest: id => go(backtestOne($, id)),
    backtestAll: () => go(backtestAll($)),
    race: id => go(raceSession($, id)),
    expand: id => go(update($, expanded, () => id)),
    more: () => go(update($, btLimit, n => n + 30)),
    start: hours => go(startMatch($, hours)),
    forfeit: () => go(forfeit($)),
    chat: text => go(sendChat($, text)),
    setDraft: text => go(update($, chatDraft, () => text)),
    clearMatch: () => go(clearMatch($).then(() => refreshStatus($))),
    open: t => go(openPane($, t)),
    setSurface: (key, value) => go(setSurface($, key, value)),
    askCommit: () => go(askCommit($)),
    copyRecap: surface => go(copyRecap($, surface)),
    queueAgain: () => go(queueAgain($)),
    setupSeen: () => go(setupSeen($)),
    askForfeit: isAsking => go(update($, forfeitAsk, () => isAsking)),
    setPreset: preset => go(setPreset($, preset)),
    setHandle: h => go(setHandle($, h)),
    setTracking: isOn => go(saveSettings($, { tracking: isOn }).then(() => refreshStatus($))),
    setShare: isOn => go(saveSettings($, { share: isOn })),
    setModel: m => go(saveSettings($, { model: m })),
    resetRating: () => go(resetRating($)),
    resetGrind: () => go(resetGrind($)),
    lab: (what, surface) => go(lab($, what, surface)),
    signup: h => go(signup($, h)),
    joinWithCode: code => go(joinWithCode($, code)),
    recoverWith: key => go(recoverWith($, key)),
    setJoinMode: mode => go(update($, joinMode, () => mode)),
    makeLinkCode: () => go(makeLinkCode($)),
    newRecoveryKey: () => go(newRecoveryKey($)),
    copyRecoveryKey: surface => go(copyRecoveryKey($, surface)),
    recoverySaved: () => go(update($, link, l => ({ ...l, recoveryFresh: false }))),
    removeInstall: id => go(removeInstall($, id)),
    removeThisInstall: () => go(removeThisInstall($)),
    setServer: url => go(setServerUrl($, url)),
    queue: () => go(joinQueue($)),
    leaveQueue: () => go(leaveQueue($)),
    toggleLength: h => go(toggleLength($, h)),
    accept: () => go(acceptOffer($)),
    decline: () => go(declineOffer($)),
    rankedForfeit: () => go(forfeitRanked($)),
    rankedChat: text => go(sendRankedChat($, text)),
    rankedClear: () => go(clearRanked($)),
    setRoom: room => go(setRoom($, room)),
    roomChat: text => go(postRoom($, text)),
    updateMod: surface => go(updateMod($, surface)),
  }
}

async function lab($: $, what: string, surface: string) {
  const note = (text: string) => update($, labNote, () => text)
  if (what === 'toast') {
    $.ui.toast('+8 points · feature · clean +1 · per-workspace rate limits', { timeoutMs: 6000 })
    return note('Toast sent: top right of the transcript, a click dismisses it.')
  }
  if (what === 'status') {
    $.ui.status('CCSR · Gold 1184 · Grind #212 this week · in a match')
    $.clock.after(6000, () => void refreshStatus($))
    return note('Status line replaced for 6 seconds, under the prompt.')
  }
  if (what === 'ask') {
    const answer = await $.ui.ask('Match found: 3H vs 10xgary (Gold 1184). Accept?', { header: 'CCSR', options: ['Accept', 'Decline'] })
    return note(`ui.ask answered: ${answer || '(dismissed)'}`)
  }
  if (what === 'copy') {
    const r = await $.ui.copy({ text: 'https://ccsr.gg/m/demo', surface: surface as 'desktop' })
    return note(r.isCopied ? 'Copied https://ccsr.gg/m/demo to your clipboard.' : `Copy refused: ${r.reason}`)
  }
  if (what === 'dialog') {
    const r = await $.ui.open({ id: READY, title: 'Match found', focus: true, closeOnEscape: true, holdToasts: true, rows: 9 })
    return note(r.isPlaced ? 'Ready check opened as a focused dialog pane. Esc closes it.' : `Dialog not placed: ${r.reason}`)
  }
  if (what === 'git') {
    try {
      const cwd = await $.session.cwd()
      const r = await $.process.run(['git', 'log', '-1', '--format=%h %s (%ar)'], { cwd })
      return note(r.exitCode === 0 ? `$.process works on ${surface}: git log -1 in ${cwd} -> ${clean(r.stdout.trim())}` : `git ran but failed (exit ${r.exitCode}): ${clean(r.stderr.trim().slice(0, 160))}`)
    } catch (err) {
      return note(`$.process refused on ${surface}: ${clean((err as Error).message)}`)
    }
  }
  if (what === 'judge') {
    const model = (await read($, settings)).model
    const started = await $.clock.now()
    const r = await $.model.complete({ model, prompt: 'Reply with the single word: ready', maxTokens: 10 })
    const ms = (await $.clock.now()) - started
    return note(
      r.isAnswered
        ? `${model} answered "${clean(r.text.trim())}" in ${ms} ms (${r.usage.input_tokens} in, ${r.usage.output_tokens} out tokens).`
        : `Judge call failed: ${r.reason}${r.reason === 'api-error' ? ` ${r.status ?? ''} ${String(r.error)}` : ''}`,
    )
  }
  if (what === 'calibrate') {
    await note('Calibration: picking 10 commits from the last 7 days')
    const out = await calibrate($, 10, 2, 7, false)
    const d = Object.entries(out.summary.distribution).map(([p, n]) => `${p}:${n}`).join(' ')
    return note(`Calibration (${out.summary.model}, ${out.summary.rubric}): ${out.summary.identicalAcrossRuns} identical across runs, mean spread ${out.summary.meanSpreadSteps} steps, mean ${out.summary.meanPoints} pts. Points: ${d}. Craft: ${JSON.stringify(out.summary.craft)}.`)
  }
  if (what.startsWith('select:')) return note(`Select picked: ${what.slice(7)}`)
}

async function boot($: $, cwd: string) {
  loadedAt = await $.clock.now()
  owner = await $.session.id()
  await $.command.register({
    name: 'ccsr',
    description: 'Claude Code Ship Race: open the pane, Grind, backtests, practice matches',
    argumentHint: '[grind|scan|backfill|backtest|match 1h|forfeit|quiet|help]',
  })
  try {
    const migrated = await loadAll($)
    if (migrated) await ambient($, `CCSR updated: rubric ${RUBRIC}. Your Grind is being rescored from git.`, 'note', 8000)
  } catch (err) {
    $.ui.toast(`CCSR could not load its data: ${clean((err as Error).message)}`, { timeoutMs: 8000 })
  }
  await update($, scan, cur => ({ ...SCAN0, ...cur, busy: false, problems: cur.problems ?? [] }))
  await update($, backtests, all =>
    Object.fromEntries(Object.entries(all).map(([k, r]) => [k, r.status === 'running' ? { ...r, status: 'error' as const, note: 'Interrupted by a reload, press Rescore' } : r])),
  )
  await update($, now, () => loadedAt)
  const repo = await $.session.repo()
  const root = await repoRoot($, repo?.root ?? cwd)
  if (root) await addRepo($, root)
  // A developer tool (it spends the player's usage when Claude calls it): only with CCSR_DEV=1, never in a player's tool list.
  let isDev = false
  try {
    isDev = (await $.env.get('CCSR_DEV')) === '1'
  } catch {
    isDev = false
  }
  if (isDev) await $.tool.register({
    name: 'calibrate',
    description:
      "CCSR developer tool: scores the player's recent commits several times each with the current judge model and rubric (no cache) and returns the spread, the points distribution, how often the craft mark fires, and per-commit runs. With pairs, also compares GitHub squash merges against the sum of their branch commits. Spends the player's Claude usage: about count x runs model calls.",
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'How many commits to score (default 20, max 60)' },
        runs: { type: 'number', description: 'Judge runs per commit (default 3, max 5)' },
        days: { type: 'number', description: 'Look back this many days (default 7)' },
        pairs: { type: 'boolean', description: 'Also compare squash merges with their branch commits (default true)' },
      },
    },
  })
  const m = await read($, match)
  if (m && m.status === 'live' && m.kind === 'practice') startTicker($)
  await update($, link, l => ({ ...l, outbox: 0 }))
  void refreshAccount($).then(() => flushOutbox($))
  const sh = await rankedShared($)
  if (sh.phase === 'queued' || sh.phase === 'offered' || sh.phase === 'live') startRankedPoll($)
  $.clock.every(30_000, () => void slowSync($))
  $.clock.every(120_000, () => void runScan($).catch(err => $.ui.log(`CCSR scan: ${(err as Error).message}`)))
  scheduleScan($, 2500)
  await refreshStatus($)
}

async function commandText($: $, args: string, signal?: AbortSignal): Promise<string> {
  const [sub = '', ...rest] = args.trim().split(/\s+/)
  const arg = rest.join(' ')
  const t = await $.clock.now()

  if (sub === '' || sub === 'open') {
    const r = await openPane($)
    return r.isPlaced ? 'CCSR pane opened.' : `CCSR pane is waiting: ${r.reason}`
  }
  if (sub === 'help') return HELP
  if (sub === 'last') {
    // This text reaches Claude: scores and handles only, never chat or an opponent's titles. The row draws as a scorecard.
    return (await recapText($)) ?? 'No result yet.'
  }
  if (sub === 'lab') {
    const r = await openPane($, 'lab')
    return r.isPlaced ? 'CCSR lab tools opened.' : `CCSR pane is waiting: ${r.reason}`
  }
  if (sub === 'status') {
    const s = await read($, settings)
    const rt = await read($, rating)
    const rec = await read($, record)
    const wk = totals(await read($, ledger), periodStart('week', t), await read($, weekTotals))
    const m = await read($, match)
    return `${s.handle} · ${tierOf(rt)} ${rt} practice (${rec.w}-${rec.l}${rec.d ? `-${rec.d}` : ''}) · Grind ${wk.points} pts, ${wk.commits} commits this week${m && m.status === 'live' ? ` · in a match: ${m.myPoints} vs ${liveOpp(m, t)} ${m.opp.handle}, ${clock(m.deadline - t)} left` : ''}`
  }
  if (sub === 'grind') {
    const list = await read($, ledger)
    const weeks = await read($, weekTotals)
    const w = totals(list, periodStart('week', t), weeks)
    const mo = totals(list, periodStart('month', t), weeks)
    const all = totals(list, 0, weeks)
    const last = [...list].sort((a, b) => b.authoredAt - a.authoredAt).slice(0, 5)
    return [
      `Grind: ${w.points} pts / ${w.commits} commits this week · ${mo.points} this month · ${all.points} all time`,
      ...last.map(c => `  +${c.points} ${c.category}${c.craft !== 'neutral' ? ` (${c.craft})` : ''} · ${c.repoName} · ${clean(c.title).slice(0, 70)}`),
    ].join('\n')
  }
  if (sub === 'scan') {
    const r = await runScan($, true)
    return `Scanned: ${r.added.length} new commit${r.added.length === 1 ? '' : 's'}${r.errors.length ? `; problems: ${r.errors.slice(0, 3).join('; ')}` : ''}`
  }
  if (sub === 'backfill') {
    const r = await backfill($)
    return `Scored since Monday: ${r.added.length} new commits, ${r.added.reduce((n, c) => n + c.points, 0)} points.`
  }
  if (sub === 'backtest') {
    // Titles stay in the pane: this text reaches Claude, and session titles are other projects' prompts.
    const days = Math.max(1, Math.min(30, Number(arg) || 7))
    const list = (await discoverSessions($, days)).slice(0, 20)
    const lines: string[] = []
    let sum = 0
    for (const s of list) {
      if (signal?.aborted) break
      const run = await backtestSession($, s, signal)
      sum += run.points
      lines.push(`  ${String(run.points).padStart(3)} pts  ${String(run.commits.length).padStart(2)} commits  ${s.project.padEnd(18).slice(0, 18)}  ${when(s.startAt)}  ${dur(s.endAt - s.startAt)}${run.status === 'partial' ? '  partial' : ''}`)
    }
    await update($, tab, () => 'backtest')
    return [`Backtest, last ${days} days (${lines.length} sessions, ${sum} points). Open /ccsr for titles and commits.`, ...lines].join('\n')
  }
  if (sub === 'match' || sub === 'queue') {
    const hours = /sprint|5m/.test(arg) ? 1 / 12 : Number((arg.match(/(\d+)\s*h/) ?? [])[1] ?? 1)
    if (![1 / 12, 1, 3].includes(hours)) return 'Lengths: 1h, 3h (and sprint, a 5 minute practice).'
    const m = await startMatch($, hours)
    return m ? `Practice match on: ${m.opp.handle}, bell in ${clock(m.deadline - m.startAt)}. Only commits count.` : 'A match is already live.'
  }
  if (sub === 'chat') return 'Chat lives in the CCSR pane only, so your opponent never reaches Claude. Open /ccsr.'
  if (sub === 'forfeit') {
    const m = await bell($, text => $.ui.toast(text), true)
    await refreshStatus($)
    return m ? `Forfeited. Rating ${m.ratingBefore} -> ${m.ratingAfter}.` : 'No live match.'
  }
  if (sub === 'tracking' || sub === 'share' || sub === 'band' || sub === 'quiet') {
    if (arg !== 'on' && arg !== 'off') return `/ccsr ${sub} on|off`
    const isOn = arg === 'on'
    if (sub === 'band') {
      await setSurface($, 'band', isOn ? 'after' : 'off')
      await setSurface($, 'bandMatch', isOn ? 'on' : 'off')
    } else if (sub === 'quiet') await setPreset($, isOn ? 'quiet' : 'full')
    else await saveSettings($, sub === 'tracking' ? { tracking: isOn } : { share: isOn })
    await refreshStatus($)
    return `${sub === 'tracking' ? 'Grind tracking' : sub === 'share' ? 'Commit titles' : sub === 'band' ? 'Band' : 'Quiet'} ${arg}.${sub === 'quiet' && isOn ? ' The band stays during a match; the match-found check always shows.' : ''}`
  }
  if (sub === 'handle') {
    await setHandle($, arg)
    return `Handle: ${arg}`
  }
  return HELP
}

async function calibrateTool($: $, input: Record<string, unknown>) {
  const count = Math.max(1, Math.min(60, Number(input.count) || 20))
  const runs = Math.max(1, Math.min(5, Number(input.runs) || 3))
  const days = Math.max(1, Math.min(30, Number(input.days) || 7))
  const pairs = input.pairs !== false
  const out = await calibrate($, count, runs, days, pairs)
  const text = JSON.stringify(out)
  // Kept on disk too, so a failed return never loses a paid run.
  try {
    const home = (await $.env.get('HOME')) ?? ''
    if (home) await $.fs.write(`${home}/.claude/ccsr-calibration-${await $.clock.now()}.json`, text)
  } catch {}
  return text
}

async function readyDialog($: $, e: RenderInput<'Pane'>) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const r = await read($, rating)
  const close = () => void $.ui.close({ id: READY })
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="#FF6A2A">Match found · 5 min sprint</Text>
      <Text>
        10xgary · {tierOf(r + 12)} {r + 12} · you have 60 seconds to accept
      </Text>
      <Box gap={1}>
        <Button
          key="ready-accept"
          label="Accept"
          variant="primary"
          autoFocus
          onPress={() => {
            close()
            void startMatch($, 1 / 12)
          }}
        />
        <Button key="ready-decline" label="Decline" role="dismiss" onPress={close} />
      </Box>
    </Box>
  )
}

// ------------------------------------------------------------------ transcript sites

/** `[main 8c41e2a] subject` from git commit's output: the sha the scan will score. */
function commitSha(stdout: string) {
  return /^\[[^\]\s]+(?: \([^)]*\))? ([0-9a-f]{7,40})\] /m.exec(stdout)?.[1] ?? null
}

async function inMatch($: $) {
  const sh = await rankedShared($)
  if (sh.phase === 'live') return true
  const m = await read($, match)
  return !!m && m.status === 'live'
}

/** Before Claude's git commit runs: under its permission prompt, "counts in your match". */
async function beforeCommit($: $, id: string) {
  if ((await read($, settings)).surfaces.marks !== 'on' || !(await inMatch($))) return
  try {
    $.ui.notice(id, MOD.notice)
  } catch {
    // No dialog open for this call: nothing to annotate.
  }
}

/** After it ran: the row shows "scoring" until the scan scores that sha. */
async function afterCommit($: $, id: string, stdout: string) {
  const sha = commitSha(stdout)
  if (!sha) return
  const where = (await inMatch($)) ? 'match' : 'grind'
  await update($, badges, all => ({ ...Object.fromEntries(Object.entries(all).slice(-60)), [id]: { sha, status: 'scoring' as const, where } }))
}

async function drawBadge($: $, e: RenderInput<'ToolUse'>, row: RenderElement): Promise<RenderElement> {
  const b = (await read($, badges))[e.requestId]
  if (!b) return row
  const { Box, Text, Svg } = $.ui.resolve(e) as El
  const where = b.status === 'scoring' ? 'scoring' : b.where
  const craft = b.craft === 'clean' ? ' · ▲ clean +1' : b.craft === 'sloppy' ? ' · ▼ sloppy -1' : ''
  if (e.surface === 'terminal')
    return (
      <Box flexDirection="column">
        {row}
        <Text color={ORANGE}>{b.status === 'scoring' ? '  ◆ CCSR scoring' : `  ◆ CCSR +${b.points ?? 0} ${b.category ?? ''}${craft} · ${where}`}</Text>
      </Box>
    )
  return (
    <Box flexDirection="column">
      {row}
      <Box key={`badge-${e.requestId}`} flexDirection="column">
        <Svg source={commitBadge({ points: b.points ?? 0, category: b.category ?? '', craft: b.craft ?? 'neutral', where })} alt={b.status === 'scoring' ? 'CCSR scoring' : `CCSR +${b.points ?? 0} ${b.category ?? ''}, ${where}.`} />
        {b.reason && (
          <Box display="none" hover={{ display: 'flex' }} flexDirection="column" paddingX={1}>
            <Text dimColor>{b.reason}</Text>
            {b.craft && b.craft !== 'neutral' && (
              <Text dimColor>
                Judged {b.base}, {b.craft} moves it to {b.points}.
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/** Minutes and seconds left when the bell is 10 minutes or less away, in ranked or practice; null otherwise. */
async function bellLeft($: $): Promise<number | null> {
  const t = await $.clock.now()
  const sh = await rankedShared($)
  const sm = (await read($, link)).ranked?.summary
  if (sh.phase === 'live' && sm?.status === 'live' && sm.deadline) {
    const left = Date.parse(sm.deadline) - t
    return left > 0 && left <= 10 * 60_000 ? left : null
  }
  const m = await read($, match)
  if (m && m.status === 'live') {
    const left = m.deadline - t
    return left > 0 && left <= 10 * 60_000 ? left : null
  }
  return null
}

async function spinnerFor($: $, e: RenderInput<'Spinner'>) {
  if ((await read($, settings)).surfaces.spinner !== 'on') return null
  await read($, now)
  const left = await bellLeft($)
  return left === null ? null : { ...e, props: { ...e.props, message: MOD.spin(mmss(left)), suffix: '' } }
}

async function hintFor($: $, e: RenderInput<'PromptHint'>) {
  if ((await read($, settings)).surfaces.hint !== 'auto') return null
  const l = await read($, link)
  if ((await rankedShared($)).phase !== 'live' || (l.me?.matches_played ?? 0) >= 3) return null
  if (e.surface === 'terminal') return { ...e, props: { ...e.props, tail: MOD.hint } }
  if (e.props.isWorking || e.props.isDraft) return null
  return { ...e, props: { ...e.props, hint: e.props.hint ? `${e.props.hint} · ${MOD.hint}` : MOD.hint } }
}

async function modeFor($: $, e: RenderInput<'SessionMode'>) {
  if ((await read($, settings)).surfaces.mode !== 'on') return null
  const sh = await rankedShared($)
  const l = await read($, link)
  const left = await bellLeft($)
  const label =
    sh.phase === 'queued' ? 'CCSR queued'
    : sh.phase === 'offered' ? 'CCSR found'
    : sh.phase === 'live' ? (l.ranked?.summary?.status === 'grace' ? 'CCSR bell' : l.online === false ? 'CCSR offline' : left !== null ? `CCSR ${mmss(left)}` : 'CCSR live')
    : (await inMatch($)) ? (left !== null ? `CCSR ${mmss(left)}` : 'CCSR practice')
    : null
  return label ? { ...e, props: { ...e.props, modes: [...e.props.modes, label] } } : null
}

/** `/ccsr last` draws as a scorecard in the transcript; its text (what Claude reads) is scores and handles only. */
async function drawScorecard($: $, e: RenderInput<'CommandOutput'>): Promise<RenderElement | null> {
  const l = await read($, link)
  const me = (await serverCfg($)).handle ?? ''
  const sm = l.ranked?.summary
  if (!sm || (sm.status !== 'finished' && sm.status !== 'void')) return null
  const { mine, them } = rankedSides(sm, me)
  const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
  const outcome = rankedOutcome(sm, me)
  const { Box, Text, Svg } = $.ui.resolve(e) as El
  if (e.surface === 'terminal')
    return (
      <Box flexDirection="column">
        <Text bold color={ORANGE}>
          CCSR · ranked {sm.length}h · {outcome === 'won' ? 'victory' : outcome === 'lost' ? 'loss' : 'draw'}
        </Text>
        <Text>
          {mine.player.handle} {mine.points} : {them.points} {them.player.handle} · {mine.commits} commits to {them.commits}
        </Text>
        <Text>{rankedResultLine(sm, me)}</Text>
      </Box>
    )
  return (
    <Svg
      source={scorecard({ outcome, hours: sm.length, me: mine.player.handle, them: them.player.handle, mine: mine.points, theirs: them.points, commits: { mine: mine.commits, theirs: them.commits }, delta, ratingBefore: mine.rating_before, ratingAfter: mine.rating_after ?? mine.rating_before, placing: placingOfSide(mine) })}
      alt={rankedResultLine(sm, me)}
    />
  )
}

async function onTurnDone($: $, durationMs: number) {
  if (turnPoints <= 0) return
  const pts = turnPoints
  turnPoints = 0
  await update($, turnMarks, all => ({ ...Object.fromEntries(Object.entries(all).slice(-40)), [String(durationMs)]: pts }))
}

async function turnLine($: $, e: RenderInput<'TurnDuration'>): Promise<RenderElement | null> {
  if ((await read($, settings)).surfaces.extras !== 'on') return null
  const pts = (await read($, turnMarks))[String(e.props.durationMs)]
  if (!pts) return null
  const { Box, Text } = $.ui.resolve(e)
  const sec = Math.max(1, Math.round(e.props.durationMs / 1000))
  return (
    <Box gap={1}>
      <Text dimColor>
        {e.props.word} for {sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`}
      </Text>
      <Text color={ORANGE}>· CCSR +{pts}</Text>
    </Box>
  )
}

/** The band: renderBand reads every switch (the ready check ignores them); a survey always wins the slot. */
async function bandOrPass($: $, e: RenderInput<'AbovePrompt'>) {
  if (e.props.hasSurvey) return null
  return renderBand($, e, actions($))
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    await boot($, e.cwd)
    return started
  })

  on('prompt.submit', ($, e, next) => {
    turnPoints = 0
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) await onTurnDone($, e.durationMs)
    const repo = await $.session.repo()
    if (repo) {
      const root = await repoRoot($, repo.root)
      if (root) await addRepo($, root)
    }
    scheduleScan($)
    return done
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const isCommit = /\bgit\b[^\n]*\bcommit\b/.test(String(e.command))
    if (isCommit) await beforeCommit($, e.tool_use_id)
    const ran = await next(e)
    if (isCommit) {
      if (ran.result) await afterCommit($, e.tool_use_id, String((ran.result as { stdout?: string }).stdout ?? ''))
      scheduleScan($, 800)
    }
    return ran
  })

  on('tool.call', { tool: 'mcp__ccsr__calibrate' }, async ($, e) => {
    const text = await calibrateTool($, e as unknown as Record<string, unknown>)
    // A plugin tool's result is a string or an array of content blocks, never an object.
    return { result: text }
  })

  on('command.run', { command: 'ccsr' }, async ($, e, next) => ({ text: await commandText($, e.args, next.signal) }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => renderPane($, e, actions($)))

  on('ui.render', { component: 'Pane', requestId: READY }, async ($, e) => readyDialog($, e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const tree = await bandOrPass($, e)
    return tree ?? next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || (await read($, settings)).surfaces.marks !== 'on' || !(await read($, badges))[e.requestId]) return next(e)
    return drawBadge($, e, await next(e))
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'ccsr' } }, async ($, e, next) => {
    if (e.props.args.trim() !== 'last') return next(e)
    return (await drawScorecard($, e)) ?? next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => next((await spinnerFor($, e)) ?? e))

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => next((await hintFor($, e)) ?? e))

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => next((await modeFor($, e)) ?? e))

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => (await turnLine($, e)) ?? next(e))
}
