// Sign-in with a provider's device flow (W5b, build plan "Mod lane"), provider-agnostic, as a
// pure state machine. No `$` here and no request paths: register.tsx makes each request a
// step asks for (`send`), hands the answer back, and draws the card from `state`.
//
// The flow, as the server runs it (W5a):
//   1. start: the server asks the provider for a device code and answers a flow: its id, the
//      user code, the verification page, the poll interval and when it expires.
//   2. poll: the mod polls the flow at the interval. Each answer has a status:
//        pending      keep polling
//        slow_down    keep polling, slower (the interval grows by 5 s, or to the server's)
//        done         signed in; a reply with a token when this install got one
//        unlinked     a fresh install whose provider account has no handle: pick one (join)
//        conflict     github_taken (the account is another handle's: switch or cancel) or
//                     handle_linked (this handle has another account linked: cancel)
//        expired, denied, failed, cancelled, closed   over
//   3. resolve (conflict) or join (unlinked) finish it.
//
// The flow id can mint a token, so it never sits in anything that could be kept or shown:
// `$.state` atoms are readable by every plugin, and the ledger is mirrored there. A step
// hands back an opaque FlowRef whose id lives only in this module's WeakMap; JSON,
// structuredClone and Object.keys see `{ provider }` alone. register.tsx keeps the ref in a
// module variable and reads the id with `flowIdOf` only to build a request. A step's `state`
// holds no id and no token, so it may go in an atom; its `reply` (a token, on done) goes
// only to signedIn.
//
// Every answer comes back with the `attempt` its request was sent for. An answer for an
// earlier attempt (a poll that lands after Cancel and a new start) changes nothing, except
// a start's: the server made that flow, so the step hands it back as `drop`, to cancel.
//
// No token the server minted is thrown away. A done that lands after its own card ended on
// the clock or on Cancel (a poll out at the expiry, or one the server answered before it
// heard the Cancel) is the sign-in after all: the player approved it, and the server's answer
// wins over the mod's clock. One that lands for an earlier attempt, or after the card was
// closed, comes back as `revoke`, so the caller removes the install it made. The clock waits
// ANSWER_GRACE_MS past the expiry while a poll, a switch or a join is out, and every end on
// the clock tells the server with a cancel, so its flow never stays open.
//
// Every limit here freezes with the mod at T-3, so the server must stay inside it:
// docs/architecture.md lists them for W5a ("Limits the server must stay inside").

import { PROVIDERS, safeLink, type Provider } from './actions'
import { cleanServer } from './config'

export const SIGNIN_FROM = ['first_run', 'settings', 'action', 'bucket'] as const
export type SignInFrom = (typeof SIGNIN_FROM)[number]

/** Where each provider's verification page may be. A Link goes nowhere else. */
export const PROVIDER_HOSTS: Readonly<Record<Provider, readonly string[]>> = { github: ['github.com'] }

/** A flow id: it goes in a request path, so URL-safe, and long enough not to guess. */
export const FLOW_ID = /^[A-Za-z0-9_-]{16,128}$/
/** A user code as the provider shows it (GitHub: `WDJB-MJHT`): letters, digits and inner dashes, 4 to 32. */
export const USER_CODE = /^[A-Za-z0-9][A-Za-z0-9-]{2,30}[A-Za-z0-9]$/
/** A provider login (GitHub: 1 to 39, letters, digits and dashes, no leading dash). */
export const LOGIN = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/
/** A CCSR handle, as the server takes it. */
export const HANDLE = /^[a-z0-9_]{2,20}$/
/** A token, as the server mints it: printable ASCII with no space. */
const TOKEN = /^[\x21-\x7e]{16,512}$/

/** The poll interval, in ms: the server's, held to this range. */
export const INTERVAL_MS = { min: 2000, default: 5000, max: 60_000 } as const
/** What slow_down adds to the interval when the server doesn't say. */
export const SLOW_DOWN_MS = 5000
/** How long a flow may live, in ms: the server's `expires_at`, held to this. */
export const FLOW_TTL_MS = { default: 15 * 60_000, max: 30 * 60_000 } as const
/** A poll that didn't reach the server waits longer each time, up to this. */
export const POLL_BACKOFF_MAX_MS = 60_000
/**
 * A poll, switch or join in flight at the expiry gets this long for its answer before the
 * clock ends the card: the server may be making the install or the account, and a token
 * thrown away for the mod's clock would leave it orphaned.
 */
