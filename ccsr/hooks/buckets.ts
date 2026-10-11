// The server's buckets (Open, Verified, later others) as the mod reads them (W3b, build plan
// "Mod lane"). Pure: no `$` here. register.tsx draws the bucket rows, the checklist and the
// standings from these, and posts the queue body from `lengthsFor`.
//
// Where the data comes from:
//   - config's `buckets` section (W3a's ConfigPart): each bucket's id, label, blurb, the
//     lengths it offers in minutes, its requirements as a checklist the server fills in per
//     player, and whether this player can queue it.
//   - `GET /me`'s `buckets` (W3a): one standing per bucket that is on for the player, fresh
//     for unplayed ones. A server before W3a sends none: Open's standing is then the
//     player's own rating, tier and placement.
//
// The rules:
//   - The server enforces, the mod only shows. `can_queue` is drawn as sent, and so is each
//     requirement's `met`; the mod never works out whether a player qualifies.
//   - Unknown means off. A bucket with a bad id or label, or no length left, is dropped; a
//     requirement with a bad id or label is dropped; a `met` that isn't `true` is unmet. An
//     action that `parseAction` drops leaves its requirement with no button.
//   - Every server string goes through `cleanServer` and is one line. Labels and blurbs are
//     drawn as Text, never Markdown.
//   - With one bucket the UI is exactly today's (`bucketRowShown`).
//
// Every limit here freezes with the mod at T-3, so the server must stay inside it:
// docs/architecture.md lists them for W3a ("Limits the server must stay inside").

import { LENGTH_MIN_RANGE, LABEL_MAX, QUEUE_LENGTHS_MAX, parseAction, type Action } from './actions'
import { cleanServer, type ModConfig } from './config'
import type { ApiTier } from '../types'

/** A bucket id, as actions.ts takes it in a queue action. */
export const BUCKET_ID = /^[a-z][a-z0-9_]{0,31}$/
/** A requirement id (`github`, `app`, later others). */
export const REQUIREMENT_ID = /^[a-z][a-z0-9_]{0,31}$/
/** At most this many buckets are read; the rest are dropped. */
export const BUCKETS_MAX = 8
/** At most this many requirements per bucket. */
export const REQUIRES_MAX = 8
/** A bucket's blurb, one line. */
export const BLURB_MAX = 140
/** A requirement's label, one line ("Install the GitHub App on your repos"). */
export const REQUIREMENT_LABEL_MAX = 60
/** The bucket a player is in when nothing else is picked. */
export const OPEN = 'open'

export const TIER_NAMES: readonly ApiTier[] = ['Mud', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master']

export type Requirement = {
  readonly id: string
  readonly label: string
  /** Only `true` from the server is met. */
  readonly met: boolean
  /** What fixes it (sign in, install the App). null: no button. `hidden`: config has it off. */
  readonly action: Action | null
}

export type Bucket = {
  readonly id: string
  readonly label: string
  readonly blurb: string | null
  /** Minutes, distinct, shortest first, never empty. */
  readonly lengths: readonly number[]
  readonly requires: readonly Requirement[]
  /** The server's `can_queue`: only `true` lets the player queue here. */
  readonly canQueue: boolean
}

/** A player's place in one bucket, for the idle card, the queued view and the ready check. */
export type Standing = {
  readonly bucket: string
  readonly rating: number
  readonly tier: ApiTier
  /** Placement matches so far while placing; null once placed. */
  readonly placement: { readonly played: number; readonly of: number } | null
  /** Finished matches in this bucket; null when the server didn't say. */
  readonly matches: number | null
  readonly record: { readonly w: number; readonly l: number; readonly d: number } | null
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function wholeIn(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
}

/** Server text as one line: line breaks and tabs become a space, then cleanServer, trimmed, 1 to `max`; else null. */
function line(v: unknown, max: number) {
  if (typeof v !== 'string') return null
  const s = cleanServer(v.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')).replace(/ {2,}/g, ' ').trim()
  return s.length > 0 && s.length <= max ? s : null
}

/** Whole minutes in the server's range, distinct, shortest first, at most QUEUE_LENGTHS_MAX. */
function minutes(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  const [lo, hi] = LENGTH_MIN_RANGE
  const kept = [...new Set(v.filter((n): n is number => wholeIn(n, lo, hi)))].sort((a, b) => a - b)
  return kept.slice(0, QUEUE_LENGTHS_MAX)
}

function requirementOf(raw: unknown, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>): Requirement | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !REQUIREMENT_ID.test(raw.id)) return null
  const label = line(raw.label, REQUIREMENT_LABEL_MAX)
  if (label === null) return null
  const action = raw.action === undefined || raw.action === null ? null : parseAction(raw.action, cfg)
  return { id: raw.id, label, met: raw.met === true, action }
}

function bucketOf(raw: unknown, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>): Bucket | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !BUCKET_ID.test(raw.id)) return null
  const label = line(raw.label, LABEL_MAX)
  if (label === null) return null
  const lengths = minutes(raw.lengths)
  if (lengths.length === 0) return null
  const requires: Requirement[] = []
  const seen = new Set<string>()
  for (const r of Array.isArray(raw.requires) ? raw.requires : []) {
    const req = requirementOf(r, cfg)
    if (!req || seen.has(req.id)) continue
    seen.add(req.id)
    requires.push(req)
    if (requires.length === REQUIRES_MAX) break
  }
  return { id: raw.id, label, blurb: line(raw.blurb, BLURB_MAX), lengths, requires, canQueue: raw.can_queue === true }
}

