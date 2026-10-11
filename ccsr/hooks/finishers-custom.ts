// Custom finishers in the mod (W10e, dark): config's `finishers.custom`, a summary's art ref,
// GET /me/finishers' own art and equips, a gallery page, the problem codes the server sends back
// with a refused finisher, a typed code, and the timing of the frame custom art plays in. Pure: no
// `$` and no request path, so register.tsx's wiring and the tests read the same rules. The
// validator is finisherart.ts (W10d's module, the server's and the site's too); the drawings around
// the art are finishers.ts's finisherHud and finisherStrip; the words are CUSTOM in copy.ts.
//
// Every string from the server goes through cleanServer here, and a problem's `message` is never
// read: the mod draws its own line for each code. Other players' art, titles and handles stay in
// register.tsx's module memory: never $.state, $.store, the disk, a prompt or a command reply.

import { cleanServer } from './config'
import type { Surface } from './config'
import { ART_CEILINGS, ART_DEFAULTS, artLimits } from './finisherart'
import type { ArtLimits, ArtProblem } from './finisherart'
import { KINDS } from './finishers'
import type { FinisherKind } from './finishers'

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

const whole = (v: unknown, max: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(max, Math.round(v))) : 0)

// ------------------------------------------------------------------ config's `finishers.custom`

/** Every surface config can name, in a fixed order. */
const SURFACES: readonly Surface[] = ['terminal', 'desktop', 'vscode', 'mobile']

/** Config's `finishers.custom` as the mod reads it (W10d's part, docs/api.md "Config"). */
export type CustomCfg = {
  /** You may submit art: the Finishers view's Make your own. */
  create: boolean
  /** Your approved art plays for others (the server's to judge; the mod only says so). */
  show: boolean
  /** You see other players' art. */
  see: boolean
  /** You may browse the gallery and equip other players' art. */
  gallery: boolean
  /** Where the mod draws custom art: never the terminal, whatever config says (its Svg is the remote surfaces'). */
  surfaces: readonly Surface[]
  /** The validator's limits for authoring and the preview, clamped to the module's ceilings. */
  limits: ArtLimits
}

/** No custom finishers: a config without the section, finishers off, or kill on (the server sends every action false). */
export const CUSTOM_OFF: CustomCfg = Object.freeze({ create: false, show: false, see: false, gallery: false, surfaces: Object.freeze([]) as readonly Surface[], limits: Object.freeze({ ...ART_DEFAULTS }) })

/**
 * Config's `finishers.custom`, read only while `finishers.on` is true (off, the result card is
 * today's and nothing custom draws). Only `true` turns an action on; a surface outside the four is
 * dropped, and a missing list draws nowhere; the limits are clamped to the ceilings (artLimits).
 */
export function customOf(raw: Readonly<Record<string, unknown>>): CustomCfg {
  const f = raw.finishers
  if (!isObject(f) || f.on !== true || !isObject(f.custom)) return CUSTOM_OFF
  const c = f.custom
  const listed = Array.isArray(c.surfaces) ? (c.surfaces as unknown[]) : []
  return {
    create: c.create === true,
    show: c.show === true,
    see: c.see === true,
    gallery: c.gallery === true,
    surfaces: SURFACES.filter(s => listed.includes(s)),
    limits: artLimits(isObject(c.limits) ? (c.limits as Partial<ArtLimits>) : null),
  }
}

/** Whether the mod draws custom art on `surface`: listed in config, and never the terminal. */
export function drawsArt(c: Pick<CustomCfg, 'surfaces'>, surface: string) {
  return surface !== 'terminal' && (c.surfaces as readonly string[]).includes(surface)
}

/**
 * Whether a win's custom art draws on this screen: on a surface config lists, for a player config
 * lets see other players' art (or whose own art it is, while their art plays for others: `show`),
 * and on the winner's screen, or the loser's with Opponent finishers on Theirs (or when the art is
 * the loser's own). Anything else draws the default kind, as W10b does. Kill turns every action
 * false, so it reaches a result already on screen within one config read.
 */
export function artShown(o: { custom: CustomCfg; surface: string; view: 'win' | 'lose'; theirs: boolean; own: boolean }) {
  return drawsArt(o.custom, o.surface) && (o.custom.see || (o.own && o.custom.show)) && (o.view === 'win' || o.theirs || o.own)
}

// ------------------------------------------------------------------ an art's ref, and an art

