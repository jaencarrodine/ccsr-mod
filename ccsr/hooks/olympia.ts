// Ported verbatim from mod-lab/hooks/svg.ts (the UI session's source of truth).
// Change drawings there and copy this file over; never edit it here.

// Olympia for the CCSR mod, drawn at the pane's real width (480).
//
// Pure functions: plain values in, one SVG string out. No `$`, no imports,
// so the build session can port this file into mod/hooks/ as is. Every
// interpolated string goes through esc(). Each drawing is its own document
// (the Svg element draws it as a sandboxed image), so ids only need to be
// unique inside one drawing. Fonts don't load inside Svg: everything is
// designed for the ui-monospace fallback. Source of truth for the look is
// design/boards/mod-surfaces.html; for copy, docs/copy.md.

export const W = 480

const C = {
  bone: '#E6DED1',
  bone2: '#D9CFBF',
  bone3: '#CBBFAC',
  paper: '#EFE9DF',
  ink: '#141312',
  ink2: '#1C1A18',
  or: '#FF6A2A',
  orHi: '#FF8A57',
  stone: '#9A9286',
  stone2: '#6A635A',
}
const MONO = 'ui-monospace,Menlo,monospace'
const PI = Math.PI

/** Approved lines from docs/copy.md that are drawn inside a graphic. Change them there first. */
export const COPY = {
  handle: "It'll be on a lot of Ls.",
  grind: 'For people who think weekends are a skill issue.',
  top10: 'Your rank is somewhere below. Way below.',
  numberOne: '#1 Claude Code ranked player (world)',
  queueUp: 'Queue up.',
  queueUp2: 'Lose in public.',
  lengths: '1h for a quick L. 3h for a long one.',
}

/** Lines drawn inside a graphic that aren't in docs/copy.md yet. TODO copy: listed in docs/ui-spec.md for Jaen. */
export const TODO_COPY = {
  mud: 'Everyone starts in the mud.',
  quiet: 'quiet in here',
  steps: ['Pick lengths', 'Queue', 'Accept in 60s', 'Ship before the bell'],
}

/** Placement: a new player shows Mud, with no number, until their placement matches are played. */
export type Placing = { played: number; of: number }

// ------------------------------------------------------------------ primitives

export function esc(s: string | number) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

const f = (n: number) => String(Math.round(n * 100) / 100)

/** A match length label: 1H, 3H, or 5M for the practice sprint. */
const hrs = (h: number) => (h < 1 ? `${Math.round(h * 60)}M` : `${h}H`)

/** Deterministic noise in 0..1, so a drawing is the same every render. */
function hh(a: number, b: number) {
  const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453
  return h - Math.floor(h)
}

type TextOpts = { s?: number; w?: number; c?: string; a?: 'start' | 'middle' | 'end'; ls?: number; op?: number }

function T(x: number, y: number, t: string | number, o: TextOpts = {}) {
  return `<text x="${f(x)}" y="${f(y)}"${o.a ? ` text-anchor="${o.a}"` : ''} font-size="${o.s ?? 10}"${o.w ? ` font-weight="${o.w}"` : ''} fill="${o.c ?? C.ink}"${o.ls != null ? ` letter-spacing="${o.ls}"` : ''}${o.op != null ? ` fill-opacity="${o.op}"` : ''}>${esc(t)}</text>`
}

/** One drawing. The markup's own width and height size the Svg box; the slot scales it down if narrower. */
function svg(w: number, h: number, alt: string, body: string, bg?: string, o: { rx?: number; flat?: boolean } = {}) {
  const rx = o.rx ?? 6
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(alt)}" font-family="${MONO}">`
  if (bg) {
    s += `<rect width="${w}" height="${h}" rx="${rx}" fill="${bg}"/>`
    if (bg !== C.ink && bg !== C.ink2 && !o.flat)
      s += `<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.07  0 0 0 .5 0"/></filter><rect width="${w}" height="${h}" rx="${rx}" filter="url(#grain)" opacity=".16"/>`
  }
  return s + body + '</svg>'
}

/** A fresh id factory per drawing. */
function idMaker() {
  let n = 0
  return (p: string) => `${p}${++n}`
}
type Id = ReturnType<typeof idMaker>

function meander(x: number, y: number, w: number, col: string, sw = 1.4) {
  let d = ''
  const n = Math.floor(w / 12)
  for (let i = 0; i < n; i++) {
    const o = x + i * 12
    d += `M${f(o)} ${f(y + 9.5)}V${f(y + 2.5)}H${f(o + 8)}V${f(y + 6)}H${f(o + 4)}V${f(y + 9.5)}H${f(o + 12)}`
  }
  return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="square"/>`
}

function binRow(x: number, y: number, w: number, size: number, col: string, op = 0.3) {
  let r = ''
  const n = Math.floor(w / (size * 1.8))
  for (let i = 0; i < n; i++) r += (hh(i, y) < 0.86 ? '01' : '10') + ' '
  return `<text x="${f(x)}" y="${f(y)}" font-size="${size}" fill="${col}" fill-opacity="${op}" xml:space="preserve">${r}</text>`
}

function stylobate(x: number, y: number, w: number, col: string, n = 3) {
  let s = ''
  for (let k = 0; k < n; k++)
    s += `<rect x="${f(x - 6 - k * 8)}" y="${f(y + k * 5)}" width="${f(w + 12 + k * 16)}" height="5" fill="${k === 0 ? C.paper : 'none'}" stroke="${col}" stroke-opacity="${k ? 0.5 : 1}"${k ? ' stroke-dasharray="3 2"' : ''}/>`
  return s
}

const LEAF = 'M0 0C5 -4.6 13 -4.8 19 0C13 4.8 5 4.6 0 0Z'

/** The small laurel the top 100 wear. */
function laurel(x: number, y: number, size: number, col: string) {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(size / 24)})" fill="none" stroke="${col}" stroke-width="1.4" stroke-linecap="round"><path d="M12 21C6 19 3.5 14 4.5 7"/><path d="M12 21c6-2 8.5-7 7.5-14"/><path d="M5.6 16.2l-2.6-.6M4.6 12.6l-2.4-1.2M4.4 9l-1.8-1.8M8.2 18.8l-1.6 2M18.4 16.2l2.6-.6M19.4 12.6l2.4-1.2M19.6 9l1.8-1.8M15.8 18.8l1.6 2"/></g>`
}

/** A laurel wreath open at the top, ported from the landing page. */
function wreath(cx: number, cy: number, r: number, line: string, acc: string, n = 11) {
  let s = ''
  for (const sd of [1, -1]) {
    let d = ''
    const a1 = PI * 0.58
    const a2 = PI * 1.42
    for (let i = 0; i <= 30; i++) {
      const a = a1 + ((a2 - a1) * i) / 30
      d += `${i ? 'L' : 'M'}${f(cx + sd * r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`
    }
    s += `<path d="${d}" fill="none" stroke="${line}" stroke-width="1.5"/>`
    for (let k = 0; k < n; k++) {
      const a = a1 + ((a2 - a1) * (k + 0.5)) / (n + 0.4)
      const x = cx + sd * r * Math.cos(a)
      const y = cy + r * Math.sin(a)
      const th = (Math.atan2(Math.cos(a), -sd * Math.sin(a)) * 180) / PI
      ;[-38, 38].forEach((o, j) => {
        s += `<path d="${LEAF}" transform="translate(${f(x)} ${f(y)}) rotate(${f(th + o + 180)}) scale(${f(((1.05 - k * 0.035) * r) / 86)})" fill="${j ? acc : 'none'}" stroke="${j ? acc : line}" stroke-width="1.1"/>`
      })
    }
  }
  return s
}

