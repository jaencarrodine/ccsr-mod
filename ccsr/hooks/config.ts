// The server's config (GET /v1/config, docs/api.md v0.5) as the mod reads it.
// Pure: no `$` here. register.tsx fetches, caches and refreshes it (W1b); the
// sections other workstreams own (buckets, notices, signin, challenges,
// finishers) stay in `raw`, and each one's own parser reads its section from
// there through `cleanServer`.
//
// The rules (build plan, "Final GET /v1/config"):
//   - A mod that has never read a config runs on CONFIG0, which is exactly
//     0.3.0's behaviour. Anything that isn't a config (not an object, no
//     version) reads as CONFIG0 too.
//   - A missing or unknown value is off. Only `true` turns a switch on.
//   - The clamps are wide on purpose: the mod freezes at T-3, and the server's
//     POLL_BOUNDS are the policy (they refuse writes outside them). A poll out
//     of these clamps falls back to CONFIG0's value for that key.

export type PollKey = 'queued' | 'offered' | 'live' | 'idle' | 'chat' | 'config' | 'inbox'

export type ModConfig = {
  /** The body's version, equal to the `x-ccsr-config` header it came with. '' for CONFIG0. */
  readonly version: string
  /** Poll intervals in ms. */
  readonly poll: Readonly<Record<PollKey, number>>
  /** false hides that chat surface; the server answers 403 chat_paused anyway. */
  readonly chat: Readonly<{ world: boolean; tiers: boolean; match: boolean }>
  /** true: ranked is paused, practice only; the server answers 403 ranked_paused. */
  readonly practiceOnly: boolean
  /** The whole body, for the section parsers (buckets, notices, signin, challenges, finishers). */
  readonly raw: Readonly<Record<string, unknown>>
}

export const POLL_KEYS: readonly PollKey[] = ['queued', 'offered', 'live', 'idle', 'chat', 'config', 'inbox']

/** What a poll may be, in ms: [lowest, highest]. Wide, so a later server bound never needs a release. */
export const POLL_CLAMPS: Readonly<Record<PollKey, readonly [number, number]>> = {
  queued: [1000, 600_000],
  offered: [1000, 600_000],
  live: [1000, 600_000],
  idle: [1000, 600_000],
  chat: [1000, 600_000],
  config: [60_000, 3_600_000],
  inbox: [1000, 600_000],
}

/**
 * 0.3.0's behaviour: the queue, the ready check, the live match and chat each
 * poll every 2 s (register.tsx's `every(2000)`), every chat room is open and
 * ranked is on. 0.3.0 has no idle, config or inbox poll; those take the
 * server's code defaults.
 */
export const CONFIG0: ModConfig = Object.freeze({
  version: '',
  poll: Object.freeze({ queued: 2000, offered: 2000, live: 2000, idle: 10_000, chat: 2000, config: 300_000, inbox: 30_000 }),
  chat: Object.freeze({ world: true, tiers: true, match: true }),
  practiceOnly: false,
  raw: Object.freeze({}),
})

/** A header re-read runs at most this often (W1b), so a version that flaps can't make a mod read in a loop. */
export const REREAD_SPACING_MS = 30_000

/** A header re-read waits up to this long first, so a flag flip doesn't bring every mod at once. */
export const REREAD_JITTER_MS = 30_000

/** The surfaces the server takes in `?surface=` (W1b sends the one the pane last drew on). */
export const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile'] as const
export type Surface = (typeof SURFACES)[number]

