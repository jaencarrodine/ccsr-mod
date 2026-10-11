// The server's actions and links, read in one place (build plan, "Action
// vocabulary"). Pure: no `$` here. Every frozen surface that draws something
// the server sent (a bucket's checklist, a notice's buttons, a share link)
// parses its actions with parseAction and checks its links with safeLink, so
// three parsers can't drift and a handler can't be missing at the freeze.
//
// Each action is an object keyed `do`, with an optional button `label`:
//
//   do           shape                          handler (register.tsx)
//   open         { url }                        Link (always https://ccsr.gg/go/<id>)
//   tab          { tab }                        selectTab / openPane
//   queue        { lengths: minutes[], bucket? } queueWith($, { lengthsMin, bucket })
//   challenge    { handle?, length_min? }       openChallengeForm(handle?, lengthMin?)
//   signin       { provider: 'github' }         startSignIn($, provider, from)
//   install_app  { url }                        Link after installAppUrlOk
//   copy         { text }                       $.ui.copy
//   update       {}                             the update (version.ts UPDATE_ARGV)
//   snooze       { min }                        the notice sleeps that many minutes
//   dismiss      {}                             the notice goes away
//   notice       { id }                         opens that notice
//
// Two outcomes besides a good action:
//   - Dropped (null): an unknown `do`, a missing or wrong field, an unknown key,
//     a link that isn't safe. A notice with a dropped action is dropped whole.
//   - Hidden (`hidden: true`): well formed, but config has the feature off for
//     this player (unknown means off), so the button isn't drawn.
//
// The shapes of copy, update, snooze, dismiss and notice follow the build
// plan's vocabulary; W4b checks them against W4's spec before the freeze.
// Every limit here freezes with the mod, so the server must stay inside it:
// docs/architecture.md lists them for W3a, W4a and W5a ("Limits the server
// must stay inside").

import { cleanServer, type ModConfig } from './config'

export const ACTION_DOS = ['open', 'tab', 'queue', 'challenge', 'signin', 'install_app', 'copy', 'update', 'snooze', 'dismiss', 'notice'] as const
export type ActionDo = (typeof ACTION_DOS)[number]

/** The tabs an action may open: the five in the frame, and the Finishers view (W10b). */
export const ACTION_TABS = ['match', 'ranked', 'grind', 'chat', 'settings', 'finishers'] as const
export type ActionTab = (typeof ACTION_TABS)[number]

export const PROVIDERS = ['github'] as const
export type Provider = (typeof PROVIDERS)[number]

/** Where a server link may go. Anything else goes through https://ccsr.gg/go/<id>. */
export const LINK_HOSTS: readonly string[] = ['ccsr.gg', 'github.com']

/** The engine refuses a Link href longer than this (and so the whole tree it's in). */
export const LINK_MAX = 2048
export const LABEL_MAX = 32
export const COPY_MAX = 280
/** A length in minutes, as the server stores it (matches_length_min_check). */
export const LENGTH_MIN_RANGE = [5, 1440] as const
/** At most this many lengths in one queue action, as POST /queue takes. */
export const QUEUE_LENGTHS_MAX = 8
/** A snooze, in minutes: 5 minutes to a week. */
export const SNOOZE_MIN_RANGE = [5, 10_080] as const

export type ActionBody =
  | { do: 'open'; url: string }
  | { do: 'tab'; tab: ActionTab }
  | { do: 'queue'; lengthsMin: number[]; bucket: string | null }
  | { do: 'challenge'; handle: string | null; lengthMin: number | null }
  | { do: 'signin'; provider: Provider }
  | { do: 'install_app'; url: string }
  | { do: 'copy'; text: string }
  | { do: 'update' }
  | { do: 'snooze'; min: number }
  | { do: 'dismiss' }
  | { do: 'notice'; id: string }

/** A parsed action: what to do, the button's label if the server sent one, and whether config hides it. */
export type Action = ActionBody & { label: string | null; hidden: boolean }