/** An art id as W10d makes them. */
export const ART_ID = /^f_[A-Za-z0-9_-]{12}$/
const SHA256 = /^[0-9a-f]{64}$/
/** A code another player types to equip art: 6 of app.ts's link-code alphabet. */
const ART_CODE = /^[A-HJKMNP-Z2-9]{6}$/
/** A handle is at most 20 characters (rules.ts); a title at most 32 (W10d). */
const HANDLE_MAX = 20
export const TITLE_MAX = 32

/** `Finisher.art` (W10d's FinisherArtRef): the art a win played in its slot, servable to the reader. */
export type ArtRef = { id: string; by: string; sha256: string; durationMs: number }

/** A summary's `finisher.art`, or null when it doesn't read: an id, a sha256, the owner's handle cleaned, the duration held to the ceiling. */
export function artRefOf(raw: unknown): ArtRef | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ART_ID.test(raw.id) || typeof raw.sha256 !== 'string' || !SHA256.test(raw.sha256)) return null
  return { id: raw.id, by: typeof raw.by === 'string' ? cut(oneLine(raw.by), HANDLE_MAX) : '', sha256: raw.sha256, durationMs: whole(raw.duration_ms, ART_CEILINGS.ms) }
}

/** `FinisherArt` (W10d) as the mod draws a row of it: your own (GET /me/finishers' `mine`) or the gallery's. */
export type Art = {
  id: string
  /** '' when the server's code doesn't read (the row then offers none to share). */
  code: string
  /** The kind it plays as; one this mod doesn't know is kept, and drawn by its own word. */
  slot: string
  title: string
  by: string
  /** pending, approved, rejected, pulled, held, or one this mod doesn't know (a neutral line). */
  status: string
  /** Why it isn't approved: the owner's own only, as codes (a code this mod doesn't know draws a neutral word). */
  reasons: string[]
  plays: number
  equips: number
  durationMs: number
  sha256: string
}

/** A word the server sends as a code: a slot, a status, a reason. */
const WORD = /^[a-z][a-z0-9_]{0,31}$/

/** One art from the server, or null when it doesn't read (no id). Strings cleaned and cut; numbers held. */
export function artOf(raw: unknown): Art | null {
  if (!isObject(raw) || typeof raw.id !== 'string' || !ART_ID.test(raw.id)) return null
  const word = (v: unknown, fallback: string) => (typeof v === 'string' && WORD.test(v) ? v : fallback)
  const reasons: string[] = []
  if (Array.isArray(raw.reasons))
    for (const r of raw.reasons) {
      const w = word(r, '')
      if (w && !reasons.includes(w) && reasons.length < 16) reasons.push(w)
    }
  return {
    id: raw.id,
    code: typeof raw.code === 'string' && ART_CODE.test(raw.code) ? raw.code : '',
    slot: word(raw.slot, 'knockout'),
    title: typeof raw.title === 'string' ? cut(oneLine(raw.title), TITLE_MAX) : '',
    by: typeof raw.by === 'string' ? cut(oneLine(raw.by), HANDLE_MAX) : '',
    status: word(raw.status, 'unknown'),
    reasons,
    plays: whole(raw.plays, 1_000_000_000),
    equips: whole(raw.equips, 1_000_000_000),
    durationMs: whole(raw.duration_ms, ART_CEILINGS.ms),
    sha256: typeof raw.sha256 === 'string' && SHA256.test(raw.sha256) ? raw.sha256 : '',
  }
}

/** Your art and what each slot plays (GET /me/finishers, and PATCH's answer, which has the same shape). */
export type CustomMe = { mine: Art[]; equips: Partial<Record<FinisherKind, ArtRef>> }

/** At most this many of your own art (the server keeps 10). */
const MINE_MAX = 20

/** GET /me/finishers' `mine` and `equips`: the art that reads, the first of a repeated id, and each known slot's ref. */
export function customMeOf(raw: unknown): CustomMe {
  const out: CustomMe = { mine: [], equips: {} }
  if (!isObject(raw)) return out
  if (Array.isArray(raw.mine))
    for (const x of raw.mine) {
      const a = artOf(x)
      if (a && a.status !== 'deleted' && !out.mine.some(y => y.id === a.id) && out.mine.length < MINE_MAX) out.mine.push(a)
    }
  if (isObject(raw.equips))
    for (const k of KINDS) {
      const ref = Object.hasOwn(raw.equips, k) ? artRefOf(raw.equips[k]) : null
      if (ref) out.equips[k] = ref
    }
  return out
}

/** A gallery page (GET /finishers): its art, how many there are in all, and where the page starts. */
export type GalleryPage = { items: Art[]; total: number; offset: number }

/** The gallery reads 20 rows a page. */
export const GALLERY_PAGE = 20