export const ANSWER_GRACE_MS = 60_000
/** A wait the server asks for (a 409 or 429), held to this. */
export const RETRY_MAX_MS = 60 * 60_000
/** Server text drawn on the card, one line. */
export const MESSAGE_MAX = 280

export type Conflict = 'github_taken' | 'handle_linked'
export type EndWhy = 'expired' | 'denied' | 'failed' | 'cancelled' | 'closed' | 'unavailable' | 'busy' | 'unsupported' | 'invalid' | 'taken' | 'update' | 'offline' | 'refused'
/** Why a conflict or unlinked card still stands after a press: the caller draws the line. */
export type Note = 'outbox' | 'in_match' | 'handle_taken' | 'bad_handle' | 'offline' | 'refused'

type Base = { readonly provider: Provider; readonly from: SignInFrom; readonly attempt: number }
type Live = Base & { readonly expiresAt: number }
type Pressed = { readonly busy: boolean; readonly note: Note | null; readonly message: string | null }

export type SignIn =
  | { readonly phase: 'idle'; readonly attempt: number }
  | (Base & { readonly phase: 'starting' })
  | (Live & {
      readonly phase: 'waiting'
      readonly code: string
      /** The verification page, or null when it isn't a safe link: the code still shows. */
      readonly url: string | null
      readonly intervalMs: number
      readonly nextPollAt: number
      /** Polls in a row that didn't reach the server. */
      readonly misses: number
    })
  | (Live & Pressed & { readonly phase: 'unlinked'; readonly login: string | null })
  | (Live & Pressed & { readonly phase: 'conflict'; readonly conflict: Conflict | null; readonly login: string | null; readonly handle: string | null })
  | (Base & { readonly phase: 'done'; readonly login: string | null; readonly handle: string | null; readonly switched: boolean })
  | (Base & { readonly phase: 'ended'; readonly why: EndWhy; readonly message: string | null; readonly retryAt: number | null })

/** Nothing started yet. `attempt` counts starts for the life of the mod, so an answer to an old one never matches. */
export const IDLE: SignIn = Object.freeze({ phase: 'idle', attempt: 0 })

/** The account a done flow signed this install into, as POST /accounts answers it: for signedIn only. */
export type SignInReply = { token: string; player: Record<string, unknown> & { handle: string }; salt: string | null; has_recovery_key: boolean; recovery_key?: string }

/** A request to make. register.tsx builds the path; the flow's id comes from `flowIdOf`. */
export type Send =
  | { readonly do: 'start'; readonly provider: Provider; readonly tokenless: boolean; readonly attempt: number }
  | { readonly do: 'poll'; readonly at: number; readonly attempt: number }
  | { readonly do: 'resolve'; readonly choice: 'switch' | 'cancel'; readonly attempt: number }
  | { readonly do: 'join'; readonly handle: string; readonly attempt: number }

export type Step = {
  readonly state: SignIn
  /** A new flow to hold in place of any other. */
  readonly flow?: FlowRef
  /** Drop the flow held, after making `send` with it. */
  readonly forget?: true
  readonly send?: Send
  /**
   * A flow the server made for a start nobody waits for any more (cancelled, or replaced by
   * a newer start, before its answer came): resolve it with cancel and let it go. It never
   * takes the place of the flow held.
   */
  readonly drop?: FlowRef
  /** Signed in with a new token: pass to signedIn, never to an atom. */
  readonly reply?: SignInReply
  /**
   * A token the server minted for an answer nobody takes any more (an earlier attempt's, or
   * one that landed after its card was closed): remove that install with it (`GET
   * /me/installs` for the one marked `this`, then `DELETE /me/installs/:id`), unless it is
   * the token this install already holds. Never to signedIn, never to an atom.
   */
  readonly revoke?: string
  /** Whether signedIn sends this week's scores up with the account: false on a switch. */
  readonly carryWeek?: boolean
}

/** An answer as `api()` gives it: status 0 when the server wasn't reached. */
export type Answer = { status: number; json: unknown; retryAfterMs?: number | null }

// ------------------------------------------------------------------ the flow id

/** A flow, opaque: `{ provider }` to anything that looks, its id in IDS. */
export type FlowRef = { readonly provider: Provider }
const IDS = new WeakMap<FlowRef, string>()

function newFlow(provider: Provider, id: string): FlowRef {
  const ref: FlowRef = Object.freeze({ provider })
  IDS.set(ref, id)
  return ref
}

