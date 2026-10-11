// How the mod plays a finisher (W10b): config's `finishers` section, a summary's `finisher`,
// the drawing's input for each screen, the practice pick, the Finishers view's preview, the
// share link's path, the sounds, the store's record of which matches have played, and the
// terminal's beats. Pure: no `$` and no request path, so register.tsx's wiring and the tests
// read the same rules. The drawings are finishers.ts (a verbatim copy of mod-lab's); the words
// the mod adds are FINISHER in copy.ts.
//
// Every string from the server goes through cleanServer here and through esc() in the
// drawing. Nothing here reaches a command reply, $.prompt or $.session.append.

import type { ApiMatchSide, ApiMatchSummary, Match } from '../types'
import { safeLink } from './actions'
import { cleanServer } from './config'
import { FINISHER } from './copy'
import type { FinisherFacts } from './copy'
import { ACCENTS, KINDS, blockText, cleanTitle, defaultTitle, kindOf, pickFinisher } from './finishers'
import type { FinisherInput, FinisherKind, FinisherSide, PickInput, PickScore } from './finishers'
import { tierOf } from './pure'

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Server text as one clean line: each run of line breaks and tabs becomes a space, then cleanServer. */
function oneLine(s: string) {
  return cleanServer(s.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')).trim()
}

/** At most `max` characters, cut between code points so no surrogate is split. */
function cut(s: string, max: number) {
  return s.length <= max ? s : Array.from(s).slice(0, max).join('')
}

// ------------------------------------------------------------------ config's `finishers`

/** The tiers a color unlocks at, as config writes them (lowercase). */
const TIER_KEYS: readonly string[] = ['mud', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master']
/** A callout is at most 16 of the pixel font's characters (W10a's `finishers.callouts`), at most 12 of them. */
export const CALLOUT_MAX = 16
export const CALLOUTS_MAX = 12
/** Where a finisher's sound may come from: recorded sounds on ccsr.gg, nowhere else. */
export const SFX_PREFIX = 'https://ccsr.gg/sfx/'

/** Config's `finishers` section as the mod reads it. */
export type FinisherCfg = {
  on: boolean
  /** Post to X and Post the L. */
  share: boolean
  /** The callouts a player picks a knockout's headline from, as config lists them. */
  callouts: readonly string[]
  /** Every color the mod can draw, in config's order, with whether this player has unlocked it and the tier that does. */
  accents: readonly FinisherAccent[]
  /** A recorded sound per kind, only on https://ccsr.gg/sfx/. */
  sounds: Readonly<Partial<Record<FinisherKind, string>>>
}
export type FinisherAccent = { key: string; unlocked: boolean; tier: string | null }

/** No finishers: a config without the section (CONFIG0, a server before W10a), `on` not true, or not an object. */
export const FINISHERS_OFF: FinisherCfg = Object.freeze({ on: false, share: false, callouts: Object.freeze([]), accents: Object.freeze([]), sounds: Object.freeze({}) })

/** A sound the mod may play: canonical https on ccsr.gg under /sfx/ (safeLink's rules), nothing else. */
export function soundOk(u: unknown): u is string {
  return safeLink(u, ['ccsr.gg']) && u.startsWith(SFX_PREFIX) && u.length > SFX_PREFIX.length
}

/** A color config sends, if the mod can draw it: its key, `unlocked` (only true unlocks) and the tier that unlocks it. */
function accentOfCfg(a: unknown): FinisherAccent | null {
  if (!isObject(a) || typeof a.key !== 'string' || !ACCENTS.some(x => x.key === a.key)) return null
  return { key: a.key, unlocked: a.unlocked === true, tier: typeof a.tier === 'string' && TIER_KEYS.includes(a.tier) ? a.tier : null }
}

/** The colors a list holds (config's, or GET /me/finishers'): the ones the mod can draw, the first of a repeated key, in order. */
export function accentsOf(list: unknown): FinisherAccent[] {
  const out: FinisherAccent[] = []
  if (!Array.isArray(list)) return out
  for (const x of list) {
    const a = accentOfCfg(x)
    if (a && !out.some(y => y.key === a.key)) out.push(a)
    if (out.length >= ACCENTS.length) break
  }
  return out
}

/** A callout the mod can draw: one line, 1 to 16 of the pixel font's characters, exactly as cleanTitle keeps it. */
export function calloutOk(c: unknown): c is string {
  if (typeof c !== 'string') return false
  const s = oneLine(c)
  return s === c && s.length > 0 && s.length <= CALLOUT_MAX && cleanTitle(s) === s
}

/**
 * Config's `finishers` (W10a's ConfigPart, docs/api.md "Config"). Missing, not an object, or
 * `on` anything but true: no finishers, so CONFIG0 keeps today's result card. Only true turns
 * `share` on. A callout or a color that doesn't read is left out, never the whole section.
 */
export function finishersOf(raw: Readonly<Record<string, unknown>>): FinisherCfg {
  const f = raw.finishers
  if (!isObject(f) || f.on !== true) return FINISHERS_OFF
  const callouts: string[] = []
  if (Array.isArray(f.callouts))
    for (const c of f.callouts) {
      if (callouts.length >= CALLOUTS_MAX) break
      if (calloutOk(c) && !callouts.includes(c)) callouts.push(c)
    }
  const sounds: Partial<Record<FinisherKind, string>> = {}
  if (isObject(f.sounds))
    for (const k of KINDS) {
      const u = Object.hasOwn(f.sounds, k) ? f.sounds[k] : undefined
      if (soundOk(u)) sounds[k] = u
    }
  return { on: true, share: f.share === true, callouts, accents: accentsOf(f.accents), sounds }
}

/** What GET /me/finishers (and PATCH's answer) says, as the Finishers view reads it. */
export type FinisherMe = { callout: string | null; accent: string; accents: FinisherAccent[] }

/**
 * GET /me/finishers or PATCH /me/finishers' answer (W10a): your callout (one the mod can draw,
 * else null: your handle's headline), your color (one it can draw, else signal) and every color
 * with whether you have unlocked it. Null when the answer isn't an object.
 */
export function finisherMeOf(raw: unknown): FinisherMe | null {
  if (!isObject(raw)) return null
  const accent = typeof raw.accent === 'string' && ACCENTS.some(a => a.key === raw.accent) ? raw.accent : 'signal'
  return { callout: calloutOk(raw.callout) ? raw.callout : null, accent, accents: accentsOf(raw.accents) }
}

/** The sound for a kind (an unknown kind plays as knockout), or null for the mod's own win and loss stings. */
export function soundFor(cfg: FinisherCfg, kind: string): string | null {
  return cfg.sounds[kindOf(kind)] ?? null
}

// ------------------------------------------------------------------ a summary's finisher

/** The line under the headline: finishers.ts draws at most 120 characters. */
const LINE_MAX = 120
/** An accent key as W10a stores it; anything else draws signal. */
const ACCENT_KEY = /^[a-z]{2,16}$/

/** `MatchSummary.finisher` as the mod reads it, every string clean. */
export type Finisher = {
  /** Any kind: one the mod doesn't know plays as knockout, with this title and these lines. */
  kind: string
  /** The headline in the pixel font's characters; '' draws the kind's own (defaultTitle). */
  title: string
  lines: { win: string; loss: string }
  accent: string
  cameo: boolean
  hits: number | null
  clutchMin: number | null
}

/**
 * A summary's `finisher`, or null to draw today's result card: not an object, or no kind.
 * Strings are cleaned (cleanServer, one line, cut to what the drawing holds); a title outside
 * the pixel font loses those characters; an accent that isn't one draws signal; numbers that
 * aren't finite are null.
 */
export function finisherOf(raw: unknown): Finisher | null {
  if (!isObject(raw) || typeof raw.kind !== 'string') return null
  const kind = cut(oneLine(raw.kind), 32)
  if (!kind) return null
  const lines = isObject(raw.lines) ? raw.lines : {}
  const line = (v: unknown) => (typeof v === 'string' ? cut(oneLine(v), LINE_MAX) : '')
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
  const hits = n(raw.hits)
  const clutchMin = n(raw.clutch_min)
  return {
    kind,
    title: typeof raw.title === 'string' ? cleanTitle(oneLine(raw.title)) : '',
    lines: { win: line(lines.win), loss: line(lines.loss) },
    accent: typeof raw.accent === 'string' && ACCENT_KEY.test(raw.accent) ? raw.accent : 'signal',
    cameo: raw.cameo === true,
    hits: hits === null ? null : Math.max(0, Math.min(14, Math.round(hits))),
    clutchMin: clutchMin === null || clutchMin <= 0 ? null : Math.min(1440, clutchMin),
  }
}

/**
 * A side as the drawing names it: a placing player is Mud with no number (the rim prints MUD, the
 * stats PLACING n OF 3). The handle is server text, so it goes through cleanServer: the stats line
 * carries it to the terminal and the alt text, which esc() alone doesn't clean of bidi and format
 * characters (the server holds handles to [a-z0-9_], so this is the second line, not the first).
 */
function sideOf(s: ApiMatchSide): FinisherSide {
  const p = s.player.placement
  const handle = cleanServer(s.player.handle)
  if (p) return { handle, points: s.points, commits: s.commits, tier: 'Mud', rating: null, placing: { played: p.played, of: p.of } }
  return { handle, points: s.points, commits: s.commits, tier: s.tier_after ?? s.tier_before, rating: s.rating_after ?? s.rating_before, placing: null }
}

/**
 * The drawing for one screen of a decided win: the winner's (view `win`) or the loser's
 * (`lose`), `me` being the player whose screen it is. With `theirs` false (Opponent finishers:
 * Default) the loser's screen draws the winner's finisher with the kind's default headline
 * and the signal color; the winner's own screen always draws their picks. A challenge is
 * unrated (the stats print UNRATED, the server's lines carry no Elo). Null when the summary
 * isn't a decided win with both sides.
 */
export function finisherInput(sm: Pick<ApiMatchSummary, 'status' | 'result' | 'winner' | 'sides' | 'kind' | 'length_min'>, me: string, f: Finisher, o: { theirs: boolean }): FinisherInput | null {
  if (sm.status !== 'finished' || sm.result !== 'win' || !sm.winner) return null
  const w = sm.sides.find(x => x.player.handle === sm.winner)
  const l = sm.sides.find(x => x !== w)
  if (!w || !l) return null
  const view: 'win' | 'lose' = w.player.handle === me ? 'win' : 'lose'
  const own = view === 'win' || o.theirs
  const mine = view === 'win' ? w : l
  const rated = sm.kind !== 'challenge'
  const winner = sideOf(w)
  return {
    kind: f.kind,
    title: own ? f.title : defaultTitle(f.kind, winner.handle),
    lines: f.lines,
    accent: own ? f.accent : 'signal',
    cameo: f.cameo,
    hits: f.hits,
    clutch_min: f.clutchMin,
    winner,
    loser: sideOf(l),
    view,
    length_min: sm.length_min,
    rated,
    delta: rated && mine.rating_after !== null ? mine.rating_after - mine.rating_before : null,
  }
}

// ------------------------------------------------------------------ practice (and replays)

/** The practice and replay fields the pick reads. */
export type PracticeLike = Pick<Match, 'kind' | 'hours' | 'deadline' | 'status' | 'myPoints' | 'oppPoints' | 'feed' | 'plan' | 'ratingBefore' | 'ratingAfter' | 'opp'>

/**
 * A practice match's clutch window in whole minutes: a sixth of its length, rounded, held to 3 to
 * 10, exactly W2a's graceMinFor (server/src/lengths.ts). A replay takes its session's own length,
 * any number of minutes (21 gives 4, never 3.5), so the port's clutchMinFor, which doesn't round,
 * would put the window up to 30 s off the server's rule.
 */
export const practiceWindowMin = (m: Pick<Match, 'hours'>) => Math.min(10, Math.max(3, Math.round((m.hours * 60) / 6)))

/**
 * The pick's input for a practice match or a replay, over its own commits: yours (the feed)
 * and the bot's plan up to the bell. Only a match someone won picks (won or lost); a draw, a
 * void, a forfeit or a live match has none. Your scores come first among those at the same
 * moment.
 */
export function practicePickInput(m: PracticeLike): PickInput {
  const won = m.status === 'won'
  const mine = m.feed.filter(x => x.who === 'me')
  const bot = m.plan.filter(x => x.at <= m.deadline)
  const timeline: PickScore[] = [
    ...mine.map((x, i): PickScore => ({ side: won ? 'w' : 'l', points: x.points, at: x.at, id: i })),
    ...bot.map((x, i): PickScore => ({ side: won ? 'l' : 'w', points: x.points, at: x.at, id: mine.length + i })),
  ]
  return {
    w: won ? m.myPoints : m.oppPoints,
    l: won ? m.oppPoints : m.myPoints,
    wCommits: won ? mine.length : bot.length,
    timeline,
    deadline: m.deadline,
    windowMs: practiceWindowMin(m) * 60_000,
    result: won || m.status === 'lost' ? 'win' : null,
  }
}

/** A signed Elo change as a line writes it: +12, -9, +0. */
const signed = (n: number) => `${n < 0 ? '-' : '+'}${Math.abs(Math.round(n))}`

/**
 * A practice match's or a replay's finisher, picked here with the server's rules (pickFinisher)
 * over its own commits, or null when none: the kind's own headline, the signal color, no cameo,
 * and the lines from FINISHER in copy.ts. A practice rating moves, so its stats and the win line
 * carry its change; a replay is unrated.
 */
export function practiceFinisher(m: PracticeLike, handle: string): FinisherInput | null {
  const p = practicePickInput(m)
  const kind = pickFinisher(p)
  if (!kind) return null
  const won = m.status === 'won'
  const rated = m.kind === 'practice'
  const after = m.ratingAfter ?? m.ratingBefore
  const myDelta = rated && m.ratingAfter !== undefined ? m.ratingAfter - m.ratingBefore : null
  const me: FinisherSide = { handle, points: m.myPoints, commits: m.feed.filter(x => x.who === 'me').length, tier: tierOf(after), rating: after, placing: null }
  const bot: FinisherSide = { handle: m.opp.handle, points: m.oppPoints, commits: m.plan.filter(x => x.at <= m.deadline).length, tier: tierOf(m.opp.rating), rating: m.opp.rating, placing: null }
  const winner = won ? me : bot
  const facts: FinisherFacts = { w: p.w, l: p.l, commits: p.wCommits, delta: won && myDelta !== null ? signed(myDelta) : null }
  return {
    kind,
    title: defaultTitle(kind, winner.handle),
    lines: { win: FINISHER.winLine(kind, facts), loss: FINISHER.lossLine(kind, facts) },
    accent: 'signal',
    cameo: false,
    hits: kind === 'combo' ? Math.min(14, p.wCommits) : null,
    clutch_min: kind === 'clutch' ? p.windowMs / 60_000 : null,
    winner,
    loser: won ? bot : me,
    view: won ? 'win' : 'lose',
    length_min: m.hours * 60,
    rated,
    delta: myDelta,
  }
}

// ------------------------------------------------------------------ the Finishers view's preview

/**
 * Your knockout as the Finishers view previews it: your callout (or {HANDLE} WINS.) in your
 * color, you winning 21 to 13 over a sample coin in a 1h match, no Elo shown. `tier` is the
 * tier you show (Mud while placing).
 */
export function previewInput(o: { handle: string; callout: string | null; accent: string; tier: string }): FinisherInput {
  const facts: FinisherFacts = { w: 21, l: 13, commits: 4, delta: null }
  return {
    kind: 'knockout',
    title: o.callout ?? FINISHER.handleCallout(o.handle),
    lines: { win: FINISHER.winLine('knockout', facts), loss: FINISHER.lossLine('knockout', facts) },
    accent: o.accent,
    cameo: false,
    hits: null,
    clutch_min: null,
    winner: { handle: o.handle, points: 21, commits: 4, tier: o.tier, rating: null, placing: null },
    loser: { handle: FINISHER.sample, points: 13, commits: 3, tier: o.tier, rating: null, placing: null },
    view: 'win',
    length_min: 60,
    rated: true,
    delta: null,
  }
}

// ------------------------------------------------------------------ the share link

/** A match id the share link can carry (W6b's limit on match ids). */
const MATCH_ID = /^[A-Za-z0-9_-]{1,64}$/

/** The share link's last two parts: `<id>/w` on the winner's screen (Post to X), `<id>/l` on the loser's (Post the L); null for an id it can't carry. */
export function sharePath(id: string, view: 'win' | 'lose'): string | null {
  return MATCH_ID.test(id) ? `${id}/${view === 'win' ? 'w' : 'l'}` : null
}

// ------------------------------------------------------------------ which finishers have played

/** One match whose finisher drew on this machine, and when it first did. */
export type Seen = { id: string; at: number }
/** The store keeps the newest 20. */
export const SEEN_KEEP = 20

/** The store's record, read back safely: the newest 20 that read. */
export function seenOf(raw: unknown): Seen[] {
  if (!Array.isArray(raw)) return []
  const out: Seen[] = []
  for (const x of raw) if (isObject(x) && typeof x.id === 'string' && x.id.length > 0 && x.id.length <= 64 && typeof x.at === 'number' && Number.isFinite(x.at)) out.push({ id: x.id, at: x.at })
  return out.slice(-SEEN_KEEP)
}

/** The record with `id` first drawn at `at` (the newest last), keeping 20. */
export function seenWith(list: readonly Seen[], id: string, at: number): Seen[] {
  return [...list.filter(x => x.id !== id), { id, at }].slice(-SEEN_KEEP)
}

// ------------------------------------------------------------------ the terminal's beats

/**
 * The terminal's version (the board's term()): the bell line, the headline's four half-block
 * rows at 0.7 s, an inverted flash from 1.02 to 1.16 s, then the line and the stats at 1.6 s.
 * Short draws the last of these at once.
 */
export const TERM_MS = { rows: 700, flash: 1020, flashEnd: 1160, done: 1600 } as const
export type TermPhase = 'bell' | 'rows' | 'flash' | 'done'

/** Where the terminal's beats are `elapsedMs` after they started. */
export function termPhase(elapsedMs: number, short: boolean): TermPhase {
  if (short || elapsedMs >= TERM_MS.done) return 'done'
  if (elapsedMs >= TERM_MS.flash && elapsedMs < TERM_MS.flashEnd) return 'flash'
  return elapsedMs >= TERM_MS.rows ? 'rows' : 'bell'
}

/** The moments the terminal draws again, after the start. */
export const TERM_BEATS: readonly number[] = [TERM_MS.rows, TERM_MS.flash, TERM_MS.flashEnd, TERM_MS.done]

/** The headline as four half-block rows, or null when they are wider than `columns` (it draws as one bold line then). A 26-character title is about 156 columns. */
export function termRows(title: string, columns: number): string[] | null {
  const rows = blockText(title)
  return (rows[0] ?? '').length > columns ? null : rows
}
