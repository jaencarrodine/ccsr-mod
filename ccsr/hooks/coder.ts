// The coder block (W7-2, build plan "Mod lane"): which model, effort, agent and client made a
// scored commit, and the tokens spent on it, from call records the mod keeps on this machine.
// Pure: no `$` here. register.tsx records the calls (turn.step, classic.PostToolUse,
// session.end), reads them back with `readCall`, and attaches `coderFor`'s block to the score.
//
// What leaves the machine is the block and nothing else: a model id, an effort, main or
// subagent, a client name and version, and four token counts. A call record also holds a
// time, commit shas and a local repo key, which the attribution reads and never sends. No
// session id, path, command, tool_use id or repo name is ever in a record or a block.
//
// The attribution, for one commit (its sha, and `%ct`, the committer time in whole seconds):
//   1. sha: a Bash call whose git operation made this commit (its sha, or a prefix of it)
//      names the coder outright, whenever it ran and even when the call errored (a
//      `git commit && npm test` that fails after committing still made the commit), as long
//      as the record knows its model. Two such records that disagree are `ambiguous`.
//   2. window: else the model calls in the commit's window vote: from the previous commit
//      in the same repo (or WINDOW_MS before, whichever is later) up to the commit. All on
//      one model is `window`; any two models is `ambiguous`, and the model is left null.
//      A call that errored has no answer behind it and doesn't vote.
//   3. none: no call at all is `source: 'none'`, every field but the tokens null.
// Sha beats window. Each field (model, effort, agent, client, version) is kept only when
// every call that counts agrees on it; a disagreement is null, never a guess.
//
// Tokens are the four counts of every call in the window, each call counted for exactly one
// commit (`coderBlocks`): the first one at or after it in its repo, or in any repo for a
// call with no repo key. A call after the last commit counts for none yet.
//
// A commit made before capture began (`since`) gets no block at all.

export const CODER_V = 1
/** The block's keys, in order: the server takes exactly these (W7-1). */
export const CODER_KEYS = ['v', 'source', 'match', 'model', 'effort', 'agent', 'client', 'client_version', 'tokens'] as const
export const TOKEN_KEYS = ['input', 'output', 'cache_read', 'cache_write'] as const

/** How far back a commit's window may reach: the longest match. */
export const WINDOW_MS = 3 * 3_600_000

// The vocabularies are the server's (W7-1, server/src/eval.ts: CLIENTS, EFFORTS, TOKENS_MAX):
// a word it doesn't list is stored as `other`, so the mod sends only these.

/** Where Claude Code ran, as the block names it: the server's six, or `other`. */
export const CLIENTS = ['cli', 'desktop', 'vscode', 'jetbrains', 'web', 'sdk', 'other'] as const
export type Client = (typeof CLIENTS)[number]
/** The effort levels Claude Code names; any other effort (a budget in tokens) is `other`. */
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
export type Effort = (typeof EFFORTS)[number] | 'other'
export type Agent = 'main' | 'subagent'
export type Source = 'live' | 'transcript' | 'none'
export type Match = 'sha' | 'window' | 'ambiguous'

export type Tokens = { input: number; output: number; cache_read: number; cache_write: number }

export type CoderBlock = {
  v: 1
  source: Source
  /** null on a `none` block: nothing was matched. */
  match: Match | null
  model: string | null
  effort: Effort | null
  agent: Agent | null
  client: Client | null
  client_version: string | null
  tokens: Tokens
}

/** One record: a model call (model and tokens) or a Bash call that made commits (shas). */
export type Call = {
  /** ms: when the model answered, or when the tool finished. */
  at: number
  model: string | null
  effort: Effort | null
  agent: Agent | null
  client: Client | null
  clientVersion: string | null
  /** Zero for a tool record. */
  tokens: Tokens
  /** The commits this call made, lowercase hex, 7 to 40. */
  shas: string[]
  /** The call failed: a model call with no answer, or a tool that exited badly. */
  error: boolean
  /** A local key for the repo the session ran in; null when unknown. Never sent. */
  repo: string | null
}

