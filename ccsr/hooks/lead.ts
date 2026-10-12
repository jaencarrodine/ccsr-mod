// One ranked poller per machine (2026-10-12), the pure part.
//
// Every session used to poll the queue and the match for itself: N sessions made N times the
// requests (GET /queue is limited to 4 a second per player, which nine sessions polling every 2 s
// pass), each rang its own bell, and each kept its own copy of the server's answers, so a session
// that stopped reading went stale for good (stuck at the bell, "Checking with the server.",
// "placing 0 of 3"). Now one session at a time holds a lease in the store and polls; what it reads
// goes into the store as a snapshot, and every session draws that.
//
//   - The lease (`rankedLead`): { by, until }. A session's tick takes it when it is free, run out
//     or its own, and follows otherwise. A press takes it outright (`force`): the window in use is
//     the one that polls. It lasts past the holder's next tick, its longest backoff wait included,
//     so a server that is down or shedding is asked by one session, never by each in turn.
//   - The snapshot (`rankedShare`): the queue state, the lanes and the match page as the leader
//     last had them, with a rev. Any session applies one it hasn't seen that another wrote.
//   - What a session's own reads found about the account and the boards (`seen`): GET /me and the
//     board reads, for every other session to take instead of asking again.
//
// Nothing here touches the engine: register.tsx reads and writes the store around these.

import { LOOP_CAP_MS } from './api'

export type Lead = { by: string; until: number }

/** A lease is never shorter than this, so a 2 s poll renews it about every 8 s, not every tick. */
export const LEAD_MIN_MS = 15_000

/** The snapshot is written again this often even when nothing in it moved, so a follower's "last heard" keeps moving. */
export const SHARE_BEAT_MS = 10_000

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

export function leadOf(raw: unknown): Lead | null {
  return isObject(raw) && typeof raw.by === 'string' && raw.by !== '' && typeof raw.until === 'number' && Number.isFinite(raw.until) ? { by: raw.by, until: raw.until } : null
}

/**
 * How long a lease taken now lasts: past the holder's next tick with room to spare. `every` is the
 * poll's interval; after `failures` answers in a row that call for backing off, the next tick may
 * wait up to the loop's ceiling (loopWaitMs: doubling from the interval to max(60 s, Retry-After)),
 * and the lease covers that too, so the sessions following don't each take a turn at a server that
 * is down or shedding.
 */
export function leadMs(every: number, failures: number, retryAfter: number | null): number {
  const base = Number.isFinite(every) && every > 0 ? every : 2000
  const cap = Math.max(LOOP_CAP_MS, retryAfter ?? 0)
  const wait = failures > 0 ? Math.max(base, retryAfter ?? 0, Math.min(cap, base * 2 ** Math.min(failures, 20))) : base
  return Math.max(LEAD_MIN_MS, Math.round(wait + Math.max(5000, wait / 2)))
}

/**
 * What a tick does with the lease the store holds: whether this session leads, and the lease to
 * write when one is needed (null when there is nothing to write). Free, run out or its own, it
 * leads; its own with over half left is not written again. `force` (a press here) takes it from
 * whoever holds it.
 */
export function takeLead(held: Lead | null, by: string, now: number, ms: number, force = false): { lead: boolean; write: Lead | null } {
  if (!force && held && held.by !== by && held.until > now) return { lead: false, write: null }
  if (held && held.by === by && held.until - now > ms / 2) return { lead: true, write: null }
  return { lead: true, write: { by, until: now + ms } }
}

/** Whether another session holds a lease that hasn't run out: what this one read is not to be shared, nor acted on. */
export function ledByOther(held: Lead | null, by: string, now: number) {
  return !!held && held.by !== by && held.until > now
}

/**
 * The snapshot: the leader's queue state, lanes and match page, for the account `key` (server and
 * handle). The parts are the server's own answers as the leader kept them, written by this mod to
 * its own store, so only the envelope is checked.
 */
