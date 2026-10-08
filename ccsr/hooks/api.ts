// The CCSR server's shapes (docs/api.md v0.2) and the pure helpers the mod
// needs to talk to it. No `$` here: register.tsx makes every request.

import { clean } from './pure'
import type { ApiMatchEvent, ApiScoreBody, ScoredCommit } from '../types'

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
 */
export async function scoreBody(c: ScoredCommit, salt: string, share: boolean): Promise<ApiScoreBody> {
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
  return body
}

/** Retry later (offline, rate limited, the server broke) or give up (the server refused the score itself). */
export function retryable(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

/** Backoff for the outbox: 2, 4, 8 seconds, then every 15. */
export function backoffMs(tries: number) {
  return tries < 3 ? 2000 * 2 ** tries : 15_000
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
  return /^[a-z0-9_]{2,20}$/.test(h) ? null : '2 to 20 of a-z, 0-9 and _.'
}