const HANDLE = /^[a-z0-9_]{2,20}$/
const BUCKET = /^[a-z][a-z0-9_]{0,31}$/
const NOTICE_ID = /^[a-z0-9][a-z0-9-]{0,39}$/
/**
 * A GitHub App slug: lowercase letters, digits, `_` and `-`, at most 100, no
 * `-` at either end. W5a checks GITHUB_APP_SLUG against this same pattern at boot.
 */
export const APP_SLUG = /^[a-z0-9_](?:[a-z0-9_-]{0,98}[a-z0-9_])?$/
/**
 * A GitHub App's install page, as the server builds it from GITHUB_APP_SLUG,
 * with GitHub's optional `state` (handed back to the app's setup URL).
 */
const INSTALL_APP = /^https:\/\/github\.com\/apps\/([^/?#]+)\/installations\/new(?:\?state=[A-Za-z0-9_-]{1,64})?$/

/** The keys each action may carry besides `do` and `label`, and which of them it must. */
const KEYS: Record<ActionDo, { must: string[]; may: string[] }> = {
  open: { must: ['url'], may: [] },
  tab: { must: ['tab'], may: [] },
  queue: { must: ['lengths'], may: ['bucket'] },
  challenge: { must: [], may: ['handle', 'length_min'] },
  signin: { must: ['provider'], may: [] },
  install_app: { must: ['url'], may: [] },
  copy: { must: ['text'], may: [] },
  update: { must: [], may: [] },
  snooze: { must: ['min'], may: [] },
  dismiss: { must: [], may: [] },
  notice: { must: ['id'], may: [] },
}

/**
 * A link the mod may draw: https, a host in `hosts` exactly (no port, no
 * subdomain, no look-alike), printable ASCII with no space, at most 2048
 * characters, no `@` anywhere and no userinfo, and spelled exactly as
 * `new URL(u).href` (so `https://ccsr.gg` without its slash fails). The engine
 * refuses a whole render tree over one bad href, so nothing else gets near a Link.
 */
export function safeLink(u: unknown, hosts: readonly string[]): u is string {
  if (typeof u !== 'string' || u.length === 0 || u.length > LINK_MAX) return false
  if (!/^[\x21-\x7e]+$/.test(u) || u.includes('@')) return false
  let url: URL
  try {
    url = new URL(u)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username !== '' || url.password !== '') return false
  if (!hosts.includes(url.host)) return false
  return url.href === u
}

/** The GitHub App's install page, and nothing else on github.com. */
export function installAppUrlOk(u: unknown): u is string {
  if (!safeLink(u, ['github.com'])) return false
  // APP_SLUG refuses '', so no match is a refusal.
  return APP_SLUG.test(INSTALL_APP.exec(u)?.[1] ?? '')
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function intIn(v: unknown, [lo, hi]: readonly [number, number]): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi
}

/**
 * Server text for a label or a copy, as one line: each run of line breaks and
 * tabs becomes one space (so `GG.\nhttps://...` keeps its words apart, and a
 * copied command can never carry the newline that would run it on paste), then
 * cleanServer, trimmed, 1 to `max` characters; otherwise null.
 */
function text(v: unknown, max: number) {
  if (typeof v !== 'string') return null
  const s = cleanServer(v.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')).trim()
  return s.length > 0 && s.length <= max ? s : null
}

/** A bucket the player can queue in, and its lengths, from config's `buckets` section; null when it isn't one. */
function queueable(raw: Readonly<Record<string, unknown>>, id: string) {
  const list = Array.isArray(raw.buckets) ? raw.buckets : []
  const b = list.find((x): x is Record<string, unknown> => isObject(x) && x.id === id)
  if (!b || b.can_queue !== true || !Array.isArray(b.lengths)) return null
  return b.lengths.filter((n): n is number => typeof n === 'number')
}

/** Challenges are on for sending: `true`, or an object with `on` and `send` both true (W6's shape). */
function canChallenge(v: unknown) {
  return v === true || (isObject(v) && v.on === true && v.send === true)
}

function body(a: Record<string, unknown>, d: ActionDo): ActionBody | null {
  switch (d) {
    case 'open':
      return safeLink(a.url, LINK_HOSTS) ? { do: d, url: a.url } : null
    case 'tab':
      return typeof a.tab === 'string' && (ACTION_TABS as readonly string[]).includes(a.tab) ? { do: d, tab: a.tab as ActionTab } : null
    case 'queue': {
      const l = a.lengths
      if (!Array.isArray(l) || l.length === 0 || l.length > QUEUE_LENGTHS_MAX) return null
      if (!l.every(n => intIn(n, LENGTH_MIN_RANGE))) return null
      const bucket = a.bucket ?? null
      if (bucket !== null && (typeof bucket !== 'string' || !BUCKET.test(bucket))) return null
      return { do: d, lengthsMin: [...new Set(l as number[])].sort((x, y) => x - y), bucket }
    }
    case 'challenge': {
      const handle = a.handle ?? null
      const lengthMin = a.length_min ?? null
      if (handle !== null && (typeof handle !== 'string' || !HANDLE.test(handle))) return null
      if (lengthMin !== null && !intIn(lengthMin, LENGTH_MIN_RANGE)) return null
      return { do: d, handle, lengthMin }
    }
    case 'signin':
      return typeof a.provider === 'string' && (PROVIDERS as readonly string[]).includes(a.provider) ? { do: d, provider: a.provider as Provider } : null
    case 'install_app':
      return installAppUrlOk(a.url) ? { do: d, url: a.url } : null
    case 'copy': {
      const t = text(a.text, COPY_MAX)
      return t === null ? null : { do: d, text: t }
    }
    case 'snooze':
      return intIn(a.min, SNOOZE_MIN_RANGE) ? { do: d, min: a.min } : null
    case 'notice':
      return typeof a.id === 'string' && NOTICE_ID.test(a.id) ? { do: d, id: a.id } : null
    case 'update':
    case 'dismiss':
      return { do: d }
  }
}

/** Whether config has this action's feature off for this player. Unknown means off. */
function hiddenBy(b: ActionBody, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>) {
  const raw = cfg.raw
  switch (b.do) {
    case 'queue': {
      if (cfg.practiceOnly) return true
      const offered = queueable(raw, b.bucket ?? 'open')
      return !offered || !b.lengthsMin.some(n => offered.includes(n))
    }
    case 'challenge':
      // W6a refuses challenge create and accept with 403 ranked_paused under practice only.
      return cfg.practiceOnly || !canChallenge(raw.challenges)
    case 'signin': {
      const mode = isObject(raw.signin) ? raw.signin[b.provider] : undefined
      return mode !== 'dark' && mode !== 'optional'
    }
    case 'tab':
      return b.tab === 'finishers' && !(isObject(raw.finishers) && raw.finishers.on === true)
    case 'notice':
      return !(Array.isArray(raw.notices) && raw.notices.some(n => isObject(n) && n.id === b.id))
    default:
      return false
  }
}

/**
 * One action from the server, or null to drop it: an unknown `do`, a missing,
 * malformed or unknown field, or a link that fails its check. A well-formed
 * action whose feature config has off comes back with `hidden: true`. Never throws.
 */
export function parseAction(raw: unknown, cfg: Pick<ModConfig, 'practiceOnly' | 'raw'>): Action | null {
  if (!isObject(raw) || typeof raw.do !== 'string') return null
  const d = raw.do
  if (!(ACTION_DOS as readonly string[]).includes(d)) return null
  const keys = KEYS[d as ActionDo]
  for (const k of Object.keys(raw)) if (k !== 'do' && k !== 'label' && !keys.must.includes(k) && !keys.may.includes(k)) return null
  for (const k of keys.must) if (raw[k] === undefined || raw[k] === null) return null
  let label: string | null = null
  if (raw.label !== undefined && raw.label !== null) {
    label = text(raw.label, LABEL_MAX)
    if (label === null) return null
  }
  const b = body(raw, d as ActionDo)
  if (!b) return null
  return { ...b, label, hidden: hiddenBy(b, cfg) }
}