/** A scored commit, as the scan has it. `ct` is git's `%ct`: seconds. */
export type Commit = { sha: string; ct: number; repo?: string | null }

export const ZERO: Tokens = Object.freeze({ input: 0, output: 0, cache_read: 0, cache_write: 0 })

const SHA = /^[0-9a-f]{7,40}$/
const VERSION = /^\d{1,4}\.\d{1,4}\.\d{1,6}$/
const MODEL = /^[a-z0-9][a-z0-9._:@-]{0,99}$/
const WORD = /^[a-z]{1,16}$/
/** The most a token count may be: the server's TOKENS_MAX (a trillion), past which it keeps null. */
export const COUNT_MAX = 1_000_000_000_000

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function count(v: unknown) {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= COUNT_MAX ? v : 0
}

// ------------------------------------------------------------------ reading what Claude Code hands over

/**
 * An API usage object as four counts: uncached input, output, cache reads and cache writes.
 * Only the top-level totals: `iterations[]` and the cache_creation breakdown repeat what
 * they already hold, so summing them would count tokens twice.
 */
export function tokensOf(usage: unknown): Tokens {
  if (!isObject(usage)) return { ...ZERO }
  return { input: count(usage.input_tokens), output: count(usage.output_tokens), cache_read: count(usage.cache_read_input_tokens), cache_write: count(usage.cache_creation_input_tokens) }
}

export function addTokens(a: Tokens, b: Tokens): Tokens {
  const add = (x: number, y: number) => Math.min(COUNT_MAX, x + y)
  return { input: add(a.input, b.input), output: add(a.output, b.output), cache_read: add(a.cache_read, b.cache_read), cache_write: add(a.cache_write, b.cache_write) }
}

/**
 * A model id fit to send: the id itself (a context suffix such as `[1m]` dropped), null for
 * Claude Code's own `<synthetic>` messages and anything empty, and `other` for anything that
 * isn't a plain id, an ARN above all: it carries the account id.
 */
export function modelId(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim().replace(/\[[a-z0-9]{1,8}\]$/i, '')
  if (s === '' || s === '<synthetic>') return null
  if (/^arn:/i.test(s) || !MODEL.test(s)) return 'other'
  // Only Claude's own families go out as named: a gateway's or a fine-tune's name could say
  // something about the player's setup, so anything else is `other` here, as the server keeps it.
  if (!/claude/.test(s) || !/(opus|sonnet|haiku)/.test(s)) return 'other'
  return s
}

/**
 * An effort: a level (low to max, or a hook's `{ level }`) as itself; another effort that is
 * set (a lowercase word Claude Code may add, or an integer budget, which turn.step can carry)
 * as `other`, the word the server would store for it; anything else null.
 */
export function effortOf(raw: unknown): Effort | null {
  if (isObject(raw)) return effortOf(raw.level)
  if (typeof raw === 'string') return (EFFORTS as readonly string[]).includes(raw) ? (raw as Effort) : WORD.test(raw) ? 'other' : null
  if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return 'other'
  return null
}

/** main, or subagent when the call ran in a subagent's loop (an agent id is present). */
export function agentOf(agentId: unknown): Agent {
  return typeof agentId === 'string' && agentId !== '' ? 'subagent' : 'main'
}

/**
 * The client, from Claude Code's entrypoint (the `entrypoint` a transcript line carries) or
 * the mod's own surface word: null when unknown, `other` for one the server doesn't name.
 * The `mobile` surface is null: it says where the pane draws, not where Claude Code runs
 * (a cloud session, or a desktop's under Remote Control), and the mod never guesses.
 */