/** The flow's id, to build a request path with. Never store or show it. */
export function flowIdOf(ref: FlowRef): string | null {
  return IDS.get(ref) ?? null
}

// ------------------------------------------------------------------ reading answers

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** The flow in an answer: `{ flow: {...} }` or the flow itself. */
function flowBody(json: unknown): Record<string, unknown> | null {
  if (!isObject(json)) return null
  return isObject(json.flow) ? json.flow : json
}

/**
 * A done flow's reply: its token, player and salt in the flow, or beside it at the top level
 * when the flow came under `flow`. undefined: no token anywhere (a link on a signed-in
 * install); null: a token that doesn't read.
 */
function doneReply(json: unknown, b: Record<string, unknown>): SignInReply | null | undefined {
  const has = (o: Record<string, unknown>) => o.token !== undefined && o.token !== null
  const src = has(b) ? b : isObject(json) && json !== b && has(json) ? json : null
  return src ? replyOf(src) : undefined
}

function errorOf(json: unknown): { code: string | null; message: string | null } {
  const e = isObject(json) && isObject(json.error) ? json.error : {}
  const code = typeof e.code === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(e.code) ? e.code : null
  let message: string | null = null
  if (typeof e.message === 'string') {
    const s = cleanServer(e.message.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')).trim()
    message = s.length > 0 ? s.slice(0, MESSAGE_MAX) : null
  }
  return { code, message }
}

function textOf(v: unknown, re: RegExp) {
  return typeof v === 'string' && re.test(v) ? v : null
}

function intervalOf(v: unknown, fallback: number) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) return fallback
  return Math.min(INTERVAL_MS.max, Math.max(INTERVAL_MS.min, Math.round(v * 1000)))
}

function expiresOf(v: unknown, now: number, fallback: number) {
  const t = typeof v === 'string' ? Date.parse(v) : NaN
  if (!Number.isFinite(t)) return fallback
  return Math.min(t, now + FLOW_TTL_MS.max)
}

function retryAtOf(a: Answer, now: number) {
  const ms = a.retryAfterMs
  return typeof ms === 'number' && Number.isFinite(ms) && ms >= 0 ? now + Math.min(ms, RETRY_MAX_MS) : null
}

/** The server wasn't reached, or said to come back: try again later, nothing is over. */
function transient(status: number) {
  return status === 0 || status === 408 || status === 429 || status >= 500
}

/** A sign-in reply, checked; null when it isn't one. */
function replyOf(b: Record<string, unknown>): SignInReply | null {
  const p = b.player
  if (typeof b.token !== 'string' || !TOKEN.test(b.token)) return null
  if (!isObject(p) || typeof p.handle !== 'string' || !HANDLE.test(p.handle)) return null
  if (b.salt !== null && typeof b.salt !== 'string') return null
  const reply: SignInReply = { token: b.token, player: p as SignInReply['player'], salt: b.salt, has_recovery_key: b.has_recovery_key === true }
  if (typeof b.recovery_key === 'string') reply.recovery_key = b.recovery_key
  return reply
}

function end(s: Base, why: EndWhy, message: string | null = null, retryAt: number | null = null): Step {
  return { state: { phase: 'ended', provider: s.provider, from: s.from, attempt: s.attempt, why, message, retryAt }, forget: true }
}

/** An end on a flow the server still holds open: over here, and the server hears the cancel. */
function endOpen(s: Base, why: EndWhy): Step {
  return { ...end(s, why), send: { do: 'resolve', choice: 'cancel', attempt: s.attempt } }
}

/** A refusal that ends a start or a poll: the server's words when it sent some. */
function refused(s: Base, a: Answer, now: number): Step {
  const { code, message } = errorOf(a.json)
  if (a.status === 0 || a.status === 408 || a.status >= 500) return end(s, 'offline')
  if (a.status === 429) return end(s, 'busy', message, retryAtOf(a, now))
  if (a.status === 426) return end(s, 'update', message)
  switch (code) {
    case 'signin_closed':
      return end(s, 'closed', message)
    case 'signin_unavailable':
      return end(s, 'unavailable', message, retryAtOf(a, now))
    case 'provider_not_found':
      return end(s, 'unsupported', message)
    case 'flow_not_found':
      return end(s, 'expired', message)
    case 'flow_invalid':
      return end(s, 'invalid', message)
    case 'identity_taken':
      return end(s, 'taken', message)
    default:
      return end(s, 'refused', message)
  }
}

