// The server's notices as the mod reads, picks, caps and counts them (build
// plan, W4b; product plan, "Notices"). Pure: no `$` here. W4b draws them in
// register.tsx, fires the triggers, keeps the ledgers in the store and posts
// the stats; every decision it makes goes through this file.
//
// The rules:
//   - The vocabulary is fixed and freezes with the mod: 6 layouts, 10 places,
//     5 levels, 12 triggers, the 11 actions of actions.ts and 7 variables.
//     parseNotices drops a whole notice, never part of it, on anything it
//     doesn't know: an unknown key at any depth, an unknown layout, place,
//     level, trigger, `do`, tab or variable, a place its layout can't draw in,
//     a broken limit, a link that isn't safe. The server's validator (W4a)
//     refuses all of these first; docs/architecture.md lists them ("Built:
//     notices, the pure part").
//   - Every string goes through cleanServer, as one line. Links in a body are
//     `[text](url)` with url passing allowedUrl (canonical https on ccsr.gg or
//     github.com); anything Markdown or a terminal could turn into another
//     link, in a title, body or button label, drops the notice.
//   - Off switches win. The Notices setting (all, important, off) and each
//     place's own switch decide where a notice may draw. A critical notice
//     that can't draw in any of its own places draws as a banner in the Match
//     tab's top slot instead, never as a toast or flash the player turned off.
//   - Caps are counted per config dir (the store's ledger) and per session
//     (this session's ledger), both passed in. Preview notices skip the
//     store's caps and stats and never touch the store's ledger; in a session
//     they show at most their cap's `times`, as if `per` were session.
//   - A toast or a status flash fires once per arming of its trigger, and one
//     with no trigger at most once a session (alertDue), whatever its caps
//     would still allow; caps bound how often it may show, never how soon.
//   - Stats carry notice ids, revs and counts only, never text.
//   - Nothing here ever reaches Claude: the text it builds is for the pane,
//     the band, a toast or the status line, never for a command reply.

import { LENGTH_MIN_RANGE, LINK_HOSTS, QUEUE_LENGTHS_MAX, parseAction, safeLink, type Action } from './actions'
import { SURFACES, cleanServer, type ModConfig, type Surface } from './config'
import { NOTICE, QUIET } from './copy'
import { SCALE, TIERS } from './pure'
import { cmpVersion } from './version'
import type { Surfaces } from '../types'

// ------------------------------------------------------------------ vocabulary

export const LAYOUTS = ['banner', 'card', 'toast', 'status', 'world', 'result'] as const
export type Layout = (typeof LAYOUTS)[number]

export const PLACES = ['match', 'band', 'toast', 'status', 'ranked', 'grind', 'chat', 'settings', 'queue', 'result'] as const
export type Place = (typeof PLACES)[number]

export const LEVELS = ['info', 'success', 'warn', 'critical', 'promo'] as const
export type Level = (typeof LEVELS)[number]

export const TRIGGERS = ['pane_open', 'session_start', 'queued', 'match_found', 'match_start', 'result', 'tier', 'placed', 'first_score', 'score', 'update_available', 'back_online'] as const
export type TriggerOn = (typeof TRIGGERS)[number]

/** Filled by the server before a notice is sent; one left in the text drops the notice. */
export const SERVER_VARS = ['handle', 'tier', 'rating', 'rank', 'season'] as const
/** Filled by the mod when it draws: `{countdown:<ISO>}` and `{local:<ISO>}`. */
export const MOD_VARS = ['countdown', 'local'] as const
export const VARIABLES = [...SERVER_VARS, ...MOD_VARS] as const

/** The Settings switch: everything, critical and warn only, or nothing but the critical fallback. */
export const NOTICE_SETTINGS = ['all', 'important', 'off'] as const
export type NoticeSetting = (typeof NOTICE_SETTINGS)[number]

export const CAP_PERS = ['session', 'day', 'ever'] as const
export type CapPer = (typeof CAP_PERS)[number]
export const STOP_ONS = ['seen', 'click', 'dismiss'] as const
export type StopOn = (typeof STOP_ONS)[number]
export const OUTCOMES = ['win', 'loss', 'draw'] as const
export type Outcome = (typeof OUTCOMES)[number]
export const TIER_DIRS = ['up', 'down'] as const
export type TierDir = (typeof TIER_DIRS)[number]

export type Phase = 'idle' | 'queued' | 'offered' | 'live' | 'done'

const PANE: readonly Place[] = ['match', 'band', 'ranked', 'grind', 'chat', 'settings', 'queue', 'result']

/**
 * Where each layout may draw. A card in the band draws in its banner form; a
 * world notice is a line in the Chat tab's World room; toasts and status
 * flashes have their own place only.
 */
export const LAYOUT_PLACES: Readonly<Record<Layout, readonly Place[]>> = {
  banner: PANE,
  card: PANE,
  toast: ['toast'],
  status: ['status'],
  world: ['chat'],
  result: ['result'],
}

// ------------------------------------------------------------------ limits (they freeze with the mod)

export const NOTICE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
/** At most this many notices are read from one list; the server sends at most 20. */
export const NOTICES_MAX = 20
export const TITLE_MAX = 60
export const BODY_MAX = 280
/** Buttons besides Dismiss, which `dismissible` adds on its own. */
export const ACTIONS_MAX = 2
export const PRIORITY_RANGE = [0, 100] as const
export const REV_MAX = 2_147_483_647
export const CAP_TIMES_RANGE = [1, 50] as const
/** How long a trigger keeps its notice armed, in seconds. */
export const FOR_S_RANGE = [1, 3600] as const
export const FOR_S_DEFAULT = 600
export const AFTER_S_RANGE = [1, 3600] as const
/** Title and body limits count each mod variable at its widest: "23 h 59 min" and "Fri 17:00". */
export const FILL_WIDTH: Readonly<Record<(typeof MOD_VARS)[number], number>> = { countdown: 11, local: 9 }
/** Times in a notice are years 2000 to 2099, so a countdown stays inside its width. */
export const ISO_YEARS = [2000, 2099] as const

/** A status flash lasts this long. */
export const FLASH_MS = 8000
/** Notice toasts are at least this far apart. */
export const TOAST_GAP_MS = 8000
/** A flash on the short status line is cut to this many characters. */
export const STATUS_SHORT_MAX = 24
/** A fire claim holds this long, so every open session sees one toast, not one each. */
export const FIRE_HOLD_MS = 60_000
/** A feed notice's claim holds this long: once per match. */
export const FEED_HOLD_MS = 86_400_000
/** The store's ledger keeps at most this many ids, each until 30 days after it leaves config. */
export const LEDGER_MAX = 200
export const LEDGER_KEEP_MS = 30 * 86_400_000
/** One stats post carries at most 100 ids, each count at most 1000; the rest waits for the next. */
export const STATS_ITEMS_MAX = 100
export const STATS_COUNT_MAX = 1000
/** One session per store sends the stats, under a lease this long. */
export const LEASE_MS = 30_000
/**
 * Stats posts from one store are at least this far apart: W4a takes one a
 * minute per player, and a lapsed lease alone would let two sessions post
 * 31 s apart. The margin covers clocks and the network.
 */
export const STATS_GAP_MS = 90_000