export function clientOf(raw: unknown): Client | null {
  if (typeof raw !== 'string' || raw === '' || raw === 'mobile') return null
  if ((CLIENTS as readonly string[]).includes(raw)) return raw as Client
  // remote, remote_desktop, remote_mobile...: a session that runs in the cloud, wherever it was started.
  if (raw === 'remote' || raw.startsWith('remote_')) return 'web'
  switch (raw) {
    case 'terminal':
      return 'cli'
    case 'claude-desktop':
    case 'claude-desktop-3p':
    case 'local-agent':
      return 'desktop'
    case 'claude-vscode':
      return 'vscode'
    case 'claude-jetbrains':
      return 'jetbrains'
    case 'sdk-ts':
    case 'sdk-py':
    case 'sdk-cli':
      return 'sdk'
    default:
      return 'other'
  }
}

/** A Claude Code version (`2.1.293`); else null. */
export function versionOf(raw: unknown): string | null {
  return typeof raw === 'string' && VERSION.test(raw) ? raw : null
}

/**
 * The commit a Bash call made, from its result's `gitOperation` (Claude Code's own
 * classification: `{ commit: { sha, kind } }` for a commit, an amend or a cherry-pick).
 * Read as a key: the command and its output are never looked at.
 */
export function shasOf(toolResponse: unknown): string[] {
  const op = isObject(toolResponse) ? toolResponse.gitOperation : undefined
  const commit = isObject(op) ? op.commit : undefined
  const sha = isObject(commit) && typeof commit.sha === 'string' ? commit.sha.toLowerCase() : ''
  return SHA.test(sha) ? [sha] : []
}

/** A call record as stored (JSON on disk), checked; null when it isn't one. */
export function readCall(raw: unknown): Call | null {
  if (!isObject(raw) || typeof raw.at !== 'number' || !Number.isFinite(raw.at)) return null
  const shas = Array.isArray(raw.shas) ? raw.shas.filter((s): s is string => typeof s === 'string' && SHA.test(s)).slice(0, 8) : []
  return {
    at: raw.at,
    model: modelId(raw.model),
    effort: effortOf(raw.effort),
    agent: raw.agent === 'main' || raw.agent === 'subagent' ? raw.agent : null,
    client: clientOf(raw.client),
    clientVersion: versionOf(raw.clientVersion),
    tokens: isObject(raw.tokens) ? { input: count(raw.tokens.input), output: count(raw.tokens.output), cache_read: count(raw.tokens.cache_read), cache_write: count(raw.tokens.cache_write) } : { ...ZERO },
    shas,
    error: raw.error === true,
    repo: typeof raw.repo === 'string' && raw.repo !== '' ? raw.repo : null,
  }
}

// ------------------------------------------------------------------ the attribution

/** The one value every call that has one agrees on; null when none has one or two differ. */
function agreed<T>(values: (T | null)[]): T | null {
  let out: T | null = null
  for (const v of values) {
    if (v === null) continue
    if (out !== null && v !== out) return null
    out = v
  }
  return out
}

function sameRepo(c: Call, repo: string | null) {
  return repo === null || c.repo === null || c.repo === repo
}

function madeIt(c: Call, sha: string) {
  return c.shas.some(s => sha.startsWith(s) || s.startsWith(sha))
}

type Opts = {
  since: number
  prevCt?: number | null
  source: 'live' | 'transcript'
  /**
   * The commits made on this machine (full shas, from the repo's reflog). When given, a
   * commit outside it (a GitHub merge, a cloud session's, another machine's) gets a block
   * only from a sha record: this machine's calls never vote on a commit made elsewhere.
   */
  local?: ReadonlySet<string> | null
}

/**
 * Whether a call is in a commit's window: the commit's repo (a call or commit with no repo
 * key matches any), after the previous commit in that repo, or WINDOW_MS before, whichever
 * is later, up to the commit. `%ct` is whole seconds: the commit happened somewhere in
 * [ct, ct + 1 s), so that whole second is in.
 */
function inWindow(commit: Commit, prevCt: number | null | undefined, c: Call) {
  return sameRepo(c, commit.repo ?? null) && c.at >= windowFloor(commit, prevCt) && c.at < commit.ct * 1000 + 1000
}

