// The CCSR server's shapes (docs/api.md v0.2) and the pure helpers the mod
// needs to talk to it. No `$` here: register.tsx makes every request.

import { jitterMs } from './config'
import { clean } from './pure'
import type { ApiCoder, ApiMatchEvent, ApiScoreBody, ScoredCommit } from '../types'

/** Until api.ccsr.gg's DNS is live, Settings can point the mod elsewhere. */
export const DEFAULT_SERVER = 'https://api.ccsr.gg/v1'

const CATEGORIES = new Set(['feature', 'fix', 'refactor', 'test', 'docs', 'perf', 'infra', 'chore'])
const SCALE = new Set([0, 1, 2, 3, 5, 8, 13, 21])

export async function sha256hex(s: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))
  let out = ''
  for (const b of bytes) out += b.toString(16).padStart(2, '0')
  return out
}

/**
 * A ledger row as the server takes it. Nothing here names the repo or shows
 * code: the repo is a salted hash, the identity a hash of that plus the author
 * time and subject, and the title goes only while the player shares titles.
 * `coder` (W7-2) is the coder block the scan built while eval capture was on; it rides
 * the outbox with the body, never the ledger.
 */
export async function scoreBody(c: ScoredCommit, salt: string, share: boolean, coder?: ApiCoder | null): Promise<ApiScoreBody> {
  const repo_hash = await sha256hex(`${salt}|repo|${c.repoName}`)
  const identity = await sha256hex(`${repo_hash}|${c.authoredAt}|${c.title.trim()}`)
  const body: ApiScoreBody = {
    fingerprint: c.pid,
    identity,
    repo_hash,
    authored_at: new Date(c.authoredAt).toISOString(),
    points: SCALE.has(c.points) ? c.points : 0,
    base: SCALE.has(c.base) ? c.base : 0,
    craft: c.craft,
    category: CATEGORIES.has(c.category) ? c.category : 'chore',
    lines_added: Math.max(0, c.added | 0),
    lines_deleted: Math.max(0, c.deleted | 0),
    files: Math.max(0, c.files | 0),
    // A skip rule (lockfiles, formatting) never asked a model; it stands for the one the player asked for.
    model: c.judge === 'rule' ? c.asked : c.judge,
    rubric: c.rubric,
  }
  const title = clean(c.title).trim().slice(0, 200)
  if (share && title) body.title = title
  if (coder) body.coder = coder
  return body
}

/** A body as it goes once eval capture is known off (Model stats off, or the flag gone): no coder block. */
export function withoutCoder(body: ApiScoreBody): ApiScoreBody {
  if (!('coder' in body)) return body
  const { coder: _gone, ...rest } = body
  return rest
}

/** Retry later (offline, rate limited, the server broke) or give up (the server refused the score itself). */
export function retryable(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

/** Backoff for the outbox: 2, 4, 8 seconds, then every 15. */
export function backoffMs(tries: number) {
  return tries < 3 ? 2000 * 2 ** tries : 15_000
}

/** A poll loop's backoff ceiling: doubling stops here, unless the server asked for longer. */
export const LOOP_CAP_MS = 60_000

/** The longest Retry-After the mod honours: a broken answer can't park a poll for days. */
export const RETRY_AFTER_MAX_MS = 600_000

/**
 * How long the server asked us to wait, in ms: a 429's body `retry_after_ms`
 * (docs/api.md, "Rate limits"), else its `Retry-After` header in whole
 * seconds. null when it said nothing usable; held to 0..10 minutes.
 */
export function retryAfterMs(json: unknown, header: string | null | undefined): number | null {
  const body = (json as { retry_after_ms?: unknown } | null)?.retry_after_ms
  let ms: number | null = null
  if (typeof body === 'number' && Number.isFinite(body) && body >= 0) ms = body
  else if (typeof header === 'string' && /^\s*\d+(\.\d+)?\s*$/.test(header)) ms = Number(header) * 1000
  return ms === null ? null : Math.min(RETRY_AFTER_MAX_MS, Math.round(ms))
}

/**
 * The wait before a poll loop's next tick. With no failure behind it, the
 * poll's own interval. After `failures` answers in a row that call for backing
 * off (`retryable`: nothing, 408, 429 or 5xx), full jitter over a ceiling that
 * doubles from the interval up to max(60 s, Retry-After), never shorter than
 * the interval itself, and never sooner than the server's Retry-After.
 */
export function loopWaitMs(base: number, failures: number, retryAfter: number | null, rand: () => number = Math.random) {
  if (failures <= 0) return base
  const cap = Math.max(LOOP_CAP_MS, retryAfter ?? 0)
  const ceiling = Math.min(cap, base * 2 ** Math.min(failures, 20))
  return Math.max(base, retryAfter ?? 0, jitterMs(ceiling, rand))
}

/** How long a poll's request may hang before its loop gives up on it and moves on: max(60 s, 3 x the interval). */
export function watchdogMs(base: number) {
  return Math.max(60_000, 3 * base)
}

/**
 * How long a request the watchdog gave up on keeps counting against its loop,
 * from when it was sent: max(10 minutes, 10 watchdog periods). Past that it's
 * taken for dead, so a socket that never answers can't stop a poll for good.
 */
export function hungExpiryMs(base: number) {
  return Math.max(600_000, 10 * watchdogMs(base))
}

export function errorOf(json: unknown): { code: string; message: string } | null {
  const e = (json as { error?: { code?: unknown; message?: unknown } } | null)?.error
  return e && typeof e.code === 'string' ? { code: e.code, message: typeof e.message === 'string' ? e.message : e.code } : null
}

/** A poller already past an item the server replaced drops it when the replacement arrives. */
export function mergeEvents(have: ApiMatchEvent[], fresh: ApiMatchEvent[]) {
  const gone = new Set(fresh.flatMap(e => (e.kind === 'score' && e.replaces_seq !== null ? [e.replaces_seq] : [])))
  const seen = new Set(have.map(e => e.seq))
  return [...have.filter(e => !gone.has(e.seq)), ...fresh.filter(e => !seen.has(e.seq))]
}

export function handleProblem(h: string): string | null {
  return /^[a-z0-9_]{2,20}$/.test(h) ? null : 'Invalid handle. Use 2 to 20 of a-z, 0-9 and _.'
}