function inFlow(s: SignIn): s is Extract<SignIn, { phase: 'waiting' | 'unlinked' | 'conflict' }> {
  return s.phase === 'waiting' || s.phase === 'unlinked' || s.phase === 'conflict'
}

/** What a flow's status says next, from any phase that has a flow. `json` is the whole answer, `b` the flow in it. */
function byStatus(s: Extract<SignIn, { phase: 'waiting' | 'unlinked' | 'conflict' }>, json: unknown, b: Record<string, unknown>, now: number, switching: boolean): Step {
  const login = textOf(b.login, LOGIN)
  const expiresAt = expiresOf(b.expires_at, now, s.expiresAt)
  const base = { provider: s.provider, from: s.from, attempt: s.attempt }
  const { message } = errorOf(b)
  switch (b.status) {
    case 'done': {
      const reply = doneReply(json, b)
      // A token that doesn't read is never half a sign-in.
      if (reply === null) return end(s, 'failed')
      const handle = reply ? reply.player.handle : textOf(b.handle, HANDLE)
      const done: SignIn = { phase: 'done', ...base, login, handle, switched: switching }
      return reply ? { state: done, forget: true, reply, carryWeek: !switching } : { state: done, forget: true }
    }
    case 'unlinked':
      return { state: { phase: 'unlinked', ...base, expiresAt, login, busy: false, note: null, message: null } }
    case 'conflict': {
      const conflict = b.conflict === 'github_taken' || b.conflict === 'handle_linked' ? b.conflict : null
      return { state: { phase: 'conflict', ...base, expiresAt, conflict, login, handle: textOf(b.handle, HANDLE), busy: false, note: null, message: null } }
    }
    case 'expired':
    case 'denied':
    case 'failed':
    case 'cancelled':
    case 'closed':
      return end(s, b.status as EndWhy, message)
    case 'slow_down':
    case 'pending':
    default: {
      // An unknown status keeps polling: the flow still ends at its expiry.
      if (s.phase !== 'waiting') return { state: s }
      const intervalMs = b.status === 'slow_down' ? Math.min(INTERVAL_MS.max, Math.max(s.intervalMs + SLOW_DOWN_MS, intervalOf(b.interval_s, 0))) : intervalOf(b.interval_s, s.intervalMs)
      const next: SignIn = { ...s, expiresAt, intervalMs, nextPollAt: now + intervalMs, misses: 0 }
      return { state: next, send: { do: 'poll', at: next.nextPollAt, attempt: s.attempt } }
    }
  }
}

// ------------------------------------------------------------------ the presses

/** Whether a start goes without a token: the install isn't signed in, or the server no longer knows its token. */
export function tokenlessStart(token: string | null | undefined, unknownToken: boolean) {
  return !token || unknownToken
}

/**
 * Sign in pressed (first-run card, Settings, a bucket's checklist, an action). A flow
 * already open stays open: the press only shows it. `tokenless` from `tokenlessStart`.
 */
export function startSignIn(s: SignIn, provider: unknown, from: SignInFrom, tokenless: boolean): Step {
  if (s.phase === 'starting' || inFlow(s)) return { state: s }
  if (typeof provider !== 'string' || !(PROVIDERS as readonly string[]).includes(provider)) return { state: s }
  const attempt = s.attempt + 1
  const p = provider as Provider
  return { state: { phase: 'starting', provider: p, from, attempt }, forget: true, send: { do: 'start', provider: p, tokenless, attempt } }
}

/** The flow id in a start's answer that made one; null otherwise. */
function startedId(a: Answer) {
  if (a.status !== 200 && a.status !== 201) return null
  const b = flowBody(a.json)
  return b ? textOf(b.id, FLOW_ID) : null
}

/**
 * The start's answer. One that comes after its start was cancelled, or after a newer start,
 * still made a flow on the server: the step hands it back as `drop`, so the server hears
 * the cancel and the player's next start finds no flow left open.
 */