export function galleryOf(raw: unknown): GalleryPage | null {
  if (!isObject(raw) || !Array.isArray(raw.items)) return null
  const items: Art[] = []
  for (const x of raw.items) {
    const a = artOf(x)
    if (a && !items.some(y => y.id === a.id) && items.length < 100) items.push(a)
  }
  return { items, total: whole(raw.total, 1_000_000_000), offset: whole(raw.offset, 1_000_000_000) }
}

// ------------------------------------------------------------------ problems

/** A problem as the mod draws it: its code (its own line from copy.ts) and where in the file, never the server's message. */
export type Problem = { code: string; at: number | null }

/** The most problems either list holds (the validator's and the server's cap). */
const PROBLEMS_MAX = 20

/** The local check's problems (checkArt). */
export function localProblems(list: readonly ArtProblem[]): Problem[] {
  return list.slice(0, PROBLEMS_MAX).map(p => ({ code: p.code, at: typeof p.at === 'number' && Number.isFinite(p.at) && p.at >= 0 ? Math.floor(p.at) : null }))
}

/** A 422 `finisher_invalid`'s `problems`, by code and offset only: a code that doesn't read is `unknown`, and `message` is never read. */
export function problemsOf(raw: unknown): Problem[] {
  const list = isObject(raw) && Array.isArray(raw.problems) ? raw.problems : []
  const out: Problem[] = []
  for (const p of list) {
    if (out.length >= PROBLEMS_MAX) break
    if (!isObject(p)) continue
    const at = typeof p.at === 'number' && Number.isFinite(p.at) && p.at >= 0 && p.at <= 100_000_000 ? Math.floor(p.at) : null
    out.push({ code: typeof p.code === 'string' && WORD.test(p.code) ? p.code : 'unknown', at })
  }
  return out
}

/** The one problem that isn't in finisher.svg: the server refuses the title Submit sent (W10d lists it with the art's). */
export const TITLE_PROBLEM = 'bad_title'

/** The problems in the file itself, for the list and for Ask Claude to fix it: a title problem is the title box's, never Claude's. */
export function artProblems(list: readonly Problem[] | null | undefined): Problem[] {
  return (list ?? []).filter(p => p.code !== TITLE_PROBLEM)
}

/** Whether a refusal names the title (drawn by the title box). */
export function titleRefused(list: readonly Problem[] | null | undefined) {
  return (list ?? []).some(p => p.code === TITLE_PROBLEM)
}

/** A 409 `finisher_wrong_slot`'s `slot`: the kind the art plays as, when it is one. */
export function wrongSlotOf(raw: unknown): FinisherKind | null {
  const s = isObject(raw) ? raw.slot : null
  return typeof s === 'string' && (KINDS as readonly string[]).includes(s) ? (s as FinisherKind) : null
}

// ------------------------------------------------------------------ codes, titles, reasons

/** A typed code as the server reads it (any case, spaces and dashes ignored), or null when it can't be one. */
export function artCode(input: string): string | null {
  const c = input.toUpperCase().replace(/[\s-]/g, '')
  return ART_CODE.test(c) ? c : null
}

/** The title Submit sends: what was typed, on one line with each run of spaces as one, cut to 32, else the default (mobile has no title box). */
export function titleFor(typed: string, fallback: string) {
  const t = cut(oneLine(typed).replace(/ {2,}/g, ' '), TITLE_MAX)
  return t || cut(fallback, TITLE_MAX)
}

/** What a player can report art for (W10d's REPORT_REASONS), in the order the mod offers them. */
export const REPORT_REASONS = ['sexual', 'hate', 'real_person', 'copyright', 'imitates_ccsr', 'other'] as const
export type ReportReason = (typeof REPORT_REASONS)[number]

// ------------------------------------------------------------------ the frame's timing

/** When the line and the stats come in under custom art: when the art ends, but never before the bell's beats are over or later than 4 s. */
export const LINE_AT = { min: 1600, max: 4000 } as const
/** The HUD's own motion (the bell at 0.8 s, the bars draining after it) is over by then. */
export const HUD_MS = 2400
/** The strip's line and stats fade in over about this long. */
const STRIP_FADE_MS = 600

/**
 * The frame's timeline for art that runs `durationMs`: when the strip fades in, and when the whole
 * frame is over (after it, every draw is the held last frame, as with the six finishers).
 */
export function customTiming(durationMs: number) {
  const d = whole(durationMs, ART_CEILINGS.ms)
  const lineAtMs = Math.min(LINE_AT.max, Math.max(LINE_AT.min, d))
  return { lineAtMs, totalMs: Math.max(d, lineAtMs + STRIP_FADE_MS, HUD_MS) }
}