/** A plain coin for rows and strips: orange for you, ink for them, dashed when empty. */
function token(cx: number, cy: number, r: number, mine: boolean, label = '', ghost = false) {
  const fill = ghost ? 'none' : mine ? C.or : C.ink
  const inner = mine || ghost ? C.ink : C.bone
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" stroke="${ghost ? C.stone2 : C.ink}" stroke-width="1"${ghost ? ' stroke-dasharray="2 2"' : ''}/><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(Math.max(1, r - 2.2))}" fill="none" stroke="${inner}" stroke-width=".7" stroke-dasharray="1.2 1.4"/>${label ? T(cx, cy + r * 0.36, label, { a: 'middle', s: r * 0.95, w: 700, c: inner }) : ''}`
}

function ring(cx: number, cy: number, r: number, frac: number, col: string, sw: number) {
  const ae = -PI / 2 + Math.max(0.001, Math.min(0.999, frac)) * PI * 2
  return `<path d="M${f(cx)} ${f(cy - r)}A${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${f(cx + r * Math.cos(ae))} ${f(cy + r * Math.sin(ae))}" fill="none" stroke="${col}" stroke-width="${sw}"/>`
}

// ------------------------------------------------------------------ medallion (landing page port)

const HEAD =
  'M140 72C166 66 190 78 198 96C204 104 207 114 209 124C211 132 212 137 211 140C216 148 222 156 228 164C229 167 226 170 221 170C219 172 218 174 219 176C221 178 220 181 216 182L214 183C218 185 219 188 216 190C213 192 212 194 213 197C216 202 215 208 210 213C204 218 196 219 189 219C186 228 188 238 193 250C168 258 140 256 120 248C122 236 120 226 114 216C100 206 90 186 88 162C86 134 96 106 114 88C122 80 130 75 140 72Z'
const HAIR =
  'M198 96C192 108 188 124 186 138C182 148 172 152 160 156C152 162 150 176 150 190C146 200 130 208 114 216C100 206 90 186 88 162C86 134 96 106 114 88C122 80 130 75 140 72C166 66 190 78 198 96Z'

function keyPath(r1: number, r2: number, a0: number, da: number) {
  const P: [number, number][] = [[0, 0], [0, 1], [1, 1], [1, 0.22], [0.3, 0.22], [0.3, 0.72], [0.7, 0.72], [0.7, 0.47], [0.5, 0.47]]
  return P.map((p, i) => {
    const a = a0 + (0.16 + 0.68 * p[0]) * da
    const r = r1 + (0.12 + 0.76 * p[1]) * (r2 - r1)
    return `${i ? 'L' : 'M'}${f(160 + r * Math.cos(a))} ${f(160 + r * Math.sin(a))}`
  }).join('')
}

/** The laureled bust streaming into binary, lighter than the landing page's (fewer 01 cells) to stay well under the Svg cap. */
function bust(id: Id, S: string, F: string, flip: boolean) {
  const X = (x: number) => (flip ? 320 - x : x)
  const Tf = flip ? ' transform="translate(320 0) scale(-1 1)"' : ''
  const hairId = id('hair')
  const faceId = id('face')
  let s = `<defs><clipPath id="${hairId}"><path d="${HAIR}"${Tf}/></clipPath><clipPath id="${faceId}"><circle cx="160" cy="160" r="103"/></clipPath></defs><g clip-path="url(#${faceId})"><g transform="translate(160 166) scale(1.13) translate(-160 -166)">`
  let out = ''
  let inn = ''
  for (let r = 0; r < 16; r++) {
    const y = 70 + r * 11.6
    for (let c = 0; c < 14; c++) {
      const x = 26 + c * 14.6 + (r % 2) * 7.3
      const front = 186 - Math.abs(y - 150) * 0.25
      const p = 1.12 - ((front - x) / 110) * 0.95
      const hv = hh(r + 1, c + 1)
      if (hv > p) continue
      const g = hv < 0.1 ? '1' : hv < 0.18 ? '0' : '01'
      const ln = `<text x="${f(X(x))}" y="${f(y)}" opacity="${f(Math.max(0.25, Math.min(1, p)))}">${g}</text>`
      if (x < 160) out += ln
      inn += ln
    }
  }
  s += `<g font-size="9.5" text-anchor="middle" fill="${S}">${out}</g><g${Tf}><path d="${HEAD}" fill="${S}"/><path d="${HAIR}" fill="${F}"/></g><g clip-path="url(#${hairId})" font-size="9.5" text-anchor="middle" fill="${S}">${inn}</g>`
  let g2 = `<g${Tf}><path d="M198 96C190 78 166 66 140 72C130 75 122 80 114 88C96 106 86 134 88 162C90 186 100 206 114 216" fill="none" stroke="${S}" stroke-width="1.2" stroke-dasharray="3 3"/>`
  for (const q of [[184, 106, 8], [172, 122, 9], [156, 108, 9], [140, 122, 10], [122, 134, 9], [156, 140, 9], [134, 154, 10], [114, 160, 9], [140, 180, 9], [164, 88, 8], [138, 90, 9], [108, 118, 8]] as [number, number, number][]) {
    let d = ''
    for (let k = 0; k <= 28; k++) {
      const th = (k / 28) * PI * 3.4
      const rr = q[2] * (1 - k / (28 * 1.15))
      d += `${k ? 'L' : 'M'}${f(q[0] + rr * Math.cos(th))} ${f(q[1] + rr * Math.sin(th))}`
    }
    g2 += `<path d="${d}" fill="none" stroke="${S}" stroke-width="1.15" stroke-dasharray="2.2 1.8"/>`
  }
  const pts: [number, number][] = [[196, 99], [186, 94], [175, 91], [163, 91], [151, 93], [139, 97], [128, 103], [118, 111], [110, 121], [104, 132], [100, 144], [99, 156], [100, 168], [103, 179]]
  g2 += `<path d="M${pts.map(q => `${q[0]} ${q[1]}`).join('L')}" fill="none" stroke="${S}" stroke-width="2"/>`
  pts.forEach((q, i) => {
    if (i === pts.length - 1) return
    const nx = pts[i + 1]!
    const a = (Math.atan2(q[1] - nx[1], q[0] - nx[0]) * 180) / PI
    for (const o of [-34, 34]) g2 += `<path d="${LEAF}" transform="translate(${f(q[0])} ${f(q[1])}) rotate(${f(a + o)}) scale(${f(1.05 - i * 0.03)})" fill="${S}" stroke="${F}" stroke-width="1"/>`
  })
  const rib = 'M103 179C96 192 106 202 95 220M103 179C110 194 116 204 108 228'
  g2 += `<path d="${rib}" fill="none" stroke="${F}" stroke-width="4.4" stroke-linecap="round"/><path d="${rib}" fill="none" stroke="${S}" stroke-width="2.4" stroke-linecap="round"/>`
  g2 += `<g fill="none" stroke="${F}" stroke-width="1.4" stroke-linecap="round"><path d="M193 136Q201 131 209 135"/><path d="M196 144Q202 140 207 143"/><path d="M198 149Q203 150 206 146"/><path d="M214 183L207 184"/><path d="M172 160C162 157 157 169 161 180C164 187 171 186 171 180"/><path d="M193 250C168 258 140 256 120 248" stroke-width="1.2"/></g><circle cx="202.5" cy="145.2" r="1.6" fill="${F}"/></g>`
  return s + g2 + '</g></g>'
}

type CoinOpts = { fill: string; line: string; top?: string; bottom?: string; bust?: string; flip?: boolean; ring?: boolean; ghost?: boolean; num?: string; numSize?: number; numY?: number; keys?: number; fs?: number }

/** A medallion in its own 320 box: rim text, Greek key ring, an optional bust or numeral. */
function coin(id: Id, o: CoinOpts) {
  const L = o.line
  const top = id('top')
  const bot = id('bot')
  let s = `<defs><path id="${top}" d="M32 160A128 128 0 0 1 288 160"/><path id="${bot}" d="M18.5 160A141.5 141.5 0 0 0 301.5 160"/></defs>`
  s += `<circle cx="160" cy="160" r="158" fill="${o.fill}"${o.ring || o.ghost ? ` stroke="${L}" stroke-width="1.6"${o.ghost ? ' stroke-dasharray="4 5"' : ''}` : ''}/>`
  s += `<circle cx="160" cy="160" r="151" fill="none" stroke="${L}" stroke-width="1.4"${o.ghost ? ' stroke-dasharray="2 4"' : ''}/>`
  if (o.top || o.bottom)
    s += `<g font-size="${o.fs ?? 14}" font-weight="600" letter-spacing="3.2" fill="${L}">${o.top ? `<text><textPath href="#${top}" startOffset="50%" text-anchor="middle">${esc(o.top)}</textPath></text>` : ''}${o.bottom ? `<text><textPath href="#${bot}" startOffset="50%" text-anchor="middle">${esc(o.bottom)}</textPath></text>` : ''}</g>`
  for (const a of [0, PI]) {
    const x = 160 + 136 * Math.cos(a)
    const y = 160 + 136 * Math.sin(a)
    s += `<rect x="${f(x - 4)}" y="${f(y - 4)}" width="8" height="8" transform="rotate(45 ${f(x)} ${f(y)})" fill="${L}"/>`
  }
  s += `<circle cx="160" cy="160" r="122" fill="none" stroke="${L}" stroke-width="1.4"/><circle cx="160" cy="160" r="104" fill="none" stroke="${L}" stroke-width="1.4"/>`
  const N = o.keys ?? 26
  let d = ''
  for (let i = 0; i < N; i++) d += keyPath(106, 120, (i * PI * 2) / N - PI / 2, (PI * 2) / N)
  s += `<path d="${d}" fill="none" stroke="${L}" stroke-width="1.6" stroke-linejoin="miter" stroke-linecap="square"${o.ghost ? ' opacity=".7"' : ''}/>`
  if (o.bust) s += bust(id, o.bust, o.fill, !!o.flip)
  if (o.num != null) s += T(160, o.numY ?? 188, o.num, { a: 'middle', s: o.numSize ?? 76, w: 300, c: L, ls: -3 })
  return s
}

function coinAt(id: Id, o: CoinOpts, cx: number, cy: number, r: number) {
  return `<g transform="translate(${f(cx - r)} ${f(cy - r)}) scale(${f(r / 160)})">${coin(id, o)}</g>`
}

// ------------------------------------------------------------------ tiers and badges

export type TierKey = 'mud' | 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master'
export type Tier = { key: TierKey; name: string; min: number; fill: string; deep: string }

/** Mud is the floor, from 0, and where every new player starts (Jaen, 2026-10-07). The rest match docs/api.md. */
export const TIERS: readonly Tier[] = [
  { key: 'mud', name: 'Mud', min: 0, fill: '#8A6A4F', deep: '#6B4F39' },
  { key: 'iron', name: 'Iron', min: 650, fill: '#73777B', deep: '#55595D' },
  { key: 'bronze', name: 'Bronze', min: 800, fill: '#B47A49', deep: '#8E5A31' },
  { key: 'silver', name: 'Silver', min: 950, fill: '#BFC2C4', deep: '#93979A' },
  { key: 'gold', name: 'Gold', min: 1100, fill: '#D6AB3E', deep: '#AE8724' },
  { key: 'platinum', name: 'Platinum', min: 1250, fill: '#AFC8C3', deep: '#7FA09A' },
  { key: 'diamond', name: 'Diamond', min: 1400, fill: '#AFC9E6', deep: '#7499C6' },
  { key: 'master', name: 'Master', min: 1600, fill: '#FF6A2A', deep: '#C94E18' },
]

export function tierOf(rating: number): Tier {
  let t = TIERS[0]!
  for (const x of TIERS) if (rating >= x.min) t = x
  return t
}

function tierIndex(t: Tier) {
  return TIERS.indexOf(t)
}

function column(x: number, y0: number, y1: number, w: number, cap: boolean) {
  let s = `<rect x="${f(x - w / 2)}" y="${f(y0)}" width="${f(w)}" height="${f(y1 - y0)}" fill="${C.bone}" stroke="${C.ink}" stroke-width="1.1"/>`
  s += `<path d="M${f(x - w / 6)} ${f(y0 + 1)}V${f(y1 - 1)}M${f(x + w / 6)} ${f(y0 + 1)}V${f(y1 - 1)}" stroke="${C.ink}" stroke-width=".6" opacity=".7"/>`
  if (cap) s += `<rect x="${f(x - w / 2 - 1.6)}" y="${f(y0 - 2.4)}" width="${f(w + 3.2)}" height="2.4" fill="${C.ink}"/>`
  return s
}

function keyRing(cx: number, cy: number, r1: number, r2: number, n: number) {
  let d = ''
  for (let m = 0; m < n; m++) {
    const a0 = (m / n) * PI * 2 - PI / 2
    const da = (PI * 2) / n
    ;([[0, 0], [0, 1], [1, 1], [1, 0.3], [0.4, 0.3], [0.4, 0.7]] as [number, number][]).forEach((p, i) => {
      const a = a0 + (0.12 + 0.76 * p[0]) * da
      const r = r1 + p[1] * (r2 - r1)
      d += `${i ? 'L' : 'M'}${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`
    })
  }
  return d
}

function polygon(n: number, r: number, rot: number) {
  let d = ''
  for (let z = 0; z < n; z++) {
    const a = (z / n) * PI * 2 + rot
    d += `${z ? 'L' : 'M'}${f(32 + r * Math.cos(a))} ${f(32 + r * Math.sin(a))}`
  }
  return d + 'Z'
}

/** A tier badge in a 64 box. The set tells one story: a temple going up, from wet clay to the flame. */
function badge(key: TierKey) {
  const t = TIERS.find(x => x.key === key) as Tier
  const ink = C.ink
  let s = ''
  if (key === 'mud') {
    let d = ''
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * PI * 2
      const r = 26.5 + (hh(i, 3) - 0.5) * 4.2
      d += `${i ? 'L' : 'M'}${f(32 + r * Math.cos(a))} ${f(33 + r * Math.sin(a))}`
    }
    let d2 = ''
    for (let j = 0; j <= 26; j++) {
      const a = (j / 26) * PI * 2
      const r = 21 + (hh(j, 9) - 0.5) * 3
      d2 += `${j ? 'L' : 'M'}${f(32 + r * Math.cos(a))} ${f(33 + r * Math.sin(a))}`
    }
    s += `<path d="${d}Z" fill="${t.fill}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="${d2}Z" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="2 2" opacity=".7"/>`
    s += `<path d="M19 27l6 3l-2 4l7 3M33 22l3 6l6-1M37 36l5 4l-1 5" stroke="${ink}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`
    s += `<path d="M27 50c1.5 3.5 1.5 6 0 8.5c-1.5-2.5-1.5-5 0-8.5z" fill="${t.deep}" stroke="${ink}" stroke-width="1"/><circle cx="44" cy="27" r="1.6" fill="none" stroke="${ink}" stroke-width=".8"/><circle cx="22" cy="40" r="1.2" fill="none" stroke="${ink}" stroke-width=".8"/>`
  } else if (key === 'iron') {
    s += `<circle cx="32" cy="32" r="27" fill="${t.fill}" stroke="${ink}" stroke-width="1.4"/><circle cx="32" cy="32" r="21" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="2 2"/>`
    for (let q = 0; q < 8; q++) {
      const a = (q / 8) * PI * 2 + PI / 8
      s += `<circle cx="${f(32 + 24 * Math.cos(a))}" cy="${f(32 + 24 * Math.sin(a))}" r="1.5" fill="${ink}"/>`
    }
    s += `<path d="M22 43L37 28" stroke="${ink}" stroke-width="3.4" stroke-linecap="square"/><path d="M37 28l4.5-4.5" stroke="${ink}" stroke-width="1.6"/><path d="M43 44L31 32" stroke="${ink}" stroke-width="1.8"/><rect x="21.5" y="22" width="13" height="7.5" transform="rotate(45 28 25.75)" fill="${C.bone}" stroke="${ink}" stroke-width="1.2"/>`
  } else if (key === 'bronze') {
    s += `<circle cx="32" cy="32" r="27" fill="${t.fill}" stroke="${ink}" stroke-width="1.4"/><path d="${keyRing(32, 32, 20, 25, 14)}" fill="none" stroke="${ink}" stroke-width=".9"/><circle cx="32" cy="32" r="18.5" fill="none" stroke="${ink}" stroke-width=".9"/>`
    s += `<rect x="22" y="40" width="20" height="3" fill="${ink}"/>${column(32, 30, 40, 13, true)}`
  } else if (key === 'silver') {
    s += `<path d="${polygon(8, 28.5, PI / 8)}" fill="${t.fill}" stroke="${ink}" stroke-width="1.4"/><path d="${polygon(8, 23, PI / 8)}" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="2 2"/>`
    s += `<rect x="21" y="45" width="22" height="3" fill="${ink}"/>${column(32, 37, 45, 12, false)}${column(32, 29, 37, 12, false)}${column(32, 21, 29, 12, true)}`
  } else if (key === 'gold') {
    s += `<path d="${polygon(8, 28.5, PI / 8)}" fill="${t.fill}" stroke="${ink}" stroke-width="1.4"/><path d="${keyRing(32, 32, 20.5, 25, 16)}" fill="none" stroke="${ink}" stroke-width=".8"/>`
    s += `<rect x="22" y="44" width="20" height="2.6" fill="${ink}"/>${column(32, 23, 44, 10, false)}<path d="M26.5 23L37.5 23L40.5 19.5L23.5 19.5Z" fill="${C.bone}" stroke="${ink}" stroke-width="1"/><rect x="21.5" y="16.5" width="21" height="3" fill="${ink}"/>`
  } else if (key === 'platinum') {
    s += `<path d="M12 23L32 9L52 23V55H12Z" fill="${t.fill}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M16 25L32 14L48 25V51H16Z" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="2 2"/>`
    s += `<rect x="19" y="45" width="26" height="3" fill="${ink}"/>${column(25, 30, 45, 6, false)}${column(39, 30, 45, 6, false)}<rect x="20" y="26" width="24" height="4" fill="${C.bone}" stroke="${ink}" stroke-width="1"/>`
  } else if (key === 'diamond') {
    s += `<path d="M32 3L61 32L32 61L3 32Z" fill="${t.fill}" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/><path d="M32 9L55 32L32 55L9 32Z" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="2 2"/><path d="M3 32H61M32 3L22 32L32 61M32 3L42 32L32 61" stroke="${ink}" stroke-width=".5" opacity=".35" fill="none"/>`
    s += `<rect x="19" y="42" width="26" height="2.6" fill="${ink}"/>${[23, 29, 35, 41].map(x => column(x, 32, 42, 3.6, false)).join('')}<rect x="20" y="29.4" width="24" height="2.6" fill="${C.bone}" stroke="${ink}" stroke-width=".9"/><path d="M20 29.4L32 22.5L44 29.4Z" fill="${C.bone}" stroke="${ink}" stroke-width="1"/>`
  } else {
    s += wreath(32, 33, 27.5, ink, ink, 8)
    s += `<circle cx="32" cy="32" r="21.5" fill="${t.fill}" stroke="${ink}" stroke-width="1.4"/><circle cx="32" cy="32" r="18" fill="none" stroke="${ink}" stroke-width=".8" stroke-dasharray="1.6 1.6"/>`
    s += `<rect x="21" y="41" width="22" height="2.4" fill="${ink}"/>${[24.5, 29.5, 34.5, 39.5].map(x => column(x, 32, 41, 3.2, false)).join('')}<rect x="22" y="29.6" width="20" height="2.4" fill="${C.bone}" stroke="${ink}" stroke-width=".9"/><path d="M22 29.6L32 23.5L42 29.6Z" fill="${C.bone}" stroke="${ink}" stroke-width="1"/>`
    s += `<path d="M32 13c3 3.6 3.4 6.6 0 9.2c-3.4-2.6-3-5.6 0-9.2z" fill="${ink}"/><path d="M32 17.2c1.2 1.6 1.2 2.8 0 3.8c-1.2-1-1.2-2.2 0-3.8z" fill="${C.orHi}"/>`
  }
  return s
}

function badgeAt(key: TierKey, x: number, y: number, size: number, op?: number) {
  return `<g transform="translate(${f(x)} ${f(y)}) scale(${f(size / 64)})"${op != null ? ` opacity="${op}"` : ''}>${badge(key)}</g>`
}

/** A tier badge on its own, for a row, a card or a header. */
export function tierBadge(key: TierKey, size = 64) {
  const t = TIERS.find(x => x.key === key) as Tier
  return svg(size, size, `${t.name} tier`, badgeAt(key, 0, 0, size))
}

// ------------------------------------------------------------------ pane chrome

/** The pane header: the CCSR mark, wordmark, one status line, your tier badge, a meander. */
export function banner(a: { sub: string; tier?: TierKey }) {
  const h = 86
  let s = `<g transform="translate(16 14)"><circle cx="20" cy="20" r="19" fill="${C.ink}" stroke="${C.bone}" stroke-width=".8"/><circle cx="20" cy="20" r="15.6" fill="none" stroke="${C.bone}" stroke-width=".9" stroke-dasharray="1.6 1.6"/><rect x="11" y="11.2" width="18" height="2.2" fill="${C.bone}"/><circle cx="13.6" cy="15.6" r="2.3" fill="none" stroke="${C.bone}" stroke-width="1"/><circle cx="26.4" cy="15.6" r="2.3" fill="none" stroke="${C.bone}" stroke-width="1"/><rect x="15.2" y="14.6" width="9.6" height="13" fill="${C.or}"/><path d="M17.6 15.2v12M20 15.2v12M22.4 15.2v12" stroke="${C.ink}" stroke-width=".8"/><rect x="13.4" y="27.6" width="13.2" height="2" fill="${C.bone}"/></g>`
  s += T(66, 36, 'CCSR', { s: 24, w: 700, c: C.bone, ls: 2 }) + T(66, 51, 'CLAUDE CODE SHIP RACE', { s: 8, c: C.stone, ls: 2 })
  const right = a.tier ? 406 : 464
  s += T(right, 30, a.sub, { s: 10.5, c: C.bone2, a: 'end' }) + T(right, 46, '{ ccsr.gg }', { s: 8.5, c: C.stone, a: 'end' })
  if (a.tier) s += badgeAt(a.tier, 420, 8, 40)
  s += `<rect x="0" y="${h - 16}" width="${W}" height="16" fill="${C.ink}"/>${meander(4, h - 15, W - 8, C.or)}`
  return svg(W, h, `CCSR. ${a.sub}`, s, C.ink2)
}

