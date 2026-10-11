// Ported verbatim from mod-lab/hooks/finishers.ts (the UI session's source of truth).
// Change finishers there and copy this file over; never edit it here.

// Finishers: the six win animations from design/boards/win-finishers.html, ported.
//
// Pure functions, no imports, no `$`: plain values in, one SVG string out, so the mod
// (mod/hooks/finishers.ts) and the site (web/lib/modsvg/finishers.ts) carry verbatim copies.
// Change this file, then re-copy both; scripts/check-svg-copies.sh diffs them in CI.
//
// Each finisher is one 960x504 <svg> with CSS keyframes and no script, drawn by the mod's Svg
// element as a sandboxed image. Every animated element goes through a Motion (PLAY by default)
// and no class attribute is written anywhere else, so a still motion (the site's share card)
// can flatten any finisher to its last frame without editing this file. Every interpolated
// string goes through esc(). Copy: docs/copy.md, "Finishers" and "W10".
//
// Draw only as an isolated image (the mod's Svg or an <img>); never through SvgHtml or any
// inline injection: the stylesheet, its class names, freeze() and the ids are document-global.

// ------------------------------------------------------------------ the shapes

export type FinisherKind = 'knockout' | 'flawless' | 'shipality' | 'combo' | 'clutch' | 'photo'
export const KINDS: readonly FinisherKind[] = ['knockout', 'flawless', 'shipality', 'combo', 'clutch', 'photo']

/** Still placing: the coin's rim prints MUD and the viewer's stats print PLACING {played} OF {of}. */
export type Placing = { played: number; of: number }

/** One side of a decided match, as a finisher draws it. */
export type FinisherSide = {
  handle: string
  points: number
  /** Scored commits in this match. */
  commits: number
  /** The shown tier's name ("Silver"); Mud while placing. */
  tier: string
  /** Drawn on the coin's rim after the tier; null leaves the number off. */
  rating: number | null
  placing?: Placing | null
}

/** Everything a finisher draws, from the match summary's `finisher` and its sides. */
export type FinisherInput = {
  /** The server's pick. An unknown kind draws knockout with this title and these lines. */
  kind: string
  /** The headline, in the pixel font: A-Z 0-9 space . : ' - + # _, at most 26 (cleanTitle). */
  title: string
  lines: { win: string; loss: string }
  /** An ACCENTS key; an unknown one draws signal. */
  accent: string
  cameo: boolean
  /** Combo: min(14, the winner's scored commits). Null falls back to the winner's commits. */
  hits: number | null
  /** Clutch: the window in minutes (the match's grace). Null falls back to clutchMinFor(length_min). */
  clutch_min: number | null
  winner: FinisherSide
  loser: FinisherSide
  /** Whose screen this plays on: the winner's or the loser's. */
  view: 'win' | 'lose'
  length_min: number
  /** False for a challenge: the stats print UNRATED. */
  rated: boolean
  /** The viewer's Elo change, signed. Null leaves it out. */
  delta: number | null
}

export type FinisherOptions = {
  /** The Settings switch's Short: the action is over when the drawing starts, the headline lands at once. */
  short?: boolean
  motion?: Motion
}

export type FinisherDrawing = {
  svg: string
  kind: FinisherKind
  title: string
  /** The line under the headline: lines.win on the winner's screen, lines.loss on the loser's. */
  line: string
  /** When the drawing is over; after it, draw freeze(svg, totalMs + 3000). */
  totalMs: number
  /** When the headline starts landing (the terminal's flash keys off it). */
  headMs: number
}

// ------------------------------------------------------------------ motion

/** CSS custom properties an animation reads. Strings carry their own units ('150px', '32deg'). */
export type Vars = Record<string, string | number>
/** Attributes written in order. Numbers are rounded to 2 decimals. */
export type Attrs = Record<string, string | number>
export type Cue = {
  vars?: Vars
  /** Seconds; overrides the class's duration. */
  dur?: number
  /** Overrides the class's timing function. */
  ease?: string
  /** The element's own center, for motions that can't measure it (stamp turns about it). PLAY ignores it. */
  origin?: [number, number]
}
/** A finisher's own keyframes (camera shake, flashes, jabs, the combo bar), run once over `dur` seconds. */
export type OwnAnim = { name: string; dur: number; frames: string }
/**
 * How a finisher moves. Every class attribute in a drawing comes from here.
 * The class names are the BASE_CSS rules below plus each drawing's own: cam, fl, jab, jolt, cbar.
 * `dl` and `dr` ride along with drain and cbar to name the bar's fixed edge (left or right).
 */
export type Motion = {
  /** A group that plays `cls` from `t` seconds around `inner`. */
  anim(cls: string, t: number, inner: string, cue?: Cue): string
  /** One element that plays `cls` itself from `t` seconds. */
  el(tag: string, cls: string, t: number, attrs: Attrs, inner?: string, cue?: Cue): string
  /** The drawing's stylesheet: the rules its classes use plus its own keyframes. */
  css(body: string, own: OwnAnim[]): string
}

// ------------------------------------------------------------------ palette and helpers (mirrors olympia.ts)

const C = { bone: '#E6DED1', bone2: '#D9CFBF', bone3: '#CBBFAC', paper: '#EFE9DF', ink: '#141312', ink2: '#1C1A18', ink3: '#26231F', or: '#FF6A2A', orHi: '#FF8A57', stone: '#9A9286', stone2: '#6A635A' }
const MONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace"
const PI = Math.PI
const f = (n: number) => String(Math.round(n * 100) / 100)
/** XML text: the five specials escaped, and what XML can't carry dropped (C0 controls, U+FFFE, U+FFFF, lone surrogates). */
function esc(s: string | number) {
  return String(s)
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\uD800-\uDFFF\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, c => (c.length === 2 ? c : ''))
    .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}
/** A number that can't break a drawing: NaN and Infinity become 0. */
const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) ? n : 0)
/** At most `max` characters, cut between code points so no surrogate is split. */
const cap = (s: unknown, max: number) => {
  const t = String(s ?? '')
  return t.length <= max ? t : Array.from(t.slice(0, max * 2)).slice(0, max).join('')
}
/** Handles are 2 to 20 characters on the server; tiers are shorter. Longer input is cut, not drawn. */
const NAME_MAX = 20
/** The line under the headline; the longest in docs/copy.md is about 60. */
const LINE_MAX = 120
/** The clutch chart's steps per side: it only needs the shape, so a side with more scored commits is drawn as this many. */
const STAIR_MAX = 120
function hh(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return h - Math.floor(h)
}
type Id = (p: string) => string
function idMaker(pre: string): Id {
  let n = 0
  return p => `${pre}${p}${++n}`
}
/** Ids, plus pieces every coin in a drawing shares (defined once, colored where they're used). */
type Kit = { id: Id; once(key: string, make: (id: string) => string): string }
type TOpt = { a?: string; s?: number | string; w?: number; c?: string; ls?: number; op?: number; st?: string; sw?: number }
function T(x: number, y: number, t: string, o: TOpt = {}) {
  return `<text x="${f(x)}" y="${f(y)}"${o.a ? ` text-anchor="${o.a}"` : ''} font-size="${o.s ?? 10}"${o.w ? ` font-weight="${o.w}"` : ''} fill="${o.c ?? C.ink}"${o.ls != null ? ` letter-spacing="${o.ls}"` : ''}${o.op != null ? ` fill-opacity="${o.op}"` : ''}${o.st ? ` stroke="${o.st}" stroke-width="${o.sw ?? 3}" paint-order="stroke"` : ''}>${esc(t)}</text>`
}
const at = (x: number, y: number, inner: string) => `<g transform="translate(${f(x)} ${f(y)})">${inner}</g>`
/** A <use> of a defined piece (named ref, not use, so React's lint never reads it as a hook in the site's copy). */
const ref = (id: string) => `<use href="#${id}"/>`

// ------------------------------------------------------------------ the medallion, ported from olympia.ts