/** Where a commit's window opens (ms): after the previous commit in its repo, at most WINDOW_MS back. */
function windowFloor(commit: Commit, prevCt: number | null | undefined) {
  const floor = typeof prevCt === 'number' && Number.isFinite(prevCt) ? prevCt * 1000 + 1000 : -Infinity
  return Math.max(commit.ct * 1000 - WINDOW_MS, floor)
}

function blockFor(commit: Commit, calls: readonly Call[], o: Opts, counted: (c: Call) => boolean): CoderBlock | null {
  const ctMs = commit.ct * 1000
  if (!Number.isFinite(ctMs) || !(ctMs >= o.since)) return null
  const sha = typeof commit.sha === 'string' ? commit.sha.toLowerCase() : ''
  const repo = commit.repo ?? null
  // A sha is the commit's own name: its record counts whichever repo the session stood in.
  // One that doesn't know its model can't name the coder: the window does then.
  const bySha = SHA.test(sha) ? calls.filter(c => c.model !== null && madeIt(c, sha)) : []
  if (bySha.length === 0) {
    // No record made it, so the window would speak: only for a commit made on this machine,
    // and only over a window wholly inside the records (one that opens before capture began
    // holds only part of its calls, and its vote would be a guess).
    if (o.local && !o.local.has(sha)) return null
    if (windowFloor(commit, o.prevCt) < o.since) return null
  }
  const mine = calls.filter(c => sameRepo(c, repo))
  const windowed = mine.filter(c => inWindow(commit, o.prevCt, c))
  const tokens = windowed.filter(counted).reduce((t, c) => addTokens(t, c.tokens), { ...ZERO })
  // Only model calls vote: a Bash record (shas, no tokens) answered no request, and lands after its own commit.
  const voters = windowed.filter(c => c.model !== null && !c.error && c.shas.length === 0)
  const picked = bySha.length > 0 ? bySha : voters
  if (picked.length === 0) return { v: 1, source: 'none', match: null, model: null, effort: null, agent: null, client: null, client_version: null, tokens }
  const model = agreed(picked.map(c => c.model))
  const match: Match = model === null ? 'ambiguous' : bySha.length > 0 ? 'sha' : 'window'
  return {
    v: 1,
    source: o.source,
    match,
    model,
    effort: agreed(picked.map(c => c.effort)),
    agent: agreed(picked.map(c => c.agent)),
    client: agreed(picked.map(c => c.client)),
    client_version: agreed(picked.map(c => c.clientVersion)),
    tokens,
  }
}

/**
 * The block for one commit. `prevCt` is the previous commit's `%ct` in the same repo (the
 * window's floor), `since` the time capture began (ms). null before `since`. Never throws.
 * For a scan's commits use `coderBlocks`, which counts each call's tokens once.
 */
export function coderFor(commit: Commit, calls: readonly Call[], o: Opts): CoderBlock | null {
  return blockFor(commit, calls, o, () => true)
}

/**
 * Blocks for a scan's commits, keyed by sha: each commit's window starts at the previous
 * commit in its repo, and each call's tokens count for exactly one commit, the first whose
 * window holds it (a call or commit with no repo key can sit in several windows; it votes
 * in each). Commits are taken in time order whatever order they come in.
 * `since` is the time a commit must be at or after to get a block: pass `blockSince`.
 */
export function coderBlocks(commits: readonly Commit[], calls: readonly Call[], o: { since: number; source: 'live' | 'transcript'; local?: ReadonlySet<string> | null; bareTokens?: boolean }): Map<string, CoderBlock | null> {
  const sorted = [...commits].sort((a, b) => a.ct - b.ct)
  const last = new Map<string | null, number>()
  const prev = sorted.map(c => {
    const repo = c.repo ?? null
    const p = last.get(repo) ?? null
    last.set(repo, c.ct)
    return p
  })
  const owner = new Map<Call, number>()
  sorted.forEach((c, i) => {
    for (const call of calls) if (!owner.has(call) && inWindow(c, prev[i], call)) owner.set(call, i)
  })
  const out = new Map<string, CoderBlock | null>()
  // bareTokens false (the live scan, one repo at a time): a call with no repo key still votes,
  // but its tokens count only for a commit with no repo key, so two repos' scans never both count it.
  const counts = (call: Call, c: Commit) => o.bareTokens !== false || call.repo !== null || (c.repo ?? null) === null
  sorted.forEach((c, i) => out.set(c.sha, blockFor(c, calls, { since: o.since, prevCt: prev[i], source: o.source, local: o.local }, call => owner.get(call) === i && counts(call, c))))
  return out
}

