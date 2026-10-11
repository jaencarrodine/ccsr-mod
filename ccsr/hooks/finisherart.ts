// Custom finisher art (W10d): the one allowlist that checks, sanitizes and freezes a player's SVG.
//
// Pure, no imports. This file is the source of truth: server/src/finisherart.ts and
// web/lib/finisherart.ts are verbatim copies under one header line (scripts/check-svg-copies.sh
// diffs them). The server refuses an upload with it, and the mod and the site re-run `sanitize`
// before they draw, so a copy that drifted would be caught by CI, not by a player.
//
// The rule is an allowlist: what this file doesn't name is refused, and when unsure it refuses.
// Nothing from the input reaches the output as written. The input is parsed into a tree, every
// element, attribute and CSS declaration is checked, and a canonical document is written from the
// tree, so sanitize(sanitize(x)) === sanitize(x). Animations come out as longhands with
// `animation-fill-mode: both`, which is what lets freezeArt hold any frame, the last one included.
//
//   checkArt(svg, limits)  { ok, problems, clean, texts, stats }
//   sanitize(svg, limits)  the canonical art, or null
//   freezeArt(clean, t)    the art held at t seconds (its last frame once t is past the end), or null
//   titleProblems(title)   [bad_title] unless the title is 1 to 32 printable ASCII characters
//
// stats.instants are milliseconds: every instant on the art's timeline where something may start,
// stop or jump (0 included), at most 32: keyframe offsets, every steps() boundary, and the point
// where a value that can't interpolate flips under its easing. Nothing jumps between two of them,
// so the review, which renders each one and the midpoint after it, sees every held state.
// Continuous motion between two samples is not covered (docs/architecture.md, known gaps).
// stats.duration_ms is when the last animation ends.
//
// Render cost is bounded as well as content, by counts a transform can't change: masks, clip
// paths and patterns count toward the expansion for every element drawn through them and never
// nest, every glyph of text drawn counts toward it as an element does (and at most 10,000 glyphs
// are drawn), at most 40,000 path segments are drawn, at most 5,000 guide path segments are laid
// out through textPath (Chrome measures the path again for every copy drawn), at most 64 masked
// or clipped layers, 32 filtered elements, blur in user units only, filter regions near the stage,
// and at most 10,000 dash entries (a dash and its gap are two), each dashed outline counted with
// the densest dash pattern that can reach it. A transform can make any one glyph, segment or dash
// as costly as one the size of the stage, so each count is sized for that. The numbers behind each
// limit are measured by server/scripts/finisher-render-cost.ts and recorded in docs/architecture.md.

// ------------------------------------------------------------------ the public shape

export const ART_PROBLEM_CODES = [
  'not_svg',
  'not_ascii',
  'too_large',
  'too_many_elements',
  'too_deep',
  'doctype',
  'script',
  'foreign_object',
  'event_handler',
  'external_ref',
  'image',
  'element_not_allowed',
  'attribute_not_allowed',
  'css_not_allowed',
  'smil',
  'too_long',
  'infinite',
  'flashing',
  'too_complex',
  'filter_not_allowed',
  'use_loop',
  'use_budget',
  'bad_viewbox',
  'bad_title',
] as const

export type ArtProblemCode = (typeof ART_PROBLEM_CODES)[number]
/** `at` is a character offset into the input, or null when the problem is the whole file. */
export type ArtProblem = { code: ArtProblemCode; message: string; at: number | null }
export type ArtLimits = { bytes: number; ms: number; elements: number }
export type ArtStats = {
  bytes: number
  elements: number
  expanded: number
  duration_ms: number
  filters: number
  instants: number[]
}
export type ArtCheck = { ok: boolean; problems: ArtProblem[]; clean: string | null; texts: string[]; stats: ArtStats }

/** For the API and logs. The mod and the site draw their own line for each code. */
export const ART_PROBLEM_MESSAGES: Record<ArtProblemCode, string> = {
  not_svg: "The file isn't one SVG drawing we can read.",
  not_ascii: 'The file has a character outside printable ASCII.',
  too_large: 'The file is over the size limit.',
  too_many_elements: 'The drawing has too many elements.',
  too_deep: 'The drawing nests elements too deeply.',
  doctype: 'The file declares a DOCTYPE or entities.',
  script: 'The drawing has a script.',
  foreign_object: 'The drawing has a foreignObject.',
  event_handler: 'The drawing has an event handler attribute.',
  external_ref: 'The drawing points to something outside itself.',
  image: 'The drawing embeds an image.',
  element_not_allowed: "The drawing uses an element that isn't allowed.",
  attribute_not_allowed: "The drawing has an attribute or value that isn't allowed.",
  css_not_allowed: "The drawing's CSS uses something that isn't allowed.",
  smil: 'The drawing animates with SMIL. Use CSS keyframes.',
  too_long: 'An animation runs past the time limit.',
  infinite: 'An animation repeats forever.',
  flashing: 'An animation flashes too fast.',
  too_complex: 'The timeline changes at more than 32 instants.',
  filter_not_allowed: "The drawing uses a filter that isn't allowed.",
  use_loop: 'A use, mask, clip path or pattern refers back to itself.',
  use_budget: 'The drawing has too much text or path detail, or repeats too much through use, masks, clip paths or patterns.',
  bad_viewbox: 'The viewBox must be 0 0 960 408.',
  bad_title: 'The title must be 1 to 32 printable ASCII characters.',
}

export const ART_WIDTH = 960
export const ART_HEIGHT = 408
/** The code defaults of `finishers.custom.limits`. */
export const ART_DEFAULTS: ArtLimits = { bytes: 65536, ms: 8000, elements: 4000 }
/** No config can raise a limit past these. */
export const ART_CEILINGS: ArtLimits = { bytes: 98304, ms: 12000, elements: 8000 }
/** The Svg element's `source` cap in the mod. A frozen art must fit under it with room to spare. */
export const ART_SVG_CAP = 131072
/** Kept free under the cap for the mod's Replay counter comment. */
const SVG_ROOM = 256

/** The fixed rules. */
export const ART_RULES = {
  instants: 32,
  /** Elements and glyphs drawn, after expansion through use, masks, clip paths and patterns. */
  expanded: 20000,
  /** Glyphs of text drawn, after expansion: a transform can make each one a path the size of the stage. */
  glyphs: 10000,
  /** Path, polyline and polygon segments drawn, after expansion: each may cross the whole stage. */
  segments: 40000,
  /**
   * Guide path segments laid out through textPath, after expansion: Chrome measures the whole path
   * a textPath references for every copy of the text it draws. Sized from the one family measured
   * (one glyph per textPath on big-radius arcs, 87 ms at this edge; docs/architecture.md, render
   * cost), not a bound proven for every textPath art: W10f's 250 ms draw_too_slow is the backstop.
   */
  textPathSegments: 5000,
  depth: 32,
  expandedDepth: 64,
  filterPrimitives: 8,
  filtered: 32,
  /** Masked or clipped elements drawn, after expansion: each is an offscreen layer. */
  layers: 64,
  blur: 8,
  /** A filter region reaches at most this many boxes (or stages, in user space) past each side. */
  filterRegion: 1,
  number: 100000,
  flashMs: 200,
  flashRepeats: 3,
  /** Turns of brightness (two make a flash) allowed in any window of flashWindowMs. */
  flashTurns: 6,
  flashWindowMs: 1000,
  problems: 20,
  patternTile: 4,
  dash: 0.5,
  dashPerPathLength: 500,
  /**
   * Dash entries drawn (a dash and the gap after it are two), after expansion: each dashed
   * outline's length (its pathLength where set) times the densest dash pattern that can reach it.
   * Each dash is its own stroked shape, and a transform can squeeze thousands onto a short line or
   * stretch each across the stage.
   */
  dashes: 10000,
  title: 32,
} as const

/** Config limits clamped to the ceilings; a missing or bad value takes the default. */
export function artLimits(limits?: Partial<ArtLimits> | null): ArtLimits {
  const pick = (k: keyof ArtLimits) => {
    const v = limits ? limits[k] : undefined
    return typeof v === 'number' && Number.isFinite(v) && v >= 1 ? Math.min(Math.floor(v), ART_CEILINGS[k]) : ART_DEFAULTS[k]
  }
  return { bytes: pick('bytes'), ms: pick('ms'), elements: pick('elements') }
}

export function checkArt(svg: string, limits?: Partial<ArtLimits> | null): ArtCheck {
  try {
    return run(svg, artLimits(limits), null)
  } catch {
    // A bug in this file must never take the caller down; it refuses instead.
    return { ok: false, problems: [problem('not_svg', null)], clean: null, texts: [], stats: noStats(0) }
  }
}

/** checkArt without its last-resort catch, for the fuzz test only. */
export function checkArtUncaught(svg: string, limits?: Partial<ArtLimits> | null): ArtCheck {
  return run(svg, artLimits(limits), null)
}

export function sanitize(svg: string, limits?: Partial<ArtLimits> | null): string | null {
  return checkArt(svg, limits).clean
}

/**
 * The art held at `t` seconds: every animation delay shifted by -t and paused. Every animation's
 * fill mode is `both`, so past the end the art holds its last frame. Null for art that isn't valid
 * under the ceilings, so it never returns more than the Svg cap minus room for a comment.
 */
export function freezeArt(clean: string, t: number): string | null {
  if (typeof t !== 'number' || !Number.isFinite(t) || Math.abs(t) > ART_RULES.number) return null
  try {
    const r = run(clean, ART_CEILINGS, Math.round(t * 1000))
    return r.ok ? r.clean : null
  } catch {
    return null
  }
}

export function titleProblems(title: unknown): ArtProblem[] {
  const bad = [problem('bad_title', null)]
  if (typeof title !== 'string' || title.length < 1 || title.length > ART_RULES.title || !title.trim()) return bad
  for (let i = 0; i < title.length; i++) {
    const c = title.charCodeAt(i)
    if (c < 0x20 || c > 0x7e) return bad
  }
  return []
}

// ------------------------------------------------------------------ internals

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const HALT = new Error('finisherart: halt')

/** The finest dash pattern seen anywhere: dash entries per unit of length, and where it was. */
type Dash = { density: number; at: number; code: ArtProblemCode }
type Ctx = { limits: ArtLimits; problems: ArtProblem[]; elements: number; freezeMs: number | null; dash: Dash | null }

type Txt = { kind: 'text'; text: string; at: number }
type El = {
  kind: 'el'
  name: string
  at: number
  parent: El | null
  depth: number
  attrs: [string, string][]
  kids: Node[]
  id: string | null
  refs: Ref[]
  filtered: boolean
  bad: boolean
  style: Block | null
  sheet: Sheet | null
}
type Node = El | Txt
type RefKind = 'paint' | 'clip' | 'mask' | 'filter' | 'use' | 'textpath'
type Ref = { id: string; kind: RefKind; at: number }

type Anim = { name: string; dur: number; delay: number; count: number; countRaw: string; ease: string; dir: string }
type Block = { decls: [string, string][]; anims: Anim[] | null; refs: Ref[]; at: number }
type Rule = { kind: 'rule'; sels: string; block: Block }
type Frame = { offsets: string[]; nums: number[]; block: Block }
type Keyframes = { kind: 'keyframes'; name: string; frames: Frame[]; at: number }
type Sheet = { items: (Rule | Keyframes)[] }

/** A refused value, kept apart from canonical strings (an id may well read "too_long"). */
type Bad = { bad: ArtProblemCode }
function no(code: ArtProblemCode): Bad {
  return { bad: code }
}
function isBad(x: unknown): x is Bad {
  return typeof x === 'object' && x !== null
}

function problem(code: ArtProblemCode, at: number | null): ArtProblem {
  return { code, message: ART_PROBLEM_MESSAGES[code], at }
}

function add(ctx: Ctx, code: ArtProblemCode, at: number | null) {
  ctx.problems.push(problem(code, at))
  if (ctx.problems.length >= ART_RULES.problems) throw HALT
}

function fatal(ctx: Ctx, code: ArtProblemCode, at: number | null): never {
  ctx.problems.push(problem(code, at))
  throw HALT
}

function noStats(bytes: number): ArtStats {
  return { bytes, elements: 0, expanded: 0, duration_ms: 0, filters: 0, instants: [] }
}

function run(svg: unknown, limits: ArtLimits, freezeMs: number | null): ArtCheck {
  const ctx: Ctx = { limits, problems: [], elements: 0, freezeMs, dash: null }
  const stats = noStats(typeof svg === 'string' ? svg.length : 0)
  let texts: string[] = []
  let clean: string | null = null
  try {
    if (typeof svg !== 'string') fatal(ctx, 'not_svg', null)
    if (svg.length > limits.bytes) fatal(ctx, 'too_large', null)
    for (let i = 0; i < svg.length; i++) {
      const c = svg.charCodeAt(i)
      if ((c < 0x20 || c > 0x7e) && c !== 9 && c !== 10 && c !== 13) fatal(ctx, 'not_ascii', i)
    }
    const root = parse(ctx, svg)
    stats.elements = ctx.elements
    const ids = collectIds(ctx, root)
    const blocks: Block[] = []
    const frames = new Map<string, Keyframes>()
    collectCss(ctx, root, blocks, frames)
    resolveRefs(ctx, root, blocks, ids, frames)
    const tl = timeline(ctx, blocks, frames)
    stats.instants = tl.instants
    stats.duration_ms = tl.duration
    const ex = expand(ctx, root, ids)
    stats.expanded = drawnOf(ex)
    stats.filters = ex.filtered
    texts = collectTexts(root)
    if (!ctx.problems.length) {
      const out = serialize(ctx, root)
      // freezeArt adds a play state to every animated block and may lengthen each delay, so art
      // whose frozen form could pass the Svg cap is refused here rather than failing to draw later.
      let slack = 0
      for (const b of blocks) if (b.anims && b.anims.length) slack += FREEZE_BLOCK + FREEZE_LAYER * b.anims.length
      if (freezeMs === null ? out.length > limits.bytes || out.length + slack > ART_SVG_CAP - SVG_ROOM : out.length > ART_SVG_CAP - SVG_ROOM) {
        add(ctx, 'too_large', null)
      } else {
        clean = out
        stats.bytes = out.length
      }
    }
  } catch (e) {
    if (e !== HALT) throw e
  }
  stats.elements = ctx.elements
  const ok = !ctx.problems.length && clean !== null
  return { ok, problems: ctx.problems, clean: ok ? clean : null, texts, stats }
}

// ------------------------------------------------------------------ allowlists