export function onStart(s: SignIn, attempt: number, a: Answer, now: number): Step {
  if (s.phase !== 'starting' || s.attempt !== attempt) {
    // Same attempt, still in a flow or done: a repeat of an answer already taken. Leave it.
    const stale = s.attempt !== attempt || s.phase === 'idle' || s.phase === 'ended'
    const orphan = stale ? startedId(a) : null
    if (orphan === null) return { state: s }
    const b = flowBody(a.json)!
    const provider = typeof b.provider === 'string' && (PROVIDERS as readonly string[]).includes(b.provider) ? (b.provider as Provider) : PROVIDERS[0]
    return { state: s, drop: newFlow(provider, orphan) }
  }
  if (a.status !== 200 && a.status !== 201) return refused(s, a, now)
  const b = flowBody(a.json)
  const id = startedId(a)
  const code = b ? textOf(b.user_code, USER_CODE) : null
  // A flow the server made but the card can't show: over here, and handed back to drop.
  const gone = (why: EndWhy): Step => (id ? { ...end(s, why), drop: newFlow(s.provider, id) } : end(s, why))
  if (!b || !id || !code) return gone('failed')
  const expiresAt = expiresOf(b.expires_at, now, now + FLOW_TTL_MS.default)
  if (expiresAt <= now) return gone('expired')
  const intervalMs = intervalOf(b.interval_s, INTERVAL_MS.default)
  const url = safeLink(b.verification_uri, PROVIDER_HOSTS[s.provider]) ? b.verification_uri : null
  const state: SignIn = { phase: 'waiting', provider: s.provider, from: s.from, attempt: s.attempt, expiresAt, code, url, intervalMs, nextPollAt: now + intervalMs, misses: 0 }
  return { state, flow: newFlow(s.provider, id), send: { do: 'poll', at: state.nextPollAt, attempt: s.attempt } }
}

/** Whether a poll is due now. */
export function pollDue(s: SignIn, now: number) {
  return s.phase === 'waiting' && now >= s.nextPollAt && now < s.expiresAt
}

/** A card still up past its expiry is over; a done or an end stands whatever the clock says. */
function expiring(s: Base, next: Step, now: number): Step {
  return inFlow(next.state) && now >= next.state.expiresAt ? endOpen(s, 'expired') : next
}

/** A done in an answer that came too late for the phase that sent it; null when it isn't one. */
function lateDone(a: Answer, kind: 'poll' | 'resolve' | 'join'): { reply: SignInReply | undefined; login: string | null; handle: string | null } | null {
  if (a.status !== 200 && a.status !== 201) return null
  if (kind === 'join') {
    const reply = isObject(a.json) ? replyOf(a.json) : null
    return reply ? { reply, login: null, handle: reply.player.handle } : null
  }
  const b = flowBody(a.json)
  if (!b || b.status !== 'done') return null
  const reply = doneReply(a.json, b)
  if (reply === null) return null
  return { reply, login: textOf(b.login, LOGIN), handle: reply ? reply.player.handle : textOf(b.handle, HANDLE) }
}

/**
 * An answer its phase no longer waits for. A done for the card's own attempt, while the card
 * shows it ended on the clock (or on Cancel, for a poll: Cancel waits for a switch or join),
 * is the sign-in after all. Any other done that minted an install (an earlier attempt's, or
 * one after the card was closed) comes back as `revoke`. A repeat of an answer already taken,
 * or anything that isn't a done, changes nothing.
 */
function late(s: SignIn, attempt: number, a: Answer, kind: 'poll' | 'resolve' | 'join'): Step {
  const d = lateDone(a, kind)
  if (!d) return { state: s }
  if (s.phase === 'ended' && s.attempt === attempt && (s.why === 'expired' || (s.why === 'cancelled' && kind === 'poll'))) {
    const switched = kind === 'resolve'
    const done: SignIn = { phase: 'done', provider: s.provider, from: s.from, attempt, login: d.login, handle: d.handle, switched }
    return d.reply ? { state: done, forget: true, reply: d.reply, carryWeek: !switched } : { state: done, forget: true }
  }
  const orphan = s.attempt !== attempt || s.phase === 'ended' || s.phase === 'idle'
  return d.reply && orphan ? { state: s, revoke: d.reply.token } : { state: s }
}

/**
 * A poll's answer. A poll that didn't reach the server waits longer and tries again. The
 * server's answer wins over the mod's clock: a done that lands past the expiry, even after
 * the clock or a Cancel ended the card, is still a sign-in.
 */