/**
 * Each commit's window (ms) as `coderBlocks` draws it, by sha: from just after the commit
 * before it in its repo (or WINDOW_MS back, whichever is later) up to the end of its own
 * second, `to` excluded. The transcript fallback (W7-3) reads only files that could hold a
 * call in it.
 */
export function windowsOf(commits: readonly Commit[]): Map<string, { from: number; to: number }> {
  const sorted = [...commits].sort((a, b) => a.ct - b.ct)
  const last = new Map<string | null, number>()
  const out = new Map<string, { from: number; to: number }>()
  for (const c of sorted) {
    const repo = c.repo ?? null
    const prev = last.get(repo) ?? null
    last.set(repo, c.ct)
    out.set(c.sha, { from: windowFloor(c, prev), to: c.ct * 1000 + 1000 })
  }
  return out
}

// ------------------------------------------------------------------ the records on disk (W7-2)
//
// register.tsx keeps the records in `~/.ccsr/calls/`, beside the keyring and outside every
// config dir, so a scan in any session or config dir on this machine reads every session's
// calls. `$.fs` has no delete and no append, so the names are fixed and each write replaces a
// whole file: 16 slot files, `0.json` to `15.json`, each session writing the one its id picks
// (`slotOf`), so two sessions rarely share one; and `since.json`, when capture began on this
// machine. A slot is `{ "v": 1, "calls": [Call, ...] }`, records past CALL_KEEP_MS dropped on
// every write. The session id picks the slot and is never written.

/** How many slot files the records spread over. */
export const CALL_SLOTS = 16
/** How long a record is kept: the longest window, and a day more for a commit scored late. */
export const CALL_KEEP_MS = WINDOW_MS + 24 * 3_600_000
/** The most records one slot keeps (the newest): about 250 bytes each, far under `$.fs`'s 4 MiB. */
export const CALL_SLOT_MAX = 5000
/** The most model calls a session holds in memory between writes; past it the oldest go. */
export const PENDING_MAX = 2000

/** Config's `eval_capture`: only `true` is on (a missing key, a server before W7-1, is off). */
export function captureOn(raw: unknown): boolean {
  return isObject(raw) && raw.eval_capture === true
}

/** Which slot file a session writes, from a key only it has (its id): 0 to 15. */
export function slotOf(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  return (h >>> 0) % CALL_SLOTS
}

/**
 * The record of one model call, from what `turn.step` hands over: the request (`e`) and the
 * response (`r`). The model is the one that answered (`usage.model`), else the one asked;
 * a step with no response is an error, with no tokens. Client, version and repo are the
 * session's, which the writer stamps on (`stamped`). `at` is when it answered.
 */
export function stepCall(e: { model?: unknown; effort?: unknown; agentId?: unknown } | null | undefined, r: { stopReason?: unknown; usage?: unknown } | null | undefined, at: number): Call {
  const usage = isObject(r) && isObject(r.usage) ? r.usage : null
  const answered = isObject(r) && r.stopReason !== null && r.stopReason !== undefined
  return {
    at,
    model: modelId(usage && typeof usage.model === 'string' ? usage.model : e?.model),
    effort: effortOf(e?.effort),
    agent: agentOf(e?.agentId),
    client: null,
    clientVersion: null,
    tokens: answered ? tokensOf(usage) : { ...ZERO },
    shas: [],
    error: !answered,
    repo: null,
  }
}