const CONTAINERS = ['svg', 'g', 'defs', 'symbol', 'pattern', 'clipPath', 'mask']
const SHAPES = ['path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon']
const PRIMITIVES = ['feGaussianBlur', 'feOffset', 'feFlood', 'feComposite', 'feMerge', 'feColorMatrix', 'feBlend']
const TEXTUAL = new Set(['text', 'tspan', 'textPath'])

/** Each allowed element and the parents it may sit in. The root `svg` is handled on its own. */
const PARENTS = new Map<string, string[]>()
for (const n of ['g', 'defs', 'symbol', 'use', 'text', 'linearGradient', 'radialGradient', 'pattern', 'clipPath', 'mask', 'filter', ...SHAPES]) PARENTS.set(n, CONTAINERS)
PARENTS.set('style', ['svg', 'g', 'defs'])
PARENTS.set('stop', ['linearGradient', 'radialGradient'])
PARENTS.set('tspan', ['text', 'tspan', 'textPath'])
PARENTS.set('textPath', ['text'])
for (const n of PRIMITIVES) PARENTS.set(n, ['filter'])
PARENTS.set('feMergeNode', ['feMerge'])

const SMIL = new Set(['animate', 'animatetransform', 'animatemotion', 'animatecolor', 'set', 'mpath', 'discard'])

/** The problem code for an element that isn't allowed where it is. */
function elementProblem(name: string, parent: string): ArtProblemCode | null {
  const allowed = PARENTS.get(name)
  if (allowed) return allowed.indexOf(parent) >= 0 ? null : 'element_not_allowed'
  const local = (name.indexOf(':') >= 0 ? name.slice(name.lastIndexOf(':') + 1) : name).toLowerCase()
  if (local === 'script') return 'script'
  if (local === 'foreignobject') return 'foreign_object'
  if (local === 'image' || local === 'feimage') return 'image'
  if (SMIL.has(local)) return 'smil'
  if (local.slice(0, 2) === 'fe') return 'filter_not_allowed'
  return 'element_not_allowed'
}

type Kind =
  | 'id'
  | 'class'
  | 'style'
  | 'href'
  | 'num'
  | 'plen'
  | 'len'
  | 'lens'
  | 'nums'
  | 'points'
  | 'viewbox'
  | 'path'
  | 'name'
  | 'par'
  | 'font'
  | 'blur'
  | 'cmatrix'
  | 'dash'
  | 'paint'
  | 'alpha'
  | 'color'
  | 'transform'
  | 'ptransform'
  | 'origin'
  | 'iri'
  | 'offset'
  | 'miter'
  | 'spacing'
  | 'paintorder'
  | 'csstype'
  | 'primunits'
  | readonly string[]

const UNITS = ['userSpaceOnUse', 'objectBoundingBox']
const RULE = ['nonzero', 'evenodd']
const VIS = ['visible', 'hidden', 'collapse']
const DISPLAY = ['none', 'inline', 'block']
const BOX = ['content-box', 'border-box', 'fill-box', 'stroke-box', 'view-box']
const CAP = ['butt', 'round', 'square']
const JOIN = ['miter', 'round', 'bevel']
const WEIGHTS = ['normal', 'bold', 'bolder', 'lighter', '100', '200', '300', '400', '500', '600', '700', '800', '900']
const BASELINES = ['auto', 'middle', 'central', 'hanging', 'alphabetic', 'mathematical', 'ideographic', 'text-top', 'text-bottom']
const BLEND = ['normal', 'multiply', 'screen', 'darken', 'lighten', 'overlay', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion']
const FONTS = ['serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui', 'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded']
const CIF = ['auto', 'sRGB', 'linearRGB']

const GLOBAL: [string, Kind][] = [
  ['id', 'id'],
  ['class', 'class'],
  ['style', 'style'],
]
const PRES: [string, Kind][] = [
  ['fill', 'paint'],
  ['fill-opacity', 'alpha'],
  ['fill-rule', RULE],
  ['stroke', 'paint'],
  ['stroke-width', 'len'],
  ['stroke-opacity', 'alpha'],
  ['stroke-linecap', CAP],
  ['stroke-linejoin', JOIN],
  ['stroke-miterlimit', 'miter'],
  ['stroke-dasharray', 'dash'],
  ['stroke-dashoffset', 'len'],
  ['opacity', 'alpha'],
  ['visibility', VIS],
  ['display', DISPLAY],
  ['transform', 'transform'],
  ['transform-origin', 'origin'],
  ['transform-box', BOX],
  ['clip-path', 'iri'],
  ['clip-rule', RULE],
  ['mask', 'iri'],
  ['filter', 'iri'],
  ['color', 'color'],
  ['paint-order', 'paintorder'],
  ['shape-rendering', ['auto', 'optimizeSpeed', 'crispEdges', 'geometricPrecision']],
  ['font-family', 'font'],
  ['font-size', 'len'],
  ['font-weight', WEIGHTS],
  ['font-style', ['normal', 'italic', 'oblique']],
  ['text-anchor', ['start', 'middle', 'end']],
  ['dominant-baseline', BASELINES],
  ['letter-spacing', 'spacing'],
  ['word-spacing', 'spacing'],
]
const ROOT_PRES = PRES.filter(([k]) => ['transform', 'transform-origin', 'transform-box', 'clip-path', 'mask', 'filter'].indexOf(k) < 0)
const XYWH: [string, Kind][] = [
  ['x', 'len'],
  ['y', 'len'],
  ['width', 'len'],
  ['height', 'len'],
]
const TEXT_POS: [string, Kind][] = [
  ['x', 'lens'],
  ['y', 'lens'],
  ['dx', 'lens'],
  ['dy', 'lens'],
  ['rotate', 'nums'],
  ['textLength', 'len'],
  ['lengthAdjust', ['spacing', 'spacingAndGlyphs']],
]
const FE: [string, Kind][] = [...XYWH, ['result', 'name'], ['color-interpolation-filters', CIF]]

const ATTRS = new Map<string, Map<string, Kind>>()
function attrs(name: string, ...lists: [string, Kind][][]) {
  ATTRS.set(name, new Map<string, Kind>(([] as [string, Kind][]).concat(GLOBAL, ...lists)))
}
// The root takes no id, class or style: CSS reaches it only through an `svg` rule, which may not
// move or animate it (see selectors), the same as the transform attributes ROOT_PRES leaves out.
ATTRS.set('svg', new Map<string, Kind>(ROOT_PRES))
attrs('g', PRES)
attrs('defs')
attrs('symbol', PRES, XYWH, [
  ['viewBox', 'viewbox'],
  ['preserveAspectRatio', 'par'],
  ['refX', 'len'],
  ['refY', 'len'],
])
attrs('use', PRES, XYWH, [['href', 'href']])
attrs('path', PRES, [
  ['d', 'path'],
  ['pathLength', 'plen'],
])
attrs('rect', PRES, XYWH, [
  ['rx', 'len'],
  ['ry', 'len'],
  ['pathLength', 'plen'],
])
attrs('circle', PRES, [
  ['cx', 'len'],
  ['cy', 'len'],
  ['r', 'len'],
  ['pathLength', 'plen'],
])
attrs('ellipse', PRES, [
  ['cx', 'len'],
  ['cy', 'len'],
  ['rx', 'len'],
  ['ry', 'len'],
  ['pathLength', 'plen'],
])
attrs('line', PRES, [
  ['x1', 'len'],
  ['y1', 'len'],
  ['x2', 'len'],
  ['y2', 'len'],
  ['pathLength', 'plen'],
])
attrs('polyline', PRES, [
  ['points', 'points'],
  ['pathLength', 'plen'],
])
attrs('polygon', PRES, [
  ['points', 'points'],
  ['pathLength', 'plen'],
])
attrs('text', PRES, TEXT_POS)
attrs('tspan', PRES, TEXT_POS)
attrs('textPath', PRES, [
  ['href', 'href'],
  ['startOffset', 'len'],
  ['method', ['align', 'stretch']],
  ['spacing', ['auto', 'exact']],
  ['textLength', 'len'],
  ['lengthAdjust', ['spacing', 'spacingAndGlyphs']],
])
attrs('linearGradient', [
  ['x1', 'len'],
  ['y1', 'len'],
  ['x2', 'len'],
  ['y2', 'len'],
  ['gradientUnits', UNITS],
  ['gradientTransform', 'transform'],
  ['spreadMethod', ['pad', 'reflect', 'repeat']],
])
attrs('radialGradient', [
  ['cx', 'len'],
  ['cy', 'len'],
  ['r', 'len'],
  ['fx', 'len'],
  ['fy', 'len'],
  ['fr', 'len'],
  ['gradientUnits', UNITS],
  ['gradientTransform', 'transform'],
  ['spreadMethod', ['pad', 'reflect', 'repeat']],
])
attrs('stop', [
  ['offset', 'offset'],
  ['stop-color', 'color'],
  ['stop-opacity', 'alpha'],
])
attrs('pattern', PRES, XYWH, [
  ['patternUnits', UNITS],
  ['patternContentUnits', UNITS],
  ['patternTransform', 'ptransform'],
  ['viewBox', 'viewbox'],
  ['preserveAspectRatio', 'par'],
])
attrs('clipPath', PRES, [['clipPathUnits', UNITS]])
attrs('mask', PRES, XYWH, [
  ['maskUnits', UNITS],
  ['maskContentUnits', UNITS],
])
attrs('filter', XYWH, [
  ['filterUnits', UNITS],
  ['primitiveUnits', 'primunits'],
  ['color-interpolation-filters', CIF],
])
ATTRS.set('style', new Map<string, Kind>([['type', 'csstype']]))
attrs('feGaussianBlur', FE, [
  ['in', 'name'],
  ['stdDeviation', 'blur'],
  ['edgeMode', ['duplicate', 'wrap', 'none']],
])
attrs('feOffset', FE, [
  ['in', 'name'],
  ['dx', 'num'],
  ['dy', 'num'],
])
attrs('feFlood', FE, [
  ['flood-color', 'color'],
  ['flood-opacity', 'alpha'],
])
attrs('feComposite', FE, [
  ['in', 'name'],
  ['in2', 'name'],
  ['operator', ['over', 'in', 'out', 'atop', 'xor', 'arithmetic']],
  ['k1', 'num'],
  ['k2', 'num'],
  ['k3', 'num'],
  ['k4', 'num'],
])
attrs('feMerge', FE)
attrs('feMergeNode', [['in', 'name']])
attrs('feColorMatrix', FE, [
  ['in', 'name'],
  ['type', ['matrix', 'saturate', 'hueRotate', 'luminanceToAlpha']],
  ['values', 'cmatrix'],
])
attrs('feBlend', FE, [
  ['in', 'name'],
  ['in2', 'name'],
  ['mode', BLEND],
])

/** What each kind of reference may point at. */
const TARGETS: Record<RefKind, string[]> = {
  paint: ['linearGradient', 'radialGradient', 'pattern'],
  clip: ['clipPath'],
  mask: ['mask'],
  filter: ['filter'],
  use: ['g', 'symbol', 'use', 'text', ...SHAPES],
  textpath: ['path'],
}

// CSS properties: in rules and style attributes, and (all but transform-box) inside keyframes.
const CSS_PROPS = new Set([
  'opacity',
  'fill',
  'fill-opacity',
  'fill-rule',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stop-color',
  'stop-opacity',
  'transform',
  'transform-origin',
  'transform-box',
  'visibility',
  'display',
])
const ANIM_PROPS = new Set([
  'animation',
  'animation-name',
  'animation-duration',
  'animation-delay',
  'animation-iteration-count',
  'animation-timing-function',
  'animation-direction',
  'animation-fill-mode',
])
const EASE = ['linear', 'ease', 'ease-in', 'ease-out', 'ease-in-out', 'step-start', 'step-end']
const STEP_AT = ['jump-start', 'jump-end', 'jump-none', 'jump-both', 'start', 'end']
const DIRS = ['normal', 'reverse', 'alternate', 'alternate-reverse']
const FILLS = ['none', 'forwards', 'backwards', 'both']
/** A keyframes name can't be any keyword the animation shorthand reads, so the shorthand is never ambiguous. */
const RESERVED = new Set([
  ...EASE,
  ...DIRS,
  ...FILLS,
  'infinite',
  'running',
  'paused',
  'auto',
  // The CSS-wide keywords: a list holding one is dropped whole.
  'initial',
  'inherit',
  'unset',
  'default',
  'revert',
  'revert-layer',
])
const WIDE = ['inherit', 'initial', 'unset']

const NAMED = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood ' +
    'cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray ' +
    'darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen ' +
    'darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue ' +
    'firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew ' +
    'hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan ' +
    'lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
    'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue ' +
    'mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred ' +
    'midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid ' +
    'palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
    'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue ' +
    'slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen transparent currentcolor'
  ).split(' '),
)

// ------------------------------------------------------------------ small parsers

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]{0,63}$/
// A decimal point always has a digit after it: CSS has no `3.`, and a declaration Chrome can't read
// is dropped, which would let another rule's value play in its place.
const NUM_RE = /^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/
const LEN_RE = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|%|em)?$/
const NUM_STICKY = /[+-]?(?:\d+(?:\.\d+)?|\.\d+)/y

function isWs(c: string | undefined) {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r'
}

function isBlank(s: string) {
  for (let i = 0; i < s.length; i++) if (!isWs(s[i])) return false
  return true
}

/** A plain decimal within the number rule, or null. No exponent, no units. */
function num(s: string): number | null {
  if (s.length > 32 || !NUM_RE.test(s)) return null
  const v = parseFloat(s)
  return Number.isFinite(v) && Math.abs(v) <= ART_RULES.number ? v : null
}

function len(s: string): number | null {
  if (s.length > 34) return null
  const m = LEN_RE.exec(s)
  return m && m[1] !== undefined ? num(m[1]) : null
}

function splitList(s: string): string[] {
  const t = s.trim()
  return t ? t.split(/[\s,]+/) : []
}