const LEAF = 'M0 0C5 -4.6 13 -4.8 19 0C13 4.8 5 4.6 0 0Z'
const leafOf = (k: Kit) => k.once('lf', i => `<path id="${i}" d="${LEAF}"/>`)
function wreath(k: Kit, cx: number, cy: number, r: number, line: string, acc: string, n = 11) {
  const lf = leafOf(k)
  let s = ''
  for (const sd of [1, -1]) {
    let d = ''
    const a1 = PI * 0.58
    const a2 = PI * 1.42
    for (let i = 0; i <= 30; i++) {
      const a = a1 + ((a2 - a1) * i) / 30
      d += `${i ? 'L' : 'M'}${f(cx + sd * r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`
    }
    s += `<path d="${d}" fill="none" stroke="${line}" stroke-width="2"/>`
    for (let k = 0; k < n; k++) {
      const a = a1 + ((a2 - a1) * (k + 0.5)) / (n + 0.4)
      const x = cx + sd * r * Math.cos(a)
      const y = cy + r * Math.sin(a)
      const th = (Math.atan2(Math.cos(a), -sd * Math.sin(a)) * 180) / PI
      ;[-38, 38].forEach((o, j) => {
        s += `<use href="#${lf}" transform="translate(${f(x)} ${f(y)}) rotate(${f(th + o + 180)}) scale(${f(((1.05 - k * 0.035) * r) / 86)})" fill="${j ? acc : 'none'}" stroke="${acc}" stroke-width="1.3"/>`
      })
    }
  }
  return s
}
const HEAD = 'M140 72C166 66 190 78 198 96C204 104 207 114 209 124C211 132 212 137 211 140C216 148 222 156 228 164C229 167 226 170 221 170C219 172 218 174 219 176C221 178 220 181 216 182L214 183C218 185 219 188 216 190C213 192 212 194 213 197C216 202 215 208 210 213C204 218 196 219 189 219C186 228 188 238 193 250C168 258 140 256 120 248C122 236 120 226 114 216C100 206 90 186 88 162C86 134 96 106 114 88C122 80 130 75 140 72Z'
const HAIR = 'M198 96C192 108 188 124 186 138C182 148 172 152 160 156C152 162 150 176 150 190C146 200 130 208 114 216C100 206 90 186 88 162C86 134 96 106 114 88C122 80 130 75 140 72C166 66 190 78 198 96Z'
function keyPath(r1: number, r2: number, a0: number, da: number) {
  const P = [[0, 0], [0, 1], [1, 1], [1, 0.22], [0.3, 0.22], [0.3, 0.72], [0.7, 0.72], [0.7, 0.47], [0.5, 0.47]] as const
  return P.map((p, i) => {
    const a = a0 + (0.16 + 0.68 * p[0]) * da
    const r = r1 + (0.12 + 0.76 * p[1]) * (r2 - r1)
    return `${i ? 'L' : 'M'}${f(160 + r * Math.cos(a))} ${f(160 + r * Math.sin(a))}`
  }).join('')
}
function bust(k: Kit, S: string, F: string, flip: boolean, lite: boolean) {
  const { id } = k
  const X = (x: number) => (flip ? 320 - x : x)
  const Tf = flip ? ' transform="translate(320 0) scale(-1 1)"' : ''
  const hairId = id('hair')
  const faceId = id('face')
  const cellsId = id('cells')
  const leftId = id('left')
  let inn = ''
  for (let r = 0; r < (lite ? 0 : 16); r++) {
    const y = 70 + r * 11.6
    for (let c = 0; c < 14; c++) {
      const x = 26 + c * 14.6 + (r % 2) * 7.3
      const front = 186 - Math.abs(y - 150) * 0.25
      const p = 1.12 - ((front - x) / 110) * 0.95
      const hv = hh(r + 1, c + 1)
      if (hv > p) continue
      const g = hv < 0.1 ? '1' : hv < 0.18 ? '0' : '01'
      inn += `<text x="${f(X(x))}" y="${f(y)}" opacity="${Math.round(Math.max(0.25, Math.min(1, p)) * 10) / 10}">${g}</text>`
    }
  }
  // the olympia.ts bust draws the left-half cells twice; here one copy is reused through two clips
  let s = `<defs><clipPath id="${hairId}"><path d="${HAIR}"${Tf}/></clipPath><clipPath id="${faceId}"><circle cx="160" cy="160" r="103"/></clipPath><clipPath id="${leftId}"><rect x="${flip ? 160 : 0}" y="0" width="160" height="320"/></clipPath><g id="${cellsId}" font-size="9.5" text-anchor="middle">${inn}</g></defs><g clip-path="url(#${faceId})"><g transform="translate(160 166) scale(1.13) translate(-160 -166)">`
  if (inn) s += `<g clip-path="url(#${leftId})" fill="${S}"><use href="#${cellsId}"/></g>`
  const head = k.once('head', i => `<path id="${i}" d="${HEAD}"/>`)
  const hair = k.once('hair', i => `<path id="${i}" d="${HAIR}"/>`)
  s += `<g${Tf}><use href="#${head}" fill="${S}"/><use href="#${hair}" fill="${F}"/></g>`
  if (inn) s += `<g clip-path="url(#${hairId})" fill="${S}"><use href="#${cellsId}"/></g>`
  let g2 = `<g${Tf}><path d="M198 96C190 78 166 66 140 72C130 75 122 80 114 88C96 106 86 134 88 162C90 186 100 206 114 216" fill="none" stroke="${S}" stroke-width="1.2" stroke-dasharray="3 3"/>`
  // the curls of hair, drawn once and stroked in each bust's color
  const curls = k.once('curls', i => {
    let c = `<g id="${i}" fill="none" stroke="currentColor" stroke-width="1.15" stroke-dasharray="2.2 1.8">`
    for (const q of [[184, 106, 8], [172, 122, 9], [156, 108, 9], [140, 122, 10], [122, 134, 9], [156, 140, 9], [134, 154, 10], [114, 160, 9], [140, 180, 9], [164, 88, 8], [138, 90, 9], [108, 118, 8]] as const) {
      let d = ''
      for (let j = 0; j <= 28; j++) {
        const th = (j / 28) * PI * 3.4
        const rr = q[2] * (1 - j / (28 * 1.15))
        d += `${j ? 'L' : 'M'}${f(q[0] + rr * Math.cos(th))} ${f(q[1] + rr * Math.sin(th))}`
      }
      c += `<path d="${d}"/>`
    }
    return c + '</g>'
  })
  g2 += `<use href="#${curls}" color="${S}"/>`
  const pts = [[196, 99], [186, 94], [175, 91], [163, 91], [151, 93], [139, 97], [128, 103], [118, 111], [110, 121], [104, 132], [100, 144], [99, 156], [100, 168], [103, 179]] as const
  g2 += `<path d="M${pts.map(q => `${q[0]} ${q[1]}`).join('L')}" fill="none" stroke="${S}" stroke-width="2"/>`
  // the laurel on the head, filled in the bust's color and edged in the coin's
  const lf = leafOf(k)
  const laurel = k.once('laurel', i => {
    let c = `<g id="${i}" fill="currentColor" stroke-width="1">`
    pts.forEach((q, j) => {
      const nx = pts[j + 1]
      if (!nx) return
      const a = (Math.atan2(q[1] - nx[1], q[0] - nx[0]) * 180) / PI
      for (const o of [-34, 34]) c += `<use href="#${lf}" transform="translate(${f(q[0])} ${f(q[1])}) rotate(${f(a + o)}) scale(${f(1.05 - j * 0.03)})"/>`
    })
    return c + '</g>'
  })
  g2 += `<use href="#${laurel}" color="${S}" stroke="${F}"/>`
  const rib = 'M103 179C96 192 106 202 95 220M103 179C110 194 116 204 108 228'
  g2 += `<path d="${rib}" fill="none" stroke="${F}" stroke-width="4.4" stroke-linecap="round"/><path d="${rib}" fill="none" stroke="${S}" stroke-width="2.4" stroke-linecap="round"/>`
  g2 += `<g fill="none" stroke="${F}" stroke-width="1.4" stroke-linecap="round"><path d="M193 136Q201 131 209 135"/><path d="M196 144Q202 140 207 143"/><path d="M198 149Q203 150 206 146"/><path d="M214 183L207 184"/><path d="M172 160C162 157 157 169 161 180C164 187 171 186 171 180"/><path d="M193 250C168 258 140 256 120 248" stroke-width="1.2"/></g><circle cx="202.5" cy="145.2" r="1.6" fill="${F}"/></g>`
  return s + g2 + '</g></g>'
}
type CoinOpt = { fill: string; line: string; bust?: string; flip?: boolean; ring?: boolean; lite?: boolean; top?: string; bottom?: string; fs?: number }
function coin(k: Kit, o: CoinOpt) {
  const L = o.line
  const top = k.once('top', i => `<path id="${i}" d="M32 160A128 128 0 0 1 288 160"/>`)
  const bot = k.once('bot', i => `<path id="${i}" d="M18.5 160A141.5 141.5 0 0 0 301.5 160"/>`)
  let s = `<circle cx="160" cy="160" r="158" fill="${o.fill}"${o.ring ? ` stroke="${L}" stroke-width="1.6"` : ''}/>`
  s += `<circle cx="160" cy="160" r="151" fill="none" stroke="${L}" stroke-width="1.4"/>`
  if (o.top || o.bottom) s += `<g font-size="${o.fs ?? 14}" font-weight="600" letter-spacing="3.2" fill="${L}">${o.top ? `<text><textPath href="#${top}" startOffset="50%" text-anchor="middle">${esc(o.top)}</textPath></text>` : ''}${o.bottom ? `<text><textPath href="#${bot}" startOffset="50%" text-anchor="middle">${esc(o.bottom)}</textPath></text>` : ''}</g>`
  for (const a of [0, PI]) {
    const x = 160 + 136 * Math.cos(a)
    const y = 160 + 136 * Math.sin(a)
    s += `<rect x="${f(x - 4)}" y="${f(y - 4)}" width="8" height="8" transform="rotate(45 ${f(x)} ${f(y)})" fill="${L}"/>`
  }
  s += `<circle cx="160" cy="160" r="122" fill="none" stroke="${L}" stroke-width="1.4"/><circle cx="160" cy="160" r="104" fill="none" stroke="${L}" stroke-width="1.4"/>`
  // the Greek key around the rim
  const key = k.once('key', i => {
    let d = ''
    for (let j = 0; j < 26; j++) d += keyPath(106, 120, (j * PI * 2) / 26 - PI / 2, (PI * 2) / 26)
    return `<path id="${i}" d="${d}" fill="none" stroke-width="1.6" stroke-linejoin="miter" stroke-linecap="square"/>`
  })
  s += `<use href="#${key}" stroke="${L}"/>`
  if (o.bust) s += bust(k, o.bust, o.fill, !!o.flip, !!o.lite)
  return s
}
const coinAt = (k: Kit, o: CoinOpt, cx: number, cy: number, r: number) => `<g transform="translate(${f(cx - r)} ${f(cy - r)}) scale(${f(r / 160)})">${coin(k, o)}</g>`

// ------------------------------------------------------------------ arcade pixel font (5x7), drawn as paths so no font has to load inside Svg

const G: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'], B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'], D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'], F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'], H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'], J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'], L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'], N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'], R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'], T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'], V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'], X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'], 1: ['.#.', '##.', '.#.', '.#.', '.#.', '.#.', '###'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'], 3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'], 5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'], 7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'], 9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  '.': ['..', '..', '..', '..', '..', '##', '##'], ':': ['..', '##', '##', '..', '##', '##', '..'], "'": ['#', '#', '.', '.', '.', '.', '.'],
  '-': ['....', '....', '....', '####', '....', '....', '....'], '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '#': ['.#.#.', '#####', '.#.#.', '.#.#.', '.#.#.', '#####', '.#.#.'], ' ': ['..', '..', '..', '..', '..', '..', '..'],
  _: ['....', '....', '....', '....', '....', '....', '####'],
}
export const TITLE_MAX = 26
/** A headline the pixel font can draw: uppercased, only its glyphs, spaces collapsed, at most 26. */
export function cleanTitle(s: string) {
  return String(s || '').toUpperCase().split('').filter(c => G[c]).join('').replace(/\s+/g, ' ').trim().slice(0, TITLE_MAX).trim()
}
type Letter = { ch: string; x: number; rows: readonly string[] }
function layoutText(str: string) {
  let x = 0
  const letters: Letter[] = []
  for (const ch of str) {
    const rows = G[ch]
    if (!rows) continue
    letters.push({ ch, x, rows })
    x += (rows[0] ?? '').length + 1
  }
  return { letters, width: Math.max(1, x - 1) }
}
function glyphPath(rows: readonly string[], x0: number, y0: number, p: number) {
  let d = ''
  rows.forEach((row, r) => {
    let c = 0
    while (c < row.length) {
      if (row[c] === '#') {
        let n = 1
        while (row[c + n] === '#') n++
        d += `M${f(x0 + c * p)} ${f(y0 + r * p)}h${f(n * p)}v${f(p)}h${f(-n * p)}z`
        c += n
      } else c++
    }
  })
  return d
}
function pixText(str: string, cx: number, cy: number, p: number, attrs: string) {
  const L = layoutText(str)
  const x0 = cx - (L.width * p) / 2
  const y0 = cy - 3.5 * p
  let d = ''
  for (const l of L.letters) d += glyphPath(l.rows, x0 + l.x * p, y0, p)
  return `<path d="${d}" ${attrs}/>`
}
/** The headline as half-block letters for the terminal: four rows, two pixel rows per character. */
export function blockText(str: string) {
  const L = layoutText(cleanTitle(str))
  const grid = Array.from({ length: 8 }, () => Array<number>(L.width).fill(0))
  for (const l of L.letters) {
    l.rows.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) if (row[c] === '#') (grid[r] as number[])[l.x + c] = 1
    })
  }
  const out: string[] = []
  for (let r = 0; r < 8; r += 2) {
    const a = grid[r] as number[]
    const b = grid[r + 1] as number[]
    out.push(a.map((v, c) => (v && b[c] ? '█' : v ? '▀' : b[c] ? '▄' : ' ')).join(''))
  }
  return out
}

// ------------------------------------------------------------------ PLAY: every finisher is CSS keyframes inside the SVG, no script

