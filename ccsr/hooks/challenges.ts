// Challenges as the mod reads and writes them (W6b, build plan "Mod lane"): the `challenges`
// config value, the challenge code and its link, the message limits, and a challenge and the
// inbox as the server sends them (W6b's wiring, below the message). Pure: no `$` here and no
// request paths.
//
// `challengeCfg` is the one reader of the `challenges` value (build plan, Decisions: "one
// parser for server, W1, W4 and W6"). W6a mirrors it, byte for byte, in server/src/rules.ts,
// with `parseChallenges` as the FlagSpec's parse, so the server never stores a value the mod
// reads differently. Both use nothing outside this block.
//
// The rules:
//   - Unknown means off: anything but `true` or an object with `on: true` is off, and a
//     `message_max` that isn't a whole number in range is no message at all.
//   - `true` is everything on at the launch values; the launch row written at T-3 says the
//     same thing as an object.
//   - A challenge message is player text, like chat: it is drawn as Text through
//     `cleanServer`, one line, and only while the Chat switch is on. It never reaches a
//     command reply, Claude's context or the site.
//
// Every limit here freezes with the mod at T-3, so the server must stay inside it:
// docs/architecture.md lists them for W6a ("Limits the server must stay inside").

import { cleanServer } from './config'
import { safeLink } from './actions'
import { BUCKET_ID, OPEN, TIER_NAMES } from './buckets'
import { LENGTH_LABEL_MAX, LENGTH_MAX, LENGTH_MIN, lengthLabel } from './pure'
import type { ApiTier } from '../types'

// ------------------------------------------------------------------ the config value (mirrored in server/src/rules.ts)

/** What the `challenges` value turns on. */
export type ChallengeCfg = {
  /** Challenges exist for this player: the inbox, the cards, the Challenges switch. */
  on: boolean
  /** They may send one (off: 403 challenges_paused). */
  send: boolean
  /** Open challenges: one anyone with the code or link can take. */
  open: boolean
  /** The longest message, in UTF-16 code units, the server's and the mod's count alike; 0 is no message. */
  message_max: number
}

/** The ceiling on `message_max`, the same as chat's. */
export const MESSAGE_MAX = 280
/** `message_max` when the value is plain `true`, and in the launch row. */
export const MESSAGE_DEFAULT = 140

/** The `challenges` value as the server stores and sends it: false, true, or every key of the object. */
export type ChallengesFlag = boolean | { on: boolean; send: boolean; open: boolean; message_max: number }

/** What a `challenges` value turns on, for this player. Never throws. */
export function challengeCfg(raw: unknown): ChallengeCfg {
  if (raw === true) return { on: true, send: true, open: true, message_max: MESSAGE_DEFAULT }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { on: false, send: false, open: false, message_max: 0 }
  const o = raw as Record<string, unknown>
  if (o.on !== true) return { on: false, send: false, open: false, message_max: 0 }
  const m = o.message_max
  const messageMax = typeof m === 'number' && Number.isInteger(m) && m >= 0 && m <= MESSAGE_MAX ? m : 0
  return { on: true, send: o.send === true, open: o.open === true, message_max: messageMax }
}

/**
 * The FlagSpec's parse: the value itself when it is false, true, or an object with exactly
 * `on`, `send` and `open` as booleans and `message_max` a whole number from 0 to
 * MESSAGE_MAX; undefined refuses the write. Never clamps.
 */
export function parseChallenges(raw: unknown): ChallengesFlag | undefined {
  if (typeof raw === 'boolean') return raw
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined
  const o = raw as Record<string, unknown>
  const keys = Object.keys(o).sort().join()
  if (keys !== 'message_max,on,open,send') return undefined
  if (typeof o.on !== 'boolean' || typeof o.send !== 'boolean' || typeof o.open !== 'boolean') return undefined
  const m = o.message_max
  if (typeof m !== 'number' || !Number.isInteger(m) || m < 0 || m > MESSAGE_MAX) return undefined
  return { on: o.on, send: o.send, open: o.open, message_max: m }
}

// ------------------------------------------------------------------ the code and its link

/**
 * A challenge's id, which is its code: 6 to 12 capital letters and digits. The server
 * makes them from CODE_ALPHABET (no 0, 1, I, L or O, so a code read aloud or retyped from a
 * post comes out right), at 6 characters; the mod takes any of the wider shape, so a longer
 * code later needs no release.
 */
export const CODE = /^[A-Z0-9]{6,12}$/
export const CODE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'
/** The site's page for a challenge, which installs the mod and then takes it. */
export const LINK_BASE = 'https://ccsr.gg/c/'