// ------------------------------------------------------------------ the parsed shape

export type Trigger =
  | { on: Exclude<TriggerOn, 'queued' | 'result' | 'tier' | 'score'>; forS: number }
  /** Queued at least afterS seconds, for lengths all inside lengthsMin (null: any). */
  | { on: 'queued'; afterS: number; lengthsMin: number[] | null; forS: number }
  /** A void match fires only a result trigger with no outcome. */
  | { on: 'result'; outcome: Outcome | null; forS: number }
  | { on: 'tier'; dir: TierDir | null; forS: number }
  /** A fresh commit scored at minPoints or more. */
  | { on: 'score'; minPoints: number; forS: number }

export type Notice = {
  readonly id: string
  readonly rev: number
  readonly layout: Layout
  /** Empty only for a notice another notice's `{ do: 'notice' }` opens. */
  readonly where: readonly Place[]
  readonly level: Level
  /** One clean line, with any mod variables still in it (fillMod fills them). */
  readonly title: string
  /** One clean line of the small Markdown set, or null. */
  readonly body: string | null
  readonly actions: readonly Action[]
  /** null: it shows whenever its window is open. */
  readonly trigger: Trigger | null
  /** In ms; null is open on that side. */
  readonly window: { readonly from: number | null; readonly to: number | null }
  readonly cap: { readonly times: number; readonly per: CapPer; readonly stopOn: readonly StopOn[] }
  readonly dismissible: boolean
  readonly priority: number
  /** null: any surface. */
  readonly surfaces: readonly Surface[] | null
  /** Sent only to preview handles: no caps, no stats. */
  readonly preview: boolean
}

// ------------------------------------------------------------------ small helpers

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function oneOf<T extends string>(v: unknown, list: readonly T[]): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

function intIn(v: unknown, [lo, hi]: readonly [number, number]): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
}

/** Only these keys, if any: an unknown key drops the notice. */
function onlyKeys(o: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(o).every(k => keys.includes(k))
}

/** Absent and null read the same: the default. */
function given(v: unknown) {
  return v !== undefined && v !== null
}

/** Server text as one clean line: each run of line breaks and tabs is one space, then cleanServer, trimmed. */
function oneLine(s: string) {
  return cleanServer(s.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')).trim()
}

/** Characters, not UTF-16 units: the lenient count, so the mod never refuses what the server measured. */
function chars(s: string) {
  return [...s].length
}

const pad = (n: number) => String(n).padStart(2, '0')

// ------------------------------------------------------------------ times and variables

const ISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/

/**
 * A time as the server writes one, in ms: `2026-10-17T17:00:00.000Z`, seconds
 * and fraction optional, Z or an offset, every field in range (no 31 February,
 * which Date would roll into March), years 2000 to 2099. Anything else is null.
 */
export function isoMs(s: unknown): number | null {
  if (typeof s !== 'string') return null
  const m = ISO.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const h = Number(m[4])
  const mi = Number(m[5])
  const sec = m[6] ? Number(m[6]) : 0
  const ms = m[7] ? Number(m[7].padEnd(3, '0')) : 0
  if (y < ISO_YEARS[0] || y > ISO_YEARS[1] || mo < 1 || mo > 12 || h > 23 || mi > 59 || sec > 59) return null
  if (d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate()) return null
  let offMin = 0
  if (m[8] !== 'Z') {
    const oh = Number(m[10])
    const om = Number(m[11])
    if (oh > 14 || om > 59) return null
    offMin = (m[9] === '-' ? -1 : 1) * (oh * 60 + om)
  }
  return Date.UTC(y, mo - 1, d, h, mi, sec, ms) - offMin * 60_000
}

/** `{name}` or `{name:arg}`; the only ones a notice may still hold are the mod's two, with a good time. */
const VAR = /\{([a-z_]+)(?::([^{}]*))?\}/g

/** The mod variables in a text, or null when it holds a brace that isn't one of them with a good time. */
function modVars(s: string): { name: (typeof MOD_VARS)[number]; at: number }[] | null {
  const found: { name: (typeof MOD_VARS)[number]; at: number }[] = []
  let bad = false
  const rest = s.replace(VAR, (_tok, name: string, arg: string | undefined) => {
    const at = isoMs(arg)
    if (!oneOf(name, MOD_VARS) || at === null) bad = true
    else found.push({ name, at })
    return ''
  })
  return bad || /[{}]/.test(rest) ? null : found
}

/** How wide a text draws at worst, each mod variable at its widest. */
function widthOf(s: string) {
  return chars(s.replace(VAR, (_tok, name: string) => 'x'.repeat(oneOf(name, MOD_VARS) ? FILL_WIDTH[name] : 0)))
}

/**
 * Time left, in the words the mod shows: `now`, `<1 min`, `12 min`,
 * `1 h 12 min`, `5 h`, `26 h` (a day or more, under two), `3 days`. Minutes
 * round down, and nothing finer than a minute shows, since a pane can lag 30 s.
 */
export function countdown(ms: number) {
  if (!(ms > 0)) return NOTICE.now
  if (ms < 60_000) return NOTICE.underMin
  const m = Math.floor(ms / 60_000)
  if (m < 60) return NOTICE.min(m)
  const h = Math.floor(m / 60)
  if (h < 24) return m % 60 ? NOTICE.hMin(h, m % 60) : NOTICE.h(h)
  if (h < 48) return NOTICE.h(h)
  return NOTICE.days(Math.floor(h / 24))
}

/** A time on the player's own clock: `Fri 17:00`, 24-hour. `timeZone` is for tests; the default is the machine's. */
export function localTime(at: number, timeZone?: string) {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(at))
    const part = (t: string) => parts.find(p => p.type === t)?.value ?? ''
    const wd = part('weekday')
    const hh = part('hour')
    const mm = part('minute')
    if (NOTICE.weekdays.includes(wd) && /^\d{2}$/.test(hh) && /^\d{2}$/.test(mm)) return NOTICE.local(wd, hh === '24' ? '00' : hh, mm)
  } catch {
    // An engine without time zones: the machine's own clock below.
  }
  const d = new Date(at)
  return NOTICE.local(NOTICE.weekdays[d.getDay()] ?? '', pad(d.getHours()), pad(d.getMinutes()))
}

/**
 * The text with its mod variables filled: `{countdown:ISO}` against the
 * server's clock (`now + skewMs`), `{local:ISO}` on the player's. null when the
 * text holds anything else in braces (parseNotices already dropped those).
 */
export function fillMod(text: string, now: number, skewMs = 0, timeZone?: string): string | null {
  if (modVars(text) === null) return null
  return text.replace(VAR, (_tok, name: string, arg: string) => {
    const at = isoMs(arg) as number
    return name === 'countdown' ? countdown(at - (now + skewMs)) : localTime(at, timeZone)
  })
}

/** A local calendar day, `2026-10-10`: what a `per: 'day'` cap counts in. */
export function dayKey(ms: number) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ------------------------------------------------------------------ links and the body

/** A link a notice may carry: canonical https on ccsr.gg or github.com exactly (actions.ts's safeLink). */
export function allowedUrl(u: unknown): u is string {
  return safeLink(u, LINK_HOSTS)
}