export type Share = { rev: string; at: number; by: string; key: string; queue: unknown; lanes: unknown; lanesBucket: string | null; ranked: unknown }

export function shareOf(raw: unknown): Share | null {
  if (!isObject(raw) || typeof raw.rev !== 'string' || typeof raw.by !== 'string' || typeof raw.key !== 'string' || typeof raw.at !== 'number') return null
  const ranked = isObject(raw.ranked) && typeof raw.ranked.id === 'string' && Array.isArray(raw.ranked.events) && typeof raw.ranked.cursor === 'number' ? raw.ranked : null
  return {
    rev: raw.rev,
    at: raw.at,
    by: raw.by,
    key: raw.key,
    queue: isObject(raw.queue) ? raw.queue : null,
    lanes: Array.isArray(raw.lanes) ? raw.lanes : null,
    lanesBucket: typeof raw.lanesBucket === 'string' ? raw.lanesBucket : null,
    ranked,
  }
}

/** A snapshot's content as one string, for "did anything move": everything but when the match page was last read. */
export function shareBody(s: Pick<Share, 'key' | 'queue' | 'lanes' | 'lanesBucket' | 'ranked'>): string {
  const ranked = isObject(s.ranked) ? { ...s.ranked, polledAt: 0 } : null
  return JSON.stringify({ key: s.key, queue: s.queue ?? null, lanes: s.lanes ?? null, lanesBucket: s.lanesBucket ?? null, ranked })
}

/**
 * The account and board reads one session made, for the others: only the fields a read answered
 * are there. `at` moves on every write. `meAt` is the account read's own stamp: when the account
 * fields (ACCOUNT_FIELDS) were read from the server. Every write merges its part over what the
 * store holds, so a board read carries the account another read left, under a newer `at`; only
 * `meAt` says how old that account is.
 */
export type SeenCopy = { key: string; at: number; by: string; meAt?: number } & Partial<Record<SeenField, unknown>>
export const SEEN_FIELDS = ['me', 'account', 'meBuckets', 'ladder', 'myRank', 'grindRank', 'grindOf', 'recent'] as const
export type SeenField = (typeof SEEN_FIELDS)[number]
/** What one GET /me answers: taken together, and only from an account read newer than the one a session holds. */
export const ACCOUNT_FIELDS: readonly SeenField[] = ['me', 'account', 'meBuckets']

export function seenCopyOf(raw: unknown): SeenCopy | null {
  if (!isObject(raw) || typeof raw.key !== 'string' || typeof raw.by !== 'string' || typeof raw.at !== 'number') return null
  const out: SeenCopy = { key: raw.key, at: raw.at, by: raw.by }
  if (typeof raw.meAt === 'number' && Number.isFinite(raw.meAt)) out.meAt = raw.meAt
  for (const f of SEEN_FIELDS) if (raw[f] !== undefined) out[f] = raw[f]
  return out
}

/**
 * The fields of `seen` written since this session last looked (`since`: the `at` of the copy it last
 * took or wrote), for this account; null when there is nothing to take. A session takes what is
 * there before it writes its own part, so one session's account read and another's board read
 * both reach a third. The account fields come only from an account read newer than the one this
 * session holds (`meSince`): a copy with no `meAt` (a mod from before it) or an older one keeps
 * its board fields and loses its account, which may be older than what is on screen here.
 */
export function seenToTake(seen: SeenCopy | null, key: string, since: number, meSince = 0): Partial<Record<SeenField, unknown>> | null {
  if (!seen || seen.key !== key || seen.at <= since) return null
  const fresh = (seen.meAt ?? 0) > meSince
  const out: Partial<Record<SeenField, unknown>> = {}
  for (const f of SEEN_FIELDS) if (seen[f] !== undefined && (fresh || !ACCOUNT_FIELDS.includes(f))) out[f] = seen[f]
  return Object.keys(out).length ? out : null
}