const LINK = /^(?:https?:\/\/)?(?:www\.)?ccsr\.gg\/c\/([^/?#]+)\/?(?:[?#].*)?$/i

/**
 * The code in what a player typed or pasted into the code box: the code itself (any case,
 * spaces and dashes ignored) or its ccsr.gg link. null for anything else, a link to another
 * site included.
 */
export function challengeCode(input: unknown): string | null {
  if (typeof input !== 'string' || input.length > 2048) return null
  const s = input.trim()
  const m = LINK.exec(s)
  // Anything left of a link to another site has a `/`, `.` or `:` in it, which no code has.
  const code = (m ? m[1]! : s).replace(/[\s-]+/g, '').toUpperCase()
  return CODE.test(code) ? code : null
}

/** A challenge's link, to copy or share; null for anything that isn't a code. */
export function challengeLink(code: unknown): string | null {
  return typeof code === 'string' && CODE.test(code) ? LINK_BASE + code : null
}

/** A challenge's link as the mod may draw or copy it (W6b): `challengeLink`, and only when `safeLink` passes it on ccsr.gg; else null. */
export function challengeHref(code: unknown): string | null {
  const u = challengeLink(code)
  return u !== null && safeLink(u, ['ccsr.gg']) ? u : null
}

// ------------------------------------------------------------------ the message

/** Characters a message never carries: controls, zero-width and bidi marks, line and paragraph separators. */
const UNSAFE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2028\u2029\u2066-\u2069\uFEFF]/g

/** A message typed in the form: one line, cleaned the way the server cleans chat. */
export function cleanMessage(text: string) {
  return text.replace(UNSAFE, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * The message to send with a challenge, checked against config before it goes: null when
 * there is none, `off` when this player can't send one, `too_long` past `message_max`. A
 * message is never cut short on the way out; the player edits it.
 */
export function messageOut(text: string, cfg: ChallengeCfg): { message: string | null } | { problem: 'off' | 'too_long' } {
  const message = cleanMessage(text)
  if (message === '') return { message: null }
  if (!cfg.on || !cfg.send || cfg.message_max === 0) return { problem: 'off' }
  if (message.length > cfg.message_max) return { problem: 'too_long' }
  return { message }
}

/** A message the server sent, ready to draw as Text: one line, cleaned, at most MESSAGE_MAX; else null. */
export function messageIn(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  // A cut at the limit never leaves half of a surrogate pair behind.
  const s = cleanServer(cleanMessage(raw)).replace(/ {2,}/g, ' ').trim().slice(0, MESSAGE_MAX).replace(/[\uD800-\uDBFF]$/, '').trim()
  return s === '' ? null : s
}

// ------------------------------------------------------------------ a challenge, as the server sends it (W6b)
// docs/api.md `Challenge`, read for drawing and acting on: the code, who sent it and to whom
// (null for an open one), the length and its label, the bucket, the status, the times, who took
// it, how its last ready check ended and the match it made. The message comes back beside it,
// as `messageIn` draws it, so a caller can keep it apart: it never goes in `$.state`.
//
// Unknown means it can't be acted on: a challenge with a code, a ref, a length, a status or a
// time that doesn't read is left out whole, never half drawn. Every string is the server's,
// cleaned (`cleanServer`) and one line.

/** A player as a challenge names them: what the cards draw. */
export type ChallengeRef = {
  readonly handle: string
  readonly rating: number
  readonly tier: ApiTier
  /** Placement matches so far while placing (they show Mud with no number); null once placed. */
  readonly placing: { readonly played: number; readonly of: number } | null
}

export const CHALLENGE_STATUSES = ['pending', 'accepted', 'played', 'declined', 'cancelled', 'expired'] as const
export type ChallengeStatus = (typeof CHALLENGE_STATUSES)[number]

/** A challenge as the mod reads it, its message apart. */
export type Challenge = {
  /** Its code (6 to 12 of A to Z and 0 to 9), as the server writes it. */
  readonly id: string
  readonly from: ChallengeRef
  /** null: open, anyone with the code takes it. */
  readonly to: ChallengeRef | null
  readonly lengthMin: number
  /** The length's label from the server's catalog (15m), else the mod's own words. */
  readonly label: string
  readonly bucket: string
  readonly status: ChallengeStatus
  /** In ms since 1970, as `Date.parse` reads them. */
  readonly createdAt: number
  readonly expiresAt: number
  /** Who took the current or last offer. */
  readonly takenBy: ChallengeRef | null
  /** How the last ready check made from it ended without starting. */
  readonly lastOffer: 'expired' | 'declined' | null
  /** The current or last match made from it: its id, status, result and the winner's handle. */
  readonly match: { readonly id: string; readonly status: string; readonly result: string | null; readonly winner: string | null } | null
}

/** A challenge and its message (`messageIn`'s: one Text line, null for none). */
export type ChallengeRead = { readonly challenge: Challenge; readonly message: string | null }

/** A handle as the server makes them. */
const HANDLE = /^[a-z0-9_]{2,20}$/
/** A match id, as a path segment the mod may put in a request. */
const MATCH_ID = /^[A-Za-z0-9_-]{1,64}$/

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function wholeIn(v: unknown, lo: number, hi: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
}

/** A time the server sent, in ms since 1970 (`Date.parse`); null when it doesn't read. */
function timeOf(v: unknown): number | null {
  if (typeof v !== 'string') return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/** A short word the server sent (a status, a result), cleaned, or null. */
function word(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const s = cleanServer(v).trim()
  return s.length > 0 && s.length <= 32 ? s : null
}

/** A PlayerRef as the cards draw it; null when its handle, rating or tier doesn't read. */
export function refOf(raw: unknown): ChallengeRef | null {
  if (!isObject(raw) || typeof raw.handle !== 'string' || !HANDLE.test(raw.handle)) return null
  if (typeof raw.rating !== 'number' || !Number.isFinite(raw.rating)) return null
  if (typeof raw.tier !== 'string' || !(TIER_NAMES as readonly string[]).includes(raw.tier)) return null
  const p = raw.placement
  const placing = isObject(p) && wholeIn(p.played, 0, 100) && wholeIn(p.of, 1, 100) ? { played: p.played, of: p.of } : null
  return { handle: raw.handle, rating: Math.round(raw.rating), tier: raw.tier as ApiTier, placing }
}

/** A length label from the server, as one clean line of 1 to 12 characters, else the mod's own words. */
function labelOf(raw: unknown, min: number) {
  const s = typeof raw === 'string' ? cleanServer(raw).trim() : ''
  return s.length >= 1 && s.length <= LENGTH_LABEL_MAX ? s : lengthLabel(min)
}

/** One `Challenge` from the server, with its message apart; null when it can't be acted on. Never throws. */
export function readChallenge(raw: unknown): ChallengeRead | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !CODE.test(raw.id)) return null
  const from = refOf(raw.from)
  if (!from) return null
  const to = raw.to === null ? null : refOf(raw.to)
  if (raw.to !== null && !to) return null
  if (!wholeIn(raw.length_min, LENGTH_MIN, LENGTH_MAX)) return null
  if (typeof raw.status !== 'string' || !(CHALLENGE_STATUSES as readonly string[]).includes(raw.status)) return null
  const createdAt = timeOf(raw.created_at)
  const expiresAt = timeOf(raw.expires_at)
  if (createdAt === null || expiresAt === null) return null
  const last = isObject(raw.last_offer) ? raw.last_offer.ended : null
  const m = raw.match
  const match =
    isObject(m) && typeof m.id === 'string' && MATCH_ID.test(m.id) && word(m.status)
      ? { id: m.id, status: word(m.status)!, result: word(m.result), winner: typeof m.winner === 'string' && HANDLE.test(m.winner) ? m.winner : null }
      : null
  const challenge: Challenge = {
    id: raw.id,
    from,
    to,
    lengthMin: raw.length_min,
    label: labelOf(raw.label, raw.length_min),
    bucket: typeof raw.bucket === 'string' && BUCKET_ID.test(raw.bucket) ? raw.bucket : OPEN,
    status: raw.status as ChallengeStatus,
    createdAt,
    expiresAt,
    takenBy: refOf(raw.taken_by),
    lastOffer: last === 'expired' || last === 'declined' ? last : null,
    match,
  }
  return { challenge, message: messageIn(raw.message) }
}

// ------------------------------------------------------------------ the inbox (W6b)
// `GET /challenges?rev=`: pending and accepted challenges to you and from you, plus those that
// ended in the last day, newest first. With `?rev=` at the current rev the server answers
// `{ rev, unchanged: true }` and nothing else: keep what you hold.

/** At most this many a side are read (the server sends at most 20). */
export const INBOX_MAX = 20

export type Inbox =
  | { readonly rev: number; readonly unchanged: true }
  | { readonly rev: number; readonly unchanged: false; readonly incoming: readonly ChallengeRead[]; readonly outgoing: readonly ChallengeRead[] }

/** The challenges in a list, each read, the first of a repeated code kept, at most INBOX_MAX. */
function side(raw: unknown): ChallengeRead[] {
  const out: ChallengeRead[] = []
  const seen = new Set<string>()
  for (const x of Array.isArray(raw) ? raw : []) {
    const r = readChallenge(x)
    if (!r || seen.has(r.challenge.id)) continue
    seen.add(r.challenge.id)
    out.push(r)
    if (out.length === INBOX_MAX) break
  }
  return out
}

/** The inbox from a `GET /challenges` answer; null when it isn't one (no whole `rev`). Never throws. */
export function readInbox(raw: unknown): Inbox | null {
  if (!isObject(raw) || !wholeIn(raw.rev, 0, 2_147_483_647)) return null
  if (raw.unchanged === true) return { rev: raw.rev, unchanged: true }
  return { rev: raw.rev, unchanged: false, incoming: side(raw.incoming), outgoing: side(raw.outgoing) }
}