/** A config version, in the body or the header: 1 to 128 printable ASCII characters, no space. */
function versionOk(v: unknown): v is string {
  return typeof v === 'string' && /^[\x21-\x7e]{1,128}$/.test(v)
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** A poll value within its clamp, rounded to a whole ms; anything else is CONFIG0's. */
function pollOf(src: Record<string, unknown>, k: PollKey) {
  const v = src[k]
  if (typeof v !== 'number' || !Number.isFinite(v)) return CONFIG0.poll[k]
  const ms = Math.round(v)
  const [lo, hi] = POLL_CLAMPS[k]
  return ms >= lo && ms <= hi ? ms : CONFIG0.poll[k]
}

/**
 * The config from a `GET /config` body (or a cached copy of one). Anything that
 * isn't a config gives CONFIG0 itself, so `parseConfig(x) === CONFIG0` tells a
 * caller not to cache it. Never throws.
 */
export function parseConfig(body: unknown): ModConfig {
  if (!isObject(body) || !versionOk(body.version)) return CONFIG0
  const polls = isObject(body.poll_ms) ? body.poll_ms : {}
  const chat = isObject(body.chat) ? body.chat : {}
  const queue = isObject(body.queue) ? body.queue : {}
  const poll = {} as Record<PollKey, number>
  for (const k of POLL_KEYS) poll[k] = pollOf(polls, k)
  return {
    version: body.version,
    poll,
    chat: { world: chat.world === true, tiers: chat.tiers === true, match: chat.match === true },
    practiceOnly: queue.practice_only === true,
    raw: { ...body },
  }
}

/**
 * Config's `line` (W11): whether this account still waits in the line, and about how many are
 * ahead of it. Read off `raw`, like every later section: a missing or odd one is not waiting, so
 * a server from before the line (or a config never read) changes nothing.
 */
export function lineOf(raw: Readonly<Record<string, unknown>>): { waiting: boolean; ahead: number } {
  const l = isObject(raw.line) ? raw.line : {}
  const waiting = l.waiting === true
  const n = typeof l.ahead === 'number' && Number.isFinite(l.ahead) ? Math.floor(l.ahead) : 0
  return { waiting, ahead: waiting ? Math.min(9_999_999, Math.max(0, n)) : 0 }
}

/**
 * Config's `signups` (W11): what the join card needs before there is an account. `githubRequired`:
 * the server takes no handle without a GitHub sign-in. `line`: a new account takes its handle and
 * waits. `email`: a GitHub signup keeps the account's email, so the card says so. Unknown is off.
 */
export function signupsOf(raw: Readonly<Record<string, unknown>>): { githubRequired: boolean; line: boolean; email: boolean } {
  const s = isObject(raw.signups) ? raw.signups : {}
  return { githubRequired: s.github_required === true, line: s.line === true, email: s.email === true }
}

/**
 * Whether an answer's `x-ccsr-config` header calls for a re-read: it names a
 * version other than the one held, and the last read began at least
 * REREAD_SPACING_MS ago. No header (a server before v0.5) never does. The
 * caller waits `jitterMs(REREAD_JITTER_MS)` before reading, never inline.
 */
export function headerReread(header: string | null | undefined, have: Pick<ModConfig, 'version'>, lastReadAt: number, now: number) {
  if (!versionOk(header) || header === have.version) return false
  return now - lastReadAt >= REREAD_SPACING_MS
}

/** A random wait in [0, spanMs): full jitter, for re-reads and backoff alike. */
export function jitterMs(spanMs: number, rand: () => number = Math.random) {
  const span = Math.floor(spanMs)
  if (!(span > 0)) return 0
  const r = rand()
  const ms = Math.floor((Number.isFinite(r) ? r : 0) * span)
  return Math.min(span - 1, Math.max(0, ms))
}

/** The config path, with `?surface=` when the pane has drawn on a surface the server knows. Never a header. */
export function configPath(surface: string | null | undefined) {
  return surface && (SURFACES as readonly string[]).includes(surface) ? `/config?surface=${surface}` : '/config'
}

/**
 * Server text made safe to draw: strips control characters (Cc, newlines and
 * tabs included: server copy is one line), format characters (Cf: bidi
 * overrides, zero-width marks, soft hyphens, BOMs, tags) and the line and
 * paragraph separators U+2028 and U+2029. A stray one can reorder a line on
 * screen or get a whole render tree refused.
 */
export function cleanServer(s: string) {
  return s.replace(/[\p{Cc}\p{Cf}\u2028\u2029]/gu, '')
}