/** The ids in every url( in a value, or null when any url( isn't exactly url(#id). */
function urlNormalize(s: string): string {
  return s.replace(/url\([ \t\n]*(["'])#([A-Za-z][A-Za-z0-9_-]{0,63})\1[ \t\n]*\)/gi, 'url(#$2)')
}

function urlsAreLocal(s: string): boolean {
  const low = s.toLowerCase()
  let i = low.indexOf('url(')
  while (i >= 0) {
    let j = i + 4
    while (isWs(low[j])) j++
    if (low[j] !== '#') return false
    j++
    const start = j
    while (j < s.length && /[A-Za-z0-9_-]/.test(s[j] as string)) j++
    if (!ID_RE.test(s.slice(start, j))) return false
    while (isWs(low[j])) j++
    if (low[j] !== ')') return false
    i = low.indexOf('url(', j)
  }
  return true
}

function pathData(s: string): string | null {
  let out = ''
  let prev = ''
  let i = 0
  while (i < s.length) {
    const c = s[i] as string
    if (isWs(c) || c === ',') {
      i++
      continue
    }
    if ('MmLlHhVvCcSsQqTtAaZz'.indexOf(c) >= 0) {
      if (!out && c !== 'M' && c !== 'm') return null
      out += c
      prev = 'c'
      i++
      continue
    }
    NUM_STICKY.lastIndex = i
    const m = NUM_STICKY.exec(s)
    if (!m || !out || num(m[0]) === null) return null
    out += (prev === 'n' ? ' ' : '') + m[0]
    prev = 'n'
    i = NUM_STICKY.lastIndex
  }
  return out || null
}

// ------------------------------------------------------------------ CSS values

type Tok =
  | { t: 'num'; v: number; unit: string; raw: string }
  | { t: 'id'; raw: string }
  | { t: 'hash'; raw: string }
  | { t: 'url'; id: string }
  | { t: 'op'; raw: string }
  | { t: 'fn'; name: string; args: Tok[][] }

const NUM_UNITS = ['', 'px', '%', 'em', 'deg', 'rad', 'turn', 'grad', 's', 'ms']
const LEN_UNITS = ['', 'px', '%', 'em']

/** A value as comma groups of space-separated components, or a problem code. */
function lex(src: string): Tok[][] | ArtProblemCode {
  const stack: { groups: Tok[][]; name: string }[] = []
  let groups: Tok[][] = [[]]
  const push = (t: Tok) => (groups[groups.length - 1] as Tok[]).push(t)
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i] as string
    if (isWs(c)) {
      i++
      continue
    }
    if (c === ',') {
      groups.push([])
      i++
      continue
    }
    if (c === ')') {
      const top = stack.pop()
      if (!top) return 'css_not_allowed'
      const fn: Tok = { t: 'fn', name: top.name, args: groups }
      groups = top.groups
      push(fn)
      i++
      continue
    }
    if (c === '(') {
      if (stack.length >= 4) return 'css_not_allowed'
      stack.push({ groups, name: '' })
      groups = [[]]
      i++
      continue
    }
    if (c === '/' || c === '*') {
      push({ t: 'op', raw: c })
      i++
      continue
    }
    if (c === '#') {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_-]/.test(src[j] as string)) j++
      if (j === i + 1 || j - i > 65) return 'css_not_allowed'
      push({ t: 'hash', raw: src.slice(i, j) })
      i = j
      continue
    }
    const next = src[i + 1]
    const digitish = (x: string | undefined) => x !== undefined && /[0-9.]/.test(x)
    if (/[0-9.]/.test(c) || ((c === '+' || c === '-') && digitish(next))) {
      NUM_STICKY.lastIndex = i
      const m = NUM_STICKY.exec(src)
      if (!m) return 'css_not_allowed'
      const v = num(m[0])
      if (v === null) return 'css_not_allowed'
      let j = NUM_STICKY.lastIndex
      let unit = ''
      if (src[j] === '%') {
        unit = '%'
        j++
      } else {
        const u = j
        while (j < n && /[A-Za-z]/.test(src[j] as string)) j++
        unit = src.slice(u, j).toLowerCase()
      }
      if (NUM_UNITS.indexOf(unit) < 0) return 'css_not_allowed'
      push({ t: 'num', v, unit, raw: m[0] + unit })
      i = j
      continue
    }
    if ((c === '+' || c === '-') && isWs(next)) {
      push({ t: 'op', raw: c })
      i++
      continue
    }
    if (/[A-Za-z_-]/.test(c)) {
      let j = i + 1
      while (j < n && /[A-Za-z0-9_-]/.test(src[j] as string)) j++
      if (j - i > 66) return 'css_not_allowed'
      const word = src.slice(i, j)
      if (src[j] === '(') {
        const name = word.toLowerCase()
        if (name === 'url') {
          const e = src.indexOf(')', j)
          if (e < 0) return 'external_ref'
          const inner = src.slice(j + 1, e).trim()
          if (inner[0] !== '#' || !ID_RE.test(inner.slice(1))) return 'external_ref'
          push({ t: 'url', id: inner.slice(1) })
          i = e + 1
          continue
        }
        if (stack.length >= 4) return 'css_not_allowed'
        stack.push({ groups, name })
        groups = [[]]
        i = j + 1
        continue
      }
      push({ t: 'id', raw: word })
      i = j
      continue
    }
    return 'css_not_allowed'
  }
  if (stack.length) return 'css_not_allowed'
  return groups
}

function serTok(t: Tok): string {
  switch (t.t) {
    case 'num':
      return t.raw
    case 'id':
    case 'hash':
    case 'op':
      return t.raw
    case 'url':
      return `url(#${t.id})`
    case 'fn':
      return `${t.name}(${serGroups(t.args)})`
  }
}

function serGroups(groups: Tok[][]): string {
  return groups.map(g => g.map(serTok).join(' ')).join(',')
}

/** One component, alone. */
function only(groups: Tok[][]): Tok | null {
  return groups.length === 1 && groups[0] && groups[0].length === 1 ? (groups[0][0] as Tok) : null
}

function kw(t: Tok | null | undefined): string | null {
  return t && t.t === 'id' ? t.raw.toLowerCase() : null
}

function isVar(t: Tok): boolean {
  if (t.t !== 'fn' || t.name !== 'var' || t.args.length < 1 || t.args.length > 2) return false
  const name = t.args[0]
  if (!name || name.length !== 1 || !name[0] || name[0].t !== 'id' || !/^--[A-Za-z0-9_-]{1,64}$/.test(name[0].raw)) return false
  const fb = t.args[1]
  if (!fb) return true
  return fb.length === 1 && !!fb[0] && (fb[0].t === 'num' || fb[0].t === 'hash' || (fb[0].t === 'id' && NAMED.has(fb[0].raw.toLowerCase())))
}

function isCalc(t: Tok, units: string[]): boolean {
  if (t.t !== 'fn' || (t.name !== 'calc' && t.name !== '') || t.args.length !== 1) return false
  const g = t.args[0] as Tok[]
  if (!g.length || g.length % 2 === 0) return false
  for (let k = 0; k < g.length; k++) {
    const c = g[k] as Tok
    if (k % 2) {
      if (c.t !== 'op' || '+-*/'.indexOf(c.raw) < 0) return false
    } else if (!(c.t === 'num' ? units.indexOf(c.unit) >= 0 : isVar(c) || isCalc(c, units))) return false
  }
  return true
}

function numberish(t: Tok | null | undefined, units: string[], css: boolean): boolean {
  if (!t) return false
  if (t.t === 'num') return units.indexOf(t.unit) >= 0
  return css && t.t === 'fn' && t.name !== '' && (isVar(t) || isCalc(t, units))
}

function isColor(t: Tok | null | undefined, css: boolean): string | null {
  if (!t) return null
  if (t.t === 'hash') return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(t.raw) ? t.raw : null
  if (t.t === 'id') {
    const k = t.raw.toLowerCase()
    return NAMED.has(k) ? k : null
  }
  if (t.t !== 'fn') return null
  if (css && isVar(t)) return serTok(t)
  if (['rgb', 'rgba', 'hsl', 'hsla'].indexOf(t.name) < 0) return null
  const units = t.name[0] === 'h' ? ['', '%', 'deg'] : ['', '%']
  const ok = (x: Tok | undefined) => !!x && x.t === 'num' && units.indexOf(x.unit) >= 0
  if (t.args.length >= 3) {
    if (t.args.length > 4 || !t.args.every(g => g.length === 1 && ok(g[0]))) return null
    return serTok(t)
  }
  const g = t.args[0]
  if (t.args.length !== 1 || !g) return null
  if (g.length === 3 && g.every(ok)) return serTok(t)
  const slash = g[3]
  if (g.length === 5 && ok(g[0]) && ok(g[1]) && ok(g[2]) && slash && slash.t === 'op' && slash.raw === '/' && ok(g[4])) return serTok(t)
  return null
}

function easing(t: Tok | null | undefined): string | null {
  if (!t) return null
  const k = kw(t)
  if (k) return EASE.indexOf(k) >= 0 ? k : null
  if (t.t !== 'fn') return null
  const nums = t.args.map(g => (g.length === 1 && g[0] && g[0].t === 'num' && g[0].unit === '' ? g[0] : null))
  if (t.name === 'cubic-bezier') {
    if (nums.length !== 4 || nums.some(x => !x || x.v < 0 || x.v > 1)) return null
    return `cubic-bezier(${nums.map(x => (x as { raw: string }).raw).join(',')})`
  }
  if (t.name === 'steps') {
    const n0 = nums[0]
    // An <integer>: `3.0` is a number to CSS, and steps() with one is dropped.
    if (!n0 || !/^\+?\d+$/.test(n0.raw) || n0.v < 1 || n0.v > 100 || t.args.length > 2) return null
    if (t.args.length === 1) return `steps(${n0.v})`
    const at = t.args[1] && t.args[1].length === 1 ? kw(t.args[1][0]) : null
    if (!at || STEP_AT.indexOf(at) < 0 || (at === 'jump-none' && n0.v < 2)) return null
    return `steps(${n0.v},${at})`
  }
  return null
}

// Maps, not object literals: a function named `constructor` must miss, not find Object's.
const TRANSFORM_ARGS = new Map<string, number[]>([
  ['matrix', [6]],
  ['translate', [1, 2]],
  ['translatex', [1]],
  ['translatey', [1]],
  ['scale', [1, 2]],
  ['scalex', [1]],
  ['scaley', [1]],
  ['rotate', [1, 3]],
  ['skew', [1, 2]],
  ['skewx', [1]],
  ['skewy', [1]],
])
const CASED = new Map<string, string>([
  ['translatex', 'translateX'],
  ['translatey', 'translateY'],
  ['scalex', 'scaleX'],
  ['scaley', 'scaleY'],
  ['skewx', 'skewX'],
  ['skewy', 'skewY'],
])

const ANGLE_UNITS = ['deg', 'rad', 'turn', 'grad']

/**
 * One transform argument as Chrome reads it. The transform attribute (and patternTransform and
 * gradientTransform) takes SVG's grammar: plain numbers only, `translate(10px)` is dropped. CSS
 * takes lengths for translate and angles for rotate and skew (a bare 0 aside), and plain numbers
 * for scale and matrix: `rotate(90)` in CSS is dropped.
 */
function transformArg(name: string, t: Tok, css: boolean): boolean {
  if (!css) return t.t === 'num' && t.unit === ''
  const units = name.slice(0, 9) === 'translate' ? ['px', '%', 'em'] : name.slice(0, 6) === 'rotate' || name.slice(0, 4) === 'skew' ? ANGLE_UNITS : ['']
  if (t.t === 'num') return units.indexOf(t.unit) >= 0 || (t.unit === '' && t.v === 0)
  return isVar(t) || isCalc(t, units)
}

function transformList(groups: Tok[][], css: boolean, noScale: boolean): string | null {
  if (groups.length !== 1) return null
  const g = groups[0] as Tok[]
  if (g.length === 1 && kw(g[0]) === 'none') return 'none'
  if (!g.length || g.length > 32) return null
  const out: string[] = []
  for (const f of g) {
    if (f.t !== 'fn') return null
    const counts = TRANSFORM_ARGS.get(f.name)
    if (!counts || (noScale && (f.name === 'matrix' || f.name.slice(0, 5) === 'scale'))) return null
    let args: Tok[] = []
    if (f.args.length === 1) args = f.args[0] as Tok[]
    else if (f.args.every(a => a.length === 1)) args = f.args.map(a => a[0] as Tok)
    else return null
    // rotate(a, cx, cy) is SVG's alone.
    if (counts.indexOf(args.length) < 0 || (css && f.name === 'rotate' && args.length !== 1)) return null
    if (!args.every(a => transformArg(f.name, a, css))) return null
    out.push(`${CASED.get(f.name) ?? f.name}(${args.map(serTok).join(',')})`)
  }
  return out.join(' ')
}

/**
 * A presentation value, the same for an attribute (css false: no var or calc) and a CSS declaration.
 * Returns the canonical value or a refusal; url(#id) references go into `refs`.
 */
function presValue(ctx: Ctx, prop: string, value: string, css: boolean, refs: Ref[], at: number, dashMin: number): string | Bad {
  const bad = no(css ? 'css_not_allowed' : 'attribute_not_allowed')
  if (!urlsAreLocal(value)) return no('external_ref')
  const groups = lex(value)
  if (typeof groups === 'string') return groups === 'css_not_allowed' ? bad : no(groups)
  const one = only(groups)
  const word = kw(one)
  if (word && WIDE.indexOf(word) >= 0) return word
  switch (prop) {
    case 'fill':
    case 'stroke': {
      if (groups.length !== 1) return bad
      const g = groups[0] as Tok[]
      if (g.length === 1 && kw(g[0]) === 'none') return 'none'
      const first = g[0]
      if (first && first.t === 'url' && g.length <= 2) {
        refs.push({ id: first.id, kind: 'paint', at })
        if (g.length === 1) return serTok(first)
        const fb = g[1] as Tok
        const c = kw(fb) === 'none' ? 'none' : isColor(fb, css)
        return c ? `${serTok(first)} ${c}` : bad
      }
      return (g.length === 1 && isColor(first, css)) || bad
    }
    case 'fill-opacity':
    case 'stroke-opacity':
    case 'opacity':
    case 'stop-opacity':
    case 'flood-opacity':
      return one && numberish(one, ['', '%'], css) ? serTok(one) : bad
    case 'stop-color':
    case 'flood-color':
    case 'color':
      return isColor(one, css) || bad
    case 'stroke-width':
    case 'stroke-dashoffset':
    case 'font-size':
      return one && numberish(one, LEN_UNITS, css) ? serTok(one) : bad
    case 'stroke-miterlimit':
      return one && one.t === 'num' && one.unit === '' && one.v >= 1 && one.v <= 100 ? one.raw : bad
    case 'stroke-dasharray': {
      if (word === 'none') return 'none'
      const list = groups.length === 1 ? (groups[0] as Tok[]) : groups.every(g => g.length === 1) ? groups.map(g => g[0] as Tok) : null
      if (!list || !list.length || list.length > 32) return bad
      // Unitless or px only: an em or % dash scales with something the floor can't see.
      for (const t of list) if (t.t !== 'num' || (t.unit !== '' && t.unit !== 'px') || t.v < dashMin) return bad
      // Kept for the dash budget (expand), which can't know which elements a dash reaches.
      const density = list.length / list.reduce((sum, t) => sum + (t.t === 'num' ? t.v : 0), 0)
      if (!ctx.dash || density > ctx.dash.density) ctx.dash = { density, at, code: bad.bad }
      return list.map(serTok).join(' ')
    }
    case 'transform':
      return transformList(groups, css, false) || bad
    case 'transform-origin': {
      if (groups.length !== 1) return bad
      const g = groups[0] as Tok[]
      if (!g.length || g.length > 3) return bad
      const parts: string[] = []
      for (const t of g) {
        const k = kw(t)
        if (k && ['left', 'center', 'right', 'top', 'bottom'].indexOf(k) >= 0) parts.push(k)
        // CSS drops a unitless length here (a bare 0 aside); the attribute reads one.
        else if (numberish(t, css ? ['px', '%', 'em'] : LEN_UNITS, css) || (t.t === 'num' && t.unit === '' && t.v === 0)) parts.push(serTok(t))
        else return bad
      }
      return parts.join(' ')
    }
    case 'fill-rule':
    case 'clip-rule':
      return word && RULE.indexOf(word) >= 0 ? word : bad
    case 'stroke-linecap':
      return word && CAP.indexOf(word) >= 0 ? word : bad
    case 'stroke-linejoin':
      return word && JOIN.indexOf(word) >= 0 ? word : bad
    case 'transform-box':
      return word && BOX.indexOf(word) >= 0 ? word : bad
    case 'visibility':
      return word && VIS.indexOf(word) >= 0 ? word : bad
    case 'display':
      return word && DISPLAY.indexOf(word) >= 0 ? word : bad
  }
  return bad
}