export type Tab = 'match' | 'ranked' | 'grind' | 'chat' | 'settings'
const TAB_ORDER: Tab[] = ['match', 'ranked', 'grind', 'chat', 'settings']

/** The architrave over the four tab buttons: the active cell in orange with a pointer. Lay the buttons out in four equal boxes under it. */
export function tabsTop(active: Tab) {
  const n = TAB_ORDER.length
  const cw = W / n
  let s = `<rect x="0" y="2" width="${W}" height="11" fill="${C.bone2}" stroke="${C.ink}" stroke-width=".8"/>`
  for (let i = 1; i < n; i++) s += `<rect x="${f(i * cw - 5)}" y="2" width="10" height="11" fill="${C.ink}"/><path d="M${f(i * cw - 2)} 3V12M${f(i * cw + 2)} 3V12" stroke="${C.bone2}" stroke-width="1"/>`
  TAB_ORDER.forEach((k, i) => {
    const x = i * cw
    if (k === active)
      s += `<rect x="${f(x + (i ? 5 : 0))}" y="2" width="${f(cw - (i ? 5 : 0) - (i < n - 1 ? 5 : 0))}" height="11" fill="${C.or}" stroke="${C.ink}" stroke-width=".8"/><path d="M${f(x + cw / 2 - 5)} 13L${f(x + cw / 2)} 18L${f(x + cw / 2 + 5)} 13Z" fill="${C.or}" stroke="${C.ink}" stroke-width=".8"/>`
    else s += `<path d="M${f(x + 14)} 7.5H${f(x + cw - 14)}" stroke="${C.ink}" stroke-width=".7" stroke-dasharray="2 3" opacity=".6"/>`
  })
  return svg(W, 19, `Tabs, ${active} open`, s)
}

/** The stylobate under the tab buttons, with an orange step under the active one. */
export function tabsBase(active: Tab) {
  const cw = W / TAB_ORDER.length
  let s = `<rect x="2" y="1" width="${W - 4}" height="4" fill="${C.paper}" stroke="${C.ink}" stroke-width=".7"/><rect x="0" y="5" width="${W}" height="4" fill="none" stroke="${C.ink}" stroke-width=".7" stroke-dasharray="3 2"/>`
  const i = TAB_ORDER.indexOf(active)
  s += `<rect x="${f(i * cw + 12)}" y="1" width="${f(cw - 24)}" height="4" fill="${C.or}"/>`
  return svg(W, 10, 'Tab base', s)
}

// ------------------------------------------------------------------ setup and home

/** First run: a blank medallion and the handle line. */
export function setupHero(a: { placementMatches: number }) {
  const id = idMaker()
  const start = TIERS[0]!
  let s = coinAt(id, { fill: 'none', line: C.ink, ghost: true, top: 'YOUR HANDLE HERE', bottom: 'CCSR · SOLO QUEUE', num: '?', numSize: 110, numY: 198, keys: 20 }, 92, 88, 72)
  s += T(186, 64, 'PICK A HANDLE.', { s: 21, w: 600, ls: -0.5 }) + T(186, 86, COPY.handle, { s: 12.5, c: C.stone2 })
  s += `<line x1="186" y1="104" x2="460" y2="104" stroke="${C.ink}" stroke-dasharray="3 4" stroke-opacity=".5"/>`
  s += T(186, 124, `{ ${TODO_COPY.mud.slice(0, -1).toLowerCase()} }`, { s: 9.5, c: C.stone2 })
  s += badgeAt(start.key, 186, 132, 30) + T(222, 152, start.name.toUpperCase(), { s: 9, w: 600, ls: 1.5 }) + T(222, 164, `PLACED AFTER ${a.placementMatches} MATCHES`, { s: 8, c: C.stone2, ls: 0.5 })
  s += binRow(350, 160, 120, 8, C.ink, 0.25)
  return svg(W, 176, `Pick a handle. ${COPY.handle}`, s, C.bone)
}