/**
 * The record of a Bash call that made a commit, from `classic.PostToolUse`: its commit sha
 * from Claude Code's own `gitOperation` (never the command or its output), the agent and
 * effort the hook names, and the model of the step that asked for it (`last`, the agent's
 * latest step). null when the call made no commit. It carries no tokens: its step does.
 */
export function bashCall(e: { tool_response?: unknown; agent_id?: unknown; effort?: unknown } | null | undefined, last: { model: string | null; effort: Effort | null } | null | undefined, at: number): Call | null {
  const shas = shasOf(e?.tool_response)
  if (shas.length === 0) return null
  return { at, model: last?.model ?? null, effort: effortOf(e?.effort) ?? last?.effort ?? null, agent: agentOf(e?.agent_id), client: null, clientVersion: null, tokens: { ...ZERO }, shas, error: false, repo: null }
}

/** The session's client, version and repo key on a record that doesn't carry them yet. */
export function stamped(c: Call, s: { client: Client | null; clientVersion: string | null; repo: string | null }): Call {
  return { ...c, client: c.client ?? s.client, clientVersion: c.clientVersion ?? s.clientVersion, repo: c.repo ?? s.repo }
}

/** The calls a slot file holds; anything that isn't one (missing, cut short, another shape) holds none. */
export function readSlot(text: unknown): Call[] {
  let raw: unknown
  try {
    raw = typeof text === 'string' ? JSON.parse(text) : null
  } catch {
    return []
  }
  if (!isObject(raw) || raw.v !== 1 || !Array.isArray(raw.calls)) return []
  const out: Call[] = []
  for (const c of raw.calls) {
    const call = readCall(c)
    if (call) out.push(call)
  }
  return out
}

/** A call as a slot keeps it: exactly the record's fields, nothing else. */
function stored(c: Call) {
  return { at: c.at, model: c.model, effort: c.effort, agent: c.agent, client: c.client, clientVersion: c.clientVersion, tokens: { ...c.tokens }, shas: [...c.shas], error: c.error, repo: c.repo }
}

/**
 * A slot file's next text: what it held and the fresh records (one already there isn't
 * added twice), those older than CALL_KEEP_MS before `now` dropped, the newest
 * CALL_SLOT_MAX kept, oldest first.
 */
export function slotText(held: readonly Call[], fresh: readonly Call[], now: number): string {
  const seen = new Set(held.map(c => JSON.stringify(stored(c))))
  const all = [...held, ...fresh.filter(c => !seen.has(JSON.stringify(stored(c))))]
  const kept = all
    .filter(c => Number.isFinite(c.at) && c.at >= now - CALL_KEEP_MS)
    .sort((a, b) => a.at - b.at)
    .slice(-CALL_SLOT_MAX)
  return JSON.stringify({ v: 1, calls: kept.map(stored) })
}

/** Whether a slot's text holds every one of these records (a write another session's crossed loses some). */
export function slotHolds(text: unknown, want: readonly Call[]): boolean {
  const have = new Set(readSlot(text).map(c => JSON.stringify(stored(c))))
  return want.every(c => have.has(JSON.stringify(stored(c))))
}

/** `since.json`'s time (ms), or null when it isn't one. */
export function readSince(text: unknown): number | null {
  try {
    const raw: unknown = typeof text === 'string' ? JSON.parse(text) : null
    return isObject(raw) && raw.v === 1 && typeof raw.since === 'number' && Number.isFinite(raw.since) && raw.since > 0 ? raw.since : null
  } catch {
    return null
  }
}

export function sinceText(ms: number): string {
  return JSON.stringify({ v: 1, since: ms })
}

/**
 * The time a commit must be at or after for a block: when capture began on this machine,
 * and never so long ago that its window reaches past what the records keep (a block over a
 * window with its oldest calls dropped would be a guess).
 */
export function blockSince(since: number, now: number): number {
  return Math.max(since, now - (CALL_KEEP_MS - WINDOW_MS))
}