/** A custom property's value: one number, length, angle, percent, time or color. */
function customValue(value: string): string | null {
  if (!urlsAreLocal(value)) return null
  const groups = lex(value)
  if (typeof groups === 'string') return null
  const one = only(groups)
  if (!one) return null
  if (one.t === 'num') return one.raw
  return isColor(one, false)
}

// ------------------------------------------------------------------ CSS blocks and sheets

function time(t: Tok | undefined): number | null {
  if (!t || t.t !== 'num' || (t.unit !== 's' && t.unit !== 'ms')) return null
  return Math.round(t.unit === 's' ? t.v * 1000 : t.v)
}

type AnimState = {
  name?: string[]
  dur?: number[]
  delay?: number[]
  count?: [number, string][]
  ease?: string[]
  dir?: string[]
}

/** One `animation` shorthand layer, or a problem code. */
function shorthandLayer(g: Tok[]): Anim | ArtProblemCode {
  let name: string | undefined
  let dur: number | undefined
  let delay: number | undefined
  let count: [number, string] | undefined
  let ease: string | undefined
  let dir: string | undefined
  let fill: string | undefined
  for (const t of g) {
    const ms = time(t)
    if (ms !== null) {
      if (dur === undefined) {
        if (ms < 0) return 'css_not_allowed'
        dur = ms
      } else if (delay === undefined) delay = ms
      else return 'css_not_allowed'
      continue
    }
    if (t.t === 'num') {
      if (t.unit !== '' || count || t.v < 0 || t.v > 1000) return 'css_not_allowed'
      count = [t.v, t.raw]
      continue
    }
    const k = kw(t)
    if (k === 'infinite') return 'infinite'
    const e = easing(t)
    if (e) {
      if (ease) return 'css_not_allowed'
      ease = e
      continue
    }
    if (!k || t.t !== 'id') return 'css_not_allowed'
    if (DIRS.indexOf(k) >= 0 && !dir) dir = k
    else if (FILLS.indexOf(k) >= 0 && !fill) fill = k
    else if (k === 'none' && !name) name = 'none'
    else if (!RESERVED.has(k) && !name && ID_RE.test(t.raw)) name = t.raw
    else return 'css_not_allowed'
  }
  return {
    name: name ?? 'none',
    dur: dur ?? 0,
    delay: delay ?? 0,
    count: count ? count[0] : 1,
    countRaw: count ? count[1] : '1',
    ease: ease ?? 'ease',
    dir: dir ?? 'normal',
  }
}

/** One animation longhand into the state, or a problem code. */
function animLonghand(st: AnimState, prop: string, groups: Tok[][]): ArtProblemCode | null {
  const items = groups.map(g => (g.length === 1 ? (g[0] as Tok) : null))
  if (!items.length || items.length > 16) return 'css_not_allowed'
  if (items.some(x => !x)) return 'css_not_allowed'
  const list = items as Tok[]
  switch (prop) {
    case 'animation-name': {
      const names: string[] = []
      for (const t of list) {
        const k = kw(t)
        if (k === 'none') names.push('none')
        else if (t.t === 'id' && k && !RESERVED.has(k) && ID_RE.test(t.raw)) names.push(t.raw)
        else return 'css_not_allowed'
      }
      st.name = names
      return null
    }
    case 'animation-duration':
    case 'animation-delay': {
      const ms: number[] = []
      for (const t of list) {
        const v = time(t)
        if (v === null || (prop === 'animation-duration' && v < 0)) return 'css_not_allowed'
        ms.push(v)
      }
      if (prop === 'animation-duration') st.dur = ms
      else st.delay = ms
      return null
    }
    case 'animation-iteration-count': {
      const c: [number, string][] = []
      for (const t of list) {
        if (kw(t) === 'infinite') return 'infinite'
        if (t.t !== 'num' || t.unit !== '' || t.v < 0 || t.v > 1000) return 'css_not_allowed'
        c.push([t.v, t.raw])
      }
      st.count = c
      return null
    }
    case 'animation-timing-function': {
      const e: string[] = []
      for (const t of list) {
        const v = easing(t)
        if (!v) return 'css_not_allowed'
        e.push(v)
      }
      st.ease = e
      return null
    }
    case 'animation-direction': {
      const d: string[] = []
      for (const t of list) {
        const k = kw(t)
        if (!k || DIRS.indexOf(k) < 0) return 'css_not_allowed'
        d.push(k)
      }
      st.dir = d
      return null
    }
    case 'animation-fill-mode': {
      // Read and checked, then written as `both` whatever it said.
      for (const t of list) {
        const k = kw(t)
        if (!k || FILLS.indexOf(k) < 0) return 'css_not_allowed'
      }
      return null
    }
  }
  return 'css_not_allowed'
}