const BASE_CSS = `
.slam{transform-box:fill-box;transform-origin:50% 50%;animation:slam .36s cubic-bezier(.2,1.4,.35,1) both}
@keyframes slam{0%{opacity:0;transform:scale(3.4)}45%{opacity:1}62%{transform:scale(.9)}100%{opacity:1;transform:scale(1)}}
.pop{transform-box:fill-box;transform-origin:50% 50%;animation:pop .42s cubic-bezier(.2,1.6,.4,1) both}
@keyframes pop{0%{opacity:0;transform:scale(.2)}100%{opacity:1;transform:scale(1)}}
.stamp{transform-box:fill-box;transform-origin:50% 50%;animation:stamp .32s cubic-bezier(.5,0,.6,1.5) both}
@keyframes stamp{0%{opacity:0;transform:scale(2.6) rotate(-20deg)}100%{opacity:1;transform:scale(1) rotate(-7deg)}}
.fade{animation:fade .45s ease-out both}
@keyframes fade{0%{opacity:0;transform:translateY(8px)}100%{opacity:1;transform:translateY(0)}}
.fadein{animation:fadein .4s ease-out both}
@keyframes fadein{from{opacity:0}to{opacity:1}}
.out{animation:out .3s ease-in both}
@keyframes out{from{opacity:1}to{opacity:0}}
.show{animation:show .01s steps(1,end) both}
@keyframes show{from{opacity:0}to{opacity:1}}
.hide{animation:hide .01s steps(1,end) both}
@keyframes hide{from{opacity:1}to{opacity:0}}
.flick{animation:flick .6s linear both}
@keyframes flick{0%{opacity:0}8%{opacity:1}16%{opacity:.1}28%{opacity:1}40%{opacity:.25}52%,100%{opacity:1}}
.blink{animation:blink .26s steps(1,end) 6 both}
@keyframes blink{0%{opacity:1}50%{opacity:.15}}
.dl{transform-box:fill-box;transform-origin:0 50%}
.dr{transform-box:fill-box;transform-origin:100% 50%}
.drain{animation:drain .45s cubic-bezier(.3,.8,.3,1) both}
@keyframes drain{from{transform:scaleX(var(--a,1))}to{transform:scaleX(var(--b,0))}}
.mv{animation:mv .5s cubic-bezier(.3,.8,.3,1) both}
@keyframes mv{from{transform:translate(0px,0px) scale(1)}to{transform:translate(var(--x,0px),var(--y,0px)) scale(var(--s,1))}}
.lunge{animation:lunge .42s cubic-bezier(.5,0,.5,1) both}
@keyframes lunge{0%,100%{transform:translate(0px,0px)}35%{transform:translate(var(--x,0px),0px)}}
.knock{animation:knock .75s cubic-bezier(.15,.8,.3,1) both}
@keyframes knock{0%{transform:translate(0px,0px) rotate(0deg);opacity:1}100%{transform:translate(var(--x,0px),var(--y,0px)) rotate(var(--r,0deg));opacity:.28}}
.bob{animation:bob 1.7s ease-in-out infinite alternate}
@keyframes bob{from{transform:translateY(-3px)}to{transform:translateY(3px)}}
.spark{transform-box:fill-box;transform-origin:50% 50%;animation:spark .34s ease-out both}
@keyframes spark{0%{opacity:0;transform:scale(.1) rotate(0deg)}30%{opacity:1;transform:scale(1.2) rotate(18deg)}100%{opacity:0;transform:scale(1.6) rotate(36deg)}}
.part{transform-box:fill-box;transform-origin:50% 50%;animation:part var(--d,1.2s) cubic-bezier(.2,.7,.4,1) both}
.shard{animation:part 1.4s cubic-bezier(.2,.7,.4,1) both}
@keyframes part{0%{opacity:0;transform:translate(0px,0px) rotate(0deg)}5%{opacity:1}42%{opacity:1;transform:translate(var(--x),var(--y)) rotate(var(--r));animation-timing-function:cubic-bezier(.5,0,1,1)}100%{opacity:0;transform:translate(var(--x2),var(--y2)) rotate(var(--r2))}}
.draw{animation:draw 1.2s cubic-bezier(.4,0,.2,1) both}
@keyframes draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
.shine{animation:shine .75s ease-in-out both}
@keyframes shine{from{transform:translateX(0px)}to{transform:translateX(var(--w))}}
.ember{animation:ember 5s linear infinite}
@keyframes ember{0%{opacity:0;transform:translate(0px,0px)}20%{opacity:var(--o)}100%{opacity:0;transform:translate(var(--x),-260px)}}
.fall{animation:fall .38s cubic-bezier(.6,0,1,.6) both}
@keyframes fall{from{transform:translateY(-640px)}to{transform:translateY(0px)}}
.squash{transform-box:fill-box;transform-origin:50% 100%;animation:squash .35s cubic-bezier(.2,1.6,.4,1) forwards}
@keyframes squash{0%{transform:scale(1.14,.8)}100%{transform:scale(1,1)}}
.dust{transform-box:fill-box;transform-origin:50% 50%;animation:dust .9s ease-out both}
@keyframes dust{0%{opacity:0;transform:scale(.3)}20%{opacity:.55}100%{opacity:0;transform:scale(1.8,1.3)}}
.drip{animation:drip 1.1s cubic-bezier(.5,0,1,1) 3 both}
@keyframes drip{0%{opacity:0;transform:translateY(0px)}12%{opacity:1}100%{opacity:0;transform:translateY(72px)}}
.rise{animation:rise .9s ease-out both}
@keyframes rise{0%{opacity:0;transform:translate(0px,10px)}15%{opacity:1;transform:translate(0px,0px)}100%{opacity:0;transform:translate(var(--x),-70px)}}
.pulse{animation:pulse 1.1s ease-out both}
@keyframes pulse{0%{opacity:0}15%{opacity:1}35%{opacity:.3}55%{opacity:.85}100%{opacity:0}}
.beat{animation:beat .46s ease-out 2 both}
@keyframes beat{0%{opacity:0}18%{opacity:1}34%{opacity:.25}50%{opacity:.8}100%{opacity:0}}
.run{animation:run 2.1s both}
@keyframes run{from{transform:translateX(0px)}to{transform:translateX(var(--d))}}
.roll{animation:roll 2.1s both}
@keyframes roll{from{transform:rotate(0deg)}to{transform:rotate(var(--rot))}}
.shut{animation:shut .3s ease-in-out both}
@keyframes shut{0%,100%{transform:translateY(var(--o))}40%,60%{transform:translateY(0px)}}
.peek{animation:peek 1.9s cubic-bezier(.3,.8,.3,1) both}
@keyframes peek{0%{transform:translate(170px,170px)}16%,82%{transform:translate(0px,0px)}100%{transform:translate(170px,170px)}}
`
/** Keep only the class rules a drawing uses, and the keyframes those rules name. */
function prune(css: string, body: string) {
  const used = new Set<string>()
  for (const m of body.matchAll(/class="([^"]+)"/g)) (m[1] ?? '').split(/\s+/).forEach(c => used.add(c))
  const rules = css.split('\n').filter(Boolean)
  const kept = rules.filter(r => {
    const m = r.match(/^\.([\w-]+)\{/)
    return !m || used.has(m[1] ?? '')
  })
  const anims = new Set([...kept.join('\n').matchAll(/animation:([\w-]+)/g)].map(m => m[1] ?? ''))
  return kept.filter(r => {
    const m = r.match(/^@keyframes ([\w-]+)/)
    return !m || anims.has(m[1] ?? '')
  }).join('\n')
}
const attrs = (a: Attrs) => Object.keys(a).map(k => ` ${k}="${typeof a[k] === 'number' ? f(a[k] as number) : a[k]}"`).join('')
function cueStyle(t: number, cue: Cue | undefined) {
  let s = t ? `animation-delay:${f(t)}s;` : ''
  if (cue?.dur != null) s += `animation-duration:${f(cue.dur)}s;`
  if (cue?.ease) s += `animation-timing-function:${cue.ease};`
  for (const [k, v] of Object.entries(cue?.vars ?? {})) s += `--${k}:${typeof v === 'number' ? f(v) : v};`
  return s ? ` style="${s.slice(0, -1)}"` : ''
}
/** The animated motion: each class plays its keyframes from its delay. */
export const PLAY: Motion = {
  anim: (cls, t, inner, cue) => `<g class="${cls}"${cueStyle(t, cue)}>${inner}</g>`,
  el(tag, cls, t, a, inner = '', cue) {
    // draw reveals a stroke through a dash as long as the path
    const pre = cls.split(' ').includes('draw') ? ' pathLength="1" stroke-dasharray="1 1"' : ''
    const open = `<${tag} class="${cls}"${pre}${attrs(a)}${cueStyle(t, cue)}`
    return inner ? `${open}>${inner}</${tag}>` : `${open}/>`
  },
  css: (body, own) => prune(BASE_CSS + own.map(o => `\n.${o.name}{animation:${o.name} ${f(o.dur)}s linear both}\n@keyframes ${o.name}{${o.frames}}`).join('') + '\n', body),
}
/** The same motion with every delay at -40 s, so it has all played out when the drawing starts (Short, as the board's .A rule). */
function settled(m: Motion): Motion {
  return { anim: (cls, _t, inner, cue) => m.anim(cls, -40, inner, cue), el: (tag, cls, _t, a, inner, cue) => m.el(tag, cls, -40, a, inner, cue), css: m.css }
}

/** Keyframes that sit at rest and spike at each event: camera shake, flashes, jabs. */
function spikeKF(total: number, evs: Ev[], seq: (k: number) => string[], rest: string) {
  const P = (t: number) => f(Math.max(0, Math.min(100, (t / total) * 100)))
  const dt = 0.04
  let k = `0%{${rest}}`
  let last = -1
  for (const e of [...evs].sort((a, b) => a.t - b.t)) {
    if (e.t <= last + 0.002) continue
    const frames = seq(e.k)
    k += `${P(e.t - 0.001)}%{${rest}}`
    frames.forEach((css, j) => {
      k += `${P(e.t + j * dt)}%{${css}}`
    })
    last = e.t + frames.length * dt
    k += `${P(last)}%{${rest}}`
  }
  return `${k}100%{${rest}}`
}
/** Keyframes that hold each value until the next step: a health bar losing a chunk per hit. */
function holdKF(total: number, steps: [number, string][], init: string) {
  const P = (t: number) => f(Math.max(0, Math.min(100, (t / total) * 100)))
  let k = `0%{${init}}`
  let prev = init
  for (const [t, css] of steps) {
    k += `${P(t - 0.001)}%{${prev}}${P(t)}%{${css}}`
    prev = css
  }
  return `${k}100%{${prev}}`
}
const shakeSeq = (k: number) => {
  const A = 9 * k
  if (k < 0.6) return [`transform:translate(${f(A)}px,${f(-A * 0.6)}px)`, `transform:translate(${f(-A * 0.7)}px,${f(A * 0.5)}px)`, `transform:translate(${f(A * 0.3)}px,0px)`]
  return [[1, -0.6], [-0.9, 0.7], [0.7, 0.5], [-0.5, -0.4], [0.3, 0.3], [-0.15, 0]].map(([x, y], i) => `transform:translate(${f(A * (x as number))}px,${f(A * (y as number))}px) rotate(${f(i % 2 ? -0.35 * k : 0.35 * k)}deg)`)
}
const flashSeq = (k: number) => {
  const o = Math.min(0.9, 0.45 + (k - 0.9) * 0.6)
  return [`opacity:${f(o)}`, `opacity:${f(o * 0.5)}`, `opacity:${f(o * 0.2)}`]
}

// ------------------------------------------------------------------ data

export type Accent = { key: string; base: string; hi: string; mid: string; lo: string }
/** The finisher colors. Past signal and mud they unlock by tier (config's finishers.accents). */
export const ACCENTS: readonly Accent[] = [
  { key: 'signal', base: '#FF6A2A', hi: '#FFE2CC', mid: '#FF8A57', lo: '#B8441A' },
  { key: 'mud', base: '#8A6A4F', hi: '#EBD5BC', mid: '#A8825F', lo: '#4F3828' },
  { key: 'bronze', base: '#B47A49', hi: '#F8DCC0', mid: '#CF9461', lo: '#6E4423' },
  { key: 'gold', base: '#D6AB3E', hi: '#FFF2C4', mid: '#E8C15A', lo: '#7E5E12' },
  { key: 'diamond', base: '#7499C6', hi: '#F1F7FF', mid: '#AFC9E6', lo: '#33557F' },
  { key: 'blood', base: '#C42B22', hi: '#FFD0C8', mid: '#E2453A', lo: '#5E100C' },
]
const SIGNAL = ACCENTS[0] as Accent
export const accentOf = (key: string) => ACCENTS.find(a => a.key === key) ?? SIGNAL
/** The headline each kind draws with no callout (docs/copy.md, Finishers). Knockout is "{HANDLE} WINS.". */
export const HEADLINES: Readonly<Record<Exclude<FinisherKind, 'knockout'>, string>> = { flawless: 'FLAWLESS SHIP.', shipality: 'SHIPALITY.', combo: 'ULTRA COMBO.', clutch: 'CLUTCH.', photo: 'PHOTO FINISH.' }
export const kindOf = (k: string): FinisherKind => ((KINDS as readonly string[]).includes(k) ? (k as FinisherKind) : 'knockout')
/** The title a kind draws with no callout: Opponent finishers set to Default draws this. */
export function defaultTitle(kind: string, winnerHandle: string) {
  const k = kindOf(kind)
  return k === 'knockout' ? cleanTitle(`${winnerHandle} WINS.`) : HEADLINES[k]
}
/** The clutch window for a length with no grace of its own: a sixth of it, held to 3 to 10 minutes. */
export const clutchMinFor = (lengthMin: number) => Math.min(10, Math.max(3, num(lengthMin) / 6))
/** A length as the graphics print it: 15M, 90M, 1H, 3H. */
export const lengthLabel = (min: number) => (min > 0 && min % 60 === 0 ? `${min / 60}H` : `${Math.round(min * 10) / 10}M`)

const SCALE = [1, 2, 3, 5, 8, 13, 21] as const
/** Every way to pick one, two or three values off the scale, smallest first (7, 28 and 84 of them). */
const TUPLES: number[][][] = [1, 2, 3].map(k => {
  const out: number[][] = []
  const pick = (from: number, acc: number[]) => {
    if (acc.length === k) out.push(acc)
    else for (let i = from; i < SCALE.length; i++) pick(i, [...acc, SCALE[i] as number])
  }
  pick(0, [])
  return out
})
/**
 * A total split into n scores on the story-point scale, always summing to the total.
 * With fewer points than scores the rest are 0-point commits, spread out, and the last score is never one of them.
 */
function split(total: number, n: number) {
  const v = Array<number>(n).fill(0)
  const ones = Math.min(n, Math.max(0, Math.floor(total)))
  for (let i = 0; i < ones; i++) v[n - 1 - Math.floor((i * n) / ones)] = 1
  let sum = ones
  let g = 0
  while (sum < total && g < 4000) {
    const k = Math.floor(hh(g, total) * n)
    const cur = v[k] ?? 1
    const ix = SCALE.indexOf(cur as (typeof SCALE)[number])
    const next = SCALE[ix + 1]
    if (next != null && sum - cur + next <= total) {
      sum += next - cur
      v[k] = next
    }
    g++
  }
  // the walk can stall short of the total. Raise the biggest step that fits until the rest is small, trade one,
  // two or three scores for as many on the scale that make it up, and failing that raise again
  const raise = (floor: number) => {
    while (total - sum > floor) {
      let best = -1
      let gain = 0
      for (let i = 0; i < n; i++) {
        const cur = v[i] as number
        for (const x of SCALE) {
          if (cur > 0 && x - cur > gain && x - cur <= total - sum) {
            best = i
            gain = x - cur
          }
        }
      }
      if (best < 0) return
      v[best] = (v[best] as number) + gain
      sum += gain
    }
  }
  raise(60)
  for (let k = 1; k <= 3 && sum < total; k++) {
    const d = total - sum
    for (const from of TUPLES[k - 1] as number[][]) {
      // the scores to trade, found by value: there are only seven
      const idx: number[] = []
      for (const x of from) {
        const i = v.findIndex((y, j) => y === x && !idx.includes(j))
        if (i < 0) break
        idx.push(i)
      }
      if (idx.length < k) continue
      const want = from.reduce((p, c) => p + c, 0) + d
      const to = (TUPLES[k - 1] as number[][]).find(t => t.reduce((p, c) => p + c, 0) === want)
      if (to) {
        idx.forEach((i, j) => (v[i] = to[j] as number))
        sum = total
        break
      }
    }
  }
  raise(0)
  // a total no n scores on the scale make: the last one takes the rest
  if (n > 0 && sum < total) v[n - 1] = (v[n - 1] as number) + total - sum
  return v
}

// ------------------------------------------------------------------ the drawing's context

type Ev = { t: number; k: number }
type P = { handle: string; pts: number; commits: number; rim: string; me: boolean; x: number; hp: number; placing: Placing | null }
type Ctx = Kit & {
  /** The pieces every coin shares, written before the rest of the defs. */
  shared: string
  /** The motion for the headline, the lines and the cameo. */
  m: Motion
  /** The motion for the action and the HUD: shifted out of the way on Short. */
  ma: Motion
  W: P
  L: P
  win: boolean
  dir: number
  A: Accent
  title: string
  kind: FinisherKind
  a: FinisherInput
  defs: string
  own: OwnAnim[]
  events: Ev[]
  short: boolean
  shift: number
  hT: number
  vg: string
  sl: string
  head(t: number): number
  ev(t: number, k: number): void
  hev(t: number, k: number): void
}
/** The coin's rim: the tier and the rating, or MUD with no number while placing. */
function rimOf(s: FinisherSide) {
  if (s.placing) return 'MUD'
  const tier = cap(s.tier || 'Mud', NAME_MAX).toUpperCase()
  return s.rating == null ? tier : `${tier} ${Math.round(num(s.rating))}`
}
function setup(a: FinisherInput, motion: Motion, short: boolean): Ctx {
  const kind = kindOf(a.kind)
  const win = a.view !== 'lose'
  const side = (s: FinisherSide, me: boolean, x: number): P => ({ handle: cap(s.handle || '', NAME_MAX), pts: Math.max(0, Math.round(num(s.points))), commits: Math.max(0, Math.round(num(s.commits))), rim: rimOf(s), me, x, hp: 0, placing: s.placing ?? null })
  const W = side(a.winner, win, win ? 250 : 710)
  const L = side(a.loser, !win, win ? 710 : 250)
  W.hp = Math.max(0.06, Math.min(1, 1 - L.pts / Math.max(1, W.pts)))
  const onceIds: Record<string, string> = {}
  const ctx: Ctx = {
    id: idMaker(''),
    shared: '',
    once(key, make) {
      let i = onceIds[key]
      if (!i) {
        i = onceIds[key] = ctx.id(key)
        ctx.shared += make(i)
      }
      return i
    },
    m: motion,
    ma: short ? settled(motion) : motion,
    W,
    L,
    win,
    dir: Math.sign(L.x - W.x),
    A: accentOf(a.accent),
    title: cleanTitle(a.title) || defaultTitle(kind, W.handle),
    kind,
    a,
    defs: '',
    own: [],
    events: [],
    short,
    shift: 0,
    hT: 0,
    vg: '',
    sl: '',
    head: t => {
      if (ctx.short) ctx.shift = t - 0.25
      ctx.hT = t - ctx.shift
      return ctx.hT
    },
    ev: (t, k) => {
      if (!ctx.short) ctx.events.push({ t, k })
    },
    hev: (t, k) => {
      ctx.events.push({ t, k })
    },
  }
  return ctx
}

// ------------------------------------------------------------------ pieces of the arena

const CY = 318
const R = 92
const FLOOR = 410
type ChromeOpt = { anim?: string; hi?: string; mid?: string; lo?: string; base?: string; noShine?: boolean }
/** The headline: chrome pixel letters that slam in one by one, with an extruded edge and a shine. */
function chrome(ctx: Ctx, m: Motion, str: string, cx: number, cy: number, maxW: number, p0: number, tf: (i: number) => number, o: ChromeOpt = {}) {
  const { id, A } = ctx
  const lay = layoutText(str)
  const p = Math.min(p0, maxW / lay.width)
  const x0 = cx - (lay.width * p) / 2
  const y0 = cy - 3.5 * p
  const lo = o.lo || A.lo
  const g = id('cg')
  ctx.defs += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${o.hi || A.hi}"/><stop offset=".46" stop-color="${o.mid || A.mid}"/><stop offset=".5" stop-color="${lo}"/><stop offset="1" stop-color="${o.base || A.base}"/></linearGradient>`
  const depth = Math.max(3, p * 0.55)
  const off = (k: number) => f((depth * k) / 4)
  // each glyph is drawn on its unit grid and scaled into place, so its path data is small integers;
  // the stroke is set in that grid too, so it lands at the board's width
  const sw = f(Math.max(1.2, p * 0.16) / p)
  let body = ''
  let clip = ''
  let i = 0
  let last = 0
  for (const l of lay.letters) {
    if (l.ch === ' ') continue
    const pid = id('gl')
    ctx.defs += `<path id="${pid}" transform="translate(${f(x0 + l.x * p)} ${f(y0)}) scale(${f(p)})" d="${glyphPath(l.rows, 0, 0, 1)}"/>`
    clip += `<use href="#${pid}"/>`
    const u = (k: number) => `<use href="#${pid}" x="${off(k)}" y="${off(k)}"/>`
    const ext = `<g fill="#070606">${u(4)}</g><g fill="${lo}">${u(3)}${u(2)}${u(1)}</g>`
    const t = tf(i)
    body += m.anim(o.anim || 'slam', t, `${ext}<use href="#${pid}" fill="url(#${g})" stroke="${C.ink}" stroke-width="${sw}" paint-order="stroke"/>`)
    last = Math.max(last, t)
    i++
  }
  const land = last + 0.22
  if (!o.noShine) {
    const c = id('cc')
    const sh = id('sh')
    const H = 7 * p
    ctx.defs += `<clipPath id="${c}">${clip}</clipPath><linearGradient id="${sh}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
    body += `<g clip-path="url(#${c})">${m.el('path', 'shine', land + 0.12, { d: `M${f(x0 - 150)} ${f(y0 - 4)}h80l${f(-H * 0.5)} ${f(H + 8)}h-80z`, fill: `url(#${sh})` }, '', { vars: { w: `${f(lay.width * p + 320)}px` } })}</g>`
  }
  return { body, land, p, x0, y0, w: lay.width * p, h: 7 * p }
}
function coinDef(ctx: Ctx, Pl: P, r: number, cid: string, rim = true) {
  const o: CoinOpt = Pl.me ? { fill: C.or, line: C.ink, bust: C.ink } : { fill: C.ink2, line: C.bone, bust: C.bone, flip: true, ring: true }
  if (rim) {
    o.top = Pl.handle.toUpperCase()
    o.bottom = Pl.rim
    o.fs = 15
  }
  return `<g id="${cid}">${coinAt(ctx, o, 0, 0, r)}</g>`
}
function coinPair(ctx: Ctx, r = R) {
  const cW = ctx.id('cw')
  const cL = ctx.id('cl')
  ctx.defs += coinDef(ctx, ctx.W, r, cW) + coinDef(ctx, ctx.L, r, cL)
  return [cW, cL] as const
}
const shadow = (x: number, y: number, r: number) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(r * 0.8)}" ry="${f(r * 0.09)}" fill="#000" fill-opacity=".6"/>`
function star(Ro: number, ri: number, fill: string, n = 10) {
  let d = ''
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? ri : Ro * (0.7 + hh(i, Ro) * 0.55)
    const a = (i * PI) / n - PI / 2
    d += `${i ? 'L' : 'M'}${f(rr * Math.cos(a))} ${f(rr * Math.sin(a))}`
  }
  return `<path d="${d}Z" fill="${fill}" stroke="${C.ink}" stroke-width="2"/><circle r="${f(ri * 0.75)}" fill="#fff"/>`
}
type BurstOpt = { ang?: number; span?: number; sp?: number; fall?: number; size?: number; c1?: string; c2?: string; dur?: number }
/** Binary blood: 0s and 1s thrown out of an impact, then dropped by gravity. */
function burst(ctx: Ctx, x: number, y: number, t: number, n: number, o: BurstOpt = {}) {
  let s = `<g font-weight="800" text-anchor="middle" style="--d:${f(o.dur ?? 1.2)}s">`
  const seed = Math.round(t * 100) + n
  const q = Math.round
  for (let i = 0; i < n; i++) {
    const r1 = hh(i + 1, seed)
    const r2 = hh(i + 7, seed + 3)
    const r3 = hh(i + 13, seed + 9)
    const ang = (o.ang ?? -PI / 2) + (r1 - 0.5) * (o.span ?? PI)
    const sp = (o.sp ?? 140) * (0.4 + r2 * 0.9)
    const dx = Math.cos(ang) * sp
    const dy = Math.sin(ang) * sp
    const fall = (o.fall ?? 120) * (0.6 + r3 * 0.7)
    const size = (o.size ?? 15) * (0.7 + r2 * 0.8)
    const col = r3 < 0.62 ? o.c1 || ctx.A.base : o.c2 || ctx.A.hi
    const rot = (r1 - 0.5) * 240
    s += ctx.ma.el('text', 'part', t + r3 * 0.04, { x: q(x), y: q(y), 'font-size': q(size), fill: col }, r2 < 0.5 ? '0' : '1', { vars: { x: `${q(dx)}px`, y: `${q(dy)}px`, x2: `${q(dx * 1.3)}px`, y2: `${q(dy + fall)}px`, r: `${q(rot)}deg`, r2: `${q(rot * 2)}deg` } })
  }
  return s + '</g>'
}

/** The stadion floor in perspective. */
function floor() {
  let d = ''
  for (let k = -9; k <= 9; k++) {
    const xb = 480 + k * 120
    const x1 = 480 + ((xb - 480) * (404 - 250)) / (504 - 250)
    d += `M${f(x1)} 404L${f(xb)} 504`
  }
  for (const y of [412, 424, 442, 468, 500]) d += `M-40 ${y}H1000`
  return `<rect x="-40" y="404" width="1040" height="140" fill="#0F0E0D"/><path d="${d}" stroke="${C.stone2}" stroke-opacity=".45" stroke-dasharray="3 5" fill="none"/>`
}
function screenDefs(ctx: Ctx) {
  ctx.vg = ctx.id('vg')
  ctx.sl = ctx.id('sl')
  ctx.defs += `<radialGradient id="${ctx.vg}" cx=".5" cy=".5" r=".72"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>`
  ctx.defs += `<pattern id="${ctx.sl}" width="6" height="3" patternUnits="userSpaceOnUse"><rect width="6" height="1" fill="#000" fill-opacity=".32"/></pattern>`
}
function stage(ctx: Ctx) {
  const { id, A } = ctx
  const gl = id('glow')
  ctx.defs += `<radialGradient id="${gl}" cx=".5" cy=".86" r=".6"><stop offset="0" stop-color="${A.base}" stop-opacity=".2"/><stop offset="1" stop-color="${A.base}" stop-opacity="0"/></radialGradient>`
  screenDefs(ctx)
  let s = `<rect x="-40" y="-40" width="1040" height="584" fill="${C.ink}"/>`
  // the temple behind the arena: dashed linework, shafts full of 01
  s += `<g fill="none" stroke="${C.bone}" stroke-opacity=".15" stroke-width="1.2" stroke-dasharray="4 4"><path d="M96 116L480 50L864 116Z"/><path d="M110 116H850V134H110Z"/><path d="M80 396H880M64 404H896"/>`
  const xs = Array.from({ length: 8 }, (_, i) => 150 + (i * 660) / 7)
  for (const x of xs) s += `<path d="M${f(x - 19)} 140H${f(x + 19)}M${f(x - 14)} 146V392M${f(x + 14)} 146V392M${f(x - 5)} 150V388M${f(x + 5)} 150V388"/>`
  s += `</g><g font-size="11" fill="${C.bone}" fill-opacity=".09" text-anchor="middle">`
  xs.forEach((x, i) => {
    const ys: string[] = []
    const ch: string[] = []
    for (let r = 0; r < 18; r++) {
      ys.push(f(160 + r * 13.4))
      ch.push(hh(i, r) < 0.5 ? '0' : '1')
    }
    s += `<text x="${Array(18).fill(f(x)).join(' ')}" y="${ys.join(' ')}">${ch.join('')}</text>`
  })
  s += '</g>' + floor()
  s += `<rect x="-40" y="-40" width="1040" height="584" fill="url(#${gl})"/>`
  // binary embers rising off the floor
  for (let i = 0; i < 14; i++) {
    s += ctx.m.el('text', 'ember', -hh(i, 4) * 5, { x: f(40 + hh(i, 1) * 880), y: f(420 + hh(i, 2) * 70), 'font-size': f(9 + hh(i, 3) * 6), fill: A.base }, hh(i, 7) < 0.5 ? '0' : '1', { vars: { x: `${f((hh(i, 5) - 0.5) * 60)}px`, o: f(0.25 + hh(i, 6) * 0.4) } })
  }
  return s
}

type Out = { tB: number; action: string; head: string; land: number; barPre: { W: number; L: number }; cbar?: boolean; blinkW?: boolean }
/** The fighting-game HUD: two health bars, the handles and points, and the countdown to the bell. */
function hud(ctx: Ctx, tB: number, out: Pick<Out, 'barPre' | 'cbar' | 'blinkW'>) {
  const { W, L, A, id } = ctx
  const m = ctx.ma
  const left = W.me ? W : L
  const right = W.me ? L : W
  const bar = (Pl: P, x: number, toLeft: boolean) => {
    const isW = Pl === W
    const pre = isW ? out.barPre.W : out.barPre.L
    const fin = isW ? W.hp : 0
    const y = 24
    const w = 360
    const h = 16
    const edge = toLeft ? 'dl' : 'dr'
    const box = { x, y, width: w, height: h }
    let b = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="#0B0A09" stroke="${C.bone}" stroke-opacity=".6"/>`
    // the damage chunk trails the bar in a contrasting color, the way fighting games show a hit
    const lag = Pl.me ? '#FFF1E2' : A.base
    if (!isW && out.cbar) b += m.el('rect', `${edge} cbar`, 0.22, { ...box, fill: lag, 'fill-opacity': '.9' })
    else b += m.el('rect', `${edge} drain`, tB + 0.28, { ...box, fill: lag, 'fill-opacity': '.9' }, '', { dur: 0.9, vars: { a: pre, b: fin } })
    let main = !isW && out.cbar ? m.el('rect', `${edge} cbar`, 0, { ...box, fill: Pl.me ? C.or : C.bone }) : m.el('rect', `${edge} drain`, tB, { ...box, fill: Pl.me ? C.or : C.bone }, '', { vars: { a: pre, b: fin } })
    if (isW && out.blinkW) main = m.anim('blink', 0.9, main)
    b += main
    let tk = ''
    for (let k = 1; k < 10; k++) tk += `M${x + k * 36} ${y}v${h}`
    b += `<path d="${tk}" stroke="#0B0A09" stroke-opacity=".55"/><rect x="${x}" y="${y + 2}" width="${w}" height="3" fill="#fff" fill-opacity=".2"/>`
    if (isW && W.hp >= 1) {
      const c = id('bc')
      const g = id('bg')
      ctx.defs += `<clipPath id="${c}"><rect x="${x}" y="${y}" width="${w}" height="${h}"/></clipPath><linearGradient id="${g}" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`
      b += `<g clip-path="url(#${c})">${m.el('path', 'shine', tB + 0.15, { d: `M${x - 90} ${y}h60l-10 ${h}h-60z`, fill: `url(#${g})` }, '', { vars: { w: `${w + 140}px` } })}</g>`
    }
    b += T(toLeft ? x : x + w, 60, Pl.handle.toUpperCase(), { a: toLeft ? 'start' : 'end', s: 15, w: 800, c: C.bone, ls: 2.5 })
    b += T(toLeft ? x + w : x, 60, `${Pl.pts} PTS`, { a: toLeft ? 'end' : 'start', s: 13, w: 700, c: Pl.me ? C.orHi : C.bone2, ls: 1.5 })
    return b
  }
  let s = bar(left, 36, true) + bar(right, 564, false)
  s += `<rect x="430" y="12" width="100" height="46" fill="#0B0A09" stroke="${C.bone}" stroke-opacity=".7" stroke-dasharray="3 3"/>`
  ;['0:03', '0:02', '0:01', '0:00'].forEach((lab, i) => {
    const a = tB - (3 - i) * 0.25
    const b = tB - (2 - i) * 0.25
    const g = pixText(lab, 480, 35, 3.4, `fill="${i === 3 ? A.base : C.bone}"`)
    if (i === 0) s += m.anim('hide', Math.max(0, b), g)
    else if (i < 3) s += m.anim('hide', b, m.anim('show', a, g))
    else s += m.anim('show', a, m.anim('flick', tB, g))
  })
  s += m.anim('show', tB, T(480, 77, 'BELL', { a: 'middle', s: 12, w: 800, c: A.base, ls: 5 }))
  return m.anim('fade', 0, s)
}

/** The stats under the line: the score, the length and the viewer's Elo (UNRATED, or PLACING n OF 3 while placing). */
function statsOf(ctx: Ctx) {
  const { W, L, win, a } = ctx
  const me = win ? W : L
  let tail = ''
  if (!a.rated) tail = 'UNRATED'
  else if (me.placing) tail = `PLACING ${Math.round(num(me.placing.played))} OF ${Math.round(num(me.placing.of))}`
  else if (a.delta != null && Number.isFinite(a.delta)) tail = `${a.delta < 0 ? '-' : '+'}${Math.abs(Math.round(a.delta))} ELO`
  return `${W.handle.toUpperCase()} ${W.pts} · ${L.pts} ${L.handle.toUpperCase()} · ${lengthLabel(num(a.length_min))}${tail ? ` · ${tail}` : ''}`
}
const lineOf = (a: FinisherInput) => cap((a.view === 'lose' ? a.lines?.loss : a.lines?.win) ?? '', LINE_MAX)
function subLines(ctx: Ctx, t: number) {
  const { win, A, m } = ctx
  return m.anim('fade', t, T(480, 463, lineOf(ctx.a), { a: 'middle', s: 20, w: 700, c: C.paper, st: C.ink, sw: 5 })) + m.anim('fade', t + 0.14, T(480, 489, statsOf(ctx), { a: 'middle', s: 12, w: 700, c: win ? A.mid : C.stone, ls: 2.5, st: C.ink, sw: 4 }))
}
function cameo(ctx: Ctx, t: number) {
  const { m } = ctx
  const cid = ctx.id('cm')
  const coinDefs = coinAt(ctx, { fill: C.bone, line: C.ink, bust: C.ink, flip: true, lite: true }, 0, 0, 70)
  ctx.defs += `<g id="${cid}">${coinDefs}</g>`
  const bubble = `<g transform="translate(800 418)"><path d="M-54 -24H54V18H30L44 34L14 18H-54Z" fill="${C.paper}" stroke="${C.ink}" stroke-width="2.5"/>${T(0, 4, 'LGTM.', { a: 'middle', s: 19, w: 800, c: C.ink, ls: 2 })}</g>`
  return at(902, 452, m.anim('peek', t, ref(cid))) + m.anim('hide', t + 1.45, m.anim('show', t + 0.35, bubble))
}

// ------------------------------------------------------------------ the six finishers

const FIN: Record<FinisherKind, (ctx: Ctx) => Out> = {
  /** Knockout: the default move. The winner lunges, the loser is knocked off the floor, the winner takes the center and the laurel. */
  knockout: ctx => {
    const { W, L, dir, A, ma: m } = ctx
    const tB = 0.8
    const tHit = 1.16
    const [cW, cL] = coinPair(ctx)
    let a = ''
    a += at(L.x, CY, m.anim('out', tHit, shadow(0, R, R)) + m.anim('pop', 0.1, m.anim('knock', tHit, m.anim('bob', -1.2, ref(cL)), { vars: { x: `${dir * 150}px`, y: '64px', r: `${dir * 32}deg` } })))
    a += at(W.x, CY, m.anim('pop', 0.2, m.anim('mv', 1.55, m.anim('lunge', tHit - 0.15, shadow(0, R, R) + m.anim('bob', -0.5, ref(cW)), { vars: { x: `${dir * 175}px` } }), { vars: { x: `${480 - W.x}px`, y: '0px', s: 1.05 } })))
    a += at(480, CY, m.anim('pop', 2.05, wreath(ctx, 0, 0, R + 24, A.base, A.base, 11)))
    a += at(L.x - dir * 70, CY - 16, m.anim('spark', tHit - 0.02, star(66, 22, A.hi)))
    a += burst(ctx, L.x - dir * 50, CY - 10, tHit, 20, { ang: dir > 0 ? -PI * 0.3 : -PI * 0.7, span: PI * 0.9, sp: 170, fall: 150 })
    ctx.ev(tHit, 0.95)
    const h = ctx.head(2.15)
    const hd = chrome(ctx, ctx.m, ctx.title, 480, 150, 870, 11, i => h + i * 0.06)
    ctx.hev(h + 0.17, 0.3)
    ctx.hev(hd.land, 1)
    return { tB, action: a, head: hd.body, land: hd.land, barPre: { W: W.hp, L: 0.3 } }
  },

  /** Flawless ship: the loser topples, the lights go out, the winner stands in a spotlight with a full health bar. */
  flawless: ctx => {
    const { W, L, dir, A, id, ma: m } = ctx
    const tB = 0.8
    const [cW, cL] = coinPair(ctx)
    let a = ''
    a += at(L.x, CY, m.anim('out', 1.0, shadow(0, R, R)) + m.anim('pop', 0.1, m.anim('knock', 1.0, m.anim('bob', -1.2, ref(cL)), { vars: { x: `${dir * 40}px`, y: '58px', r: `${dir * 90}deg` } })))
    a += m.anim('fadein', 1.2, `<rect x="-40" y="-40" width="1040" height="584" fill="${C.ink}" fill-opacity=".86"/>`)
    const sp = id('sp')
    ctx.defs += `<linearGradient id="${sp}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.paper}" stop-opacity=".42"/><stop offset="1" stop-color="${C.paper}" stop-opacity="0"/></linearGradient>`
    a += m.anim('fadein', 1.35, `<path d="M452 -40H508L664 ${FLOOR}H296Z" fill="url(#${sp})"/><ellipse cx="480" cy="${FLOOR}" rx="176" ry="16" fill="${C.paper}" fill-opacity=".16"/>`, { dur: 0.2 })
    a += at(W.x, CY, m.anim('pop', 0.2, m.anim('mv', 1.3, shadow(0, R, R) + m.anim('bob', -0.5, ref(cW)), { vars: { x: `${480 - W.x}px`, y: '0px', s: 1 } })))
    ctx.ev(1.0, 0.45)
    const h = ctx.head(1.8)
    const isF = ctx.title === 'FLAWLESS SHIP.'
    const hd = chrome(ctx, ctx.m, ctx.title, 480, 150, 880, 11, i => (isF ? (i < 8 ? h + i * 0.085 : h + 0.95 + (i - 8) * 0.03) : h + i * 0.06))
    ctx.hev(h + 0.17, 0.35)
    if (isF) {
      ctx.hev(h + 7 * 0.085 + 0.2, 0.4)
      ctx.hev(hd.land, 1.25)
    } else ctx.hev(hd.land, 1)
    let head = hd.body
    head += at(480, CY, ctx.m.anim('pop', hd.land + 0.1, wreath(ctx, 0, 0, R + 14, A.base, A.base, 11)))
    const st = hd.land + 0.35
    const stamp = pixText(`${L.pts}`, 0, -6, 11, `fill="${C.stone}" stroke="${C.ink}" stroke-width="3" paint-order="stroke"`) + T(0, 46, 'PTS', { a: 'middle', s: 14, w: 800, c: C.stone, ls: 4 }) + `<path d="M-46 -40L-14 -12L-24 4L12 22L4 34L40 52" fill="none" stroke="${C.ink}" stroke-width="4"/>`
    head += at(L.x + dir * 30, CY - 8, ctx.m.anim('stamp', st, stamp, { origin: [-3, 4] }))
    ctx.hev(st + 0.2, 0.5)
    return { tB, action: a, head, land: st + 0.2, barPre: { W: 1, L: 0.18 } }
  },

  /** Shipality: FINISH THEM, then a column drum drops out of the sky and the loser's coin shatters into binary. */
  shipality: ctx => {
    const { W, L, dir, A, id, ma: m } = ctx
    const tB = 0.8
    const tFin = 1.0
    const tDrop = 2.05
    const tLand = tDrop + 0.38
    const [cW, cL] = coinPair(ctx)
    let a = ''
    a += at(W.x, CY, m.anim('pop', 0.2, shadow(0, R, R) + m.anim('bob', -0.5, ref(cW))))
    a += at(L.x, CY, m.anim('hide', tLand, shadow(0, R, R) + m.anim('pop', 0.1, m.anim('bob', -1.2, ref(cL)))))
    a += m.anim('pulse', tFin, `<rect x="-40" y="-40" width="1040" height="584" fill="${A.lo}" fill-opacity=".42"/>`)
    const ft = chrome(ctx, m, 'FINISH THEM.', 480, 150, 700, 7, () => tFin, { anim: 'flick', hi: '#FFFFFF', mid: C.bone, lo: C.stone2, base: C.bone3, noShine: true })
    a += m.anim('out', tDrop - 0.2, ft.body)
    // the drum
    const dw = 200
    const dh = 176
    const x0 = -dw / 2
    const top = FLOOR - dh
    const ry = dw * 0.13
    const shade = id('sd')
    ctx.defs += `<linearGradient id="${shade}" x1="0" x2="1"><stop offset="0" stop-color="#000" stop-opacity=".35"/><stop offset=".35" stop-color="#000" stop-opacity="0"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".45"/></linearGradient>`
    const body = `M${x0} ${top}V${FLOOR}A${dw / 2} ${f(ry)} 0 0 0 ${-x0} ${FLOOR}V${top}Z`
    let drum = `<path d="${body}" fill="${C.bone2}" stroke="${C.ink}" stroke-width="2.4"/><path d="${body}" fill="url(#${shade})"/>`
    let bin = ''
    for (let k = 1; k < 10; k++) {
      const fx = x0 + (dw * k) / 10
      const e = Math.sqrt(Math.max(0, 1 - (fx / (dw / 2)) ** 2)) * ry
      drum += `<path d="M${f(fx)} ${f(top + e)}V${f(FLOOR + e)}" stroke="${C.ink}" stroke-width="1" stroke-dasharray="4 3" opacity=".55"/>`
      if (k < 9) {
        const cx = fx + dw / 20
        const ys: string[] = []
        const ch: string[] = []
        for (let r = 0; r < 9; r++) {
          ys.push(f(top + e + 26 + r * 16))
          ch.push(hh(k, r) < 0.5 ? '0' : '1')
        }
        bin += `<text x="${Array(9).fill(f(cx)).join(' ')}" y="${ys.join(' ')}">${ch.join('')}</text>`
      }
    }
    drum += `<g font-size="10" fill="${C.stone2}" text-anchor="middle">${bin}</g><ellipse cx="0" cy="${top}" rx="${dw / 2}" ry="${f(ry)}" fill="${C.bone}" stroke="${C.ink}" stroke-width="2.4"/><ellipse cx="0" cy="${top}" rx="${dw * 0.16}" ry="${f(ry * 0.32)}" fill="none" stroke="${C.ink}" stroke-dasharray="3 3"/>`
    a += at(L.x, 0, m.anim('fall', tDrop, m.anim('squash', tLand, drum)))
    // the coin breaks into wedges that still carry its art
    const cuts = Array.from({ length: 7 }, (_, i) => 0.6 + hh(i, 21))
    const sum = cuts.reduce((p, c) => p + c, 0)
    let ang = -PI / 2 + 0.3
    const J = (q: number) => [52 * Math.cos(q + 0.12), 52 * Math.sin(q + 0.12)] as const
    cuts.forEach((w, i) => {
      const a1 = ang
      const a2 = ang + (w / sum) * PI * 2
      const am = (a1 + a2) / 2
      ang = a2
      const rim = [0, 0.25, 0.5, 0.75, 1].map(u => {
        const q = a1 + (a2 - a1) * u
        return [104 * Math.cos(q), 104 * Math.sin(q)] as const
      })
      const pts = [[0, 0] as const, J(a1), ...rim, J(a2)]
      const wid = id('w')
      ctx.defs += `<clipPath id="${wid}"><path d="M${pts.map(p => `${f(p[0])} ${f(p[1])}`).join('L')}Z"/></clipPath>`
      const c = [50 * Math.cos(am), 50 * Math.sin(am)] as const
      const spd = 170 + hh(i, 8) * 150
      const dx = Math.cos(am) * spd + dir * 30
      const dy = Math.sin(am) * spd - 90
      const rot = (hh(i, 13) - 0.5) * 300
      a += at(L.x + c[0], CY + c[1], m.anim('shard', tLand, `<g transform="translate(${f(-c[0])} ${f(-c[1])})"><use href="#${cL}" clip-path="url(#${wid})"/></g>`, { vars: { x: `${f(dx)}px`, y: `${f(dy)}px`, x2: `${f(dx * 1.5)}px`, y2: `${f(dy + 340)}px`, r: `${f(rot)}deg`, r2: `${f(rot * 1.8)}deg` } }))
    })
    a += burst(ctx, L.x, CY - 20, tLand, 38, { ang: -PI / 2, span: PI * 1.3, sp: 250, fall: 210, size: 19, c2: A.lo, dur: 1.5 })
    a += at(L.x, FLOOR, m.anim('dust', tLand, `<ellipse rx="210" ry="26" fill="${C.stone}" fill-opacity=".5"/>`))
    let pud = ''
    let cr = ''
    for (let i = 0; i < 14; i++) pud += T(L.x + (hh(i, 41) - 0.5) * 300, FLOOR + 6 + hh(i, 42) * 18, hh(i, 43) < 0.5 ? '0' : '1', { a: 'middle', s: f(10 + hh(i, 44) * 6), w: 800, c: hh(i, 45) < 0.6 ? A.base : A.lo, op: 0.85 })
    a += m.anim('fadein', tLand + 0.5, pud)
    for (let i = 0; i < 6; i++) {
      const sx = L.x + (i < 3 ? -1 : 1) * (dw / 2 - 6)
      const ex = sx + (i < 3 ? -1 : 1) * (60 + hh(i, 51) * 90)
      cr += m.el('path', 'draw', tLand, { d: `M${f(sx)} ${FLOOR + 2 + (i % 3) * 4}L${f((sx + ex) / 2)} ${f(FLOOR + 8 + hh(i, 52) * 10)}L${f(ex)} ${f(FLOOR + 4 + hh(i, 53) * 16)}`, fill: 'none', stroke: C.bone, 'stroke-opacity': '.7', 'stroke-width': 1.6 }, '', { dur: 0.3 })
    }
    a += cr
    ctx.ev(tLand, 1.7)
    const h = ctx.head(tLand + 0.55)
    const hd = chrome(ctx, ctx.m, ctx.title, 480, 150, 870, 12, i => h + i * 0.05)
    ctx.hev(h + 0.17, 0.3)
    ctx.hev(hd.land, 1.05)
    let head = hd.body
    for (let i = 0; i < 12; i++) head += ctx.m.el('text', 'drip', hd.land + 0.15 + hh(i, 2) * 0.9, { x: f(hd.x0 + hh(i, 4) * hd.w), y: f(hd.y0 + hd.h + 12), 'font-size': 13, 'font-weight': 800, fill: hh(i, 9) < 0.6 ? A.base : A.lo, 'text-anchor': 'middle' }, hh(i, 5) < 0.5 ? '0' : '1')
    head += at(W.x, CY, ctx.m.anim('pop', hd.land + 0.1, wreath(ctx, 0, 0, R + 22, A.base, A.base, 11)))
    return { tB, action: a, head, land: hd.land, barPre: { W: W.hp, L: 0.3 } }
  },

  /** Ultra combo: every scored commit is a hit, with a counter and the points as damage. */
  combo: ctx => {
    const { W, L, dir, A, id, ma: m } = ctx
    const N = Math.max(3, Math.min(14, Math.round(num(ctx.a.hits ?? W.commits))))
    const vals = split(W.pts, N)
    const hits = Array.from({ length: N }, (_, i) => 1.2 + i * 0.15)
    const tF = hits[N - 1] as number
    const tB = tF
    const KD = tF + 0.6
    const [cW, cL] = coinPair(ctx)
    const meet = L.x - dir * 212
    ctx.own.push({ name: 'jab', dur: KD, frames: spikeKF(KD, hits.map(t => ({ t: t - 0.03, k: 1 })), () => [`transform:translate(${dir * 24}px,0px)`, `transform:translate(${dir * 10}px,0px)`, 'transform:translate(0px,0px)'], 'transform:translate(0px,0px)') })
    ctx.own.push({ name: 'jolt', dur: KD, frames: spikeKF(KD, hits.slice(0, -1).map(t => ({ t, k: 1 })), () => [`transform:translate(${dir * 13}px,-3px)`, `transform:translate(${dir * 5}px,0px)`, 'transform:translate(0px,0px)'], 'transform:translate(0px,0px)') })
    let cum = 0
    ctx.own.push({ name: 'cbar', dur: KD, frames: holdKF(KD, hits.map((t, i): [number, string] => {
      cum += vals[i] ?? 0
      return [t, `transform:scaleX(${f(i === N - 1 ? 0 : Math.max(0.04, 1 - (cum / Math.max(1, W.pts)) * 0.96))})`]
    }), 'transform:scaleX(1)') })
    let a = ''
    a += at(W.x, CY, m.anim('pop', 0.2, m.anim('mv', 0.6, shadow(0, R, R) + m.anim('jab', 0, m.anim('bob', -0.5, ref(cW))), { vars: { x: `${meet - W.x}px`, y: '0px', s: 1 } })))
    a += at(L.x, CY, m.anim('out', tF, shadow(0, R, R)) + m.anim('pop', 0.1, m.anim('knock', tF, m.anim('jolt', 0, m.anim('bob', -1.2, ref(cL))), { vars: { x: `${dir * 170}px`, y: '62px', r: `${dir * 40}deg` } })))
    // one small spark of each color, reused by every hit
    const sA = id('sa')
    const sW = id('sw')
    ctx.defs += `<g id="${sA}">${star(40, 14, A.hi)}</g><g id="${sW}">${star(40, 14, '#fff')}</g>`
    let counter = ''
    hits.forEach((t, i) => {
      const last = i === N - 1
      const jx = (hh(i, 61) - 0.5) * 50
      const jy = (hh(i, 62) - 0.5) * 60
      a += at(L.x - dir * (64 + hh(i, 63) * 20) + jx * 0.3, CY - 26 + jy, m.anim('spark', t - 0.02, last ? star(70, 24, A.hi) : ref(hh(i, 64) < 0.5 ? sA : sW)))
      a += m.el('text', 'rise', t, { x: f(L.x + jx), y: f(CY - 104 + jy * 0.4), 'font-size': last ? 34 : 26, 'font-weight': 800, fill: A.hi, stroke: C.ink, 'stroke-width': 5, 'paint-order': 'stroke', 'text-anchor': 'middle' }, `+${vals[i] ?? 0}`, { vars: { x: `${f(jx * 0.6)}px` } })
      if (!last) ctx.ev(t, 0.22)
      if (i >= 1) {
        const g = m.anim('pop', t, pixText(`${i + 1}`, 480, 108, 8, `fill="${A.mid}" stroke="${C.ink}" stroke-width="3" paint-order="stroke"`), { dur: 0.22 })
        counter += last ? m.anim('show', t, g) : m.anim('hide', hits[i + 1] as number, m.anim('show', t, g))
      }
    })
    a += m.anim('out', tF + 0.45, counter + m.anim('show', hits[1] as number, T(480, 160, 'HITS', { a: 'middle', s: 17, w: 800, c: A.base, ls: 7, st: C.ink, sw: 4 })))
    a += burst(ctx, L.x - dir * 50, CY - 20, tF, 26, { ang: dir > 0 ? -PI * 0.3 : -PI * 0.7, span: PI, sp: 200, fall: 170 })
    ctx.ev(tF, 1.3)
    const h = ctx.head(tF + 0.85)
    const hd = chrome(ctx, ctx.m, ctx.title, 480, 150, 870, 11, i => h + i * 0.05)
    ctx.hev(h + 0.17, 0.3)
    ctx.hev(hd.land, 1)
    const head = hd.body + at(meet, CY, ctx.m.anim('pop', hd.land + 0.1, wreath(ctx, 0, 0, R + 24, A.base, A.base, 11)))
    return { tB, action: a, head, land: hd.land, barPre: { W: W.hp, L: 1 }, cbar: true }
  },

  /** Clutch: the race chart. Low health, a heartbeat, then the last commit lands at the bell. */
  clutch: ctx => {
    const { W, L, A, id, ma: m } = ctx
    const lenMin = Math.max(1, num(ctx.a.length_min))
    const winMin = Math.max(0, num(ctx.a.clutch_min ?? clutchMinFor(lenMin)))
    // the token labels sit right of the bell line, so long handles pull the chart in
    const labW = (Pl: P) => (`${Pl.pts} ${Pl.handle}`.length) * 8.8
    const X0 = 110
    const X1 = Math.min(850, 938 - Math.max(labW(W), labW(L)))
    const Y0 = 404
    const YT = 236
    const tB = 2.36
    const lc = Math.max(2, Math.min(STAIR_MAX, L.commits))
    const lv = split(L.pts, lc)
    const lt = lv.map((_, i) => 0.03 + ((i + 0.3 + hh(i, 31) * 0.6) / lc) * 0.9)
    let last: number = SCALE.find(v => v >= W.pts - L.pts + 6) ?? 21
    if (last >= W.pts) last = Math.max(1, W.pts - 1)
    // the winner answers each of the loser's commits a little later and a little short, so they trail all match
    const ratio = (W.pts - last) / Math.max(1, L.pts)
    let lc0 = 0
    let wc0 = 0
    const wt: number[] = []
    const wv: number[] = []
    lt.forEach((t, i) => {
      lc0 += lv[i] ?? 0
      const c = Math.round(lc0 * ratio)
      if (c > wc0) {
        wt.push(Math.min(0.97, t + 0.025 + hh(i, 17) * 0.03))
        wv.push(c - wc0)
        wc0 = c
      }
    })
    wt.push(0.985)
    wv.push(W.pts - wc0)
    const max = Math.max(W.pts, L.pts, 1)
    const X = (t: number) => X0 + t * (X1 - X0)
    const Y = (p: number) => Y0 - (p / max) * (Y0 - YT)
    const stair = (ts: number[], vs: number[], n: number) => {
      let d = `M${X0} ${Y0}`
      let c = 0
      for (let i = 0; i < n; i++) {
        // a 0-point commit is no step
        if (!vs[i]) continue
        c += vs[i] as number
        d += `H${f(X(ts[i] ?? 0))}V${f(Y(c))}`
      }
      return { d, c }
    }
    const Ls = stair(lt, lv, lc)
    const Wm = stair(wt, wv, wt.length - 1)
    const xs = X(wt[wt.length - 1] as number)
    let a = ''
    const hp = id('hatch')
    ctx.defs += `<pattern id="${hp}" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="3" height="8" fill="${A.base}" fill-opacity=".28"/></pattern>`
    // seven marks, every sixth of the match; every other one is labelled, all in one unit:
    // hours when a third of the match is whole hours (0H 1H 2H 3H), else minutes (0M 20M 40M 60M)
    let grid = ''
    const inH = (lenMin / 3) % 60 === 0
    const axis = (min: number) => (inH ? `${min / 60}H` : `${Math.round(min * 10) / 10}M`)
    for (let k = 0; k <= 6; k++) {
      const x = X(k / 6)
      grid += `M${f(x)} ${YT - 6}V${Y0}`
      if (k % 2 === 0) a += T(x, Y0 + 20, axis((lenMin * k) / 6), { a: 'middle', s: 11, w: 700, c: C.stone, ls: 1 })
    }
    const panelR = Math.max(X1 + 86, X1 + 32 + Math.max(labW(W), labW(L)))
    a += `<rect x="${X0 - 14}" y="${YT - 34}" width="${f(panelR - X0 + 14)}" height="${Y0 - YT + 64}" fill="#0B0A09" fill-opacity=".72"/><path d="${grid}" stroke="${C.stone2}" stroke-opacity=".55" stroke-dasharray="2 4"/>`
    const lx = X(Math.max(0, Math.min(1, 1 - winMin / lenMin)))
    a += `<rect x="${f(lx)}" y="${YT - 6}" width="${f(X1 - lx)}" height="${Y0 - YT + 6}" fill="url(#${hp})"/>` + T(lx - 8, YT + 6, `LAST ${Math.round(winMin * 10) / 10} MIN`, { a: 'end', s: 10, w: 800, c: A.mid, ls: 2 })
    a += `<path d="M${X0} ${Y0}H${f(X1)}" stroke="${C.bone}" stroke-opacity=".5"/><path d="M${f(X1)} ${YT - 24}V${Y0}" stroke="${C.bone}" stroke-dasharray="4 3"/>` + T(X1, YT - 30, 'BELL', { a: 'middle', s: 11, w: 800, c: C.bone, ls: 3 })
    a += m.el('path', 'draw', 0.2, { d: `${Ls.d}H${f(X1)}`, fill: 'none', stroke: C.bone, 'stroke-width': 2.6 })
    a += m.el('path', 'draw', 0.2, { d: `${Wm.d}H${f(xs)}`, fill: 'none', stroke: A.base, 'stroke-width': 3.4 })
    a += m.el('path', 'draw', tB - 0.14, { d: `M${f(xs)} ${f(Y(Wm.c))}V${f(Y(W.pts))}H${f(X1)}`, fill: 'none', stroke: A.hi, 'stroke-width': 4.5 }, '', { dur: 0.14 })
    a += m.anim('hide', tB - 0.1, m.anim('show', 1.4, T(xs - 10, Y(Wm.c) + 24, `-${Math.max(0, L.pts - Wm.c)}`, { a: 'end', s: 18, w: 800, c: A.mid, st: C.ink, sw: 4 })))
    const tok = (Pl: P, y: number, t: number) => at(X1, y, m.anim('pop', t, `<circle r="12" fill="${Pl.me ? C.or : C.ink2}" stroke="${Pl.me ? C.ink : C.bone}" stroke-width="1.5"/><circle r="8.5" fill="none" stroke="${Pl.me ? C.ink : C.bone}" stroke-width=".8" stroke-dasharray="1.4 1.6"/>` + T(22, 5, `${Pl.pts} ${Pl.handle.toUpperCase()}`, { s: 13, w: 800, c: Pl === W ? A.mid : C.bone, ls: 1 })))
    const close = Y(L.pts) - Y(W.pts) < 22
    a += tok(L, Y(L.pts) + (close ? 12 : 0), 1.4) + tok(W, Y(W.pts) - (close ? 12 : 0), tB)
    const hv = id('hv')
    ctx.defs += `<radialGradient id="${hv}" cx=".5" cy=".5" r=".72"><stop offset=".45" stop-color="${A.lo}" stop-opacity="0"/><stop offset="1" stop-color="${A.lo}" stop-opacity=".95"/></radialGradient>`
    a += m.anim('beat', 1.38, `<rect x="-40" y="-40" width="1040" height="584" fill="url(#${hv})"/>`)
    a += burst(ctx, X1, Y(W.pts), tB, 22, { ang: -PI * 0.6, span: PI * 0.9, sp: 160, fall: 140 })
    ctx.ev(tB, 1.4)
    const h = ctx.head(tB + 0.4)
    const hd = chrome(ctx, ctx.m, ctx.title, 480, 128, 870, 13, i => h + i * 0.06)
    ctx.hev(h + 0.17, 0.3)
    ctx.hev(hd.land, 1.05)
    return { tB, action: a, head: hd.body, land: hd.land, barPre: { W: 0.14, L: 0.72 }, blinkW: true }
  },

  /** Photo finish: a stadion sprint, a late surge, a camera flash and the finish cam frame. */
  photo: ctx => {
    const { W, L, A, id, ma: m } = ctx
    const tS = 0.3
    const tE = tS + 2.1
    const tB = tE
    const r = 34
    const yW = W.me ? 373 : 299
    const yL = L.me ? 373 : 299
    const cW = id('cw')
    const cL = id('cl')
    ctx.defs += coinDef(ctx, W, r, cW, false) + coinDef(ctx, L, r, cL, false)
    const ck = id('ck')
    ctx.defs += `<pattern id="${ck}" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="${C.ink}"/><rect width="5" height="5" fill="${C.bone}"/><rect x="5" y="5" width="5" height="5" fill="${C.bone}"/></pattern>`
    const FX = 817
    const x0 = 120
    let a = `<rect x="40" y="262" width="880" height="148" fill="${C.ink2}" fill-opacity=".8"/><path d="M40 262H920M40 336H920M40 410H920" stroke="${C.bone}" stroke-opacity=".45" stroke-dasharray="6 5"/><path d="M88 262V410" stroke="${C.bone}" stroke-opacity=".5" stroke-dasharray="2 3"/><rect x="${FX - 5}" y="262" width="10" height="148" fill="url(#${ck})"/>`
    a += T(60, 305, '2', { a: 'middle', s: 16, w: 800, c: C.stone2 }) + T(60, 379, '1', { a: 'middle', s: 16, w: 800, c: C.stone2 })
    const runner = (cid: string, y: number, d: number, ease: string) => at(x0, y, m.anim('run', tS, `${shadow(0, r + 2, r)}${m.anim('out', tE - 0.45, m.anim('fadein', tS, `<path d="M${-r - 14} -12h-70M${-r - 8} 4h-100M${-r - 18} 18h-50" stroke="${C.bone}" stroke-opacity=".55" stroke-width="2" stroke-dasharray="10 6"/>`))}${m.anim('roll', tS, ref(cid), { ease, vars: { rot: '1080deg' } })}`, { ease, vars: { d: `${d}px` } }))
    a += runner(cL, yL, FX - 9 - x0, 'cubic-bezier(.2,.62,.35,1)') + runner(cW, yW, FX + 19 - x0, 'cubic-bezier(.55,.08,.3,1)')
    a += m.el('rect', 'shut', tE, { x: -40, y: -300, width: 1040, height: 552, fill: '#0B0A09' }, '', { vars: { o: '-300px' } }) + m.el('rect', 'shut', tE, { x: -40, y: 252, width: 1040, height: 552, fill: '#0B0A09' }, '', { vars: { o: '300px' } })
    let frame = `<rect x="700" y="236" width="232" height="178" fill="none" stroke="${C.paper}" stroke-width="9"/><rect x="704.5" y="240.5" width="223" height="169" fill="none" stroke="${C.ink}" stroke-width="1.5"/><path d="M${FX} 244V408" stroke="${A.base}" stroke-width="1.6" stroke-dasharray="3 2"/>`
    frame += `<rect x="695.5" y="414" width="241" height="30" fill="${C.paper}"/>` + T(708, 434, 'FINISH CAM', { s: 11, w: 800, c: C.ink, ls: 2 }) + T(924, 434, `${W.pts} · ${L.pts}`, { a: 'end', s: 13, w: 800, c: C.ink, ls: 1 })
    a += `<g transform="rotate(-2.5 816 340)">${m.anim('pop', tE + 0.22, frame)}</g>`
    a += at(FX + 19, yW, m.anim('pop', tE + 0.45, `<circle r="${r + 8}" fill="none" stroke="${A.base}" stroke-width="3"/>`))
    ctx.ev(tE, 1.1)
    const h = ctx.head(tE + 0.75)
    const hd = chrome(ctx, ctx.m, ctx.title, 480, 150, 870, 11, i => h + i * 0.055)
    ctx.hev(h + 0.17, 0.3)
    ctx.hev(hd.land, 1)
    return { tB, action: a, head: hd.body, land: hd.land, barPre: { W: Math.max(0.06, W.hp), L: 0.12 } }
  },
}

// ------------------------------------------------------------------ assembly

function doc(w: number, h: number, vb: string, label: string, defs: string, css: string, body: string) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vb}" role="img" aria-label="${esc(label)}" font-family="${MONO}"><defs>${defs}</defs><style>${css}</style>${body}</svg>`
}

/** A finisher, both screens: the winner watches it land, the loser watches it land on them. */
export function buildFinisher(a: FinisherInput, o: FinisherOptions = {}): FinisherDrawing {
  const ctx = setup(a, o.motion ?? PLAY, !!o.short)
  const { m } = ctx
  const bg = stage(ctx)
  const out = FIN[ctx.kind](ctx)
  ctx.ev(out.tB, 0.35)
  const hudM = hud(ctx, out.tB, out)
  const subT = out.land + 0.35
  let cam = ''
  let end = subT + 1.5
  if (a.cameo) {
    const ct = subT + 0.7
    cam = cameo(ctx, ct)
    end = ct + 2.1
  }
  const total = end
  const evs = ctx.events.filter(e => e.t < total)
  ctx.own.push({ name: 'cam', dur: total, frames: spikeKF(total, evs, shakeSeq, 'transform:translate(0px,0px)') })
  ctx.own.push({ name: 'fl', dur: total, frames: spikeKF(total, evs.filter(e => e.k >= 0.9), flashSeq, 'opacity:0') })
  const body = `${m.anim('cam', 0, `${bg}${out.action}${out.head}${subLines(ctx, subT)}`)}${hudM}${cam}${m.el('rect', 'fl', 0, { x: -40, y: -40, width: 1040, height: 584, fill: '#FFF4E8' })}<rect width="960" height="504" fill="url(#${ctx.vg})"/><rect width="960" height="504" fill="url(#${ctx.sl})" opacity=".6"/>`
  const defs = ctx.shared + ctx.defs
  const css = m.css(defs + body, ctx.own)
  return { svg: doc(960, 504, '0 0 960 504', ctx.title, defs, css, body), kind: ctx.kind, title: ctx.title, line: lineOf(a), totalMs: Math.round(total * 1000), headMs: Math.round(ctx.hT * 1000) }
}

/**
 * What a finisher says, without drawing it: the kind it plays as, the headline, the line under
 * it and the stats, exactly as buildFinisher draws them. The terminal's version and the alt text
 * read these, so a screen without the drawing says the same words.
 */
export function finisherWords(a: FinisherInput): { kind: FinisherKind; title: string; line: string; stats: string } {
  const ctx = setup(a, PLAY, false)
  return { kind: ctx.kind, title: ctx.title, line: lineOf(a), stats: statsOf(ctx) }
}

/** When the HUD's bell rings over custom art (the authoring spec's 0.8 s). */
export const BELL_AT_MS = 800
/** The 960x96 top of the frame custom art plays inside: the HUD, counting down to the bell at 0.8 s. */
export function finisherHud(a: FinisherInput, o: { motion?: Motion } = {}) {
  const ctx = setup(a, o.motion ?? PLAY, false)
  screenDefs(ctx)
  const body = `<rect width="960" height="96" fill="${C.ink}"/>${hud(ctx, BELL_AT_MS / 1000, { barPre: { W: ctx.W.hp, L: 0.3 } })}<rect width="960" height="96" fill="url(#${ctx.sl})" opacity=".6"/>`
  return doc(960, 96, '0 0 960 96', `${ctx.W.handle} ${ctx.W.pts}, ${ctx.L.handle} ${ctx.L.pts}`, ctx.defs, ctx.m.css(ctx.defs + body, []), body)
}
/** The 960x80 bottom of that frame: the line and the stats, fading in at `atMs`. */
export function finisherStrip(a: FinisherInput, o: { motion?: Motion; atMs?: number } = {}) {
  const ctx = setup(a, o.motion ?? PLAY, false)
  screenDefs(ctx)
  const body = `<g transform="translate(0 -424)">${floor()}${subLines(ctx, Math.max(0, num(o.atMs)) / 1000)}</g><rect width="960" height="80" fill="url(#${ctx.sl})" opacity=".6"/>`
  return doc(960, 80, '0 0 960 80', lineOf(a), ctx.defs, ctx.m.css(ctx.defs + body, []), body)
}

/** Hold every animation at `ms`: shift each delay back by it and pause. After totalMs, draw freeze(svg, totalMs + 3000). */
export function freeze(svg: string, ms: number) {
  const t = num(ms) / 1000
  return svg.replace(/animation-delay:(-?[\d.]+)s/g, (_, d: string) => `animation-delay:${f(parseFloat(d) - t)}s`).replace('</style>', `svg [class]{animation-delay:${f(-t)}s}*{animation-play-state:paused!important}</style>`)
}
/** Replay: the same drawing with a counter comment just before </svg>, so the Svg element reloads it. */
export function withCounter(svg: string, n: number) {
  const base = svg.replace(/<!--\d+--><\/svg>\s*$/, '</svg>')
  const i = base.lastIndexOf('</svg>')
  if (i < 0) return base
  return `${base.slice(0, i)}<!--${Math.max(0, Math.floor(num(n)))}-->${base.slice(i)}`
}

// ------------------------------------------------------------------ the pick, mirroring the server (W10a's pickFinisher)

/** One score in the match, as the pick reads it. `at` is authored_at in ms; superseded scores are skipped. */
export type PickScore = { side: 'w' | 'l'; points: number; at: number; id: number | string; superseded?: boolean }
export type PickInput = {
  /** Final totals and the winner's scored commits. */
  w: number
  l: number
  wCommits: number
  timeline: readonly PickScore[]
  /** The bell, in ms. */
  deadline: number
  /** The clutch window: the match's grace, in ms. */
  windowMs: number
  result: string | null
}
const byTime = (a: PickScore, b: PickScore) => a.at - b.at || (typeof a.id === 'number' && typeof b.id === 'number' ? a.id - b.id : String(a.id) < String(b.id) ? -1 : String(a.id) > String(b.id) ? 1 : 0)
/** The winner trailed when the window opened, or after any score inside [deadline - window, deadline). */
function trailedLate(p: PickInput) {
  const start = p.deadline - p.windowMs
  let w = 0
  let l = 0
  let opened = false
  for (const s of p.timeline.filter(x => !x.superseded && x.at < p.deadline).sort(byTime)) {
    if (!opened && s.at >= start) {
      opened = true
      if (w < l) return true
    }
    if (s.side === 'w') w += s.points
    else l += s.points
    if (opened && w < l) return true
  }
  return !opened && w < l
}
/**
 * Which finisher a match ends with. Only a win picks; a draw, a forfeit or a void has none.
 * The first rule that holds: flawless (the loser scored 0), shipality (3 times the loser or more),
 * clutch (trailing late), photo (won by 3 or less), combo (8 or more scored commits), else knockout.
 */
export function pickFinisher(p: PickInput): FinisherKind | null {
  if (p.result !== 'win') return null
  if (p.l === 0) return 'flawless'
  if (p.w >= 3 * p.l) return 'shipality'
  if (trailedLate(p)) return 'clutch'
  if (p.w - p.l <= 3) return 'photo'
  if (p.wCommits >= 8) return 'combo'
  return 'knockout'
}