export function onPoll(s: SignIn, attempt: number, a: Answer, now: number): Step {
  if (s.phase !== 'waiting' || s.attempt !== attempt) return late(s, attempt, a, 'poll')
  if (transient(a.status)) {
    if (now >= s.expiresAt) return endOpen(s, 'expired')
    const misses = s.misses + 1
    const wait = Math.max(retryAtOf(a, now) ?? 0, now + Math.min(POLL_BACKOFF_MAX_MS, s.intervalMs * 2 ** misses)) - now
    const next: SignIn = { ...s, misses, nextPollAt: now + wait }
    return { state: next, send: { do: 'poll', at: next.nextPollAt, attempt } }
  }
  if (a.status !== 200) return refused(s, a, now)
  const b = flowBody(a.json)
  if (!b) return endOpen(s, 'failed')
  return expiring(s, byStatus(s, a.json, b, now, false), now)
}

/** Whether a switch or a join is in flight. */
function pressing(s: SignIn) {
  return (s.phase === 'conflict' || s.phase === 'unlinked') && s.busy
}

/**
 * Whether a poll may be out: one fell due before the expiry and no answer has come for it
 * (every answer moves `nextPollAt` on). A poll the caller never sent looks the same, and
 * only keeps the card up for the grace.
 */
function polling(s: SignIn, now: number) {
  return s.phase === 'waiting' && s.nextPollAt <= now && s.nextPollAt < s.expiresAt
}

/**
 * The clock: a flow past its expiry is over here too, whatever the server last said, and the
 * server hears the cancel. A poll, switch or join in flight gets ANSWER_GRACE_MS more for its
 * answer.
 */
export function onTick(s: SignIn, now: number): Step {
  if (!inFlow(s)) return { state: s }
  return now >= s.expiresAt + (pressing(s) || polling(s, now) ? ANSWER_GRACE_MS : 0) ? endOpen(s, 'expired') : { state: s }
}

/** The presses a conflict card offers: switch only to the handle the account belongs to. */
export function conflictChoices(s: SignIn): ('switch' | 'cancel')[] {
  if (s.phase !== 'conflict') return []
  return s.conflict === 'github_taken' && s.handle !== null ? ['switch', 'cancel'] : ['cancel']
}

/**
 * Switch or Cancel on a conflict card. A switch signs this install into the other handle,
 * so the outbox must be empty first: the caller flushes it, then passes what is left. Cancel
 * ends the flow here at once and tells the server, with the flow, before forgetting it.
 */
export function choose(s: SignIn, choice: 'switch' | 'cancel', outboxLeft: number): Step {
  if (s.phase !== 'conflict' || s.busy) return { state: s }
  if (choice === 'cancel') return endOpen(s, 'cancelled')
  if (!conflictChoices(s).includes('switch')) return { state: s }
  if (outboxLeft > 0) return { state: { ...s, note: 'outbox', message: null } }
  return { state: { ...s, busy: true, note: null, message: null }, send: { do: 'resolve', choice, attempt: s.attempt } }
}

/** The switch's answer: signed in to the other handle, or the card stays with why. */
export function onResolve(s: SignIn, attempt: number, a: Answer, now: number): Step {
  if (s.phase !== 'conflict' || !s.busy || s.attempt !== attempt) return late(s, attempt, a, 'resolve')
  const { code, message } = errorOf(a.json)
  if (transient(a.status)) return expiring(s, { state: { ...s, busy: false, note: 'offline', message: null } }, now)
  if (code === 'in_match') return expiring(s, { state: { ...s, busy: false, note: 'in_match', message } }, now)
  if (a.status !== 200 && a.status !== 201) return refused(s, a, now)
  const b = flowBody(a.json)
  if (!b) return endOpen(s, 'failed')
  const next = byStatus(s, a.json, b, now, true)
  // Anything but an end or done leaves the card up, ready for another press.
  return expiring(s, next.state.phase === 'conflict' || next.state.phase === 'unlinked' ? { state: { ...next.state, busy: false } as SignIn } : next, now)
}

/** A handle typed on the unlinked card: POST /accounts with the flow makes the account. */
export function join(s: SignIn, raw: string): Step {
  if (s.phase !== 'unlinked' || s.busy) return { state: s }
  const handle = raw.trim().toLowerCase()
  if (!HANDLE.test(handle)) return { state: { ...s, note: 'bad_handle', message: null } }
  return { state: { ...s, busy: true, note: null, message: null }, send: { do: 'join', handle, attempt: s.attempt } }
}