/** The declarations of a rule, a style attribute or a keyframe. Null after adding a problem. */
function parseBlock(ctx: Ctx, body: string, where: 'rule' | 'attr' | 'keyframe', at: number): Block | null {
  const block: Block = { decls: [], anims: null, refs: [], at }
  const st: AnimState = {}
  let animated = false
  let named = false
  const bad = (code: ArtProblemCode) => {
    add(ctx, code, at)
    return null
  }
  const parts = body.split(';')
  if (parts.length > 256) return bad('css_not_allowed')
  for (const part of parts) {
    if (isBlank(part)) continue
    const c = part.indexOf(':')
    if (c < 0) return bad('css_not_allowed')
    const rawProp = part.slice(0, c).trim()
    const value = part.slice(c + 1).trim()
    if (!value) return bad('css_not_allowed')
    if (rawProp.slice(0, 2) === '--') {
      if (!/^--[A-Za-z0-9_-]{1,64}$/.test(rawProp)) return bad('css_not_allowed')
      const v = customValue(value)
      if (v === null) return bad('css_not_allowed')
      block.decls.push([rawProp, v])
      continue
    }
    const prop = rawProp.toLowerCase()
    if (where === 'keyframe' && prop === 'animation-timing-function') {
      const groups = lex(value)
      const e = typeof groups === 'string' ? null : easing(only(groups))
      if (!e) return bad('css_not_allowed')
      block.decls.push([prop, e])
      continue
    }
    if (ANIM_PROPS.has(prop)) {
      if (where === 'keyframe' || /var\(/i.test(value)) return bad('css_not_allowed')
      const groups = lex(value)
      if (typeof groups === 'string') return bad(groups)
      if (only(groups) && WIDE.indexOf(kw(only(groups)) ?? '') >= 0) return bad('css_not_allowed')
      animated = true
      if (prop === 'animation') {
        const layers: Anim[] = []
        if (groups.length > 16) return bad('css_not_allowed')
        for (const g of groups) {
          const l = shorthandLayer(g)
          if (typeof l === 'string') return bad(l)
          layers.push(l)
        }
        st.name = layers.map(l => l.name)
        st.dur = layers.map(l => l.dur)
        st.delay = layers.map(l => l.delay)
        st.count = layers.map(l => [l.count, l.countRaw] as [number, string])
        st.ease = layers.map(l => l.ease)
        st.dir = layers.map(l => l.dir)
        named = true
        continue
      }
      const code = animLonghand(st, prop, groups)
      if (code) return bad(code)
      if (prop === 'animation-name') named = true
      continue
    }
    if (prop.slice(0, 10) === 'animation-') return bad('css_not_allowed')
    if (!CSS_PROPS.has(prop) || (where === 'keyframe' && prop === 'transform-box')) return bad('css_not_allowed')
    const v = presValue(ctx, prop, value, true, block.refs, at, ART_RULES.dash)
    if (isBad(v)) return bad(v.bad)
    block.decls.push([prop, v])
  }
  if (animated) {
    // A block that touches animation must name its animations: every block then carries a whole
    // animation, so the one that wins the cascade decides all of it and the timeline is exact.
    if (!named || !st.name) return bad('css_not_allowed')
    if (st.name.length > 16) return bad('css_not_allowed')
    // Every other list repeats to the length of the names, as CSS does.
    const pick = <T>(list: T[] | undefined, k: number, d: T): T => (list && list.length ? (list[k % list.length] as T) : d)
    block.anims = st.name.map((name, k) => {
      const c = pick(st.count, k, [1, '1'] as [number, string])
      return {
        name,
        dur: pick(st.dur, k, 0),
        delay: pick(st.delay, k, 0),
        count: c[0],
        countRaw: c[1],
        ease: pick(st.ease, k, 'ease'),
        dir: pick(st.dir, k, 'normal'),
      }
    })
  }
  return block
}

/** CSS that is refused before it is read: escapes, comments, other at-rules, outside urls. */
function prescan(css: string): ArtProblemCode | null {
  if (css.indexOf('\\') >= 0) return 'css_not_allowed'
  for (let i = css.indexOf('@'); i >= 0; i = css.indexOf('@', i + 1)) {
    if (!/^@keyframes[ \t\n]/.test(css.slice(i, i + 11))) return 'css_not_allowed'
  }
  if (!urlsAreLocal(css)) return 'external_ref'
  if (/["'<>!&]/.test(css) || css.indexOf('/*') >= 0) return 'css_not_allowed'
  return null
}

const SEL_TYPES = new Set(['svg', '*', ...Array.from(PARENTS.keys())])

/**
 * A selector list in the allowed subset, or null. A selector may not start with a bare `*`: the
 * review draws the art inline in a page, where `*` also matches the page's html and body, so
 * `* * .x` or `*{opacity:0.5}` would draw differently there than in a player's <img> or Svg. Every
 * other compound only matches inside the art (`svg` is the root, the rest are the art's own names).
 */
function selectors(text: string): string | null {
  const list = text.split(',')
  if (list.length > 32) return null
  const out: string[] = []
  for (const sel of list) {
    const compounds = splitWs(sel)
    if (!compounds.length || compounds.length > 8 || compounds[0] === '*') return null
    for (const c of compounds) {
      let i = 0
      while (i < c.length && /[A-Za-z0-9*]/.test(c[i] as string)) i++
      const type = c.slice(0, i)
      if (type && !SEL_TYPES.has(type)) return null
      while (i < c.length) {
        const mark = c[i]
        if (mark !== '.' && mark !== '#') return null
        let j = i + 1
        while (j < c.length && /[A-Za-z0-9_-]/.test(c[j] as string)) j++
        const name = c.slice(i + 1, j)
        if (!/^[A-Za-z_-][A-Za-z0-9_-]{0,63}$/.test(name)) return null
        i = j
      }
      if (!c) return null
    }
    out.push(compounds.join(' '))
  }
  return out.join(',')
}

function splitWs(s: string): string[] {
  const t = s.trim()
  return t ? t.split(/[ \t\n]+/) : []
}

function parseSheet(ctx: Ctx, cssIn: string, at: number): Sheet | null {
  const css = urlNormalize(cssIn)
  const pre = prescan(css)
  const bad = (code: ArtProblemCode) => {
    add(ctx, code, at)
    return null
  }
  if (pre) return bad(pre)
  const sheet: Sheet = { items: [] }
  let i = 0
  const n = css.length
  const skip = () => {
    while (i < n && isWs(css[i])) i++
  }
  for (;;) {
    skip()
    if (i >= n) break
    if (sheet.items.length > 512) return bad('css_not_allowed')
    if (css[i] === '@') {
      const m = /^@keyframes[ \t\n]+([A-Za-z_-][A-Za-z0-9_-]{0,63})[ \t\n]*\{/.exec(css.slice(i, i + 96))
      if (!m || !m[1] || RESERVED.has(m[1].toLowerCase()) || !ID_RE.test(m[1])) return bad('css_not_allowed')
      const kf: Keyframes = { kind: 'keyframes', name: m[1], frames: [], at }
      i += m[0].length
      for (;;) {
        skip()
        if (i >= n) return bad('css_not_allowed')
        if (css[i] === '}') {
          i++
          break
        }
        const open = css.indexOf('{', i)
        const close = open < 0 ? -1 : css.indexOf('}', open)
        if (open < 0 || close < 0 || css.slice(i, open).indexOf('}') >= 0 || css.slice(open + 1, close).indexOf('{') >= 0) return bad('css_not_allowed')
        const offsets: string[] = []
        const nums: number[] = []
        for (const o of css.slice(i, open).split(',')) {
          const t = o.trim().toLowerCase()
          let v: number | null = null
          if (t === 'from') v = 0
          else if (t === 'to') v = 100
          else if (t.slice(-1) === '%') v = num(t.slice(0, -1))
          if (v === null || v < 0 || v > 100) return bad('css_not_allowed')
          offsets.push(t === 'from' ? '0%' : t === 'to' ? '100%' : t)
          nums.push(v / 100)
        }
        if (!offsets.length || kf.frames.length >= 256) return bad('css_not_allowed')
        const block = parseBlock(ctx, css.slice(open + 1, close), 'keyframe', at)
        if (!block) return null
        kf.frames.push({ offsets, nums, block })
        i = close + 1
      }
      sheet.items.push(kf)
      continue
    }
    const open = css.indexOf('{', i)
    const close = open < 0 ? -1 : css.indexOf('}', open)
    if (open < 0 || close < 0) return bad('css_not_allowed')
    const selText = css.slice(i, open)
    const body = css.slice(open + 1, close)
    if (/[{};]/.test(selText) || body.indexOf('{') >= 0) return bad('css_not_allowed')
    const sels = selectors(selText)
    if (!sels) return bad('css_not_allowed')
    const block = parseBlock(ctx, body, 'rule', at)
    if (!block) return null
    // A rule that can match the root may not move or animate it: the root's box is the stage.
    const root = sels.split(',').some(sel => /^svg(?![A-Za-z0-9])/.test(sel.slice(sel.lastIndexOf(' ') + 1)))
    if (root && (block.anims || block.decls.some(([k]) => k.slice(0, 9) === 'transform'))) return bad('css_not_allowed')
    sheet.items.push({ kind: 'rule', sels, block })
    i = close + 1
  }
  return sheet
}

// ------------------------------------------------------------------ the XML tree

function nameAt(src: string, i: number): string | null {
  const c = src[i]
  if (!c || !/[A-Za-z_:]/.test(c)) return null
  let j = i + 1
  while (j < src.length && /[A-Za-z0-9_.:-]/.test(src[j] as string)) j++
  return j - i > 64 ? null : src.slice(i, j)
}

const ENTITIES: Record<string, number> = { lt: 60, gt: 62, amp: 38, quot: 34, apos: 39 }

/** Character data with its references decoded (the five XML entities and printable ASCII only). */
function decode(ctx: Ctx, s: string, at: number): string {
  let out = ''
  let i = 0
  for (;;) {
    const a = s.indexOf('&', i)
    if (a < 0) {
      out += s.slice(i)
      break
    }
    out += s.slice(i, a)
    const e = s.indexOf(';', a)
    if (e < 0 || e - a > 10) fatal(ctx, 'not_svg', at + a)
    const ref = s.slice(a + 1, e)
    let cp: number
    if (Object.prototype.hasOwnProperty.call(ENTITIES, ref)) cp = ENTITIES[ref] as number
    else if (/^#[0-9]{1,7}$/.test(ref)) cp = parseInt(ref.slice(1), 10)
    else if (/^#x[0-9a-fA-F]{1,6}$/.test(ref)) cp = parseInt(ref.slice(2), 16)
    else fatal(ctx, 'not_svg', at + a)
    if ((cp < 0x20 || cp > 0x7e) && cp !== 9 && cp !== 10) fatal(ctx, 'not_ascii', at + a)
    out += String.fromCharCode(cp)
    i = e + 1
  }
  return out.split('\r').join('')
}

type RawAttr = { name: string; value: string; at: number }

function parse(ctx: Ctx, src: string): El {
  const n = src.length
  let i = 0
  while (i < n && isWs(src[i])) i++
  if (src.startsWith('<?xml', i) && (isWs(src[i + 5]) || src[i + 5] === '?')) {
    const e = src.indexOf('?>', i)
    if (e < 0) fatal(ctx, 'not_svg', i)
    i = e + 2
  }
  let root: El | null = null
  let closed = false
  const stack: El[] = []
  while (i < n) {
    const top = stack.length ? (stack[stack.length - 1] as El) : null
    if (src[i] !== '<') {
      let e = src.indexOf('<', i)
      if (e < 0) e = n
      const raw = src.slice(i, e)
      if (!top) {
        if (!isBlank(raw)) fatal(ctx, 'not_svg', i)
      } else {
        const text = decode(ctx, raw, i)
        if (!top.bad) {
          if (TEXTUAL.has(top.name) || top.name === 'style') top.kids.push({ kind: 'text', text, at: i })
          else if (!isBlank(text)) add(ctx, 'not_svg', i)
        }
      }
      i = e
      continue
    }
    if (src.startsWith('<!--', i)) {
      const e = src.indexOf('-->', i + 4)
      if (e < 0) fatal(ctx, 'not_svg', i)
      i = e + 3
      continue
    }
    if (src.startsWith('<!', i)) {
      const word = src.slice(i + 2, i + 9).toUpperCase()
      const decl = ['DOCTYPE', 'ENTITY', 'ELEMENT', 'ATTLIST'].some(d => word.startsWith(d))
      fatal(ctx, decl ? 'doctype' : 'not_svg', i)
    }
    if (src.startsWith('<?', i)) fatal(ctx, 'not_svg', i)
    if (src.startsWith('</', i)) {
      const name = nameAt(src, i + 2)
      if (!name || !top || top.name !== name) fatal(ctx, 'not_svg', i)
      let j = i + 2 + name.length
      while (isWs(src[j])) j++
      if (src[j] !== '>') fatal(ctx, 'not_svg', j)
      stack.pop()
      closeElement(ctx, top)
      if (!stack.length) closed = true
      i = j + 1
      continue
    }
    const at = i
    const name = nameAt(src, i + 1)
    if (!name || closed) fatal(ctx, 'not_svg', i)
    let j = i + 1 + name.length
    const raw: RawAttr[] = []
    let selfClose = false
    for (;;) {
      const before = j
      while (isWs(src[j])) j++
      if (src[j] === '>') {
        j++
        break
      }
      if (src[j] === '/') {
        if (src[j + 1] !== '>') fatal(ctx, 'not_svg', j)
        selfClose = true
        j += 2
        break
      }
      if (j === before || raw.length >= 64) fatal(ctx, 'not_svg', j)
      const an = nameAt(src, j)
      if (!an) fatal(ctx, 'not_svg', j)
      const aAt = j
      j += an.length
      while (isWs(src[j])) j++
      if (src[j] !== '=') fatal(ctx, 'not_svg', j)
      j++
      while (isWs(src[j])) j++
      const q = src[j]
      if (q !== '"' && q !== "'") fatal(ctx, 'not_svg', j)
      const e = src.indexOf(q, j + 1)
      if (e < 0) fatal(ctx, 'not_svg', j)
      const rawVal = src.slice(j + 1, e)
      if (rawVal.indexOf('<') >= 0 || raw.some(a => a.name === an)) fatal(ctx, 'not_svg', aAt)
      // XML attribute value normalization: every whitespace character becomes a space.
      raw.push({ name: an, value: decode(ctx, rawVal, j + 1).replace(/[\t\n]/g, ' '), at: aAt })
      j = e + 1
    }
    const el = openElement(ctx, name, raw, top, at)
    if (!root) root = el
    if (top) top.kids.push(el)
    if (selfClose) {
      closeElement(ctx, el)
      if (!top) closed = true
    } else stack.push(el)
    i = j
  }
  if (!root || stack.length) fatal(ctx, 'not_svg', n)
  return root
}

function openElement(ctx: Ctx, name: string, raw: RawAttr[], parent: El | null, at: number): El {
  ctx.elements++
  if (ctx.elements > ctx.limits.elements) fatal(ctx, 'too_many_elements', at)
  const depth = parent ? parent.depth + 1 : 1
  if (depth > ART_RULES.depth) fatal(ctx, 'too_deep', at)
  const el: El = { kind: 'el', name, at, parent, depth, attrs: [], kids: [], id: null, refs: [], filtered: false, bad: false, style: null, sheet: null }
  if (!parent) {
    if (name !== 'svg') fatal(ctx, 'not_svg', at)
    rootAttrs(ctx, el, raw)
    return el
  }
  if (parent.bad) {
    el.bad = true
    return el
  }
  const code = elementProblem(name, parent.name)
  if (code) {
    add(ctx, code, at)
    el.bad = true
    return el
  }
  elementAttrs(ctx, el, raw)
  return el
}

function closeElement(ctx: Ctx, el: El) {
  if (el.bad) return
  if (el.name === 'style') {
    const css = el.kids.map(k => (k.kind === 'text' ? k.text : '')).join('')
    el.kids = []
    el.sheet = parseSheet(ctx, css, el.at)
  }
  if (el.name === 'filter') {
    const prims = el.kids.filter(k => k.kind === 'el').length
    if (!prims || prims > ART_RULES.filterPrimitives) add(ctx, 'filter_not_allowed', el.at)
  }
}

function rootAttrs(ctx: Ctx, el: El, raw: RawAttr[]) {
  let viewBox = false
  const rest: RawAttr[] = []
  for (const a of raw) {
    if (a.name === 'xmlns') {
      if (a.value !== SVG_NS) add(ctx, 'attribute_not_allowed', a.at)
    } else if (a.name === 'xmlns:xlink') {
      if (a.value !== XLINK_NS) add(ctx, 'attribute_not_allowed', a.at)
    } else if (a.name === 'viewBox') {
      viewBox = true
      const v = splitList(a.value).map(num)
      if (v.length !== 4 || v[0] !== 0 || v[1] !== 0 || v[2] !== ART_WIDTH || v[3] !== ART_HEIGHT) add(ctx, 'bad_viewbox', a.at)
    } else if (a.name === 'width' || a.name === 'height' || a.name === 'version') {
      // Width and height are forced to the stage; the version says nothing.
    } else rest.push(a)
  }
  if (!viewBox) add(ctx, 'bad_viewbox', el.at)
  elementAttrs(ctx, el, rest)
}

function elementAttrs(ctx: Ctx, el: El, raw: RawAttr[]) {
  const allowed = ATTRS.get(el.name) as Map<string, Kind>
  // pathLength first, since the dash rule reads it.
  let pathLength: number | null = null
  for (const a of raw) if (a.name === 'pathLength' && allowed.has('pathLength')) pathLength = num(a.value)
  const dashMin = pathLength !== null && pathLength > 0 ? pathLength / ART_RULES.dashPerPathLength : ART_RULES.dash
  const hrefs = raw.filter(a => a.name === 'href' || a.name === 'xlink:href').length
  for (const a of raw) {
    const lower = a.name.toLowerCase()
    if (lower.slice(0, 2) === 'on') {
      add(ctx, 'event_handler', a.at)
      continue
    }
    if (a.name === 'href' || a.name === 'xlink:href') {
      if (a.value.trim()[0] !== '#') add(ctx, 'external_ref', a.at)
      else if (!allowed.has('href') || hrefs > 1) add(ctx, 'attribute_not_allowed', a.at)
      else if (!ID_RE.test(a.value.slice(1))) add(ctx, 'attribute_not_allowed', a.at)
      else {
        el.refs.push({ id: a.value.slice(1), kind: el.name === 'use' ? 'use' : 'textpath', at: a.at })
        el.attrs.push(['href', a.value])
      }
      continue
    }
    if (a.name.indexOf(':') >= 0 || lower.slice(0, 5) === 'xmlns') {
      add(ctx, 'attribute_not_allowed', a.at)
      continue
    }
    const value = urlNormalize(a.value)
    if (!urlsAreLocal(value)) {
      add(ctx, 'external_ref', a.at)
      continue
    }
    const kind = allowed.get(a.name)
    if (!kind) {
      add(ctx, 'attribute_not_allowed', a.at)
      continue
    }
    const v = attrValue(ctx, el, a.name, kind, value, a.at, dashMin)
    if (v === null) continue
    if (isBad(v)) {
      add(ctx, v.bad, a.at)
      continue
    }
    el.attrs.push([a.name, v])
  }
  if (el.name === 'filter') filterRegion(ctx, el, raw)
  if (el.name === 'pattern') {
    const get = (k: string) => raw.find(a => a.name === k)
    const units = get('patternUnits')
    const w = get('width')
    const h = get('height')
    const wv = w ? num(w.value.trim()) : null
    const hv = h ? num(h.value.trim()) : null
    if (!units || units.value !== 'userSpaceOnUse' || wv === null || hv === null || wv < ART_RULES.patternTile || hv < ART_RULES.patternTile) {
      add(ctx, 'attribute_not_allowed', el.at)
    }
  }
}

/**
 * A filter's region stays near the stage: in objectBoundingBox units (the default) within a box
 * either side of the element, in userSpaceOnUse within a stage either side. Every filter pass costs
 * its region's area, so a region the size of a city is refused, as is one in em units.
 */
function filterRegion(ctx: Ctx, el: El, raw: RawAttr[]) {
  const get = (k: string) => raw.find(a => a.name === k)
  const units = get('filterUnits')
  const box = !units || units.value.trim() !== 'userSpaceOnUse'
  const m = ART_RULES.filterRegion
  const read = (k: string, size: number): number | null | undefined => {
    const a = get(k)
    if (!a) return undefined
    const x = LEN_RE.exec(a.value.trim())
    if (!x || !x[1] || x[2] === 'em') return null
    const v = num(x[1])
    if (v === null) return null
    if (box) return x[2] === '%' ? v / 100 : x[2] === 'px' ? null : v
    return x[2] === '%' ? (v / 100) * size : v
  }
  const checks: [string, number, number, number][] = box
    ? [
        ['x', 1, -m, m],
        ['y', 1, -m, m],
        ['width', 1, 0, 2 * m + 1],
        ['height', 1, 0, 2 * m + 1],
      ]
    : [
        ['x', ART_WIDTH, -m * ART_WIDTH, (m + 1) * ART_WIDTH],
        ['y', ART_HEIGHT, -m * ART_HEIGHT, (m + 1) * ART_HEIGHT],
        ['width', ART_WIDTH, 0, (2 * m + 1) * ART_WIDTH],
        ['height', ART_HEIGHT, 0, (2 * m + 1) * ART_HEIGHT],
      ]
  for (const [k, size, lo, hi] of checks) {
    const v = read(k, size)
    if (v === undefined) continue
    if (v === null || v < lo || v > hi || ((k === 'width' || k === 'height') && v <= 0)) add(ctx, 'filter_not_allowed', (get(k) as RawAttr).at)
  }
}

/** An attribute's canonical value, a refusal, or null to drop it (or when its problem is already added). */
function attrValue(ctx: Ctx, el: El, name: string, kind: Kind, value: string, at: number, dashMin: number): string | Bad | null {
  const v = value.trim()
  const bad = no('attribute_not_allowed')
  if (typeof kind !== 'string') return kind.indexOf(v) >= 0 ? v : bad
  switch (kind) {
    case 'id':
      if (!ID_RE.test(v)) return bad
      el.id = v
      return v
    case 'class': {
      const list = splitWs(v)
      if (!list.length || list.length > 16 || !list.every(c => /^[A-Za-z_-][A-Za-z0-9_-]{0,63}$/.test(c))) return bad
      return list.join(' ')
    }
    case 'style': {
      const css = urlNormalize(value)
      const pre = prescan(css)
      if (pre) {
        add(ctx, pre, at)
        return null
      }
      const block = parseBlock(ctx, css, 'attr', at)
      if (!block) return null
      el.style = block
      el.refs.push(...block.refs)
      return ''
    }
    case 'csstype':
      return v === 'text/css' ? null : bad
    case 'primunits':
      // In objectBoundingBox units a blur of 8 is 8 times the element's size, past any cap.
      return v === 'userSpaceOnUse' ? v : no('filter_not_allowed')
    case 'num':
      return num(v) === null ? bad : v
    case 'plen': {
      const x = num(v)
      return x === null || x <= 0 ? bad : v
    }
    case 'len':
      return len(v) === null ? bad : v
    case 'lens':
    case 'nums': {
      const list = splitList(v)
      const f = kind === 'lens' ? len : num
      if (!list.length || list.length > 256 || !list.every(x => f(x) !== null)) return bad
      return list.join(' ')
    }
    case 'points': {
      const list = splitList(v)
      if (list.length < 2 || list.length % 2 || !list.every(x => num(x) !== null)) return bad
      return list.join(' ')
    }
    case 'viewbox': {
      const list = splitList(v)
      const x = list.map(num)
      if (x.length !== 4 || x.some(y => y === null) || (x[2] as number) <= 0 || (x[3] as number) <= 0) return bad
      return list.join(' ')
    }
    case 'path':
      return pathData(v) ?? bad
    case 'name':
      return ID_RE.test(v) ? v : bad
    case 'par': {
      const parts = splitWs(v)
      const align = parts[0]
      if (!align || parts.length > 2 || !/^(?:none|x(?:Min|Mid|Max)Y(?:Min|Mid|Max))$/.test(align)) return bad
      if (parts[1] && parts[1] !== 'meet' && parts[1] !== 'slice') return bad
      return parts.join(' ')
    }
    case 'font': {
      const list = v.split(',').map(x => x.trim())
      if (!list.length || !list.every(x => FONTS.indexOf(x) >= 0)) return bad
      return list.join(',')
    }
    case 'blur': {
      const list = splitList(v)
      const x = list.map(num)
      if (!x.length || x.length > 2 || x.some(y => y === null || y < 0 || y > ART_RULES.blur)) return no('filter_not_allowed')
      return list.join(' ')
    }
    case 'cmatrix': {
      const list = splitList(v)
      if (!list.length || list.length > 20 || !list.every(x => num(x) !== null)) return bad
      return list.join(' ')
    }
    case 'offset': {
      const p = v.slice(-1) === '%' ? num(v.slice(0, -1)) : num(v)
      return p === null ? bad : v
    }
    case 'miter': {
      const x = num(v)
      return x === null || x < 1 || x > 100 ? bad : v
    }
    case 'spacing':
      return v === 'normal' || len(v) !== null ? v : bad
    case 'paintorder': {
      if (v === 'normal') return v
      const parts = splitWs(v)
      if (!parts.length || parts.length > 3 || new Set(parts).size !== parts.length) return bad
      return parts.every(p => p === 'fill' || p === 'stroke' || p === 'markers') ? parts.join(' ') : bad
    }
    case 'iri': {
      if (v === 'none') return v
      const groups = lex(v)
      const one = typeof groups === 'string' ? null : only(groups)
      if (!one || one.t !== 'url') return bad
      const refKind: RefKind = name === 'filter' ? 'filter' : name === 'mask' ? 'mask' : 'clip'
      el.refs.push({ id: one.id, kind: refKind, at })
      if (refKind === 'filter') el.filtered = true
      return serTok(one)
    }
    case 'href':
      return bad
    case 'ptransform': {
      const groups = lex(v)
      if (typeof groups === 'string') return groups === 'css_not_allowed' ? bad : no(groups)
      return transformList(groups, false, true) ?? bad
    }
    case 'dash':
    case 'paint':
    case 'alpha':
    case 'color':
    case 'transform':
    case 'origin': {
      const prop = kind === 'dash' ? 'stroke-dasharray' : kind === 'transform' ? 'transform' : kind === 'origin' ? 'transform-origin' : name
      return presValue(ctx, prop, v, false, el.refs, at, dashMin)
    }
  }
  return bad
}

// ------------------------------------------------------------------ whole-document checks

function walk(el: El, f: (e: El) => void) {
  f(el)
  for (const k of el.kids) if (k.kind === 'el') walk(k, f)
}

function collectIds(ctx: Ctx, root: El): Map<string, El> {
  const ids = new Map<string, El>()
  walk(root, el => {
    if (!el.id || el.bad) return
    if (ids.has(el.id)) add(ctx, 'attribute_not_allowed', el.at)
    else ids.set(el.id, el)
  })
  return ids
}

function collectCss(ctx: Ctx, root: El, blocks: Block[], frames: Map<string, Keyframes>) {
  walk(root, el => {
    if (el.bad) return
    if (el.style && el.style.anims) blocks.push(el.style)
    if (!el.sheet) return
    for (const item of el.sheet.items) {
      if (item.kind === 'rule') {
        blocks.push(item.block)
        continue
      }
      if (frames.has(item.name)) {
        add(ctx, 'css_not_allowed', item.at)
        continue
      }
      const offs = new Set<number>([0, 1])
      for (const f of item.frames) for (const o of f.nums) offs.add(o)
      // More stops than the whole timeline may have instants can't be played within it.
      if (offs.size > 2 * ART_RULES.instants) add(ctx, 'too_complex', item.at)
      frames.set(item.name, item)
    }
  })
}

function resolveRefs(ctx: Ctx, root: El, blocks: Block[], ids: Map<string, El>, frames: Map<string, Keyframes>) {
  const check = (r: Ref) => {
    const t = ids.get(r.id)
    if (!t) add(ctx, 'external_ref', r.at)
    else if (TARGETS[r.kind].indexOf(t.name) < 0) add(ctx, 'attribute_not_allowed', r.at)
  }
  // A rule or keyframe may paint with a gradient but not a pattern: which elements a rule reaches
  // isn't known here, so a pattern's cost couldn't be counted.
  const sheetCheck = (r: Ref) => {
    if (ids.get(r.id)?.name === 'pattern') add(ctx, 'css_not_allowed', r.at)
    else check(r)
  }
  walk(root, el => {
    if (el.bad) return
    for (const r of el.refs) check(r)
    if (!el.sheet) return
    for (const item of el.sheet.items) {
      if (item.kind === 'rule') item.block.refs.forEach(sheetCheck)
      else for (const f of item.frames) f.block.refs.forEach(sheetCheck)
    }
  })
  for (const b of blocks) for (const a of b.anims ?? []) if (a.name !== 'none' && !frames.has(a.name)) add(ctx, 'css_not_allowed', b.at)
}

/** steps(n): its n, or 0 for an easing that doesn't jump. */
function stepsOf(ease: string): number {
  if (ease === 'step-start' || ease === 'step-end') return 1
  const m = /^steps\((\d+)/.exec(ease)
  return m && m[1] ? Number(m[1]) : 0
}

const BEZIERS: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  'ease-in': [0.42, 0, 1, 1],
  'ease-out': [0, 0, 0.58, 1],
  'ease-in-out': [0.42, 0, 0.58, 1],
}

/**
 * The progress at which an easing first reaches 0.5: where a value that can't interpolate flips to
 * its end value. Every allowed cubic-bezier has both y values in [0, 1], so it never decreases and
 * one bisection finds it.
 */
function flipAt(ease: string): number {
  const named = Object.prototype.hasOwnProperty.call(BEZIERS, ease) ? BEZIERS[ease] : undefined
  const m = /^cubic-bezier\(([^,]+),([^,]+),([^,]+),([^)]+)\)$/.exec(ease)
  const c = named ?? (m ? [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] : [0, 0, 1, 1])
  const b = (t: number, p1: number, p2: number) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t
  let lo = 0
  let hi = 1
  for (let k = 0; k < 40; k++) {
    const mid = (lo + hi) / 2
    if (b(mid, c[1] as number, c[3] as number) >= 0.5) hi = mid
    else lo = mid
  }
  return b(hi, c[0] as number, c[2] as number)
}

/** Properties whose values always interpolate smoothly between two keyframes. */
const SMOOTH = new Set(['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'stroke-width', 'stroke-dashoffset', 'stroke-miterlimit', 'transform', 'transform-origin', 'stop-color'])

function plainColor(v: string | undefined): boolean {
  return v !== undefined && v !== 'none' && WIDE.indexOf(v) < 0 && v.indexOf('(') < 0 ? NAMED.has(v) || v[0] === '#' : v !== undefined && /^(?:rgb|rgba|hsl|hsla)\(/.test(v)
}

/** Whether a property may jump between two keyframe values (undefined: the element's own value). */
function jumps(prop: string, a: string | undefined, b: string | undefined): boolean {
  if (a !== undefined && a === b) return false
  if (SMOOTH.has(prop)) return false
  if (prop === 'fill' || prop === 'stroke') return !(plainColor(a) && plainColor(b))
  if (prop === 'stroke-dasharray') return a === undefined || b === undefined || a === 'none' || b === 'none' || WIDE.indexOf(a) >= 0 || WIDE.indexOf(b) >= 0
  // Custom properties (unregistered, so discrete), visibility, display, and the keyword properties.
  return true
}

/** For each property a keyframes block sets: its offsets, the value at each, and the easings leaving each. */
type Track = { offs: number[]; values: (string | undefined)[]; eases: string[][] }

function tracks(kf: Keyframes, ease: string): Map<string, Track> {
  const at = new Map<string, Map<number, { value: string; eases: Set<string> }>>()
  for (const f of kf.frames) {
    let own: string | null = null
    for (const [k, v] of f.block.decls) if (k === 'animation-timing-function') own = v
    for (const o of f.nums) {
      for (const [k, v] of f.block.decls) {
        if (k === 'animation-timing-function') continue
        let byOff = at.get(k)
        if (!byOff) at.set(k, (byOff = new Map()))
        const e = byOff.get(o)
        // The same offset twice: the later value wins, and either easing may leave it.
        if (e) {
          e.value = v
          e.eases.add(own ?? ease)
        } else byOff.set(o, { value: v, eases: new Set([own ?? ease]) })
      }
    }
  }
  const out = new Map<string, Track>()
  for (const [prop, byOff] of at) {
    const offs = Array.from(new Set([0, 1, ...byOff.keys()])).sort((a, b) => a - b)
    out.set(prop, {
      offs,
      values: offs.map(o => byOff.get(o)?.value),
      // An implicit 0% or 100% keyframe leaves with the animation's own easing.
      eases: offs.map(o => Array.from(byOff.get(o)?.eases ?? [ease])),
    })
  }
  return out
}

/**
 * Every progress point (0 to 1) in one iteration where something may start, stop or jump: the
 * keyframe offsets, every steps() boundary, and where a value that can't interpolate flips under
 * its easing. Between two of them nothing jumps, so a sample anywhere between sees the whole state.
 */
function changePoints(kf: Keyframes, ease: string): number[] {
  const pts = new Set<number>([0, 1])
  for (const f of kf.frames) for (const o of f.nums) pts.add(o)
  for (const [prop, t] of tracks(kf, ease)) {
    for (let i = 0; i + 1 < t.offs.length; i++) {
      const a = t.offs[i] as number
      const b = t.offs[i + 1] as number
      for (const e of t.eases[i] as string[]) {
        const n = stepsOf(e)
        if (n) for (let k = 1; k < n; k++) pts.add(a + ((b - a) * k) / n)
        else if (jumps(prop, t.values[i], t.values[i + 1])) pts.add(a + (b - a) * flipAt(e))
      }
      if (pts.size > 2 * ART_RULES.instants) return Array.from(pts)
    }
  }
  return Array.from(pts).sort((a, b) => a - b)
}

/** Properties whose changes change brightness, for the flash rule. Custom properties count too. */
const LUMA = new Set(['opacity', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'fill', 'stroke', 'stop-color', 'visibility', 'display'])

/**
 * When an animation's brightness turns, as ms to how many turns happen then: each run of one
 * property in one direction ends in a turn, and every change of a value that isn't a plain number
 * is one. A drop and a rise at the same instant (a sawtooth's wrap) are two turns of one property;
 * different properties turning at once are one change of the picture, so they count once. Null
 * when the work runs past `budget`.
 */
function turns(a: Anim, kf: Keyframes, budget: { left: number }): Map<number, number> | null {
  const out = new Map<number, number>()
  const level = (prop: string, v: string | undefined): number | null => {
    if (v === undefined || prop.slice(-7) !== 'opacity') return null
    const x = num(v.slice(-1) === '%' ? v.slice(0, -1) : v)
    return x === null ? null : v.slice(-1) === '%' ? x / 100 : x
  }
  const iterations = Math.ceil(a.count)
  for (const [prop, t] of tracks(kf, a.ease)) {
    if (!LUMA.has(prop) && prop.slice(0, 2) !== '--') continue
    const mine = new Map<number, number>()
    let dir = 0
    let prev: { p: number; v: string | undefined } | null = null
    for (let k = 0; k < iterations; k++) {
      const flip = a.dir === 'reverse' || (a.dir === 'alternate' && k % 2 === 1) || (a.dir === 'alternate-reverse' && k % 2 === 0)
      const n = t.offs.length
      for (let j = 0; j < n; j++) {
        if (--budget.left < 0) return null
        const i = flip ? n - 1 - j : j
        const cur = { p: k + (flip ? 1 - (t.offs[i] as number) : (t.offs[i] as number)), v: t.values[i] }
        if (prev && prev.p < a.count && prev.v !== cur.v) {
          const x = level(prop, prev.v)
          const y = level(prop, cur.v)
          const known = x !== null && y !== null
          // 1 and 100% are one level, not a change.
          if (!known || x !== y) {
            const d = known ? Math.sign((y as number) - (x as number)) : 0
            const time = Math.round(a.delay + prev.p * a.dur)
            if ((d === 0 || d !== dir) && time >= 0) mine.set(time, (mine.get(time) ?? 0) + 1)
            dir = d
          }
        }
        prev = cur
      }
    }
    for (const [time, n] of mine) out.set(time, Math.max(out.get(time) ?? 0, n))
  }
  return out
}

/** More than `flashTurns` turns inside any window of `flashWindowMs`. */
function flashes(turnsAt: Map<number, number>): boolean {
  const ts = Array.from(turnsAt.keys()).sort((x, y) => x - y)
  let sum = 0
  for (let i = 0, j = 0; i < ts.length; i++) {
    sum += turnsAt.get(ts[i] as number) as number
    while ((ts[i] as number) - (ts[j] as number) >= ART_RULES.flashWindowMs) sum -= turnsAt.get(ts[j++] as number) as number
    if (sum > ART_RULES.flashTurns) return true
  }
  return false
}

/** The instants, the end of the last animation, and the timing rules. */
function timeline(ctx: Ctx, blocks: Block[], frames: Map<string, Keyframes>): { instants: number[]; duration: number } {
  const set = new Set<number>([0])
  const max = ctx.limits.ms
  let duration = 0
  let complex = false
  // Offsets that round to the same millisecond never grow the set, so the work is bounded on its own.
  let work = 0
  const budget = { left: 200000 }
  const points = new Map<string, number[]>()
  const put = (t: number) => {
    if (t >= 0 && t <= max) set.add(Math.round(t))
    if (set.size > ART_RULES.instants || ++work > 100000) complex = true
  }
  for (const b of blocks) {
    // The layers of one block play on the same elements, so their turns are judged together.
    const turnsAt = new Map<number, number>()
    for (const a of b.anims ?? []) {
      const kf = frames.get(a.name)
      if (a.name === 'none' || !kf) continue
      const end = a.delay + a.dur * a.count
      duration = Math.max(duration, end)
      let refused = false
      if (end > max) {
        add(ctx, 'too_long', b.at)
        refused = true
      }
      // The plan's rule: an iteration of 0.2 s or less repeats at most 3 times.
      if (a.dur <= ART_RULES.flashMs && a.count > ART_RULES.flashRepeats) {
        add(ctx, 'flashing', b.at)
        refused = true
      }
      put(a.delay)
      put(end)
      if (refused || a.dur === 0 || complex) continue
      const key = `${a.name} ${a.ease}`
      let offs = points.get(key)
      if (!offs) points.set(key, (offs = changePoints(kf, a.ease)))
      if (offs.length > 2 * ART_RULES.instants) {
        complex = true
        continue
      }
      const iterations = Math.ceil(a.count)
      for (let k = 0; k < iterations && !complex; k++) {
        const flip = a.dir === 'reverse' || (a.dir === 'alternate' && k % 2 === 1) || (a.dir === 'alternate-reverse' && k % 2 === 0)
        for (const o of offs) {
          const p = k + (flip ? 1 - o : o)
          if (p <= a.count) put(a.delay + p * a.dur)
          if (complex) break
        }
      }
      const ts = turns(a, kf, budget)
      if (!ts) {
        complex = true
        continue
      }
      for (const [time, n] of ts) turnsAt.set(time, Math.max(turnsAt.get(time) ?? 0, n))
    }
    // The rule over time: more than 3 flashes (6 turns of brightness) in any second is flashing,
    // however the iterations are cut.
    if (flashes(turnsAt)) add(ctx, 'flashing', b.at)
  }
  if (complex) add(ctx, 'too_complex', null)
  return { instants: Array.from(set).sort((a, b) => a - b), duration: Math.max(0, Math.round(duration)) }
}

/**
 * What drawing an element costs, counted through everything it draws: elements, glyphs, path
 * segments, guide path segments laid out through textPath (`guided`) and dashes; filtered elements
 * and offscreen layers; the expansion's height; and whether it reaches a mask, clip path or pattern.
 */
type Ex = { size: number; glyphs: number; segments: number; guided: number; dashes: number; filtered: number; layers: number; height: number; nests: boolean }

/** What the expansion budget counts, and `stats.expanded` reports: the elements and the glyphs drawn. */
function drawnOf(x: Ex): number {
  return Math.min(ART_RULES.expanded + 1, x.size + x.glyphs)
}

/**
 * The glyphs a text, tspan or textPath draws itself: the characters of its own text, a run of
 * whitespace counted once. Chrome collapses every run (`xml:space` and `white-space` are refused),
 * so this bounds what it lays out and paints.
 */
function ownGlyphs(el: El): number {
  if (!TEXTUAL.has(el.name)) return 0
  let n = 0
  for (const k of el.kids) {
    if (k.kind !== 'text') continue
    let ws = false
    for (let i = 0; i < k.text.length; i++) {
      const w = isWs(k.text[i])
      if (!w || !ws) n++
      ws = w
    }
  }
  return n
}

/** The largest font size any text can reach: the largest absolute size times every em or % growth. */
function fontBound(root: El): number {
  let px = 16
  let growth = 1
  walk(root, el => {
    const a = el.attrs.find(([k]) => k === 'font-size')
    const m = a ? LEN_RE.exec(a[1]) : null
    const v = m && m[1] !== undefined ? Math.abs(parseFloat(m[1])) : 0
    if (!m) return
    if (m[2] === 'em' || m[2] === '%') growth *= Math.max(1, m[2] === '%' ? v / 100 : v)
    else px = Math.max(px, v)
  })
  return px * growth
}

/**
 * An upper bound on the length of the outline an element strokes itself, in its own units, for the
 * dash budget: with pathLength the dash pattern is laid along pathLength, so that is the length
 * that counts. Bezier segments are bounded by their control polygons, arcs by their (scaled)
 * ellipses, and a text, tspan or textPath by 10 em of outline for each character of its own text
 * plus its own stretch (its children are counted as elements of their own).
 */
function outline(el: El, font: number): number {
  const get = (k: string) => el.attrs.find(([n]) => n === k)?.[1]
  const pl = get('pathLength')
  if (pl !== undefined) return Math.abs(Number(pl))
  const len = (k: string, size = ART_WIDTH) => {
    const m = LEN_RE.exec(get(k) ?? '0')
    const v = m && m[1] !== undefined ? Math.abs(parseFloat(m[1])) : 0
    return m && m[2] === '%' ? (v / 100) * size : m && m[2] === 'em' ? v * font : v
  }
  const pts = (k: string, close: boolean) => {
    const v = splitList(get(k) ?? '').map(Number)
    let total = 0
    for (let i = 2; i + 1 < v.length; i += 2) total += Math.hypot((v[i] as number) - (v[i - 2] as number), (v[i + 1] as number) - (v[i - 1] as number))
    if (close && v.length >= 4) total += Math.hypot((v[0] as number) - (v[v.length - 2] as number), (v[1] as number) - (v[v.length - 1] as number))
    return total
  }
  switch (el.name) {
    case 'rect':
      return 2 * (len('width') + len('height', ART_HEIGHT))
    case 'circle':
      return 2 * Math.PI * len('r')
    case 'ellipse':
      return 2 * Math.PI * Math.max(len('rx'), len('ry', ART_HEIGHT))
    case 'line':
      // Each coordinate's size, not its sign: a bound, not the length.
      return len('x1') + len('x2') + len('y1', ART_HEIGHT) + len('y2', ART_HEIGHT)
    case 'polyline':
      return pts('points', false)
    case 'polygon':
      return pts('points', true)
    case 'path':
      return pathBound(get('d') ?? '')
    case 'text':
    case 'tspan':
    case 'textPath': {
      let chars = 0
      for (const k of el.kids) if (k.kind === 'text') for (let i = 0; i < k.text.length; i++) if (!isWs(k.text[i])) chars++
      const tl = get('textLength')
      const stretch = tl ? 6 * Math.abs(parseFloat(tl) || 0) * (/em$/.test(tl) ? font : /%$/.test(tl) ? ART_WIDTH / 100 : 1) : 0
      return chars * 10 * font + stretch
    }
  }
  return 0
}

/**
 * The segments an element's own outline has, for the segment budget: a path's drawing commands
 * (each repeat of one counted, and a command with too few numbers still counted once), a
 * polyline's or polygon's points. A scanline rasterizer walks every segment on every row it
 * crosses, and one segment can cross the whole stage, so a path counted once whatever its length
 * let 9,700 draws of a 2,000-segment path through at 103 s a draw. The basic shapes have at most
 * eight segments each, which the expansion budget already counts as one element.
 */
function ownSegments(el: El): number {
  const get = (k: string) => el.attrs.find(([n]) => n === k)?.[1] ?? ''
  if (el.name === 'polyline' || el.name === 'polygon') return Math.ceil(splitList(get('points')).length / 2)
  if (el.name !== 'path') return 0
  const d = get('d')
  // Numbers each command takes. An arc's two flags may run into the next number, so an arc is
  // counted as at most 5 numbers: never fewer segments than Chrome draws.
  const ARGS: Record<string, number> = { m: 2, l: 2, t: 2, h: 1, v: 1, c: 6, s: 4, q: 4, a: 5 }
  let n = 0
  let cmd = ''
  let k = 0
  const close = () => {
    if (cmd) n += cmd === 'z' ? 1 : Math.max(1, Math.ceil(k / (ARGS[cmd] ?? 1)))
  }
  let i = 0
  while (i < d.length) {
    const c = d[i] as string
    if (/[A-Za-z]/.test(c)) {
      close()
      cmd = c.toLowerCase()
      k = 0
      i++
      continue
    }
    NUM_STICKY.lastIndex = i
    const m = NUM_STICKY.exec(d)
    if (m && m[0]) {
      k++
      i = NUM_STICKY.lastIndex
    } else i++
  }
  close()
  return n
}

/** A stroke-dasharray value's density: dash entries per unit of length, 0 for none or a keyword. */
function densityOf(v: string | undefined): number {
  if (!v || v === 'none' || WIDE.indexOf(v) >= 0) return 0
  const xs = splitList(v).map(x => parseFloat(x))
  const sum = xs.reduce((a, b) => a + b, 0)
  return xs.length && sum > 0 && xs.every(x => Number.isFinite(x)) ? xs.length / sum : Infinity
}

/** A selector's last compound, lower-cased: its type ('' or '*' for any), classes and id. */
type Compound = { type: string; classes: string[]; id: string | null }

/** The last compound of a selector in the subset `selectors` keeps: a type or `*`, then classes and ids, compounds joined by spaces. */
function lastCompound(sel: string): Compound {
  const c = sel.slice(sel.lastIndexOf(' ') + 1).toLowerCase()
  let i = 0
  while (i < c.length && /[a-z0-9*]/.test(c[i] as string)) i++
  const out: Compound = { type: c.slice(0, i), classes: [], id: null }
  while (i < c.length) {
    const mark = c[i]
    let j = i + 1
    while (j < c.length && /[a-z0-9_-]/.test(c[j] as string)) j++
    if (mark === '.') out.classes.push(c.slice(i + 1, j))
    // Two ids in one compound match nothing; keeping either one only matches more.
    else out.id = c.slice(i + 1, j)
    i = j
  }
  return out
}

/** Whether an element matches a last compound, ignoring case: everything the whole selector matches, and more. */
function compoundMatches(c: Compound, el: El, classes: ReadonlySet<string>): boolean {
  if (c.type && c.type !== '*' && c.type !== el.name.toLowerCase()) return false
  if (c.id !== null && (el.id ?? '').toLowerCase() !== c.id) return false
  for (const k of c.classes) if (!classes.has(k)) return false
  return true
}

/** Element and selector pairs dashReach matches at most; past it every dash rule reaches every element. */
const DASH_MATCHES = 1000000

/**
 * The densest dash pattern that can reach each element, for the dash budget. Its own: its
 * attribute, its style, every rule whose last compound matches it, and every keyframes those
 * animate it with. Then what it inherits: stroke-dasharray inherits from the parent, and a use's
 * copy of an element inherits from the use, so an element takes its parent's and every use's
 * that draws it. Only rules that can set a dash are matched, and past DASH_MATCHES pairs each of
 * them reaches every element, so a sheet of thousands of selectors can't make this slow. A use
 * cycle (refused as `use_loop` by the expansion) or a chain longer than any passing art can have
 * gives every element the densest pattern anywhere.
 */
function dashReach(root: El, ids: Map<string, El>): Map<El, number> {
  const sheets: Sheet[] = []
  const frames = new Map<string, number>()
  const els: El[] = []
  walk(root, el => {
    els.push(el)
    if (el.sheet && !el.bad) sheets.push(el.sheet)
  })
  for (const sheet of sheets)
    for (const item of sheet.items) {
      if (item.kind !== 'keyframes') continue
      let d = frames.get(item.name) ?? 0
      for (const f of item.frames) for (const [k, v] of f.block.decls) if (k === 'stroke-dasharray') d = Math.max(d, densityOf(v))
      frames.set(item.name, d)
    }
  const of = (b: Block | null) => {
    let d = 0
    if (!b) return d
    for (const [k, v] of b.decls) if (k === 'stroke-dasharray') d = Math.max(d, densityOf(v))
    for (const a of b.anims ?? []) d = Math.max(d, frames.get(a.name) ?? 0)
    return d
  }
  // Every selector of a rule that can set a dash, with that rule's densest pattern.
  const sels: { c: Compound; d: number }[] = []
  let ruled = 0
  for (const sheet of sheets)
    for (const item of sheet.items) {
      const d = item.kind === 'rule' ? of(item.block) : 0
      if (item.kind !== 'rule' || d <= 0) continue
      ruled = Math.max(ruled, d)
      for (const sel of item.sels.split(',')) sels.push({ c: lastCompound(sel), d })
    }
  const matchAll = els.length * sels.length > DASH_MATCHES
  const reach = new Map<El, number>()
  const users = new Map<El, El[]>()
  let densest = 0
  for (const el of els) {
    let d = Math.max(densityOf(el.attrs.find(([k]) => k === 'stroke-dasharray')?.[1]), of(el.style))
    if (matchAll) d = Math.max(d, ruled)
    else if (sels.length) {
      const classes = new Set(splitList(el.attrs.find(([k]) => k === 'class')?.[1] ?? '').map(c => c.toLowerCase()))
      for (const s of sels) if (s.d > d && compoundMatches(s.c, el, classes)) d = s.d
    }
    reach.set(el, d)
    densest = Math.max(densest, d)
    for (const ref of el.refs) {
      const t = ref.kind === 'use' ? ids.get(ref.id) : undefined
      if (t) users.set(t, (users.get(t) ?? []).concat(el))
    }
  }
  // Inheritance, to a fixed point: a parent comes before its children in document order, but a use
  // may come before or after what it draws, so each pass carries every use one step further.
  for (let pass = 0; ; pass++) {
    if (pass > ART_RULES.expandedDepth + 2) {
      for (const el of els) reach.set(el, densest)
      break
    }
    let moved = false
    for (const el of els) {
      let d = reach.get(el) as number
      if (el.parent) d = Math.max(d, reach.get(el.parent) as number)
      for (const u of users.get(el) ?? []) d = Math.max(d, reach.get(u) as number)
      if (d > (reach.get(el) as number)) {
        reach.set(el, d)
        moved = true
      }
    }
    if (!moved) break
  }
  return reach
}

/** An upper bound on a path's length: lines exactly, curves by their control polygons, arcs by their ellipses. */
function pathBound(d: string): number {
  const ARGS = new Map<string, number>([
    ['m', 2],
    ['l', 2],
    ['h', 1],
    ['v', 1],
    ['c', 6],
    ['s', 4],
    ['q', 4],
    ['t', 2],
    ['a', 7],
  ])
  let cmd = ''
  let prev = ''
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  let kx = 0
  let ky = 0
  let total = 0
  const a: number[] = []
  const at = (k: number) => a[k] as number
  const go = (nx: number, ny: number) => {
    total += Math.hypot(nx - x, ny - y)
    x = nx
    y = ny
  }
  let i = 0
  while (i < d.length) {
    const c = d[i] as string
    if (isWs(c) || c === ',') {
      i++
      continue
    }
    if (/[A-Za-z]/.test(c)) {
      cmd = c
      a.length = 0
      i++
      if (c === 'z' || c === 'Z') {
        go(sx, sy)
        prev = 'z'
      }
      continue
    }
    const low = cmd.toLowerCase()
    const want = ARGS.get(low)
    if (!want) return Infinity
    if (low === 'a' && (a.length === 3 || a.length === 4)) {
      // Arc flags are one character each, and may run into the next number.
      if (c !== '0' && c !== '1') return Infinity
      a.push(Number(c))
      i++
    } else {
      NUM_STICKY.lastIndex = i
      const m = NUM_STICKY.exec(d)
      if (!m) return Infinity
      a.push(parseFloat(m[0]))
      i = NUM_STICKY.lastIndex
    }
    if (a.length < want) continue
    const rel = cmd !== cmd.toUpperCase()
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    const p0x = x
    const p0y = y
    switch (low) {
      case 'm':
        x = ox + at(0)
        y = oy + at(1)
        sx = x
        sy = y
        cmd = rel ? 'l' : 'L'
        break
      case 'l':
        go(ox + at(0), oy + at(1))
        break
      case 'h':
        go(ox + at(0), y)
        break
      case 'v':
        go(x, oy + at(0))
        break
      case 'c':
      case 's': {
        const reflect = prev === 'c' || prev === 's'
        const c1x = low === 'c' ? ox + at(0) : reflect ? 2 * x - kx : x
        const c1y = low === 'c' ? oy + at(1) : reflect ? 2 * y - ky : y
        const j = low === 'c' ? 2 : 0
        kx = ox + at(j)
        ky = oy + at(j + 1)
        const ex = ox + at(j + 2)
        const ey = oy + at(j + 3)
        total += Math.hypot(c1x - p0x, c1y - p0y) + Math.hypot(kx - c1x, ky - c1y)
        x = kx
        y = ky
        go(ex, ey)
        break
      }
      case 'q':
      case 't': {
        const reflect = prev === 'q' || prev === 't'
        kx = low === 'q' ? ox + at(0) : reflect ? 2 * x - kx : x
        ky = low === 'q' ? oy + at(1) : reflect ? 2 * y - ky : y
        const j = low === 'q' ? 2 : 0
        total += Math.hypot(kx - p0x, ky - p0y)
        x = kx
        y = ky
        go(ox + at(j), oy + at(j + 1))
        break
      }
      case 'a': {
        const ex = ox + at(5)
        const ey = oy + at(6)
        let rx = Math.abs(at(0))
        let ry = Math.abs(at(1))
        const chord = Math.hypot(ex - x, ey - y)
        if (rx === 0 || ry === 0) total += chord
        else {
          // Radii too small to reach are scaled up until they do, which can make a long arc.
          const phi = (at(2) * Math.PI) / 180
          const hx = (x - ex) / 2
          const hy = (y - ey) / 2
          const x1 = Math.cos(phi) * hx + Math.sin(phi) * hy
          const y1 = -Math.sin(phi) * hx + Math.cos(phi) * hy
          const lam = (x1 * x1) / (rx * rx) + (y1 * y1) / (ry * ry)
          if (lam > 1) {
            rx *= Math.sqrt(lam)
            ry *= Math.sqrt(lam)
          }
          total += 2 * Math.PI * Math.max(rx, ry)
        }
        x = ex
        y = ey
        break
      }
    }
    prev = low === 'm' ? 'm' : low
    a.length = 0
  }
  return total
}

/**
 * Expansion: how much the drawing really draws. Every reference that draws other content is
 * followed for each element that makes it: `use`, `mask`, `clip-path`, and a fill or stroke painted
 * with a pattern (the pattern's tile is drawn for every element the paint reaches, so its content
 * counts once per element under the painting one). A cycle through any of them is `use_loop`; more
 * than 20,000 elements and glyphs drawn is `use_budget`. Every glyph of text counts as an element
 * does, multiplied the same way, since Chrome lays out and paints each use's copy of a text: a
 * text counted as one element whatever its length let 1,700 uses of 30,000 characters through, at
 * seconds a draw. A pattern's tile is drawn once per element its paint reaches, not per glyph.
 * Path segments and dashes are multiplied the same way: more than `ART_RULES.glyphs` glyphs or
 * `ART_RULES.segments` segments drawn is `use_budget`, and more than `ART_RULES.dashes` dash
 * entries is refused with the finest dash's own code. A `textPath` counts its referenced path's
 * segments as guide segments (`guided`), multiplied the same way, and more than
 * `ART_RULES.textPathSegments` of them laid out is `use_budget`: Chrome measures that path's
 * geometry to lay the text along it, once for every drawn copy, so a one-glyph text on an
 * arc-heavy path copied through use drew seconds to minutes while the path was counted only once
 * (W10d's review), and under the 40,000 segment budget it still drew about 0.7 s (W10d-textpath's
 * review). Each of those can cost what a shape the size of the stage costs (a transform can
 * enlarge a glyph, stretch a segment across the stage, or squeeze thousands of dashes into a pixel
 * each as tall as the stroke), so each is counted, not judged by its size. Masks, clip paths and patterns don't nest: one whose content (or inherited paint)
 * reaches another mask, clip path or pattern is `use_budget`, since nesting them multiplies the
 * drawing at every level. Each masked or clipped element drawn is an offscreen layer, and more
 * than `ART_RULES.layers` of them is `use_budget` too.
 */
function expand(ctx: Ctx, root: El, ids: Map<string, El>): Ex {
  const cap = ART_RULES.expanded + 1
  const LONG = 1e15
  const font = fontBound(root)
  const reach = dashReach(root, ids)
  const memo = new Map<El, Ex>()
  const path = new Set<El>()
  const isPattern = (r: Ref) => r.kind === 'paint' && ids.get(r.id)?.name === 'pattern'
  // Pattern paint set on an element (or its ancestors) is inherited by everything under it, a
  // pattern's or mask's content included.
  const paintedAbove = (el: El) => {
    for (let e: El | null = el; e; e = e.parent) if (e.refs.some(isPattern)) return true
    return false
  }
  const visit = (el: El, depth: number): Ex => {
    const m = memo.get(el)
    if (m) return m
    if (path.has(el)) fatal(ctx, 'use_loop', el.at)
    if (depth > ART_RULES.expandedDepth) fatal(ctx, 'too_deep', el.at)
    path.add(el)
    // Its own dashes: its outline under the densest pattern that can reach it. A bound that isn't a
    // finite number counts as the most: NaN must never compare its way past the budget.
    const density = reach.get(el) ?? 0
    const length = outline(el, font)
    const dashes = density > 0 ? (Number.isFinite(length) && Number.isFinite(density) ? Math.min(LONG, length * density) : LONG) : 0
    const r: Ex = { size: 1, glyphs: ownGlyphs(el), segments: ownSegments(el), guided: 0, dashes, filtered: el.filtered ? 1 : 0, layers: 0, height: 1, nests: false }
    const take = (x: Ex, times = 1) => {
      r.size = Math.min(cap, r.size + x.size * times)
      r.glyphs = Math.min(cap, r.glyphs + x.glyphs * times)
      r.segments = Math.min(LONG, r.segments + x.segments * times)
      r.guided = Math.min(LONG, r.guided + x.guided * times)
      r.dashes = Math.min(LONG, r.dashes + x.dashes * times)
      r.filtered = Math.min(cap, r.filtered + x.filtered * times)
      r.layers = Math.min(cap, r.layers + x.layers * times)
      r.height = Math.max(r.height, x.height + 1)
      r.nests = r.nests || x.nests
    }
    for (const k of el.kids) if (k.kind === 'el' && !k.bad) take(visit(k, depth + 1))
    // In this order: what the element draws (its children and a use's target), then the patterns
    // painted on all of that, then the masks and clip paths applied to it once.
    const edges = (want: (ref: Ref) => boolean, f: (x: Ex, t: El, ref: Ref) => void) => {
      for (const ref of el.refs) {
        if (!want(ref)) continue
        const t = ids.get(ref.id)
        if (t && !t.bad) f(visit(t, depth + 1), t, ref)
      }
    }
    const layer = (x: Ex, t: El, ref: Ref) => {
      // A mask, clip path or pattern whose own content draws through another one.
      if (x.nests || (t.name !== 'clipPath' && paintedAbove(t))) add(ctx, 'use_budget', ref.at)
      r.nests = true
    }
    if (el.name === 'use') edges(ref => ref.kind === 'use', x => take(x))
    // A textPath lays its text along the path it references, and Chrome measures that path's
    // geometry (its segments) to place the glyphs each time the text is drawn. The path is counted
    // once where it sits in the tree, but that layout cost repeats per drawn copy, so the textPath
    // counts the path's segments as its own guide segments: use, masks, clip paths and patterns then
    // multiply them the same way they multiply this text's glyphs. They get their own budget, not the
    // 40,000 segments: one glyph on a 2,800-arc path, 100 copies through use, drew 15 s to past
    // 240 s with the path counted only once (W10d's review), and counted toward the segment budget,
    // 281 copies of one glyph on a 100-arc path still passed at about 0.7 s (W10d-textpath's review).
    if (el.name === 'textPath') edges(ref => ref.kind === 'textpath', x => (r.guided = Math.min(LONG, r.guided + x.segments)))
    const drawn = r.size
    edges(isPattern, (x, t, ref) => {
      layer(x, t, ref)
      take(x, drawn)
    })
    edges(
      ref => ref.kind === 'mask' || ref.kind === 'clip',
      (x, t, ref) => {
        layer(x, t, ref)
        take(x)
        r.layers = Math.min(cap, r.layers + 1)
      },
    )
    path.delete(el)
    memo.set(el, r)
    return r
  }
  const r = visit(root, 1)
  if (r.height > ART_RULES.expandedDepth) add(ctx, 'too_deep', null)
  if (drawnOf(r) > ART_RULES.expanded || r.glyphs > ART_RULES.glyphs || r.segments > ART_RULES.segments || r.guided > ART_RULES.textPathSegments || r.layers > ART_RULES.layers) add(ctx, 'use_budget', null)
  if (r.filtered > ART_RULES.filtered) add(ctx, 'filter_not_allowed', null)
  // A dash may reach a stroke through inheritance, a rule or keyframes, so each outline is counted
  // with the densest pattern that can reach it: the count the per-entry floor can't see.
  if (ctx.dash && r.dashes > ART_RULES.dashes) add(ctx, ctx.dash.code, ctx.dash.at)
  return r
}

function collectTexts(root: El): string[] {
  const out: string[] = []
  const textOf = (el: El): string => el.kids.map(k => (k.kind === 'text' ? k.text : textOf(k))).join('')
  walk(root, el => {
    if (el.name !== 'text' || el.bad) return
    const t = textOf(el).replace(/\s+/g, ' ').trim()
    if (t) out.push(t)
  })
  return out
}

// ------------------------------------------------------------------ the canonical serializer

/** What freezing can add: `;animation-play-state:` per block; `,paused` and a longer delay per layer. */
const FREEZE_BLOCK = 28
const FREEZE_LAYER = 17

function fmtMs(ms: number): string {
  const a = Math.abs(Math.round(ms))
  const whole = Math.floor(a / 1000)
  const frac = a % 1000
  const s = frac ? `${whole}.${String(frac + 1000).slice(1).replace(/0+$/, '')}` : String(whole)
  return (ms < 0 && a ? '-' : '') + s + 's'
}

function serBlock(b: Block, freezeMs: number | null): string {
  const parts = b.decls.map(([k, v]) => `${k}:${v}`)
  const a = b.anims
  if (a && a.length) {
    const list = (f: (x: Anim) => string) => a.map(f).join(',')
    parts.push(`animation-name:${list(x => x.name)}`)
    parts.push(`animation-duration:${list(x => fmtMs(x.dur))}`)
    parts.push(`animation-delay:${list(x => fmtMs(freezeMs === null ? x.delay : x.delay - freezeMs))}`)
    parts.push(`animation-iteration-count:${list(x => x.countRaw)}`)
    parts.push(`animation-timing-function:${list(x => x.ease)}`)
    parts.push(`animation-direction:${list(x => x.dir)}`)
    parts.push(`animation-fill-mode:${list(() => 'both')}`)
    if (freezeMs !== null) parts.push(`animation-play-state:${list(() => 'paused')}`)
  }
  return parts.join(';')
}

function serSheet(s: Sheet, freezeMs: number | null): string {
  return s.items
    .map(item =>
      item.kind === 'rule'
        ? `${item.sels}{${serBlock(item.block, freezeMs)}}`
        : `@keyframes ${item.name}{${item.frames.map(f => `${f.offsets.join(',')}{${serBlock(f.block, null)}}`).join('')}}`,
    )
    .join('')
}

function escText(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escAttr(s: string) {
  return escText(s).replace(/"/g, '&quot;')
}

function serialize(ctx: Ctx, el: El): string {
  if (el.name === 'style') {
    // The CSS grammar above can't produce < or &, and escaping keeps it that way if it ever could.
    const css = el.sheet ? escText(serSheet(el.sheet, ctx.freezeMs)) : ''
    return css ? `<style>${css}</style>` : ''
  }
  let s = `<${el.name}`
  if (!el.parent) s += ` xmlns="${SVG_NS}" viewBox="0 0 ${ART_WIDTH} ${ART_HEIGHT}" width="${ART_WIDTH}" height="${ART_HEIGHT}"`
  for (const [k, v] of el.attrs) {
    const value = k === 'style' ? (el.style ? serBlock(el.style, ctx.freezeMs) : '') : v
    if (k === 'style' && !value) continue
    s += ` ${k}="${escAttr(value)}"`
  }
  const textual = TEXTUAL.has(el.name)
  const inner = el.kids.map(k => (k.kind === 'el' ? serialize(ctx, k) : textual ? escText(k.text) : '')).join('')
  return inner ? `${s}>${inner}</${el.name}>` : `${s}/>`
}