/** Your rating: the badge, the number, the bar to the next tier. */
export function ratingCard(a: { rating: number; rank?: number; wins: number; losses: number; placing?: Placing }) {
  if (a.placing) return placingCard(a.placing, a.wins, a.losses)
  const t = tierOf(a.rating)
  const nx = TIERS[tierIndex(t) + 1]
  let s = badgeAt(t.key, 18, 18, 96)
  s += T(132, 34, t.name.toUpperCase(), { s: 10, w: 600, ls: 2.4 }) + T(130, 78, a.rating, { s: 44, w: 300, ls: -2 }) + T(246, 78, 'ELO', { s: 9.5, c: C.stone2, ls: 1.5 })
  s += T(132, 96, `{ ${a.rank ? `#${a.rank} ranked · ` : ''}${a.wins}-${a.losses} }`, { s: 9.5, c: C.stone2 })
  if (nx) {
    const x0 = 132
    const x1 = 420
    const xp = x0 + (x1 - x0) * Math.max(0, Math.min(1, (a.rating - t.min) / (nx.min - t.min)))
    s += `<line x1="${x0}" y1="116" x2="${x1}" y2="116" stroke="${C.ink}" stroke-dasharray="3 3"/><line x1="${x0}" y1="116" x2="${f(xp)}" y2="116" stroke="${C.or}" stroke-width="4"/>`
    s += token(xp, 116, 6, true) + T(x0, 130, t.min, { s: 8, c: C.stone2 }) + T(x1, 130, nx.min, { s: 8, c: C.stone2, a: 'end' })
    s += badgeAt(nx.key, 428, 100, 32, 0.45) + T(x1, 108, `${nx.min - a.rating} TO ${nx.name.toUpperCase()}`, { s: 9, w: 600, c: C.or, a: 'end', ls: 1 })
  } else if (a.rank === 1) {
    s += `<line x1="132" y1="112" x2="462" y2="112" stroke="${C.or}" stroke-width="2"/>` + T(132, 126, COPY.numberOne.toUpperCase(), { s: 9, w: 700, c: C.or, ls: 1.2 })
  }
  return svg(W, 134, `${t.name} ${a.rating}${a.rank ? `, rank ${a.rank}` : ''}, ${a.wins}-${a.losses}${nx ? `, ${nx.min - a.rating} to ${nx.name}` : ''}`, s, C.bone)
}

/** The two lengths as plaques with a sundial each. Ticking happens on the buttons under it. */
/** The rating card while placing: Mud, the matches played as pips, no number yet. */
function placingCard(p: Placing, wins: number, losses: number) {
  let s = badgeAt('mud', 18, 18, 96)
  const big = `${p.played}/${p.of}`
  s += T(132, 34, 'MUD · PLACING', { s: 10, w: 600, ls: 2.4 }) + T(130, 78, big, { s: 44, w: 300, ls: -2 }) + T(138 + big.length * 26.4, 78, 'MATCHES', { s: 9.5, c: C.stone2, ls: 1.5 })
  s += T(132, 96, `{ ${wins}-${losses} · tier shows after match ${p.of} }`, { s: 9.5, c: C.stone2 })
  const x0 = 132
  const x1 = 400
  const seg = (x1 - x0) / p.of
  for (let i = 0; i < p.of; i++) {
    const a0 = x0 + i * seg + 3
    const a1 = x0 + (i + 1) * seg - 3
    s += i < p.played ? `<line x1="${f(a0)}" y1="116" x2="${f(a1)}" y2="116" stroke="${C.or}" stroke-width="4"/>` : `<line x1="${f(a0)}" y1="116" x2="${f(a1)}" y2="116" stroke="${C.ink}" stroke-dasharray="3 3"/>`
    s += T((a0 + a1) / 2, 130, `MATCH ${i + 1}`, { s: 7.5, c: C.stone2, a: 'middle', ls: 0.8 })
  }
  s += `<circle cx="438" cy="112" r="17" fill="none" stroke="${C.ink}" stroke-dasharray="2 3" stroke-opacity=".6"/>` + T(438, 118, '?', { s: 17, w: 300, a: 'middle', c: C.stone2 })
  s += T(x1, 106, `${p.of - p.played} TO GO`, { s: 9, w: 600, c: C.or, a: 'end', ls: 1 })
  return svg(W, 134, `Mud, placing: ${p.played} of ${p.of} matches played, ${wins}-${losses}.`, s, C.bone)
}

export type Lane = { hours: 1 | 3; ticked: boolean; wait: string; waiting: number }

/**
 * The top of the Match tab between matches: the call to queue, each length as a
 * lane on the stadion's starting line (the stone sill with its toe grooves, your
 * coin on it when that length is ticked), and the four steps of a match. The
 * length toggles and Queue sit right under it; an Svg takes no clicks.
 */
export function queueBar(a: { lanes: Lane[] }) {
  const anyTicked = a.lanes.some(l => l.ticked)
  const waiting = a.lanes.reduce((n, l) => n + l.waiting, 0)
  let s = T(18, 24, 'RANKED · SOLO QUEUE', { s: 9.5, c: C.stone2, ls: 2 }) + T(462, 24, `{ ${waiting} waiting now }`, { s: 9.5, a: 'end' })
  s += T(18, 58, COPY.queueUp.toUpperCase(), { s: 26, w: 600, ls: -0.5 }) + T(172, 58, COPY.queueUp2, { s: 13, c: C.stone2 })
  s += T(18, 78, COPY.lengths, { s: 10.5, c: C.stone2 })
  s += binRow(318, 64, 144, 8, C.ink, 0.2)
  s += `<line x1="18" y1="88" x2="462" y2="88" stroke="${C.ink}" stroke-opacity=".35" stroke-dasharray="3 4"/>` + T(430, 100, '{ the bell }', { s: 7.5, c: C.stone2, a: 'middle' })
  a.lanes.forEach((l, i) => {
    const y = 114 + i * 26
    s += `<rect x="18" y="${y - 9}" width="36" height="18" fill="${C.bone2}" stroke="${C.ink}" stroke-width=".8"/><path d="M29 ${y - 6}V${y + 6}M43 ${y - 6}V${y + 6}" stroke="${C.ink}" stroke-width="1.2"/>`
    s += l.ticked ? token(36, y, 7, true) : `<circle cx="36" cy="${y}" r="6.5" fill="${C.bone}" stroke="${C.stone2}" stroke-dasharray="2 2"/>`
    s += T(64, y + 5, `${l.hours}H`, { s: 15, w: 700, c: l.ticked ? C.ink : C.stone2 })
    s += T(102, y - 3, `${l.wait} · ${l.waiting} waiting`, { s: 8.5, c: l.ticked ? C.ink : C.stone2 })
    s += `<line x1="102" y1="${y + 3}" x2="424" y2="${y + 3}" stroke="${C.ink}" stroke-opacity="${l.ticked ? 0.75 : 0.25}" stroke-dasharray="2 4"/>`
    if (l.ticked) s += `<line x1="102" y1="${y + 3}" x2="168" y2="${y + 3}" stroke="${C.or}" stroke-width="3"/>`
    s += `<path d="M430 ${y - 8}V${y + 8}" stroke="${C.ink}" stroke-width="1.6"/><circle cx="430" cy="${y - 9}" r="2.2" fill="${C.ink}"/>`
    s += T(462, y + 4, l.ticked ? 'IN' : 'OFF', { s: 8, w: 700, c: l.ticked ? C.or : C.stone2, a: 'end', ls: 1 })
  })
  const y = 114 + a.lanes.length * 26 + 8
  const xs = [22, 140, 226, 338]
  const ends = [94, 177, 303]
  TODO_COPY.steps.forEach((label, i) => {
    const state = anyTicked ? (i === 0 ? 'done' : i === 1 ? 'now' : 'later') : i === 0 ? 'now' : 'later'
    const x = xs[i] ?? 0
    s += `<circle cx="${x}" cy="${y}" r="7" fill="${state === 'now' ? C.or : state === 'done' ? C.ink : 'none'}" stroke="${state === 'later' ? C.stone2 : C.ink}"${state === 'later' ? ' stroke-dasharray="2 2"' : ''}/>`
    s += T(x, y + 3, i + 1, { s: 8, w: 700, a: 'middle', c: state === 'done' ? C.bone : state === 'later' ? C.stone2 : C.ink })
    s += T(x + 11, y + 3, label.toUpperCase(), { s: 7.5, w: 600, c: state === 'later' ? C.stone2 : C.ink, ls: 0.6 })
    const e = ends[i]
    const nx = xs[i + 1]
    if (e != null && nx != null) s += `<line x1="${e + 5}" y1="${y}" x2="${nx - 9}" y2="${y}" stroke="${C.ink}" stroke-opacity=".35" stroke-dasharray="2 3"/>`
    if (state === 'now') s += `<path d="M${x - 4} ${y + 12}l4 4l4 -4" fill="none" stroke="${C.or}" stroke-width="1.6"/>`
  })
  const lanes = a.lanes.map(l => `${l.hours}h ${l.ticked ? 'ticked' : 'not ticked'}, ${l.wait}, ${l.waiting} waiting`).join('; ')
  return svg(W, y + 22, `${COPY.queueUp} ${COPY.queueUp2} ${lanes}. ${TODO_COPY.steps.join(', then ')}.`, s, C.bone)
}

export function lengthPlaques(rows: { hours: 1 | 3; ticked: boolean; wait: string; waiting: number }[]) {
  let s = ''
  rows.slice(0, 2).forEach((p, i) => {
    const x = 16 + i * 228
    s += `<path d="M${x} 22L${x + 108} 8L${x + 216} 22V108H${x}Z" fill="${p.ticked ? C.or : C.paper}" stroke="${C.ink}" stroke-width="1.1"/><path d="M${x + 6} 25L${x + 108} 13L${x + 210} 25V102H${x + 6}Z" fill="none" stroke="${C.ink}" stroke-width=".7" stroke-dasharray="2 2"/>`
    s += T(x + 20, 78, `${p.hours}H`, { s: 40, w: 300, ls: -2 })
    const cx = x + 168
    const cy = 74
    const r = 26
    const ae = PI + (p.hours / 3) * PI
    s += `<path d="M${cx - r} ${cy}A${r} ${r} 0 0 1 ${cx + r} ${cy}" fill="none" stroke="${C.ink}" stroke-width="1"/>`
    for (let k = 0; k <= 6; k++) {
      const a = PI + (k / 6) * PI
      s += `<line x1="${f(cx + r * Math.cos(a))}" y1="${f(cy + r * Math.sin(a))}" x2="${f(cx + (r - 4) * Math.cos(a))}" y2="${f(cy + (r - 4) * Math.sin(a))}" stroke="${C.ink}" stroke-width=".8"/>`
    }
    s += `<path d="M${cx} ${cy}L${cx - r} ${cy}A${r} ${r} 0 0 1 ${f(cx + r * Math.cos(ae))} ${f(cy + r * Math.sin(ae))}Z" fill="${p.ticked ? C.ink : C.or}" fill-opacity="${p.ticked ? 0.22 : 0.3}"/><line x1="${cx}" y1="${cy}" x2="${f(cx + (r - 3) * Math.cos(ae))}" y2="${f(cy + (r - 3) * Math.sin(ae))}" stroke="${C.ink}" stroke-width="2"/><circle cx="${cx}" cy="${cy}" r="2.5" fill="${C.ink}"/>`
    s += T(x + 20, 96, `${p.wait} · ${p.waiting} waiting`, { s: 9, op: 0.75 })
    if (p.ticked) s += T(x + 196, 40, 'TICKED', { s: 8, w: 700, a: 'end', ls: 1.5 })
  })
  return svg(W, 118, `Match lengths: ${rows.map(r => `${r.hours}h${r.ticked ? ' ticked' : ''}, ${r.waiting} waiting`).join('; ')}`, s)
}

export type RecentMatch = { day: string; result: 'won' | 'lost' | 'draw'; hours: number; mine: number; theirs: number; opponent: string; opponentRating: number; delta: number; series: { mine: number[]; theirs: number[] } }

/** Recent matches: result coin, length, score, opponent with badge, the race as two tiny lines, the Elo change. */
export function recentMatches(rows: RecentMatch[]) {
  let s = T(16, 20, 'RECENT', { s: 9.5, c: C.stone2, ls: 2 }) + T(464, 20, `{ last ${rows.length} }`, { s: 9, c: C.stone2, a: 'end' })
  rows.forEach((r, i) => {
    const y = 40 + i * 30
    const won = r.result === 'won'
    s += `<line x1="16" y1="${y - 12}" x2="464" y2="${y - 12}" stroke="${C.ink}" stroke-opacity=".14" stroke-dasharray="2 3"/>`
    s += T(16, y + 4, r.day.toUpperCase(), { s: 9, c: C.stone2, ls: 1 }) + token(58, y, 9, won, r.result === 'won' ? 'W' : r.result === 'lost' ? 'L' : 'D', !won)
    s += `<rect x="74" y="${y - 7}" width="24" height="14" fill="none" stroke="${C.ink}" stroke-width=".8"/>` + T(86, y + 3.5, hrs(r.hours), { s: 8.5, w: 600, a: 'middle' })
    s += T(108, y + 4.5, `${r.mine}-${r.theirs}`, { s: 12.5, w: 600 }) + badgeAt(tierOf(r.opponentRating).key, 160, y - 8, 16) + T(180, y + 4, `vs ${r.opponent}`, { s: 10 })
    const mx = Math.max(1, ...r.series.mine, ...r.series.theirs)
    for (const [pts, mine] of [[r.series.theirs, false], [r.series.mine, true]] as [number[], boolean][]) {
      const d = pts.map((v, ii) => `${ii ? 'L' : 'M'}${f(300 + (ii / Math.max(1, pts.length - 1)) * 96)} ${f(y + 8 - (v / mx) * 16)}`).join('')
      s += `<path d="${d}" fill="none" stroke="${mine ? C.or : C.ink}" stroke-width="${mine ? 1.8 : 1}"/>`
    }
    s += T(464, y + 4.5, `${r.delta > 0 ? '+' : ''}${r.delta}`, { s: 11, w: 700, c: won ? C.or : C.stone2, a: 'end' })
  })
  return svg(W, 34 + rows.length * 30, `Recent matches: ${rows.map(r => `${r.result} ${r.mine}-${r.theirs} vs ${r.opponent}`).join('; ')}`, s, C.bone)
}

// ------------------------------------------------------------------ queue and ready check

/**
 * The queue: timer, the lengths you ticked, a rating axis with your coin,
 * the window being searched, how it widens, and everyone waiting as dots.
 */
export function queue(a: {
  seconds: number
  hours: number[]
  rating: number
  range: number
  widens: { range: number; label: string }[]
  waiting: { hours: number; ratings: number[]; count: number }[]
}) {
  const lo = Math.floor((a.rating - 300) / 100) * 100
  const hi = lo + 600
  const X = (r: number) => 30 + ((Math.max(lo, Math.min(hi, r)) - lo) / 600) * 370
  const ay = 150
  const mm = Math.floor(a.seconds / 60)
  const ss = String(a.seconds % 60).padStart(2, '0')
  let s = T(18, 24, 'IN QUEUE', { s: 9.5, c: C.stone2, ls: 2 })
  a.hours.forEach((hr, i) => {
    const x = 418 - (a.hours.length - 1 - i) * 48
    s += `<rect x="${x}" y="12" width="40" height="18" fill="${C.or}" stroke="${C.ink}" stroke-width=".9"/>` + T(x + 20, 25, `${hr}H`, { s: 10, w: 700, a: 'middle' })
  })
  s += T(16, 74, `${mm}:${ss}`, { s: 46, w: 300, ls: -2 }) + T(140, 60, `{ searching ${a.rating} ±${a.range} }`, { s: 10 }) + T(140, 74, 'the window widens the longer you wait', { s: 9, c: C.stone2 })
  for (const g of [...a.widens].sort((p, q) => q.range - p.range)) {
    const l = X(a.rating - g.range)
    const r = X(a.rating + g.range)
    s += `<path d="M${f(l)} ${ay - 20}V${ay + 10}M${f(r)} ${ay - 20}V${ay + 10}M${f(l)} ${ay - 20}H${f(l + 6)}M${f(r)} ${ay - 20}H${f(r - 6)}" stroke="${C.stone2}" stroke-dasharray="2 3" fill="none"/>` + T(r, ay - 24, g.label.toUpperCase(), { s: 7.5, c: C.stone2, a: 'end', ls: 1 })
  }
  const l0 = X(a.rating - a.range)
  const r0 = X(a.rating + a.range)
  s += `<rect x="${f(l0)}" y="${ay - 16}" width="${f(r0 - l0)}" height="24" fill="${C.or}" fill-opacity=".22"/><path d="M${f(l0 + 6)} ${ay - 16}H${f(l0)}V${ay + 8}H${f(l0 + 6)}M${f(r0 - 6)} ${ay - 16}H${f(r0)}V${ay + 8}H${f(r0 - 6)}" stroke="${C.or}" stroke-width="2" fill="none"/>`
  s += `<line x1="30" y1="${ay}" x2="400" y2="${ay}" stroke="${C.ink}"/>`
  for (let r = lo; r <= hi; r += 50) s += `<line x1="${f(X(r))}" y1="${ay}" x2="${f(X(r))}" y2="${ay + (r % 100 ? 3 : 6)}" stroke="${C.ink}"/>` + (r % 100 === 0 ? T(X(r), ay + 16, r, { s: 8, c: C.stone2, a: 'middle' }) : '')
  for (const t of TIERS) if (t.min > lo && t.min < hi) s += `<line x1="${f(X(t.min))}" x2="${f(X(t.min))}" y1="${ay - 46}" y2="${ay}" stroke="${C.stone2}" stroke-opacity=".5" stroke-dasharray="1 3"/>` + badgeAt(t.key, X(t.min) - 6, ay - 60, 12, 0.8)
  s += token(X(a.rating), ay - 4, 8, true)
  a.waiting.slice(0, 2).forEach((row, i) => {
    const y = ay + 40 + i * 16
    s += T(16, y + 3, `${row.hours}H`, { s: 8.5, w: 600 }) + T(464, y + 3, `${row.count} WAITING`, { s: 8, c: C.stone2, a: 'end', ls: 1 })
    for (const v of row.ratings) {
      if (v < lo || v > hi) continue
      const inside = Math.abs(v - a.rating) <= a.range
      s += `<circle cx="${f(X(v))}" cy="${y}" r="3.4" fill="${inside ? C.or : 'none'}" stroke="${C.ink}" stroke-width=".9"/>`
    }
  })
  return svg(W, 228, `In queue for ${a.hours.map(h => `${h}h`).join(' and ')}, ${mm}:${ss}, searching ${a.rating} plus or minus ${a.range}`, s, C.bone)
}

export type Player = { handle: string; rating: number; wins: number; losses: number; rank: number; placing?: Placing }

/** The ready check: two medallions facing each other, the draining ring, the stakes. */
export function readyCheck(a: { hours: number; seconds: number; me: Player; them: Player; stakes: { win: number; draw: number; loss: number } }) {
  const id = idMaker()
  const top = (p: Player) => (p.placing ? `${p.handle.toUpperCase()} · MUD · PLACING` : `${p.handle.toUpperCase()} · ${tierOf(p.rating).name.toUpperCase()} ${p.rating}`)
  const bottom = (p: Player) => (p.placing ? `${p.placing.played} OF ${p.placing.of} · ${p.wins}-${p.losses}` : `${p.wins}-${p.losses} · RANK ${p.rank}`)
  let s = T(18, 24, `OPPONENT FOUND · RANKED ${a.hours}H`, { s: 9.5, c: C.stone2, ls: 2 })
  s += coinAt(id, { fill: C.or, line: C.ink, bust: C.ink, top: top(a.me), bottom: bottom(a.me), fs: 14 }, 104, 124, 84)
  s += coinAt(id, { fill: C.ink2, line: C.bone, bust: C.bone, flip: true, ring: true, top: top(a.them), bottom: bottom(a.them), fs: 14 }, 376, 124, 84)
  s += `<circle cx="240" cy="124" r="26" fill="${C.paper}" stroke="${C.ink}" stroke-dasharray="2 3"/>${ring(240, 124, 26, a.seconds / 60, C.or, 5)}`
  s += T(240, 129, `0:${String(a.seconds).padStart(2, '0')}`, { s: 14, w: 700, a: 'middle' }) + T(240, 170, 'TO ACCEPT', { s: 8, c: C.stone2, a: 'middle', ls: 1.5 })
  ;([['WIN', a.stakes.win, true], ['DRAW', a.stakes.draw, false], ['LOSS', a.stakes.loss, false]] as [string, number, boolean][]).forEach(([lab, v, hot], i) => {
    const x = 96 + i * 100
    s += `<rect x="${x}" y="218" width="88" height="24" fill="${hot ? C.or : 'none'}" stroke="${C.ink}" stroke-width=".9"/>` + T(x + 10, 234, lab, { s: 8.5, w: 600, ls: 1.5 }) + T(x + 80, 235, `${v > 0 ? '+' : ''}${v}`, { s: 12, w: 700, a: 'end' })
  })
  return svg(W, 252, `Opponent found: ${a.them.handle}, ${tierOf(a.them.rating).name} ${a.them.rating}. ${a.seconds} seconds to accept. Win ${a.stakes.win}, draw ${a.stakes.draw}, loss ${a.stakes.loss}.`, s, C.bone)
}

// ------------------------------------------------------------------ the live race

export type Craft = 'clean' | 'neutral' | 'sloppy'
export type RaceCommit = { t: number; points: number; craft?: Craft }
export type RaceSide = { handle: string; commits: RaceCommit[] }

/**
 * A race at one moment. `t` and `now` are minutes since the start.
 * `waiting` is points scored here but not sent yet (offline);
 * `theirsAsOf` freezes the opponent's line at the last good poll.
 */
export type Race = { hours: number; now: number; me: RaceSide; them: RaceSide; hot?: boolean; waiting?: number; theirsAsOf?: number; mode?: string }

function total(cs: RaceCommit[], at: number) {
  return cs.filter(c => c.t <= at).reduce((n, c) => n + c.points, 0)
}

function steps(cs: RaceCommit[], at: number) {
  const out: [number, number][] = [[0, 0]]
  let c = 0
  for (const e of [...cs].filter(x => x.t <= at).sort((p, q) => p.t - q.t)) {
    c += e.points
    out.push([e.t, c])
  }
  out.push([at, c])
  return out
}

function stepPath(ser: [number, number][], X: (t: number) => number, Y: (p: number) => number) {
  const [t0, p0] = ser[0] ?? [0, 0]
  let d = `M${f(X(t0))} ${f(Y(p0))}`
  for (const [t, p] of ser.slice(1)) d += `H${f(X(t))}V${f(Y(p))}`
  return d
}

function hms(min: number) {
  const s = Math.max(0, Math.round(min * 60))
  return `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

function raceTotals(r: Race) {
  const asOf = r.theirsAsOf ?? r.now
  return { mine: total(r.me.commits, r.now) + (r.waiting ?? 0), theirs: total(r.them.commits, asOf), asOf }
}

/** Points scale for the chart: a multiple of 10 above the likely finish, at least 30. */
function scaleFor(r: Race) {
  const len = r.hours * 60
  const { mine, theirs } = raceTotals(r)
  const pace = r.now > 0 ? (Math.max(mine, theirs) / r.now) * len : 0
  return Math.max(30, Math.ceil((Math.max(mine, theirs, Math.min(pace, Math.max(mine, theirs) * 2)) * 1.1) / 10) * 10)
}

function raceHead(r: Race) {
  const { mine, theirs } = raceTotals(r)
  const len = r.hours * 60
  let s = T(18, 22, `${r.mode ?? 'RANKED'} · ${hrs(r.hours)}`, { s: 9.5, c: C.stone2, ls: 2 })
  s += T(462, 30, hms(len - r.now), { s: 22, w: 600, c: r.hot ? C.or : C.ink, a: 'end' }) + T(462, 42, 'TO THE BELL', { s: 7.5, c: C.stone2, a: 'end', ls: 1.5 })
  s += T(18, 42, `{ ${r.me.handle} }`, { s: 9.5 }) + T(18, 80, mine, { s: 38, w: 300, c: C.or, ls: -2 })
  const x2 = 18 + String(mine).length * 23 + 34
  s += T(x2 - 18, 74, ':', { s: 24, c: C.stone2 }) + T(x2, 42, `{ ${r.them.handle} }`, { s: 9.5, c: C.stone2 }) + T(x2, 80, theirs, { s: 38, w: 300, ls: -2 })
  const d = mine - theirs
  const bx = x2 + String(theirs).length * 23 + 18
  const chip = d > 0 ? `UP ${d}` : d < 0 ? `DOWN ${-d}` : 'LEVEL'
  s += `<rect x="${bx}" y="58" width="${14 + chip.length * 6.4}" height="18" fill="${d > 0 ? C.or : d < 0 ? C.ink : 'none'}" stroke="${C.ink}" stroke-width=".9"/>` + T(bx + 7, 71, chip, { s: 9, w: 700, c: d < 0 ? C.bone : C.ink, ls: 1 })
  return s
}

function chartFrame(r: Race, x0: number, x1: number, base: number, top: number, maxP: number) {
  const len = r.hours * 60
  const X = (t: number) => x0 + (t / len) * (x1 - x0)
  const Y = (p: number) => base - (p / maxP) * (base - top)
  let s = ''
  const step = maxP > 60 ? 20 : 10
  for (let p = step; p <= maxP; p += step) s += `<line x1="${x0}" x2="${x1}" y1="${f(Y(p))}" y2="${f(Y(p))}" stroke="${C.ink}" stroke-opacity=".1" stroke-dasharray="2 4"/>` + T(x0 - 6, Y(p) + 3, `{${p}}`, { s: 7.5, c: C.stone2, a: 'end' })
  const tick = r.hours > 1 ? 15 : 5
  for (let t = tick; t < len; t += tick) s += `<line x1="${f(X(t))}" x2="${f(X(t))}" y1="${base - (t % 60 ? 3 : 6)}" y2="${base}" stroke="${C.ink}" stroke-opacity=".5"/>`
  if (r.now < len) s += binRow(X(r.now) + 6, base - 5, x1 - X(r.now) - 10, 7, C.ink, 0.18)
  s += `<line x1="${f(X(len))}" x2="${f(X(len))}" y1="${top - 8}" y2="${base}" stroke="${r.hot ? C.or : C.ink}" stroke-opacity="${r.hot ? 1 : 0.55}" stroke-width="${r.hot ? 2 : 1}" stroke-dasharray="1 4"/>` + (X(r.now) + 72 < X(len) - 62 || r.now >= len ? T(X(len), top - 12, '{ the bell }', { s: 8.5, c: r.hot ? C.or : C.stone2, a: 'end' }) : '')
  s += stylobate(x0, base, x1 - x0, C.ink, 2)
  const marks = r.hours > 1 ? Array.from({ length: r.hours + 1 }, (_, i) => [i * 60, `${i}h`] as [number, string]) : [0, 15, 30, 45, 60].map(m => [m, m === 60 ? '1h' : `${m}m`] as [number, string])
  for (const [m, lab] of marks) s += T(X(m), base + 22, lab, { s: 8.5, c: C.stone2, a: 'middle' })
  return { s, X, Y }
}

function nowTag(X: (t: number) => number, now: number, top: number, base: number) {
  const nx = X(now)
  const tx = nx + 72 > 476 ? nx - 72 : nx
  return `<line x1="${f(nx)}" x2="${f(nx)}" y1="${top - 2}" y2="${base}" stroke="${C.or}" stroke-width="1.4" stroke-dasharray="4 3"/><rect x="${f(tx)}" y="${top - 16}" width="72" height="14" fill="${C.or}"/>` + T(tx + 5, top - 6, `now ${hms(now)}`, { s: 8.5, w: 600 })
}

/** The live match graphic (Jaen's pick, 2026-10-07): both lines climb a points-by-hours chart in steps, with pace lines to the bell. */
export function raceClimb(r: Race) {
  const len = r.hours * 60
  const { mine, theirs, asOf } = raceTotals(r)
  const maxP = scaleFor(r)
  const F = chartFrame(r, 36, 452, 236, 110, maxP)
  const { X, Y } = F
  let s = raceHead(r) + F.s
  const sj = steps(r.me.commits, r.now)
  if (r.waiting) sj.push([r.now, mine])
  const sk = steps(r.them.commits, asOf)
  s += `<path d="${stepPath(sj, X, Y)}V${f(Y(0))}H${f(X(0))}Z" fill="${C.or}" fill-opacity=".13"/>`
  s += `<path d="${stepPath(sk, X, Y)}" fill="none" stroke="${C.ink}" stroke-width="1.6"${r.theirsAsOf != null ? ' stroke-opacity=".55"' : ''}/><path d="${stepPath(sj, X, Y)}" fill="none" stroke="${C.or}" stroke-width="2.8"/>`
  for (const c of r.them.commits.filter(x => x.t <= asOf)) {
    const v = total(r.them.commits, c.t)
    s += `<circle cx="${f(X(c.t))}" cy="${f(Y(v))}" r="2.4" fill="${C.bone}" stroke="${C.ink}"/>`
    if (c.points >= 8) s += T(X(c.t) + 4, Y(v) + 12, `+${c.points}${c.craft === 'clean' ? ' ▲' : ''}`, { s: 8, c: C.stone2 })
  }
  for (const c of r.me.commits.filter(x => x.t <= r.now)) {
    const v = total(r.me.commits, c.t)
    s += `<circle cx="${f(X(c.t))}" cy="${f(Y(v))}" r="3" fill="${C.or}" stroke="${C.ink}" stroke-width=".9"/>`
    if (c.points >= 8 && !(r.waiting && X(r.now) - X(c.t) < 70)) s += T(X(c.t) - 4, Y(v) - 6, `+${c.points}${c.craft === 'clean' ? ' ▲' : ''}`, { s: 8.5, w: 700, c: C.or, a: 'end' })
  }
  if (r.waiting) s += `<circle cx="${f(X(r.now))}" cy="${f(Y(mine))}" r="3.4" fill="none" stroke="${C.or}" stroke-width="1.4" stroke-dasharray="2 1.5"/>` + T(X(r.now) - 6, Y(mine) - 6, `+${r.waiting} waiting`, { s: 8, c: C.or, a: 'end' })
  if (r.now > 0 && r.now < len) {
    if (len - r.now > len * 0.12) for (const [v, col] of [[mine, C.or], [theirs, C.stone2]] as [number, string][]) {
      const pj = Math.round((v / r.now) * len)
      s += `<line x1="${f(X(r.now))}" y1="${f(Y(v))}" x2="${f(X(len))}" y2="${f(Y(Math.min(pj, maxP)))}" stroke="${col}" stroke-dasharray="1.5 3"/>` + T(X(len) - 4, Y(Math.min(pj, maxP)) - 4, `{~${pj}}`, { s: 8, c: col, a: 'end' })
    }
    s += nowTag(X, r.now, 110, 236)
  }
  s += token(X(r.now), Y(mine), 6.5, true) + token(X(r.now), Y(theirs), 6.5, false)
  return svg(W, 272, `${r.me.handle} ${mine}, ${r.them.handle} ${theirs}, ${hms(len - r.now)} to the bell`, s, C.bone)
}

/** Not picked (2026-10-07), kept for the record; the mod doesn't draw it. The landing page's colonnade, paired fluted columns every 20 minutes (every 10 in a 1h match). */
export function raceColonnade(r: Race) {
  const len = r.hours * 60
  const { mine, theirs, asOf } = raceTotals(r)
  const maxP = scaleFor(r)
  const F = chartFrame(r, 36, 452, 236, 110, maxP)
  const { X, Y } = F
  let s = raceHead(r) + F.s
  const every = r.hours > 1 ? 20 : 10
  const snaps: number[] = []
  for (let t = every; t <= len; t += every) if (t <= r.now) snaps.push(t)
  if (r.now > 0 && snaps[snaps.length - 1] !== r.now) snaps.push(r.now)
  const cw = 11
  snaps.forEach((t, idx) => {
    const last = idx === snaps.length - 1
    const pair: [number, number, string][] = [
      [X(t) - cw - 1, total(r.me.commits, t) + (last ? r.waiting ?? 0 : 0), C.or],
      [X(t) + 1, total(r.them.commits, Math.min(t, asOf)), C.bone2],
    ]
    pair.forEach(([x, v, fill], j) => {
      if (v <= 0) return
      const y = Y(v)
      s += `<rect x="${f(x)}" y="${f(y)}" width="${cw}" height="${f(236 - y)}" fill="${fill}" stroke="${C.ink}" stroke-width=".8"/>`
      for (const q of [0.33, 0.66]) s += `<line x1="${f(x + cw * q)}" x2="${f(x + cw * q)}" y1="${f(y + 4)}" y2="235" stroke="${C.ink}" stroke-opacity=".4"/>`
      s += `<rect x="${f(x - 1.5)}" y="${f(y - 3)}" width="${cw + 3}" height="3" fill="${C.ink}"/>`
      if (last) s += T(x + cw / 2, y - 7, v, { s: 9.5, w: 700, c: j ? C.ink : C.or, a: 'middle' })
    })
  })
  for (let t = Math.ceil((r.now + 1) / every) * every; t <= len; t += every) s += `<rect x="${f(X(t) - cw - 1)}" y="231" width="${cw * 2 + 2}" height="5" fill="none" stroke="${C.ink}" stroke-opacity=".4" stroke-dasharray="2 2"/>`
  if (r.now < len) s += nowTag(X, r.now, 110, 236)
  return svg(W, 272, `${r.me.handle} ${mine}, ${r.them.handle} ${theirs}, ${hms(len - r.now)} to the bell`, s, C.bone)
}

/** Not picked (2026-10-07), kept for the record; the mod doesn't draw it. One lead line, orange above the axis when you lead, ink below when they do. */
export function raceTug(r: Race) {
  const len = r.hours * 60
  const { mine, theirs, asOf } = raceTotals(r)
  const id = idMaker()
  const x0 = 36
  const x1 = 452
  const mid = 176
  const amp = 52
  const ev: [number, number][] = [...r.me.commits.filter(c => c.t <= r.now).map(c => [c.t, c.points] as [number, number]), ...r.them.commits.filter(c => c.t <= asOf).map(c => [c.t, -c.points] as [number, number])].sort((p, q) => p[0] - q[0])
  let lead = 0
  const ser: [number, number][] = [[0, 0]]
  for (const e of ev) {
    lead += e[1]
    ser.push([e[0], lead])
  }
  const cl = lead + (r.waiting ?? 0)
  ser.push([r.now, cl])
  const span = Math.max(10, Math.ceil(Math.max(...ser.map(p => Math.abs(p[1]))) / 5) * 5)
  const X = (t: number) => x0 + (t / len) * (x1 - x0)
  const Y = (l: number) => mid - (Math.max(-span, Math.min(span, l)) / span) * amp
  let s = raceHead(r)
  for (const l of [-span, -span / 2, span / 2, span]) s += `<line x1="${x0}" x2="${x1}" y1="${f(Y(l))}" y2="${f(Y(l))}" stroke="${C.ink}" stroke-opacity=".1" stroke-dasharray="2 4"/>` + T(x0 - 6, Y(l) + 3, `${l > 0 ? '+' : ''}${l}`, { s: 7.5, c: C.stone2, a: 'end' })
  const d = stepPath(ser, X, Y)
  const area = `${d}V${mid}H${f(X(0))}Z`
  const up = id('up')
  const dn = id('dn')
  s += `<defs><clipPath id="${up}"><rect x="0" y="0" width="${W}" height="${mid}"/></clipPath><clipPath id="${dn}"><rect x="0" y="${mid}" width="${W}" height="${272 - mid}"/></clipPath></defs>`
  s += `<path d="${area}" fill="${C.or}" fill-opacity=".5" clip-path="url(#${up})"/><path d="${area}" fill="${C.ink}" fill-opacity=".55" clip-path="url(#${dn})"/>`
  s += `<line x1="${x0}" x2="${x1}" y1="${mid}" y2="${mid}" stroke="${C.ink}" stroke-width="1.2"/><path d="${d}" fill="none" stroke="${C.ink}" stroke-width="1.6"/>`
  s += T(x0 + 4, mid - amp - 6, `↑ ${r.me.handle.toUpperCase()} LEADS`, { s: 8, w: 600, c: C.or, ls: 1 }) + T(x0 + 4, mid + amp + 14, `↓ ${r.them.handle.toUpperCase()} LEADS`, { s: 8, w: 600, c: C.stone2, ls: 1 })
  s += `<line x1="${f(X(len))}" x2="${f(X(len))}" y1="${mid - amp - 10}" y2="${mid + amp + 6}" stroke="${r.hot ? C.or : C.ink}" stroke-opacity="${r.hot ? 1 : 0.55}" stroke-dasharray="1 4"/>` + T(X(len), mid - amp - 14, '{ the bell }', { s: 8.5, c: r.hot ? C.or : C.stone2, a: 'end' })
  const marks = r.hours > 1 ? Array.from({ length: r.hours + 1 }, (_, i) => [i * 60, `${i}h`] as [number, string]) : [0, 15, 30, 45, 60].map(m => [m, m === 60 ? '1h' : `${m}m`] as [number, string])
  for (const [m, lab] of marks) s += T(X(m), 258, lab, { s: 8.5, c: C.stone2, a: 'middle' })
  if (r.now < len) s += `<line x1="${f(X(r.now))}" x2="${f(X(r.now))}" y1="${mid - amp - 8}" y2="${mid + amp + 8}" stroke="${C.or}" stroke-width="1.4" stroke-dasharray="4 3"/>`
  s += `<circle cx="${f(X(r.now))}" cy="${f(Y(cl))}" r="5" fill="${cl >= 0 ? C.or : C.ink}" stroke="${C.ink}"/>` + T(Math.min(X(r.now) + 9, 430), Y(cl) + (cl >= 0 ? -6 : 14), `${cl > 0 ? '+' : ''}${cl}`, { s: 13, w: 700, c: cl >= 0 ? C.or : C.ink })
  return svg(W, 272, `${cl >= 0 ? r.me.handle : r.them.handle} up ${Math.abs(cl)}, ${mine} to ${theirs}, ${hms(len - r.now)} to the bell`, s, C.bone)
}

export type FeedRow = { at: string; mine: boolean; handle: string; points: number; craft: Craft; category: string; title?: string | null; files: number; lines: number; note?: string }

/** The match feed, newest first: coins, point pills, craft marks, file blocks for private titles, lead changes. */
export function feed(rows: FeedRow[], o: { flashFirst?: boolean } = {}) {
  let s = T(16, 18, 'FEED', { s: 9.5, c: C.stone2, ls: 2 }) + T(464, 18, '{ newest first }', { s: 8.5, c: C.stone2, a: 'end' })
  rows.forEach((e, i) => {
    const y = 38 + i * 26
    if (i === 0 && o.flashFirst) s += `<rect x="8" y="${y - 11}" width="464" height="22" fill="${C.or}" fill-opacity=".14"/>`
    s += `<line x1="16" y1="${y + 12}" x2="464" y2="${y + 12}" stroke="${C.ink}" stroke-opacity=".1" stroke-dasharray="2 3"/>`
    s += T(16, y + 3.5, e.at, { s: 9, c: C.stone2 }) + token(58, y, 7, e.mine, e.handle.slice(0, 1).toUpperCase())
    s += T(72, y + 3.5, e.handle.length > 12 ? e.handle.slice(0, 11) + '…' : e.handle, { s: 9.5, c: e.mine ? C.ink : C.stone2 })
    s += `<rect x="140" y="${y - 7.5}" width="30" height="15" fill="${e.mine ? C.or : C.ink}"/>` + T(155, y + 3.5, `+${e.points}`, { s: 9.5, w: 700, c: e.mine ? C.ink : C.bone, a: 'middle' })
    if (e.craft === 'clean') s += T(176, y + 3.5, '▲', { s: 8, c: C.or })
    if (e.craft === 'sloppy') s += T(176, y + 3.5, '▼', { s: 8, c: C.stone2 })
    s += T(188, y + 3.5, e.category.toUpperCase(), { s: 7.5, c: C.stone2, ls: 1 })
    const noteW = e.note ? (e.note.length + 4) * 4.9 + 10 : 0
    const room = Math.min(37, Math.floor((464 - noteW - 244) / 5.8))
    if (e.title) s += T(244, y + 3.5, e.title.length > room ? e.title.slice(0, room - 1) + '…' : e.title, { s: 9.5, c: e.mine ? C.ink : C.stone2 })
    else if (e.files > 0) {
      for (let q = 0; q < Math.min(9, e.files); q++) s += `<rect x="${244 + q * 6}" y="${y - 3}" width="4" height="6" fill="none" stroke="${C.stone2}" stroke-width=".8"/>`
      s += T(302, y + 3.5, `${e.files} file${e.files === 1 ? '' : 's'} · ${e.lines} lines`, { s: 8.5, c: C.stone2 })
    }
    if (e.note) s += T(464, y + 3.5, `{ ${e.note} }`, { s: 8, c: C.or, a: 'end' })
  })
  return svg(W, 28 + rows.length * 26, `Feed: ${rows.map(r => `${r.handle} +${r.points} ${r.category}`).join('; ')}`, s, C.bone)
}

/** The result: a wreath around the Elo change, the final score, the whole race with the last ten minutes marked. */
export function result(a: { outcome: 'won' | 'lost' | 'draw'; race: Race; delta: number; ratingBefore: number; ratingAfter: number; commits: { mine: number; theirs: number }; biggest: { points: number; craft: Craft }; mode?: string; placing?: Placing & { placedIn?: TierKey } }) {
  const r = a.race
  const len = r.hours * 60
  const mine = total(r.me.commits, len)
  const theirs = total(r.them.commits, len)
  const won = a.outcome === 'won'
  const label = a.outcome === 'won' ? 'VICTORY' : a.outcome === 'lost' ? 'LOSS' : 'DRAW'
  let s = wreath(104, 112, 74, C.ink, won ? C.or : C.stone, 11)
  s += T(104, 86, `{ ${r.me.handle} }`, { s: 9.5, c: C.stone2, a: 'middle' }) + T(104, 128, `${a.delta > 0 ? '+' : ''}${a.delta}`, { s: 44, w: 300, c: won ? C.or : C.ink, a: 'middle', ls: -2 }) + T(104, 146, 'ELO', { s: 9, a: 'middle', ls: 1.5 })
  s += T(204, 40, `${label} · ${a.mode ?? 'RANKED'} ${hrs(r.hours)}`, { s: 10, w: 700, c: won ? C.or : C.stone2, ls: 2 })
  const xs = 204 + String(mine).length * 27
  s += T(204, 90, mine, { s: 44, w: 300, c: C.or, ls: -2 }) + T(xs + 4, 84, ':', { s: 26, c: C.stone2 }) + T(xs + 22, 90, theirs, { s: 44, w: 300, ls: -2 })
  s += T(204, 110, `{ ${a.outcome === 'won' ? `${r.me.handle} beat ${r.them.handle}` : a.outcome === 'lost' ? `${r.them.handle} beat ${r.me.handle}` : 'no diff'} }`, { s: 9.5 })
  s += T(204, 128, `${a.commits.mine} commits to ${a.commits.theirs} · biggest +${a.biggest.points}${a.biggest.craft === 'clean' ? ' ▲' : ''}`, { s: 9, c: C.stone2 })
  const pl = a.placing
  const placedTier = pl?.placedIn ? TIERS.find(t => t.key === pl.placedIn) : undefined
  const tb = pl ? (placedTier ?? TIERS[0]!) : tierOf(a.ratingAfter)
  const line = pl ? (placedTier ? `PLACED IN ${placedTier.name.toUpperCase()}` : `MUD · PLACING ${pl.played} OF ${pl.of}`) : `${a.ratingBefore} → ${a.ratingAfter} · ${tb.name}`
  s += T(204, 146, line, { s: 10, w: 600, c: placedTier ? C.or : C.ink, ls: pl ? 1 : 0 }) + badgeAt(tb.key, 412, 24, 48)
  const x0 = 20
  const x1 = 460
  const base = 236
  const top = 196
  const maxP = Math.max(10, mine, theirs)
  const X = (t: number) => x0 + (t / len) * (x1 - x0)
  const Y = (p: number) => base - (p / maxP) * (base - top)
  s += `<line x1="${x0}" x2="${x1}" y1="${base}" y2="${base}" stroke="${C.ink}"/>` + T(204, 190, 'THE WHOLE RACE', { s: 7.5, c: C.stone2, ls: 1.5 })
  s += `<path d="${stepPath(steps(r.them.commits, len), X, Y)}" fill="none" stroke="${C.ink}" stroke-width="1.2"/><path d="${stepPath(steps(r.me.commits, len), X, Y)}" fill="none" stroke="${C.or}" stroke-width="2.2"/>`
  if (len > 20) s += `<line x1="${f(X(len - 10))}" x2="${f(X(len - 10))}" y1="${top}" y2="${base}" stroke="${C.stone2}" stroke-dasharray="1 3"/>` + T(X(len - 10) - 3, top - 6, '{ last 10 min }', { s: 7.5, c: C.stone2, a: 'end' })
  for (let hr = 0; hr <= r.hours; hr++) s += T(X(hr * 60), base + 13, `${hr}h`, { s: 7.5, c: C.stone2, a: 'middle' })
  return svg(W, 262, `${label}: ${r.me.handle} ${mine}, ${r.them.handle} ${theirs}. Elo ${a.delta > 0 ? 'plus' : 'minus'} ${Math.abs(a.delta)} to ${a.ratingAfter}.`, s, C.bone)
}

/** Offline: a broken column, what waits to send, the retry ring. */
export function offline(a: { since: string; waiting: { count: number; points: number; category: string; title?: string }; retryIn: number; retryOf: number }) {
  let s = `<g transform="translate(22 18)"><rect x="0" y="58" width="44" height="6" fill="${C.ink}"/><rect x="8" y="34" width="28" height="24" fill="${C.bone2}" stroke="${C.ink}"/><path d="M17 35V57M27 35V57" stroke="${C.ink}" stroke-width=".6"/><g transform="rotate(-14 22 22)"><rect x="9" y="8" width="28" height="20" fill="${C.bone2}" stroke="${C.ink}" stroke-dasharray="3 2"/><path d="M18 9V27M28 9V27" stroke="${C.ink}" stroke-width=".6"/></g><path d="M6 31l6 2l5-3l6 3l6-2l6 3l7-2" stroke="${C.or}" stroke-width="1.6" fill="none"/></g>`
  s += T(88, 30, `{ offline since ${a.since} }`, { s: 9.5, c: C.stone2 }) + T(88, 58, `${a.waiting.count} SCORE${a.waiting.count === 1 ? '' : 'S'} WAITING`, { s: 20, w: 300, ls: -0.5 })
  s += T(88, 78, `+${a.waiting.points} ${a.waiting.category}${a.waiting.title ? ` · ${a.waiting.title}` : ''}`, { s: 9.5 }) + T(88, 92, 'the clock keeps running on the server', { s: 8.5, c: C.stone2 })
  s += `<circle cx="432" cy="52" r="22" fill="none" stroke="${C.ink}" stroke-dasharray="2 3"/>${ring(432, 52, 22, 1 - a.retryIn / a.retryOf, C.or, 4)}` + T(432, 57, `${a.retryIn}s`, { s: 13, w: 700, a: 'middle' }) + T(432, 90, 'RETRY', { s: 7.5, c: C.stone2, a: 'middle', ls: 1.5 })
  return svg(W, 104, `Offline since ${a.since}. ${a.waiting.count} waiting to send. Retrying in ${a.retryIn} seconds.`, s, C.bone)
}

// ------------------------------------------------------------------ boards

/** The #1 card, shared with ccsr.gg's homepage. The roast comes from the approved pool in docs/copy.md, already filled. */
export function numberOne(a: { handle: string; rating: number; wins: number; losses: number; roast: string }) {
  const id = idMaker()
  const t = tierOf(a.rating)
  let s = coinAt(id, { fill: C.or, line: C.ink, bust: C.ink, top: `${a.handle.toUpperCase()} · ${t.name.toUpperCase()} ${a.rating}`, bottom: '#1 · RANKED · WORLD', fs: 14 }, 92, 98, 78)
  s += T(188, 30, COPY.numberOne.toUpperCase(), { s: 8.5, w: 600, c: C.or, ls: 1.2 }) + T(188, 64, a.handle, { s: 26, w: 600, c: C.bone, ls: -0.5 })
  s += T(188, 84, `${a.handle} · ${t.name} · ${a.rating} Elo · ${a.wins}-${a.losses}`, { s: 9.5, c: C.stone })
  s += `<line x1="188" y1="98" x2="462" y2="98" stroke="${C.bone}" stroke-opacity=".3" stroke-dasharray="3 4"/>`
  // two lines of at most 30 characters, split on a word
  const words = a.roast.split(' ')
  const lines = ['', '', '']
  let li = 0
  for (const wd of words) {
    if ((lines[li] + ' ' + wd).trim().length > 30 && li < 2) li++
    lines[li] = (lines[li] + ' ' + wd).trim()
  }
  lines.filter(Boolean).forEach((ln, i) => (s += T(188, 120 + i * 18, ln, { s: 12.5, c: C.bone })))
  s += badgeAt(t.key, 420, 124, 44) + `<rect x="0" y="190" width="${W}" height="16" fill="${C.ink}"/>${meander(4, 191, W - 8, C.or)}`
  return svg(W, 206, `${COPY.numberOne}: ${a.handle}, ${t.name}, ${a.rating} Elo, ${a.wins}-${a.losses}. ${a.roast}`, s, C.ink2)
}

/** The tiers graphic (Jaen's pick, 2026-10-07): all eight badges on one frieze, yours ringed with progress, an Elo ruler under it. */
export function tierFrieze(a: { handle: string; rating: number; placing?: Placing }) {
  const pl = a.placing
  const cur = pl ? TIERS[0]! : tierOf(a.rating)
  const ci = tierIndex(cur)
  const nx = TIERS[ci + 1]
  let s = T(16, 20, 'TIERS', { s: 9.5, c: C.stone2, ls: 2 }) + T(464, 20, pl ? `{ ${a.handle}, placing ${pl.played} of ${pl.of} }` : `{ ${a.handle}, ${cur.name} ${a.rating} }`, { s: 9.5, a: 'end' })
  s += `<rect x="8" y="30" width="464" height="74" fill="${C.paper}" stroke="${C.ink}" stroke-width=".8"/>`
  for (let i = 1; i < 8; i++) s += `<path d="M${8 + i * 58} 30V104" stroke="${C.ink}" stroke-width=".7" stroke-dasharray="2 3"/>`
  TIERS.forEach((t, i) => {
    const cx = 37 + i * 58
    const earned = i <= ci
    const isCur = i === ci
    const sz = isCur ? 50 : 36
    if (isCur) {
      s += `<rect x="${8 + i * 58}" y="30" width="58" height="74" fill="${C.or}" fill-opacity=".16"/><circle cx="${cx}" cy="67" r="29" fill="none" stroke="${C.ink}" stroke-opacity=".25"/>`
      s += ring(cx, 67, 29, pl ? pl.played / pl.of : nx ? (a.rating - t.min) / (nx.min - t.min) : 1, C.or, 3)
    }
    s += badgeAt(t.key, cx - sz / 2, 67 - sz / 2, sz, earned ? undefined : 0.3)
    if (!earned) s += `<circle cx="${cx}" cy="67" r="20" fill="none" stroke="${C.ink}" stroke-dasharray="2 3" stroke-opacity=".4"/>`
    s += T(cx, 122, t.name.toUpperCase(), { s: 8, w: isCur ? 700 : 500, c: isCur ? C.or : earned ? C.ink : C.stone2, a: 'middle', ls: 0.8 })
    s += T(cx, 134, `${t.min}+`, { s: 7.5, c: C.stone2, a: 'middle' })
  })
  const X = (r: number) => {
    const t = tierOf(r)
    const i = tierIndex(t)
    const n2 = TIERS[i + 1]
    const hi = n2 ? n2.min : t.min + 200
    return 8 + i * 58 + Math.min(1, (r - t.min) / (hi - t.min)) * 58
  }
  const me = pl ? 8 + 58 * Math.max(0.08, pl.played / pl.of) : X(a.rating)
  s += `<line x1="8" y1="152" x2="472" y2="152" stroke="${C.ink}"/><line x1="8" y1="152" x2="${f(me)}" y2="152" stroke="${C.or}" stroke-width="4"/>`
  for (let j = 0; j <= 8; j++) s += `<line x1="${8 + j * 58}" y1="148" x2="${8 + j * 58}" y2="156" stroke="${C.ink}"/>`
  s += token(me, 152, 7, true)
  if (pl) s += T(8, 172, `placing ${pl.played} of ${pl.of} · tier shows after match ${pl.of}`, { s: 9, w: 600, c: C.or })
  else if (nx) {
    const nxX = 8 + (ci + 1) * 58
    s += `<path d="M${f(X(a.rating) + 9)} 166H${nxX - 2}" stroke="${C.or}" stroke-dasharray="2 2"/>` + T(nxX + 40, 170, `${nx.min - a.rating} to ${nx.name}`, { s: 9, w: 600, c: C.or, a: 'end' })
  }
  return svg(W, 184, `Tiers from ${TIERS[0]!.name} to Master. ${a.handle} is ${pl ? `placing, ${pl.played} of ${pl.of}` : `${cur.name} at ${a.rating}${nx ? `, ${nx.min - a.rating} to ${nx.name}` : ''}`}.`, s, C.bone)
}

/** Not picked (2026-10-07), kept for the record; the mod doesn't draw it. A gauge with eight arcs, each with its badge, and a needle on your rating. */
export function tierDial(a: { rating: number }) {
  const cx = 240
  const cy = 196
  const R = 158
  const r0 = 96
  const cur = tierOf(a.rating)
  const ci = tierIndex(cur)
  const nx = TIERS[ci + 1]
  let s = T(16, 20, 'TIERS', { s: 9.5, c: C.stone2, ls: 2 })
  TIERS.forEach((t, i) => {
    const a0 = PI + (i / 8) * PI
    const a1 = PI + ((i + 1) / 8) * PI
    s += `<path d="M${f(cx + R * Math.cos(a0))} ${f(cy + R * Math.sin(a0))}A${R} ${R} 0 0 1 ${f(cx + R * Math.cos(a1))} ${f(cy + R * Math.sin(a1))}L${f(cx + r0 * Math.cos(a1))} ${f(cy + r0 * Math.sin(a1))}A${r0} ${r0} 0 0 0 ${f(cx + r0 * Math.cos(a0))} ${f(cy + r0 * Math.sin(a0))}Z" fill="${t.fill}" fill-opacity="${i <= ci ? 0.9 : 0.32}" stroke="${C.ink}" stroke-width="${i === ci ? 1.8 : 0.8}"/>`
    const am = (a0 + a1) / 2
    s += badgeAt(t.key, cx + (R - 30) * Math.cos(am) - 14, cy + (R - 30) * Math.sin(am) - 14, 28)
    if (t.min) s += T(cx + (r0 - 12) * Math.cos(am), cy + (r0 - 12) * Math.sin(am) + 3, t.min, { s: 7.5, c: C.stone2, a: 'middle' })
  })
  for (let k = 0; k <= 48; k++) {
    const ang = PI + (k / 48) * PI
    const r1 = k % 6 === 0 ? R + 8 : R + 4
    s += `<line x1="${f(cx + R * Math.cos(ang))}" y1="${f(cy + R * Math.sin(ang))}" x2="${f(cx + r1 * Math.cos(ang))}" y2="${f(cy + r1 * Math.sin(ang))}" stroke="${C.ink}" stroke-opacity="${k % 6 === 0 ? 0.8 : 0.35}"/>`
  }
  const hi = nx ? nx.min : cur.min + 200
  const ga = PI + ((ci + Math.min(1, (a.rating - cur.min) / (hi - cur.min))) / 8) * PI
  s += `<path d="M${f(cx + (R - 10) * Math.cos(ga))} ${f(cy + (R - 10) * Math.sin(ga))}L${f(cx + (R + 14) * Math.cos(ga))} ${f(cy + (R + 14) * Math.sin(ga))}" stroke="${C.or}" stroke-width="3"/><circle cx="${f(cx + (R + 14) * Math.cos(ga))}" cy="${f(cy + (R + 14) * Math.sin(ga))}" r="4" fill="${C.or}" stroke="${C.ink}"/>`
  s += T(cx, cy - 30, a.rating, { s: 34, w: 300, a: 'middle', ls: -2 }) + T(cx, cy - 12, `${cur.name.toUpperCase()}${nx ? ` · ${nx.min - a.rating} TO ${nx.name.toUpperCase()}` : ''}`, { s: 8.5, w: 600, c: C.or, a: 'middle', ls: 1 })
  return svg(W, 230, `Tier dial: ${cur.name} ${a.rating}`, s, C.bone)
}

export type LadderRow = { rank: number; handle: string; rating: number; wins: number; losses: number; me?: boolean } | null

/** The ladder's top rows and yours, with badges and the top-100 laurel. A null row draws the gap. */
export function ladder(rows: LadderRow[]) {
  let s = T(16, 20, 'TOP 10', { s: 9.5, c: C.stone2, ls: 2 }) + T(16, 34, COPY.top10, { s: 9.5 })
  rows.forEach((r, i) => {
    const y = 54 + i * 26
    if (!r) {
      s += T(240, y + 4, '···', { s: 12, c: C.stone2, a: 'middle' })
      return
    }
    const t = tierOf(r.rating)
    if (r.me) s += `<rect x="8" y="${y - 12}" width="464" height="24" fill="${C.or}" fill-opacity=".16"/>`
    s += `<line x1="16" y1="${y + 12}" x2="464" y2="${y + 12}" stroke="${C.ink}" stroke-opacity=".1" stroke-dasharray="2 3"/>`
    s += T(16, y + 4, String(r.rank).padStart(2, '0'), { s: 10, c: C.stone2 }) + badgeAt(t.key, 42, y - 10, 20)
    const name = r.handle.length > 15 ? r.handle.slice(0, 14) + '…' : r.handle
    s += T(70, y + 4, name, { s: 11, w: r.me ? 700 : 500, c: r.me ? C.or : C.ink })
    if (r.rank <= 100) s += laurel(70 + name.length * 6.7 + 4, y - 7, 13, r.me ? C.or : C.stone2)
    s += T(270, y + 4, t.name, { s: 9.5, c: C.stone2 }) + T(400, y + 4, r.rating, { s: 11, w: 600, a: 'end' }) + T(464, y + 4, `${r.wins}-${r.losses}`, { s: 9.5, c: C.stone2, a: 'end' })
  })
  return svg(W, 46 + rows.length * 26, `Ranked ladder: ${rows.filter(Boolean).map(r => `${r!.rank} ${r!.handle} ${r!.rating}`).join('; ')}`, s, C.bone)
}

/** The Grind: this week's points, rank, and a fluted column per day, today in orange. */
export function grind(a: { points: number; commits: number; rank?: number; of?: number; caption?: string; days: { label: string; points: number; today: boolean }[] }) {
  let s = T(16, 22, 'THE GRIND', { s: 9.5, c: C.stone2, ls: 2 }) + T(16, 36, COPY.grind, { s: 9 })
  s += T(14, 96, a.points, { s: 48, w: 300, ls: -2 }) + T(16, 114, a.caption ?? 'PTS THIS WEEK', { s: 8.5, c: C.stone2, ls: 1.5 })
  if (a.rank) s += T(16, 134, `{ #${a.rank} of ${(a.of ?? 0).toLocaleString('en-US')} }`, { s: 10, w: 600, c: C.or })
  s += T(16, 150, `${a.commits} commits`, { s: 9, c: C.stone2 })
  const mx = Math.max(1, ...a.days.map(d => d.points))
  const per = Math.max(1, Math.ceil(mx / 10))
  const base = 210
  const x0 = 176
  const cw = 30
  const gap = (W - x0 - 16 - 7 * cw) / 6
  s += T(16, 170, `1 drum = ${per} pts`, { s: 8.5, c: C.stone2 }) + T(16, 184, 'week resets monday', { s: 8.5, c: C.stone2 })
  a.days.slice(0, 7).forEach((d, i) => {
    const x = x0 + i * (cw + gap)
    const n = d.points > 0 ? Math.max(1, Math.round(d.points / per)) : 0
    let y = base
    if (!n) s += `<rect x="${x - 3}" y="${base - 4}" width="${cw + 6}" height="4" fill="none" stroke="${C.ink}" stroke-opacity=".4" stroke-dasharray="2 2"/>`
    for (let j = 0; j < n; j++) {
      y -= 12
      s += `<rect x="${f(x)}" y="${y + 1}" width="${cw}" height="11" fill="${d.today ? C.or : C.bone2}" stroke="${C.ink}" stroke-width=".8"/>`
      for (let k = 1; k < 5; k++) {
        const lx = x + cw * (0.5 - 0.5 * Math.cos((k / 5) * PI))
        s += `<line x1="${f(lx)}" x2="${f(lx)}" y1="${y + 2}" y2="${y + 11}" stroke="${C.ink}" stroke-opacity=".38"/>`
      }
    }
    if (n) s += `<path d="M${f(x + 2)} ${y + 1}L${f(x + cw - 2)} ${y + 1}L${f(x + cw + 3)} ${y - 4}L${f(x - 3)} ${y - 4}Z" fill="${C.bone}" stroke="${C.ink}" stroke-width=".8"/><rect x="${f(x - 5)}" y="${y - 8}" width="${cw + 10}" height="4" fill="${d.today ? C.or : C.ink}"/>` + T(x + cw / 2, y - 12, d.points, { s: 10, w: 700, c: d.today ? C.or : C.ink, a: 'middle' })
    s += T(x + cw / 2, base + 16, d.label.toUpperCase(), { s: 8, c: d.today ? C.or : C.stone2, a: 'middle', ls: 1 })
  })
  s += stylobate(x0, base, W - x0 - 16, C.ink, 2)
  return svg(W, 250, `The Grind: ${a.points} points ${(a.caption ?? 'this week').toLowerCase().replace(/^pts /, '')} from ${a.commits} commits${a.rank ? `, #${a.rank} of ${a.of}` : ''}`, s, C.bone)
}

export type CommitRow = { points: number; craft: Craft; category: string; title: string; repo: string; added: number; deleted: number; files: number; note?: string }

/** Your scored commits: point pill, craft tag, title, repo and size, and the judge's word for a 0 or a 1. */
export function commitList(rows: CommitRow[]) {
  let s = T(16, 14, 'SCORED COMMITS', { s: 9, c: C.stone2, ls: 2 })
  rows.forEach((r, i) => {
    const y = 34 + i * 34
    const pill = r.points >= 8 ? C.or : r.points === 0 ? 'none' : C.ink
    s += `<rect x="16" y="${y - 9}" width="30" height="15" fill="${pill}" stroke="${C.ink}" stroke-width=".8"/>` + T(31, y + 2, `+${r.points}`, { s: 9.5, w: 700, c: pill === C.ink ? C.bone : C.ink, a: 'middle' })
    let x = 54
    if (r.craft !== 'neutral') {
      const clean = r.craft === 'clean'
      const label = clean ? '▲ CLEAN +1' : '▼ SLOPPY -1'
      const cw = 8 + label.length * 5.2
      s += `<rect x="54" y="${y - 8}" width="${f(cw)}" height="13" fill="none" stroke="${clean ? C.or : C.stone2}" stroke-width=".9"/>` + T(58, y + 2, label, { s: 7.5, w: 600, c: clean ? C.or : C.stone2, ls: 0.5 })
      x = Math.ceil(54 + cw + 8)
    }
    const room = Math.floor((420 - x) / 6.4)
    s += T(x, y + 2, r.title.length > room ? r.title.slice(0, room - 1) + '…' : r.title, { s: 10.5, w: 500 }) + T(464, y + 2, r.category.toUpperCase(), { s: 7.5, c: C.stone2, a: 'end', ls: 1 })
    const meta = `${r.repo} · +${r.added} -${r.deleted} in ${r.files} file${r.files === 1 ? '' : 's'}${r.note ? ` · ${r.note}` : ''}`
    s += T(54, y + 16, meta.length > 78 ? meta.slice(0, 77) + '…' : meta, { s: 8.5, c: C.stone2 })
    s += `<line x1="16" y1="${y + 22}" x2="464" y2="${y + 22}" stroke="${C.ink}" stroke-opacity=".1" stroke-dasharray="2 3"/>`
  })
  return svg(W, 20 + rows.length * 34, `Scored commits: ${rows.map(r => `+${r.points} ${r.title}`).join('; ')}`, s, C.bone)
}

// ------------------------------------------------------------------ transcript and band

/** The pill on the Bash row that ran git commit. `scoring` while the judge runs. */
export function commitBadge(a: { points: number; category: string; craft: Craft; where: 'grind' | 'match' | 'waiting' | 'scoring' }) {
  const w = 196
  const wait = a.where === 'waiting' || a.where === 'scoring'
  let s = `<rect x=".5" y=".5" width="${w - 1}" height="21" rx="11" fill="${C.paper}" stroke="${C.ink}" stroke-width=".8"${wait ? ' stroke-dasharray="2 2"' : ''}/>`
  if (a.where === 'scoring') s += token(11, 11, 9, false, '', true) + T(26, 14.5, 'SCORING', { s: 8, w: 600, ls: 0.8, c: C.stone2 })
  else {
    s += token(11, 11, 9, !wait, '', wait) + T(11, 14.5, a.points, { s: 9.5, w: 700, a: 'middle' }) + T(26, 14.5, a.category.toUpperCase(), { s: 8, w: 600, ls: 0.8 })
    if (a.craft === 'clean') s += T(76, 14.5, '▲ CLEAN +1', { s: 7.5, w: 600, c: C.or })
    if (a.craft === 'sloppy') s += T(76, 14.5, '▼ SLOPPY -1', { s: 7.5, w: 600, c: C.stone2 })
  }
  s += T(w - 9, 14.5, a.where.toUpperCase(), { s: 7.5, w: 600, c: wait ? C.or : C.stone2, a: 'end', ls: 1 })
  return svg(w, 22, a.where === 'scoring' ? 'Scoring this commit' : `+${a.points} ${a.category}${a.craft !== 'neutral' ? `, ${a.craft}` : ''}, ${a.where}`, s)
}

/** The /ccsr last scorecard. Its text reaches Claude, so it carries scores and handles only. */
export function scorecard(a: { outcome: 'won' | 'lost' | 'draw'; hours: number; me: string; them: string; mine: number; theirs: number; commits: { mine: number; theirs: number }; delta: number; ratingBefore: number; ratingAfter: number; placing?: Placing & { placedIn?: TierKey } }) {
  const won = a.outcome === 'won'
  const label = won ? 'VICTORY' : a.outcome === 'lost' ? 'LOSS' : 'DRAW'
  const pl = a.placing
  const t = pl ? (TIERS.find(x => x.key === pl.placedIn) ?? TIERS[0]!) : tierOf(a.ratingAfter)
  let s = wreath(62, 60, 42, C.ink, won ? C.or : C.stone, 8) + T(62, 68, `${a.delta > 0 ? '+' : ''}${a.delta}`, { s: 22, w: 300, c: won ? C.or : C.ink, a: 'middle', ls: -1 })
  s += T(124, 30, `CCSR · RANKED ${a.hours}H · ${label}`, { s: 9, w: 700, c: won ? C.or : C.stone2, ls: 1.5 })
  const xs = 124 + String(a.mine).length * 21
  s += T(124, 70, a.mine, { s: 34, w: 300, c: C.or, ls: -1.5 }) + T(xs + 2, 66, ':', { s: 20, c: C.stone2 }) + T(xs + 16, 70, a.theirs, { s: 34, w: 300, ls: -1.5 })
  s += T(xs + 16 + String(a.theirs).length * 21 + 16, 52, won ? `${a.me} beat ${a.them}` : a.outcome === 'lost' ? `${a.them} beat ${a.me}` : `${a.me} and ${a.them}, level`, { s: 10 }) + T(xs + 16 + String(a.theirs).length * 21 + 16, 68, `${a.commits.mine} commits to ${a.commits.theirs}`, { s: 9, c: C.stone2 })
  s += T(124, 96, pl ? (pl.placedIn ? `Placed in ${t.name}` : `Mud · placing ${pl.played} of ${pl.of}`) : `Elo ${a.ratingBefore} → ${a.ratingAfter} (${a.delta > 0 ? '+' : ''}${a.delta}) · ${t.name}`, { s: 10, w: 600, c: pl?.placedIn ? C.or : C.ink }) + badgeAt(t.key, 420, 30, 40)
  return svg(W, 120, `${label}: ${a.me} ${a.mine}, ${a.them} ${a.theirs}. Elo ${a.ratingBefore} to ${a.ratingAfter}.`, s, C.bone)
}

/** Band strips: a 300 by 36 graphic at the left of the band; the line of text and the buttons sit beside it. */
export type Strip =
  | { kind: 'setup' }
  | { kind: 'grind'; points: number; category: string; craft: Craft; week: number; rank?: number }
  | { kind: 'queue'; seconds: number; hours: number[]; rating: number; range: number }
  | { kind: 'found'; me: string; them: string; theirRating: number; seconds: number }
  | { kind: 'race'; race: Race; offlineAgo?: string; mode?: string }
  | { kind: 'result'; mode?: string; outcome: 'won' | 'lost' | 'draw'; hours: number; delta: number; ratingBefore: number; ratingAfter: number; mine: number; theirs: number; placing?: Placing & { placedIn?: TierKey } }

export function bandStrip(a: Strip) {
  const w = 300
  const h = 36
  let bg = C.paper
  let s = ''
  let alt = ''
  if (a.kind === 'setup') {
    s += token(18, 18, 11, false, '?', true) + T(36, 15, 'PICK A HANDLE', { s: 9.5, w: 700, ls: 1 }) + T(36, 28, '{ solo queue for claude code }', { s: 8, c: C.stone2 })
    alt = 'Pick a handle'
  } else if (a.kind === 'grind') {
    let y = 30
    for (let j = 0; j < 3; j++) {
      s += `<rect x="10" y="${y - 8}" width="18" height="7" fill="${C.or}" stroke="${C.ink}" stroke-width=".6"/>`
      y -= 8
    }
    s += `<rect x="7" y="${y - 1}" width="24" height="3" fill="${C.ink}"/>` + T(38, 23, `+${a.points}`, { s: 17, w: 300, c: C.or })
    s += T(70, 15, `${a.category.toUpperCase()}${a.craft === 'clean' ? ' · ▲ CLEAN' : a.craft === 'sloppy' ? ' · ▼ SLOPPY' : ''}`, { s: 8, w: 600, ls: 0.6 }) + T(70, 28, `GRIND ${a.week}${a.rank ? ` · #${a.rank}` : ''}`, { s: 8.5, c: C.stone2 })
    alt = `+${a.points} ${a.category}, Grind ${a.week}${a.rank ? `, rank ${a.rank}` : ''}`
  } else if (a.kind === 'queue') {
    const t = `${Math.floor(a.seconds / 60)}:${String(a.seconds % 60).padStart(2, '0')}`
    s += `<circle cx="16" cy="18" r="6" fill="${C.or}"/><circle cx="16" cy="18" r="10" fill="none" stroke="${C.or}" stroke-dasharray="2 2"/>` + T(32, 25, t, { s: 18, w: 300 }) + T(84, 15, 'IN QUEUE', { s: 8, w: 700, ls: 1 }) + T(84, 28, `${a.rating} ±${a.range}`, { s: 8.5, c: C.stone2 })
    a.hours.forEach((hr, i) => (s += `<rect x="${176 + i * 30}" y="10" width="26" height="16" fill="${C.or}" stroke="${C.ink}" stroke-width=".8"/>` + T(189 + i * 30, 22, `${hr}H`, { s: 9, w: 700, a: 'middle' })))
    alt = `In queue ${t}`
  } else if (a.kind === 'found') {
    bg = C.or
    s += token(16, 18, 10, false, a.me.slice(0, 1).toUpperCase()) + T(31, 22, 'vs', { s: 9 }) + token(56, 18, 10, false, a.them.slice(0, 1).toUpperCase()) + T(76, 15, 'OPPONENT FOUND', { s: 8.5, w: 700, ls: 1 }) + T(76, 28, `${a.them} · ${tierOf(a.theirRating).name} ${a.theirRating}`, { s: 8.5 })
    s += `<circle cx="276" cy="18" r="13" fill="${C.paper}" stroke="${C.ink}" stroke-dasharray="2 2"/>${ring(276, 18, 13, a.seconds / 60, C.ink, 3)}` + T(276, 21.5, a.seconds, { s: 9, w: 700, a: 'middle' })
    alt = `Opponent found: ${a.them}. ${a.seconds} seconds to accept.`
  } else if (a.kind === 'race') {
    const r = a.race
    const { mine, theirs, asOf } = raceTotals(r)
    const len = r.hours * 60
    if (r.hot) bg = C.or
    s += token(14, 18, 9, !r.hot) + T(28, 25, mine, { s: 18, w: 300, c: r.hot ? C.ink : C.or }) + T(28 + String(mine).length * 11 + 4, 23, ':', { s: 12, c: C.stone2 }) + T(28 + String(mine).length * 11 + 12, 25, theirs, { s: 18, w: 300 })
    const x0 = 96
    const x1 = 196
    const maxP = Math.max(10, mine, theirs)
    const X = (t: number) => x0 + (t / len) * (x1 - x0)
    const Y = (p: number) => 30 - (p / maxP) * 24
    s += `<line x1="${x0}" y1="30" x2="${x1}" y2="30" stroke="${C.ink}" stroke-opacity=".4"/><line x1="${x1}" y1="4" x2="${x1}" y2="30" stroke="${C.ink}" stroke-dasharray="1 2"/>`
    s += `<path d="${stepPath(steps(r.them.commits, asOf), X, Y)}" fill="none" stroke="${C.ink}" stroke-width="1"/><path d="${stepPath(steps(r.me.commits, r.now), X, Y)}" fill="none" stroke="${r.hot ? C.ink : C.or}" stroke-width="1.8"/>`
    const d = mine - theirs
    s += T(292, 17, hms(len - r.now), { s: r.hot ? 13 : 11, w: 700, a: 'end', c: a.offlineAgo ? C.stone2 : C.ink }) + T(292, 29, a.offlineAgo ? `{ ${a.offlineAgo} ago }` : r.hot ? (d < 0 ? `DOWN ${-d}` : d > 0 ? `UP ${d}` : 'LEVEL') : `${a.mode ?? 'RANKED'} ${hrs(r.hours)}`, { s: 7.5, w: 600, a: 'end', c: r.hot ? C.ink : C.stone2, ls: 1 })
    alt = `${mine} to ${theirs}, ${hms(len - r.now)} to the bell`
  } else {
    const won = a.outcome === 'won'
    s += wreath(18, 19, 13, C.ink, won ? C.or : C.stone, 5) + T(18, 23, `${a.delta > 0 ? '+' : ''}${a.delta}`, { s: 8, w: 700, a: 'middle', c: won ? C.or : C.ink })
    s += T(40, 15, won ? 'VICTORY' : a.outcome === 'lost' ? 'LOSS' : 'DRAW', { s: 9, w: 700, c: won ? C.or : C.stone2, ls: 1.5 }) + T(40, 28, a.placing ? (a.placing.placedIn ? `PLACED · ${(TIERS.find(t => t.key === a.placing?.placedIn) ?? TIERS[0]!).name.toUpperCase()}` : `PLACING ${a.placing.played}/${a.placing.of}`) : `${a.ratingBefore} → ${a.ratingAfter}`, { s: 8.5, c: a.placing?.placedIn ? C.or : C.stone2 })
    s += T(150, 26, a.mine, { s: 18, w: 300, c: C.or }) + T(150 + String(a.mine).length * 11 + 4, 24, ':', { s: 12, c: C.stone2 }) + T(150 + String(a.mine).length * 11 + 12, 26, a.theirs, { s: 18, w: 300 }) + T(292, 23, `${a.mode ?? 'RANKED'} ${hrs(a.hours)}`, { s: 7.5, w: 600, a: 'end', c: C.stone2, ls: 1 })
    alt = `${won ? 'Victory' : a.outcome === 'lost' ? 'Loss' : 'Draw'}, ${a.mine} to ${a.theirs}`
  }
  return svg(w, h, alt, s, bg, { rx: 8, flat: true })
}

// ------------------------------------------------------------------ chat

export type RoomKey = 'world' | TierKey
export type Room = { key: RoomKey; online: number; open: boolean }
export type ChatMsg = { at: string; handle: string; tier: TierKey; rank?: number; text: string; mine?: boolean; system?: boolean }

const roomName = (k: RoomKey) => (k === 'world' ? 'World' : (TIERS.find(t => t.key === k)?.name ?? k))
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

function globe(cx: number, cy: number, r: number, col: string) {
  return `<circle cx="${f(cx)}" cy="${f(cy)}" r="${r}" fill="none" stroke="${col}" stroke-width="1.2"/><ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(r * 0.45)}" ry="${r}" fill="none" stroke="${col}" stroke-width=".8"/><path d="M${f(cx - r)} ${f(cy)}H${f(cx + r)}M${f(cx - r * 0.86)} ${f(cy - r * 0.5)}H${f(cx + r * 0.86)}M${f(cx - r * 0.86)} ${f(cy + r * 0.5)}H${f(cx + r * 0.86)}" stroke="${col}" stroke-width=".7"/>`
}

function lock(x: number, y: number) {
  return `<path d="M${f(x - 3)} ${f(y - 2)}v-2.5a3 3 0 0 1 6 0v2.5" fill="none" stroke="${C.ink}" stroke-width="1.2"/><rect x="${f(x - 4.5)}" y="${f(y - 2)}" width="9" height="7" fill="${C.ink}"/>`
}

/** The chat rooms as a frieze: World and one room per tier, online counts under each. Yours lit in orange; rooms you can't enter ghosted with a lock. */
export function chatRooms(a: { rooms: Room[]; current: RoomKey }) {
  const cur = a.rooms.find(r => r.key === a.current)
  const cw = 464 / Math.max(1, a.rooms.length)
  let s = T(16, 20, 'CHAT', { s: 9.5, c: C.stone2, ls: 2 }) + T(464, 20, `{ ${thousands(cur?.online ?? 0)} online in ${roomName(a.current)} }`, { s: 9.5, a: 'end' })
  s += `<rect x="8" y="30" width="464" height="64" fill="${C.paper}" stroke="${C.ink}" stroke-width=".8"/>`
  a.rooms.forEach((r, i) => {
    const x = 8 + i * cw
    const cx = x + cw / 2
    const isCur = r.key === a.current
    if (i) s += `<path d="M${f(x)} 30V94" stroke="${C.ink}" stroke-width=".6" stroke-dasharray="2 3"/>`
    if (isCur) s += `<rect x="${f(x)}" y="30" width="${f(cw)}" height="64" fill="${C.or}" fill-opacity=".16"/><path d="M${f(x + 6)} 92.5H${f(x + cw - 6)}" stroke="${C.or}" stroke-width="3"/>`
    s += r.key === 'world' ? globe(cx, 56, 12, r.open ? C.ink : C.stone2) : badgeAt(r.key, cx - 13, 43, 26, r.open ? undefined : 0.3)
    if (!r.open) s += lock(cx + 10, 66)
    s += T(cx, 84, roomName(r.key).toUpperCase(), { s: 7, w: isCur ? 700 : 500, c: isCur ? C.or : r.open ? C.ink : C.stone2, a: 'middle', ls: 0.5 })
    s += T(cx, 107, thousands(r.online), { s: 7.5, c: C.stone2, a: 'middle' })
  })
  const open = a.rooms.filter(r => r.open).map(r => roomName(r.key))
  return svg(W, 114, `Chat rooms. You're in ${roomName(a.current)}, ${thousands(cur?.online ?? 0)} online. Open to you: ${open.join(', ')}.`, s, C.bone)
}

function wrapText(text: string, max: number) {
  const lines: string[] = []
  let cur = ''
  for (const word0 of text.split(/\s+/).filter(Boolean)) {
    let word = word0
    while (word.length > max) {
      if (cur) lines.push(cur)
      cur = ''
      lines.push(word.slice(0, max))
      word = word.slice(max)
    }
    if (!cur) cur = word
    else if (cur.length + 1 + word.length <= max) cur += ` ${word}`
    else {
      lines.push(cur)
      cur = word
    }
  }
  if (cur) lines.push(cur)
  return lines.length ? lines : ['']
}

/** A room's messages, oldest first: a coin, the tier badge and the handle over each message; yours on an orange wash, a mention of you marked at the edge. */
export function chatLog(a: { me: string; messages: ChatMsg[] }) {
  if (!a.messages.length) return svg(W, 52, 'No messages yet.', T(240, 31, `{ ${TODO_COPY.quiet} }`, { s: 9.5, c: C.stone2, a: 'middle' }), C.bone)
  const me = a.me.toLowerCase()
  let y = 8
  let s = ''
  for (const m of a.messages) {
    if (m.system) {
      s += T(240, y + 13, `{ ${m.text} }`, { s: 8.5, c: C.stone2, a: 'middle' })
      y += 22
      continue
    }
    const lines = wrapText(m.text, 62)
    const h = 22 + lines.length * 14 + 6
    const mention = !m.mine && m.text.toLowerCase().split(/[^a-z0-9_]+/).includes(me)
    if (m.mine) s += `<rect x="6" y="${y}" width="468" height="${h - 4}" fill="${C.or}" fill-opacity=".1"/>`
    if (mention) s += `<rect x="6" y="${y}" width="3" height="${h - 4}" fill="${C.or}"/>`
    s += token(22, y + 13, 9, !!m.mine, m.handle.slice(0, 1).toUpperCase())
    s += badgeAt(m.tier, 36, y + 5, 16)
    s += T(58, y + 16, m.handle, { s: 10, w: 700, c: m.mine ? C.or : C.ink })
    let hx = 58 + m.handle.length * 6.1 + 8
    if (m.rank === 1) {
      s += `<rect x="${f(hx)}" y="${y + 6}" width="24" height="13" fill="none" stroke="${C.or}"/>` + T(hx + 12, y + 16, '#1', { s: 8, w: 700, c: C.or, a: 'middle' })
      hx += 32
    }
    s += T(hx, y + 16, m.at, { s: 8, c: C.stone2 })
    lines.forEach((l, i) => {
      s += T(58, y + 32 + i * 14, l, { s: 10 })
    })
    s += `<line x1="16" y1="${y + h - 2}" x2="464" y2="${y + h - 2}" stroke="${C.ink}" stroke-opacity=".1" stroke-dasharray="2 3"/>`
    y += h
  }
  const alt = a.messages.filter(m => !m.system).map(m => `${m.handle}: ${m.text}`).join('; ')
  return svg(W, y + 6, `Chat. ${alt}`.slice(0, 2000), s, C.bone)
}