/** The join's answer: the new account, or the card stays with why. */
export function onJoin(s: SignIn, attempt: number, a: Answer, now: number): Step {
  if (s.phase !== 'unlinked' || !s.busy || s.attempt !== attempt) return late(s, attempt, a, 'join')
  const { code, message } = errorOf(a.json)
  const stay = (note: Note, msg: string | null) => expiring(s, { state: { ...s, busy: false, note, message: msg } }, now)
  if (transient(a.status)) return stay('offline', null)
  if (code === 'handle_taken') return stay('handle_taken', message)
  if (a.status === 400) return stay('refused', message)
  if (a.status !== 201 && a.status !== 200) return refused(s, a, now)
  const reply = isObject(a.json) ? replyOf(a.json) : null
  if (!reply) return end(s, 'failed')
  return { state: { phase: 'done', provider: s.provider, from: s.from, attempt: s.attempt, login: s.login, handle: reply.player.handle, switched: false }, forget: true, reply, carryWeek: true }
}

/**
 * Cancel on any card: over here at once; the server hears of it while a flow is held. A
 * cancel while starting has no flow yet: its start's answer comes back as `drop`. While a
 * switch or join is in flight Cancel waits (the card draws it off): the server may be
 * making the install or the account, and its token must not be thrown away. A poll out at
 * the Cancel doesn't hold it: a done it brings back is taken late (`onPoll`).
 */
export function cancelSignIn(s: SignIn): Step {
  if (s.phase === 'idle' || s.phase === 'done' || s.phase === 'ended' || pressing(s)) return { state: s }
  return inFlow(s) ? endOpen(s, 'cancelled') : end(s, 'cancelled')
}

/** Close a done or ended card. */
export function dismissSignIn(s: SignIn): Step {
  return s.phase === 'done' || s.phase === 'ended' ? { state: { phase: 'idle', attempt: s.attempt }, forget: true } : { state: s }
}

// ------------------------------------------------------------------ what config and the account say (W5b's wiring)

/**
 * Config's `signin` section for one provider. `dark` and `optional` turn sign-in on for this
 * player and the mod treats them alike (the site shows its badge for optional only, from the
 * anonymous config, which never says dark); anything else, a missing section included, is off.
 */
export function signinMode(raw: Readonly<Record<string, unknown>>, provider: Provider): 'off' | 'dark' | 'optional' {
  const mode = isObject(raw.signin) ? raw.signin[provider] : undefined
  return mode === 'dark' || mode === 'optional' ? mode : 'off'
}

/** Whether a PlayerRef says its handle has this provider's account linked: W5a sends `github: { login: null }` (a badge, never a name), or null. */
export function refLinked(ref: unknown, provider: Provider): boolean {
  return isObject(ref) && isObject(ref[provider])
}

/**
 * This provider's account linked to the handle, from GET /me's `account.identities`: null when
 * none is, else its login (null when it doesn't read as one, so a bad value never draws).
 */
export function linkedLogin(account: unknown, provider: Provider): { login: string | null } | null {
  const list = isObject(account) && Array.isArray(account.identities) ? account.identities : []
  const hit = list.find((x): x is Record<string, unknown> => isObject(x) && x.provider === provider)
  return hit ? { login: textOf(hit.login, LOGIN) } : null
}

/** How many new installs the warning reads, and how long a label it draws. */
export const NEW_INSTALLS_MAX = 10
export const INSTALL_LABEL_MAX = 64

/**
 * The account's other installs that signed in with this provider in the last day (GET /me's
 * `account.new_installs`, `via` the provider), for the warning: each label on one clean line
 * (at most 64; '' when it has none), its time, and the key the warning remembers it by.
 */
export function newInstallsVia(account: unknown, provider: Provider): { label: string; at: string; key: string }[] {
  const list = isObject(account) && Array.isArray(account.new_installs) ? account.new_installs : []
  const out: { label: string; at: string; key: string }[] = []
  for (const x of list) {
    if (!isObject(x) || x.via !== provider || typeof x.at !== 'string' || !Number.isFinite(Date.parse(x.at))) continue
    const raw = typeof x.label === 'string' ? x.label : ''
    // Cut by code points, so a label never ends in half a surrogate pair.
    const label = [...cleanServer(raw.replace(/[\t\n\v\f\r\u0085\u2028\u2029]+/g, ' ')).trim()].slice(0, INSTALL_LABEL_MAX).join('').trim()
    out.push({ label, at: x.at, key: `${provider}|${x.at}|${label}` })
    if (out.length >= NEW_INSTALLS_MAX) break
  }
  return out
}