/** `[text](url)`, text without brackets, url without parentheses or spaces. */
const LINK = /\[([^[\]]*)\]\(([^()\s]*)\)/g

/**
 * Anything Markdown could turn into a link, a terminal into a clickable
 * address, or that is HTML: link syntax, any `<`, entities, `://`, `www.`, a
 * `scheme:` glued to what follows (javascript:, mailto:, file:) and an address
 * with an `@`. Refused in every line a notice draws: title, body and button
 * label (a body's own `[text](url)` links are taken out first).
 */
const LINKISH: readonly (readonly [RegExp, string])[] = [
  [/\]\(|\]\[|\]:/, 'link syntax outside a [text](url) link'],
  [/</, 'HTML'],
  [/&(#|[A-Za-z][A-Za-z0-9]*;)/, 'an HTML entity'],
  [/:\/\//, 'a bare URL'],
  [/www\./i, 'a bare URL'],
  [/(^|[^A-Za-z0-9+.-])[A-Za-z][A-Za-z0-9+.-]*:(?=\S)/, 'a scheme'],
  [/\S@\S/, 'an address'],
]

/** Markdown blocks and tables: refused in a body. In a title or label they could only change how the line looks, never where it leads. */
const BLOCKS: readonly (readonly [RegExp, string])[] = [
  [/\|/, 'a table'],
  [/```|~~~/, 'a code fence'],
  [/^\s{0,3}#{1,6}(\s|$)/, 'a heading'],
  [/^\s{0,3}([-*+]|\d{1,9}[.)])(\s|$)/, 'a list'],
  [/^\s{0,3}>/, 'a quote'],
  [/^\s{0,3}([-*_])(\s*\1){2,}\s*$/, 'a rule'],
]

/** The first rule a text breaks, its mod variables read as plain words (they were checked on their own). */
function broken(text: string, rules: readonly (readonly [RegExp, string])[]) {
  const flat = text.replace(VAR, '0')
  for (const [re, what] of rules) if (re.test(flat)) return what
  return null
}

/**
 * Why a title or a button label can't be drawn, or null when it can: nothing
 * link-shaped (LINKISH), whether W4b draws it as Text, where a terminal makes
 * `https://` pressable, or through Markdown, which autolinks.
 */
export function lineProblem(line: string): string | null {
  return broken(line, LINKISH)
}

/**
 * Why a body can't be drawn, or null when it can. The Markdown element draws
 * like an assistant reply: it makes http: and file: links clickable and
 * autolinks bare URLs, so the only link it may ever see is `[text](url)` with
 * url passing allowedUrl (and holding no `&` or `\`, which Markdown would
 * decode after the check), and only bold, italics and code besides. Refused:
 * images, everything in LINKISH outside those links, tables, fences,
 * headings, lists, quotes and rules. `linksOk` false (toasts and status
 * flashes) refuses links too.
 */
export function bodyProblem(body: string, linksOk = true): string | null {
  if (body.includes('![')) return 'an image'
  let bad: string | null = null
  const text = body.replace(LINK, (_m, label: string, url: string) => {
    if (!linksOk) bad ??= 'a link where none can be pressed'
    else if (!label.trim()) bad ??= 'a link with no text'
    else if (/[&\\]/.test(url)) bad ??= 'an entity or escape in a link'
    else if (!allowedUrl(url)) bad ??= 'a link that is not canonical https on ccsr.gg or github.com'
    return label
  })
  if (bad) return bad
  return broken(text, LINKISH) ?? broken(text, BLOCKS)
}

/** A body as plain text, for a toast: links keep their text, and bold, italic and code marks go. */
export function plainText(body: string) {
  return body
    .replace(LINK, (_m, label: string) => label)
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/`(.+?)`/g, '$1')
    .replace(/(^|[^A-Za-z0-9])_(.+?)_(?=$|[^A-Za-z0-9])/g, '$1$2')
}

// ------------------------------------------------------------------ parsing

const NOTICE_KEYS = ['id', 'rev', 'layout', 'where', 'level', 'title', 'body', 'actions', 'trigger', 'window', 'cap', 'dismissible', 'priority', 'surfaces', 'preview']

/** A title: one clean line, 1 to `max` wide at worst, holding no variable but the mod's two and nothing link-shaped. */
function textOf(v: unknown, max: number): string | null {
  if (typeof v !== 'string') return null
  const s = oneLine(v)
  if (!s || modVars(s) === null || widthOf(s) > max || lineProblem(s) !== null) return null
  return s
}

/** false: refused. */
function triggerOf(v: unknown): Trigger | null | false {
  if (!given(v)) return null
  if (!isObject(v) || !oneOf(v.on, TRIGGERS)) return false
  const forS = given(v.for_s) ? v.for_s : FOR_S_DEFAULT
  if (!intIn(forS, FOR_S_RANGE)) return false
  switch (v.on) {
    case 'queued': {
      if (!onlyKeys(v, ['on', 'for_s', 'after_s', 'lengths']) || !intIn(v.after_s, AFTER_S_RANGE)) return false
      let lengthsMin: number[] | null = null
      if (given(v.lengths)) {
        const l = v.lengths
        if (!Array.isArray(l) || l.length === 0 || l.length > QUEUE_LENGTHS_MAX || !l.every(n => intIn(n, LENGTH_MIN_RANGE))) return false
        lengthsMin = [...new Set(l as number[])].sort((a, b) => a - b)
      }
      return { on: 'queued', afterS: v.after_s, lengthsMin, forS }
    }
    case 'result': {
      if (!onlyKeys(v, ['on', 'for_s', 'outcome'])) return false
      if (given(v.outcome) && !oneOf(v.outcome, OUTCOMES)) return false
      return { on: 'result', outcome: given(v.outcome) ? (v.outcome as Outcome) : null, forS }
    }
    case 'tier': {
      if (!onlyKeys(v, ['on', 'for_s', 'dir'])) return false
      if (given(v.dir) && !oneOf(v.dir, TIER_DIRS)) return false
      return { on: 'tier', dir: given(v.dir) ? (v.dir as TierDir) : null, forS }
    }
    case 'score': {
      if (!onlyKeys(v, ['on', 'for_s', 'min_points'])) return false
      const p = v.min_points
      if (typeof p !== 'number' || !(SCALE as readonly number[]).includes(p)) return false
      return { on: 'score', minPoints: p, forS }
    }
    default:
      return onlyKeys(v, ['on', 'for_s']) ? { on: v.on, forS } : false
  }
}

function windowOf(v: unknown): Notice['window'] | false {
  if (!given(v)) return { from: null, to: null }
  if (!isObject(v) || !onlyKeys(v, ['from', 'to'])) return false
  const from = given(v.from) ? isoMs(v.from) : null
  const to = given(v.to) ? isoMs(v.to) : null
  if ((given(v.from) && from === null) || (given(v.to) && to === null)) return false
  if (from !== null && to !== null && from >= to) return false
  return { from, to }
}

function capOf(v: unknown): Notice['cap'] | false {
  if (!isObject(v) || !onlyKeys(v, ['times', 'per', 'stop_on'])) return false
  if (!intIn(v.times, CAP_TIMES_RANGE) || !oneOf(v.per, CAP_PERS)) return false
  const raw = given(v.stop_on) ? v.stop_on : []
  const list = typeof raw === 'string' ? [raw] : raw
  if (!Array.isArray(list) || !list.every(s => oneOf(s, STOP_ONS))) return false
  return { times: v.times, per: v.per, stopOn: [...new Set(list as StopOn[])] }
}

function surfacesOf(v: unknown): readonly Surface[] | null | false {
  if (!given(v)) return null
  if (!Array.isArray(v) || v.length === 0 || !v.every(s => oneOf(s, SURFACES))) return false
  return [...new Set(v as Surface[])]
}

/** One notice, or null to drop it whole. Never throws. */
function parseNotice(raw: unknown, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>): Notice | null {
  if (!isObject(raw) || !onlyKeys(raw, NOTICE_KEYS)) return null
  const { id, rev, layout, level, where } = raw
  if (typeof id !== 'string' || !NOTICE_ID.test(id) || !intIn(rev, [0, REV_MAX])) return null
  if (!oneOf(layout, LAYOUTS) || !oneOf(level, LEVELS)) return null
  // An unknown place, or one its layout can't draw in.
  if (!Array.isArray(where) || !where.every(p => oneOf(p, LAYOUT_PLACES[layout]))) return null

  const title = textOf(raw.title, TITLE_MAX)
  if (title === null) return null
  const pressable = layout !== 'toast' && layout !== 'status'
  let body: string | null = null
  if (given(raw.body)) {
    if (typeof raw.body !== 'string') return null
    const b = oneLine(raw.body)
    if (b) {
      if (modVars(b) === null || widthOf(b) > BODY_MAX || bodyProblem(b, pressable) !== null) return null
      body = b
    }
  }

  const dismissible = given(raw.dismissible) ? raw.dismissible : false
  if (typeof dismissible !== 'boolean') return null
  const list = given(raw.actions) ? raw.actions : []
  if (!Array.isArray(list) || list.length > ACTIONS_MAX || (list.length > 0 && !pressable)) return null
  const actions: Action[] = []
  for (const a of list) {
    const p = parseAction(a, cfg)
    // A notice button needs its label, with no variable and nothing link-shaped in it; Copy's text holds
    // no variable either (an unfilled one would land on the clipboard); a dismissible notice draws its own Dismiss.
    if (!p || p.label === null || /[{}]/.test(p.label) || lineProblem(p.label) !== null) return null
    if ((p.do === 'copy' && /[{}]/.test(p.text)) || (p.do === 'dismiss' && dismissible)) return null
    actions.push(p)
  }

  const trigger = triggerOf(raw.trigger)
  const window = windowOf(raw.window)
  const cap = capOf(raw.cap)
  const surfaces = surfacesOf(raw.surfaces)
  if (trigger === false || window === false || cap === false || surfaces === false) return null
  const priority = given(raw.priority) ? raw.priority : 0
  if (!intIn(priority, PRIORITY_RANGE)) return null
  const preview = given(raw.preview) ? raw.preview : false
  if (typeof preview !== 'boolean') return null

  return { id, rev, layout, where: [...new Set(where as Place[])], level, title, body, actions, trigger, window, cap, dismissible, priority, surfaces, preview }
}

/**
 * The notices in a list from the server (config's `notices`, or a live match's
 * feed), at most NOTICES_MAX read, each parsed strictly: anything unknown or
 * out of bounds drops that notice whole, and the rest still show. Not a list
 * means none. An id seen twice keeps its first. A `{ do: 'notice' }` button
 * whose target isn't in `targets` (default: the ids that survived here) is
 * hidden, as actions.ts hides one config didn't send. Never throws.
 */
export function parseNotices(list: unknown, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>, targets?: readonly string[]): Notice[] {
  if (!Array.isArray(list)) return []
  const out: Notice[] = []
  const ids = new Set<string>()
  for (const raw of list.slice(0, NOTICES_MAX)) {
    let n: Notice | null = null
    try {
      n = parseNotice(raw, cfg)
    } catch {
      n = null
    }
    if (!n || ids.has(n.id)) continue
    ids.add(n.id)
    out.push(n)
  }
  const known = targets ? new Set(targets) : ids
  return out.map(n =>
    n.actions.some(a => a.do === 'notice' && !a.hidden && !known.has(a.id)) ? { ...n, actions: n.actions.map(a => (a.do === 'notice' && !known.has(a.id) ? { ...a, hidden: true } : a)) } : n,
  )
}

/** Config's notices. */
export function noticesOf(cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>) {
  return parseNotices(cfg.raw.notices, cfg)
}

/** A live match's feed notices: critical and warn only (the server sends no others), buttons opening config's notices. */
export function feedNotices(list: unknown, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>) {
  const targets = noticesOf(cfg).map(n => n.id)
  return parseNotices(list, cfg, targets).filter(n => n.level === 'critical' || n.level === 'warn')
}

// ------------------------------------------------------------------ the ledgers

/** One notice's caps in the store, shared by every session on this config dir. Keyed by id only: a rev never re-shows. */
export type CapEntry = {
  /** When this entry last changed, or its id was last in config: for pruning. */
  readonly at: number
  /** Showings ever. */
  readonly n?: number
  /** The local day of the last showing, and the showings that day. */
  readonly day?: string
  readonly dayN?: number
  readonly clicked?: number
  readonly dismissed?: number
  /** The local day of the last dismissal. */
  readonly dismissedDay?: string
  readonly snoozeUntil?: number
}
export type CapLedger = Readonly<Record<string, CapEntry>>

/** This session's own: showings, cards already drawn, dismissals, snoozes, notices opened by a button, and toasts and flashes fired. */
export type SessionLedger = {
  readonly shown: Readonly<Record<string, number>>
  readonly drawn: Readonly<Record<string, true>>
  readonly dismissed: Readonly<Record<string, true>>
  readonly snoozed: Readonly<Record<string, number>>
  readonly opened: Readonly<Record<string, Place>>
  /** A toast's or a flash's arming it fired for (noteAlerted): its armedAt, 0 for one with no trigger. */
  readonly alerted: Readonly<Record<string, number>>
}
export const SESSION0: SessionLedger = Object.freeze({ shown: {}, drawn: {}, dismissed: {}, snoozed: {}, opened: {}, alerted: {} })

/** What the picker needs to know about this moment, this session and the player's switches. */
export type NoticeView = {
  /** This machine's clock, ms. */
  readonly now: number
  /** The server's clock minus this one, from the config read. Windows and countdowns use now + skewMs. */
  readonly skewMs: number
  /** dayKey(now + skewMs). */
  readonly day: string
  /** The surface drawing ('terminal', 'desktop'), or null when unknown. */
  readonly surface: string | null
  readonly setting: NoticeSetting
  /** The band is `band` (Band when idle) between matches and `bandMatch` (Band in matches) from the queue to the result. */
  readonly switches: Pick<Surfaces, 'toasts' | 'status' | 'band' | 'bandMatch' | 'chat'>
  /** Config's chat.world: false keeps World lines off. */
  readonly chatWorld: boolean
  readonly phase: Phase
  /** Notice id to the time (this clock) its trigger stays armed until. */
  readonly armed: Readonly<Record<string, number>>
  /**
   * Notice id to when the arming it's in began (this clock), for alertDue: the moment that armed
   * it; for update_available the first answer naming the newest release seen (releaseArming),
   * however often it re-arms; for the queued trigger the queue's crossing of after_s, however
   * often the queue is read.
   */
  readonly armedAt: Readonly<Record<string, number>>
  readonly ledger: CapLedger
  readonly session: SessionLedger
  /** When this session last showed a notice toast. */
  readonly lastToastAt: number
}

// ------------------------------------------------------------------ eligibility

/** The Notices setting: all, critical and warn, or none (the critical fallback is apart). */
export function levelShows(level: Level, setting: NoticeSetting) {
  return setting === 'all' || (setting === 'important' && (level === 'critical' || level === 'warn'))
}

/** A place's own switch. The pane places (match, ranked, grind, settings, queue, result) have none but the Notices setting. */
function switchOpen(place: Place, n: Notice, v: NoticeView) {
  const sw = v.switches
  switch (place) {
    case 'toast':
      // Through ambient: Match only keeps critical CCSR notices.
      return sw.toasts === 'all' || (sw.toasts === 'match' && n.level === 'critical')
    case 'status':
      return sw.status !== 'off'
    case 'band':
      // As register.tsx's renderBand: Band in matches while queued, offered, live and on the
      // result; Band when idle between matches. (An offer out blocks it anyway: phaseBlocks.)
      return v.phase === 'idle' ? sw.band !== 'off' : sw.bandMatch === 'on'
    case 'chat':
      return sw.chat === 'on' && (n.layout !== 'world' || v.chatWorld)
    default:
      return true
  }
}

/** Nothing pops over the ready check: no notice toast, status flash or band notice while an offer is out. */
function phaseBlocks(place: Place, phase: Phase) {
  return phase === 'offered' && (place === 'toast' || place === 'status' || place === 'band')
}

export function inWindow(n: Pick<Notice, 'window'>, at: number) {
  return (n.window.from === null || at >= n.window.from) && (n.window.to === null || at < n.window.to)
}

function onSurface(n: Notice, surface: string | null) {
  return n.surfaces === null || (surface !== null && (n.surfaces as readonly string[]).includes(surface))
}

/**
 * The stops the store's ledger holds for every session on the machine: a
 * snooze, and a dismissal for the cap's period (for good with stop_on dismiss
 * or an ever cap, today with a day cap; a session cap's dismissal holds only in
 * its own session, through the session's ledger). A preview has none.
 */
function storeAway(n: Notice, v: NoticeView) {
  if (n.preview) return false
  const e = v.ledger[n.id]
  if (e?.snoozeUntil !== undefined && e.snoozeUntil > v.now) return true
  return !!e?.dismissed && (n.cap.stopOn.includes('dismiss') || n.cap.per === 'ever' || (n.cap.per === 'day' && e.dismissedDay === v.day))
}

/** Put away by the player: dismissed or snoozed in this session, or held away by the store (storeAway). */
export function putAway(n: Notice, v: NoticeView) {
  return !!v.session.dismissed[n.id] || (v.session.snoozed[n.id] ?? 0) > v.now || storeAway(n, v)
}

/**
 * Its caps and the player's stops: snooze, dismiss, click, seen, then times
 * per session, day or ever. A preview reads no store ledger: in a session it
 * shows `times` showings (a drawn card stays up), so a previewed toast doesn't
 * come back every minute.
 */
function capOpen(n: Notice, v: NoticeView) {
  if (n.preview) return !!v.session.drawn[n.id] || (v.session.shown[n.id] ?? 0) < n.cap.times
  const e = v.ledger[n.id]
  const stop = n.cap.stopOn
  // A snooze, and a dismissal for the cap's period (and for good with stop_on dismiss).
  if (storeAway(n, v)) return false
  if (e?.clicked && stop.includes('click')) return false
  // A card this session already drew is this session's showing: it stays up.
  if (v.session.drawn[n.id]) return true
  if (e?.n && stop.includes('seen')) return false
  const count = n.cap.per === 'session' ? (v.session.shown[n.id] ?? 0) : n.cap.per === 'day' ? (e?.day === v.day ? (e.dayN ?? 0) : 0) : (e?.n ?? 0)
  return count < n.cap.times
}

/** Everything but the place: this session's dismissals and snoozes, the window, the surface, then caps and the trigger. */
function ready(n: Notice, v: NoticeView) {
  if (v.session.dismissed[n.id] || (v.session.snoozed[n.id] ?? 0) > v.now) return false
  if (!inWindow(n, v.now + v.skewMs) || !onSurface(n, v.surface)) return false
  // Opened by a button: no caps, no trigger.
  if (v.session.opened[n.id]) return true
  return capOpen(n, v) && (n.trigger === null || (v.armed[n.id] ?? 0) > v.now)
}

/** Its own place, or the place a `{ do: 'notice' }` button opened it in (when its layout draws there). */
function placedIn(n: Notice, place: Place, v: NoticeView) {
  return n.where.includes(place) || (v.session.opened[n.id] === place && LAYOUT_PLACES[n.layout].includes(place))
}

/** Whether a notice may draw in this place now. */
export function eligible(n: Notice, place: Place, v: NoticeView) {
  if (!levelShows(n.level, v.setting)) return false
  if (!placedIn(n, place, v)) return false
  if (!switchOpen(place, n, v) || phaseBlocks(place, v.phase)) return false
  return ready(n, v)
}

/**
 * A critical notice none of whose own places is open (Notices off, their
 * switches off, chat.world off) draws as a banner in the Match tab's top slot.
 * An offer out is not a switch: that waits.
 */
export function fallsBack(n: Notice, v: NoticeView) {
  if (n.level !== 'critical' || n.where.length === 0) return false
  if (n.where.some(p => levelShows(n.level, v.setting) && switchOpen(p, n, v))) return false
  return ready(n, v)
}

const LEVEL_RANK: Readonly<Record<Level, number>> = { critical: 4, warn: 3, success: 2, info: 1, promo: 0 }

/** The order a place picks in: priority, then level (critical, warn, success, info, promo), then id. */
export function noticeOrder(a: Notice, b: Notice) {
  return b.priority - a.priority || LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

export type NoticeForm = 'card' | 'banner' | 'line' | 'toast' | 'status'

/** How a notice draws in a place: a card in the band is its banner, a World notice a line in the log. */
export function formFor(n: Notice, place: Place): NoticeForm {
  switch (n.layout) {
    case 'card':
    case 'result':
      return place === 'band' ? 'banner' : 'card'
    case 'world':
      return 'line'
    default:
      return n.layout
  }
}

export type NoticePick = { readonly notice: Notice; readonly slot: Place; readonly form: NoticeForm }

/**
 * The one notice for a screen: the best eligible across `places` (in that
 * order on a tie), and on the Match tab the critical fallback too. One pick,
 * so there is never more than one card on screen.
 */
export function pickFor(notices: readonly Notice[], places: readonly Place[], v: NoticeView): NoticePick | null {
  let best: NoticePick | null = null
  for (const place of places) {
    for (const n of notices) {
      const form = eligible(n, place, v) ? formFor(n, place) : place === 'match' && fallsBack(n, v) ? 'banner' : null
      if (form && (!best || noticeOrder(n, best.notice) < 0)) best = { notice: n, slot: place, form }
    }
  }
  return best
}

/** The places on the Match tab: its top slot, the queue while queued, the result screen when done. */
export function matchTabPlaces(phase: Phase): Place[] {
  return ['match', ...(phase === 'queued' ? (['queue'] as const) : []), ...(phase === 'done' ? (['result'] as const) : [])]
}

/**
 * Whether a toast or a status flash may fire now (W4b's call, 2026-10-11; it freezes with the mod):
 * one with a trigger once per arming (`armedAt`: a later moment that arms it again fires it again,
 * a release or a queue re-arming it doesn't), one with no trigger at most once a session. Without
 * this, the caps alone let a toast come back each time a claim lapsed, every minute, until its
 * cap was spent. A session that loses the claim spends it too (noteAlerted): the toast just
 * showed in another session.
 */
export function alertDue(n: Notice, v: Pick<NoticeView, 'armedAt' | 'session'>) {
  const was = v.session.alerted[n.id]
  if (was === undefined) return true
  return n.trigger !== null && (v.armedAt[n.id] ?? 0) > was
}

/** A toast or a flash fired here, or another session's claim held it: its arming (0 with no trigger) is spent in this session. */
export function noteAlerted(session: SessionLedger, n: Notice, v: Pick<NoticeView, 'armedAt'>): SessionLedger {
  return { ...session, alerted: { ...session.alerted, [n.id]: n.trigger === null ? 0 : (v.armedAt[n.id] ?? 0) } }
}

/** update_available's arming in a session: the newest release it saw named above its own version, and when that was first named. */
export type ReleaseArming = { readonly latest: string; readonly start: number }

/**
 * update_available's arming after an answer naming `latest` above this mod, at `at` (W4b's call,
 * 2026-10-11; it freezes with the mod): one arming for each newer release named. Answers that
 * keep naming it, or an older one, keep that arming however far apart they come (an idle
 * session hears only its config timer, up to the load valve's 30 minutes), and an answer naming
 * none in between never ends it, so two instances that disagree during a deploy never re-arm
 * it. Only a release newer than any named before begins another.
 */
export function releaseArming(was: ReleaseArming | null, latest: string, at: number): ReleaseArming {
  return was && cmpVersion(latest, was.latest) <= 0 ? was : { latest, start: at }
}

/** The toast to show now, if any: one at a time, at least TOAST_GAP_MS after the last, once per arming (alertDue). */
export function pickToast(notices: readonly Notice[], v: NoticeView): Notice | null {
  if (v.now - v.lastToastAt < TOAST_GAP_MS) return null
  return pickFor(notices.filter(n => alertDue(n, v)), ['toast'], v)?.notice ?? null
}

/** The status flash to show now, if any, once per arming (alertDue). */
export function pickFlash(notices: readonly Notice[], v: NoticeView): Notice | null {
  return pickFor(notices.filter(n => alertDue(n, v)), ['status'], v)?.notice ?? null
}

/**
 * Whether a live match's feed notice draws its line on the live screen: critical always, warn
 * unless Notices is off; never once the player put it away (putAway: a dismissal or a snooze,
 * here or, for the cap's period, in any session on the machine, the same notice's slot copy
 * included, since the feed sends a config notice's id).
 */
export function feedLine(n: Notice, v: NoticeView) {
  return inWindow(n, v.now + v.skewMs) && onSurface(n, v.surface) && (n.level === 'critical' || levelShows(n.level, v.setting)) && !putAway(n, v)
}

/** How a feed notice alerts: a toast, else a status flash, else nothing. It follows the Notices setting and the switches, and never once put away. */
export function feedAlert(n: Notice, v: NoticeView): 'toast' | 'status' | null {
  if (!levelShows(n.level, v.setting) || v.phase === 'offered' || putAway(n, v)) return null
  if (!inWindow(n, v.now + v.skewMs) || !onSurface(n, v.surface)) return null
  return switchOpen('toast', n, v) ? 'toast' : switchOpen('status', n, v) ? 'status' : null
}

/** The fire claim's key for a feed notice: once per match. */
export function feedKey(matchId: string, id: string) {
  return `feed:${matchId}:${id}`
}

/**
 * A notice's buttons as drawn now: not hidden by config, queue only while
 * signed in and idle, queued (re-posting keeps your place) or on the result,
 * and challenge only while signed in, between matches (idle or on the result:
 * W6b's form isn't drawn while queued, in a ready check or in a match) and
 * with `challenges` not false: the caller's word that challenges are live here
 * and sending isn't paused (W6b's challengesLive: config on, the Challenges
 * switch on), so a press always opens the form.
 */
export function buttonsFor(n: Notice, at: { phase: Phase; signedIn: boolean; challenges?: boolean }): Action[] {
  return n.actions.filter(a => {
    if (a.hidden) return false
    if (a.do === 'queue') return at.signedIn && (at.phase === 'idle' || at.phase === 'queued' || at.phase === 'done')
    if (a.do === 'challenge') return at.signedIn && at.challenges !== false && (at.phase === 'idle' || at.phase === 'done')
    return true
  })
}

// ------------------------------------------------------------------ the words drawn

/** Title and body with the mod variables filled; null if a variable can't be (parseNotices drops those first). */
export function noticeText(n: Notice, now: number, skewMs = 0, timeZone?: string): { title: string; body: string | null } | null {
  const title = fillMod(n.title, now, skewMs, timeZone)
  const body = n.body === null ? null : fillMod(n.body, now, skewMs, timeZone)
  if (title === null || (n.body !== null && body === null)) return null
  return { title, body }
}

/** A toast's one line: the title, then the body as plain text. */
export function toastText(n: Notice, now: number, skewMs = 0, timeZone?: string) {
  const t = noticeText(n, now, skewMs, timeZone)
  if (!t) return null
  return t.body ? NOTICE.toast(t.title, plainText(t.body)) : t.title
}

/** A status flash: the title, cut to STATUS_SHORT_MAX on the short status line. */
export function flashText(n: Notice, short: boolean, now: number, skewMs = 0, timeZone?: string) {
  const t = noticeText(n, now, skewMs, timeZone)
  if (!t) return null
  const c = [...t.title]
  return short && c.length > STATUS_SHORT_MAX ? NOTICE.cut(c.slice(0, STATUS_SHORT_MAX - 1).join('')) : t.title
}

// ------------------------------------------------------------------ triggers

export type NoticeEvent =
  | { on: 'pane_open' | 'session_start' | 'match_found' | 'match_start' | 'placed' | 'first_score' | 'update_available' | 'back_online' }
  | { on: 'queued'; queuedS: number; lengthsMin: readonly number[] }
  | { on: 'result'; outcome: Outcome | 'void' }
  | { on: 'tier'; dir: TierDir }
  | { on: 'score'; points: number }

/** Whether an event fires a trigger. */
export function triggerHits(t: Trigger, e: NoticeEvent): boolean {
  if (t.on !== e.on) return false
  switch (t.on) {
    case 'queued': {
      const q = e as Extract<NoticeEvent, { on: 'queued' }>
      return q.queuedS >= t.afterS && q.lengthsMin.length > 0 && (t.lengthsMin === null || q.lengthsMin.every(m => t.lengthsMin!.includes(m)))
    }
    case 'result': {
      const r = e as Extract<NoticeEvent, { on: 'result' }>
      return t.outcome === null || t.outcome === r.outcome
    }
    case 'tier':
      return t.dir === null || t.dir === (e as Extract<NoticeEvent, { on: 'tier' }>).dir
    case 'score':
      return (e as Extract<NoticeEvent, { on: 'score' }>).points >= t.minPoints
    default:
      return true
  }
}

/** Arms every notice the event fires, for its trigger's for_s; returns the new armed map and what it hit. */
export function armFor(notices: readonly Notice[], e: NoticeEvent, armed: Readonly<Record<string, number>>, now: number) {
  const next: Record<string, number> = { ...armed }
  const hit: Notice[] = []
  for (const n of notices) {
    if (!n.trigger || !triggerHits(n.trigger, e)) continue
    next[n.id] = Math.max(next[n.id] ?? 0, now + n.trigger.forS * 1000)
    hit.push(n)
  }
  return { armed: next, hit }
}

const TIER_MIN = new Map(TIERS.map(([name, min]) => [name.toLowerCase(), min]))

/**
 * The events a finished match fires for one side: its result, then `placed`
 * when this match finished placement (never `tier` then), or `tier` up or down
 * when a placed player's tier changed. A forfeit is the win or loss it was.
 */
export function matchEndEvents(x: { outcome: Outcome | 'void'; tierBefore: string | null; tierAfter: string | null; placingBefore: boolean; placingAfter: boolean }): NoticeEvent[] {
  const out: NoticeEvent[] = [{ on: 'result', outcome: x.outcome }]
  if (x.placingBefore && !x.placingAfter) return [...out, { on: 'placed' }]
  if (x.placingBefore || x.placingAfter) return out
  const a = TIER_MIN.get(String(x.tierBefore).toLowerCase())
  const b = TIER_MIN.get(String(x.tierAfter).toLowerCase())
  if (a === undefined || b === undefined || a === b) return out
  return [...out, { on: 'tier', dir: b > a ? 'up' : 'down' }]
}

// ------------------------------------------------------------------ caps: what a showing, a press, a dismiss and a snooze write

/** The store's ledger and this session's, as each note returns them. */
export type NoticeLedgers = { ledger: CapLedger; session: SessionLedger }

function withEntry(ledger: CapLedger, id: string, now: number, f: (e: CapEntry) => Omit<CapEntry, 'at'>): CapLedger {
  const e: CapEntry = ledger[id] ?? { at: now }
  return { ...ledger, [id]: { ...e, ...f(e), at: now } }
}

/**
 * A showing: one toast or status flash, or a card or banner's first draw in a
 * session (noteDrawn). Preview notices count in the session only.
 */
export function noteShown(ledger: CapLedger, session: SessionLedger, n: Notice, v: Pick<NoticeView, 'now' | 'day'>): NoticeLedgers {
  const s = { ...session, shown: { ...session.shown, [n.id]: (session.shown[n.id] ?? 0) + 1 } }
  if (n.preview) return { ledger, session: s }
  return { ledger: withEntry(ledger, n.id, v.now, e => ({ n: (e.n ?? 0) + 1, day: v.day, dayN: (e.day === v.day ? (e.dayN ?? 0) : 0) + 1 })), session: s }
}

/** A card or banner drawn: a showing the first time this session, nothing after. */
export function noteDrawn(ledger: CapLedger, session: SessionLedger, n: Notice, v: Pick<NoticeView, 'now' | 'day'>): NoticeLedgers & { counted: boolean } {
  if (session.drawn[n.id]) return { ledger, session, counted: false }
  const next = noteShown(ledger, { ...session, drawn: { ...session.drawn, [n.id]: true } }, n, v)
  return { ...next, counted: true }
}

/** A button pressed (not a Link: the mod never sees those). */
export function noteClick(ledger: CapLedger, n: Notice, v: Pick<NoticeView, 'now'>): CapLedger {
  return n.preview ? ledger : withEntry(ledger, n.id, v.now, e => ({ clicked: (e.clicked ?? 0) + 1 }))
}

/** Dismissed: gone for this session, for the cap's period, and for good with stop_on dismiss. */
export function noteDismiss(ledger: CapLedger, session: SessionLedger, n: Notice, v: Pick<NoticeView, 'now' | 'day'>): NoticeLedgers {
  const opened = { ...session.opened }
  delete opened[n.id]
  const s = { ...session, dismissed: { ...session.dismissed, [n.id]: true as const }, opened }
  if (n.preview) return { ledger, session: s }
  return { ledger: withEntry(ledger, n.id, v.now, e => ({ dismissed: (e.dismissed ?? 0) + 1, dismissedDay: v.day })), session: s }
}

/**
 * Snoozed for `min` minutes, on every session (a preview's in this one only).
 * This session holds it too, and a notice a button opened closes, as on a dismiss.
 */
export function noteSnooze(ledger: CapLedger, session: SessionLedger, n: Notice, v: Pick<NoticeView, 'now'>, min: number): NoticeLedgers {
  const until = v.now + Math.max(0, min) * 60_000
  const opened = { ...session.opened }
  delete opened[n.id]
  const s = { ...session, snoozed: { ...session.snoozed, [n.id]: until }, opened }
  if (n.preview) return { ledger, session: s }
  return { ledger: withEntry(ledger, n.id, v.now, () => ({ snoozeUntil: until })), session: s }
}

/** A `{ do: 'notice' }` button: its target shows in the pressing notice's place, past its caps, trigger, dismissal and snooze. */
export function openNotice(session: SessionLedger, id: string, place: Place): SessionLedger {
  const dismissed = { ...session.dismissed }
  delete dismissed[id]
  const snoozed = { ...session.snoozed }
  delete snoozed[id]
  return { ...session, opened: { ...session.opened, [id]: place }, dismissed, snoozed }
}

/**
 * The store's ledger kept small: ids in config are touched; an id gone from
 * config for LEDGER_KEEP_MS goes; past LEDGER_MAX the longest untouched go.
 */
export function pruneLedger(ledger: CapLedger, liveIds: readonly string[], now: number): CapLedger {
  const live = new Set(liveIds)
  const rows = Object.entries(ledger)
    .map(([id, e]): [string, CapEntry] => [id, live.has(id) ? { ...e, at: now } : e])
    .filter(([id, e]) => live.has(id) || now - e.at < LEDGER_KEEP_MS)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, LEDGER_MAX)
  return Object.fromEntries(rows)
}

/** The ledger as read back from the store, keeping only what reads as one. */
export function ledgerOf(raw: unknown): CapLedger {
  if (!isObject(raw)) return {}
  const out: Record<string, CapEntry> = {}
  for (const [id, e] of Object.entries(raw).slice(0, LEDGER_MAX * 2)) {
    if (!NOTICE_ID.test(id) || !isObject(e)) continue
    const num = (k: string) => (typeof e[k] === 'number' && Number.isFinite(e[k]) && (e[k] as number) >= 0 ? (e[k] as number) : undefined)
    const day = (k: string) => (typeof e[k] === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(e[k] as string) ? (e[k] as string) : undefined)
    const entry: Record<string, number | string> = { at: num('at') ?? 0 }
    for (const k of ['n', 'dayN', 'clicked', 'dismissed', 'snoozeUntil']) if (num(k) !== undefined) entry[k] = num(k)!
    for (const k of ['day', 'dismissedDay']) if (day(k) !== undefined) entry[k] = day(k)!
    out[id] = entry as CapEntry
  }
  return out
}

// ------------------------------------------------------------------ claims and the lease, across sessions on one store

export type Fired = Readonly<Record<string, { readonly at: number; readonly by: string }>>

/**
 * A claim on showing something once across every open session: the first to
 * write wins, and the claim holds `holdMs`. The caller re-reads the store
 * before calling and writes `fired` back. Toasts key `toast:<id>`, flashes
 * `status:<id>`, feed alerts feedKey(match, id).
 */
export function claimFire(fired: Fired, key: string, by: string, now: number, holdMs = FIRE_HOLD_MS): { fired: Fired; won: boolean } {
  const held = fired[key]
  if (held && now - held.at < holdMs) return { fired, won: false }
  return { fired: { ...fired, [key]: { at: now, by } }, won: true }
}

/** Claims older than `keepMs` go. */
export function pruneFired(fired: Fired, now: number, keepMs = FEED_HOLD_MS): Fired {
  return Object.fromEntries(Object.entries(fired).filter(([, f]) => now - f.at < keepMs))
}

export function firedOf(raw: unknown): Fired {
  if (!isObject(raw)) return {}
  const out: Record<string, { at: number; by: string }> = {}
  for (const [k, f] of Object.entries(raw).slice(0, 500)) {
    if (isObject(f) && typeof f.at === 'number' && Number.isFinite(f.at) && typeof f.by === 'string') out[k] = { at: f.at, by: f.by }
  }
  return out
}

export type Lease = { readonly by: string; readonly until: number }

/** The stats flush's lease: free, lapsed or already this session's, it's taken for `ms`. */
export function takeLease(lease: unknown, by: string, now: number, ms = LEASE_MS): { lease: Lease; won: boolean } {
  const held = isObject(lease) && typeof lease.by === 'string' && typeof lease.until === 'number' ? (lease as Lease) : null
  if (held && held.by !== by && held.until > now) return { lease: held, won: false }
  return { lease: { by, until: now + ms }, won: true }
}

// ------------------------------------------------------------------ stats: ids and counts, never text

export type NoticeCounts = { readonly rev: number; readonly shown: number; readonly clicked: number; readonly dismissed: number }
export type NoticeStats = Readonly<Record<string, NoticeCounts>>
export type StatKind = 'shown' | 'clicked' | 'dismissed'
/** One item of the stats post: exactly these five keys. */
export type StatsEvent = { id: string; rev: number; shown: number; clicked: number; dismissed: number }

/** Counts one showing, press or dismissal; the newest rev wins. Preview notices never count. */
export function bumpStats(stats: NoticeStats, n: Pick<Notice, 'id' | 'rev' | 'preview'>, kind: StatKind): NoticeStats {
  if (n.preview) return stats
  const c = stats[n.id] ?? { rev: n.rev, shown: 0, clicked: 0, dismissed: 0 }
  return { ...stats, [n.id]: { ...c, rev: Math.max(c.rev, n.rev), [kind]: c[kind] + 1 } }
}

/**
 * The next stats post, or null when there's nothing to send: `{ events }` with
 * at most STATS_ITEMS_MAX items, in id order, each count at most
 * STATS_COUNT_MAX, and only id, rev and the three counts in each. `sent` is
 * what to subtract once the server takes it (statsAfterSend).
 */
export function statsBatch(stats: NoticeStats): { body: { events: StatsEvent[] }; sent: NoticeStats } | null {
  const events: StatsEvent[] = []
  for (const id of Object.keys(stats).sort()) {
    if (events.length >= STATS_ITEMS_MAX) break
    const c = stats[id]
    if (!c) continue
    const take = (k: StatKind) => Math.min(STATS_COUNT_MAX, Math.max(0, Math.floor(c[k])))
    const ev = { id, rev: c.rev, shown: take('shown'), clicked: take('clicked'), dismissed: take('dismissed') }
    if (ev.shown + ev.clicked + ev.dismissed > 0) events.push(ev)
  }
  if (events.length === 0) return null
  const sent: Record<string, NoticeCounts> = {}
  for (const { id, ...c } of events) sent[id] = c
  return { body: { events }, sent }
}

/**
 * Whether a stats post may go now, given the store's time of the last one
 * (any session's, written when it posts). Nothing readable, or a clock now
 * behind it, counts as due.
 */
export function statsDue(lastSentAt: unknown, now: number, gapMs = STATS_GAP_MS) {
  if (typeof lastSentAt !== 'number' || !Number.isFinite(lastSentAt) || lastSentAt > now) return true
  return now - lastSentAt >= gapMs
}

/** The stats after a post the server took: what was sent comes off (re-read the store first); emptied ids go. */
export function statsAfterSend(stats: NoticeStats, sent: NoticeStats): NoticeStats {
  const out: Record<string, NoticeCounts> = { ...stats }
  for (const [id, s] of Object.entries(sent)) {
    const c = out[id]
    if (!c) continue
    const left = { rev: c.rev, shown: Math.max(0, c.shown - s.shown), clicked: Math.max(0, c.clicked - s.clicked), dismissed: Math.max(0, c.dismissed - s.dismissed) }
    if (left.shown + left.clicked + left.dismissed === 0) delete out[id]
    else out[id] = left
  }
  return out
}

/** The stats as read back from the store, keeping only what reads as counts. */
export function statsOf(raw: unknown): NoticeStats {
  if (!isObject(raw)) return {}
  const out: Record<string, NoticeCounts> = {}
  const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0)
  for (const [id, c] of Object.entries(raw).slice(0, LEDGER_MAX * 2)) {
    if (!NOTICE_ID.test(id) || !isObject(c) || !intIn(c.rev, [0, REV_MAX])) continue
    out[id] = { rev: c.rev, shown: count(c.shown), clicked: count(c.clicked), dismissed: count(c.dismissed) }
  }
  return out
}

// ------------------------------------------------------------------ the Settings switch

/** The 12 switches from before Notices and Challenges: a stored Quiet set is these equal to QUIET's. */
const LEGACY_KEYS = ['band', 'bandMatch', 'bandChat', 'toasts', 'sounds', 'status', 'mode', 'hint', 'spinner', 'marks', 'extras', 'chat'] as const

/**
 * The Notices setting for stored switches: theirs when set; otherwise
 * `important` when the 12 older switches equal Quiet's (so a Quiet player
 * stays on Quiet, not Custom), else `all`. W4b's surfacesFrom calls it.
 */
export function noticeSettingFrom(stored: unknown): NoticeSetting {
  if (!isObject(stored)) return 'all'
  if (oneOf(stored.notices, NOTICE_SETTINGS)) return stored.notices
  return LEGACY_KEYS.every(k => stored[k] === QUIET[k]) ? 'important' : 'all'
}