/**
 * The buckets in config, in the server's order: each one checked and its text cleaned, the
 * first of any repeated id kept, at most BUCKETS_MAX. [] when config has none (a server
 * before W3a, or CONFIG0): the mod then queues as it does today. Never throws.
 */
export function bucketsOf(cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>): Bucket[] {
  const list = Array.isArray(cfg.raw.buckets) ? cfg.raw.buckets : []
  const out: Bucket[] = []
  const seen = new Set<string>()
  for (const raw of list) {
    const b = bucketOf(raw, cfg)
    if (!b || seen.has(b.id)) continue
    seen.add(b.id)
    out.push(b)
    if (out.length === BUCKETS_MAX) break
  }
  return out
}

/** The bucket rows (Match, Ranked, Grind) show only when there is a choice: one bucket is today's UI. */
export function bucketRowShown(buckets: readonly Bucket[]) {
  return buckets.length > 1
}

/**
 * A bucket id the server sent somewhere else (`QueueState.bucket`, `Offer.bucket`,
 * `POST /queue`'s answer, `MatchSummary.bucket`), or one kept in the store: the id when it
 * reads as one, else null. The caller then keeps what it had, never a guess.
 */
export function bucketIdOf(v: unknown): string | null {
  return typeof v === 'string' && BUCKET_ID.test(v) ? v : null
}

/**
 * The bucket to show while idle: the one picked if config still has it, else Open, else
 * the first. null when config has none. While queued the caller uses `QueueState.bucket`
 * as the server sent it instead, and normalizes only once idle again.
 */
export function pickBucket(buckets: readonly Bucket[], picked: string | null | undefined): Bucket | null {
  return buckets.find(b => b.id === picked) ?? buckets.find(b => b.id === OPEN) ?? buckets[0] ?? null
}

/**
 * The lengths a queue posts, in minutes, shortest first: the player's pick (null means every
 * length offered) within the bucket's lengths and, once the lanes poll has answered, within
 * the lanes the server offers this player right now. With no bucket (no `buckets` in
 * config) the lanes alone bound the pick. [] when nothing is left: the caller shows that
 * and never queues an empty list.
 */
export function lengthsFor(bucket: Bucket | null, picked: readonly number[] | null, lanes: readonly number[] | null = null): number[] {
  let offered: number[] | null = bucket ? [...bucket.lengths] : null
  if (lanes) {
    const live = minutes(lanes)
    offered = offered ? offered.filter(n => live.includes(n)) : live
  }
  if (picked === null) return offered ?? []
  const want = minutes(picked)
  return offered ? want.filter(n => offered.includes(n)) : want
}

function tierOf(v: unknown): ApiTier | null {
  return typeof v === 'string' && (TIER_NAMES as readonly string[]).includes(v) ? (v as ApiTier) : null
}

function placementOf(v: unknown): Standing['placement'] | undefined {
  if (v === null) return null
  if (isObject(v) && wholeIn(v.played, 0, 1000) && wholeIn(v.of, 1, 1000)) return { played: v.played, of: v.of }
  return undefined
}

function recordOf(v: unknown): Standing['record'] {
  if (!isObject(v)) return null
  const max = Number.MAX_SAFE_INTEGER
  return wholeIn(v.w, 0, max) && wholeIn(v.l, 0, max) && wholeIn(v.d, 0, max) ? { w: v.w, l: v.l, d: v.d } : null
}

/** A standing from the server's fields; null when the rating, tier or placement isn't readable. */
function standingOf(bucket: string, raw: Record<string, unknown>, matchesKey: string): Standing | null {
  const rating = raw.rating
  if (typeof rating !== 'number' || !Number.isFinite(rating)) return null
  const tier = tierOf(raw.tier)
  const placement = placementOf(raw.placement)
  if (tier === null || placement === undefined) return null
  const m = raw[matchesKey]
  return { bucket, rating: Math.round(rating), tier, placement, matches: wholeIn(m, 0, Number.MAX_SAFE_INTEGER) ? m : null, record: recordOf(raw.record) }
}

/**
 * The player's standing in one bucket, from a `GET /me` answer: its entry in `buckets`
 * (`{ bucket, rating, tier, placement, matches, record }`), else, for Open only, the
 * player's own fields, which is all a server before W3a has. null when neither reads: the
 * caller draws no rating rather than a wrong one. Never throws.
 */
export function standingFor(me: unknown, bucketId: string): Standing | null {
  if (!isObject(me)) return null
  const list = Array.isArray(me.buckets) ? me.buckets : []
  const entry = list.find((x): x is Record<string, unknown> => isObject(x) && x.bucket === bucketId)
  if (entry) {
    const s = standingOf(bucketId, entry, 'matches')
    if (s) return s
  }
  if (bucketId !== OPEN || !isObject(me.player)) return null
  return standingOf(OPEN, me.player, 'matches_played')
}
