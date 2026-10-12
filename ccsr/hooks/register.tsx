import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, ModelCompleteResult, RenderElement, RenderInput, RenderNode, Register } from 'claude-code'

import type { ApiAccount, ApiChatItem, ApiCoder, ApiInstall, ApiLane, ApiLobbyItem, ApiMatchSummary, ApiPlayer, ApiQueueState, ApiRankedRow, ApiRecentMatch, ApiRoom, ApiScoreReply, ApiSeason, BacktestRun, ConfigState, RankedMatch, RankedShared, ChatLine, FeedItem, LinkState, Match, ModSettings, OutboxItem, PastSession, Record3, ScanStatus, SavedAccount, ScoredCommit, ServerConfig, Keyring, Surfaces, Tab, WeekTotals } from '../types'
import { DEFAULT_SERVER, backoffMs, errorOf, handleProblem, hungExpiryMs, loopWaitMs, mergeEvents, retryAfterMs, retryable, scoreBody, sha256hex, watchdogMs, withoutCoder } from './api'
import { CONFIG0, REREAD_JITTER_MS, configPath, headerReread, jitterMs, lineOf, parseConfig, signupsOf } from './config'
import type { ModConfig, Surface } from './config'
import { CLAUDE_FLOOR, UPDATE_ARGV, UPDATE_COMMAND, VERSION, standing } from './version'
import {
  DEFAULT_MODEL,
  FALLBACK_MODEL,
  JUDGE_SYSTEM,
  PR_SUFFIX,
  RUBRIC,
  START_RATING,
  STORE_VERSION,
  WARN_MS,
  botPlan,
  catalogOf,
  clean,
  digestText,
  elo,
  fitCardLine,
  hash,
  idKey,
  isNoise,
  isStashTitle,
  labelFor,
  lanesOf,
  lengthLabel,
  lengthsFromStore,
  minutesOf,
  myPace,
  numberOneOf,
  numberOneOn,
  oppAt,
  parseVerdict,
  periodStart,
  pickedLengths,
  recentOnSameFiles,
  resultInMs,
  rng,
  rollCutoff,
  rollUp,
  stepCraft,
  tierOf,
  toggledLengths,
  totals,
  warnMs,
  xProfile,
} from './pure'
import type { NumberOneOwn, RecentCommit } from './pure'
// W3b: config's buckets, the checklist's install link, and the words the mod draws around them.
import { installAppUrlOk } from './actions'
import type { Provider } from './actions'
import { OPEN, bucketIdOf, bucketRowShown, bucketsOf, lengthsFor, pickBucket, standingFor } from './buckets'
import type { Bucket } from './buckets'
import { BUCKET } from './copy'
import { REREAD_SPACING_MS } from './config'
import type { BucketBoard } from '../types'
// W6b: challenges (config's `challenges`, the inbox, a challenge read, its code and link, the message rules) and their words.
import { CODE, challengeCfg, challengeCode, challengeHref, messageOut, readChallenge, readInbox } from './challenges'
import type { Challenge, ChallengeCfg, ChallengeRead } from './challenges'
import { CHALLENGE, challengeResultText } from './copy'
import type { ApiOffer, ChallengeUi } from '../types'
// W4b: the server's notices. notices.ts decides what shows where, when and how often; this file draws, fires, counts and posts.
import { NOTICE } from './copy'
import {
  FEED_HOLD_MS,
  FLASH_MS,
  LEASE_MS,
  SESSION0,
  armFor,
  bumpStats,
  buttonsFor,
  claimFire,
  dayKey,
  eligible,
  feedAlert,
  feedKey,
  feedLine,
  feedNotices,
  firedOf,
  flashText,
  formFor,
  ledgerOf,
  matchEndEvents,
  matchTabPlaces,
  noteClick,
  noteDismiss,
  noteAlerted,
  noteDrawn,
  noteShown,
  noteSnooze,
  noticeText,
  noticesOf,
  openNotice,
  pickFlash,
  pickFor,
  pickToast,
  plainText,
  pruneFired,
  pruneLedger,
  releaseArming,
  statsAfterSend,
  statsBatch,
  statsDue,
  statsOf,
  takeLease,
  toastText,
} from './notices'
import type { CapLedger, Notice, NoticeEvent, NoticeForm, NoticePick, NoticeStats, NoticeView, Place, ReleaseArming, SessionLedger } from './notices'
import type { Action } from './actions'
import { sessionBars } from './svg'
import { banner, bandStrip, chatLog, chatRooms, commitBadge, commitList, feed as feedSvg, grind, ladder, numberOne, queue as queueSvg, queueBar, raceClimb, ratingCard, readyCheck, recentMatches, result, scorecard, setupHero, tabsBase, tabsTop, tierFrieze } from './olympia'
import type { Race, TierKey } from './olympia'
import { ACCOUNT, EVAL, FULL, LINES, MOD, QUIET, ROASTS, SURFACE_ROWS, SURFACE_WHAT, cancelledLine, pickerLine, presetOf, privacyLines, resultText, surfacesFrom } from './copy'
import type { SurfaceKey } from './copy'
// W5b: sign-in with a provider's device flow (`type Provider` comes from W3b's import block, above).
import { IDENTITY, PROVIDER_NAMES } from './copy'
import { SHARE_BEAT_MS, leadMs, leadOf, ledByOther, seenCopyOf, seenToTake, shareBody, shareOf, takeLead } from './lead'
import type { SeenCopy, SeenField } from './lead'
import { PROVIDERS, safeLink } from './actions'
import { PROVIDER_HOSTS, cancelSignIn, choose, conflictChoices, dismissSignIn, flowIdOf, IDLE as SIGNIN0, join as joinFlow, linkedLogin, newInstallsVia, onJoin, onPoll, onResolve, onStart, onTick, pollDue, refLinked, signinMode, startSignIn as pressSignIn, tokenlessStart } from './identity'
import type { Answer as FlowAnswer, EndWhy, FlowRef, Send as FlowSend, SignIn, SignInFrom, Step as SignInStep } from './identity'
// W7-2: eval capture (the call records, the coder block, Model stats).
import { CALL_KEEP_MS, CALL_SLOTS, CALL_SLOT_MAX, PENDING_MAX, bashCall, blockSince, captureOn, clientOf, coderBlocks, readSince, readSlot, sinceText, slotHolds, slotOf, slotText, stamped, stepCall, versionOf, windowsOf } from './coder'
import type { Call, Client, CoderBlock, Effort } from './coder'
// W7-3: the transcript fallback (dark, behind config's eval_backfill).
import { BACKGROUND_MS, FILES_PER_SCAN, SESSIONS_MAX, TWINS_MAX, backfillOn, callsFromTranscript, isSubagentFile, mergeTranscripts, projectDirOf, readPlan, subfolderPrefixOf, transcriptsDirOf } from './transcripts'
import type { TranscriptCall, TranscriptFile } from './transcripts'
// Usage weeks (the usage lift study): dark, behind config's eval_weeks.
import { USAGE_SCRIPT, USAGE_STRIKES, USAGE_TIMEOUT_MS, afterPost, coverDays, holdWeeks, isTransientUsageFailure, readUsage, retentionDays, usageAnswer, usageBody, usageDue, usageOn, usagePlan, usageState, usageWeeks } from './usage'
import type { UsageState, UsageWeek } from './usage'
// The watch list: the repos a commit can land in, found from the Bash hook and Claude Code's own transcripts.
import { LOOK_EVERY_MS, LOOK_MINUTES, LOOK_SCRIPT, LOOK_STRIKES, SEED_DAYS, SEED_FLIGHT_MS, SEED_RETRY_MS, SEED_SCRIPT, dirsFromLook, gitDirs, isCommitCommand, isTempDir, isTransientLookFailure } from './repos'
// W10b: finishers: the drawings (finishers.ts, a verbatim copy of mod-lab's), how the mod plays them (finisherplay.ts), and their words.
import { accentOf, buildFinisher, finisherWords, freeze, withCounter } from './finishers'
import type { FinisherDrawing, FinisherInput } from './finishers'
import { TERM_BEATS, finisherInput, finisherMeOf, finisherOf, finishersOf, practiceFinisher, previewInput, seenOf, seenWith, sharePath, soundFor, termPhase, termRows } from './finisherplay'
import { FINISHER } from './copy'
import { cleanServer } from './config'
import type { FinisherUi } from '../types'
// W10e: custom finishers (dark): the shared validator (finisherart.ts, W10d's), the frame custom art plays in (finishers.ts's HUD and
// strip), how the mod reads config's `finishers.custom`, art refs, your art and the gallery (finishers-custom.ts), and their words.
import { ART_CEILINGS, checkArt, freezeArt } from './finisherart'
import { KINDS, finisherHud, finisherStrip, kindOf } from './finishers'
import type { FinisherKind } from './finishers'
import { GALLERY_PAGE, REPORT_REASONS, TITLE_PROBLEM, artCode, artProblems, artRefOf, artShown, customMeOf, customOf, customTiming, drawsArt, galleryOf, localProblems, problemsOf, titleFor, titleRefused, wrongSlotOf } from './finishers-custom'
import type { Art, ArtRef, CustomMe, Problem, ReportReason } from './finishers-custom'
import { CUSTOM } from './copy'

// Every function that is handed $ lives in this file: the engine follows $
// into same-file, top-level functions only, and state reads and writes must
// name an atom defined here. Pure helpers live in pure.ts, svg.ts and olympia.ts.

type $ = EngineInterface

// ================================================================== STATE

const SCAN0: ScanStatus = { busy: false, lastAt: 0, note: '', problems: [] }

const tab = atom({ plugin: 'ccsr', key: 'tab' } as const, 'match')
const period = atom({ plugin: 'ccsr', key: 'period' } as const, 'week')
const ledger = atom({ plugin: 'ccsr', key: 'ledger' } as const, [], { shape: 'ledger-2' })
const weekTotals = atom({ plugin: 'ccsr', key: 'weekTotals' } as const, {})
const settings = atom({ plugin: 'ccsr', key: 'settings' } as const, { handle: 'jaen', tracking: true, share: false, model: DEFAULT_MODEL, surfaces: FULL }, { shape: 'settings-2' })
const scan = atom({ plugin: 'ccsr', key: 'scan' } as const, SCAN0, { shape: 'scan-2' })
const sessions = atom({ plugin: 'ccsr', key: 'sessions' } as const, [], { shape: 'sessions-2' })
const sessionsNote = atom({ plugin: 'ccsr', key: 'sessionsNote' } as const, '')
const backtests = atom({ plugin: 'ccsr', key: 'backtests' } as const, {}, { shape: 'backtests-2' })
const match = atom({ plugin: 'ccsr', key: 'match' } as const, null, { shape: 'match-2' })
const history = atom({ plugin: 'ccsr', key: 'history' } as const, [], { shape: 'history-2' })
const now = atom({ plugin: 'ccsr', key: 'now' } as const, 0)
const rating = atom({ plugin: 'ccsr', key: 'rating' } as const, START_RATING)
const record = atom({ plugin: 'ccsr', key: 'record' } as const, { w: 0, l: 0, d: 0 })
const trackingSince = atom({ plugin: 'ccsr', key: 'trackingSince' } as const, 0)
const expanded = atom({ plugin: 'ccsr', key: 'expanded' } as const, null)
const btLimit = atom({ plugin: 'ccsr', key: 'btLimit' } as const, 15)
const labNote = atom({ plugin: 'ccsr', key: 'labNote' } as const, '')
const chatDraft = atom({ plugin: 'ccsr', key: 'chatDraft' } as const, '')
const LINK0: LinkState = { online: null, note: '', me: null, season: null, grind: null, grindRank: null, outbox: 0, queue: null, lanes: null, ranked: null, ladder: null, myRank: null, grindOf: null, rooms: null, room: 'world', lobby: null, recent: null, release: null, updateNote: '', account: null, installs: null, linkCode: null, unknownToken: false, recoveryFresh: false, confirmRemove: false, meBuckets: null, boards: null, lanesBucket: null }
const link = atom({ plugin: 'ccsr', key: 'link' } as const, LINK0)
const badges = atom({ plugin: 'ccsr', key: 'badges' } as const, {})
const turnMarks = atom({ plugin: 'ccsr', key: 'turnMarks' } as const, {})
const dirty = atom({ plugin: 'ccsr', key: 'dirty' } as const, null)
const forfeitAsk = atom({ plugin: 'ccsr', key: 'forfeitAsk' } as const, false)
/** W3b: the bucket the Ranked and Grind tabs show, from their bucket rows; null is Open. The Match tab's is the store's `ranked.bucket`. */
const boardPick = atom({ plugin: 'ccsr', key: 'boardPick' } as const, { ranked: null as string | null, grind: null as string | null })
/** W6b: the challenge box (the inbox read, the form, a code looked up, the note). Never a challenge's message: see `challengeMessages`. */
const CHALLENGE_UI0: ChallengeUi = { rev: 0, incoming: null, outgoing: null, form: null, code: null, note: '', muteAsk: null, reportAsk: null }
const challengeUi = atom({ plugin: 'ccsr', key: 'challengeUi' } as const, CHALLENGE_UI0)
/** W4b: moves whenever this session's notices change (module variables, in "notices" below), so the pane, the band and the status line draw again. */
const noticeRev = atom({ plugin: 'ccsr', key: 'noticeRev' } as const, 0)
// When the pane last drew, across reloads: written by paneTick, read by boot, never by a draw.
const paneAt = atom({ plugin: 'ccsr', key: 'paneAt' } as const, 0)
/** Which way in the first-run card shows: a new handle, a link code, or a recovery key. */
const joinMode = atom({ plugin: 'ccsr', key: 'joinMode' } as const, 'new' as 'new' | 'link' | 'recover')
/** The server's config for this server and handle (GET /config): CONFIG0, 0.3.0's behaviour, until a read lands. Read it through configOf. */
const CONFIG_HELD0: ConfigState = { ...CONFIG0, poll: { ...CONFIG0.poll }, chat: { ...CONFIG0.chat }, raw: {}, key: '', readAt: 0 }
const config = atom({ plugin: 'ccsr', key: 'config' } as const, CONFIG_HELD0, { shape: 'config-1' })
/** W5b: moves on every change of the sign-in card (a module variable, below), so the pane redraws. */
const signinRev = atom({ plugin: 'ccsr', key: 'signinRev' } as const, 0)
/** W5b: the Settings row's note (unlinked, or why not), whether the card's code was copied, and Unlink's first press. */
const signinUi = atom({ plugin: 'ccsr', key: 'signinUi' } as const, { note: '', copied: false, unlinkAsk: false })
/** W10b: moves when a finisher starts, replays or reaches a beat, so the result draws its next frame on time. */
const finisherRev = atom({ plugin: 'ccsr', key: 'finisherRev' } as const, 0)
/** W10b: the Finishers view: GET /me/finishers as last read, whether a request is out, and its note. */
const FINISHER_UI0: FinisherUi = { key: '', me: null, busy: false, note: '' }
const finisherUi = atom({ plugin: 'ccsr', key: 'finisherUi' } as const, FINISHER_UI0)
/** W10e: moves on every change of the custom finishers' view and result state, which lives in module memory ("custom finishers", below), never here. */
const customRev = atom({ plugin: 'ccsr', key: 'customRev' } as const, 0)

// ================================================================== STORE

// $.store is one JSON file shared by every session on this machine (4 MiB in
// all). Anything another session may also write is re-read right before a
// write, never written back from this session's $.state copy.
const K = {
  version: 'version',
  settings: 'settings',
  ledger: 'ledger',
  weeks: 'weeks',
  cache: 'cache',
  repos: 'repos',
  since: 'trackingSince',
  rating: 'rating',
  record: 'record',
  history: 'history',
  match: 'match',
  claims: 'claims',
  squash: 'squash',
  failures: 'failures',
  band: 'band',
  rubric: 'rubric',
  rebuild: 'rebuild',
  // The CCSR server: where it is and this player's token; scores waiting to send; pids it already has; the salt for repo hashes.
  server: 'server',
  outbox: 'outbox',
  sent: 'sent',
  salt: 'salt',
  // Set when the player removed this install, so the keyring doesn't sign it straight back in.
  optOut: 'optOut',
  // W4b, notices, shared by every session on this config dir: each notice's caps (showings, presses, dismissals, a snooze),
  // the counts waiting to post (ids and counts only), who showed a toast or a flash or a feed alert (so one session does),
  // the stats post's lease and when one last went, and whether the first scored commit has been seen.
  noticeCaps: 'noticeCaps',
  noticeStats: 'noticeStats',
  noticeFired: 'noticeFired',
  noticeLease: 'noticeLease',
  noticeSentAt: 'noticeSentAt',
  noticeFirst: 'noticeFirst',
  // Ranked: idle, queued, offered, live or done, and which match; every session follows it.
  ranked: 'ranked',
  // W6b: the challenge inbox as the last read on this machine got it (messages included: the store is this plugin's own file, never $.state), by `<server url>|<handle>`, with when that read began and the incoming challenges already toasted.
  challenges: 'challenges',
  // W6b: a Challenges switch press here, by `<server url>|<handle>`, until the server confirms it (ChallengesPress).
  challengesPress: 'challengesPress',
  // W10b: the matches whose finisher drew on this machine and when it first did, the newest 20: each plays once.
  finisherSeen: 'finisherSeen',
  // W10e: your own art whose review result a toast already told (ids only, the newest 20), so every session tells each once.
  finisherTold: 'finisherTold',
  // The newest release the update toast has shown, so it shows once per release.
  updateSeen: 'updateSeen',
  // The server's config (GET /config), raw, by `<server url>|<handle>`, with when its read began: every session on this machine shares it, and a session offline uses it.
  config: 'config',
  // W5b: the new installs (signed in with a provider) the warning toast already showed, so every session shows each once.
  newInstalls: 'newInstalls',
  // W5b: tokens whose install should be gone (an old install after a switch, a token nobody took) but whose removal didn't go through; retried on the config tick.
  orphans: 'orphans',
  // W7-2: Model stats as GET /me last said it, `{ key: '<server url>|<handle>', on }`, so a session offline plays by it.
  modelStats: 'modelStats',
  // The watch list's look at Claude Code's transcripts: `{ seeded, tried, failed, at }`, when this install's seed ran, when an attempt last began, when one last failed, and when any session here last looked, so one session looks at a time.
  repoLook: 'repoLook',
  // Usage weeks: `{ key: '<server url>|<handle>', anchor, through, held, again, tried, failed }`: the account's anchor as the server gave it, the newest week this install has read, the weeks read and not sent yet (weekly totals only, waiting for the account's first finished match), a week being sent once more, and when a run last began and last failed, so one session runs at a time.
  usage: 'usage',
  // One ranked poller per machine (lead.ts): who polls the queue and the match now (`{ by, until }`), what that session last read
  // (the queue state, the lanes and the match page, with a rev), and what any session's account and board reads found, for the rest.
  rankedLead: 'rankedLead',
  rankedShare: 'rankedShare',
  seen: 'seen',
} as const

type Verdict = Pick<ScoredCommit, 'points' | 'base' | 'craft' | 'category' | 'reason' | 'judge' | 'asked' | 'rubric' | 'scoredAt'>

const SETTINGS0: ModSettings = { handle: 'jaen', tracking: true, share: false, model: DEFAULT_MODEL, surfaces: FULL }

/** Settings as stored, with every field present. Stores from before the 12 switches held four booleans and a Quiet flag; surfacesFrom carries them over. */
function withDefaults(s: Partial<ModSettings>): ModSettings {
  const { quiet, ...rest } = s
  return { ...SETTINGS0, ...rest, surfaces: surfacesFrom(s.surfaces, !!quiet) }
}

// Module variables reset on every hot reload, which is what a lock wants.
let owner = 'unknown'
let loadedAt = 0
let storeProblem = ''
let scanning: Promise<ScanResult> | null = null
let rescan: { force: boolean } | null = null
let belling: Promise<Match | null> | null = null
let stopTicker: (() => void) | null = null
let scanSoon: { cancel: () => void } | null = null
let lastOppToast = 0
let turnPoints = 0
const lastFingerprint = new Map<string, string>()
const lastFullList = new Map<string, number>()
const skipShas = new Set<string>()
// Eval capture (W7-2): the model calls turn.step saw, until they're written to this machine's
// call records (~/.ccsr/calls), and what this session stamps on them. Module memory only, never
// an atom, the ledger or the store: $.state is readable by every plugin.
/** Capture is on here: config's eval_capture, signed in, Model stats not off. The only thing the turn.step hook reads. */
let capturing = false
/** This session knows whether capture is on (a config held for this account, or Model stats off): until then a waiting block is sent as it is. */
let captureKnown = false
/** Whether boot registered syncCapture on the config tick (once, as W3b's, W5b's and W6b's ticks are). */
let captureTicking = false
/** Model calls not yet written: when each answered on the wall clock, which the write turns into `$.clock` time. */
const stepsPending: { wall: number; call: Call }[] = []
/** Each loop's latest step (main is ''): the model and effort a Bash record of a call it asked for carries. */
const lastStep = new Map<string, { model: string | null; effort: Effort | null }>()
/** What this session stamps on its records, and the slot file it writes (picked by its id, which is never written). */
let callSession: { client: Client | null; clientVersion: string | null; repo: string | null } = { client: null, clientVersion: null, repo: null }
let callSlot = 0
/** The session root the repo key was worked out for: the key is worked out again only when the root moves. */
let callRoot = ''
let callWrite: Promise<void> | null = null
/** Records this session wrote lately: every write puts them in again, so one another session's crossing write lost comes back on the next. */
const callsMine: Call[] = []
/** A slot read that didn't parse once (maybe a write caught halfway): the next write waits; a second in a row overwrites it. */
let slotTorn = false
/** This session already cleared the records for the current off spell (Model stats off, the flag off, signed out). */
let callsForgotten = false
/** W7-3: the transcript fallback runs here: capture is on and config's eval_backfill is too. Set with `capturing`, in syncCapture. */
let backfilling = false
/** Usage weeks: a run is going in this session. */
let usageRunning = false
/** Usage weeks: runs and posts that failed in a row in this session. At USAGE_STRIKES it stops trying until the next session. */
let usageFails = 0
/** Whether boot registered usageTick on the config tick (once, after syncCapture's). */
let usageTicking = false

async function storeGet<T>($: $, key: string, fallback: T): Promise<T> {
  const v = (await $.store.get(key)) as T | undefined
  return v === undefined || v === null ? fallback : v
}

/** One place for writes, so a full store says so once instead of failing every commit. */
async function save($: $, key: string, value: unknown) {
  try {
    await $.store.set(key, value)
    storeProblem = ''
    return true
  } catch (err) {
    const msg = `CCSR store write failed (${key}): ${(err as Error).message}`
    if (storeProblem !== msg) $.ui.toast(msg, { timeoutMs: 8000 })
    storeProblem = msg
    return false
  }
}

/**
 * Store v2: commit identity, rubric r2 and the Sonnet judge change what a
 * point is, so v1 scores are dropped and the ledger rebuilds from git on the
 * next scan. Tracking start, repos, settings, rating and history are kept.
 */
async function migrate($: $) {
  const v = await storeGet($, K.version, 1)
  if (v >= STORE_VERSION) {
    // A new rubric changes what a point is: rescore the Grind from git under it.
    // Squash decisions, matches, rating and history are kept.
    const rubric = await storeGet($, K.rubric, '')
    if (rubric === RUBRIC) return false
    // Squash decisions are re-made too, so each records the branch commits it stands for.
    for (const key of [K.ledger, K.cache, K.failures, K.weeks, K.squash]) await $.store.delete(key)
    await save($, K.rubric, RUBRIC)
    await save($, K.rebuild, true)
    return true
  }
  const repos = await storeGet<string[]>($, K.repos, [])
  const roots: string[] = []
  for (const r of repos) {
    const root = await repoRoot($, r)
    if (root && !roots.includes(root)) roots.push(root)
  }
  await save($, K.repos, roots)
  for (const key of [K.ledger, K.cache, K.claims, K.squash, K.failures, K.weeks, K.match]) await $.store.delete(key)
  await save($, K.version, STORE_VERSION)
  await save($, K.rubric, RUBRIC)
  await save($, K.rebuild, true)
  return true
}

async function loadAll($: $) {
  const migrated = await migrate($)
  const s = await storeGet<Partial<ModSettings>>($, K.settings, {})
  await update($, settings, () => withDefaults(s))
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  await update($, ledger, () => rows)
  const weeks = await storeGet<WeekTotals>($, K.weeks, {})
  await update($, weekTotals, () => weeks)
  const r = await storeGet($, K.rating, START_RATING)
  await update($, rating, () => r)
  const rec = await storeGet<Record3>($, K.record, { w: 0, l: 0, d: 0 })
  await update($, record, () => rec)
  const hist = await storeGet<Match[]>($, K.history, [])
  await update($, history, () => hist)
  const m = await storeGet<Match | null>($, K.match, null)
  await update($, match, () => (m && Array.isArray(m.plan) && m.lease ? m : null))
  let since = (await $.store.get(K.since)) as number | undefined
  if (since === undefined) {
    since = await $.clock.now()
    await save($, K.since, since)
  }
  await update($, trackingSince, () => since as number)
  return migrated
}

/** Every session's copy of the shared values, refreshed from the store. */
async function syncFromStore($: $) {
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  await update($, ledger, () => rows)
  const weeks = await storeGet<WeekTotals>($, K.weeks, {})
  await update($, weekTotals, () => weeks)
  const r = await storeGet($, K.rating, START_RATING)
  await update($, rating, () => r)
  const rec = await storeGet<Record3>($, K.record, { w: 0, l: 0, d: 0 })
  await update($, record, () => rec)
  const hist = await storeGet<Match[]>($, K.history, [])
  await update($, history, () => hist)
  const since = await storeGet($, K.since, 0)
  if (since) await update($, trackingSince, () => since)
  const s = await storeGet<Partial<ModSettings>>($, K.settings, {})
  await update($, settings, () => withDefaults(s))
  const m = await storeGet<Match | null>($, K.match, null)
  await update($, match, () => (m && Array.isArray(m.plan) && m.lease ? m : null))
}

/** Settings take a patch, merged into what the store holds now. Display settings stay on this machine. */
type SettingsPatch = Partial<Omit<ModSettings, 'surfaces' | 'quiet'>> & { surfaces?: Partial<Surfaces> }

async function saveSettings($: $, patch: SettingsPatch) {
  const cur = withDefaults(await storeGet<Partial<ModSettings>>($, K.settings, {}))
  const next = { ...cur, ...patch, surfaces: { ...cur.surfaces, ...(patch.surfaces ?? {}) } }
  await save($, K.settings, next)
  await update($, settings, () => next)
  return next
}

/** Read-modify-write on the shared ledger; the atom follows the stored value. */
async function ledgerApply($: $, change: (rows: ScoredCommit[]) => ScoredCommit[]) {
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const next = change(rows)
  if (next !== rows) await save($, K.ledger, next)
  await update($, ledger, () => next)
  return next
}

async function getVerdict($: $, pid: string, model: string): Promise<Verdict | null> {
  const cache = await storeGet<Record<string, Verdict>>($, K.cache, {})
  const v = cache[pid]
  if (!v || v.rubric !== RUBRIC) return null
  if (v.judge !== 'rule' && v.asked !== model) return null
  return v
}

async function putVerdict($: $, pid: string, v: Verdict) {
  const cache = await storeGet<Record<string, Verdict>>($, K.cache, {})
  const t = await $.clock.now()
  cache[pid] = v
  // Prune: other rubrics, and anything older than 70 days (longer than a row stays in the ledger).
  for (const [k, row] of Object.entries(cache)) if (row.rubric !== RUBRIC || t - row.scoredAt > 70 * 86_400_000) delete cache[k]
  await save($, K.cache, cache)
}

async function getRepos($: $) {
  return storeGet<string[]>($, K.repos, [])
}

async function addRepo($: $, root: string) {
  const repos = await getRepos($)
  if (!repos.includes(root)) {
    repos.push(root)
    await save($, K.repos, repos)
    // No rebuild: a repo no session has listed gets a full listing on the next scan anyway, scored from the tracking start or the
    // roll-up cutoff, whichever is later. A rebuild lists every repo from the tracking start, below the cutoff, where rows have
    // already rolled into week totals: it would judge them again and count their weeks twice. Only migrate, which clears the weeks, rebuilds.
  }
  return repos
}

async function dropRepo($: $, root: string) {
  const repos = (await getRepos($)).filter(r => r !== root)
  await save($, K.repos, repos)
}

// ------------------------------------------------------------------ the watch list (repos.ts)
// The Grind scores commits in the repos on its list. A session adds the repo it runs in (boot,
// turn.complete); these add the rest, so a commit counts wherever it lands from install on:
// the repo a Bash commit ran in (followCommit), the repos of the projects of the last
// SEED_DAYS days (the seed, once per install), and the folders and commits in the transcripts
// written in the last minutes (the look, every two minutes, by one session per machine): a
// session open since before the install has no hooks, and its transcript still says where it
// commits. Tracking starts at install all the same: a repo that joins is scored from then on.

/** A folder's repo as this session last asked git: a miss is asked again after ten minutes (a `git init` since). */
const dirRoots = new Map<string, { root: string | null; at: number }>()

async function homeDir($: $) {
  return (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined)) || null
}

/**
 * Folders join the Grind's repos as the repos they are in (a worktree as its main tree).
 * Passed over: a temp folder, a folder that is gone or in no repo, a repo already listed.
 * Answers how many joined. Like addRepo it sets no rebuild: the next scan lists a new repo in
 * full, from the tracking start or the roll-up cutoff, whichever is later.
 */
async function watchDirs($: $, dirs: readonly string[]) {
  if (dirs.length === 0) return 0
  const tmp = await $.env.get('TMPDIR').catch(() => undefined)
  const t = await $.clock.now()
  const roots = new Set<string>()
  for (const dir of dirs) {
    if (isTempDir(dir, tmp)) continue
    let hit = dirRoots.get(dir)
    if (!hit || (hit.root === null && t - hit.at > 600_000)) {
      hit = { root: await rootFor($, dir), at: t }
      if (dirRoots.size >= 500) dirRoots.clear()
      dirRoots.set(dir, hit)
    }
    if (hit.root && !isTempDir(hit.root, tmp)) roots.add(hit.root)
  }
  if (roots.size === 0) return 0
  const repos = await getRepos($)
  const fresh = [...roots].filter(r => !repos.includes(r))
  if (fresh.length === 0) return 0
  await save($, K.repos, [...repos, ...fresh])
  return fresh.length
}

/**
 * A Bash commit's repos join the list: the session's own, and any the command reached with `cd`
 * or `git -C`. `cwd` is where the shell was before the command ran: Claude Code keeps a `cd`
 * inside the allowed folders, so read afterwards, a relative `cd` would be followed twice.
 */
async function followCommit($: $, command: string, cwd: string | null) {
  return watchDirs($, gitDirs(command, cwd, await homeDir($)))
}

/** Where Claude Code keeps this config dir's transcripts, or null with no home directory and no absolute CLAUDE_CONFIG_DIR. */
async function projectsDir($: $) {
  const home = (await homeDir($)) ?? ''
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  return home || /^(\/|[A-Za-z]:[\\/])/.test((configDir ?? '').trim()) ? transcriptsDirOf({ CLAUDE_CONFIG_DIR: configDir }, home) : null
}

type RepoLook = { seeded?: number; tried?: number; failed?: number; at?: number }

/** Looks and seeds that failed in a row in this session. At LOOK_STRIKES it stops trying until the next session. */
let lookFails = 0

/** Merges into the store's `repoLook` as it is now (another session may have written since); null takes a key out. */
async function patchLook($: $, patch: { [K in keyof RepoLook]?: number | null }) {
  const next: Record<string, number> = { ...(await storeGet<RepoLook>($, K.repoLook, {})) }
  for (const [k, v] of Object.entries(patch)) {
    if (v === null || v === undefined) delete next[k]
    else next[k] = v
  }
  await save($, K.repoLook, next)
}

/** One of the two scripts over the transcripts folder; throws when `sh` can't start, runs out of time or exits badly. */
async function runLookScript($: $, script: string, base: string, arg: number, timeoutMs: number) {
  const r = await $.process.run(['sh', '-c', script, 'sh', base, String(arg)], { timeoutMs })
  if (r.exitCode !== 0) throw new Error(`sh exited ${r.exitCode}`)
  return r.stdout
}

/**
 * A look or a seed failed: one line in the debug log (never the transcript: this can happen on
 * every machine with no `sh`) and a strike. Answers whether it is worth another try here; when
 * it isn't, this session stops looking.
 */
function lookFailed($: $, what: string, err: unknown) {
  const message = clean(String((err as Error | undefined)?.message ?? err))
  const again = isTransientLookFailure(message)
  lookFails = again ? lookFails + 1 : LOOK_STRIKES
  $.ui.log(`CCSR repos: ${what} failed${lookFails >= LOOK_STRIKES ? ', no more tries this session' : ''}: ${message}`, { to: 'debug' })
  return again
}

/**
 * The seed (once per install) and the look: the folders Claude Code's transcripts name join
 * the list. Each has its own try, and the seed's repos join and `seeded` is saved before the
 * look runs, so a look that fails never throws a seed away.
 * - The look: one session per machine, at most every LOOK_EVERY_MS; the rest pass. A session
 *   whose look fails hands the slot back, so one that can't look never holds it.
 * - The seed: `tried` holds it only while an attempt is in flight (SEED_FLIGHT_MS), so a
 *   session that ends mid-seed costs minutes; a seed that ran and failed waits SEED_RETRY_MS.
 * - A session that can't start `sh` at all (Windows, a host with no processes) hands both
 *   back and stops; so does one after LOOK_STRIKES failures in a row.
 * Answers how many repos joined. Never throws.
 */
async function lookForRepos($: $): Promise<number> {
  if (lookFails >= LOOK_STRIKES) return 0
  let joined = 0
  try {
    const t = await $.clock.now()
    const held = await storeGet<RepoLook>($, K.repoLook, {})
    const seedDue = !held.seeded && t - (held.tried ?? 0) >= SEED_FLIGHT_MS && t - (held.failed ?? 0) >= SEED_RETRY_MS
    const lookDue = t - (held.at ?? 0) >= LOOK_EVERY_MS
    if (!seedDue && !lookDue) return 0
    const base = await projectsDir($)
    if (!base) return 0
    const home = await homeDir($)
    if (seedDue) {
      await patchLook($, { tried: t })
      try {
        const out = await runLookScript($, SEED_SCRIPT, base, SEED_DAYS, 120_000)
        joined += await watchDirs($, dirsFromLook(out, home))
        await patchLook($, { seeded: t })
        lookFails = 0
      } catch (err) {
        // It ran and failed: the machine waits SEED_RETRY_MS. It couldn't start: the attempt is handed back for a session that can.
        await patchLook($, lookFailed($, 'the seed', err) ? { failed: t } : { tried: held.tried ?? null })
      }
    }
    if (lookDue && lookFails < LOOK_STRIKES) {
      await patchLook($, { at: t })
      try {
        const out = await runLookScript($, LOOK_SCRIPT, base, LOOK_MINUTES, 60_000)
        joined += await watchDirs($, dirsFromLook(out, home))
        lookFails = 0
      } catch (err) {
        lookFailed($, 'the look', err)
        await patchLook($, { at: held.at ?? null })
      }
    }
  } catch (err) {
    $.ui.log(`CCSR repos: ${clean(String((err as Error | undefined)?.message ?? err))}`, { to: 'debug' })
  }
  return joined
}

/** A look, and a scan for the repos it found. Never awaited: a slow disk holds up no scan and no session start. */
function lookAround($: $) {
  void lookForRepos($).then(joined => {
    if (joined > 0) scheduleScan($)
  })
}

/** A soft lock so two sessions don't pay to judge the same commit; stale after two minutes. */
async function claim($: $, key: string) {
  const t = await $.clock.now()
  const claims = await storeGet<Record<string, { owner: string; at: number }>>($, K.claims, {})
  const held = claims[key]
  if (held && held.owner !== owner && t - held.at < 120_000) return false
  for (const [k, v] of Object.entries(claims)) if (t - v.at > 600_000) delete claims[k]
  claims[key] = { owner, at: t }
  await save($, K.claims, claims)
  return true
}

async function unclaim($: $, key: string) {
  const claims = await storeGet<Record<string, { owner: string; at: number }>>($, K.claims, {})
  if (claims[key]?.owner === owner) {
    delete claims[key]
    await save($, K.claims, claims)
  }
}

/** Three failed judge calls on one commit and it rests for a day instead of failing every scan. */
async function isResting($: $, pid: string) {
  const f = await storeGet<Record<string, { n: number; at: number }>>($, K.failures, {})
  const row = f[pid]
  return !!row && row.n >= 3 && (await $.clock.now()) - row.at < 86_400_000
}

async function noteFailure($: $, pid: string, ok: boolean) {
  const f = await storeGet<Record<string, { n: number; at: number }>>($, K.failures, {})
  if (ok) {
    if (!f[pid]) return
    delete f[pid]
  } else {
    f[pid] = { n: (f[pid]?.n ?? 0) + 1, at: await $.clock.now() }
  }
  await save($, K.failures, f)
}

// ================================================================== GIT

export type RawCommit = RecentCommit & {
  sha: string
  email: string
  /** `noreply@github.com` for commits GitHub made: squash merges, web edits. */
  committer: string
  /** Committer time, git's `%ct`, in whole seconds: when the commit was made (an amend or a rebase moves it, the author time stays). The coder block's window ends here (W7-2). */
  ct?: number
}

async function git($: $, cwd: string, args: string[], timeoutMs = 60_000) {
  return $.process.run(['git', ...args], { cwd, timeoutMs })
}

/** The main working tree for any path inside a repo or one of its worktrees. */
async function repoRoot($: $, cwd: string): Promise<string | null> {
  try {
    const common = await git($, cwd, ['rev-parse', '--path-format=absolute', '--git-common-dir'], 15_000)
    if (common.exitCode === 0) {
      const dir = common.stdout.trim()
      if (dir.endsWith('/.git')) return dir.slice(0, -5)
    }
    const top = await git($, cwd, ['rev-parse', '--show-toplevel'], 15_000)
    return top.exitCode === 0 ? top.stdout.trim() : null
  } catch {
    return null
  }
}

function repoName(root: string) {
  return root.split('/').filter(Boolean).pop() ?? root
}

/** Emails that count as you in this repo: its user.email plus the global one. */
async function myEmails($: $, root: string) {
  const out = new Set<string>()
  for (const args of [['config', 'user.email'], ['config', '--global', 'user.email']]) {
    try {
      const r = await git($, root, args, 15_000)
      const v = r.stdout.trim().toLowerCase()
      if (v) out.add(v)
    } catch {}
  }
  return out
}

/** Changes whenever any branch, remote or tag moves: an unchanged repo skips the scan. */
async function refsFingerprint($: $, root: string) {
  const r = await git($, root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads', 'refs/remotes', 'refs/tags'], 30_000)
  const head = await git($, root, ['rev-parse', 'HEAD'], 15_000)
  return String(hash(r.stdout + head.stdout))
}

const SEP = '\x1f'
// Stash entries are commits on refs/stash; --exclude must come before --all.
const REFS = ['--exclude=refs/stash', '--all']

/** Every commit sha reachable from a branch, remote or tag since `from`; `ok` false when git failed (never trust an empty set then). */
async function reachable($: $, root: string, from: number) {
  const r = await git($, root, ['rev-list', ...REFS, `--since=@${Math.floor(from / 1000)}`])
  return { set: new Set(r.stdout.split('\n').filter(Boolean)), ok: r.exitCode === 0 }
}

/**
 * Your commits (author email) with author time in [from, to]. `--since`
 * filters on committer time, which is at or after author time, so it is a
 * safe lower bound; author time is checked here.
 */
async function listCommits($: $, root: string, emails: Set<string>, from: number, to: number) {
  // %ct (W7-2) goes after %s: the fields before it keep their places.
  const r = await git($, root, ['log', ...REFS, '--no-merges', `--since=@${Math.floor(from / 1000)}`, `--format=${SEP}%H${SEP}%ae${SEP}%at${SEP}%ce${SEP}%s${SEP}%ct`, '--numstat'], 90_000)
  if (r.exitCode !== 0) throw new Error(clean(r.stderr.trim().slice(0, 200)) || 'git log failed')
  const out: RawCommit[] = []
  let cur: RawCommit | null = null
  for (const line of r.stdout.split('\n')) {
    if (line.startsWith(SEP)) {
      const [, sha = '', email = '', at = '0', ce = '', ...rest] = line.split(SEP)
      // The committer time is the last field; a subject that held the separator keeps the rest.
      const ct = rest.length > 1 && /^\d+$/.test(rest.at(-1) ?? '') ? Number(rest.pop()) : undefined
      const title = rest.join(SEP)
      cur = { sha, email: email.toLowerCase(), committer: ce.toLowerCase(), authoredAt: Number(at) * 1000, ct, title: clean(title), added: 0, deleted: 0, files: [] }
      out.push(cur)
    } else if (cur && line.trim()) {
      const [a = '0', d = '0', ...rest] = line.split('\t')
      cur.added += a === '-' ? 0 : Number(a) || 0
      cur.deleted += d === '-' ? 0 : Number(d) || 0
      cur.files.push(rest.join('\t'))
    }
  }
  return out.filter(c => emails.has(c.email) && c.authoredAt >= from && c.authoredAt <= to && !isStashTitle(c.title))
}

/** `git patch-id --stable`: the same change keeps its id across rebase and amend. */
async function patchId($: $, root: string, sha: string) {
  try {
    const show = await git($, root, ['show', '--format=', '--no-color', sha])
    if (!show.stdout.trim()) return sha
    const r = await $.process.run(['git', 'patch-id', '--stable'], { cwd: root, stdin: show.stdout })
    return r.stdout.trim().split(/\s+/)[0] || sha
  } catch {
    return sha
  }
}

async function patchIdOfRange($: $, root: string, from: string, to: string) {
  try {
    const diff = await git($, root, ['diff', '--no-color', from, to])
    if (!diff.stdout.trim()) return ''
    const r = await $.process.run(['git', 'patch-id', '--stable'], { cwd: root, stdin: diff.stdout })
    return r.stdout.trim().split(/\s+/)[0] ?? ''
  } catch {
    return ''
  }
}

async function isAncestor($: $, root: string, a: string, b: string) {
  try {
    const r = await git($, root, ['merge-base', '--is-ancestor', a, b], 15_000)
    return r.exitCode === 0 ? true : r.exitCode === 1 ? false : null
  } catch {
    return null
  }
}

/** A reason to give 0 without asking the judge, or null. */
async function skipReason($: $, root: string, c: RawCommit) {
  if (c.files.length > 0 && c.files.every(isNoise)) return 'lockfile, build or generated files only'
  if (c.added + c.deleted === 0) return 'no line changes'
  try {
    const r = await git($, root, ['show', '-w', '--format=', '--numstat', c.sha])
    const changed = r.stdout
      .split('\n')
      .filter(Boolean)
      .reduce((n, l) => {
        const [a = '0', d = '0'] = l.split('\t')
        return n + (Number(a) || 0) + (Number(d) || 0)
      }, 0)
    if (changed === 0) return 'formatting only'
  } catch {}
  return null
}

async function digest($: $, root: string, c: RawCommit, pool: RawCommit[]) {
  const msg = await git($, root, ['show', '-s', '--format=%B', c.sha])
  const stat = await git($, root, ['show', '--format=', '--numstat', c.sha])
  const patch = await git($, root, ['show', '--format=', '--no-color', '-U2', c.sha], 90_000)
  return digestText({
    authoredAt: c.authoredAt,
    message: msg.stdout,
    numstat: stat.stdout,
    added: c.added,
    deleted: c.deleted,
    fileCount: c.files.length,
    patch: patch.stdout,
    recent: recentOnSameFiles(c, pool),
  })
}

// ================================================================== SQUASH MERGES

type SquashDecision = { d: 'drop' | 'keep'; branch?: string[] }

const isSquashCommit = (c: RawCommit) => c.committer === 'noreply@github.com' && PR_SUFFIX.test(c.title)

async function getSquash($: $) {
  const raw = await storeGet<Record<string, SquashDecision | 'drop' | 'keep'>>($, K.squash, {})
  const out: Record<string, SquashDecision> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = typeof v === 'string' ? { d: v } : v
  return out
}

/**
 * GitHub squash merges (committer noreply@github.com, subject ending "(#N)")
 * repeat work whose branch commits are also in the repo. Each decision is kept
 * in the store with the branch commits it stands for, so deleting the branch
 * later can neither bring the double count back nor remove those commits.
 * Drop a squash only on evidence: the ledger already holds a commit of yours
 * with its subject from the two weeks before it; or a commit of yours that is
 * not its ancestor has its subject; or a branch whose combined diff since it
 * forked has the squash's patch-id. Otherwise the squash counts (the work was
 * done on another machine). `evidence` may be a wider listing than `listed`.
 */
async function decideSquashes($: $, root: string, listed: RawCommit[], evidence: RawCommit[] = listed) {
  const name = repoName(root)
  const decided = await getSquash($)
  const pending = evidence.filter(c => isSquashCommit(c) && !decided[`${name}:${c.sha}`]).sort((a, b) => a.authoredAt - b.authoredAt)
  if (pending.length > 0) {
    const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
    const locals = evidence.filter(c => !isSquashCommit(c))
    const consumed = new Set(Object.values(decided).flatMap(v => v.branch ?? []))
    for (const sq of pending) {
      const key = `${name}:${sq.sha}`
      const base = sq.title.replace(PR_SUFFIX, '').trim()
      const from = sq.authoredAt - 14 * 86_400_000
      const inLedger = rows.find(x => x.repoName === name && x.sha !== sq.sha && x.title.trim() === base && x.authoredAt >= from && x.authoredAt <= sq.authoredAt)
      if (inLedger) {
        decided[key] = { d: 'drop', branch: [inLedger.sha] }
        consumed.add(inLedger.sha)
        continue
      }
      const branch = await branchOf($, root, sq, locals, consumed)
      decided[key] = branch ? { d: 'drop', branch } : { d: 'keep' }
    }
    await save($, K.squash, decided)
  }
  const dropped = new Set(listed.filter(c => decided[`${name}:${c.sha}`]?.d === 'drop').map(c => c.sha))
  const protectedShas = new Set(Object.values(decided).flatMap(v => (v.d === 'drop' ? (v.branch ?? []) : [])))
  return { kept: listed.filter(c => !dropped.has(c.sha)), dropped, protectedShas }
}

/**
 * The branch commits a squash merge stands for, or null when there is no
 * evidence they are here. Marks the commits it returns as consumed.
 */
async function branchOf($: $, root: string, sq: RawCommit, locals: RawCommit[], consumed: Set<string>): Promise<string[] | null> {
  const base = sq.title.replace(PR_SUFFIX, '').trim()
  const from = sq.authoredAt - 14 * 86_400_000
  const near: RawCommit[] = []
  for (const c of locals) {
    if (consumed.has(c.sha) || c.authoredAt < from || c.authoredAt > sq.authoredAt) continue
    if ((await isAncestor($, root, c.sha, sq.sha)) === false) near.push(c)
  }
  if (near.length === 0) return null
  const files = new Set(sq.files)
  const overlap = (c: RawCommit) => c.files.filter(f => files.has(f)).length
  const titled = near.filter(c => c.title.trim() === base)
  const ordered = [...titled, ...near.filter(c => !titled.includes(c)).sort((a, b) => overlap(b) - overlap(a) || b.authoredAt - a.authoredAt)]
  const refs: string[] = []
  for (const c of ordered) {
    const r = await git($, root, ['for-each-ref', '--contains', c.sha, '--no-contains', sq.sha, '--format=%(refname)', 'refs/heads', 'refs/remotes'], 30_000)
    for (const ref of r.stdout.split('\n').filter(Boolean)) if (!refs.includes(ref)) refs.push(ref)
    if (titled.length > 0 && refs.length > 0) break
  }
  const take = async (ref: string) => {
    const taken: string[] = []
    for (const c of near) if ((await isAncestor($, root, c.sha, ref)) === true) taken.push(c.sha)
    return taken
  }
  if (titled.length > 0) {
    // The subject matches: the branch holding it is the PR's branch, if it still exists.
    const taken = refs[0] ? await take(refs[0]) : titled.map(c => c.sha)
    const all = taken.length ? taken : titled.map(c => c.sha)
    all.forEach(s => consumed.add(s))
    return all
  }
  const want = await patchId($, root, sq.sha)
  for (const ref of refs.slice(0, 20)) {
    const fork = await git($, root, ['merge-base', ref, `${sq.sha}^`], 15_000)
    const forkAt = fork.stdout.trim()
    if (!forkAt) continue
    if ((await patchIdOfRange($, root, forkAt, ref)) === want) {
      const taken = await take(ref)
      taken.forEach(s => consumed.add(s))
      return taken
    }
  }
  return null
}

// ================================================================== JUDGE

function refused(r: ModelCompleteResult) {
  return !r.isAnswered && r.reason === 'api-error' && (r.status === 404 || r.status === 400 || String(r.error) === 'model_not_found' || String(r.error) === 'invalid_request')
}

/** Rate limits, overload, server errors, timeouts and aborts pass; they never put a commit to rest. */
function isTransient(r: ModelCompleteResult) {
  if (r.isAnswered) return false
  if (r.reason === 'aborted') return true
  if (r.reason !== 'api-error') return false
  const s = r.status
  return s === null || s === 429 || s === 529 || (s >= 500 && s <= 504) || /rate_limit|overloaded|server_error|timeout/.test(String(r.error))
}

type JudgeError = Error & { transient: boolean }

function judgeError(message: string, transient: boolean): JudgeError {
  return Object.assign(new Error(message), { transient })
}

type JudgeOut = { base: number; craft: ScoredCommit['craft']; category: string; reason: string; model: string }

/** One judge call; when the pinned model is refused, the fallback alias answers instead. */
async function judge($: $, model: string, text: string, title: string, size: string): Promise<JudgeOut> {
  const ask = (m: string) => $.model.complete({ model: m, system: JUDGE_SYSTEM, prompt: text, maxTokens: 300, timeoutMs: 120_000 })
  let used = model
  let r: ModelCompleteResult | null = null
  try {
    r = await ask(model)
  } catch {
    r = null
  }
  if ((!r || refused(r)) && model !== FALLBACK_MODEL) {
    used = FALLBACK_MODEL
    try {
      r = await ask(used)
    } catch {
      r = null
    }
  }
  if (!r) throw judgeError('judge: the model call was refused', false)
  if (!r.isAnswered) {
    const why = r.reason === 'api-error' ? `api error ${r.status ?? ''} ${String(r.error)}` : r.reason
    throw judgeError(`judge: ${why}`, isTransient(r))
  }
  const v = parseVerdict(r.text, title, size)
  if (!v) throw judgeError(`judge: unreadable reply "${clean(r.text).slice(0, 80)}"`, false)
  return { ...v, model: used }
}

type ScoreOut = ScoredCommit | { skip: 'claimed' | 'resting' }

/**
 * Scores one commit: a cached verdict for the same change, rubric and model if
 * any session already judged it, else a skip rule or the judge. Skips (and
 * says why) when another session holds the claim or the commit is resting
 * after three real failures. Transient failures never count toward resting.
 * `sends`: this commit's score goes to the server, so the server may be asked
 * about it first; a backtest or a commit kept on this machine never is.
 */
async function scoreRaw($: $, root: string, raw: RawCommit, pool: RawCommit[], sends = false): Promise<ScoreOut> {
  const pid = await patchId($, root, raw.sha)
  const model = (await read($, settings)).model
  const meta = {
    pid,
    sha: raw.sha,
    repoName: repoName(root),
    title: raw.title,
    added: raw.added,
    deleted: raw.deleted,
    files: raw.files.length,
    authoredAt: raw.authoredAt,
  }
  const hit = await getVerdict($, pid, model)
  if (hit) return { ...meta, ...hit }
  if (await isResting($, pid)) return { skip: 'resting' }
  if (!(await claim($, pid))) return { skip: 'claimed' }
  try {
    const skip = await skipReason($, root, raw)
    let v: Verdict
    // Another install of this account may already have judged this change, or be judging it now.
    const remote = skip || !sends ? null : await serverClaim($, pid)
    if (remote === 'taken') return { skip: 'claimed' }
    if (remote && remote !== 'mine') {
      v = { points: remote.points, base: remote.base, craft: remote.craft as Verdict['craft'], category: remote.category, reason: ACCOUNT.scoredElsewhere, judge: remote.model, asked: model, rubric: remote.rubric, scoredAt: await $.clock.now() }
      await putVerdict($, pid, v)
      return { ...meta, ...v }
    }
    if (skip) {
      v = { points: 0, base: 0, craft: 'neutral', category: 'chore', reason: skip, judge: 'rule', asked: model, rubric: RUBRIC, scoredAt: await $.clock.now() }
    } else {
      const size = `+${raw.added} -${raw.deleted} in ${raw.files.length} files`
      const out = await judge($, model, await digest($, root, raw, pool), raw.title, size)
      v = { points: stepCraft(out.base, out.craft), base: out.base, craft: out.craft, category: out.category, reason: out.reason, judge: out.model, asked: model, rubric: RUBRIC, scoredAt: await $.clock.now() }
    }
    await putVerdict($, pid, v)
    await noteFailure($, pid, true)
    return { ...meta, ...v }
  } catch (err) {
    if (!(err as Partial<JudgeError>).transient) await noteFailure($, pid, false)
    throw err
  } finally {
    await unclaim($, pid)
  }
}

type RemoteScore = { fingerprint: string; points: number; base: number; craft: string; category: string; model: string; rubric: string }

/**
 * Asks the server before judging a change: 'mine' to judge it (also whenever
 * there's no account or no answer, so scoring never waits on the server),
 * 'taken' while another install judges it, or the score another install sent.
 */
async function serverClaim($: $, pid: string): Promise<'mine' | 'taken' | RemoteScore> {
  if (!(await serverCfg($)).token) return 'mine'
  const r = await api($, 'POST', '/scores/claims', { fingerprints: [pid] })
  if (r.status !== 200) return 'mine'
  const j = r.json as { claimed: string[]; taken: string[]; scored: RemoteScore[] }
  const done = j.scored?.find(x => x.fingerprint === pid)
  if (done) return done
  return j.taken?.includes(pid) ? 'taken' : 'mine'
}

/** Earlier commits in the pool get the points they already scored, so the judge sees them. */
async function withPoints($: $, pool: RawCommit[]) {
  const scored = new Map((await storeGet<ScoredCommit[]>($, K.ledger, [])).map(x => [x.sha, x.points]))
  for (const c of pool) if (scored.has(c.sha)) c.points = scored.get(c.sha)
  return pool
}

// ================================================================== GRIND SCAN

export type ScanResult = {
  added: ScoredCommit[]
  replaced: number
  removed: number
  errors: string[]
  squashes: number
  pruned: number
  skippedRepos: number
  claimed: { sha: string; authoredAt: number }[]
}

/**
 * The Grind: every commit you authored since tracking started, in every repo a
 * Claude Code session has opened (with tracking off, only commits inside a
 * live match, ranked or practice, kept as match-only rows). Commit identity:
 * - an amended or rebased commit (same author time and subject, old sha gone)
 *   replaces its row; while the old sha is still reachable on another history
 *   (a backup ref), the two count once;
 * - the same change on another sha (cherry-pick) counts once by patch-id;
 * - squash merges whose branch commits count are dropped for good;
 * - after a full listing, rows whose commit is no longer reachable from any
 *   ref leave (local squash, reset), except branch commits a squash stands for.
 * Rows older than the roll-up cutoff are never listed or scored again.
 */
async function scanGrind($: $, force: boolean, notify?: (c: ScoredCommit, coder: CoderBlock | null) => Promise<void>): Promise<ScanResult> {
  const result: ScanResult = { added: [], replaced: 0, removed: 0, errors: [], squashes: 0, pruned: 0, skippedRepos: 0, claimed: [] }
  const s = await read($, settings)
  const stored = await storeGet<Match | null>($, K.match, null)
  const liveMatch = stored && stored.status === 'live' && stored.kind === 'practice' && Array.isArray(stored.plan) ? stored : null
  // A ranked match running on the server (or counting after its bell), its window from the last poll.
  const rk = (await read($, link)).ranked?.summary
  const rankedOn = rk?.status === 'live' || rk?.status === 'grace'
  const rankedWindow = rankedOn && rk?.started_at && rk.deadline ? { startAt: Date.parse(rk.started_at), deadline: Date.parse(rk.deadline) } : null
  // With tracking off only a match's commits are scored: a ranked one, else a practice match here.
  const matchWindow = rankedWindow ?? liveMatch
  if (!s.tracking && !matchWindow) return result
  // The same rule as onScore: the Grind goes to the server while tracking is on, a ranked match's commits whenever one runs.
  const sends = s.tracking || rankedOn
  await update($, scan, cur => ({ ...SCAN0, ...cur, busy: true, note: 'Looking for new commits' }))
  try {
    // W7-2: this machine's call records for the coder blocks, read once per scan, on its first new score while capture is on.
    let evalCalls: { calls: Call[]; since: number } | null | undefined
    // W7-3: the transcript fallback's reads, on the scan's first new score with no live record while eval_backfill is on.
    let tx: TxScan | undefined
    const since = await storeGet($, K.since, await read($, trackingSince))
    const t = await $.clock.now()
    const cutoff = rollCutoff(t)
    const rebuild = await storeGet($, K.rebuild, false)
    let complete = true
    for (const root of await getRepos($)) {
      try {
        if (!(await $.fs.exists(root))) {
          await dropRepo($, root)
          continue
        }
        const fp = await refsFingerprint($, root)
        if (!force && !rebuild && lastFingerprint.get(root) === fp) {
          result.skippedRepos++
          continue
        }
        const name = repoName(root)
        const emails = await myEmails($, root)
        const floor = rebuild ? since : Math.max(since, cutoff)
        const evidenceFrom = Math.max(since, floor - 14 * 86_400_000)
        const full = force || rebuild || t - (lastFullList.get(root) ?? 0) > 3_600_000
        const from = full ? evidenceFrom : Math.max(evidenceFrom, t - 2 * 86_400_000)
        const listed = await listCommits($, root, emails, from, t + 60_000)
        const reach = await reachable($, root, evidenceFrom)
        let evidence = listed
        if (!full) {
          const decided = await getSquash($)
          const pend = listed.filter(c => isSquashCommit(c) && !decided[`${name}:${c.sha}`])
          if (pend.length > 0) {
            const lo = Math.max(since, Math.min(...pend.map(p => p.authoredAt)) - 14 * 86_400_000)
            evidence = await listCommits($, root, emails, lo, t + 60_000)
          }
        }
        const { kept, dropped, protectedShas } = await decideSquashes($, root, listed, evidence)
        if (dropped.size > 0) {
          result.squashes += dropped.size
          await ledgerApply($, rows => {
            const next = rows.filter(x => !(x.repoName === name && dropped.has(x.sha)))
            result.pruned += rows.length - next.length
            return next.length === rows.length ? rows : next
          })
        }
        await withPoints($, listed)
        // Each listed commit's coder block (W7-2), worked out on this repo's first new score: its window runs from the commit before it here (by committer time) to it.
        let blocks: Map<string, CoderBlock | null> | null | undefined
        // The commits this machine made here (the reflog), read with the blocks; the transcript fallback (W7-3) uses the same.
        let made: Set<string> | undefined
        const scoreFrom = s.tracking ? floor : Math.max(floor, matchWindow!.startAt)
        const scoreTo = s.tracking ? t + 60_000 : matchWindow!.deadline
        let incomplete = false
        for (const raw of kept.sort((a, b) => a.authoredAt - b.authoredAt)) {
          if (raw.authoredAt < scoreFrom || raw.authoredAt > scoreTo) continue
          const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
          if (skipShas.has(raw.sha) || rows.some(x => x.sha === raw.sha)) continue
          const key = idKey(name, raw.authoredAt, raw.title)
          const twin = rows.find(x => x.repoName === name && x.sha !== raw.sha && idKey(x.repoName, x.authoredAt, x.title) === key)
          let rewriteOf: ScoredCommit | undefined
          if (twin) {
            if (!reach.set.has(twin.sha)) rewriteOf = twin
            else if ((await isAncestor($, root, twin.sha, raw.sha)) === false && (await isAncestor($, root, raw.sha, twin.sha)) === false) {
              // The same commit on two histories (a backup ref kept the pre-rebase one): it counts once.
              continue
            }
          }
          await update($, scan, cur => ({ ...SCAN0, ...cur, busy: true, note: `Scoring "${raw.title.slice(0, 50)}"` }))
          let out: ScoreOut
          try {
            out = await scoreRaw($, root, raw, listed, sends)
          } catch (err) {
            const msg = clean((err as Error).message)
            result.errors.push(`${name} ${raw.sha.slice(0, 7)} "${raw.title.slice(0, 40)}": ${msg}`)
            incomplete = true
            if ((err as Partial<JudgeError>).transient && /rate_limit|overloaded|429|529/.test(msg)) break
            continue
          }
          if ('skip' in out) {
            incomplete = true
            if (out.skip === 'claimed') result.claimed.push({ sha: raw.sha, authoredAt: raw.authoredAt })
            else result.errors.push(`${name} ${raw.sha.slice(0, 7)} "${raw.title.slice(0, 40)}": resting after 3 failed judge calls`)
            continue
          }
          const scored: ScoredCommit = s.tracking ? out : { ...out, matchOnly: true }
          raw.points = scored.points
          let isNew = false
          await ledgerApply($, cur => {
            if (cur.some(x => x.sha === scored.sha)) return cur
            const same = cur.find(x => x.pid === scored.pid)
            if (rewriteOf && !same) {
              result.replaced++
              return cur.map(x => (x.sha === rewriteOf!.sha ? scored : x))
            }
            if (same) {
              // The same change on another sha: move the row to the live one, or remember to skip it.
              if (!reach.set.has(same.sha)) return cur.map(x => (x.sha === same.sha ? { ...x, sha: scored.sha } : x))
              skipShas.add(scored.sha)
              return cur
            }
            isNew = true
            return [...cur, scored]
          })
          if (isNew) {
            result.added.push(scored)
            // Another install of this account scored it first: that one sent its block, from its own machine's records.
            const mine = scored.reason !== ACCOUNT.scoredElsewhere
            if (capturing && mine && blocks === undefined) {
              if (evalCalls === undefined) evalCalls = await callsForScan($)
              if (evalCalls) made = await madeHere($, root)
              blocks = evalCalls && made ? await scanBlocks($, root, listed, evalCalls, 'live', made) : null
            }
            let coder = mine ? (blocks?.get(raw.sha) ?? null) : null
            // W7-3, dark: no live record for it (a none block, or none at all), so Claude Code's own transcripts here may name it. A failure there never holds the score back.
            if (backfilling && mine && evalCalls && made && (coder === null || coder.source === 'none'))
              coder = (await transcriptBlock($, root, raw.sha, listed, evalCalls.since, made, (tx ??= txScan())).catch(err => void $.ui.log(`CCSR transcripts: ${clean((err as Error).message)}`))) ?? coder
            if (notify) await notify(scored, coder)
          }
        }
        // Commits no longer reachable from any ref (a local squash, a reset) leave the ledger. Rows are kept by the folder's last
        // name, so another watched repo of the same name (a second clone, a fork) may hold them: a row leaves only when none of
        // them reaches it, and stays while one of them can't be asked.
        const elsewhere: Set<string>[] = []
        let asked = full && reach.ok && !incomplete
        if (asked)
          for (const other of (await getRepos($)).filter(r => r !== root && repoName(r) === name)) {
            const there = await reachable($, other, evidenceFrom).catch(() => null)
            if (!there?.ok) asked = false
            else elsewhere.push(there.set)
          }
        if (asked) {
          await ledgerApply($, rows => {
            const next = rows.filter(x => !(x.repoName === name && x.authoredAt >= evidenceFrom && !reach.set.has(x.sha) && !elsewhere.some(s => s.has(x.sha)) && !protectedShas.has(x.sha)))
            result.removed += rows.length - next.length
            return next.length === rows.length ? rows : next
          })
        }
        if (incomplete) complete = false
        else {
          lastFingerprint.set(root, fp)
          if (full) lastFullList.set(root, t)
        }
      } catch (err) {
        complete = false
        result.errors.push(`${repoName(root)}: ${clean((err as Error).message)}`)
      }
    }
    if (rebuild && complete) await save($, K.rebuild, false)
    // Roll old rows into week totals so the store stays small.
    const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
    const weeks = await storeGet<WeekTotals>($, K.weeks, {})
    const rolled = rollUp(rows, weeks, t)
    if (rolled.rolled > 0 || rolled.list.length !== rows.length) {
      await save($, K.weeks, rolled.weeks)
      await save($, K.ledger, rolled.list)
    }
    await update($, ledger, () => rolled.list)
    await update($, weekTotals, () => rolled.weeks)
  } catch (err) {
    result.errors.push(`scan: ${clean((err as Error).message)}`)
  } finally {
    const done = await $.clock.now()
    if (storeProblem) result.errors.push(storeProblem)
    const parts = [
      result.added.length > 0 ? `Scored ${result.added.length} new commit${result.added.length === 1 ? '' : 's'}` : 'Up to date',
      result.replaced > 0 ? `${result.replaced} rewritten commit${result.replaced === 1 ? '' : 's'} replaced` : '',
      result.removed > 0 ? `${result.removed} commit${result.removed === 1 ? '' : 's'} no longer on any branch removed` : '',
      result.squashes > 0 ? `${result.squashes} squash merge${result.squashes === 1 ? '' : 's'} skipped (branch commits already count)` : '',
      result.pruned > 0 ? `removed ${result.pruned} double-counted` : '',
      result.claimed.length > 0 ? `${result.claimed.length} being scored in another session` : '',
      result.errors.length > 0 ? `${result.errors.length} problem${result.errors.length === 1 ? '' : 's'}` : '',
    ]
    const note = parts.filter(Boolean).join(' · ')
    const problems = result.errors.map(err => `${new Date(done).toTimeString().slice(0, 5)} ${err}`)
    await update($, scan, () => ({ busy: false, lastAt: done, note, problems }))
  }
  return result
}

// ================================================================== PAST SESSIONS

const SESSION_SCRIPT = `
cd "$HOME/.claude/projects" 2>/dev/null || exit 0
find . -maxdepth 2 -name '*.jsonl' -type f -mtime -__DAYS__ -print0 | xargs -0 ls -t 2>/dev/null | head -n __CAP__ | while IFS= read -r f; do
  id=$(basename "$f" .jsonl)
  head=$(head -c 262144 "$f")
  first=$(printf '%s' "$head" | grep -m1 -o '"timestamp":"[^"]*"' | cut -d'"' -f4)
  last=$(tail -c 40000 "$f" | grep -o '"timestamp":"[^"]*"' | tail -1 | cut -d'"' -f4)
  cwd=$(printf '%s' "$head" | grep -m1 -o '"cwd":"[^"]*"' | cut -d'"' -f4)
  title=$({ printf '%s' "$head"; tail -c 262144 "$f"; } | grep -m1 -o '"customTitle":"\\(\\\\.\\|[^"\\\\]\\)*"' | sed 's/^"customTitle"://')
  [ -z "$title" ] && title=$({ printf '%s' "$head"; tail -c 262144 "$f"; } | grep -m1 -o '"summary":"\\(\\\\.\\|[^"\\\\]\\)*"' | sed 's/^"summary"://')
  [ -z "$title" ] && title=$(printf '%s' "$head" | grep -m1 '"type":"user"' | grep -o '"content":"\\(\\\\.\\|[^"\\\\]\\)\\{1,120\\}' | head -1 | sed 's/^"content"://')
  printf '%s\\037%s\\037%s\\037%s\\037%s\\n' "$id" "$first" "$last" "$cwd" "$title"
done
`

function decodeTitle(raw: string) {
  const q = raw.trim()
  if (!q) return ''
  try {
    return String(JSON.parse(q.endsWith('"') ? q : `${q}"`))
  } catch {
    return q.replace(/^"|"$/g, '').replace(/\\n/g, ' ').replace(/\\"/g, '"')
  }
}

function projectOf(cwd: string) {
  const wt = cwd.split('/.claude/worktrees/')
  const base = (wt[0] ?? cwd).split('/').filter(Boolean).pop() ?? cwd
  return wt.length > 1 ? `${base} (${(wt[1] ?? '').split('/')[0]})` : base
}

/** Past Claude Code sessions from their transcripts' first and last timestamps, one row per session. */
async function discoverSessions($: $, days: number) {
  await update($, sessionsNote, () => `Reading the last ${days} days of sessions`)
  const d = Math.max(1, Math.floor(days))
  let r: { stdout: string }
  try {
    r = await $.process.run(['sh', '-c', SESSION_SCRIPT.replace('__DAYS__', String(d)).replace('__CAP__', '400')], { timeoutMs: Math.min(600_000, 60_000 + d * 15_000) })
  } catch (err) {
    await update($, sessionsNote, () => `Could not read past sessions: ${clean((err as Error).message)}`)
    return []
  }
  const byId = new Map<string, PastSession>()
  const cutoff = (await $.clock.now()) - d * 86_400_000
  for (const line of r.stdout.split('\n')) {
    const [id = '', first = '', last = '', cwd = '', title = ''] = line.split('\x1f')
    const startAt = Date.parse(first)
    const endAt = Date.parse(last)
    if (!id || !cwd || !Number.isFinite(startAt) || !Number.isFinite(endAt) || id === owner) continue
    if (endAt - startAt < 60_000 || endAt < cutoff) continue
    const row: PastSession = { id, title: clean(decodeTitle(title)).trim().slice(0, 90) || 'Untitled session', project: projectOf(cwd), cwd, startAt, endAt }
    const prev = byId.get(id)
    if (!prev) byId.set(id, row)
    else {
      const main = cwd.includes('/.claude/worktrees/') ? prev.cwd : cwd
      byId.set(id, { ...prev, startAt: Math.min(prev.startAt, startAt), endAt: Math.max(prev.endAt, endAt), cwd: main, project: projectOf(main) })
    }
  }
  const list = [...byId.values()].sort((a, b) => b.endAt - a.endAt)
  await update($, sessions, () => list)
  const summary = list.length ? `${list.length} sessions in the last ${d} days` : `No sessions found in the last ${d} days`
  await update($, sessionsNote, () => summary)
  return list
}

/** A worktree that was deleted still has its commits in the main repo. */
async function rootFor($: $, cwd: string) {
  const direct = await repoRoot($, cwd)
  if (direct) return direct
  const main = cwd.split('/.claude/worktrees/')[0]
  return main && main !== cwd ? repoRoot($, main) : null
}

async function setRun($: $, run: BacktestRun) {
  await update($, backtests, all => ({ ...all, [run.sessionId]: run }))
}

/** How a past session would have scored: your commits in its repo inside its own window. */
async function backtestSession($: $, s: PastSession, signal?: AbortSignal): Promise<BacktestRun> {
  let run: BacktestRun = { sessionId: s.id, status: 'running', done: 0, total: 0, points: 0, skipped: 0, failed: 0, deferred: 0, commits: [], note: 'Finding commits' }
  await setRun($, run)
  const root = await rootFor($, s.cwd)
  if (!root) {
    run = { ...run, status: 'error', note: `No git repo at ${s.cwd}` }
    await setRun($, run)
    return run
  }
  try {
    const emails = await myEmails($, root)
    const end = s.endAt + 15 * 60_000
    // List two weeks wider so squash decisions see the branch commits they repeat.
    const wide = await listCommits($, root, emails, s.startAt - 14 * 86_400_000, end)
    const { kept } = await decideSquashes($, root, wide)
    await withPoints($, wide)
    const raws = kept.filter(c => c.authoredAt >= s.startAt && c.authoredAt <= end).sort((a, b) => a.authoredAt - b.authoredAt)
    run = { ...run, total: raws.length, note: raws.length ? 'Scoring' : 'No commits by you in this session' }
    await setRun($, run)
    const seen = new Set<string>()
    const seenKey = new Set<string>()
    const name = repoName(root)
    let firstError = ''
    for (const raw of raws) {
      if (signal?.aborted) break
      // The same commit on two histories (a backup ref of a rebase) counts once.
      const key = idKey(name, raw.authoredAt, raw.title)
      if (seenKey.has(key)) {
        run = { ...run, done: run.done + 1 }
        continue
      }
      let c: ScoredCommit | null = null
      try {
        const out = await scoreRaw($, root, raw, wide)
        if ('skip' in out) {
          if (out.skip === 'claimed') run = { ...run, deferred: run.deferred + 1 }
          else {
            firstError = firstError || 'resting after 3 failed judge calls'
            run = { ...run, failed: run.failed + 1 }
          }
        } else c = out
      } catch (err) {
        firstError = firstError || clean((err as Error).message)
        run = { ...run, failed: run.failed + 1 }
      }
      if (c && !seen.has(c.pid)) {
        seen.add(c.pid)
        seenKey.add(key)
        raw.points = c.points
        run = { ...run, commits: [...run.commits, c], points: run.points + c.points, skipped: run.skipped + (c.judge === 'rule' ? 1 : 0) }
      }
      run = { ...run, done: run.done + 1 }
      await setRun($, run)
    }
    const short = run.failed + run.deferred > 0 || run.done < run.total
    run = {
      ...run,
      status: short ? 'partial' : 'done',
      note: run.total
        ? `${run.points} points from ${run.commits.length} of ${run.total} commits${run.failed ? ` · ${run.failed} failed (${firstError})` : ''}${run.deferred ? ` · ${run.deferred} busy in another session` : ''}`
        : run.note,
    }
  } catch (err) {
    run = { ...run, status: 'error', note: clean((err as Error).message) }
  }
  await setRun($, run)
  return run
}

// ================================================================== MATCH

// Made-up rivals, the same handles every mockup uses.
const RIVALS: readonly { handle: string; rating: number }[] = [
  { handle: '10xgary', rating: 1172 },
  { handle: 'nova_ships', rating: 1712 },
  { handle: 'rk', rating: 1655 },
  { handle: 'vex', rating: 1488 },
  { handle: 'tokyo_drift', rating: 1391 },
]

const TAUNTS = ['gl hf', 'clock is ticking', 'nice one', 'that was a big diff', 'ok that one hurt', 'shipping, brb', 'gg incoming', 'whats your stack']
const REPLIES = ['lol', 'fair', 'we will see', 'no way', 'respect', 'back to work', 'deploying now', 'haha true']
const LEASE_STALE = 30_000

function pick<T>(r: () => number, list: readonly T[]): T {
  return list[Math.floor(r() * list.length)] as T
}

function liveOpp(m: Match, t: number) {
  return m.status === 'live' ? oppAt(m.plan, t, m.deadline) : m.oppPoints
}

function resultOf(myPoints: number, oppPoints: number): Match['status'] {
  return myPoints === 0 && oppPoints === 0 ? 'void' : myPoints > oppPoints ? 'won' : myPoints < oppPoints ? 'lost' : 'draw'
}

/**
 * Read-modify-write on the stored match: the store is the source of truth and
 * every session may write (chat, counted commits), so a change is applied to
 * the freshest copy and the atom follows it.
 */
async function matchApply($: $, id: string, change: (m: Match) => Match | null) {
  const cur = await storeGet<Match | null>($, K.match, null)
  if (!cur || cur.id !== id) {
    await update($, match, () => (cur && Array.isArray(cur.plan) ? cur : null))
    return null
  }
  const next = change(cur)
  if (next && next !== cur) await save($, K.match, next)
  const shown = next ?? cur
  await update($, match, () => shown)
  return next
}

async function startPractice($: $, hours: number) {
  const stored = await storeGet<Match | null>($, K.match, null)
  if (stored && stored.status === 'live' && Array.isArray(stored.plan)) return null
  const t = await $.clock.now()
  const mine = await storeGet($, K.rating, START_RATING)
  const r = rng(t)
  const rival = [...RIVALS].sort((a, b) => Math.abs(a.rating - mine) - Math.abs(b.rating - mine))[Math.floor(r() * 2)] ?? RIVALS[0]!
  const sprint = hours < 1
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const pace = sprint ? 150 : myPace(rows, t) * (0.8 + r() * 0.4)
  const deadline = t + hours * 3_600_000
  const m: Match = {
    id: `p-${t}`,
    kind: 'practice',
    hours,
    startAt: t,
    deadline,
    opp: { handle: rival.handle, rating: Math.round(mine + (r() - 0.5) * 120), pace },
    plan: botPlan(t, t, deadline, pace),
    myPoints: 0,
    oppPoints: 0,
    feed: [],
    counted: [],
    chat: [{ at: t, who: rival.handle, text: pick(r, ['gl hf', 'gl', 'lets go', 'hf']) }],
    status: 'live',
    ratingBefore: mine,
    lease: { owner, at: t },
  }
  await save($, K.match, m)
  await update($, match, () => m)
  await update($, now, () => t)
  return m
}

/**
 * My points are derived from the shared ledger every time, not accumulated:
 * the ledger already resolves rewrites (an amend replaces its row), so the
 * match follows it, and every in-window row counts once whichever session
 * scored it. The stored match freezes at the bell.
 */
async function syncMatch($: $) {
  const m = await storeGet<Match | null>($, K.match, null)
  if (!m || m.status !== 'live' || !Array.isArray(m.plan)) return 0
  const rows = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const inWin = rows.filter(c => c.authoredAt >= m.startAt && c.authoredAt <= m.deadline)
  const fresh = inWin.filter(c => !m.counted.includes(c.pid))
  const pts = inWin.reduce((n, c) => n + c.points, 0)
  if (fresh.length === 0 && pts === m.myPoints && inWin.length === m.counted.length) return 0
  const t = await $.clock.now()
  await matchApply($, m.id, cur => {
    if (cur.status !== 'live') return cur
    const next: Match = {
      ...cur,
      myPoints: pts,
      feed: inWin.map(c => ({ at: c.authoredAt, who: 'me' as const, points: c.points, category: c.category, title: c.title })),
      counted: inWin.map(c => c.pid),
    }
    if (fresh.some(c => c.points >= 5) && Math.random() < 0.5) next.chat = [...cur.chat, { at: t, who: cur.opp.handle, text: pick(Math.random, TAUNTS) }]
    return next
  })
  return fresh.length
}

const BELL_MARKS: readonly [number, string][] = [
  [600, MOD.warn10],
  [60, MOD.warn1],
]
const warned = new Set<string>()
let lastSeenLive = ''

/** A practice result in the approved results table's words (copy.md). */
function resultLine(m: Match) {
  const delta = (m.ratingAfter ?? m.ratingBefore) - m.ratingBefore
  const outcome = m.status === 'won' ? 'won' : m.status === 'lost' || m.status === 'forfeit' ? 'lost' : m.status === 'void' ? 'void' : 'draw'
  return resultText(outcome, m.status === 'forfeit' ? 'forfeit' : 'points', delta, seedOf(m.id))
}

function seedOf(id: string) {
  let n = 0
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) % 9973
  return n
}

async function keepLease($: $, id: string) {
  const t = await $.clock.now()
  await matchApply($, id, cur => (cur.status === 'live' ? { ...cur, lease: { owner, at: t } } : cur))
}

/**
 * One second of a live match, in every session: the clock moves, opponent
 * commits and bell warnings show wherever the player is working, and a result
 * finished elsewhere is announced here once. The session holding the lease
 * also refreshes it, counts commits and rings the bell; another session takes
 * the lease over when it goes stale.
 */
async function tick($: $, onEvent: (text: string) => void) {
  const t = await $.clock.now()
  await update($, now, () => t)
  const m = await storeGet<Match | null>($, K.match, null)
  if (!m || !Array.isArray(m.plan)) {
    await update($, match, () => null)
    return
  }
  if (m.status !== 'live') {
    await update($, match, () => m)
    if (lastSeenLive === m.id && !warned.has(`${m.id}:result`)) {
      warned.add(`${m.id}:result`)
      onEvent(resultLine(m))
    }
    return
  }
  if (m.kind !== 'practice') return
  lastSeenLive = m.id
  // A match the history already holds is finished; converge on that result.
  const hist = await storeGet<Match[]>($, K.history, [])
  const prev = hist.find(x => x.id === m.id)
  if (prev) {
    await save($, K.match, prev)
    await update($, match, () => prev)
    return
  }
  await update($, match, () => m)

  for (const p of m.plan) {
    if (p.at > lastOppToast && p.at <= t && t - p.at < 5_000) onEvent(`${m.opp.handle} +${p.points} · ${p.category}`)
  }
  lastOppToast = Math.max(lastOppToast, t)
  const left = Math.ceil((m.deadline - t) / 1000)
  for (const [mark, text] of BELL_MARKS) {
    const k = `${m.id}:${mark}`
    if (mark === 600 && m.hours < 1) continue
    if (left <= mark && left > mark - 30 && !warned.has(k)) {
      warned.add(k)
      onEvent(text)
    }
  }

  if (belling) return
  const mineLease = m.lease.owner === owner
  if (!mineLease && t - m.lease.at < LEASE_STALE) return
  if (!mineLease || t - m.lease.at > 10_000) await keepLease($, m.id)
  if (t >= m.deadline) {
    await bell($, onEvent)
    return
  }
  if (Math.floor(t / 1000) % 10 === 0) await syncMatch($)
}

/**
 * The bell, once per match. Single-flight in this session; idempotent across
 * sessions (a match already in the history converges on that result). It keeps
 * the lease alive while it works, waits for any scan in flight, runs a fresh
 * forced scan, and waits (up to about two minutes) for in-window commits
 * another session is still judging, so commits authored before the deadline
 * count. Only commits count: uncommitted work scores nothing.
 */
async function bell($: $, onEvent: (text: string) => void, isForfeit = false): Promise<Match | null> {
  if (belling) return belling
  belling = ringBell($, onEvent, isForfeit)
  try {
    return await belling
  } finally {
    belling = null
  }
}

/** Waits until no scan is in flight in this session (a settled scan may chain one more). */
async function settleScans() {
  for (let i = 0; i < 20 && scanning; i++) await scanning.catch(() => null)
}

function waitMs($: $, ms: number) {
  return new Promise<void>(resolve => {
    $.clock.after(ms, () => resolve())
  })
}

async function ringBell($: $, onEvent: (text: string) => void, isForfeit: boolean): Promise<Match | null> {
  const first = await storeGet<Match | null>($, K.match, null)
  if (!first || first.status !== 'live' || !Array.isArray(first.plan)) return null
  const hist0 = await storeGet<Match[]>($, K.history, [])
  const prev = hist0.find(x => x.id === first.id)
  if (prev) {
    await save($, K.match, prev)
    await update($, match, () => prev)
    return prev
  }
  await keepLease($, first.id)
  let pending: Promise<unknown> = Promise.resolve()
  const keeper = $.clock.every(5000, () => {
    pending = keepLease($, first.id)
  })
  try {
    if (!isForfeit) {
      await settleScans()
      let r = await runScan($, true).catch(() => null)
      const giveUp = (await $.clock.now()) + 130_000
      const waiting = () => (r?.claimed ?? []).some(c => c.authoredAt >= first.startAt && c.authoredAt <= first.deadline)
      while (waiting() && (await $.clock.now()) < giveUp) {
        await waitMs($, 5000)
        await settleScans()
        r = await runScan($, true).catch(() => null)
      }
      await syncMatch($)
    }
  } finally {
    keeper.cancel()
    await pending.catch(() => null)
  }
  stopTicker?.()
  stopTicker = null
  const t = await $.clock.now()
  const hist = await storeGet<Match[]>($, K.history, [])
  const m = await storeGet<Match | null>($, K.match, null)
  if (!m || m.id !== first.id) return m
  const done0 = hist.find(x => x.id === m.id)
  if (done0 || m.status !== 'live') {
    const fin = done0 ?? m
    await save($, K.match, fin)
    await update($, match, () => fin)
    return fin
  }
  const oppPoints = oppAt(m.plan, isForfeit ? t : m.deadline, m.deadline)
  const status: Match['status'] = isForfeit ? 'forfeit' : resultOf(m.myPoints, oppPoints)
  const rec = await storeGet<Record3>($, K.record, { w: 0, l: 0, d: 0 })
  const before = await storeGet($, K.rating, START_RATING)
  const result = status === 'won' ? 1 : status === 'draw' ? 0.5 : 0
  const after = status === 'void' ? before : elo(before, m.opp.rating, result, rec.w + rec.l + rec.d)
  const done: Match = {
    ...m,
    oppPoints,
    status,
    ratingBefore: before,
    ratingAfter: after,
    endedAt: t,
    chat: [...m.chat, { at: t, who: m.opp.handle, text: status === 'won' ? 'gg, well played' : 'gg' }],
  }
  // The history is the commit point: written first, so a second bell converges on this result.
  const nextHist = [done, ...hist.filter(x => x.id !== done.id)].slice(0, 30)
  await save($, K.history, nextHist)
  await save($, K.match, done)
  if (status !== 'void') {
    const nextRec = { w: rec.w + (result === 1 ? 1 : 0), l: rec.l + (result === 0 ? 1 : 0), d: rec.d + (result === 0.5 ? 1 : 0) }
    await save($, K.record, nextRec)
    await save($, K.rating, after)
    await update($, record, () => nextRec)
    await update($, rating, () => after)
  }
  await update($, history, () => nextHist)
  await update($, match, () => done)
  warned.add(`${done.id}:result`)
  onEvent(resultLine(done))
  return done
}

async function sendChat($: $, text: string) {
  // The box empties on Send whatever happens next.
  await update($, chatDraft, () => '')
  if ((await read($, settings)).surfaces.chat !== 'on') return false
  const m = await storeGet<Match | null>($, K.match, null)
  const msg = clean(text).trim().slice(0, 280)
  if (!m || !msg || !Array.isArray(m.plan)) return false
  const t = await $.clock.now()
  const me = (await read($, settings)).handle
  const line: ChatLine = { at: t, who: me, text: msg }
  await matchApply($, m.id, cur => ({ ...cur, chat: [...cur.chat, line] }))
  if (m.status === 'live') {
    const reply = pick(Math.random, REPLIES)
    $.clock.after(1500 + Math.random() * 4000, () => void botReply($, m.id, m.opp.handle, reply))
  }
  return true
}

async function botReply($: $, id: string, who: string, text: string) {
  const t = await $.clock.now()
  await matchApply($, id, cur => ({ ...cur, chat: [...cur.chat, { at: t, who, text }] }))
}

/**
 * A past session raced against a bot over the same span: your real scored
 * commits at their real times, the bot seeded by the session id. Unrated.
 */
async function replay($: $, s: PastSession, run: BacktestRun) {
  const r = rng(hash(s.id))
  const mine = await storeGet($, K.rating, START_RATING)
  const rival = pick(r, RIVALS)
  const hours = Math.max(0.25, (s.endAt - s.startAt) / 3_600_000)
  const pace = Math.max(6, (run.points / hours) * (0.75 + r() * 0.5))
  const plan = botPlan(hash(s.id), s.startAt, s.endAt, pace)
  const oppPoints = oppAt(plan, s.endAt, s.endAt)
  const m: Match = {
    id: `r-${s.id}`,
    kind: 'replay',
    hours,
    startAt: s.startAt,
    deadline: s.endAt,
    opp: { handle: rival.handle, rating: Math.round(mine + (r() - 0.5) * 100), pace },
    plan,
    myPoints: run.points,
    oppPoints,
    feed: run.commits.map(c => ({ at: c.authoredAt, who: 'me', points: c.points, category: c.category, title: c.title })),
    counted: run.commits.map(c => c.pid),
    chat: [],
    status: resultOf(run.points, oppPoints),
    ratingBefore: mine,
    ratingAfter: mine,
    lease: { owner, at: await $.clock.now() },
    endedAt: s.endAt,
    label: s.title,
  }
  await save($, K.match, m)
  await update($, match, () => m)
  return m
}

async function clearMatch($: $) {
  const m = await storeGet<Match | null>($, K.match, null)
  if (m && m.status === 'live') return false
  await $.store.delete(K.match)
  await update($, match, () => null)
  return true
}

// ================================================================== CALIBRATION

type CalRow = {
  sha: string
  repo: string
  title: string
  size: string
  runs: { base: number; craft: string; points: number; category: string }[]
  failed: number
  firstError?: string
}

/**
 * Scores real commits several times each with the current judge (no cache)
 * and reports the spread, the distribution and how often craft fires; with
 * `pairs`, compares squash merges against the sum of their branch commits.
 * Exposed to Claude as the mcp__ccsr__calibrate tool. Runs on the player's plan.
 */
async function calibrate($: $, count: number, runs: number, days: number, pairs: boolean) {
  const t = await $.clock.now()
  const model = (await read($, settings)).model
  const from = t - days * 86_400_000
  const pool: { root: string; raw: RawCommit; listed: RawCommit[] }[] = []
  const squashPairs: { root: string; sq: RawCommit; branch: RawCommit[]; listed: RawCommit[] }[] = []
  for (const root of await getRepos($)) {
    try {
      const emails = await myEmails($, root)
      const listed = await listCommits($, root, emails, from - 14 * 86_400_000, t)
      await withPoints($, listed)
      const locals = listed.filter(c => !isSquashCommit(c))
      const consumed = new Set<string>()
      for (const raw of [...listed].sort((a, b) => a.authoredAt - b.authoredAt)) {
        if (raw.authoredAt < from) continue
        if (isSquashCommit(raw)) {
          // The same evidence rules the scan uses decide which branch commits a squash stands for.
          const shas = await branchOf($, root, raw, locals, consumed)
          const branch = shas ? locals.filter(c => shas.includes(c.sha)) : []
          if (branch.length >= 2 && branch.length <= 8) squashPairs.push({ root, sq: raw, branch, listed })
          continue
        }
        if (raw.files.length && !raw.files.every(isNoise) && raw.added + raw.deleted > 0) pool.push({ root, raw, listed })
      }
    } catch {}
  }
  // Spread across sizes: sort by lines changed and take evenly spaced commits.
  pool.sort((a, b) => a.raw.added + a.raw.deleted - (b.raw.added + b.raw.deleted))
  const n = Math.min(count, pool.length)
  const chosen = Array.from({ length: n }, (_, i) => pool[Math.floor((i * pool.length) / Math.max(1, n))]!).filter(Boolean)

  const rows: CalRow[] = []
  const queue = [...chosen]
  const worker = async () => {
    while (queue.length) {
      const item = queue.shift()!
      const text = await digest($, item.root, item.raw, item.listed)
      const size = `+${item.raw.added} -${item.raw.deleted} in ${item.raw.files.length} files`
      const row: CalRow = { sha: item.raw.sha.slice(0, 8), repo: repoName(item.root), title: item.raw.title.slice(0, 70), size, runs: [], failed: 0 }
      for (let k = 0; k < runs; k++) {
        try {
          const v = await judge($, model, text, item.raw.title, size)
          row.runs.push({ base: v.base, craft: v.craft, points: stepCraft(v.base, v.craft), category: v.category })
        } catch (err) {
          row.failed++
          row.firstError = row.firstError || clean((err as Error).message)
        }
      }
      rows.push(row)
      await update($, labNote, () => `Calibration: ${rows.length} of ${chosen.length} commits scored`)
    }
  }
  await Promise.all([worker(), worker(), worker(), worker()])

  const pairOut: { title: string; squash: number; branchSum: number; branch: number[]; error?: string }[] = []
  if (pairs) {
    for (const p of squashPairs.slice(0, 5)) {
      try {
        const size = `+${p.sq.added} -${p.sq.deleted} in ${p.sq.files.length} files`
        const sqv = await judge($, model, await digest($, p.root, p.sq, []), p.sq.title, size)
        const parts: number[] = []
        for (const c of [...p.branch].sort((a, b) => a.authoredAt - b.authoredAt)) {
          const v = await judge($, model, await digest($, p.root, c, p.listed), c.title, `+${c.added} -${c.deleted} in ${c.files.length} files`)
          parts.push(stepCraft(v.base, v.craft))
        }
        pairOut.push({ title: p.sq.title.slice(0, 70), squash: stepCraft(sqv.base, sqv.craft), branchSum: parts.reduce((a, b) => a + b, 0), branch: parts })
      } catch (err) {
        pairOut.push({ title: p.sq.title.slice(0, 70), squash: -1, branchSum: -1, branch: [], error: clean((err as Error).message) })
      }
    }
  }

  const all = rows.flatMap(r => r.runs)
  const dist: Record<string, number> = {}
  for (const v of all) dist[v.points] = (dist[v.points] ?? 0) + 1
  const multi = rows.filter(r => r.runs.length > 1)
  const stable = multi.filter(r => new Set(r.runs.map(v => v.points)).size === 1).length
  const spreadSteps = multi.map(r => {
    const idx = r.runs.map(v => [0, 1, 2, 3, 5, 8, 13, 21].indexOf(v.points))
    return Math.max(...idx) - Math.min(...idx)
  })
  const spreadPoints = multi.map(r => Math.max(...r.runs.map(v => v.points)) - Math.min(...r.runs.map(v => v.points)))
  const failedRuns = rows.reduce((n, r) => n + r.failed, 0)
  const crafts: Record<string, number> = {}
  for (const v of all) crafts[v.craft] = (crafts[v.craft] ?? 0) + 1
  const summary = {
    model,
    rubric: RUBRIC,
    commits: rows.length,
    runsPerCommit: runs,
    identicalAcrossRuns: `${stable} of ${multi.length}`,
    failedRuns,
    firstError: rows.find(r => r.firstError)?.firstError ?? '',
    maxSpreadSteps: Math.max(0, ...spreadSteps),
    maxSpreadPoints: Math.max(0, ...spreadPoints),
    meanSpreadSteps: spreadSteps.length ? Number((spreadSteps.reduce((a, b) => a + b, 0) / spreadSteps.length).toFixed(2)) : 0,
    distribution: dist,
    craft: crafts,
    meanPoints: all.length ? Number((all.reduce((a, v) => a + v.points, 0) / all.length).toFixed(2)) : 0,
  }
  await update($, labNote, () => `Calibration done: ${summary.identicalAcrossRuns} commits scored the same every run, mean ${summary.meanPoints} points, max spread ${summary.maxSpreadPoints} points${failedRuns ? `, ${failedRuns} failed runs (${summary.firstError})` : ''}.`)
  return { summary, pairs: pairOut, rows }
}

// ================================================================== SERVER
// The CCSR server (docs/api.md). Every request goes through api(); scores wait
// in an outbox in the store until the server has them, so a commit made
// offline still lands once it's back.

const SERVER0: ServerConfig = { url: DEFAULT_SERVER, token: null, handle: null }
let flushing: Promise<void> | null = null

async function serverCfg($: $) {
  return { ...SERVER0, ...(await storeGet<Partial<ServerConfig>>($, K.server, {})) }
}

/** An error message without any sign-in flow's id (W5b: the id is a credential, and it rides in the path). */
function unflowed(msg: string) {
  return msg.replace(/\/identities\/flows\/[^\s/?#]+/g, '/identities/flows/')
}

/**
 * One request: `{ status, json, retryAfterMs }`, status 0 when the server
 * couldn't be reached, `retryAfterMs` what a 429 or 503 asked us to wait.
 */
async function api($: $, method: string, path: string, body?: unknown, as: { url?: string; token?: string | null; keepNote?: boolean } = {}): Promise<{ status: number; json: unknown; retryAfterMs: number | null }> {
  const cfg = { ...(await serverCfg($)), ...as }
  // Which mod and Claude Code this is: below the server's floor, ranked play is refused (docs/api.md, "Versions").
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json', 'x-ccsr-mod': VERSION }
  const claude = await claudeVersion($)
  if (claude) headers['x-ccsr-claude'] = claude
  if (cfg.token) headers.authorization = `Bearer ${cfg.token}`
  let res: { status: number; text: string; headers?: Record<string, string> }
  try {
    res = await $.http.fetch(`${cfg.url}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch (err) {
    // A sign-in flow's id never goes in the note (W5b): it rides in the path, it can mint a token, and `link` is in $.state.
    await update($, link, l => ({ ...l, online: false, note: `Can't reach ${cfg.url}: ${unflowed(clean((err as Error).message)).slice(0, 100)}` }))
    return { status: 0, json: null, retryAfterMs: null }
  }
  let json: unknown = null
  try {
    json = res.text ? JSON.parse(res.text) : null
  } catch {
    json = null
  }
  // Staff can rename an account (scripts/handle.sh give), and the handle is the server's to say: every
  // read of this install's own account carries it, whoever asked (boot, the standings, the sign-in rows).
  if (method === 'GET' && path === '/me' && res.status === 200 && cfg.token && !as.url && as.token === undefined) {
    const handle = (json as { player?: { handle?: unknown } } | null)?.player?.handle
    if (typeof handle === 'string' && handle !== cfg.handle && !handleProblem(handle)) await adoptHandle($, cfg.token, handle)
  }
  // A proxy's error page means the server itself isn't answering. The server's own 503 (no_season,
  // try_again) comes with its error JSON: it was reached, so the mod stays online and its loop backs off.
  const reached = res.status < 502 || res.status > 504 || errorOf(json) !== null
  // W4b: reached after being offline fires the notices' back_online trigger.
  const wasOffline = (await read($, link)).online === false
  // A background read (`keepNote`: the lanes between matches) leaves a press's note alone; coming back online still clears the offline one.
  await update($, link, l => (reached ? ((l.online === true && !l.note) || (as.keepNote && l.online === true) ? l : { ...l, online: true, note: '' }) : { ...l, online: false, note: `The server answered ${res.status}` }))
  if (reached && wasOffline) void noticeEvent($, { on: 'back_online' }).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  const latest = res.headers?.['x-ccsr-latest']
  const min = res.headers?.['x-ccsr-min']
  if (latest && min) await noteRelease($, latest, min)
  // The config's version rides on every answer: a new one means read GET /config again (after a jitter, never inline).
  const version = res.headers?.['x-ccsr-config']
  if (version && !as.url) void noteConfigHeader($, version).catch(() => null)
  const retryAfter = res.status === 429 || res.status === 503 ? retryAfterMs(json, res.headers?.['retry-after']) : null
  return { status: res.status, json, retryAfterMs: retryAfter }
}

// ------------------------------------------------------------------ config
// The server holds the policy (docs/api.md, "Config"): poll intervals, the kill
// switches and, as later items land, lengths, buckets, notices, sign-in,
// challenges and finishers. The mod reads GET /config at start, every
// `poll_ms.config`, after a sign-in, a sign-out or a server switch, and when an
// answer's `x-ccsr-config` names another version. The raw body is kept in the
// store by server and handle, so every session on this machine shares one read
// and a session offline keeps the last one. Until a read lands, CONFIG0: 0.3.0's
// behaviour. Config text is server text: it never reaches commandText,
// $.prompt or $.session.append, and draws as Text, never Markdown.

/** Why the config is read. `bucket` (W3b): the server refused or dropped a bucket the held config lists, so what config says about buckets is stale. */
type ConfigWhy = 'boot' | 'timer' | 'header' | 'signin' | 'signout' | 'server' | 'bucket'
type ConfigCache = Record<string, { body: unknown; at: number }>

/** How many servers and handles the store keeps a config for. */
const CONFIG_KEEP = 4

let configFlight: Promise<ModConfig> | null = null
/** When the config this session holds was read (its read began), by this session or another: header re-reads and the timer count from it. */
let configReadAt = 0
let configReread: { cancel: () => void } | null = null
/** The version this session holds, for the header check every answer makes (no state read while it's the same). */
let configVersion = ''
let configSkew = 0
/** The surface the pane last drew on, sent as ?surface= (nothing before the first draw). */
let paneSurface: Surface | null = null
const configTicks = new Set<(cfg: ModConfig, why: string) => void | Promise<void>>()

/** Whose config this is: the server and the handle signed in there. */
function keyOf(server: Pick<ServerConfig, 'url' | 'handle'>) {
  return `${server.url}|${server.handle ?? ''}`
}

async function configKey($: $) {
  return keyOf(await serverCfg($))
}

/**
 * The config this session plays by. Never throws: anything wrong reads as
 * CONFIG0. A copy held for another server or handle is never used: until the
 * read that follows a sign-in, a sign-out or a server switch lands (or takes
 * that key's cached copy), it's CONFIG0. A caller that already read the
 * server entry passes it, so a draw costs one state read.
 */
export async function configOf($: $, server?: Pick<ServerConfig, 'url' | 'handle'>): Promise<ModConfig> {
  try {
    const held = await read($, config)
    return held.key === (server ? keyOf(server) : await configKey($)) ? held : CONFIG0
  } catch {
    return CONFIG0
  }
}

/** The local clock's offset from the server's, from the last config read: server time is local time plus this. */
export function configSkewMs() {
  return configSkew
}

/**
 * Runs `fn` after every config read or adoption, changed or not (W4's stats
 * flush rides this cadence). Returns the way to stop. Register from boot: a
 * reload starts the module, and this list, over.
 */
export function onConfigTick(fn: (cfg: ModConfig, why: string) => void | Promise<void>) {
  configTicks.add(fn)
  return () => void configTicks.delete(fn)
}

/**
 * Reads the config again, single-flight per session: a timer, header or boot
 * call made while a read runs gets that read; a sign-in, sign-out or server
 * switch gets a fresh one after it, since the key may have changed under it,
 * and so does a bucket refusal (W3b), since the read in flight may have begun
 * before the change the server just refused on.
 * `want` is the version a header named: a cached copy at that version is
 * taken without asking.
 */
export function refreshConfig($: $, why: ConfigWhy, want?: string): Promise<ModConfig> {
  if (configFlight) return why === 'signin' || why === 'signout' || why === 'server' || why === 'bucket' ? configFlight.then(() => refreshConfig($, why, want)) : configFlight
  const flight = readConfig($, why, want).finally(() => {
    if (configFlight === flight) configFlight = null
  })
  configFlight = flight
  return flight
}

async function readConfig($: $, why: ConfigWhy, want?: string): Promise<ModConfig> {
  const key = await configKey($)
  const t0 = await $.clock.now()
  const held = await read($, config)
  const mine = held.key === key ? configReadAt : 0
  // A copy in the store newer than ours (another session's read, or this key's from before a
  // sign-in or a server switch) is taken at once; offline it's what we play by. Fresh enough, on
  // a timer, header or boot read, and that's the whole read. A sign-in, sign-out or switch asks anyway.
  const c = (await storeGet<ConfigCache>($, K.config, {}))[key]
  const parsed = c ? parseConfig(c.body) : CONFIG0
  if (c && parsed !== CONFIG0 && c.at > mine) {
    await holdConfig($, parsed, key, c.at)
    const fresh = t0 - c.at < parsed.poll.config && (want === undefined || parsed.version === want)
    if (fresh && (why === 'boot' || why === 'timer' || why === 'header')) return tickConfig($, parsed, why)
  }
  configReadAt = t0
  // W3b: a `bucket` read follows a refusal or a drop, whose note must stay beside the checklist it brings, so it's a background
  // read. Any other read clears a press's note, as W1b's did, so a stale line never outlives what it said (coming back online
  // still clears the offline line either way).
  const r = await api($, 'GET', configPath(paneSurface), undefined, { keepNote: why === 'bucket' })
  // Signed in or out while it was asked: the read that follows the change is the one that counts.
  if ((await configKey($)) !== key) return configOf($)
  if (r.status === 200) {
    const parsed = parseConfig(r.json)
    if (parsed !== CONFIG0) {
      const t1 = await $.clock.now()
      const serverAt = Date.parse(String((r.json as { server_time?: unknown }).server_time ?? ''))
      if (Number.isFinite(serverAt)) configSkew = Math.round(serverAt - (t0 + t1) / 2)
      const cache = await storeGet<ConfigCache>($, K.config, {})
      const keep = Object.entries({ ...cache, [key]: { body: r.json, at: t0 } })
        .sort((x, y) => y[1].at - x[1].at)
        .slice(0, CONFIG_KEEP)
      await save($, K.config, Object.fromEntries(keep))
      await holdConfig($, parsed, key, t0)
      return tickConfig($, parsed, why)
    }
  } else if (r.status === 404 && errorOf(r.json)?.code === 'not_found') {
    // A server from before the switchboard: 0.3.0's behaviour, and nothing kept for it.
    const cache = await storeGet<ConfigCache>($, K.config, {})
    if (cache[key]) {
      const { [key]: _gone, ...rest } = cache
      await save($, K.config, rest)
    }
    await holdConfig($, CONFIG0, key, t0)
    return tickConfig($, CONFIG0, why)
  }
  // Offline, limited or broken: keep playing by the copy we have.
  return tickConfig($, await configOf($), why)
}

/**
 * Config bodies equal but for the server's clock. W3b: the version alone can't say a read
 * brought nothing new, since it doesn't move when a player's own checklist does (W3a's
 * buckets part hashes the requirement labels, not who meets them), nor when a notice's
 * per-player variables fill differently.
 */
function sameConfig(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>) {
  const { server_time: _a, ...x } = a
  const { server_time: _b, ...y } = b
  return JSON.stringify(x) === JSON.stringify(y)
}

/** Puts a config in this session's atom, and applies what changed at once. */
async function holdConfig($: $, next: ModConfig, key: string, at: number) {
  configReadAt = Math.max(configReadAt, at)
  configVersion = next.version
  const held = await read($, config)
  if (held.key === key && held.version === next.version && held.readAt && sameConfig(held.raw, next.raw)) return
  await update($, config, () => ({ ...next, poll: { ...next.poll }, chat: { ...next.chat }, raw: { ...next.raw }, key, readAt: at }))
  // A room switched off: its lines and cursor go now, so a raid's lines never show again.
  await update($, link, l => (l.lobby && roomOff(next, l.rooms, l.lobby.room) ? { ...l, lobby: null } : l))
  await refreshStatus($)
}

async function tickConfig($: $, cfg: ModConfig, why: string) {
  for (const fn of [...configTicks]) {
    try {
      await fn(cfg, why)
    } catch (err) {
      $.ui.log(`CCSR config: ${(err as Error).message}`)
    }
  }
  return cfg
}

/** An answer named a config version: re-read after a jitter, at most once per 30 s, never inline. */
async function noteConfigHeader($: $, version: string) {
  if (version === configVersion || configReread || configFlight) return
  const t = await $.clock.now()
  if (!headerReread(version, await configOf($), configReadAt, t)) return
  configReread = $.clock.after(jitterMs(REREAD_JITTER_MS), () => {
    configReread = null
    void refreshConfig($, 'header', version).catch(err => $.ui.log(`CCSR config: ${(err as Error).message}`))
  })
}

/** This session's Claude Code version for x-ccsr-claude, or null where the API doesn't say. */
async function claudeVersion($: $) {
  try {
    const v = await $.session.version()
    return v.base ?? v.version
  } catch {
    return null
  }
}

/** The server's release line, from its headers: keep it, and toast once per release that an update is out, between matches. */
async function noteRelease($: $, latest: string, min: string) {
  const l = await read($, link)
  if (l.release?.latest !== latest || l.release?.min !== min) await update($, link, x => ({ ...x, release: { latest, min } }))
  if (standing({ latest, min }) === 'current') return
  // W4b: the notices' update_available trigger, kept armed while the mod sees an update (noticeEvent keeps it to one a
  // minute), one arming per newer release however far apart the answers naming it come (releaseArming). The clock is read
  // before releaseArmed, so two answers landing together never both begin an arming.
  const at = await $.clock.now()
  releaseArmed = releaseArming(releaseArmed, latest, at)
  void noticeEvent($, { on: 'update_available' }, releaseArmed.start).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  if ((await rankedShared($)).phase !== 'idle') return
  if ((await storeGet<string>($, K.updateSeen, '')) === latest) return
  await save($, K.updateSeen, latest)
  await ambient($, `${MOD.updateOut(latest)} ${MOD.autoUpdate}`)
}

/**
 * A 426 from the queue or a ready check: true when it was one. A mod below the
 * floor keeps the release line, and the Ranked box shows the update line and
 * button; a Claude Code below its floor gets the server's line as the note.
 */
async function refusedForUpdate($: $, r: { status: number; json: unknown }) {
  if (r.status !== 426) return false
  const u = (r.json as { update?: { what: 'mod' | 'claude'; min: string; latest: string | null } } | null)?.update
  if (u?.what === 'mod') await update($, link, l => ({ ...l, release: { latest: u.latest ?? u.min, min: u.min }, note: '' }))
  else await update($, link, l => ({ ...l, note: errorOf(r.json)?.message ?? 'Update Claude Code to play ranked.' }))
  return true
}

/**
 * Update from the install repo: run the two commands where the mods API runs
 * processes (the terminal), or copy them for a terminal (the desktop app). The
 * new version loads once Claude Code restarts.
 */
async function updateMod($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const say = (text: string) => update($, link, l => ({ ...l, updateNote: text }))
  await say(MOD.updating)
  try {
    for (const argv of UPDATE_ARGV) {
      const r = await $.process.run(argv, { timeoutMs: 120_000 })
      if (r.exitCode !== 0) throw new Error(`exit ${r.exitCode}`)
    }
    await say(MOD.updated)
    await ambient($, MOD.updated, 'match')
  } catch {
    // No processes here, no claude on the PATH, or the update failed: hand over the command instead.
    const c = await $.ui.copy({ text: UPDATE_COMMAND, surface }).catch(() => ({ isCopied: false }))
    await say(c.isCopied ? MOD.updateCopied : UPDATE_COMMAND)
  }
}

async function saltOf($: $) {
  const have = await storeGet<string>($, K.salt, '')
  if (have) return have
  const salt = crypto.randomUUID()
  await save($, K.salt, salt)
  return salt
}

// ------------------------------------------------------------------ accounts and installs
// A handle is one player on the server with one token per install (a Claude
// Code config dir on some machine). The token is the only thing this install
// needs, and it is never dropped on a doubt: only the server saying the install
// was removed (`token_revoked`) forgets it. Three ways back in when it's gone:
// the machine's keyring (~/.ccsr/keyring.json, read by every config dir on the
// machine), a link code from another install, or the account's recovery key.

/** The keyring's path, or null where there's no home directory to keep it in. */
async function keyringPath($: $) {
  const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
  return home ? `${home.replace(/[\\/]+$/, '')}/.ccsr/keyring.json` : null
}

/** The keyring, or an empty one when it's missing, unreadable, or there's no fs here (tests). */
async function readKeyring($: $): Promise<Keyring> {
  const empty: Keyring = { v: 1, servers: {} }
  try {
    const path = await keyringPath($)
    if (!path) return empty
    const k = JSON.parse(String(await $.fs.read(path))) as Keyring
    return k && k.v === 1 && k.servers && typeof k.servers === 'object' ? k : empty
  } catch {
    return empty
  }
}

/** Sets or clears this server's entry. Best effort: a keyring that can't be written never stops a sign-in. */
async function writeKeyring($: $, url: string, entry: Keyring['servers'][string] | null) {
  try {
    const path = await keyringPath($)
    if (!path) return
    const k = await readKeyring($)
    if (entry) k.servers[url] = entry
    else delete k.servers[url]
    await $.fs.write(path, JSON.stringify(k, null, 2) + '\n')
  } catch {
    // No fs on this surface, or the home directory isn't writable.
  }
}

/** What Settings calls this install: its config dir, with the home directory as ~. */
async function installLabel($: $) {
  const home = (await $.env.get('HOME').catch(() => undefined)) ?? ''
  const dir = (await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)) || '~/.claude'
  return (home && dir.startsWith(home) ? `~${dir.slice(home.length)}` : dir).slice(0, 64)
}

/**
 * A write of the lease, the snapshot or the shared reads. The store's own failure (its lock, when
 * many sessions write at once: "Lock file is already being held"; a full disk) is logged for
 * debugging and never toasted: each of these is written again by a later tick, and save()'s toast
 * came back on every one. Says whether it landed.
 */
async function saveQuiet($: $, key: string, value: unknown): Promise<boolean> {
  try {
    await $.store.set(key, value)
    return true
  } catch (err) {
    try {
      $.ui.log(`CCSR store (${key}): ${clean(String((err as Error | undefined)?.message ?? err))}`, { to: 'debug' })
    } catch {
      // Nowhere to say it.
    }
    return false
  }
}

/** The `at` of the shared account and board reads (`seen`) this session last took or wrote. */
let seenAt = 0
/** When the account this session holds was read from the server (its own GET /me, or the `meAt` of the copy it took): an older one is never taken over it. */
let meHeldAt = 0

/**
 * What a read of this session's found about the account or the boards goes into the store, for
 * every other session to take instead of asking the server itself (adoptSeen). What another
 * session left there is taken first, so its part isn't lost under this one's.
 */
async function shareSeen($: $, part: Partial<Record<SeenField, unknown>>, isAccount = false) {
  // Every field but the ones this read just answered: those are newer here than in any copy.
  await adoptSeen($, Object.keys(part) as SeenField[])
  const key = await configKey($)
  const cur = seenCopyOf(await storeGet<unknown>($, K.seen, null))
  const t = await $.clock.now()
  const kept = cur && cur.key === key ? cur : null
  const at = Math.max(t, (cur?.at ?? 0) + 1)
  // `meAt` moves only with an account read: a board read merged over the store's copy carries that copy's account, as old as it was.
  const next: SeenCopy = { ...(kept ?? {}), ...part, key, at, by: owner, ...(isAccount ? { meAt: at } : kept?.meAt !== undefined ? { meAt: kept.meAt } : {}) }
  if (isAccount) meHeldAt = Math.max(meHeldAt, at)
  // Counted as this session's only once it is in the store: a write that failed is another session's to make, or the next read's.
  if (await saveQuiet($, K.seen, next)) seenAt = next.at
}

/**
 * Takes the account and board reads another session made since this one last looked: no request,
 * and the status line and the cards follow. `except`: fields this session has just read itself.
 */
async function adoptSeen($: $, except: readonly SeenField[] = []) {
  const copy = seenCopyOf(await storeGet<unknown>($, K.seen, null))
  // The account fields come only with an account read newer than the one held here (seenToTake's meSince).
  const take = seenToTake(copy, await configKey($), seenAt, meHeldAt)
  if (!copy) return
  if (copy.at > seenAt) seenAt = copy.at
  if (!take) return
  if ('me' in take) {
    meHeldAt = copy.meAt ?? meHeldAt
    // The account as another session read it after the result this session was waiting on: nothing is owed any more. By the
    // account read's own stamp, never the copy's: a board read written after a failed account read carries the old account.
    if (accountOwed && meHeldAt >= accountOwed.since) accountOwed = null
  }
  for (const f of except) delete take[f]
  await update($, link, l => ({
    ...l,
    ...('me' in take ? { me: take.me as ApiPlayer | null } : {}),
    ...('account' in take ? { account: take.account as ApiAccount | null } : {}),
    ...('meBuckets' in take ? { meBuckets: take.meBuckets as unknown[] | null } : {}),
    ...('ladder' in take ? { ladder: take.ladder as ApiRankedRow[] | null } : {}),
    ...('myRank' in take ? { myRank: take.myRank as number | null } : {}),
    ...('grindRank' in take ? { grindRank: take.grindRank as number | null } : {}),
    ...('grindOf' in take ? { grindOf: take.grindOf as number | null } : {}),
    ...('recent' in take ? { recent: take.recent as ApiRecentMatch[] | null } : {}),
  }))
}

/** The shared ranked state as this session's last slowSync saw it (`live:<match id>`, else the phase): how it tells a match ended in another session. */
let rankedSeen: string | null = null
/** The match whose result this session's own poll read (pollMatch), and read the account after: slowSync has nothing to add for it. */
let accountAfter: string | null = null
/**
 * The account read a decided match still owes this session: asked for by its own poll, or left to
 * the leader's (a follower takes the leader's copy from `seen`). `since` is when the result was
 * read. It is settled by an account read of this session's that answers, or by a copy taken from
 * `seen` that is newer than `since`; until then slowSync asks again a minute on, a few times, so
 * one failed read (a 5xx right after the result) doesn't leave every session on the old rating.
 */
let accountOwed: { id: string; since: number; tries: number } | null = null
const ACCOUNT_OWED_MS = 60_000
const ACCOUNT_OWED_TRIES = 5

/**
 * Who we are and the season's judge, from the server, into this session's
 * link. With no token, the keyring may sign this install in on its own.
 */
async function refreshAccount($: $) {
  const cfg = await serverCfg($)
  const season = await api($, 'GET', '/season')
  if (season.status === 200) await update($, link, l => ({ ...l, season: (season.json as { season: ApiSeason }).season }))
  if (!cfg.token) {
    await linkFromKeyring($)
    return
  }
  const askedAt = await $.clock.now()
  const me = await api($, 'GET', '/me')
  if (me.status === 200) {
    // Asked after the result it was owed for: settled.
    if (accountOwed && askedAt >= accountOwed.since) accountOwed = null
    // W3b: where you stand in each bucket on for you (W3a), read through standingFor; a server before W3a sends none.
    const kept = (me.json as { buckets?: unknown } | null)?.buckets
    await update($, link, l => ({ ...l, meBuckets: Array.isArray(kept) ? kept.slice(0, 8) : null }))
    const j = me.json as { player: ApiPlayer; account?: ApiAccount; settings?: { model_stats?: unknown } }
    await update($, link, l => ({ ...l, me: j.player, account: j.account ?? null, unknownToken: false }))
    // W6b: the account's Challenges switch is the one this install shows.
    await heardChallenges($, j.player, askedAt)
    // W5b: this read serves the sign-in rows and the new-install warning too, while sign-in is on.
    if (providersOn(await configOf($, cfg)).length > 0) {
      identityReadAt = await $.clock.now()
      await warnNewInstalls($, j.account ?? null)
    }
    if (j.account) await adoptSalt($, j.account.salt)
    // W7-2: Model stats is held on the server (on by default); a server before W7-1 doesn't say.
    if (typeof j.settings?.model_stats === 'boolean') await holdModelStats($, j.settings.model_stats)
    await syncCapture($)
    // Accounts from before the keyring: put this one in it, so the machine's other config dirs find it.
    const k = await readKeyring($)
    if (!k.servers[cfg.url]) await writeKeyring($, cfg.url, { handle: j.player.handle, token: cfg.token, recovery_key: cfg.recoveryKey ?? null })
    await loadInstalls($)
    // For the machine's other sessions: they take this read instead of making their own. Last, so nothing above waits on it.
    await shareSeen($, { me: j.player, account: j.account ?? null, meBuckets: Array.isArray(kept) ? kept.slice(0, 8) : null }, true)
    return
  }
  if (me.status !== 401) return
  if (errorOf(me.json)?.code === 'token_revoked') {
    await forgetHere($, ACCOUNT.removed)
    return
  }
  // Unknown is not gone: a wrong server address or a restored database. Keep the token and offer the ways in.
  await update($, link, l => ({ ...l, me: null, unknownToken: true, note: ACCOUNT.unknown }))
}

/** A new config dir on a machine that already plays: link it with the keyring's token, no code needed. */
async function linkFromKeyring($: $) {
  if (await storeGet<boolean>($, K.optOut, false)) return
  const cfg = await serverCfg($)
  const entry = (await readKeyring($)).servers[cfg.url]
  if (!entry?.token) return
  const code = await api($, 'POST', '/accounts/link-code', {}, { token: entry.token })
  if (code.status === 401) {
    if (errorOf(code.json)?.code === 'token_revoked') await writeKeyring($, cfg.url, null)
    return
  }
  if (code.status !== 201) return
  const r = await api($, 'POST', '/accounts/link', { code: (code.json as { code: string }).code, install: await installLabel($) }, { token: null })
  if (r.status !== 201) return
  await signedIn($, r.json as SignInReply, entry.recovery_key ?? null)
  await update($, link, l => ({ ...l, note: ACCOUNT.autoLinked((r.json as SignInReply).player.handle) }))
}

/**
 * The server answered GET /me with another handle than this install holds: staff renamed the
 * account. Take it everywhere the old one is kept (the sign-in, Settings, the keyring), or the
 * profile read asks for a handle nobody has and a match can't tell this side from the other.
 * api() calls this on every read of the account; syncHandle makes one before anything that tells
 * a match's sides apart. `token` is the one that /me was asked with: a sign-in that landed
 * meanwhile keeps its own handle.
 */
async function adoptHandle($: $, token: string, handle: string) {
  const cfg = await serverCfg($)
  if (cfg.token !== token || cfg.handle === handle) return
  await save($, K.server, { ...cfg, handle })
  await saveSettings($, { handle })
  const entry = (await readKeyring($)).servers[cfg.url]
  if (entry && entry.handle === cfg.handle) await writeKeyring($, cfg.url, { ...entry, handle })
  // The boards held mark this player's row by the old handle: read them again. `me` is what the pane's
  // header, Settings and the Ranked tab's own row draw, and not every caller of GET /me writes it back.
  await update($, link, l => ({ ...l, boards: null, me: l.me ? { ...l.me, handle } : l.me }))
  // The config is held per server and handle.
  void refreshConfig($, 'signin').catch(() => null)
}

/** How long a press waits on the account read before it goes on without it. */
const SYNC_HANDLE_MS = 2000

/**
 * Reads this install's account, so a rename is taken (api() adopts it) before the mod queues or
 * takes a challenge: from there on it tells its side of the match by handle. The server never
 * renames a player who is queued or in a match, so one read here is enough. `$.http.fetch` has
 * no timeout and GET /me can wait on a ladder read under load, so a press waits `waitMs` at most
 * and goes on; the read still lands, and adopts, behind it.
 */
async function syncHandle($: $, waitMs: number | null = null) {
  if (!(await serverCfg($)).token) return
  const read = api($, 'GET', '/me', undefined, { keepNote: true }).then(
    () => undefined,
    () => undefined,
  )
  if (waitMs === null) return read
  let cancel = () => {}
  await Promise.race([
    read,
    new Promise<void>(resolve => {
      const timer = $.clock.after(waitMs, () => resolve())
      cancel = () => timer.cancel()
    }),
  ])
  cancel()
}

type SignInReply = { token: string; player: ApiPlayer; salt: string | null; has_recovery_key: boolean; recovery_key?: string }

/**
 * Every way in ends here: keep the token, take the account's salt, write the keyring, send this
 * week's scores. `carryWeek` false (a sign-in switch to another handle, W5b) sends none: what
 * this install scored stays with the handle it scored for.
 */
async function signedIn($: $, j: SignInReply, knownKey: string | null = null, carryWeek = true) {
  const cfg = await serverCfg($)
  const handle = j.player.handle
  const recoveryKey = j.recovery_key ?? knownKey ?? (cfg.handle === handle ? (cfg.recoveryKey ?? null) : null)
  await save($, K.server, { ...cfg, token: j.token, handle, recoveryKey })
  await $.store.delete(K.optOut)
  await saveSettings($, { handle })
  // W3b: another handle's bucket standings and boards go with its sign-in; GET /me below reads this one's.
  await update($, link, l => ({ ...l, me: j.player, note: '', unknownToken: false, confirmRemove: false, recoveryFresh: !!j.recovery_key, linkCode: null, ...(l.me?.handle === handle ? {} : { meBuckets: null, boards: null }) }))
  await adoptSalt($, j.salt)
  await writeKeyring($, cfg.url, { handle, token: j.token, recovery_key: recoveryKey })
  // What this handle gets from the switchboard can differ from what an anonymous install got.
  void refreshConfig($, 'signin').catch(() => null)
  await refreshAccount($)
  // This week's scored commits go up with the account, so the Grind starts where the player already is.
  // Last, so what the outbox says (a refused score) is the note left on screen.
  if (!carryWeek) return
  const list = await storeGet<ScoredCommit[]>($, K.ledger, [])
  const since = periodStart('week', await $.clock.now())
  await enqueue(
    $,
    list.filter(c => c.authoredAt >= since && !c.matchOnly),
  )
  await flushOutbox($)
}

/**
 * Every install of an account hashes repo names with the account's salt, so
 * the server sees one repo and one commit identity whichever install sent it.
 * An account from before the server kept salts gets this install's.
 */
async function adoptSalt($: $, serverSalt: string | null) {
  const local = await saltOf($)
  let salt = serverSalt
  if (!salt) {
    const r = await api($, 'POST', '/me/salt', { salt: local })
    if (r.status !== 200) return
    salt = (r.json as { salt: string }).salt
  }
  if (salt === local) return
  await save($, K.salt, salt)
  // Scores still waiting were hashed with the old salt: hash them again.
  const box = await storeGet<OutboxItem[]>($, K.outbox, [])
  if (box.length === 0) return
  const pids = new Set(box.map(b => b.pid))
  const rows = (await storeGet<ScoredCommit[]>($, K.ledger, [])).filter(c => pids.has(c.pid))
  // Their coder blocks (W7-2) come along from the old bodies: the ledger never held them.
  const coders = new Map(box.flatMap(b => (b.body.coder ? [[b.pid, b.body.coder] as const] : [])))
  await save($, K.outbox, [])
  await enqueue($, rows, coders)
}

function signInProblem(r: { status: number; json: unknown }) {
  if (r.status === 0) return "Can't reach the server."
  return errorOf(r.json)?.message ?? `The server answered ${r.status}.`
}

/** Joins with a handle. Returns a problem to show, or '' when joined. */
async function signup($: $, raw: string): Promise<string> {
  const handle = raw.trim().toLowerCase()
  const problem = handleProblem(handle)
  if (problem) {
    await update($, link, l => ({ ...l, note: problem }))
    return problem
  }
  const s = await read($, settings)
  let tz = 'UTC'
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    tz = 'UTC'
  }
  const r = await api($, 'POST', '/accounts', { handle, grind_tracking: s.tracking, share_titles: s.share, time_zone: tz, salt: await saltOf($), install: await installLabel($) }, { token: null })
  if (r.status !== 201) {
    const why = errorOf(r.json)?.code === 'handle_taken' ? 'That handle is taken.' : signInProblem(r)
    await update($, link, l => ({ ...l, note: why }))
    return why
  }
  await signedIn($, r.json as SignInReply)
  return ''
}

/** Joins the account another install is signed in to, with the code it showed. */
async function joinWithCode($: $, raw: string) {
  const code = raw.trim()
  if (!code) return
  const r = await api($, 'POST', '/accounts/link', { code, install: await installLabel($) }, { token: null })
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  await signedIn($, r.json as SignInReply)
}

/** Back in with the account's recovery key. */
async function recoverWith($: $, raw: string) {
  const key = raw.trim()
  if (!key) return
  const r = await api($, 'POST', '/accounts/recover', { recovery_key: key, install: await installLabel($) }, { token: null })
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  await signedIn($, r.json as SignInReply, key)
}

/** A code another install can join with, shown in Settings for 10 minutes. */
async function makeLinkCode($: $) {
  const r = await api($, 'POST', '/accounts/link-code', {})
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  const j = r.json as { code: string; expires_at: string }
  await update($, link, l => ({ ...l, linkCode: { code: j.code, expiresAt: j.expires_at } }))
}

/** A new recovery key; the old one stops working. Shown until copied. */
async function newRecoveryKey($: $) {
  const r = await api($, 'POST', '/me/recovery', {})
  if (r.status !== 201) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  const key = (r.json as { recovery_key: string }).recovery_key
  const cfg = await serverCfg($)
  await save($, K.server, { ...cfg, recoveryKey: key })
  if (cfg.token) await writeKeyring($, cfg.url, { handle: cfg.handle, token: cfg.token, recovery_key: key })
  await update($, link, l => ({ ...l, recoveryFresh: true }))
  await refreshAccount($)
}

async function copyRecoveryKey($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const key = (await serverCfg($)).recoveryKey
  if (!key) return
  const c = await $.ui.copy({ text: key, surface }).catch(() => ({ isCopied: false }))
  await update($, link, l => ({ ...l, recoveryFresh: false, note: c.isCopied ? ACCOUNT.copied : key }))
}

async function loadInstalls($: $) {
  const r = await api($, 'GET', '/me/installs')
  if (r.status === 200) await update($, link, l => ({ ...l, installs: (r.json as { installs: ApiInstall[] }).installs }))
}

/** Removes another install of this account. */
async function removeInstall($: $, id: number) {
  const r = await api($, 'DELETE', `/me/installs/${id}`)
  if (r.status === 200) await update($, link, l => ({ ...l, installs: (r.json as { installs: ApiInstall[] }).installs }))
  else await update($, link, l => ({ ...l, note: signInProblem(r) }))
}

/** Remove this install: the first press warns, the second removes it on the server, then here. */
async function removeThisInstall($: $) {
  const l = await read($, link)
  if (!l.confirmRemove) {
    await update($, link, x => ({ ...x, confirmRemove: true, note: ACCOUNT.removeWarn(l.me?.handle ?? 'your account') }))
    return
  }
  const id = l.account?.install.id
  const r = id ? await api($, 'DELETE', `/me/installs/${id}`) : { status: 401, json: { error: { code: 'token_revoked' } } }
  if (r.status === 200 || (r.status === 401 && errorOf(r.json)?.code === 'token_revoked')) {
    await save($, K.optOut, true)
    await forgetHere($, '')
    return
  }
  await update($, link, x => ({ ...x, confirmRemove: false, note: signInProblem(r) }))
}

/** Forgets this install's sign-in, here and in the keyring when the keyring holds this same token. */
async function forgetHere($: $, note: string) {
  const cfg = await serverCfg($)
  const k = await readKeyring($)
  if (cfg.token && k.servers[cfg.url]?.token === cfg.token) await writeKeyring($, cfg.url, null)
  await save($, K.server, { ...cfg, token: null, handle: null })
  await save($, K.outbox, [])
  await update($, link, () => ({ ...LINK0, online: null, note }))
  void refreshConfig($, 'signout').catch(() => null)
}

// ------------------------------------------------------------------ sign-in with a provider (W5b)
// A fourth way in beside a handle, a link code and a recovery key: the provider's device flow,
// which the server runs (W5a, docs/api.md "Identities"), driven here through identity.ts's
// machine. Drawn only while config's `signin` says dark or optional for the provider; a missing
// or unknown value is off. The band never shows sign-in.
//
// What stays in this module: the flow id (it can mint a token) lives only in identity.ts's
// WeakMap behind `flowRef`, and the card itself (the code the player types on the provider's
// page, the login) is a module variable. `$.state` gets only a counter: every plugin can read
// it, and a code read there could be approved with someone else's account, which would link
// that account to this handle. Nothing here reaches commandText, `$.prompt` or `$.session.append`.

/** The card (identity.ts SignIn). It resets with the module on a reload, as the flow it follows does. */
let signInCard: SignIn = SIGNIN0
/** The flow the card follows; identity.ts keeps its id. */
let flowRef: FlowRef | null = null
/** The card's clock while a flow is open: identity.ts onTick, then a poll when one falls due. */
let signInTimer: { cancel: () => void } | null = null
/**
 * When each poll still out was sent. `$.http.fetch` has no timeout, so a poll that never answers
 * must not stop this flow's next poll, or every later flow's: past SIGNIN_POLL_HUNG_MS the next
 * one may go beside it, at most two out at once (W1b's rule for its loop), and one out past
 * SIGNIN_POLL_GONE_MS stops counting. A late answer still goes to onPoll, which knows its attempt.
 */
let signInPollsOut: number[] = []
const SIGNIN_POLL_HUNG_MS = 60_000
const SIGNIN_POLL_GONE_MS = 10 * 60_000
/** Whether the done on the card signed this install in with a token (else it linked the handle it holds). */
let signInMinted = false
/** The token this install held when the card's flow started: a done that brings a token after the install signed in another way meanwhile is revoked, never kept. */
let signInHeldAtStart: string | null = null
/** The token this install held when Switch was pressed: the only one whose install the switch removes, and only while the store still holds it. */
let switchFromToken: string | null = null
/** When this session last read GET /me for the sign-in rows and the new-install warning. */
let identityReadAt = 0
let identityTicking = false
/** The config tick reads GET /me for the new-install warning at most this often; a Settings visit at most every 15 s. */
const IDENTITY_TICK_MS = 10 * 60_000
const IDENTITY_VISIT_MS = 15_000
/** Not an answer: a request with no flow to send it for (the module reloaded under it). */
const NO_ANSWER = { status: 0, json: null, retryAfterMs: null }

/** A provider's name as the mod writes it (PROVIDER_NAMES). */
function providerName(p: string) {
  return PROVIDER_NAMES[p] ?? p
}

/** The providers config turns on for this player (dark or optional); none while config says nothing. */
function providersOn(cfg: ModConfig): Provider[] {
  return PROVIDERS.filter(p => signinMode(cfg.raw, p) !== 'off')
}

/** Whether the card follows a flow or is asking for one: its clock runs, and it draws whatever config says by now. */
function signInLive(s: SignIn) {
  return s.phase === 'starting' || s.phase === 'waiting' || s.phase === 'unlinked' || s.phase === 'conflict'
}

/** An answer as identity.ts reads it: api()'s, with a 409's `retry_after_ms` (signin_unavailable) as `retryAfterMs` too. */
function flowAnswer(r: { status: number; json: unknown; retryAfterMs: number | null }): FlowAnswer {
  return { status: r.status, json: r.json, retryAfterMs: r.retryAfterMs ?? (r.status === 409 ? retryAfterMs(r.json, null) : null) }
}

/** The player's time zone for a new handle, as signup sends it. */
function localZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Sign in with a provider (the contract's handler): the first-run card, Settings, a bucket's
 * checklist (W3b) or an action (W4b's runAction, `case 'signin':`). Nothing while config has the
 * provider off. A flow already open stays open, and the press only shows it. From an action or
 * a bucket it opens the pane on the Match tab, where the card draws. The start goes without a
 * token whenever this install isn't signed in or the server no longer knows its token.
 */
export async function startSignIn($: $, provider: unknown, from: SignInFrom) {
  if (typeof provider !== 'string' || !(PROVIDERS as readonly string[]).includes(provider)) return
  const cfg = await serverCfg($)
  if (signinMode((await configOf($, cfg)).raw, provider as Provider) === 'off') return
  if (from === 'action' || from === 'bucket') await openPane($, 'match')
  if (signInLive(signInCard)) return
  await update($, signinUi, () => ({ note: '', copied: false, unlinkAsk: false }))
  signInHeldAtStart = cfg.token ?? null
  switchFromToken = null
  await applySignIn($, pressSignIn(signInCard, provider, from, tokenlessStart(cfg.token, (await read($, link)).unknownToken)))
}

/**
 * One step of the machine: the card, the flow it holds, then what the step asks for. A request
 * goes out with the flow it was made for, even when the same step forgets it (the resolve a
 * Cancel or the clock sends), so the server always hears it.
 */
async function applySignIn($: $, step: SignInStep) {
  const was = signInCard
  const held = flowRef
  signInCard = step.state
  if (step.flow) flowRef = step.flow
  const ref = step.flow ?? held
  if (step.forget) flowRef = null
  if (step.state.phase === 'done' && was.phase !== 'done') signInMinted = !!step.reply
  armSignInClock($)
  await update($, signinRev, n => n + 1)
  if (step.drop) await dropFlow($, step.drop)
  if (step.revoke) await revokeMinted($, step.revoke)
  if (step.reply) await signedInWith($, step)
  // A link on this install: the Settings row reads the linked account from GET /me, and config is read again (W3b's
  // hand-off): a bucket's checklist row for the provider is met now, which moves no config version. Never awaited.
  else if (step.state.phase === 'done' && was.phase !== 'done') {
    void refreshConfig($, 'bucket').catch(() => null)
    await refreshIdentity($, 0)
  }
  if (step.send) await sendSignIn($, step.send, ref)
}

/** Runs the card's clock while it follows a flow, and stops it after. */
function armSignInClock($: $) {
  const live = signInLive(signInCard)
  if (live && !signInTimer) signInTimer = $.clock.every(1000, () => void signInTick($).catch(err => $.ui.log(`CCSR sign-in: ${(err as Error).message}`)))
  else if (!live && signInTimer) {
    signInTimer.cancel()
    signInTimer = null
  }
}

/** The card's clock, once a second: identity.ts onTick (the expiry), then a poll when one is due. */
async function signInTick($: $) {
  const t = await $.clock.now()
  const step = onTick(signInCard, t)
  if (step.state !== signInCard) await applySignIn($, step)
  signInPollsOut = signInPollsOut.filter(at => t - at < SIGNIN_POLL_GONE_MS)
  const free = signInPollsOut.length === 0 || (signInPollsOut.length < 2 && signInPollsOut.every(at => t - at >= SIGNIN_POLL_HUNG_MS))
  if (free && flowRef && pollDue(signInCard, t)) await pollSignIn($, t)
}

/**
 * One poll of the flow. Its answer goes to onPoll whatever the card shows by then: a done that
 * lands after the clock or a Cancel ended the card is the sign-in after all, and one nobody takes
 * any more comes back as a token to revoke.
 */
async function pollSignIn($: $, sentAt: number) {
  const id = flowRef ? flowIdOf(flowRef) : null
  if (!id) return
  const attempt = signInCard.attempt
  // Counted before the first await, so a tick that lands meanwhile sees it.
  signInPollsOut.push(sentAt)
  let r: Awaited<ReturnType<typeof api>>
  try {
    // The flow id is the credential: no token goes with it.
    r = await api($, 'GET', `/identities/flows/${id}`, undefined, { token: null })
  } finally {
    const i = signInPollsOut.indexOf(sentAt)
    if (i >= 0) signInPollsOut.splice(i, 1)
  }
  await applySignIn($, onPoll(signInCard, attempt, flowAnswer(r), await $.clock.now()))
}

/** The request a step asks for, and its answer back into the machine with the attempt it was sent for. A poll waits for the clock. */
async function sendSignIn($: $, send: FlowSend, ref: FlowRef | null) {
  if (send.do === 'poll') return
  if (send.do === 'start') {
    // A fresh install names itself, as signup does; with a token the server uses the install's own label.
    const r = send.tokenless ? await api($, 'POST', `/identities/${send.provider}/start`, { install: await installLabel($) }, { token: null }) : await api($, 'POST', `/identities/${send.provider}/start`, {})
    await applySignIn($, onStart(signInCard, send.attempt, flowAnswer(r), await $.clock.now()))
    return
  }
  const id = ref ? flowIdOf(ref) : null
  if (send.do === 'resolve') {
    if (send.choice === 'cancel') {
      // A cancel's answer is never read: on a flow already done it says done with no token, which
      // onResolve would draw as a switch that never reached this install.
      if (id) await api($, 'POST', `/identities/flows/${id}/resolve`, { choice: 'cancel' }, { token: null })
      return
    }
    const r = id ? await api($, 'POST', `/identities/flows/${id}/resolve`, { choice: send.choice }, { token: null }) : NO_ANSWER
    await applySignIn($, onResolve(signInCard, send.attempt, flowAnswer(r), await $.clock.now()))
    return
  }
  // join: the handle for an unlinked flow, made with the account linked, in one write (POST /accounts with identity_flow).
  const s = await read($, settings)
  const body = { handle: send.handle, identity_flow: id, grind_tracking: s.tracking, share_titles: s.share, time_zone: localZone(), salt: await saltOf($), install: await installLabel($) }
  const r = id ? await api($, 'POST', '/accounts', body, { token: null }) : NO_ANSWER
  await applySignIn($, onJoin(signInCard, send.attempt, flowAnswer(r), await $.clock.now()))
}

/** A flow the server made for a start nobody waits for any more: cancel it, answer unread. */
async function dropFlow($: $, ref: FlowRef) {
  const id = flowIdOf(ref)
  if (id) await api($, 'POST', `/identities/flows/${id}/resolve`, { choice: 'cancel' }, { token: null })
}

/** A token the server minted for an answer nobody takes: remove that install with it, unless it is the token this install holds. */
async function revokeMinted($: $, token: string) {
  if (token === (await serverCfg($)).token) return
  await removeOrKeep($, token)
}

/**
 * Removes the install a token belongs to, with that token (an install may always remove itself,
 * and one minted through GitHub is never install_too_new): GET /me/installs' `this`, then DELETE.
 * True once it's gone (or the server no longer knows the token), false to try again later.
 */
async function removeInstallWith($: $, token: string): Promise<boolean> {
  const r = await api($, 'GET', '/me/installs', undefined, { token })
  if (r.status === 401) return true
  if (r.status !== 200) return false
  const target = (r.json as { installs?: ApiInstall[] }).installs?.find(i => i.this)?.id ?? null
  if (target === null) return true
  const d = await api($, 'DELETE', `/me/installs/${target}`, undefined, { token })
  return (d.status >= 200 && d.status < 300) || d.status === 401 || d.status === 404
}

/** Removes a token's install now, or keeps the token (in the store, never an atom) for the config tick to try again. */
async function removeOrKeep($: $, token: string) {
  if (await removeInstallWith($, token)) return
  const kept = await storeGet<string[]>($, K.orphans, [])
  if (!kept.includes(token)) await save($, K.orphans, [...kept, token].slice(-5))
}

/** The config tick: tries each kept token's removal again, never the token this install holds. */
async function retryOrphans($: $) {
  const kept = await storeGet<string[]>($, K.orphans, [])
  if (kept.length === 0) return
  const mine = (await serverCfg($)).token
  const left: string[] = []
  for (const token of kept) if (token !== mine && !(await removeInstallWith($, token))) left.push(token)
  // Kept tokens another session added meanwhile stay.
  const now = await storeGet<string[]>($, K.orphans, [])
  await save($, K.orphans, now.filter(t => left.includes(t) || !kept.includes(t)))
}

/**
 * A done that brought a token: signedIn, as every way in does. A switch to another handle sends
 * no week (`carryWeek` false), and once the new token is kept removes this install's old install
 * with the old token: the server leaves it alone, so a switch whose answer was lost keeps the
 * install signed in where it was (W5a's hand-off).
 */
async function signedInWith($: $, step: SignInStep) {
  const reply = step.reply!
  const before = await serverCfg($)
  const switched = step.state.phase === 'done' && step.state.switched
  if (!switched && (before.token ?? null) !== signInHeldAtStart) {
    // Signed in another way while this flow ran (a handle, a link code, another session): that
    // sign-in stands, and the install this done made is removed with its own token.
    signInCard = { phase: 'ended', provider: step.state.phase === 'done' ? step.state.provider : 'github', from: step.state.phase === 'done' ? step.state.from : 'settings', attempt: step.state.attempt, why: 'closed', message: null, retryAt: null }
    await update($, signinRev, n => n + 1)
    if (reply.token !== before.token) await removeOrKeep($, reply.token)
    return
  }
  // A switch removes only the install whose token was held when Switch was pressed, and only while it still is.
  const from = switched && switchFromToken !== null && before.token === switchFromToken ? switchFromToken : null
  if (switched) {
    switchFromToken = null
    // Scored for the old handle: sent with its token now, and whatever still can't go stays in the
    // ledger, never sent under the other handle.
    // Only while the store still holds the old handle's token: another session's sign-in meanwhile sends nothing here.
    if (from) {
      await flushOutbox($)
      await save($, K.outbox, [])
    }
    // Another handle's install from here: nothing of the old handle's shows until GET /me and the boards read again.
    await update($, link, l => ({ ...l, account: null, installs: null, recent: null, myRank: null, grind: null, grindRank: null }))
    if ((await rankedShared($)).phase === 'done') await clearRanked($)
  }
  await signedIn($, reply as unknown as SignInReply, null, step.carryWeek !== false)
  if (from && from !== reply.token) await removeOrKeep($, from)
}

/**
 * GET /me for the sign-in rows (the linked account) and the new-install warning, while sign-in is
 * on for this player: after a link, on a Settings visit (at most every 15 s) and from the config
 * tick (at most every 10 minutes). Older reads are fine: GET /me allows 2 a second per player.
 */
async function refreshIdentity($: $, minAgeMs: number) {
  const cfg = await serverCfg($)
  if (!cfg.token || providersOn(await configOf($, cfg)).length === 0) return
  const t = await $.clock.now()
  if (t - identityReadAt < minAgeMs) return
  identityReadAt = t
  const r = await api($, 'GET', '/me')
  // Signed in or out while it was asked: that answer is another install's.
  if (r.status !== 200 || (await serverCfg($)).token !== cfg.token) return
  const j = r.json as { player: ApiPlayer; account?: ApiAccount }
  await update($, link, l => ({ ...l, me: j.player, account: j.account ?? l.account }))
  await warnNewInstalls($, j.account ?? null)
}

/**
 * The account's other installs that signed in with a provider in the last day: a toast once each
 * (every session on this machine shares the list), behind the toasts switch (Match only keeps
 * it), and a line in Settings while GET /me lists the install.
 */
async function warnNewInstalls($: $, account: unknown) {
  const fresh = providersOn(await configOf($)).flatMap(p => newInstallsVia(account, p).map(x => ({ ...x, name: providerName(p) })))
  if (fresh.length === 0) return
  const seen = await storeGet<string[]>($, K.newInstalls, [])
  const unseen = fresh.filter(x => !seen.includes(x.key))
  if (unseen.length === 0) return
  await save($, K.newInstalls, [...seen, ...unseen.map(x => x.key)].slice(-50))
  for (const x of unseen) await ambient($, IDENTITY.newInstall(x.name, x.label || IDENTITY.unnamed), 'match', 10_000)
}

/** Cancel on the card: over here at once, and the server hears it while a flow is held. */
async function cancelSignInCard($: $) {
  await applySignIn($, cancelSignIn(signInCard))
}

/** Done or Close on the card. */
async function dismissSignInCard($: $) {
  await update($, signinUi, u => ({ ...u, copied: false }))
  await applySignIn($, dismissSignIn(signInCard))
}

/** Start again on an ended card, from where the first one started. */
async function againSignIn($: $) {
  const s = signInCard
  if (s.phase === 'ended') await startSignIn($, s.provider, s.from)
}

/** A handle typed on the unlinked card. */
async function joinSignIn($: $, raw: string) {
  await applySignIn($, joinFlow(signInCard, raw))
}

/**
 * Sign in to the other handle (a github_taken conflict). The outbox goes first, and the switch is
 * refused while anything is left in it: what this handle scored stays this handle's. Queued for
 * this handle, it leaves the queue; in a match the server refuses the switch (in_match).
 */
async function switchSignIn($: $) {
  if (signInCard.phase !== 'conflict' || signInCard.busy || !conflictChoices(signInCard).includes('switch')) return
  await flushOutbox($)
  const left = (await storeGet<OutboxItem[]>($, K.outbox, [])).length
  if (left === 0 && (await rankedShared($)).phase === 'queued') await leaveQueue($)
  if (left === 0) switchFromToken = (await serverCfg($)).token ?? null
  await applySignIn($, choose(signInCard, 'switch', left))
}

/** Copy code: the code to the clipboard (never anywhere Claude reads). */
async function copySignInCode($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  if (signInCard.phase !== 'waiting') return
  const c = await $.ui.copy({ text: signInCard.code, surface }).catch(() => ({ isCopied: false }))
  await update($, signinUi, u => ({ ...u, copied: c.isCopied }))
}

/** Unlink in Settings: the first press asks, the second unlinks (DELETE /me/identities/:provider). */
async function unlinkProvider($: $, provider: Provider) {
  const ui = await read($, signinUi)
  if (!ui.unlinkAsk) {
    await update($, signinUi, u => ({ ...u, note: '', unlinkAsk: true }))
    return
  }
  const r = await api($, 'DELETE', `/me/identities/${provider}`)
  if (r.status === 200) {
    const identities = (r.json as { identities?: ApiAccount['identities'] }).identities ?? []
    await update($, link, l => (l.account ? { ...l, account: { ...l.account, identities } } : l))
    // W3b's hand-off: a bucket's checklist row for the provider is unmet again, which moves no config version. Never awaited.
    void refreshConfig($, 'bucket').catch(() => null)
  }
  await update($, signinUi, u => ({ ...u, unlinkAsk: false, note: r.status === 200 ? IDENTITY.unlinked(providerName(provider)) : signInProblem(r) }))
}

/** Why an unlinked or conflict card still stands after a press, as its line. */
function signInNote(s: SignIn) {
  if (s.phase !== 'unlinked' && s.phase !== 'conflict') return null
  switch (s.note) {
    case 'outbox':
      return IDENTITY.outbox
    case 'in_match':
      return s.message ?? IDENTITY.inMatch
    case 'handle_taken':
      return s.message ?? IDENTITY.handleTaken
    case 'bad_handle':
      return IDENTITY.badHandle
    case 'offline':
      return IDENTITY.offline
    case 'refused':
      return s.message ?? IDENTITY.refused
    default:
      return null
  }
}

/** An ended card's line: the server's words when it sent some (one clean line, as Text), else the mod's for why. */
function signInEnded(why: EndWhy, message: string | null, name: string) {
  return message ?? IDENTITY.ended[why](name)
}

/**
 * The sign-in card, at rest null. `match` draws one not started from Settings (the Match tab once
 * signed in), `any` every one (the first-run card, Settings). A card that ended draws only while
 * config still has its provider on; one following a flow draws regardless, so it can finish.
 * Every server string is Text, never Markdown; the Link is the provider's page, checked with
 * safeLink against its hosts.
 */
async function signInCardView($: $, e: RenderInput<'Pane'>, els: El, a: Actions, where: 'match' | 'any'): Promise<RenderElement | null> {
  await read($, signinRev)
  const s = signInCard
  if (s.phase === 'idle' || (where === 'match' && s.from === 'settings')) return null
  if (!signInLive(s) && signinMode((await configOf($)).raw, s.provider) === 'off') return null
  const { Box, Text, Button, Link, Input } = els
  const ui = await read($, signinUi)
  const name = providerName(s.provider)
  const note = signInNote(s)
  const cancel = <Button key="signin-cancel" label={IDENTITY.cancel} onPress={() => a.cancelSignIn()} />
  const rows: (RenderElement | null | false | '')[] = []
  if (s.phase === 'starting') rows.push(<Text dimColor>{IDENTITY.starting(name)}</Text>, <Box gap={1}>{cancel}</Box>)
  else if (s.phase === 'waiting') {
    const url = s.url !== null && safeLink(s.url, PROVIDER_HOSTS[s.provider]) ? s.url : null
    rows.push(
      <Text bold color={ORANGE}>
        {s.code}
      </Text>,
      <Text wrap="wrap">{url ? IDENTITY.enterCode(name) : IDENTITY.noLink(name)}</Text>,
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Button key="signin-copy" label={IDENTITY.copyCode} variant="primary" onPress={x => a.copySignInCode(x.surface)} />
        {url && <Link key="signin-page" href={url} label={IDENTITY.openPage(name)} />}
        {cancel}
      </Box>,
      ui.copied && <Text dimColor>{IDENTITY.copied}</Text>,
      <Text dimColor wrap="wrap">
        {(signupsOf((await configOf($)).raw).email ? IDENTITY.privacyEmail : IDENTITY.privacy)(name)}
      </Text>,
    )
  } else if (s.phase === 'unlinked') {
    rows.push(
      <Text wrap="wrap">{s.login ? IDENTITY.pickHandle(name, s.login) : IDENTITY.pickHandleNoLogin(name)}</Text>,
      s.busy ? (
        <Text dimColor>{IDENTITY.busy}</Text>
      ) : e.surface === 'mobile' ? (
        <Text dimColor wrap="wrap">
          {IDENTITY.typeElsewhere}
        </Text>
      ) : (
        <Input key="signin-handle" label="Handle" placeholder="2 to 20 of a-z, 0-9 and _" submitLabel="Join" onSubmit={v => a.joinSignIn(v)} />
      ),
      note && (
        <Text color={ORANGE} wrap="wrap">
          {note}
        </Text>
      ),
      !s.busy && <Box gap={1}>{cancel}</Box>,
    )
  } else if (s.phase === 'conflict') {
    const canSwitch = conflictChoices(s).includes('switch') && s.handle !== null
    const cfg = await serverCfg($)
    const line =
      s.conflict === 'github_taken'
        ? s.handle
          ? s.login
            ? IDENTITY.taken(name, s.login, s.handle)
            : IDENTITY.takenNoLogin(name, s.handle)
          : IDENTITY.takenElsewhere(name)
        : s.conflict === 'handle_linked'
          ? IDENTITY.handleLinked(name)
          : IDENTITY.cantLink(name)
    rows.push(
      <Text wrap="wrap">{line}</Text>,
      canSwitch && cfg.handle && (
        <Text dimColor wrap="wrap">
          {IDENTITY.switchWarn(cfg.handle)}
        </Text>
      ),
      s.busy && <Text dimColor>{IDENTITY.busy}</Text>,
      note && (
        <Text color={ORANGE} wrap="wrap">
          {note}
        </Text>
      ),
      !s.busy && (
        <Box gap={1} flexWrap="wrap">
          {canSwitch && <Button key="signin-switch" label={IDENTITY.switchTo(s.handle as string)} variant="primary" onPress={() => a.switchSignIn()} />}
          {canSwitch && cfg.recoveryKey && <Button key="signin-recovery-copy" label={ACCOUNT.copyKey} onPress={x => a.copyRecoveryKey(x.surface)} />}
          {cancel}
        </Box>
      ),
    )
  } else if (s.phase === 'done') {
    const line = signInMinted
      ? s.handle && s.login
        ? IDENTITY.signedInAs(s.handle, name, s.login)
        : s.handle
          ? IDENTITY.signedInAsNoLogin(s.handle, name)
          : IDENTITY.linkedNoLogin(name)
      : s.login
        ? IDENTITY.linked(name, s.login)
        : IDENTITY.linkedNoLogin(name)
    rows.push(
      <Text color={ORANGE} wrap="wrap">
        {line}
      </Text>,
      <Box gap={1}>
        <Button key="signin-dismiss" label={IDENTITY.done} onPress={() => a.dismissSignIn()} />
      </Box>,
    )
  } else {
    const again = signinMode((await configOf($)).raw, s.provider) !== 'off'
    rows.push(
      <Text wrap="wrap">{signInEnded(s.why, s.message, name)}</Text>,
      <Box gap={1}>
        {again && <Button key="signin-again" label={IDENTITY.startAgain} onPress={() => a.againSignIn()} />}
        <Button key="signin-dismiss" label={IDENTITY.close} onPress={() => a.dismissSignIn()} />
      </Box>,
    )
  }
  return (
    <Box key="signin-card" flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      <Text bold color={STONE}>
        {IDENTITY.signIn(name).toUpperCase()}
      </Text>
      {rows.filter(Boolean)}
    </Box>
  )
}

/**
 * Sign in with a provider beside the handle box (the first-run card, Settings signed out): a
 * button for each provider config turns on, or the card while one shows. On every surface: mobile
 * has no handle box, but it has buttons.
 */
async function signInEntry($: $, e: RenderInput<'Pane'>, els: El, a: Actions, from: SignInFrom): Promise<RenderElement | null> {
  const card = await signInCardView($, e, els, a, 'any')
  if (card) return card
  const on = providersOn(await configOf($))
  if (on.length === 0) return null
  const { Box, Button } = els
  return (
    <Box gap={1} flexWrap="wrap">
      {on.map(p => (
        <Button key={`signin-${p}`} label={IDENTITY.signIn(providerName(p))} onPress={() => a.startSignIn(p, from)} />
      ))}
    </Box>
  )
}

/** The Match tab, signed in: a card started there (the first-run card, an action, a bucket) until it's closed. The first-run card draws its own. */
async function signInMatchCard($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement | null> {
  const cfg = await serverCfg($)
  if (!cfg.token || (await read($, link)).unknownToken) return null
  return signInCardView($, e, els, a, 'match')
}

/**
 * Settings, under the account: signed out, the entry; signed in, each provider config turns on,
 * linked (Unlink, two presses) or not (Link), the installs that signed in with it in the last
 * day, and the card. No provider link here at rest: the card's is the only one.
 */
async function signInSettings($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement | null> {
  const cfg = await serverCfg($)
  const l = await read($, link)
  if (!cfg.token || l.unknownToken) return signInEntry($, e, els, a, 'settings')
  const card = await signInCardView($, e, els, a, 'any')
  const on = l.me ? providersOn(await configOf($, cfg)) : []
  if (on.length === 0) return card
  const { Box, Text, Button } = els
  const ui = await read($, signinUi)
  return (
    <Box flexDirection="column" gap={1}>
      {on.map(p => {
        const name = providerName(p)
        const linked = linkedLogin(l.account, p)
        return (
          <Box key={`identity-${p}`} flexDirection="column">
            <Text bold color={STONE}>
              {name.toUpperCase()}
            </Text>
            <Text dimColor wrap="wrap">
              {linked ? (linked.login ? IDENTITY.linked(name, linked.login) : IDENTITY.linkedNoLogin(name)) : IDENTITY.notLinked(name)}
            </Text>
            {newInstallsVia(l.account, p).map(x => (
              <Text key={`new-install-${x.key}`} color={ORANGE} wrap="wrap">
                {IDENTITY.newInstall(name, x.label || IDENTITY.unnamed)}
              </Text>
            ))}
            {linked ? (
              <Box gap={1}>
                <Button key={`unlink-${p}`} label={IDENTITY.unlink(name)} variant={ui.unlinkAsk ? 'primary' : 'secondary'} onPress={() => a.unlinkProvider(p)} />
              </Box>
            ) : (
              !signInLive(signInCard) && (
                <Box gap={1}>
                  <Button key={`link-${p}`} label={IDENTITY.link(name)} onPress={() => a.startSignIn(p, 'settings')} />
                </Box>
              )
            )}
            {ui.unlinkAsk && linked && (
              <Text color={ORANGE} wrap="wrap">
                {IDENTITY.unlinkWarn(name)}
              </Text>
            )}
            {ui.note && (
              <Text dimColor wrap="wrap">
                {ui.note}
              </Text>
            )}
          </Box>
        )
      })}
      {card}
    </Box>
  )
}

/**
 * Points the mod at another server address. The account for the old address
 * is kept under `saved`; the new address gets its own saved account, or, when
 * the current token works there too (the same server under a new name, like
 * Railway's address moving to api.ccsr.gg), keeps the current one.
 */
async function setServerUrl($: $, url: string) {
  const u = url.trim().replace(/\/+$/, '')
  if (!/^https?:\/\/[^\s]+$/.test(u)) return
  const cfg = await serverCfg($)
  if (u === cfg.url) return
  const saved: Record<string, SavedAccount> = { ...(cfg.saved ?? {}) }
  if (cfg.token) saved[cfg.url] = { token: cfg.token, handle: cfg.handle, recoveryKey: cfg.recoveryKey ?? null }
  let next: SavedAccount | null = saved[u] ?? null
  if (!next && cfg.token && (await api($, 'GET', '/me', undefined, { url: u })).status === 200) next = saved[cfg.url]!
  delete saved[u]
  await save($, K.server, { url: u, token: next?.token ?? null, handle: next?.handle ?? null, recoveryKey: next?.recoveryKey ?? null, saved })
  await update($, link, () => ({ ...LINK0 }))
  void refreshConfig($, 'server').catch(() => null)
  await refreshAccount($)
}

/**
 * Puts scored commits in the outbox, once each, while there's an account to send them for.
 * `coders` (W7-2): each commit's coder block by pid, built by the scan while eval capture was
 * on; it goes into the body here and nowhere else.
 */
async function enqueue($: $, rows: ScoredCommit[], coders?: Map<string, ApiCoder>) {
  const cfg = await serverCfg($)
  if (!cfg.token || rows.length === 0) return
  const s = await read($, settings)
  const salt = await saltOf($)
  const sent = new Set(await storeGet<string[]>($, K.sent, []))
  const t = await $.clock.now()
  const fresh: OutboxItem[] = []
  for (const c of rows) if (!sent.has(c.pid)) fresh.push({ pid: c.pid, body: await scoreBody(c, salt, s.share, coders?.get(c.pid)), tries: 0, nextAt: t })
  if (fresh.length === 0) return
  const box = await storeGet<OutboxItem[]>($, K.outbox, [])
  const have = new Set(box.map(b => b.pid))
  const next = [...box, ...fresh.filter(f => !have.has(f.pid))]
  await save($, K.outbox, next)
  await update($, link, l => ({ ...l, outbox: next.length }))
}

/**
 * Sends what's due in the outbox. Single-flight per session: a call made while
 * a flush runs gets another one after it, since that flush may have read the
 * outbox before this caller's scores went in. Other sessions sending the same
 * score just get a duplicate.
 */
function flushOutbox($: $): Promise<void> {
  if (flushing) return flushing.then(() => flushOutbox($))
  flushing = flushOnce($).finally(() => (flushing = null))
  return flushing
}

async function flushOnce($: $) {
  const t = await $.clock.now()
  const due = (await storeGet<OutboxItem[]>($, K.outbox, [])).filter(b => b.nextAt <= t).slice(0, 25)
  const done = new Set<string>()
  const retry = new Map<string, OutboxItem>()
  const refused: string[] = []
  let reply: ApiScoreReply | null = null
  for (const item of due) {
    // A coder block goes only while capture is on (W7-2); once this session knows it's off, the score goes without it.
    const r = await api($, 'POST', '/scores', captureKnown && !capturing ? withoutCoder(item.body) : item.body)
    if (r.status >= 200 && r.status < 300) {
      done.add(item.pid)
      reply = r.json as ApiScoreReply
      continue
    }
    if (retryable(r.status)) {
      retry.set(item.pid, { ...item, tries: item.tries + 1, nextAt: t + backoffMs(item.tries), lastError: errorOf(r.json)?.code ?? String(r.status) })
      if (r.status === 0) break // offline: the rest wait too
      continue
    }
    // The server refused this score for good (wrong judge, too old, malformed): it stays in the local Grind only.
    done.add(item.pid)
    refused.push(`${errorOf(r.json)?.code ?? r.status} on ${item.body.authored_at.slice(0, 10)}`)
  }
  // Re-read before writing: another session may have added to the outbox meanwhile.
  // A retry takes only its count and times: the body stays the re-read one, so a coder block
  // taken off meanwhile (Model stats off, W7-2) never comes back.
  const box = (await storeGet<OutboxItem[]>($, K.outbox, [])).filter(b => !done.has(b.pid)).map(b => {
    const r = retry.get(b.pid)
    return r ? { ...b, tries: r.tries, nextAt: r.nextAt, lastError: r.lastError } : b
  })
  await save($, K.outbox, box)
  if (done.size) {
    const sent = await storeGet<string[]>($, K.sent, [])
    await save($, K.sent, [...sent.filter(p => !done.has(p)), ...done].slice(-3000))
  }
  await update($, link, l => ({
    ...l,
    outbox: box.length,
    grind: reply ? reply.grind : l.grind,
    grindRank: reply ? reply.grind_week_rank : l.grindRank,
    note: refused.length ? `The server refused ${refused.length} score${refused.length === 1 ? '' : 's'} (${refused.slice(0, 2).join(', ')}); they count here only.` : l.note,
  }))
}

// ------------------------------------------------------------------ eval capture (W7-2)
// Which model, effort, agent and client made each scored commit, and the tokens it took,
// from call records this machine keeps (docs/api.md, "The coder block"). turn.step notes each
// model call in module memory; classic.PostToolUse adds a record for a Bash call that made a
// commit (Claude Code's own gitOperation sha) and writes them all to this session's slot file
// under ~/.ccsr/calls; session.end, every scan and slowSync write what's waiting. The scan
// reads every slot and builds each new score's block with coder.ts, and the block rides the
// outbox with its score (notify, onScore, enqueue, adoptSalt), never the ledger, an atom or
// the store's ledger keys. All of it only while config's eval_capture is on for this player
// and their Model stats (held on the server, GET /me) is not off: otherwise nothing is
// noted, nothing is written under ~/.ccsr/calls and no block is sent. A record holds a time,
// the model, effort, agent, client and version, four token counts, the commit shas a Bash
// call made and a key for the session's repo (a hash of its path): never a session id, a
// path, a command, a tool_use id or a repo name.

/** Model stats as the server last said it, for this server and handle. */
async function holdModelStats($: $, isOn: boolean) {
  const key = keyOf(await serverCfg($))
  const held = await storeGet<{ key: string; on: boolean } | null>($, K.modelStats, null)
  if (held?.key !== key || held.on !== isOn) await save($, K.modelStats, { key, on: isOn })
  if (!isOn) await dropCoders($)
}

/** This account's Model stats, or null when the server never said (on, by default). */
async function modelStatsOf($: $, server?: Pick<ServerConfig, 'url' | 'handle'>): Promise<boolean | null> {
  const held = await storeGet<{ key: string; on: boolean } | null>($, K.modelStats, null)
  return held && held.key === keyOf(server ?? (await serverCfg($))) && typeof held.on === 'boolean' ? held.on : null
}

/** Model stats off: the blocks still waiting in the outbox go too. */
async function dropCoders($: $) {
  const box = await storeGet<OutboxItem[]>($, K.outbox, [])
  if (!box.some(b => b.body.coder)) return
  await save($, K.outbox, box.map(b => (b.body.coder ? { ...b, body: withoutCoder(b.body) } : b)))
}

/** The Model stats switch in Settings: PATCH /me, then capture follows what the server answered. */
async function setModelStats($: $, isOn: boolean) {
  const r = await api($, 'PATCH', '/me', { model_stats: isOn })
  if (r.status !== 200) return update($, link, l => ({ ...l, note: signInProblem(r) }))
  const got = (r.json as { settings?: { model_stats?: unknown } } | null)?.settings?.model_stats
  await holdModelStats($, typeof got === 'boolean' ? got : isOn)
  await syncCapture($)
  await update($, link, l => ({ ...l, note: '' }))
}

/** Capture on or off, from the config held for this account and Model stats; run on every config tick and /me read. */
async function syncCapture($: $) {
  const cfg = await serverCfg($)
  const held = await read($, config)
  const known = held.readAt > 0 && held.key === keyOf(cfg)
  const stats = await modelStatsOf($, cfg)
  const on = !!cfg.token && known && captureOn(held.raw) && stats !== false
  captureKnown = known || stats === false
  // Usage weeks: Model stats off takes the weeks read and not sent yet with it (the player's own switch; a flag going off only makes them wait).
  if (stats === false) await dropHeldUsage($).catch(() => undefined)
  // W7-3: the transcript fallback rides capture, and follows config's eval_backfill on every read.
  backfilling = on && backfillOn(held.raw)
  if (on === capturing) {
    if (!on && captureKnown && !callsForgotten) await forgetCalls($)
    return
  }
  capturing = on
  if (!on) {
    stepsPending.length = 0
    callsMine.length = 0
    lastStep.clear()
    if (captureKnown) await forgetCalls($)
    return
  }
  callsForgotten = false
  await startCapture($)
}

/**
 * Capture is off for this player: this machine's records go too, and since.json is unset, so
 * capture that comes back starts its records afresh and never reads a window across the gap.
 * `$.fs` has no delete, so each file that holds something is written empty. A machine that
 * never captured has nothing to clear and gets no write.
 */
async function forgetCalls($: $) {
  callsForgotten = true
  const dir = await callsDir($)
  if (!dir) return
  try {
    if (readSince(String(await $.fs.read(`${dir}/since.json`))) !== null) await $.fs.write(`${dir}/since.json`, JSON.stringify({ v: 1, since: null }))
  } catch {
    // Missing: capture never began here.
  }
  for (let i = 0; i < CALL_SLOTS; i++) {
    try {
      if (readSlot(String(await $.fs.read(`${dir}/${i}.json`))).length > 0) await $.fs.write(`${dir}/${i}.json`, slotText([], [], 0))
    } catch {
      // A slot no session wrote.
    }
  }
}

/** Capture just turned on: what this session stamps on its records, and since.json when this machine has none. */
async function startCapture($: $) {
  callSlot = slotOf(owner)
  let entry: string | undefined
  try {
    entry = await $.env.get('CLAUDE_CODE_ENTRYPOINT')
  } catch {
    entry = undefined
  }
  // Claude Code reads an unset entrypoint as cli; so does the record.
  callSession = { ...callSession, client: clientOf(entry || 'cli'), clientVersion: versionOf(await claudeVersion($)) }
  await refreshCallRepo($)
  const dir = await callsDir($)
  if (!dir) return
  try {
    if (readSince(String(await $.fs.read(`${dir}/since.json`))) !== null) return
  } catch {
    // Missing: capture starts on this machine now.
  }
  try {
    await $.fs.write(`${dir}/since.json`, sinceText(await $.clock.now()))
  } catch {
    // No fs here, or the home directory isn't writable: no records, so no blocks.
  }
}

/** ~/.ccsr/calls, beside the keyring; null where there's no home directory. */
async function callsDir($: $) {
  const path = await keyringPath($)
  return path ? path.replace(/\/keyring\.json$/, '/calls') : null
}

/** A repo's key in the records: a hash of its main working tree's path, so a scan in any config dir finds the same one. */
async function repoKey(root: string) {
  return (await sha256hex(`ccsr-calls|${root}`)).slice(0, 16)
}

/** The session's repo key, worked out again only when the session's root moves (a /cd). */
async function refreshCallRepo($: $) {
  try {
    const at = await $.session.root()
    if (at === callRoot) return
    callRoot = at
    const root = await repoRoot($, at)
    callSession = { ...callSession, repo: root ? await repoKey(root) : null }
  } catch {
    // No root or no git here: the records carry no repo, and count for any.
  }
}

/** turn.step's one job, with no `$` call and nothing awaited: note the model call for the records. */
function noteStep(e: unknown, r: unknown) {
  try {
    const wall = Date.now()
    const step = e as { model?: unknown; effort?: unknown; agentId?: unknown }
    const call = stepCall(step, r as { stopReason?: unknown; usage?: unknown }, wall)
    lastStep.set(typeof step.agentId === 'string' ? step.agentId : '', { model: call.model, effort: call.effort })
    stepsPending.push({ wall, call })
    if (stepsPending.length > PENDING_MAX) stepsPending.splice(0, stepsPending.length - PENDING_MAX)
  } catch {
    // Never a reason for the model's response to fail.
  }
}

/** A Bash call finished: when it made a commit, note its record (no `$` call); true when there's one to write. */
function noteBash(e: { tool_response?: unknown; agent_id?: unknown; effort?: unknown }) {
  try {
    const wall = Date.now()
    const call = bashCall(e, lastStep.get(typeof e.agent_id === 'string' ? e.agent_id : ''), wall)
    if (!call) return false
    stepsPending.push({ wall, call })
    return true
  } catch {
    return false
  }
}

/** Writes what's waiting (and `extra`) to this session's slot. One write at a time per session. */
function writeCalls($: $, extra: Call[] = []): Promise<void> {
  const before = callWrite
  const job = (async () => {
    if (before) await before
    await writeCallsOnce($, extra)
  })().catch(err => $.ui.log(`CCSR calls: ${clean((err as Error).message)}`))
  callWrite = job
  void job.then(() => {
    if (callWrite === job) callWrite = null
  })
  return job
}

async function writeCallsOnce($: $, extra: Call[]) {
  if (!capturing) {
    stepsPending.length = 0
    return
  }
  const dir = await callsDir($)
  if (!dir) return
  await refreshCallRepo($)
  const t = await $.clock.now()
  // The steps were noted on the wall clock; each keeps how long ago it answered, on $.clock.
  const wall = Date.now()
  const fresh = [...stepsPending.splice(0).map(x => ({ ...x.call, at: t - Math.max(0, wall - x.wall) })), ...extra].map(c => stamped(c, callSession))
  if (fresh.length === 0 && callsMine.length === 0) return
  // This session's recent records go in again with the fresh ones (a slot keeps each once).
  const keep = t - CALL_KEEP_MS
  const mine = [...callsMine.filter(c => c.at >= keep), ...fresh].slice(-CALL_SLOT_MAX)
  const path = `${dir}/${callSlot}.json`
  try {
    // Another session whose id picks the same slot may write between our read and write: read back, and merge once more if it did.
    for (let i = 0; i < 2; i++) {
      let held: Call[] = []
      let text: string | null = null
      try {
        text = String(await $.fs.read(path))
      } catch {
        // Missing is empty; there but unreadable is left alone, and the records wait for the next write.
        if (await $.fs.exists(path).catch(() => true)) throw new Error('slot unreadable')
      }
      if (text !== null) {
        held = readSlot(text)
        if (held.length === 0 && !slotEmpty(text)) {
          if (!slotTorn) {
            slotTorn = true
            throw new Error('slot torn')
          }
        }
      }
      slotTorn = false
      // Capture went off while this write waited: forgetCalls has cleared the slots, and nothing goes back.
      if (!capturing) return
      await $.fs.write(path, slotText(held, mine, t))
      if (slotHolds(String(await $.fs.read(path).catch(() => '')), mine)) break
    }
    if (capturing) callsMine.splice(0, callsMine.length, ...mine)
  } catch (err) {
    // Nothing is lost: what wasn't written waits in memory for the next write.
    if (capturing) callsMine.splice(0, callsMine.length, ...mine)
    if ((err as Error).message !== 'slot torn') throw err
  }
}

/** A slot file's text that holds no records on purpose (an empty list), as against one that doesn't parse. */
function slotEmpty(text: string) {
  try {
    const raw = JSON.parse(text) as { v?: unknown; calls?: unknown }
    return raw?.v === 1 && Array.isArray(raw.calls)
  } catch {
    return false
  }
}

/** Every session's records on this machine and when capture began, after this session's own are written; null without since.json. */
async function callsForScan($: $): Promise<{ calls: Call[]; since: number } | null> {
  await writeCalls($)
  const dir = await callsDir($)
  if (!dir) return null
  let since: number | null = null
  try {
    since = readSince(String(await $.fs.read(`${dir}/since.json`)))
  } catch {
    since = null
  }
  if (since === null) {
    // Capture is on here but since.json is unset (another session's off spell cleared it): it begins again now, and this scan has no blocks.
    if (capturing) await $.fs.write(`${dir}/since.json`, sinceText(await $.clock.now())).catch(() => undefined)
    return null
  }
  const calls: Call[] = []
  for (let i = 0; i < CALL_SLOTS; i++) {
    try {
      calls.push(...readSlot(String(await $.fs.read(`${dir}/${i}.json`))))
    } catch {
      // A slot no session has written yet.
    }
  }
  return { calls, since: blockSince(since, await $.clock.now()) }
}

/**
 * The coder block of each listed commit in one repo, by sha: windows between its commits by
 * committer time. Only a commit this machine made (its reflog says commit or revert) can take
 * a window's vote; any other (a GitHub merge, a cloud session's, another machine's pulled in)
 * gets a block only from a sha record. A call with no repo key votes but its tokens aren't
 * counted here: each repo's scan runs on its own, and two would both count them.
 * `source`: live for the call records, transcript for the fallback's calls (W7-3); `local`,
 * the repo's reflog commits when the caller has read them already.
 */
async function scanBlocks($: $, root: string, listed: RawCommit[], evalCalls: { calls: Call[]; since: number }, source: 'live' | 'transcript' = 'live', local?: Set<string>) {
  const commits = scanCommits(listed, await repoKey(root))
  return coderBlocks(commits, evalCalls.calls, { since: evalCalls.since, source, local: local ?? (await madeHere($, root)), bareTokens: false })
}

/** A repo's listed commits as the attribution takes them: sha, committer time, the repo's key. */
function scanCommits(listed: RawCommit[], repo: string) {
  return listed.flatMap(c => (typeof c.ct === 'number' && Number.isFinite(c.ct) ? [{ sha: c.sha, ct: c.ct, repo }] : []))
}

/** The commits this machine made in a repo, from every ref's reflog: an empty set when git can't say. */
async function madeHere($: $, root: string): Promise<Set<string>> {
  const out = new Set<string>()
  try {
    const r = await git($, root, ['reflog', 'show', '--all', '-n', '20000', `--format=%H${SEP}%gs`], 30_000)
    if (r.exitCode !== 0) return out
    for (const line of r.stdout.split('\n')) {
      const [sha = '', subject = ''] = line.split(SEP)
      if (/^(commit|revert)\b/.test(subject) && /^[0-9a-f]{40}$/.test(sha)) out.add(sha)
    }
  } catch {
    // No git here: nothing counts as made here, and only sha records speak.
  }
  return out
}

// ------------------------------------------------------------------ usage weeks (usage.ts)
// Dark: only while capture is on here (signed in, config's eval_capture, Model stats not off)
// and config's eval_weeks is. Once per install, then once a week: `sh` adds up Claude Code's
// own transcripts under this config dir by week, counted from the anchor the server holds for
// the account (its first install): for the four weeks before the anchor and each week since,
// the days the transcripts cover, the days with a call and four token counts. Nothing else is
// read from a transcript, and nothing the script prints but those sums reaches the mod. The
// baseline is read at install, while the transcripts still reach back, and its totals wait in
// the store: nothing is posted to POST /usage until GET /me says the account has a match
// played (the setup pane and Settings say what will go, and Model stats turns it off). One
// session per machine runs it at a time (the store's `usage`), a failure waits six hours, and
// a machine with no `sh` never sends a row. Never awaited by a tick: the script may run for
// minutes, and the post is a request.

/** Claude Code's cleanupPeriodDays for this config dir (its settings.json beside the transcripts folder), 30 when it doesn't say. */
async function transcriptRetention($: $, projects: string) {
  const text = await $.fs.read(`${projects.replace(/[\\/]projects$/, '')}/settings.json`).catch(() => null)
  return retentionDays(typeof text === 'string' ? text : null)
}

/** Whether usage weeks may still run and send for `key`: capture on in this session, Model stats not off in the store (another session, or another install's word, may have turned it off), config's eval_weeks on, and the same account signed in. Read again before every step that keeps or sends anything. */
async function usageStillOn($: $, key: string) {
  return capturing && (await modelStatsOf($)) !== false && usageOn((await read($, config)).raw) && keyOf(await serverCfg($)) === key
}

/**
 * A reason to look, never leave to send: this session's own copy of GET /me says the account
 * signed in here has a match played. The copy must be that account's own (another session may
 * have signed this config dir into a different one since), and the post asks the server again.
 */
async function usagePlayed($: $, server: Pick<ServerConfig, 'handle'>) {
  const me = (await read($, link)).me
  return !!me && !!server.handle && me.handle === server.handle && (me.matches_played ?? 0) >= 1
}

/**
 * The last word before a post: GET /me, asked now, for the account the held weeks belong to.
 * `as` pins the request to the server and token the pass began with (api() would otherwise read
 * the store again as it sends, and a sign-out, a Join or a server switch in another session
 * changes it). The weeks go only when that token is still the one signed in, the account has a
 * match played, and Model stats isn't off, here or on another install. Its answer is this
 * session's copy from then on, and Model stats off there stops capture and drops the held
 * weeks (syncCapture).
 */
async function usageMayPost($: $, key: string, as: { url: string; token: string; keepNote: true }) {
  if (!(await usageStillOn($, key))) return false
  const r = await api($, 'GET', '/me', undefined, as)
  if (r.status !== 200) throw new Error(`GET /me answered ${r.status}`)
  const signed = await serverCfg($)
  if (signed.token !== as.token || signed.url !== as.url || keyOf(signed) !== key) return false
  const j = r.json as { player?: ApiPlayer; settings?: { model_stats?: unknown } } | null
  if (j?.player && typeof j.player === 'object') await update($, link, l => ({ ...l, me: j.player as ApiPlayer }))
  const stats = j?.settings?.model_stats
  if (typeof stats === 'boolean') {
    await holdModelStats($, stats)
    await syncCapture($)
  }
  return stats !== false && (j?.player?.matches_played ?? 0) >= 1 && (await usageStillOn($, key))
}

/** Model stats went off: the weeks read and not sent yet go too. Nothing else changes, so nothing is read twice if it comes back. */
async function dropHeldUsage($: $) {
  const raw = await storeGet<unknown>($, K.usage, null)
  const held = (raw as { held?: unknown } | null)?.held
  if (Array.isArray(held) && held.length > 0) await save($, K.usage, { ...(raw as object), held: [], again: null })
}

/**
 * Changes the store's `usage` as it is now, never as a pass read it minutes ago: Model stats
 * off may have dropped the held weeks meanwhile, and a pass must not write them back. Once
 * another account is signed in here the store is no longer this pass's to write.
 */
async function usagePut($: $, key: string, change: (now: UsageState) => UsageState): Promise<UsageState> {
  const now = usageState(await storeGet<unknown>($, K.usage, null), key)
  if (keyOf(await serverCfg($)) !== key) return now
  const next = change(now)
  await save($, K.usage, next)
  return next
}

/**
 * One pass: nothing unless there is something to do. The anchor is asked for once. Then the
 * script runs over the weeks not read yet, and their totals join the held weeks. Then, only
 * once the server says the account has a finished match, the held weeks are posted, and they
 * leave the store when the server holds them (or kept less of them twice). Never throws.
 */
async function usageTick($: $) {
  if (usageRunning || usageFails >= USAGE_STRIKES || !capturing) return
  usageRunning = true
  try {
    const cfg = await serverCfg($)
    if (!cfg.token || !usageOn((await read($, config)).raw)) return
    // Every request of this pass goes to the server and with the token it began with, whatever the store says by then:
    // weeks read under one account are never sent as another's.
    const as = { url: cfg.url, token: cfg.token, keepNote: true } as const
    const key = keyOf(cfg)
    let s: UsageState = usageState(await storeGet<unknown>($, K.usage, null), key)
    const began = await $.clock.now()
    // The anchor and the weeks are the server's: its time is the local clock plus the config read's skew.
    if (!usageDue(s, { now: began, serverNow: began + configSkewMs(), played: await usagePlayed($, cfg) })) return
    s = await usagePut($, key, now => ({ ...now, tried: began }))
    try {
      if (s.anchor === null) {
        const r = await api($, 'GET', '/usage', undefined, as)
        const got = r.status === 200 ? usageAnswer(r.json) : null
        if (!got) throw new Error(`GET /usage answered ${r.status}`)
        // The newest week the server holds for this install is read already, whatever this store says (a store wiped since).
        s = await usagePut($, key, now => ({ ...now, anchor: got.anchor, through: got.through === null ? now.through : Math.max(got.through, now.through ?? got.through) }))
      }
      const anchor = s.anchor
      if (anchor === null) return
      const plan = usagePlan({ anchor, through: s.through, now: (await $.clock.now()) + configSkewMs() })
      if (plan) {
        let rows: UsageWeek[] = []
        if (plan.readDays > 0) {
          const base = await projectsDir($)
          if (!base) throw new Error('no transcripts folder')
          const retention = await transcriptRetention($, base)
          const r = await $.process.run(['sh', '-c', USAGE_SCRIPT, 'sh', base, String(plan.readDays), String(Math.max(0, Math.min(plan.readDays, retention - 1)))], { timeoutMs: USAGE_TIMEOUT_MS })
          if (r.exitCode !== 0) throw new Error(`sh exited ${r.exitCode}`)
          const got = r.isStdoutTruncated ? null : readUsage(r.stdout)
          if (!got) throw new Error('output not whole')
          rows = usageWeeks(got, { anchor, first: plan.first, last: plan.last, now: (await $.clock.now()) + configSkewMs(), cover: coverDays(got, retention) })
        }
        // A switch moved while the script ran (Model stats off, either flag off, signed out): nothing is kept of the read, and the weeks wait.
        if (!(await usageStillOn($, key))) {
          await usagePut($, key, now => ({ ...now, tried: 0 }))
          return
        }
        // Read: the totals wait here, and the weeks are never read again.
        s = await usagePut($, key, now => ({ ...now, through: plan.last, held: holdWeeks(now.held, rows) }))
      }
      // Sent only once the server says, now, that this account has a finished match and Model stats on.
      if (s.held.length > 0 && (await usageMayPost($, key, as))) {
        const sending = usageState(await storeGet<unknown>($, K.usage, null), key).held
        const newest = sending.at(-1)
        if (newest) {
          const r = await api($, 'POST', '/usage', usageBody(sending), as)
          const got = r.status === 200 ? usageAnswer(r.json) : null
          if (!got) throw new Error(`POST /usage answered ${r.status}`)
          // The server says what it holds: less than was sent is sent once more on a later run, then let go.
          let again = false
          await usagePut($, key, now => {
            const after = afterPost(now, { sent: newest.week, held: got.through })
            again = after.again
            return after.again ? { ...after.state, tried: 0, failed: began } : after.state
          })
          if (again) return
        }
      }
      await usagePut($, key, now => ({ ...now, tried: 0, failed: 0 }))
      usageFails = 0
    } catch (err) {
      const message = clean(String((err as Error | undefined)?.message ?? err))
      // The server's answer and a script that ran badly are worth another try in six hours; a session that can't start `sh` hands the slot back and stops.
      const again = isTransientUsageFailure(message) || / answered \d+$/.test(message)
      usageFails = again ? usageFails + 1 : USAGE_STRIKES
      $.ui.log(`CCSR usage: failed${usageFails >= USAGE_STRIKES ? ', no more tries this session' : ''}: ${message}`, { to: 'debug' })
      await usagePut($, key, now => ({ ...now, tried: 0, failed: again ? began : now.failed }))
    }
  } catch (err) {
    $.ui.log(`CCSR usage: ${clean(String((err as Error | undefined)?.message ?? err))}`, { to: 'debug' })
  } finally {
    usageRunning = false
  }
}

// ------------------------------------------------------------------ the transcript fallback (W7-3)
// Dark: only while config's eval_backfill is on and capture is (`backfilling`, set in
// syncCapture). A new score whose live block is none, or that has no block, looks for its
// coder in Claude Code's own transcripts on this machine: the projects folder of this config
// dir (CLAUDE_CONFIG_DIR, else ~/.claude), in the folders of the sessions started in the repo
// or one of its worktrees: each session's file, and its subagents' and workflow agents' files.
// Each file is read for keys and numbers only (transcripts.ts), at most 5 a commit and 20 a
// scan, none over 4 MiB, and the calls are attributed over the same windows, `since` and
// reflog rule as the live records (scanBlocks with `transcript`). A window's vote counts only
// when every file that could hold one of its calls was read: none skipped, every folder listed
// whole, and no session started in a subfolder of the repo (a folder never read) written in the
// window. A sha match counts whenever it is found. Only a block that names something replaces
// the live one. The calls stay in the scan's memory: never in the slots under ~/.ccsr/calls.

/** A folder as the fallback lists it: its `.jsonl` files (size and time come with the listing), its folders' names, and the names of anything else in it (a link). */
type TxFolder = { files: TranscriptFile[]; dirs: string[]; other: string[] }

/** A repo's project folders: `own`, read; `twins`, the folders of sessions started in its subfolders, only looked at; whether both are known whole. */
type TxDirs = { own: string[]; twins: string[]; complete: boolean }

/** One scan's transcript reads: what's left of its budget, each folder listed and file read (null: couldn't), each repo's folders. */
type TxScan = { budget: number; lists: Map<string, TxFolder | null>; calls: Map<string, TranscriptCall[] | null>; dirs: Map<string, TxDirs> }

function txScan(): TxScan {
  return { budget: FILES_PER_SCAN, lists: new Map(), calls: new Map(), dirs: new Map() }
}

/**
 * The transcript block for one new score with no live record, or null: a block that names a
 * model or a match (sha, window or ambiguous), from the files that could hold a call in its
 * window. Over a window it couldn't read whole, only a sha match.
 */
async function transcriptBlock($: $, root: string, sha: string, listed: RawCommit[], since: number, local: Set<string>, tx: TxScan): Promise<CoderBlock | null> {
  const repo = await repoKey(root)
  const commits = scanCommits(listed, repo)
  const commit = commits.find(c => c.sha === sha)
  const w = windowsOf(commits).get(sha)
  // A commit before `since` gets no block at all, from the records or from here.
  if (!commit || !w || !(commit.ct * 1000 >= since)) return null
  const found = await transcriptFiles($, root, w.from, tx)
  const plan = readPlan(found.files, { from: w.from, read: new Set(tx.calls.keys()), budget: tx.budget })
  for (const path of plan.fresh) {
    tx.budget--
    try {
      tx.calls.set(path, callsFromTranscript(String(await $.fs.read(path)), { subagent: isSubagentFile(path) }))
    } catch {
      tx.calls.set(path, null)
    }
  }
  // Not `read`: the engine reads that name statically, as the atom reader imported above.
  const got = plan.use.map(p => tx.calls.get(p) ?? null)
  const whole = found.complete && plan.complete && got.every(r => r !== null)
  // The files were picked by the repo's folders, so their calls are the repo's: each counts in one window here.
  const calls = mergeTranscripts(got.filter((r): r is TranscriptCall[] => r !== null)).map(c => ({ ...c, repo }))
  const block = (await scanBlocks($, root, listed, { calls, since }, 'transcript', local)).get(sha) ?? null
  if (!block || block.match === null) return null
  return whole || block.match === 'sha' ? block : null
}

/**
 * The transcripts of this repo's sessions that could hold a call made at or after `from`, as
 * `folderFiles` finds them in each of its own folders. `complete` is false when one of those
 * couldn't be listed whole, or when a session started in a subfolder of the repo (its folder
 * is never read) has a transcript written since `from`: a call could sit where the read can't
 * see it.
 */
async function transcriptFiles($: $, root: string, from: number, tx: TxScan): Promise<{ files: TranscriptFile[]; complete: boolean }> {
  const dirs = await transcriptDirs($, root, tx)
  const files: TranscriptFile[] = []
  let complete = dirs.complete
  for (const dir of dirs.own) {
    const here = await folderFiles($, dir, from, tx)
    if (!here.complete) complete = false
    files.push(...here.files)
  }
  for (const dir of complete ? dirs.twins : []) {
    // Only names and times: nothing in these folders is read.
    const there = await folderFiles($, dir, from, tx)
    if (!there.complete || there.files.some(f => !(f.mtimeMs < from))) {
      complete = false
      break
    }
  }
  return { files, complete }
}

/**
 * One project folder's transcripts that could hold a call made at or after `from`: every
 * session file in it, and the subagent files of each session written since BACKGROUND_MS
 * before then (a subagent or a workflow run writes in the background while its session's own
 * file sits still), newest first, at most SESSIONS_MAX sessions. `complete` is false when the
 * folder or one of those subagent folders couldn't be listed whole, past SESSIONS_MAX, or when
 * a session's transcript isn't a plain file (a link has no size or time in the listing).
 */
async function folderFiles($: $, dir: string, from: number, tx: TxScan): Promise<{ files: TranscriptFile[]; complete: boolean }> {
  const here = await listFolder($, dir, tx)
  if (here === null) return { files: [], complete: false }
  const files = [...here.files]
  let complete = !here.other.some(n => /\.jsonl$/.test(n))
  const writtenAt = (f: TranscriptFile) => (Number.isFinite(f.mtimeMs) ? f.mtimeMs : Infinity)
  const sessions = here.files.filter(f => writtenAt(f) >= from - BACKGROUND_MS).sort((a, b) => writtenAt(b) - writtenAt(a))
  if (sessions.length > SESSIONS_MAX) complete = false
  for (const f of sessions.slice(0, SESSIONS_MAX)) {
    const subs = await subagentFiles($, `${f.path.slice(0, -'.jsonl'.length)}/subagents`, tx)
    if (!subs.complete) complete = false
    files.push(...subs.files)
  }
  return { files, complete }
}

/**
 * A session's subagent transcripts: `subagents/*.jsonl`, and each workflow run's
 * `subagents/workflows/<run>/*.jsonl` but its `journal.jsonl` (the run's own log, no model
 * call). The other files there (`.meta.json`, `.prefix.json`) are never read. `complete` is
 * false when one of those folders is there but can't be listed, or holds a folder or a link
 * of a shape Claude Code didn't write (2.1.293): a call could sit in it unseen.
 */
async function subagentFiles($: $, dir: string, tx: TxScan): Promise<{ files: TranscriptFile[]; complete: boolean }> {
  const top = await listFolder($, dir, tx)
  if (top === null) return { files: [], complete: false }
  const files = [...top.files]
  let complete = top.other.length === 0 && top.dirs.every(d => d === 'workflows')
  if (!top.dirs.includes('workflows')) return { files, complete }
  const runs = await listFolder($, `${dir}/workflows`, tx)
  if (runs === null) return { files, complete: false }
  if (runs.other.length > 0) complete = false
  files.push(...runs.files)
  for (const run of runs.dirs) {
    const inRun = await listFolder($, `${dir}/workflows/${run}`, tx)
    if (inRun === null || inRun.other.length > 0 || inRun.dirs.length > 0) complete = false
    if (inRun) files.push(...inRun.files.filter(f => !/[\\/]journal\.jsonl$/.test(f.path)))
  }
  return { files, complete }
}

/** One folder, listed once a scan: empty when it isn't there, null when it is but can't be listed. */
async function listFolder($: $, dir: string, tx: TxScan): Promise<TxFolder | null> {
  const held = tx.lists.get(dir)
  if (held !== undefined) return held
  let out: TxFolder | null
  try {
    const entries = await $.fs.list(dir)
    out = {
      files: entries.filter(e => e.kind === 'file' && /\.jsonl$/.test(e.name)).map(e => ({ path: `${dir}/${e.name}`, size: e.size, mtimeMs: e.mtimeMs })),
      dirs: entries.filter(e => e.kind === 'dir').map(e => e.name),
      other: entries.filter(e => e.kind !== 'file' && e.kind !== 'dir').map(e => e.name),
    }
  } catch {
    out = (await $.fs.exists(dir).catch(() => true)) ? null : { files: [], dirs: [], other: [] }
  }
  tx.lists.set(dir, out)
  return out
}

/**
 * The folders under this config dir's projects folder for the repo's sessions. `own`: the one
 * for its main working tree and one for each worktree (`git worktree list`), named as Claude
 * Code names them; these are read. `twins`: the folders of sessions started in a subfolder of
 * one of those trees, or of another folder whose name starts the same (the two can't be told
 * apart by name); these are never read, only their transcripts' times looked at. `complete` is
 * false when the worktrees or the projects folder couldn't be listed, or past TWINS_MAX twins.
 * None without a home directory or an absolute CLAUDE_CONFIG_DIR.
 */
async function transcriptDirs($: $, root: string, tx: TxScan): Promise<TxDirs> {
  const held = tx.dirs.get(root)
  if (held) return held
  const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined)) || ''
  const configDir = await $.env.get('CLAUDE_CONFIG_DIR').catch(() => undefined)
  const base = home || /^(\/|[A-Za-z]:[\\/])/.test((configDir ?? '').trim()) ? transcriptsDirOf({ CLAUDE_CONFIG_DIR: configDir }, home) : null
  let out: TxDirs = { own: [], twins: [], complete: true }
  if (base) {
    const trees = new Set([root])
    let complete = true
    try {
      const r = await git($, root, ['worktree', 'list', '--porcelain'], 15_000)
      if (r.exitCode !== 0) complete = false
      else for (const line of r.stdout.split('\n')) if (line.startsWith('worktree ') && line.length > 9) trees.add(line.slice(9))
    } catch {
      // No git here: the main working tree's folder only, and a worktree's sessions would go unseen.
      complete = false
    }
    const own = [...trees].map(t => projectDirOf(t))
    const all = await listFolder($, base, tx)
    if (all === null) complete = false
    const prefixes = [...trees].map(t => subfolderPrefixOf(t))
    const twins = (all?.dirs ?? []).filter(n => !own.includes(n) && prefixes.some(p => n.startsWith(p)))
    if (twins.length > TWINS_MAX) complete = false
    out = { own: own.map(n => `${base}/${n}`), twins: twins.length > TWINS_MAX ? [] : twins.map(n => `${base}/${n}`), complete }
  }
  tx.dirs.set(root, out)
  return out
}

// ------------------------------------------------------------------ poll loops
// Every poll runs on loop(): one tick at a time, each scheduled after the last
// one settles, at the interval config gives it, read again every tick. When the
// server can't be reached, is limiting us (408, 429) or is failing (5xx), the
// wait doubles from the interval up to max(60 s, Retry-After), with full
// jitter so a recovery doesn't bring every mod back at once, and the first 2xx
// puts it back to the interval. $.http.fetch has no timeout, so a watchdog
// gives up on a tick whose request hangs past max(60 s, 3 x the interval) and
// moves on; a newer generation means the abandoned tick's late answer changes
// nothing. A loop never has more than two requests out: with one given up on
// and still out, the watchdog waits on the next instead of leaving it behind,
// and a tick doesn't start while two are out. A request given up on stops
// counting once it has been out for hungExpiryMs, so a socket that never
// answers can't stop a poll for good. A press that should show at once (Queue,
// Accept, a room) runs the loop's next tick now with kickLoop, never a request
// of its own beside the loop.

/** What one tick of a loop got back: the status of its main request, and any Retry-After. */
type Answer = { status: number; retryAfterMs?: number | null }

/** One run of a loop's `fn`: abandoned once its watchdog (or a stop) gives up on it while its request is out. */
type LoopTick = {
  gen: number
  settled: boolean
  abandoned: boolean
  /** When the tick began, and the interval then: a request given up on counts until startedAt + hungExpiryMs(every). */
  startedAt: number
  every: number
  /** Ends the wait on this tick when it's given up on, so a press waiting on it moves on. */
  gaveUp: () => void
}

type LoopState = {
  name: string
  /** Bumped when the loop stops and when the watchdog gives up on a tick: an older tick schedules nothing when it settles. */
  gen: number
  timer: { cancel: () => void } | null
  watchdog: { cancel: () => void } | null
  /** A tick is running, its request maybe in flight. */
  busy: boolean
  tick: LoopTick | null
  /** A kick came while a tick ran: the next tick follows it at once. */
  soon: boolean
  /**
   * The presses that kicked while a tick ran, waiting on the tick that follows
   * it: each is let go when that tick answers or is given up on, or at once when
   * none follows now (the loop stopped, gave up on a tick or backs off).
   */
  waiters: (() => void)[]
  failures: number
  retryAfter: number | null
  /** When a tick last began or was scheduled, and the wait set then: slowSync restarts a loop that went quiet past both. */
  lastTickAt: number
  waitMs: number
  every: () => Promise<number>
  fn: (isCurrent: () => boolean) => Promise<Answer | void>
}

const loops = new Map<string, LoopState>()
/** Requests a watchdog or a stop gave up on that haven't answered yet, by loop name, across restarts. */
const hung = new Map<string, Set<LoopTick>>()

/**
 * Starts (or restarts) the loop called `name`: `fn` runs once per tick, the
 * first after one interval (kickLoop runs one now). `every` is read every
 * tick, so a config change applies on the next one. Returns the way to stop it.
 */
function loop($: $, name: string, every: () => Promise<number>, fn: (isCurrent: () => boolean) => Promise<Answer | void>) {
  stopLoop(name)
  const st: LoopState = { name, gen: 0, timer: null, watchdog: null, busy: false, tick: null, soon: false, waiters: [], failures: 0, retryAfter: null, lastTickAt: 0, waitMs: 0, every, fn }
  loops.set(name, st)
  void armLoop($, st, st.gen, null).catch(err => $.ui.log(`CCSR ${name}: ${(err as Error).message}`))
  return () => stopLoop(name)
}

function stopLoop(name: string) {
  const st = loops.get(name)
  if (!st) return
  // A request still out counts against the two a hung server may hold, until it answers.
  if (st.tick && !st.tick.settled && !st.tick.abandoned) abandon(st.name, st.tick)
  st.gen++
  st.timer?.cancel()
  st.watchdog?.cancel()
  st.timer = null
  st.watchdog = null
  loops.delete(name)
  letGo(st)
}

/** No tick follows now: every press waiting on the loop's next one moves on with what the last left. */
function letGo(st: LoopState) {
  for (const r of st.waiters.splice(0)) r()
}

/**
 * Runs the loop's next tick now instead of at its timer, through the same
 * single flight and watchdog: it resolves once that tick answers or is given
 * up on. With a tick already running, the next one follows it at once, and
 * the kick resolves once that one answers (or at once when none follows: the
 * loop stopped or backs off), so a press never reads what a tick still in
 * flight hasn't written.
 */
async function kickLoop($: $, name: string) {
  const st = loops.get(name)
  if (!st) return
  if (st.busy) {
    st.soon = true
    return new Promise<void>(r => st.waiters.push(r))
  }
  await runTick($, st, st.gen)
}

/** The interval a loop's `every` gives now, held to the config clamps (1 s to 10 min). */
async function loopEvery(st: LoopState) {
  try {
    const ms = Math.round(await st.every())
    return Number.isFinite(ms) ? Math.min(600_000, Math.max(1000, ms)) : 2000
  } catch {
    return 2000
  }
}

/** Schedules the loop's next tick: after `ms`, or after one interval when null. A tick running now schedules its own when it settles. */
async function armLoop($: $, st: LoopState, gen: number, ms: number | null) {
  if (st.gen !== gen || loops.get(st.name) !== st) return
  const wait = ms ?? (await loopEvery(st))
  if (st.gen !== gen || loops.get(st.name) !== st) return
  const t = await $.clock.now()
  // A tick running now arms its own next one; so did any that ran since the loop began.
  if (st.gen !== gen || loops.get(st.name) !== st || st.busy || (ms === null && st.tick)) return
  st.waitMs = wait
  st.lastTickAt = t
  st.timer?.cancel()
  st.timer = $.clock.after(wait, () => void runTick($, st, gen).catch(err => $.ui.log(`CCSR ${st.name}: ${(err as Error).message}`)))
}

/** How many of `name`'s requests given up on still count at `t`: one out past hungExpiryMs is taken for dead. */
function hungCount(name: string, t: number) {
  const out = hung.get(name)
  if (!out) return 0
  for (const tick of [...out]) if (t - tick.startedAt >= hungExpiryMs(tick.every)) out.delete(tick)
  return out.size
}

function abandon(name: string, tick: LoopTick) {
  tick.abandoned = true
  const out = hung.get(name) ?? new Set<LoopTick>()
  out.add(tick)
  hung.set(name, out)
  tick.gaveUp()
}

const GAVE_UP = Symbol('gave up')

async function runTick($: $, st: LoopState, gen: number) {
  if (st.gen !== gen || loops.get(st.name) !== st || st.busy) return
  st.timer?.cancel()
  st.timer = null
  st.busy = true
  const t = await $.clock.now()
  const every = await loopEvery(st)
  if (st.gen !== gen || loops.get(st.name) !== st) {
    st.busy = false
    return
  }
  // Two of ours already hang there: no third, until one answers or is taken for dead.
  if (hungCount(st.name, t) >= 2) {
    st.busy = false
    letGo(st)
    return armLoop($, st, gen, every)
  }
  // The presses waiting on the next tick wait on this one.
  const waiting = st.waiters.splice(0)
  st.lastTickAt = t
  let gaveUp = () => {}
  const given = new Promise<typeof GAVE_UP>(r => (gaveUp = () => r(GAVE_UP)))
  const tick: LoopTick = { gen, settled: false, abandoned: false, startedAt: t, every, gaveUp }
  st.tick = tick
  const isCurrent = () => !tick.abandoned && st.gen === tick.gen && loops.get(st.name) === st
  armWatchdog($, st, tick, every)
  const ran = (async (): Promise<Answer | void> => {
    try {
      return await st.fn(isCurrent)
    } catch (err) {
      $.ui.log(`CCSR ${st.name}: ${(err as Error).message}`)
      return { status: 0 }
    } finally {
      tick.settled = true
      // Given up on and now answered: it no longer counts against the two.
      hung.get(st.name)?.delete(tick)
    }
  })()
  const answer = await Promise.race([ran, given])
  // Answered or given up on: the presses waiting on this tick move on.
  for (const r of waiting) r()
  if (answer === GAVE_UP || tick.abandoned) return
  st.busy = false
  st.watchdog?.cancel()
  st.watchdog = null
  if (!isCurrent()) return
  if (answer && retryable(answer.status)) {
    st.failures++
    st.retryAfter = answer.retryAfterMs ?? null
  } else if (answer && answer.status >= 200 && answer.status < 300) {
    st.failures = 0
    st.retryAfter = null
  }
  // A kick that came while this tick ran: the next one now, unless the server asked us to back off.
  const soon = st.soon && !(answer && retryable(answer.status))
  st.soon = false
  if (!soon) letGo(st)
  await armLoop($, st, gen, soon ? 0 : loopWaitMs(await loopEvery(st), st.failures, st.retryAfter))
}

/**
 * The watchdog for one tick. Past max(60 s, 3 x the interval) with no answer,
 * the loop gives up on it, as on a request that never reached the server, and
 * schedules the next tick. With another request already given up on and still
 * out, it waits on this one instead, so a hung server holds at most two of ours.
 */
function armWatchdog($: $, st: LoopState, tick: LoopTick, every: number) {
  st.watchdog?.cancel()
  st.watchdog = $.clock.after(watchdogMs(every), () => void watchdogFired($, st, tick, every).catch(err => $.ui.log(`CCSR ${st.name}: ${(err as Error).message}`)))
}

async function watchdogFired($: $, st: LoopState, tick: LoopTick, every: number) {
  const out = () => !tick.settled && !tick.abandoned && st.gen === tick.gen && loops.get(st.name) === st
  if (!out()) return
  const t = await $.clock.now()
  if (!out()) return
  if (hungCount(st.name, t) >= 1) return armWatchdog($, st, tick, every)
  abandon(st.name, tick)
  st.gen++
  st.busy = false
  st.watchdog = null
  st.failures++
  st.retryAfter = null
  // The next tick waits out the backoff: a press that kicked during this one moves on now.
  letGo(st)
  await armLoop($, st, st.gen, loopWaitMs(every, st.failures, null))
}

/** From slowSync: a loop with no tick running and none due for a while lost its timer; start it again. */
async function reviveLoops($: $) {
  const t = await $.clock.now()
  for (const st of [...loops.values()]) if (!st.busy && t - st.lastTickAt > st.waitMs + 30_000) loop($, st.name, st.every, st.fn)
}

// ------------------------------------------------------------------ ranked
// The queue, the ready check and the live match, by polling (mods can't hold a
// socket): GET /queue while queued or offered, the match's events while it
// runs, each at its config interval (2 s by default) on loop(). One session on
// the machine polls (lead.ts: a lease in the store, taken by a press, a free
// one by the first tick); what it reads goes into the store as a snapshot, and
// every other session's loop draws that and asks the server nothing. Between matches the same loop reads GET /queue for
// its lanes, the lengths offered (W2b), at poll_ms.idle while the Match tab is
// on screen, and stops off it.

const RANKED0: RankedShared = { phase: 'idle', matchId: null, lengthsMin: null, queuedMin: [], since: 0, bucket: null }
let stopRankedPoll: (() => void) | null = null
const rankedWarned = new Set<string>()
/** A Queue press found no lanes cached: the ranked loop's next tick reads them once, whatever tab is on screen. */
let lanesOnce = false
/** Why the last lanes read got none, for a Queue press that still finds none cached: null after a read that answered. */
let lanesMiss: string | null = null

const PHASES: readonly RankedShared['phase'][] = ['idle', 'queued', 'offered', 'live', 'done']

/**
 * Where this player is in ranked, from the store. Lengths are minutes: an old
 * stored `lengths` in hours is read once by lengthsFromStore, and since this
 * object never carries it, setRanked never writes it back.
 */
async function rankedShared($: $): Promise<RankedShared> {
  const raw = await storeGet<unknown>($, K.ranked, {})
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  return {
    phase: PHASES.includes(o.phase as RankedShared['phase']) ? (o.phase as RankedShared['phase']) : RANKED0.phase,
    matchId: typeof o.matchId === 'string' ? o.matchId : null,
    lengthsMin: lengthsFromStore(o),
    queuedMin: minutesOf(o.queuedMin),
    since: typeof o.since === 'number' && Number.isFinite(o.since) ? o.since : 0,
    bucket: bucketIdOf(o.bucket),
  }
}

async function setRanked($: $, patch: Partial<RankedShared>) {
  const next = { ...(await rankedShared($)), ...patch }
  await save($, K.ranked, next)
  return next
}

/**
 * The bucket the Match tab shows between matches (W3b): the pick while config still lists it,
 * else Open, else config's first (`pickBucket`). Normalized only here, while idle: the store
 * keeps the pick, so a bucket that comes back is picked again, and while queued or offered the
 * mod follows the server's bucket instead. null when config lists no buckets (a server before
 * W3a, or none read yet): the mod then queues and reads lanes exactly as before buckets.
 */
async function bucketOnScreen($: $, sh: RankedShared): Promise<string | null> {
  return pickBucket(bucketsOf(await configOf($)), sh.bucket)?.id ?? null
}

/**
 * The cached lanes when they are bucket `id`'s (W3b), else null, as if none were read. Another
 * bucket's can be cached: a read in flight when the row moved, a queue poll's answer after a
 * drop, or a lanes read the server answered as Open because the bucket asked for isn't on for
 * you. So the Match tab draws, toggles and queues only with the lanes of the bucket in question.
 * A null `id` (config lists no buckets) and lanes no bucket was named for (a server before W3a)
 * always fit.
 */
function lanesIn(l: Pick<LinkState, 'lanes' | 'lanesBucket'>, id: string | null): ApiLane[] | null {
  const of = l.lanesBucket ?? null
  return id === null || of === null || of === id ? l.lanes : null
}

/** When a lanes read last found config stale on buckets (W3b), for `staleBuckets`' spacing. */
let staleBucketsAt = 0

/**
 * A lanes read asked for a bucket config lists and the server answered as another (W3b): the
 * bucket isn't on for this player any more, though config's version may not have moved (a
 * group membership, say). Config is read again (`bucket`), at most once per REREAD_SPACING_MS,
 * so a server that stays out of step never costs a config read per lanes poll.
 */
async function staleBuckets($: $) {
  const t = await $.clock.now()
  if (t - staleBucketsAt < REREAD_SPACING_MS) return
  staleBucketsAt = t
  void refreshConfig($, 'bucket').catch(() => null)
}

function startRankedPoll($: $) {
  if (stopRankedPoll && loops.has('ranked')) return
  stopRankedPoll = loop($, 'ranked', () => rankedEvery($), isCurrent => pollRanked($, isCurrent))
}

/**
 * A ranked poll now (after a press): the ranked loop's next tick, started if it isn't running. Never
 * a request beside it. The press makes this session the one that polls (the window in use leads),
 * and what it holds after the press is newer than any snapshot, so the one in the store is set aside.
 */
async function pollRankedNow($: $) {
  await leadTick($, true)
  shareRev = shareOf(await storeGet<unknown>($, K.rankedShare, null))?.rev ?? shareRev
  startRankedPoll($)
  await kickLoop($, 'ranked')
}

/** A press here took the player out of the queue (Leave, Decline): this session's loop stops, and what it holds now is what every session draws. */
async function quitRanked($: $) {
  stopPolling()
  await shareRanked($)
  await dropLead($)
}

/** The ranked poll's interval for where the player is: queued, an offer out, a live match, or between matches (the lanes). */
async function rankedEvery($: $) {
  const c = await configOf($)
  const phase = (await rankedShared($)).phase
  return phase === 'offered' ? c.poll.offered : phase === 'live' ? c.poll.live : phase === 'queued' ? c.poll.queued : c.poll.idle
}

function stopPolling() {
  stopRankedPoll?.()
  stopRankedPoll = null
}

// One poller per machine (lead.ts). The lease and the snapshot are in the store; these are this session's side of them.
/** The rev of the snapshot this session last applied, wrote or (on a press here) set aside. */
let shareRev = ''
/** That snapshot's content (shareBody), and when this session last wrote one: an unchanged one is written again only every SHARE_BEAT_MS. */
let shareKnown = ''
let shareAt = 0
let shareCount = 0
/** The decided match whose snapshot said it has custom art this session holds no ref for yet (followRanked reads it once, for a pane that shows it). */
let artWanted: string | null = null
/** The matches that read was made for, whatever it found: never twice. */
const artAsked = new Set<string>()

/**
 * How long a lease taken now lasts: past this session's next tick, its backoff wait included (leadMs).
 * The interval is the running tick's own (the loop read it as the tick began); a press outside a tick reads it.
 */
async function leadMsNow($: $, failed = 0, retryAfter?: number | null) {
  const st = loops.get('ranked')
  const every = st?.tick && !st.tick.settled ? st.tick.every : await rankedEvery($)
  return leadMs(every, (st?.failures ?? 0) + failed, retryAfter === undefined ? (st?.retryAfter ?? null) : retryAfter)
}

/** Takes or keeps the lease for this tick, and says whether this session leads. `force` (a press here) takes it from whoever has it. */
async function leadTick($: $, force = false): Promise<boolean> {
  const t = await $.clock.now()
  const held = await leadRead($)
  // The lease can't be read: lead. It fails open throughout: two pollers for a tick beat none for as long as the store is in trouble.
  if (!held.ok) return true
  const take = takeLead(held.lead, owner, t, await leadMsNow($), force)
  if (!take.write) return take.lead
  // The write didn't land (the store's lock, under many sessions): this session leads this tick anyway. Read back as another
  // session's, a dead leader's lease would never be replaced, and a live match would have no poller at all.
  if (!(await saveQuiet($, K.rankedLead, take.write))) return true
  // Two sessions that take a free lease in the same moment both write: the store keeps one, and the other follows.
  const now = await leadRead($)
  return !now.ok || now.lead?.by === owner
}

/** The lease as the store has it; `ok` false when the store couldn't be read. */
async function leadRead($: $): Promise<{ ok: boolean; lead: ReturnType<typeof leadOf> }> {
  try {
    return { ok: true, lead: leadOf(await storeGet<unknown>($, K.rankedLead, null)) }
  } catch {
    return { ok: false, lead: null }
  }
}

/** Gives the lease up when it is this session's, so the next session to tick takes it at once instead of waiting it out. */
async function dropLead($: $) {
  if ((await leadRead($)).lead?.by === owner) await saveQuiet($, K.rankedLead, { by: owner, until: 0 })
}

/** What this session holds of the queue, the lanes and the match goes into the store for every session, when it moved (or every SHARE_BEAT_MS). */
async function shareRanked($: $) {
  const l = await read($, link)
  // The match as link holds it, so without a decided win's art ref (keepArtRef): another player's art, title and handle never reach
  // the store. `art` only says there is one, so a session that draws the result reads the match once itself for it (followRanked).
  const ranked = l.ranked ? { ...l.ranked, art: artRefs.has(l.ranked.id) } : null
  const body = { key: await configKey($), queue: l.queue, lanes: l.lanes, lanesBucket: l.lanesBucket, ranked }
  const json = shareBody(body)
  const t = await $.clock.now()
  if (json === shareKnown && t - shareAt < SHARE_BEAT_MS) return
  const rev = `${owner}:${t}:${++shareCount}`
  // Recorded as written only once it is: a write that failed (the store's lock) is made again by the next call, not taken for done.
  if (!(await saveQuiet($, K.rankedShare, { rev, at: t, by: owner, ...body }))) return
  shareKnown = json
  shareAt = t
  shareRev = rev
}

/**
 * Takes a snapshot another session wrote that this one hasn't seen: its queue state, lanes and
 * match page become this session's. Every tick begins with it, the leader's too, since a press in
 * another session (Leave, Dismiss) writes one. The match's summary goes through keepArtRef here as
 * a page of this session's own would.
 */
async function applyShare($: $) {
  const s = shareOf(await storeGet<unknown>($, K.rankedShare, null))
  if (!s || s.rev === shareRev || s.by === owner) return
  shareRev = s.rev
  if (s.key !== (await configKey($))) return
  // The match page only when it is the match the store's phase is about: one left from an earlier match draws nothing.
  const about = (await rankedShared($)).matchId
  const sent = s.ranked && (s.ranked as { id?: unknown }).id === about ? (s.ranked as RankedMatch & { art?: boolean }) : null
  let ranked: RankedMatch | null = null
  if (sent) {
    const { art, ...page } = sent
    ranked = page
    artWanted = art === true && !artAsked.has(sent.id) ? sent.id : null
    // Decided, and read by the session that leads: it reads the account after it and shares that too (adoptSeen). Owed here until
    // a copy newer than this snapshot is taken: slowSync asks itself if none comes (the leader's one read may have failed).
    if ((sent.summary?.status === 'finished' || sent.summary?.status === 'void') && accountAfter !== sent.id) {
      accountAfter = sent.id
      if (meHeldAt < s.at) accountOwed = { id: sent.id, since: s.at, tries: 0 }
    }
  }
  const lanes = s.lanes as ApiLane[] | null
  await update($, link, l => ({ ...l, queue: s.queue as ApiQueueState | null, ranked, ...(lanes ? { lanes, lanesBucket: s.lanesBucket } : {}) }))
  const now = await read($, link)
  shareKnown = shareBody({ key: s.key, queue: now.queue, lanes: now.lanes, lanesBucket: now.lanesBucket, ranked: sent })
  shareAt = s.at
}

/**
 * A tick of a session that isn't the one polling: it asks the server nothing. What the leader read
 * is already this session's (applyShare); what is left is this session's own. Near the bell it
 * still looks for uncommitted work in its own repo, and between matches, off the Match tab, its
 * loop stops as a leader's does.
 */
async function followRanked($: $) {
  const sh = await rankedShared($)
  const sm = (await read($, link)).ranked?.summary
  if (sh.phase === 'live' && sm?.status === 'live' && sm.deadline && Date.parse(sm.deadline) - (await $.clock.now()) <= warnMs(sm)) await checkDirty($)
  // A decided win with custom art: its ref is never in the snapshot, so a session whose pane is up reads the match once for it.
  if (artWanted && paneSurface && sm && sm.id === artWanted && !artRefs.has(artWanted)) {
    const id = artWanted
    artWanted = null
    artAsked.add(id)
    for (const old of [...artAsked].slice(0, Math.max(0, artAsked.size - 20))) artAsked.delete(old)
    const m = await api($, 'GET', `/matches/${id}`, undefined, { keepNote: true })
    if (m.status === 200) await keepArtRef($, (m.json as { match: ApiMatchSummary }).match)
  }
  // Decided, and this session has no result to draw yet: the loop goes on. The leader writes the phase and the snapshot apart, and a
  // tick that lands between them used to stop here for good, with the bell on screen (PR 73's bug, for a follower). The snapshot is
  // taken when it lands; and if it never does (the leader died at the result, its write failed, or it is a mod from before
  // snapshots), the lease runs out, this session takes it and reads the result itself (leadRanked's late read).
  const owed = sh.phase === 'done' && sh.matchId ? await resultMissing($, sh.matchId) : null
  if ((sh.phase === 'idle' || sh.phase === 'done') && !owed && !lanesOnce && !(await lanesWatched($))) stopPolling()
  await refreshStatus($)
}

/**
 * One tick of the ranked loop. Only the loop calls it: a press that wants a poll now goes through
 * pollRankedNow. One session on the machine polls (the lease); the others draw what it read.
 */
async function pollRanked($: $, isCurrent: () => boolean): Promise<Answer | void> {
  await applyShare($)
  if (!(await leadTick($))) return followRanked($)
  const r = await leadRanked($, isCurrent)
  const stopped = !loops.has('ranked')
  // A tick given up on publishes nothing, nor one whose lease a press in another session took while its request was out.
  if (!stopped && !isCurrent()) return r
  const t = await $.clock.now()
  if (ledByOther((await leadRead($)).lead, owner, t)) return r
  await shareRanked($)
  // Nothing left to poll here: the lease goes, so a session with the Match tab on screen takes it at its next tick.
  if (stopped) await dropLead($)
  // Backing off: the lease is held through the wait the loop takes next, so no follower takes a turn at a server that is down or shedding.
  else if (r && retryable(r.status)) await saveQuiet($, K.rankedLead, { by: owner, until: t + (await leadMsNow($, 1, r.retryAfterMs ?? null)) })
  return r
}

/** The leader's tick: the request this player's phase calls for. */
async function leadRanked($: $, isCurrent: () => boolean): Promise<Answer | void> {
  const sh = await rankedShared($)
  if (sh.phase === 'queued' || sh.phase === 'offered') return pollQueue($, sh, isCurrent)
  if (sh.phase === 'live' && sh.matchId) return pollMatch($, sh.matchId, isCurrent)
  // Decided by another session's poll (or before this session began): the store says done, and this session has no result to draw.
  const late = sh.phase === 'done' && sh.matchId ? await resultMissing($, sh.matchId) : null
  if (late && sh.matchId) {
    const r = await pollMatch($, sh.matchId, isCurrent, late)
    // No such match on this server (a server switch, or one the server no longer keeps): nothing will ever draw it, so the phase goes back to idle.
    if (r.status === 404 && isCurrent() && (await rankedShared($)).matchId === sh.matchId) await clearRanked($)
    return r
  }
  // Between matches: the lanes, while the Match tab is on screen, or once for a press. W3b: the lanes of the bucket on screen.
  const once = lanesOnce
  lanesOnce = false
  if ((sh.phase === 'idle' || sh.phase === 'done') && (once || (await lanesWatched($)))) return pollLanes($, isCurrent, await bucketOnScreen($, sh))
  // A press that came during this tick wants the lanes: its kick has the next tick follow at once, and that one reads them.
  if (lanesOnce) return
  stopPolling()
}

/**
 * Whether this session lacks the result of match `id`, which the store says is decided, and how.
 * The phase is the store's, shared by every session on the machine; the match itself (`link`) is
 * each session's own. So the session whose poll reads the result first sets the phase to done, and
 * no other session read the match again:
 *   - `open`: this session's copy stopped at live or grace, and its pane, band and status line drew
 *     the bell ("0:00:00 to the bell", "Bell. Scoring commits made before it.") for good;
 *   - `none`: a session begun after the result (or one that never followed the match) has no copy,
 *     and its Match tab drew "Checking with the server." until some session dismissed the result.
 * Either way one more read takes the result here too (pollRanked). null when this session has it.
 */
async function resultMissing($: $, id: string): Promise<'open' | 'none' | null> {
  const r = (await read($, link)).ranked
  if (!r || r.id !== id || !r.summary) return 'none'
  return r.summary.status === 'finished' || r.summary.status === 'void' ? null : 'open'
}

/**
 * The Match tab is on screen: it's the tab, and the pane drew within max(15 s,
 * 2.5 x the idle interval), the chat poll's heartbeat rule. A press that shows
 * the tab (selectTab, openPane) counts as a draw. Signed in only.
 */
async function lanesWatched($: $) {
  if (!(await serverCfg($)).token || (await read($, link)).unknownToken || (await read($, tab)) !== 'match') return false
  const t = await $.clock.now()
  return t - paneSeenAt <= Math.max(15_000, 2.5 * (await configOf($)).poll.idle)
}

/** Between matches with the Match tab on screen: the ranked loop goes on reading the lanes (no tick now; a press that wants one kicks it). */
async function idlePoll($: $) {
  const phase = (await rankedShared($)).phase
  if ((phase === 'idle' || phase === 'done') && (await lanesWatched($))) startRankedPoll($)
}

/**
 * GET /queue between matches (the lanes poll). `bucket` is W3b's: it reads the
 * lanes of the bucket on screen. The lanes are kept apart from the queue state,
 * so they last through a match for Queue again; any `cancelled` reason it
 * carries is shown, as the queue poll does. The server is the source of truth:
 * when it has you queued or offered (a Leave or a Queue whose answer was lost,
 * or another machine on the account), the mod takes that up, so it polls as
 * the queue does and shows the ready check, never keeping alive an entry it
 * doesn't show.
 */
async function pollLanes($: $, isCurrent: () => boolean, bucket: string | null): Promise<Answer> {
  const r = await api($, 'GET', bucket ? `/queue?bucket=${encodeURIComponent(bucket)}` : '/queue', undefined, { keepNote: true })
  // A late answer to a request the loop gave up on changes nothing.
  if (!isCurrent()) return r
  lanesMiss = r.status === 200 ? null : failLine(r)
  if (r.status !== 200) return r
  const q = r.json as ApiQueueState
  const lanes = lanesOf(q?.lanes)
  // W3b: kept with the bucket they are (the answer says; else the one asked for), so another bucket's never draw under the row.
  const of = bucketIdOf(q?.bucket) ?? bucket
  await update($, link, l => ({ ...l, ...(lanes ? { lanes, lanesBucket: of } : {}) }))
  if (q?.status === 'queued' || q?.status === 'offered') {
    // What it queued you for isn't in this answer: the pick within the lanes is the best guess, and takeQueue holds it to the lanes.
    const sh = await rankedShared($)
    const pick = pickedLengths(sh.lengthsMin, lanes)
    const was = await setRanked($, { phase: 'queued', matchId: null, since: await $.clock.now(), queuedMin: pick.length ? pick : sh.queuedMin })
    return takeQueue($, was, q, r, isCurrent)
  }
  // W3b: asked for a bucket config lists and answered as another (Open): it isn't on for you now, so config is stale on buckets.
  if (bucket && of !== bucket) await staleBuckets($)
  await noteCancelled($, q)
  return r
}

/** The server itself answered: not no answer at all, nor a proxy's 502 to 504 (the server's own 503 comes with its error JSON), as api() reads it. */
function reachedOf(r: { status: number; json: unknown }) {
  return r.status !== 0 && (r.status < 502 || r.status > 504 || errorOf(r.json) !== null)
}

/** A failed answer as a press's note: offline when the server wasn't reached, else its message or its status. */
function failLine(r: { status: number; json: unknown }) {
  return reachedOf(r) ? (errorOf(r.json)?.message ?? MOD.answered(r.status)) : MOD.noServer
}

/** The toast for why the last offer died or the server took you out of the queue (`cancelled`, on one read only). */
async function noteCancelled($: $, q: ApiQueueState | null) {
  if (!q?.cancelled) return
  const reason = q.cancelled.reason
  if (reason === 'update_required') {
    const rel = (await read($, link)).release
    if (rel) await ambient($, MOD.updateNeeded(rel.min, VERSION), 'match')
  } else await ambient($, cancelledLine(String(reason)), 'match')
  // W3b: your bucket closed for you, or you stopped meeting its checklist: the neutral line (W1b's), and config says what's open now.
  if (reason === 'bucket_closed' || reason === 'verification_required') void refreshConfig($, 'bucket').catch(() => null)
}

async function pollQueue($: $, sh: RankedShared, isCurrent: () => boolean): Promise<Answer> {
  const r = await api($, 'GET', '/queue')
  // A late answer to a request the loop gave up on changes nothing.
  if (r.status !== 200 || !isCurrent()) return r
  return takeQueue($, sh, r.json as ApiQueueState, r, isCurrent)
}

/**
 * One GET /queue answer while queued or offered (`sh` is where the mod had you):
 * an offer shows the ready check, queued keeps what the server still queues you
 * for, idle means the offer went live or you're out.
 */
async function takeQueue($: $, sh: RankedShared, q: ApiQueueState, r: Answer, isCurrent: () => boolean): Promise<Answer> {
  const lanes = lanesOf(q?.lanes)
  // W6b: the offer the last answer held, before this one replaces it: a challenge's ready check that dies says so.
  const before = (await read($, link)).queue?.offer ?? null
  // W3b: while queued or offered the bucket is the server's (your entry's, or the match's): the mod adopts it as it comes. The
  // answer's lanes are that bucket's (once out of the queue, the bucket the answer names: Open, as no ?bucket= is asked here).
  const qb = bucketIdOf(q?.bucket) ?? bucketIdOf(q?.offer?.bucket)
  await update($, link, l => ({ ...l, queue: q, ...(lanes ? { lanes, lanesBucket: qb ?? sh.bucket } : {}) }))
  await noteCancelled($, q)
  const adopt: Partial<RankedShared> = qb && qb !== sh.bucket ? { bucket: qb } : {}
  if (q.status === 'offered' && q.offer) {
    if (sh.phase !== 'offered' || sh.matchId !== q.offer.match_id) {
      await setRanked($, { phase: 'offered', matchId: q.offer.match_id, ...adopt })
      // Approved line (docs/copy.md): the match-found toast, which no setting turns off. W6b: a challenge's says who took it.
      await ambient($, q.offer.kind === 'challenge' ? CHALLENGE.readyTaken(q.offer.opponent.handle) : LINES.found, 'ready', 10_000)
      await ring($, 'chime')
      // W4b: the notices' match_found trigger (nothing pops over the ready check: notices.ts holds toasts, flashes and the band till it's answered).
      void noticeEvent($, { on: 'match_found' }).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
    } else if (adopt.bucket) await setRanked($, adopt)
    await refreshStatus($)
    return r
  }
  if (q.status === 'queued') {
    const queuedMin = sh.queuedMin.length ? sh.queuedMin : pickedLengths(sh.lengthsMin, lanes)
    // A length switched off while you wait leaves the server's entry (all of them off is length_off): the lanes are what it still offers.
    const kept = lanes ? queuedMin.filter(m => lanes.some(x => x.length_min === m)) : queuedMin
    const now = kept.length ? kept : queuedMin
    if (sh.phase !== 'queued' || now.join() !== sh.queuedMin.join() || adopt.bucket) await setRanked($, { phase: 'queued', matchId: null, queuedMin: now, ...adopt })
    await refreshStatus($)
    return r
  }
  // Idle: the offer went live (both accepted), or we left or were dropped.
  if (sh.matchId) {
    const m = await api($, 'GET', `/matches/${sh.matchId}`)
    if (!isCurrent()) return r
    const summary = m.status === 200 ? (m.json as { match: ApiMatchSummary }).match : null
    if (summary && (summary.status === 'live' || summary.status === 'grace')) {
      await enterLive($, summary, isCurrent)
      return r
    }
  }
  // W6b: a challenge's ready check that ended without a match sets no `cancelled` reason (W6a), so it says so here, and the inbox shows where the challenge stands now.
  if (sh.phase === 'offered' && before?.kind === 'challenge' && before.match_id === sh.matchId) {
    await ambient($, CHALLENGE.noMatch, 'match')
    if (await challengesLive($)) void pollInboxNow($).catch(() => null)
  }
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, queue: null }))
  // Out of the queue: the loop's next tick reads the lanes if the Match tab is on screen, else stops.
  return r
}

/**
 * The match went live: follow it. Inside a ranked tick (`isCurrent` given),
 * its first page is that tick's next request; after a press, the ranked loop
 * runs a tick now.
 */
async function enterLive($: $, sent: ApiMatchSummary, isCurrent?: () => boolean) {
  // W10e: any custom art ref stays out of the link atom (a live match has none; the decided one comes through pollMatch).
  const summary = await keepArtRef($, sent)
  await setRanked($, { phase: 'live', matchId: summary.id })
  // W4b: the notices' match_start trigger.
  void noticeEvent($, { on: 'match_start' }).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  await update($, link, l => ({ ...l, queue: null, ranked: { id: summary.id, summary, events: l.ranked?.id === summary.id ? l.ranked.events : [], cursor: l.ranked?.id === summary.id ? l.ranked.cursor : 0, polledAt: 0 } }))
  // W6b: a challenge's taker waits on the sender's ready check, maybe for minutes: when a poll (not their own press) finds it live, a toast says so.
  if (isCurrent && summary.kind === 'challenge' && !rankedWarned.has(`${summary.id}:on`)) {
    rankedWarned.add(`${summary.id}:on`)
    const them = rankedSides(summary, (await serverCfg($)).handle ?? '').them
    await ambient($, CHALLENGE.on(them.player.handle, lengthLabel(summary.length_min)), 'match', 8000)
  }
  if (isCurrent) await pollMatch($, summary.id, isCurrent)
  else await pollRankedNow($)
}

/**
 * One page of the match. `late` (pollRanked, resultMissing): another session's poll already decided
 * it and rang the result, so this one plays no sound and leaves the phase alone. A session that was
 * following the match (`open`) still toasts the result in its own window; one that never was
 * (`none`) only draws it, since the result may be hours old.
 */
async function pollMatch($: $, id: string, isCurrent: () => boolean, late: 'open' | 'none' | null = null): Promise<Answer> {
  const cur = (await read($, link)).ranked
  const cursor = cur && cur.id === id ? cur.cursor : 0
  const r = await api($, 'GET', `/matches/${id}/events?cursor=${cursor}`)
  if (r.status !== 200 || !isCurrent()) return r
  // Asked with a cursor this session's copy no longer has (Resync set it back to 0 while this read was out): merged, it would
  // move the cursor past the reset and the feed would lose everything before it for the rest of the match. The next read is from 0.
  const held = (await read($, link)).ranked
  if (held && held.id === id && held.cursor !== cursor) return r
  const page = r.json as { events: RankedMatch['events']; cursor: number; match: ApiMatchSummary; notices?: unknown }
  const t = await $.clock.now()
  // W10e: a decided win's custom art ref goes in module memory (and its art is fetched for this pane), never the link atom.
  const summary = await keepArtRef($, page.match)
  await update($, link, l => {
    const have = l.ranked && l.ranked.id === id ? l.ranked.events : []
    // W4b: the feed's notices ride every page (critical and warn, for a side of a live or grace match): the newest page's are kept as sent.
    return { ...l, ranked: { id, summary, events: mergeEvents(have, page.events), cursor: page.cursor, polledAt: t, notices: page.notices } }
  })
  if (Array.isArray(page.notices) && page.notices.length > 0) void feedAlerts($, id).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  const s = summary
  if (s.status === 'live' && s.deadline) {
    const left = Date.parse(s.deadline) - t
    // The warnings follow the match's last minutes (warnMs): 10 before the bell at 1h, 5 at 30m, 3 at 15m; then 1 minute, with the bell.
    const warn = warnMs(s)
    const marks: [number, string][] = warn > 60_000 ? [[warn, MOD.warnAt(Math.round(warn / 60_000))], [60_000, MOD.warn1]] : [[60_000, MOD.warn1]]
    for (const [mark, text] of marks)
      if (left <= mark && left > 0 && !rankedWarned.has(`${id}:${mark}`)) {
        rankedWarned.add(`${id}:${mark}`)
        await ambient($, text, 'match', 8000)
        if (mark === 60_000) await ring($, 'bell')
      }
    if (left <= warn) await checkDirty($)
  }
  if (s.status === 'finished' || s.status === 'void') {
    // What every other session draws goes out before the phase does, and before the toast and the result's sound (which is awaited
    // to its end, up to two seconds): a follower that found done with no result to draw yet sat between the two writes.
    // Unless a press in another window took the lease while this read was out: that window's queue or match is the one to draw.
    if (!ledByOther((await leadRead($)).lead, owner, t)) await shareRanked($)
    // A late read leaves the store alone: it already said done, and since then another session may have dismissed the result or queued again.
    if (!late) await setRanked($, { phase: 'done', matchId: id })
    // Decided: the loop's next tick reads the lanes (for Queue again) if the Match tab is on screen, else stops.
    if (late === 'none') rankedWarned.add(`${id}:result`)
    if (!rankedWarned.has(`${id}:result`)) {
      rankedWarned.add(`${id}:result`)
      const me = (await serverCfg($)).handle ?? ''
      await ambient($, rankedResultLine(s, me), 'match', 10_000)
      const o = rankedOutcome(s, me)
      if (!late && s.status !== 'void' && o !== 'draw') await ring($, o === 'won' ? 'win' : 'loss')
      // W4b: the notices' result trigger, then placed, or tier up or down (before GET /me is read again below).
      void noticeMatchEnd($, s, me).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
    }
    // The account after the result: owed until a read answers (refreshAccount settles it), so one failed read is asked again by slowSync.
    if (accountAfter !== id) accountOwed = { id, since: t, tries: 0 }
    accountAfter = id
    void refreshAccount($)
      .then(() => refreshBoards($))
      .catch(() => null)
  }
  await refreshStatus($)
  return r
}

/** The result in one line, from the approved results table (docs/copy.md). W6b: a challenge's says Unrated where the Elo change goes, never +0. */
function rankedResultLine(s: ApiMatchSummary, me: string) {
  const mine = s.sides.find(x => x.player.handle === me) ?? s.sides[0]
  const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
  if (s.status === 'void') return resultText('void', 'points', 0, 0)
  if (s.result === 'draw') return resultText('draw', 'points', 0, 0)
  if (s.kind === 'challenge') return challengeResultText(s.winner === me ? 'won' : 'lost', s.result === 'forfeit' ? 'forfeit' : 'points', seedOf(s.id))
  return resultText(s.winner === me ? 'won' : 'lost', s.result === 'forfeit' ? 'forfeit' : 'points', delta, seedOf(s.id))
}

/** Queue, from the Queue buttons: the lengths the player picked (every one offered unless some were unticked). True once queued. */
async function joinQueue($: $) {
  return queueWith($, { lengthsMin: (await rankedShared($)).lengthsMin })
}

/**
 * Queue for `lengthsMin` (null is every length offered) within the lanes the
 * server offers, posted in minutes in numeric order as `{ lengths_min }`: the
 * Queue buttons, and the `queue` action (W4b's notices, `{ do: 'queue' }`).
 * With no lanes cached the ranked loop reads them first, once, and the press
 * waits for that read (and for one already in flight). The server keeps what it
 * offers and answers what it queued; a refusal shows its message, and a press
 * that queues nothing says why. With an offer out or a match on it does
 * nothing; queued already, it posts the new lengths and keeps your place and
 * your clock. The player's own length pick in the store is never changed here.
 * Resolves true once queued.
 *
 * W3b, buckets: it queues in `bucket`, else the bucket the Match tab shows (or,
 * queued already, the server's), and posts `{ lengths_min, bucket }`, the
 * lengths held to that bucket's own too (`lengthsFor`). Between matches a
 * bucket asked for that isn't on screen becomes the one on screen (the server
 * answers with it anyway) and its lanes are read before the post; queued in
 * another, the entry moves there with config's lengths for it, and its clock
 * starts over, as the server's does. With no buckets in config (a server
 * before W3a) it posts `{ lengths_min }` alone, as before. The server
 * enforces a bucket's checklist: a 403 `verification_required` (or a 404
 * `bucket_not_found`) shows the server's message and reads config again.
 */
export async function queueWith($: $, o: { lengthsMin: readonly number[] | null; bucket?: string | null }): Promise<boolean> {
  // Ranked is paused for this player (queue.practice_only): the server would answer 403 ranked_paused.
  const cf = await configOf($)
  if (cf.practiceOnly) {
    // W11: an account still in the line reads as paused too; the note says which it is.
    const line = lineOf(cf.raw)
    await update($, link, l => ({ ...l, note: line.waiting ? MOD.inLine(line.ahead) : MOD.rankedPaused }))
    return false
  }
  // The ready check or the match is on screen: the server would answer 409 in_match.
  const was = await rankedShared($)
  const phase = was.phase
  if (phase === 'offered' || phase === 'live') return false
  const list = bucketsOf(cf)
  const shown = pickBucket(list, was.bucket)?.id ?? null
  // Queued already, the bucket is the server's (adopted from its answers).
  const here = phase === 'queued' ? (was.bucket ?? shown) : shown
  const target = bucketIdOf(o.bucket) ?? here
  if (target !== here && phase !== 'queued') {
    // Another bucket between matches: it's the one on screen now, and the lanes cached are the last one's.
    await setRanked($, { bucket: target })
    await update($, link, l => ({ ...l, lanes: null, lanesBucket: null }))
  }
  // The lanes cached are the bucket on screen's, or the queued one's: a queued entry moving to another bucket takes config's lengths for it alone.
  // Lanes cached for any other bucket count as none read (lanesIn).
  const lanesFit = target === here || phase !== 'queued'
  if (lanesFit && !lanesIn(await read($, link), target)) {
    // The ranked loop's next tick reads them; with a tick running, the one after it does, and the kick waits for it. No read at all is offline.
    lanesMiss = MOD.noServer
    lanesOnce = true
    await pollRankedNow($)
  }
  const lanes = lanesFit ? lanesIn(await read($, link), target) : null
  const laneMins = lanes ? lanes.map(x => x.length_min) : null
  const def: Bucket | null = target ? (list.find(b => b.id === target) ?? null) : null
  const lengths = def ? lengthsFor(def, o.lengthsMin, laneMins) : pickedLengths(o.lengthsMin, lanes)
  if (lengths.length === 0) {
    // Why nothing was queued: no lanes read (the read's own failure), none offered (in the bucket), none of the pick offered, or nothing ticked.
    const offered = def ? lengthsFor(def, null, laneMins) : (laneMins ?? [])
    const note = lanesFit && !lanes ? (lanesMiss ?? MOD.noLengths) : offered.length === 0 ? MOD.noLengths : o.lengthsMin?.length ? MOD.pickOff : MOD.tickOne
    await update($, link, l => ({ ...l, note }))
    return false
  }
  await syncHandle($, SYNC_HANDLE_MS)
  const r = await api($, 'POST', '/queue', target ? { lengths_min: lengths, bucket: target } : { lengths_min: lengths })
  if (await refusedForUpdate($, r)) return false
  if (r.status !== 200) {
    // length_unavailable: what's offered moved since the lanes were read. Its `offered` trims the lanes now; the next lanes read fills them in.
    const code = errorOf(r.json)?.code
    const open = code === 'length_unavailable' ? minutesOf((r.json as { offered?: unknown }).offered) : null
    await update($, link, l => ({ ...l, note: failLine(r), lanes: open && l.lanes ? l.lanes.filter(x => open.includes(x.length_min)) : l.lanes }))
    // W3b: the held config said this bucket could be queued, and the server says no: its checklist changed, or it closed for you. Read config again.
    if (code === 'verification_required' || code === 'bucket_not_found') void refreshConfig($, 'bucket').catch(() => null)
    return false
  }
  const queued = minutesOf((r.json as { lengths_min?: unknown } | null)?.lengths_min)
  const inBucket = bucketIdOf((r.json as { bucket?: unknown } | null)?.bucket) ?? target
  await update($, link, l => ({ ...l, note: '' }))
  // Queued already in this bucket (new lengths): the server keeps your place, so the clock keeps its start. Another bucket starts both over.
  const sh = await rankedShared($)
  const same = (sh.bucket ?? OPEN) === (inBucket ?? OPEN)
  const since = sh.phase === 'queued' && sh.since > 0 && same ? sh.since : await $.clock.now()
  await setRanked($, { phase: 'queued', matchId: null, since, queuedMin: queued.length ? queued : lengths, bucket: inBucket })
  await pollRankedNow($)
  return true
}

/**
 * Leave the queue. A Leave the server didn't take (it wasn't reached, limited
 * us or failed) keeps you in the queue with why (the queued view draws the
 * note until the next queue poll answers): the queue poll goes on, so an offer
 * still shows, and Leave can be pressed again.
 */
async function leaveQueue($: $) {
  const r = await api($, 'DELETE', '/queue')
  if (retryable(r.status)) {
    // Not reached: api() has set the offline line already.
    if (reachedOf(r)) await update($, link, l => ({ ...l, note: failLine(r) }))
    return
  }
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, queue: null }))
  await quitRanked($)
  await idlePoll($)
}

/** A length's toggle under the queue bar: its minutes flip in the pick (every lane ticked is null, every length). */
async function toggleLength($: $, min: number) {
  const sh = await rankedShared($)
  // W3b: one pick serves every bucket, so with several a toggle counts every length any of them offers: unticking 1h in one never unticks 15m in another.
  // The lanes are the bucket on screen's, the ones its toggles draw.
  const list = bucketsOf(await configOf($))
  const lanes = lanesIn(await read($, link), pickBucket(list, sh.bucket)?.id ?? null) ?? []
  const others = bucketRowShown(list) ? list.flatMap(b => b.lengths.map(m => ({ length_min: m }))) : []
  await setRanked($, { lengthsMin: toggledLengths(sh.lengthsMin, min, [...lanes, ...others]) })
  await update($, link, l => ({ ...l }))
}

/**
 * A bucket row press on the Match tab (`bucket-<id>`, W3b), between matches: queue there from
 * now on. Its lanes are read now (the last bucket's go at once, so none is drawn under the
 * wrong row), and for a bucket besides Open, your rank and last matches there.
 */
async function chooseBucket($: $, id: string) {
  const sh = await rankedShared($)
  if (sh.phase !== 'idle' || !bucketIdOf(id)) return
  // Already on screen (a pick config dropped reads as Open): the press is kept as the pick, with nothing to read again.
  if ((await bucketOnScreen($, sh)) === id) {
    if (sh.bucket !== id) await setRanked($, { bucket: id })
    return
  }
  await setRanked($, { bucket: id })
  await update($, link, l => ({ ...l, lanes: null, lanesBucket: null, note: '' }))
  lanesOnce = true
  await pollRankedNow($)
  if (id !== OPEN) await refreshBucketBoards($, id, { profile: true })
}

/** A bucket row press on the Ranked or Grind tab (`board-<id>`, `board-grind-<id>`, W3b): that bucket's board, read now. Open's is read with the tab. */
async function chooseBoard($: $, which: 'ranked' | 'grind', id: string) {
  if (!bucketIdOf(id)) return
  await update($, boardPick, p => (which === 'ranked' ? { ...p, ranked: id } : { ...p, grind: id }))
  if (id !== OPEN) await refreshBucketBoards($, id, which === 'ranked' ? { profile: true, ladder: true } : { grind: true })
}

const BOARD0: BucketBoard = { ladder: null, rank: null, recent: null, grindRank: null, grindOf: null }

/** When this session last read GET /me for a missing standing, and whether boot registered W3b's checks (standings, lanes) on the config tick. */
let standingsReadAt = 0
let bucketTicking = false

/**
 * After a config read (W3b), between matches with the Match tab on screen: config moved the
 * bucket on screen (it dropped the one picked, so the pick reads as Open again), and the lanes
 * cached are the old bucket's, which draw nothing now. The new one's are read at once rather
 * than at the next lanes poll. Boot runs it from the config tick without awaiting it, since a
 * read waits on the ranked loop.
 */
async function lanesTick($: $, cfg: ModConfig) {
  const sh = await rankedShared($)
  if (sh.phase !== 'idle' && sh.phase !== 'done') return
  const l = await read($, link)
  if (!l.lanes || lanesIn(l, pickBucket(bucketsOf(cfg), sh.bucket)?.id ?? null) || !(await lanesWatched($))) return
  lanesOnce = true
  await pollRankedNow($)
}

/**
 * After a config read: config lists a bucket GET /me had no standing for (switched on for
 * this player since the last read, say for the dark test, or opened to everyone after the
 * freeze). Reads GET /me's standings again, at most once a minute, so the cards, the queued
 * view and the ready check stand the player there without a restart. Boot runs it from the
 * config tick without awaiting it, so a config read never waits on GET /me.
 */
async function standingsTick($: $, cfg: ModConfig) {
  const list = bucketsOf(cfg)
  if (!bucketRowShown(list) || !(await serverCfg($)).token) return
  const l = await read($, link)
  if (!l.me) return
  const have = new Set((l.meBuckets ?? []).map(x => bucketIdOf((x as { bucket?: unknown } | null)?.bucket)))
  if (list.every(b => have.has(b.id))) return
  const t = await $.clock.now()
  if (t - standingsReadAt < 60_000) return
  standingsReadAt = t
  const me = await api($, 'GET', '/me', undefined, { keepNote: true })
  const kept = me.status === 200 ? (me.json as { buckets?: unknown } | null)?.buckets : undefined
  if (Array.isArray(kept)) await update($, link, x => ({ ...x, meBuckets: kept.slice(0, 8) }))
}

/**
 * A bucket's boards besides Open's (W3b), as the server sends them with `?bucket=`: your
 * profile there (rank, last matches), its top 10, and its weekly Grind (your rank among the
 * players who meet its requirements, and how many they are). Background reads, so a press's
 * note stays. A 404 `bucket_not_found` means config is stale: it's read again.
 */
async function refreshBucketBoards($: $, id: string, what: { profile?: boolean; ladder?: boolean; grind?: boolean }) {
  const cfg = await serverCfg($)
  if (!cfg.token || id === OPEN || !bucketIdOf(id)) return
  const q = `bucket=${encodeURIComponent(id)}`
  const bg = { keepNote: true }
  const prof = what.profile && cfg.handle ? await api($, 'GET', `/players/${encodeURIComponent(cfg.handle)}?${q}`, undefined, bg) : null
  const board = what.ladder ? await api($, 'GET', `/boards/ranked?limit=10&${q}`, undefined, bg) : null
  const week = what.grind ? await api($, 'GET', `/boards/grind?period=week&limit=100&${q}`, undefined, bg) : null
  if ([prof, board, week].some(r => r?.status === 404 && errorOf(r.json)?.code === 'bucket_not_found')) void refreshConfig($, 'bucket').catch(() => null)
  const pj = prof?.status === 200 ? (prof.json as { rank?: number | null; recent_matches?: ApiRecentMatch[] }) : null
  const rows = week?.status === 200 ? (week.json as { items?: { rank: number; player?: { handle?: string } }[]; total?: number }) : null
  await update($, link, l => {
    const had = l.boards?.[id] ?? BOARD0
    const next: BucketBoard = {
      ladder: board?.status === 200 ? ((board.json as { items?: ApiRankedRow[] }).items ?? had.ladder) : had.ladder,
      rank: pj ? (pj.rank ?? null) : had.rank,
      recent: pj ? (pj.recent_matches ?? had.recent) : had.recent,
      grindRank: rows ? ((rows.items ?? []).find(x => x.player?.handle === cfg.handle)?.rank ?? null) : had.grindRank,
      grindOf: rows && typeof rows.total === 'number' ? rows.total : had.grindOf,
    }
    return { ...l, boards: { ...(l.boards ?? {}), [id]: next } }
  })
}

async function acceptOffer($: $) {
  const sh = await rankedShared($)
  if (!sh.matchId) return
  // A queue's offer needs no account read: the queue press made one, and the server renames nobody who
  // is queued. A challenge's ready check reaches the challenger with no press of theirs before it.
  if ((await read($, link)).queue?.offer?.kind === 'challenge') await syncHandle($, SYNC_HANDLE_MS)
  const r = await api($, 'POST', `/matches/${sh.matchId}/accept`)
  // Below the floor: decline now rather than hold the opponent for the full minute.
  if (await refusedForUpdate($, r)) return declineOffer($)
  if (r.status === 200) {
    const summary = (r.json as { match: ApiMatchSummary }).match
    if (summary.status === 'live') return enterLive($, summary)
    await update($, link, l => (l.queue?.offer ? { ...l, queue: { ...l.queue, offer: { ...l.queue.offer, you_accepted: true } } } : l))
    return
  }
  // The offer closed under us: the next poll says where we stand.
  await pollRankedNow($)
}

/**
 * Decline the offer. A Decline the server didn't take (it wasn't reached,
 * limited us or failed) keeps the ready check up with why, as Leave does: the
 * offer is still out, so the lanes read would only bring it back, and Decline
 * can be pressed again. The offer's own clock ends it either way.
 */
async function declineOffer($: $) {
  const sh = await rankedShared($)
  // W6b: a challenge's ready check declined cancels it (the sender's) or declines it (the taker's): the inbox is read again after.
  const challenge = (await read($, link)).queue?.offer?.kind === 'challenge'
  if (sh.matchId) {
    const r = await api($, 'POST', `/matches/${sh.matchId}/decline`)
    if (retryable(r.status)) {
      // Not reached: api() has set the offline line already.
      if (reachedOf(r)) await update($, link, l => ({ ...l, note: failLine(r) }))
      return
    }
  }
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, queue: null }))
  await quitRanked($)
  await idlePoll($)
  if (challenge && (await challengesLive($))) await pollInboxNow($)
}

async function forfeitRanked($: $) {
  await update($, forfeitAsk, () => false)
  const sh = await rankedShared($)
  if (!sh.matchId) return
  const r = await api($, 'POST', `/matches/${sh.matchId}/forfeit`)
  if (r.status === 200) await pollRankedNow($)
}

async function sendRankedChat($: $, text: string) {
  await update($, chatDraft, () => '')
  const sh = await rankedShared($)
  const msg = clean(text).trim().slice(0, 280)
  if (!sh.matchId || !msg) return
  const r = await api($, 'POST', `/matches/${sh.matchId}/chat`, { text: msg })
  if (r.status === 200) {
    const item = (r.json as { item: ApiChatItem }).item
    await update($, link, l => (l.ranked && l.ranked.id === sh.matchId ? { ...l, ranked: { ...l.ranked, events: mergeEvents(l.ranked.events, [item]) } } : l))
  } else {
    await update($, link, l => ({ ...l, note: errorOf(r.json)?.message ?? `The server answered ${r.status}.` }))
  }
}

async function clearRanked($: $) {
  await setRanked($, { phase: 'idle', matchId: null })
  await update($, link, l => ({ ...l, ranked: null }))
  // Dismissed here: every session's copy of the match goes with it.
  await shareRanked($)
  await idlePoll($)
}

// ------------------------------------------------------------------ boards and rooms

let stopChatPoll: (() => void) | null = null
let paneSeenAt = 0
let roomsPolledAt = 0

/** Every room there is: a room the server adds later is left out until a mod knows how to draw it. */
const ROOMS: readonly ApiRoom[] = ['world', 'mud', 'iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'master']
const TIERS: readonly string[] = ['Mud', 'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Master']

/**
 * A room switched off: by config (`chat.world` for World, `chat.tiers` for the
 * tier rooms) or by the server's rooms list (`paused`). Nobody posts there, and
 * the mod neither shows nor reads it.
 */
function roomOff(c: ModConfig, rooms: LinkState['rooms'], room: ApiRoom) {
  return (room === 'world' ? !c.chat.world : !c.chat.tiers) || !!rooms?.some(x => x.room === room && x.paused === true)
}

/** The room the Chat tab shows: the one picked, else the first open one; null when every room you can post in is off. */
function shownRoom(c: ModConfig, l: LinkState): ApiRoom | null {
  const open = (r: ApiRoom) => !roomOff(c, l.rooms, r) && (l.rooms === null || l.rooms.some(x => x.room === r && x.can_post))
  if (open(l.room)) return l.room
  return (l.rooms ?? []).find(x => x.can_post && open(x.room))?.room ?? null
}

/** The rooms you can post in when nothing is paused: World, and your tier's room (Mud while placing). */
function myRooms(l: LinkState): ApiRoom[] {
  const tier = l.me ? (l.me.placement ? 'mud' : String(l.me.tier ?? '').toLowerCase()) : null
  const room = ROOMS.find(r => r === tier)
  return room ? ['world', room] : ['world']
}

/** A line the Chat tab can draw: a chat line with a player and a known tier, or a system line it has words for. Anything else is dropped. */
function drawableLine(x: ApiLobbyItem) {
  if (x.kind === 'chat') return !!x.player && typeof x.player.handle === 'string' && TIERS.includes(x.player.tier) && typeof x.text === 'string'
  if (x.kind === 'system') return typeof x.event === 'string' && Object.hasOwn(SYSTEM_LINE, x.event) && typeof x.handle === 'string' && TIERS.includes(String(x.tier))
  return false
}

/** The Ranked board's top 10, your rank, and the size of this week's Grind, for the Ranked and Grind tabs. */
async function refreshBoards($: $) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const board = await api($, 'GET', '/boards/ranked?limit=10')
  const me = cfg.handle ? await api($, 'GET', `/players/${encodeURIComponent(cfg.handle)}`) : { status: 0, json: null }
  const week = await api($, 'GET', '/boards/grind?period=week&limit=1')
  await update($, link, l => ({
    ...l,
    ladder: board.status === 200 ? (board.json as { items: ApiRankedRow[] }).items : l.ladder,
    myRank: me.status === 200 ? (me.json as { rank: number | null }).rank : l.myRank,
    grindRank: me.status === 200 ? ((me.json as { grind_rank: { week: number | null } }).grind_rank.week ?? l.grindRank) : l.grindRank,
    grindOf: week.status === 200 ? (week.json as { total: number }).total : l.grindOf,
    recent: me.status === 200 ? ((me.json as { recent_matches?: ApiRecentMatch[] }).recent_matches ?? l.recent) : l.recent,
  }))
  // For the machine's other sessions: what answered, as this session now holds it.
  if (board.status === 200 || me.status === 200 || week.status === 200) {
    const now = await read($, link)
    await shareSeen($, {
      ...(board.status === 200 ? { ladder: now.ladder } : {}),
      ...(me.status === 200 ? { myRank: now.myRank, grindRank: now.grindRank, recent: now.recent } : {}),
      ...(week.status === 200 ? { grindOf: now.grindOf } : {}),
    })
  }
  // W3b: the buckets besides Open on screen, read the same way: the Match tab's (your rank and last matches there; queued or after a match, the server's bucket), the Ranked tab's (and its top 10) and the Grind tab's.
  const list = bucketsOf(await configOf($, cfg))
  if (!bucketRowShown(list)) return
  const sh = await rankedShared($)
  const pick = await read($, boardPick)
  const want = new Map<string, { profile?: boolean; ladder?: boolean; grind?: boolean }>()
  const add = (id: string | null | undefined, w: { profile?: boolean; ladder?: boolean; grind?: boolean }) => {
    if (id && id !== OPEN) want.set(id, { ...(want.get(id) ?? {}), ...w })
  }
  add(sh.phase === 'idle' ? pickBucket(list, sh.bucket)?.id : sh.bucket, { profile: true })
  add(pickBucket(list, pick.ranked)?.id, { profile: true, ladder: true })
  add(pickBucket(list, pick.grind)?.id, { grind: true })
  for (const [id, w] of want) await refreshBucketBoards($, id, w)
}

/** Switches tabs, and starts or stops what the tab reads from the server. */
async function selectTab($: $, t: Tab) {
  if (t === 'ranked') roastIndex++
  await update($, tab, () => t)
  if (t === 'ranked' || t === 'grind') void refreshBoards($)
  // W5b: the linked account and the new installs, while sign-in is on.
  if (t === 'settings') void refreshIdentity($, IDENTITY_VISIT_MS).catch(() => null)
  // Unlink's first press lasts only while Settings shows.
  else if ((await read($, signinUi)).unlinkAsk) await update($, signinUi, u => ({ ...u, unlinkAsk: false }))
  if (t === 'chat') {
    paneSeenAt = await $.clock.now()
    // The rooms list and the room's lines now, on the chat loop's next tick.
    roomsPolledAt = 0
    await pollChatNow($)
  } else stopChatPolling()
  if (t === 'match') await showLanes($)
  // W10b: the Finishers view reads your picks and which colors you've unlocked (outside config's version) each time it opens.
  if (t === 'finishers') void refreshFinishers($, false).catch(err => $.ui.log(`CCSR finishers: ${(err as Error).message}`))
  // W10e: and the gallery's first page, while it is on for you.
  if (t === 'finishers') void customOpened($).catch(err => $.ui.log(`CCSR finishers: ${(err as Error).message}`))
}

/**
 * The Match tab came on screen. Between matches the ranked loop reads the lanes
 * now, then every poll_ms.idle while the tab stays on screen; off it, the loop's
 * next tick stops. In a match the loop is already polling.
 */
async function showLanes($: $) {
  paneSeenAt = await $.clock.now()
  // What another session last read is this one's at once: a result it read, the lanes, with no request.
  await applyShare($)
  const phase = (await rankedShared($)).phase
  if ((phase === 'idle' || phase === 'done') && (await serverCfg($)).token) await pollRankedNow($)
}

function startChatPoll($: $) {
  if (stopChatPoll && loops.has('chat')) return
  stopChatPoll = loop($, 'chat', async () => (await configOf($)).poll.chat, isCurrent => chatTick($, isCurrent))
}

/** A chat poll now (after a press): the chat loop's next tick, started if it isn't running. Never a request beside it. */
async function pollChatNow($: $) {
  startChatPoll($)
  await kickLoop($, 'chat')
}

function stopChatPolling() {
  stopChatPoll?.()
  stopChatPoll = null
}

/**
 * Each tick while the Chat tab is on screen: the room's lines, and the room
 * list every max(10 s, the interval). Stops once the pane hasn't drawn for
 * max(15 s, 2.5 x the interval), so a slow chat poll never outruns its own
 * heartbeat.
 */
async function chatTick($: $, isCurrent: () => boolean): Promise<Answer | void> {
  const t = await $.clock.now()
  const every = (await configOf($)).poll.chat
  if ((await read($, tab)) !== 'chat' || t - paneSeenAt > Math.max(15_000, 2.5 * every) || (await read($, settings)).surfaces.chat !== 'on') {
    stopChatPolling()
    return
  }
  if (t - roomsPolledAt >= Math.max(10_000, every)) {
    const rooms = await pollRooms($, isCurrent)
    if (!isCurrent()) return rooms
  }
  return pollRoom($, isCurrent)
}

async function pollRooms($: $, isCurrent: () => boolean): Promise<Answer | void> {
  if (!(await serverCfg($)).token) return
  roomsPolledAt = await $.clock.now()
  const r = await api($, 'GET', '/chat/rooms')
  // A late answer to a tick the loop gave up on: a newer list may be on screen already.
  if (r.status !== 200 || !isCurrent()) return r
  const all = (r.json as { rooms?: unknown } | null)?.rooms
  const rooms = (Array.isArray(all) ? (all as NonNullable<LinkState['rooms']>) : []).filter(x => !!x && ROOMS.includes(x.room))
  const c = await configOf($)
  await update($, link, l => {
    // A room that paused (a raid, say): its lines and cursor go, so what was posted before the pause never shows again.
    const lobby = l.lobby && rooms.some(x => x.room === l.lobby?.room && x.paused === true) ? null : l.lobby
    const next = { ...l, rooms, lobby }
    // Your room follows your tier: if the room on screen closed to you, go to one that's open.
    return { ...next, room: shownRoom(c, next) ?? (rooms.some(x => x.room === l.room && x.can_post) ? l.room : 'world') }
  })
  return r
}

/**
 * The lines of the room on screen, from the cursor. A room switched off is
 * never read. When the room's `epoch` changes, lines were removed (a raid
 * cleaned up): what we hold is stale, so it's read again from 0. A server that
 * sends no epoch reads as before.
 */
async function pollRoom($: $, isCurrent: () => boolean): Promise<Answer | void> {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const l = await read($, link)
  const room = shownRoom(await configOf($, cfg), l)
  if (!room) {
    if (l.lobby) await update($, link, x => ({ ...x, lobby: null }))
    return
  }
  if (room !== l.room) await update($, link, x => ({ ...x, room, lobby: x.lobby?.room === room ? x.lobby : null }))
  const cur = l.lobby && l.lobby.room === room ? l.lobby : null
  const r = await api($, 'GET', `/chat/${room}/events?cursor=${cur ? cur.cursor : 0}`)
  if (r.status !== 200 || !isCurrent()) return r
  const page = r.json as { events: ApiLobbyItem[]; cursor: number; epoch?: unknown }
  const epoch = typeof page.epoch === 'number' && Number.isFinite(page.epoch) ? page.epoch : undefined
  if (cur && cur.epoch !== undefined && epoch !== undefined && epoch !== cur.epoch) {
    await update($, link, x => (x.lobby?.room === room ? { ...x, lobby: null } : x))
    return pollRoom($, isCurrent)
  }
  await update($, link, x => {
    const was = x.lobby && x.lobby.room === room ? x.lobby : null
    const have = was ? was.events : []
    const seen = new Set(have.map(e => e.seq))
    const events = Array.isArray(page.events) ? page.events.filter(e => !!e && !seen.has(e.seq)) : []
    return { ...x, lobby: { room, events: [...have, ...events].slice(-200), cursor: page.cursor, epoch: epoch ?? was?.epoch } }
  })
  return r
}

async function setRoom($: $, room: ApiRoom) {
  if (roomOff(await configOf($), (await read($, link)).rooms, room)) return
  await update($, link, l => ({ ...l, room, lobby: l.lobby?.room === room ? l.lobby : null }))
  await pollChatNow($)
}

async function postRoom($: $, text: string) {
  await update($, chatDraft, () => '')
  const msg = clean(text).trim().slice(0, 280)
  // The room on screen, after the switches: never one that's paused.
  const room = shownRoom(await configOf($), await read($, link))
  if (!msg || !room) return
  const r = await api($, 'POST', `/chat/${room}`, { text: msg })
  if (r.status === 200) {
    const item = (r.json as { item: ApiLobbyItem }).item
    await update($, link, x => (x.lobby && x.lobby.room === item.room ? { ...x, lobby: { ...x.lobby, events: [...x.lobby.events.filter(e => e.seq !== item.seq), item] } } : x))
  } else {
    await update($, link, x => ({ ...x, note: errorOf(r.json)?.message ?? `The server answered ${r.status}.` }))
  }
}

// ------------------------------------------------------------------ challenges (W6b)
// Challenge a handle, or anyone with the code (an open challenge), to a match on your own
// projects at a length your bucket offers: played and scored like ranked, never rated, which the
// server enforces (W6a, docs/api.md "Challenges"). Dark behind config's `challenges`, read only
// through challengeCfg: while it reads off, nothing here draws, polls or asks the server anything,
// and the same holds signed out and with the Challenges switch off.
//
// What lives where:
//   - The inbox (GET /challenges?rev=) is read on loop() at poll_ms.inbox, once per machine per
//     interval: the store's K.challenges keeps the last answer with when its read began
//     (`polledAt`), keyed `<server url>|<handle>`, and a session whose turn it isn't takes that
//     copy instead of asking (the build plan's "deduped across sessions through
//     K.challenges.polledAt"). The incoming challenges already toasted ride in the same key, so
//     each one toasts once per machine.
//   - A challenge's message is player text: it is kept in `challengeMessages` (a module variable)
//     and drawn as Text, through messageIn, only while the Chat switch is on. It never goes in
//     $.state (`challengeUi` holds none), the ledger, a toast, the band or a command reply.
//   - A taken challenge's ready check is a match offer, as a ranked one is. The taker's Accept is
//     their ready: POST /challenges/:id/accept answers the offer, so their ready check shows at
//     once. The sender learns of it from the inbox (one of theirs `accepted` with its match
//     `offered`), and the ranked loop then reads GET /queue, which shows the ready check exactly
//     as for ranked. Unrated wherever stakes would show.

/** The inbox as the store keeps it: the last full answer (`body`, re-read on every take), its rev, when the read that brought it began, and the incoming challenges already toasted. */
type ChallengeBox = { key: string; polledAt: number; rev: number | null; body: unknown; toasted: string[] }

/**
 * A session takes the store's copy only while that read began less than the interval ago, less
 * this much: the session whose tick comes due reads, and a copy a moment short of due isn't
 * held for a whole interval more.
 */
const INBOX_SLACK_MS = 2000
/** How many challenges a side the box draws; the rest are counted. */
const BOX_SHOWN = 5

/** Each challenge's message as messageIn draws it, by code: never in $.state, which every plugin can read. */
const challengeMessages = new Map<string, string>()
/** The message typed in the form: the player's own words, kept out of $.state with the rest. */
let challengeDraft = ''
let stopInboxPoll: (() => void) | null = null
/** The inbox loop's next tick asks the server whatever the store's copy says (a press just changed a challenge). */
let inboxForce = false
/** Whether boot registered challengesTick on the config tick. */
let challengesTicking = false
/**
 * The `<server url>|<handle>` the box was filled for. Another one (W5b's sign-in switch, a link
 * code, a recovery key, a server switch) empties the box before anything of the old account's
 * draws or acts here: its cards' buttons would send with the new token.
 */
let challengeKey: string | null = null
/** GET /me's `challenges_enabled` from this session's last read, and when it was asked, until adoptHeard can apply it (config must say challenges are on). */
let challengesHeard: { key: string; on: boolean; at: number } | null = null
/** The Challenges switch's last telling in this session: the next waits on it (tellChallenges). */
let challengesTelling: Promise<unknown> = Promise.resolve()

/**
 * A Challenges switch press on this machine, by `<server url>|<handle>`: the value pressed, when,
 * and when the server confirmed it (null while it hasn't: each config tick sends it again, and
 * GET /me's value never overwrites it; nor does a GET /me asked before it was confirmed).
 */
type ChallengesPress = { key: string; on: boolean; at: number; told: number | null }

/** The most times a paced challenge request goes: once, then again after each 429's wait. */
const PACED_TRIES = 4

/** What config's `challenges` turns on for this player (challengeCfg, W6a's rule); all off with no config. */
function challengesOf(cf: Pick<ModConfig, 'raw'>): ChallengeCfg {
  return challengeCfg(cf.raw.challenges)
}

/** Challenges are on here: config has them on for this player, this install is signed in with a token the server knows, and the Challenges switch is on. */
async function challengesLive($: $): Promise<boolean> {
  const cfg = await serverCfg($)
  if (!cfg.token || (await read($, link)).unknownToken) return false
  if (!challengesOf(await configOf($, cfg)).on) return false
  return (await read($, settings)).surfaces.challenges !== 'off'
}

function startInboxPoll($: $) {
  if (stopInboxPoll && loops.has('inbox')) return
  stopInboxPoll = loop($, 'inbox', async () => (await configOf($)).poll.inbox, isCurrent => pollInbox($, isCurrent))
}

function stopInboxPolling() {
  stopInboxPoll?.()
  stopInboxPoll = null
}

/** An inbox read now, from the server (after a press that changed a challenge): the inbox loop's next tick. Never a request beside it. */
async function pollInboxNow($: $) {
  inboxForce = true
  startInboxPoll($)
  await kickLoop($, 'inbox')
}

/** How long a 429 asked a paced challenge request to wait: the server's word, held to 0.25 to 2 s (W6a's windows are a second). */
function pacedWaitMs(r: { retryAfterMs: number | null }) {
  return Math.min(2000, Math.max(250, r.retryAfterMs ?? 1000))
}

/**
 * A challenge request W6a's per-player limits may refuse for a moment (the inbox 1 read a
 * second; takes and declines 2 a second together): a 429 waits what the server asked and goes
 * again, a few times at most, so a burst of declines (the switch going off withdraws up to five)
 * or two presses close together all land.
 */
async function paced($: $, method: string, path: string, body?: unknown) {
  let r = await api($, method, path, body)
  for (let i = 1; i < PACED_TRIES && r.status === 429; i++) {
    await waitMs($, pacedWaitMs(r))
    r = await api($, method, path, body)
  }
  return r
}

/**
 * One tick of the inbox loop. While a ready check or a match is on, nothing in the inbox can be
 * taken, so it asks nothing. Otherwise: the store's copy when another session on this machine
 * read it within the interval, else GET /challenges with the rev held (an unchanged answer keeps
 * the copy). Only the loop calls it.
 */
async function pollInbox($: $, isCurrent: () => boolean): Promise<Answer | void> {
  if (!(await challengesLive($))) {
    stopInboxPolling()
    await clearChallenges($)
    return
  }
  const phase = (await rankedShared($)).phase
  if (phase === 'offered' || phase === 'live') return
  const key = await configKey($)
  const t = await $.clock.now()
  const every = (await configOf($)).poll.inbox
  const stored = await storeGet<ChallengeBox | null>($, K.challenges, null)
  const mine = stored && stored.key === key ? stored : null
  if (!inboxForce && mine && mine.body !== null && t - mine.polledAt < every - INBOX_SLACK_MS) {
    await takeInbox($, mine)
    return { status: 200 }
  }
  const forced = inboxForce
  inboxForce = false
  // This session's turn: claimed before asking, so the machine's other sessions take the copy instead.
  await save($, K.challenges, { key, rev: null, body: null, toasted: [], ...(mine ?? {}), polledAt: t })
  const path = mine && mine.rev !== null && mine.body !== null ? `/challenges?rev=${mine.rev}` : '/challenges'
  let r = await api($, 'GET', path, undefined, { keepNote: true })
  // A press's read that W6a's limit refused (1 a second: two presses close together) goes again
  // once the second is up, so a card just declined doesn't stay drawn for a backoff.
  if (forced && r.status === 429 && isCurrent()) {
    await waitMs($, pacedWaitMs(r))
    if (isCurrent()) r = await api($, 'GET', path, undefined, { keepNote: true })
  }
  // A late answer to a request the loop gave up on changes nothing, and neither does one for the
  // handle or server this install held when it asked (a switch since: that one's read follows).
  if (!isCurrent() || (await configKey($)) !== key) return r
  if (r.status === 403 && errorOf(r.json)?.code === 'challenges_off') {
    // The held config says on and the server says off: config is stale.
    void refreshConfig($, 'bucket').catch(() => null)
    return r
  }
  if (r.status !== 200) return r
  const inbox = readInbox(r.json)
  if (!inbox) return r
  const now2 = await storeGet<ChallengeBox | null>($, K.challenges, null)
  const base: ChallengeBox = now2 && now2.key === key ? now2 : { key, polledAt: t, rev: null, body: null, toasted: [] }
  const next: ChallengeBox = inbox.unchanged && base.body !== null ? { ...base, polledAt: t } : inbox.unchanged ? base : { ...base, polledAt: t, rev: inbox.rev, body: r.json }
  await save($, K.challenges, next)
  await takeInbox($, next)
  return r
}

/**
 * The inbox from a stored answer, into this session: the box (`challengeUi`, no messages), the
 * messages (`challengeMessages`), the toasts for incoming challenges not yet toasted on this
 * machine, and the sender's ready check for one of theirs that was just taken.
 */
async function takeInbox($: $, box: ChallengeBox) {
  // Only the account this install holds now ever draws: a box filled for another empties first.
  const key = await configKey($)
  if (box.key !== key) return
  if (challengeKey !== key) {
    if (challengeKey !== null) await clearChallenges($)
    challengeKey = key
  }
  const inbox = readInbox(box.body)
  if (!inbox || inbox.unchanged) return
  const incoming = inbox.incoming.map(x => x.challenge)
  const outgoing = inbox.outgoing.map(x => x.challenge)
  const code = (await read($, challengeUi)).code
  const wordsMoved = keepMessages([...inbox.incoming, ...inbox.outgoing], code?.code ?? null)
  const ui = await read($, challengeUi)
  if (wordsMoved || JSON.stringify(ui.incoming) !== JSON.stringify(incoming) || JSON.stringify(ui.outgoing) !== JSON.stringify(outgoing)) {
    await update($, challengeUi, u => ({ ...u, rev: u.rev + 1, incoming, outgoing, muteAsk: incoming.some(x => x.id === u.muteAsk) ? u.muteAsk : null, reportAsk: incoming.some(x => x.id === u.reportAsk) ? u.reportAsk : null }))
  }
  await toastIncoming($, box.key, incoming)
  await followTaken($, outgoing)
}

/**
 * The messages to draw, by code: the ones these reads carry (and the code box's, which a lookup
 * keeps); every other is dropped. True when any changed, so the box redraws.
 */
function keepMessages(reads: readonly ChallengeRead[], codeId: string | null) {
  const next = new Map<string, string>()
  for (const x of reads) if (x.message !== null) next.set(x.challenge.id, x.message)
  if (codeId !== null && challengeMessages.has(codeId) && !next.has(codeId)) next.set(codeId, challengeMessages.get(codeId)!)
  const moved = next.size !== challengeMessages.size || [...next].some(([id, m]) => challengeMessages.get(id) !== m)
  if (moved) {
    challengeMessages.clear()
    for (const [id, m] of next) challengeMessages.set(id, m)
  }
  return moved
}

/** One toast per incoming challenge, per machine: the store says which were toasted, read again right before it's written. Never a message in it. */
async function toastIncoming($: $, key: string, incoming: readonly Challenge[]) {
  const box = await storeGet<ChallengeBox | null>($, K.challenges, null)
  if (!box || box.key !== key) return
  const todo = incoming.filter(c => c.status === 'pending' && !box.toasted.includes(c.id))
  if (todo.length === 0) return
  await save($, K.challenges, { ...box, toasted: [...box.toasted, ...todo.map(c => c.id)].slice(-60) })
  for (const c of todo.slice(0, 3)) await ambient($, CHALLENGE.toastIncoming(c.from.handle, c.label), 'match', 8000)
}

/**
 * One of yours was just taken (`accepted`, its match `offered`) while you're between matches: the
 * ranked loop reads GET /queue once, which brings the ready check, its toast and its chime as for
 * ranked. Never awaited from the inbox's tick: the ranked loop has its own single flight.
 */
async function followTaken($: $, outgoing: readonly Challenge[]) {
  if (!outgoing.some(c => c.status === 'accepted' && c.match?.status === 'offered')) return
  const phase = (await rankedShared($)).phase
  if (phase !== 'idle' && phase !== 'done') return
  lanesOnce = true
  void pollRankedNow($).catch(err => $.ui.log(`CCSR challenges: ${(err as Error).message}`))
}

/** The challenge the band offers between matches: the newest one to you still pending and in time, while challenges are on here. */
async function bandChallenge($: $) {
  if (!(await boxIsMine($))) return null
  const t = (await read($, now)) || (await $.clock.now())
  return ((await read($, challengeUi)).incoming ?? []).find(x => x.status === 'pending' && x.expiresAt > t) ?? null
}

/** Challenges are on here and the box holds nothing of another account's (a switch the config tick hasn't caught up with yet draws nothing). */
async function boxIsMine($: $) {
  if (!(await challengesLive($))) return false
  return challengeKey === null || challengeKey === (await configKey($))
}

/**
 * Challenges went off here (config, a sign-out, the switch), or the box was filled for another
 * handle or server: the box empties and every message held goes, and so does the store's copy of
 * an inbox this install can't read now (other players' words, which the server itself keeps a
 * week at most after a challenge ends).
 */
async function clearChallenges($: $) {
  challengeMessages.clear()
  challengeDraft = ''
  challengeKey = null
  const ui = await read($, challengeUi)
  if (ui.incoming !== null || ui.outgoing !== null || ui.form || ui.code || ui.note || ui.muteAsk || ui.reportAsk) await update($, challengeUi, u => ({ ...CHALLENGE_UI0, rev: u.rev + 1 }))
  const kept = await storeGet<ChallengeBox | null>($, K.challenges, null)
  if (kept && (kept.key !== (await configKey($)) || !(await challengesLive($)))) await $.store.delete(K.challenges)
}

/**
 * After every config read (boot registers it, never awaited), a sign-in or sign-out, and the
 * Challenges switch: the inbox loop runs while challenges are on here, read at once when it
 * starts (a fresh copy another session kept counts as that read, unless `fresh`: the switch
 * coming back on, when what the copy says may have changed meanwhile), and stops (the box
 * emptied) when they go off. A box filled for another handle or server empties at once, and this
 * one's inbox is read from the server. GET /me's switch waiting on config is adopted first.
 */
async function challengesTick($: $, fresh = false) {
  await adoptHeard($)
  if (await challengesLive($)) {
    const key = await configKey($)
    const moved = challengeKey !== null && challengeKey !== key
    if (moved) {
      await clearChallenges($)
      // Redrawn even when it held nothing: the box was hidden while its key was another's.
      await update($, challengeUi, u => ({ ...u, rev: u.rev + 1 }))
    }
    challengeKey = key
    if (stopInboxPoll && loops.has('inbox') && !moved) return
    if (fresh || moved) inboxForce = true
    startInboxPoll($)
    await kickLoop($, 'inbox')
    return
  }
  stopInboxPolling()
  await clearChallenges($)
}

/** The box's note: what a press did, or the server's line for why not. */
async function challengeNote($: $, text: string) {
  await update($, challengeUi, u => ({ ...u, note: text }))
}

/** A refused challenge request: the server's line in the box's note; config read again when it says config is stale. */
async function challengeRefused($: $, r: { status: number; json: unknown }) {
  if (r.status === 426) await refusedForUpdate($, r)
  const code = errorOf(r.json)?.code
  if (code === 'verification_required' || code === 'bucket_not_found' || code === 'challenges_off' || code === 'challenges_paused' || code === 'ranked_paused') void refreshConfig($, 'bucket').catch(() => null)
  await challengeNote($, failLine(r))
}

/**
 * The buckets a challenge can be sent in (the ones the player can queue: W3a's `can_queue`, so a
 * bucket whose checklist isn't met isn't offered), the form's bucket (its pick, else the Match
 * tab's, else Open), the lengths that bucket offers (W3b's `lengthsFor`: config's, less any the
 * lanes say the server no longer offers this player, which POST /challenges would refuse with
 * 422 length_unavailable), and the length picked: the form's when offered, else the one nearest
 * it (1h when none was asked).
 */
function challengePick(cf: ModConfig, l: LinkState, sh: RankedShared, form: NonNullable<ChallengeUi['form']>) {
  const usable = bucketsOf(cf).filter(b => b.canQueue)
  const b = pickBucket(usable, form.bucket ?? sh.bucket)
  const lanes = lanesIn(l, b?.id ?? null)
  const lengths = lengthsFor(b, null, lanes ? lanes.map(x => x.length_min) : null)
  const want = form.lengthMin ?? 60
  const lengthMin = lengths.includes(want) ? want : lengths.reduce<number | null>((best, m) => (best === null || Math.abs(m - want) < Math.abs(best - want) ? m : best), null)
  return { usable, bucket: b?.id ?? null, lengths, lanes, lengthMin }
}

/** The box sits between matches: while queued, in a ready check or in a match it isn't drawn, so nothing in it can open. */
function boxHidden(sh: Pick<RankedShared, 'phase'>) {
  return sh.phase === 'queued' || sh.phase === 'offered' || sh.phase === 'live'
}

/**
 * Fills the challenge form, for `handle` (or one to type) at `lengthMin` (or the length offered
 * nearest it). A finished match on screen is put away first, since the form sits between
 * matches. False, and nothing changed, while challenges aren't on here, sending is paused for
 * this player or ranked is (W6a refuses both), or the box isn't drawn (queued, a ready check, a
 * match).
 */
async function fillChallengeForm($: $, handle?: string | null, lengthMin?: number | null) {
  const cf = await configOf($)
  const c = challengesOf(cf)
  if (!c.send || cf.practiceOnly || !(await challengesLive($))) return false
  const sh = await rankedShared($)
  if (boxHidden(sh)) return false
  const h = typeof handle === 'string' && /^[a-z0-9_]{2,20}$/.test(handle) ? handle : ''
  const m = typeof lengthMin === 'number' && Number.isInteger(lengthMin) ? lengthMin : null
  if (sh.phase === 'done') await clearRanked($)
  challengeDraft = ''
  const form: NonNullable<ChallengeUi['form']> = { kind: 'handle', handle: h, lengthMin: m, bucket: null }
  await update($, challengeUi, u => ({ ...u, form, code: null, note: '' }))
  return true
}

/**
 * Opens the challenge form on the Match tab (fillChallengeForm, then the pane): the Rematch
 * button, and W4b's `challenge` action (`{ do: 'challenge', handle?, length_min? }`). True once
 * the form is on screen. False when nothing opened: challenges off here, sending or ranked paused,
 * queued, in a ready check or in a match (the form waits for none of these), or a pane the engine
 * keeps waiting (the form shows once it's placed).
 */
export async function openChallengeForm($: $, handle?: string | null, lengthMin?: number | null) {
  if (!(await fillChallengeForm($, handle, lengthMin))) return false
  return (await openPane($, 'match')).isPlaced
}

/** The form's Challenge a handle and Open challenge buttons: a fresh form of that kind. */
async function startChallengeForm($: $, kind: 'handle' | 'open') {
  challengeDraft = ''
  await update($, challengeUi, u => ({ ...u, form: { kind, handle: '', lengthMin: null, bucket: null }, code: null, note: '' }))
}

/** A pick in the form (the handle typed, a length, a bucket), or null to close it. */
async function pickChallenge($: $, patch: { handle?: string; lengthMin?: number; bucket?: string } | null) {
  if (patch === null) challengeDraft = ''
  await update($, challengeUi, u => (patch === null ? { ...u, form: null, note: '' } : u.form ? { ...u, form: { ...u.form, ...patch } } : u))
}

/**
 * Sends the form's challenge: to its handle, or open, at its length and in its bucket, with the
 * message typed (checked as the server will: refused, never cut). A refusal's line lands in the
 * note; once sent the form closes and the inbox is read again.
 */
async function sendChallenge($: $) {
  const ui = await read($, challengeUi)
  const form = ui.form
  if (!form || !(await challengesLive($))) return
  const cf = await configOf($)
  const c = challengesOf(cf)
  if (!c.send || (form.kind === 'open' && !c.open)) return
  const handle = form.kind === 'handle' ? form.handle.trim().toLowerCase() : null
  if (handle !== null) {
    if (!handle) return challengeNote($, CHALLENGE.pickHandle)
    const bad = handleProblem(handle)
    if (bad) return challengeNote($, bad)
  }
  const pick = challengePick(cf, await read($, link), await rankedShared($), form)
  if (pick.lengthMin === null) return challengeNote($, CHALLENGE.noLength)
  const msg = messageOut(challengeDraft, c)
  if ('problem' in msg) return challengeNote($, msg.problem === 'off' ? CHALLENGE.messageOff : CHALLENGE.messageLong(c.message_max))
  const body: Record<string, unknown> = { length_min: pick.lengthMin }
  if (handle !== null) body.to = handle
  if (pick.bucket !== null) body.bucket = pick.bucket
  if (msg.message !== null) body.message = msg.message
  const r = await api($, 'POST', '/challenges', body)
  if (r.status !== 201) return challengeRefused($, r)
  const made = readChallenge((r.json as { challenge?: unknown } | null)?.challenge)
  challengeDraft = ''
  await update($, challengeUi, u => ({ ...u, form: null, note: made && made.challenge.to === null ? CHALLENGE.openSent : CHALLENGE.sent(made?.challenge.to?.handle ?? handle ?? '') }))
  await pollInboxNow($)
}

/**
 * Takes a challenge: from its card, the band or the code box (`via`, for the server's numbers).
 * The taker's Accept is their ready: the answer carries the offer, so the ready check (waiting on
 * the sender) shows at once, and the ranked loop follows it to the match. A refusal's line lands
 * in the note, and the inbox is read again, since the challenge may have closed. From the band,
 * where the note isn't drawn, the line is also a toast (a press's reply, so it always shows).
 */
async function takeChallenge($: $, id: string, via: 'card' | 'band' | 'code') {
  if (!CODE.test(id) || !(await challengesLive($))) return
  const phase = (await rankedShared($)).phase
  if (phase === 'offered' || phase === 'live') return
  await syncHandle($, SYNC_HANDLE_MS)
  const r = await paced($, 'POST', `/challenges/${id}/accept`, { via })
  const offer = r.status === 200 ? (r.json as { offer?: ApiOffer } | null)?.offer : undefined
  if (!offer || typeof offer.match_id !== 'string') {
    if (r.status === 200) await pollRankedNow($)
    else {
      await challengeRefused($, r)
      if (via === 'band') $.ui.toast(failLine(r), { timeoutMs: 8000 })
    }
    return pollInboxNow($)
  }
  const bucket = bucketIdOf(offer.bucket)
  await setRanked($, { phase: 'offered', matchId: offer.match_id, ...(bucket ? { bucket } : {}) })
  const queue: ApiQueueState = { status: 'offered', offer, wait_ms: null, range: null, widening: null, cancelled: null, ...(bucket ? { bucket } : {}) }
  await update($, link, l => ({ ...l, queue }))
  await update($, challengeUi, u => ({ ...u, note: '', code: null, form: null, muteAsk: null, reportAsk: null }))
  await refreshStatus($)
  await pollRankedNow($)
}

/** Declines a challenge to you, or withdraws one of yours (the server tells them apart), then reads the inbox again. */
async function dropChallenge($: $, id: string) {
  if (!CODE.test(id) || !(await challengesLive($))) return
  const r = await paced($, 'POST', `/challenges/${id}/decline`)
  if (r.status >= 200 && r.status < 300) await update($, challengeUi, u => ({ ...u, note: '', muteAsk: null, reportAsk: null }))
  else await challengeNote($, failLine(r))
  await pollInboxNow($)
}

/** Report on a card: the first press asks why (Spam, Abuse, Other), null puts the question away. */
async function askReport($: $, id: string | null) {
  await update($, challengeUi, u => ({ ...u, reportAsk: id, muteAsk: null }))
}

/** Reports a challenge to you (which also declines it, on the server), then reads the inbox again. */
async function reportOne($: $, id: string, reason: 'spam' | 'abuse' | 'other') {
  if (!CODE.test(id) || !(await challengesLive($))) return
  const r = await api($, 'POST', `/challenges/${id}/report`, { reason })
  await update($, challengeUi, u => ({ ...u, reportAsk: null, note: r.status >= 200 && r.status < 300 ? CHALLENGE.reported : failLine(r) }))
  await pollInboxNow($)
}

/** Mute on a card: the first press says what it does, the second mutes the sender (their challenges and chat stop showing), then the inbox is read again. */
async function muteSender($: $, id: string) {
  const ui = await read($, challengeUi)
  const c = (ui.incoming ?? []).find(x => x.id === id)
  if (!c || !(await challengesLive($))) return
  if (ui.muteAsk !== id) return update($, challengeUi, u => ({ ...u, muteAsk: id, reportAsk: null, note: CHALLENGE.muteAsk(c.from.handle) }))
  const r = await api($, 'POST', `/players/${encodeURIComponent(c.from.handle)}/mute`)
  await update($, challengeUi, u => ({ ...u, muteAsk: null, note: r.status >= 200 && r.status < 300 ? CHALLENGE.muted(c.from.handle) : failLine(r) }))
  await pollInboxNow($)
}

/**
 * A code or its link typed into the code box, or given to `/ccsr challenge`: read as the server
 * writes codes (challengeCode: a code in any case, or its ccsr.gg link, else nothing), then
 * GET /challenges/:code, whose answer draws below the box with Accept when it can be taken.
 */
async function lookUpCode($: $, input: string) {
  if (!(await challengesLive($))) return
  const code = challengeCode(input)
  if (!code) return update($, challengeUi, u => ({ ...u, code: null, note: CHALLENGE.notACode }))
  await update($, challengeUi, u => ({ ...u, code: { code, challenge: null, problem: '' }, form: null, note: '' }))
  const r = await api($, 'GET', `/challenges/${code}`)
  const got = r.status === 200 ? readChallenge((r.json as { challenge?: unknown } | null)?.challenge) : null
  if (got?.message) challengeMessages.set(code, got.message)
  else challengeMessages.delete(code)
  const problem = got ? '' : r.status === 200 ? CHALLENGE.notACode : failLine(r)
  await update($, challengeUi, u => (u.code?.code === code ? { ...u, rev: u.rev + 1, code: { code, challenge: got?.challenge ?? null, problem } } : u))
}

/** Puts the code box's challenge away (its message too, unless the inbox holds the same challenge). */
async function closeCode($: $) {
  const ui = await read($, challengeUi)
  const code = ui.code?.code
  if (code && ![...(ui.incoming ?? []), ...(ui.outgoing ?? [])].some(x => x.id === code)) challengeMessages.delete(code)
  await update($, challengeUi, u => ({ ...u, code: null, rev: u.rev + 1 }))
}

/** Copy link on one of yours: its ccsr.gg page, which installs the mod and takes it (W6c). */
async function copyChallengeLink($: $, id: string, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const href = challengeHref(id)
  if (!href) return
  const c = await $.ui.copy({ text: href, surface }).catch(() => ({ isCopied: false }))
  await challengeNote($, c.isCopied ? CHALLENGE.copied : href)
}

/**
 * The Challenges switch, to the server (`PATCH /me { challenges_enabled }`), only while config has
 * challenges on, for a press on this machine the server hasn't confirmed (K.challengesPress). Off:
 * the server declines what's waiting and turns new ones away, and the mod withdraws the player's
 * own pending ones first, paced under W6a's limits. Until the server has the switch and none of
 * theirs is left open, the press stays unconfirmed and each config tick sends it again; a press
 * (`pressed`) that leaves any open says so in a toast. One at a time in a session, in order, so
 * Off then On fast lands as On.
 */
async function tellChallenges($: $, pressed = false) {
  const run = challengesTelling.then(() => Promise.race([tellChallengesOnce($, pressed), waitMs($, 60_000)]))
  // A request that never answers ($.http.fetch has no timeout) holds the next press a minute at most.
  challengesTelling = run.catch(() => undefined)
  return run
}

async function tellChallengesOnce($: $, pressed: boolean) {
  const cfg = await serverCfg($)
  if (!cfg.token || !challengesOf(await configOf($, cfg)).on) return
  const press = await storeGet<ChallengesPress | null>($, K.challengesPress, null)
  if (!press || press.key !== keyOf(cfg) || press.told !== null) return
  const left = press.on ? 0 : await withdrawOutgoing($)
  const r = await api($, 'PATCH', '/me', { challenges_enabled: press.on })
  // Not reached, or limited: the next config tick sends it again.
  if (retryable(r.status)) return
  if (r.status === 200) await update($, link, l => ({ ...l, me: (r.json as { player: ApiPlayer }).player }))
  // Some of yours still open (the server already turns new ones away): withdrawn again on the next config tick.
  if (r.status === 200 && left !== 0) {
    if (pressed) $.ui.toast(CHALLENGE.withdrawLeft, { timeoutMs: 8000 })
    return
  }
  // Told, or refused for good (GET /me's value then wins). A press made meanwhile stays to be told.
  const cur = await storeGet<ChallengesPress | null>($, K.challengesPress, null)
  if (cur && cur.key === press.key && cur.at === press.at) await save($, K.challengesPress, { ...cur, told: await $.clock.now() })
}

/**
 * Every pending challenge of yours, withdrawn (the Challenges switch going off): at most the five
 * the server lets you have out, each request paced under W6a's limits (one inbox read a second,
 * two declines). How many are still out: 0 when every one went (one taken, withdrawn or ended
 * meanwhile is closed, not out), null when the inbox couldn't be read.
 */
async function withdrawOutgoing($: $): Promise<number | null> {
  const r = await paced($, 'GET', '/challenges')
  const inbox = r.status === 200 ? readInbox(r.json) : null
  if (!inbox || inbox.unchanged) return null
  let left = 0
  for (const x of inbox.outgoing) {
    if (x.challenge.status !== 'pending') continue
    const d = await paced($, 'POST', `/challenges/${x.challenge.id}/decline`)
    if (!(d.status >= 200 && d.status < 300) && !(d.status === 409 && errorOf(d.json)?.code === 'challenge_closed')) left++
  }
  return left
}

/**
 * GET /me answered (`askedAt`: when it was asked): its `challenges_enabled`, the account's own
 * switch, becomes this install's (adoptHeard), so challenges turned off on one machine show off
 * on the others too.
 */
async function heardChallenges($: $, player: unknown, askedAt: number) {
  const on = (player as { challenges_enabled?: unknown } | null)?.challenges_enabled
  if (typeof on !== 'boolean') return
  challengesHeard = { key: await configKey($), on, at: askedAt }
  await adoptHeard($)
}

/**
 * The switch GET /me last said, into the local Challenges switch, once config has challenges on
 * for this player (dark, nothing about challenges changes; until then it waits). Never over a
 * press on this machine the server hasn't confirmed, nor from a read asked before the last press
 * here was confirmed. The inbox then starts (read afresh) or stops with it.
 */
async function adoptHeard($: $) {
  const heard = challengesHeard
  if (!heard) return
  const cfg = await serverCfg($)
  if (heard.key !== keyOf(cfg)) {
    challengesHeard = null
    return
  }
  if (!cfg.token || !challengesOf(await configOf($, cfg)).on) return
  challengesHeard = null
  const press = await storeGet<ChallengesPress | null>($, K.challengesPress, null)
  if (press && press.key === heard.key && (press.told === null || heard.at < press.told)) return
  if (((await read($, settings)).surfaces.challenges !== 'off') === heard.on) return
  await saveSettings($, { surfaces: { challenges: heard.on ? 'on' : 'off' } })
  await challengesTick($, true)
}

// ------------------------------------------------------------------ notices (W4b)
// The server's notices (config's `notices`, and a live match's feed), drawn by the fixed
// vocabulary in mod/hooks/notices.ts, which makes every decision: what parses, where each may
// draw under the player's switches and the Notices setting, caps, triggers, the critical
// fallback to the Match tab, claims across sessions and the stats. This file draws the slots
// (the top of each tab, the queue and result screens, the band, the World room, a live match's
// feed), shows the toasts and status flashes, fires the 12 triggers, keeps the ledgers in the
// store, runs each button (runAction) and posts the counts.
//
// Notice text is server text: it draws in the pane, the band, a toast or the status line, never
// in a command reply, $.prompt or $.session.append, so it never reaches Claude. Titles and lines
// draw as Text; only a card's body draws through Markdown, which notices.ts has held to bold,
// italics, code and canonical https links on ccsr.gg and github.com.

/** This session's ledger: showings, cards drawn, dismissals, snoozes, notices a button opened. */
let noticeSession: SessionLedger = SESSION0
/**
 * The moments this session saw that fire triggers, with when, and when the arming each one
 * stands for began (`start`: the moment itself, or for update_available its release's first
 * naming, releaseArmed). Armed notices are worked out from these each time (armedNow), so a
 * notice config brings after the moment is armed by it too. Kept an hour (the longest for_s).
 */
let noticeMoments: { e: NoticeEvent; at: number; start: number }[] = []
/**
 * update_available's arming in this session (notices.ts's releaseArming): the newest release
 * named above this mod and when it was first named. However far apart the answers naming it
 * come, it stays one arming; only a newer release begins another.
 */
let releaseArmed: ReleaseArming | null = null
/** Each queue this session saw, by its `since`: when it was last seen queued and for which lengths (the queued trigger). */
const queuedSeen = new Map<number, { at: number; lengthsMin: number[] }>()
let noticeToastAt = 0
/** A notice's status flash: its text on the full and the short line, until when. */
let noticeFlash: { full: string; short: string; until: number } | null = null
/** The notice a `{ do: 'notice' }` button opened last, and where: it takes that slot ahead of the rest until it's closed. */
let noticeOpened: { id: string; place: Place } | null = null
/** Where this session started drawing, for a toast's or a flash's surfaces before the pane draws. */
let sessionSurface: string | null = null
/** When the pane last drew, for pane_open (a draw after PANE_GAP_MS without one). Boot takes it from `paneAt`, so a reload isn't the pane opening. */
let paneDrawnAt = 0
const PANE_GAP_MS = 60_000
/** A draw kept a pane_open moment: paneTick does the rest, since a draw may write no state and start no timer that may. */
let paneOpened = false
/** What `paneAt` was last written as. */
let paneKeptAt = 0
/** The boot's tick for what a draw may not do. */
const PANE_TICK_MS = 1000
/** `paneAt` is written when the pane has drawn this much later than it says. */
const PANE_KEEP_MS = 10_000
/** Config's notices, parsed once per config read: the list, and the read it came from. */
let noticesMemo: { key: string; list: Notice[] } = { key: '', list: [] }
/** Every store write the notices make runs in order, each on a fresh read (another session may have written meanwhile). */
let noticeWrites: Promise<unknown> = Promise.resolve()
let noticeAlerting = false
let noticeAlertAgain = false
let noticeStatsFlushing = false
let noticeTicking = false
/** Moments that stand for a state rather than an instant: one a minute is enough to keep them armed. */
const STATE_MOMENTS: readonly NoticeEvent['on'][] = ['update_available']
/** The Match tab's slots: a queue press made there needs no other screen. */
const MATCH_PLACES: readonly Place[] = ['match', 'queue', 'result']

/** Config's notices, parsed once per config read (a new read, a server or handle change, practice only moving). */
async function noticesNow($: $): Promise<Notice[]> {
  const cf = await configOf($)
  const held = cf as Partial<ConfigState>
  const key = `${held.key ?? ''}|${cf.version}|${held.readAt ?? 0}|${cf.practiceOnly}`
  if (noticesMemo.key !== key) noticesMemo = { key, list: noticesOf(cf) }
  return noticesMemo.list
}

/**
 * The armed notices now: every moment this session saw, replayed over `list` (armFor never
 * shortens an arming), and when each one's arming began (`armedAt`, for alertDue's once per
 * arming): the moment, a state's start, or for the queued trigger the queue's crossing of its
 * after_s (each read of the queue re-arms it; it stays one arming per queue).
 */
function armedNow(list: readonly Notice[]): { armed: Record<string, number>; armedAt: Record<string, number> } {
  let armed: Record<string, number> = {}
  const armedAt: Record<string, number> = {}
  for (const m of noticeMoments) {
    const r = armFor(list, m.e, armed, m.at)
    armed = r.armed
    for (const n of r.hit) armedAt[n.id] = Math.max(armedAt[n.id] ?? 0, m.start)
  }
  for (const [since, q] of queuedSeen) {
    const r = armFor(list, { on: 'queued', queuedS: Math.max(0, Math.floor((q.at - since) / 1000)), lengthsMin: q.lengthsMin }, armed, q.at)
    armed = r.armed
    for (const n of r.hit) armedAt[n.id] = Math.max(armedAt[n.id] ?? 0, since + (n.trigger?.on === 'queued' ? n.trigger.afterS * 1000 : 0))
  }
  return { armed, armedAt }
}

/** The queue as seen now: how long it has waited, for which lengths. The four newest queues are kept. */
function noteQueued(sh: RankedShared, at: number) {
  queuedSeen.set(sh.since, { at, lengthsMin: [...sh.queuedMin] })
  for (const since of [...queuedSeen.keys()].slice(0, Math.max(0, queuedSeen.size - 4))) queuedSeen.delete(since)
}

/** What the picker needs about this moment, this session and the player's switches, for a draw on `surface`. */
async function noticeView($: $, surface: string | null): Promise<NoticeView> {
  await read($, noticeRev)
  const t = await $.clock.now()
  const skewMs = configSkewMs()
  const sw = (await read($, settings)).surfaces
  const cf = await configOf($)
  const sh = await rankedShared($)
  if (sh.phase === 'queued' && sh.since > 0) noteQueued(sh, t)
  const { armed, armedAt } = armedNow(await noticesNow($))
  return {
    now: t,
    skewMs,
    day: dayKey(t + skewMs),
    surface,
    setting: sw.notices,
    switches: { toasts: sw.toasts, status: sw.status, band: sw.band, bandMatch: sw.bandMatch, chat: sw.chat },
    chatWorld: cf.chat.world,
    phase: sh.phase,
    armed,
    armedAt,
    ledger: ledgerOf(await storeGet<unknown>($, K.noticeCaps, {})),
    session: noticeSession,
    lastToastAt: noticeToastAt,
  }
}

/**
 * Keeps a moment that fires notice triggers, with its time and when its arming began (`start`,
 * the moment itself unless the caller names one): false for a state moment (STATE_MOMENTS) of
 * the same arming kept in the last minute, which still arms what it armed. A module variable
 * only, so a render may call it (renderPane's pane_open), and the slots drawn after it see it.
 */
function recordMoment(e: NoticeEvent, at: number, start = at) {
  const same = STATE_MOMENTS.includes(e.on) ? noticeMoments.find(m => m.e.on === e.on) : undefined
  if (same && same.start === start && at - same.at < 60_000) return false
  noticeMoments = [...noticeMoments.filter(m => m !== same && at - m.at < 3_600_000), { e, at, start }].slice(-50)
  return true
}

/**
 * After a moment: what draws notices draws again (noticeRev), then the toast and flash check.
 * Never from a draw: a state write is refused while a render hook draws, and to the host a timer a
 * draw starts is still that draw, however long it waits (on a live host the retries of 0.5.x's
 * writeAfterDraw were all refused, and the pane said "state.set: denied"). The pane's pane_open
 * goes through paneTick instead. A failed write is logged and the check runs anyway.
 */
async function noticesMoved($: $) {
  await update($, noticeRev, n => n + 1).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  await noticeAlerts($)
}

/**
 * Once a second, from a timer the boot set (an event of its own, so it may write state): what a
 * draw of the pane left to do. A pane_open moment the draw kept gets its redraw and its toast and
 * flash check, within the second; and `paneAt` follows the pane's last draw, so the next load of
 * this module knows the pane was already up.
 */
async function paneTick($: $) {
  if (paneOpened) {
    paneOpened = false
    await noticesMoved($)
  }
  if (paneSeenAt - paneKeptAt >= PANE_KEEP_MS) {
    paneKeptAt = paneSeenAt
    await update($, paneAt, () => paneSeenAt)
  }
}

/**
 * A moment that fires notice triggers: session_start, match_found, match_start, result, tier,
 * placed, first_score, score, update_available, back_online (pane_open is renderPane's, queued
 * is read off the queue itself, in noticeView). It arms the notices whose trigger it hits, the
 * slots draw again, and the toast and flash check runs now. `start`: when its arming began, for
 * a moment that continues one (update_available's release); the moment itself otherwise.
 */
async function noticeEvent($: $, e: NoticeEvent, start?: number) {
  const at = await $.clock.now()
  if (recordMoment(e, at, start ?? at)) await noticesMoved($)
}

/**
 * The toast and the status flash due now, if any: one toast at a time, at least 8 s apart (pickToast),
 * and one flash, each claimed across the sessions on this store first, so open sessions show one.
 * Each fires once per arming, or once a session with no trigger (alertDue): the pick is spent
 * whether this session shows it or another session's claim says it just showed there.
 * A call made while one runs runs again after it.
 */
async function noticeAlerts($: $): Promise<void> {
  if (noticeAlerting) {
    noticeAlertAgain = true
    return
  }
  noticeAlerting = true
  try {
    do {
      noticeAlertAgain = false
      const list = await noticesNow($)
      if (list.length === 0) break
      const v = await noticeView($, paneSurface ?? sessionSurface)
      const toast = pickToast(list, v)
      const toastLine = toast ? toastText(toast, v.now, v.skewMs) : null
      if (toast && toastLine) {
        noticeSession = noteAlerted(noticeSession, toast, v)
        if (await claimNotice($, `toast:${toast.id}`, v.now)) {
          $.ui.toast(toastLine, { timeoutMs: FLASH_MS })
          noticeToastAt = v.now
          await countShown($, toast, v)
        }
      }
      const flash = noticeFlash && v.now < noticeFlash.until ? null : pickFlash(list, v)
      if (flash) {
        noticeSession = noteAlerted(noticeSession, flash, v)
        if (await claimNotice($, `status:${flash.id}`, v.now)) await startFlash($, flash, v)
      }
    } while (noticeAlertAgain)
  } finally {
    noticeAlerting = false
  }
}

/** A status flash for FLASH_MS: the status line shows it (statusLine), then goes back. */
async function startFlash($: $, n: Notice, v: NoticeView) {
  const full = flashText(n, false, v.now, v.skewMs)
  const short = flashText(n, true, v.now, v.skewMs)
  if (full === null || short === null) return
  noticeFlash = { full, short, until: v.now + FLASH_MS }
  await countShown($, n, v)
  await refreshStatus($)
  $.clock.after(FLASH_MS + 50, () => void refreshStatus($))
}

/** A toast or a flash went up: one showing, here and in the store, and in the counts. */
async function countShown($: $, n: Notice, v: NoticeView) {
  noticeSession = noteShown({}, noticeSession, n, v).session
  await noticeWrite($, () => storeNoticeShown($, n, v))
}

/** A card, banner or line drew: its first draw this session is its showing, counted in the store after the draw. */
function noticeDrawn($: $, n: Notice, v: NoticeView) {
  const r = noteDrawn({}, noticeSession, n, v)
  if (!r.counted) return
  noticeSession = r.session
  void noticeWrite($, () => storeNoticeShown($, n, v)).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
}

async function storeNoticeShown($: $, n: Notice, v: Pick<NoticeView, 'now' | 'day'>) {
  if (n.preview) return
  await changeLedger($, l => noteShown(l, SESSION0, n, v).ledger)
  await changeStats($, s => bumpStats(s, n, 'shown'))
}

/** Runs `f` after every notice store write already queued in this session. */
function noticeWrite<T>($: $, f: () => Promise<T>): Promise<T> {
  const run = noticeWrites.then(f)
  noticeWrites = run.catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  return run
}

async function changeLedger($: $, f: (l: CapLedger) => CapLedger) {
  const cur = ledgerOf(await storeGet<unknown>($, K.noticeCaps, {}))
  const next = f(cur)
  if (next !== cur) await save($, K.noticeCaps, next)
}

async function changeStats($: $, f: (s: NoticeStats) => NoticeStats) {
  const cur = statsOf(await storeGet<unknown>($, K.noticeStats, {}))
  const next = f(cur)
  if (next !== cur) await save($, K.noticeStats, next)
}

/** Claims showing `key` once across the sessions on this store: true when this session won (claimFire). */
function claimNotice($: $, key: string, at: number, holdMs?: number): Promise<boolean> {
  return noticeWrite($, async () => {
    const r = claimFire(firedOf(await storeGet<unknown>($, K.noticeFired, {})), key, owner, at, holdMs)
    if (r.won) await save($, K.noticeFired, pruneFired(r.fired, at))
    return r.won
  })
}

/**
 * A live match's feed notices, after each events page that carries some: a toast, else a status
 * flash, by the Notices setting and the switches (feedAlert), once per match across the sessions
 * on this store (claimed for a day). Never while an offer is out.
 */
async function feedAlerts($: $, matchId: string) {
  const r = (await read($, link)).ranked
  if (!r || r.id !== matchId) return
  const list = feedNotices(r.notices, await configOf($))
  if (list.length === 0) return
  const v = await noticeView($, paneSurface ?? sessionSurface)
  for (const n of list) {
    const how = feedAlert(n, v)
    if (!how) continue
    const line = how === 'toast' ? toastText(n, v.now, v.skewMs) : null
    if (how === 'toast' && line === null) continue
    if (!(await claimNotice($, feedKey(matchId, n.id), v.now, FEED_HOLD_MS))) continue
    if (how === 'toast' && line !== null) {
      $.ui.toast(line, { timeoutMs: FLASH_MS })
      noticeToastAt = v.now
      await countShown($, n, v)
    } else await startFlash($, n, v)
  }
}

/** A finished match: the result moment, then placed, or tier up or down (matchEndEvents). Before GET /me is read again. */
async function noticeMatchEnd($: $, s: ApiMatchSummary, me: string) {
  const l = await read($, link)
  const { mine } = rankedSides(s, me)
  const outcome = s.status === 'void' ? 'void' : s.result === 'draw' ? 'draw' : s.winner === me ? 'win' : 'loss'
  // Placing after: the summary's ref is the player now. Placing before: GET /me's standing in the match's bucket, read before
  // the match ended; with none, a Mud tier before that isn't Mud after (placingOfSide's rule).
  const before = meIn(l, bucketIdOf(s.bucket) ?? OPEN)
  const placingAfter = !!mine.player.placement
  const placingBefore = placingAfter || (before ? !!before.placement : mine.tier_before === 'Mud' && !!mine.tier_after && mine.tier_after !== 'Mud')
  for (const e of matchEndEvents({ outcome, tierBefore: mine.tier_before, tierAfter: mine.tier_after, placingBefore, placingAfter })) await noticeEvent($, e)
}

/** A fresh commit scored: the score moment, and first_score when no other commit was ever scored on this config dir. */
async function noticeScored($: $, c: ScoredCommit) {
  if (!(await storeGet<boolean>($, K.noticeFirst, false))) {
    await save($, K.noticeFirst, true)
    const others = (await storeGet<ScoredCommit[]>($, K.ledger, [])).some(x => x.pid !== c.pid)
    if (!others) await noticeEvent($, { on: 'first_score' })
  }
  await noticeEvent($, { on: 'score', points: c.points })
}

/**
 * After every config read: the counts posted (when due, on the config timer and at boot only), the
 * ledger kept small, and any toast or flash the new notices bring. Never on a header, sign-in or
 * bucket re-read: a flag flip or a notice publish has every active mod re-read within 30 s, and a
 * post riding those would add a write per player to that herd.
 */
async function noticeConfigTick($: $, cfg: ModConfig, why: string) {
  if (why === 'timer' || why === 'boot') void flushNoticeStats($).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  const ids = noticesOf(cfg).map(n => n.id)
  const at = await $.clock.now()
  await noticeWrite($, async () => {
    await changeLedger($, l => (Object.keys(l).length === 0 ? l : pruneLedger(l, ids, at)))
    const fired = firedOf(await storeGet<unknown>($, K.noticeFired, {}))
    const kept = pruneFired(fired, at)
    if (Object.keys(kept).length !== Object.keys(fired).length) await save($, K.noticeFired, kept)
  })
  await update($, noticeRev, n => n + 1)
  await noticeAlerts($)
}

/**
 * The counts, posted: one session per store at a time (a 30 s lease), at most one post per 90 s from
 * the store (statsDue), ids and counts only (statsBatch). What the server took comes off; so does a
 * batch it refuses for good (any 4xx but 429), which a frozen mod could never fix and which would
 * otherwise block every later count. A 429, a 5xx or no answer keeps it for the next due tick, and
 * so does a post still unanswered when its lease runs out: $.http.fetch has no timeout, and one
 * that hangs (a half-open socket after a sleep) would otherwise hold this flush for the session.
 * Its late answer, if one comes, is dropped: the batch went again or goes with the next.
 */
async function flushNoticeStats($: $) {
  if (noticeStatsFlushing) return
  noticeStatsFlushing = true
  try {
    if (!(await serverCfg($)).token) return
    const t = await $.clock.now()
    const lease = takeLease(await storeGet<unknown>($, K.noticeLease, null), owner, t)
    if (!lease.won) return
    await save($, K.noticeLease, lease.lease)
    if (!statsDue(await storeGet<unknown>($, K.noticeSentAt, null), t)) return
    const batch = statsBatch(statsOf(await storeGet<unknown>($, K.noticeStats, {})))
    if (!batch) return
    await save($, K.noticeSentAt, t)
    const r = await Promise.race([api($, 'POST', '/notices/events', batch.body, { keepNote: true }), waitMs($, LEASE_MS).then(() => null)])
    if (!r) return
    const done = (r.status >= 200 && r.status < 300) || (r.status >= 400 && r.status < 500 && r.status !== 429)
    if (done) await noticeWrite($, () => changeStats($, s => statsAfterSend(s, batch.sent)))
  } finally {
    noticeStatsFlushing = false
  }
}

/**
 * Where a notice's buttons are judged (buttonsFor): the ranked phase, whether this install is
 * signed in, and whether W6b's challenge form can open (challenges live here, the Challenges
 * switch included, sending not paused, not practice only), so a Challenge button never draws dead.
 */
async function noticeButtonsAt($: $) {
  const cfg = await serverCfg($)
  const cf = await configOf($, cfg)
  return {
    phase: (await rankedShared($)).phase,
    signedIn: !!cfg.token && !(await read($, link)).unknownToken,
    challenges: challengesOf(cf).send && !cf.practiceOnly && (await challengesLive($)),
  }
}

/** The notice `id`, from config's notices or the live match's feed. */
async function noticeById($: $, source: 'config' | 'feed', id: string): Promise<Notice | null> {
  const list = source === 'feed' ? feedNotices((await read($, link)).ranked?.notices, await configOf($)) : await noticesNow($)
  return list.find(n => n.id === id) ?? null
}

/**
 * A notice's button pressed: its action, then counted as a press when it did something (but
 * Dismiss and Snooze, which are their own). A queue press that queued nothing, or a Challenge
 * whose form didn't open, isn't one: a notice that stops on a press would be gone for good after it.
 */
async function noticePress($: $, source: 'config' | 'feed', id: string, index: number, place: Place, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const n = await noticeById($, source, id)
  const act = n?.actions[index]
  if (!n || !act || act.hidden) return
  const did = await runAction($, n, act, place, surface)
  if (did && act.do !== 'dismiss' && act.do !== 'snooze') {
    const t = await $.clock.now()
    void noticeWrite($, async () => {
      if (n.preview) return
      await changeLedger($, l => noteClick(l, n, { now: t }))
      await changeStats($, s => bumpStats(s, n, 'clicked'))
    }).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  }
  await update($, noticeRev, x => x + 1)
}

/**
 * What a notice's button does: one case per action in the vocabulary (actions.ts parses them;
 * scripts/freeze-manifest.txt looks for each `case '<do>':` here, so none can be missing from
 * the launch mod). `open` and `install_app` draw as Links (noticeButtons), which the engine
 * opens itself, so their presses never reach the mod (https://ccsr.gg/go/<id> counts open's).
 * True when the press did something (noticePress counts only those).
 */
async function runAction($: $, n: Notice, a: Action, place: Place, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile'): Promise<boolean> {
  switch (a.do) {
    case 'open':
      // A Link to https://ccsr.gg/go/<id>: the engine opens it and the server counts it.
      return true
    case 'tab':
      // Every tab the vocabulary names, W10b's Finishers view included (selectTab reads GET /me/finishers as it opens).
      // actions.ts hides a Finishers button while config's `finishers` is off, so a press here means the view can draw.
      await selectTab($, a.tab)
      await $.ui.open({ id: PANE, title: 'CCSR' })
      return true
    case 'queue': {
      // W2b's queueWith, with W3b's bucket: a bucket not on screen becomes it between matches; false when nothing was queued.
      const queued = await queueWith($, { lengthsMin: a.lengthsMin, bucket: a.bucket })
      // The Match tab holds the queue and the note that says why nothing was queued: a press anywhere else opens it, but in
      // the band, which shows the queue itself and needs the Match tab only for a refusal.
      if (!MATCH_PLACES.includes(place) && (place !== 'band' || !queued)) await openPane($, 'match')
      return queued
    }
    case 'challenge': {
      // W6b's challenge form, for the handle and the length the notice names (either may be null). Its button draws only
      // while the form can open (noticeButtonsAt), so false is a race: the Match tab then, where the box or the match is.
      const opened = await openChallengeForm($, a.handle, a.lengthMin)
      if (!opened) await openPane($, 'match')
      return opened
    }
    case 'signin':
      // W5b's sign-in card, opened on the Match tab.
      await startSignIn($, a.provider, 'action')
      return true
    case 'install_app':
      // A Link to the GitHub App's install page, drawn only after installAppUrlOk (noticeButtons).
      return true
    case 'copy': {
      const c = await $.ui.copy({ text: a.text, surface }).catch(() => ({ isCopied: false }))
      // A reply to a press, so it shows whatever the toasts switch says: the words copied, or the text itself when the clipboard refused.
      $.ui.toast(c.isCopied ? NOTICE.copied : a.text, { timeoutMs: 6000 })
      return true
    }
    case 'update': {
      await updateMod($, surface)
      // What the update did, wherever it was pressed (Settings keeps the same line): updateMod toasts a finished
      // update itself, unless toasts are off; the copied command, or the command itself, it only notes.
      const said = (await read($, link)).updateNote
      const toasted = said === MOD.updated && (await read($, settings)).surfaces.toasts !== 'off'
      if (said && !toasted) $.ui.toast(said, { timeoutMs: 8000 })
      return true
    }
    case 'snooze': {
      const t = await $.clock.now()
      noticeSession = noteSnooze({}, noticeSession, n, { now: t }, a.min).session
      if (noticeOpened?.id === n.id) noticeOpened = null
      await noticeWrite($, () => changeLedger($, l => noteSnooze(l, SESSION0, n, { now: t }, a.min).ledger))
      return true
    }
    case 'dismiss':
      await dismissNotice($, n)
      return true
    case 'notice':
      // The notice it names, in this notice's place, past its caps and trigger, until it's dismissed or closed.
      noticeSession = openNotice(noticeSession, a.id, place)
      noticeOpened = { id: a.id, place }
      return true
    default: {
      const left: never = a
      return left
    }
  }
}

/** A notice dismissed (its own Dismiss, or a `{ do: 'dismiss' }` button): gone here now, and for its cap's period everywhere. */
async function dismissNotice($: $, n: Notice) {
  const t = await $.clock.now()
  const v = { now: t, day: dayKey(t + configSkewMs()) }
  noticeSession = noteDismiss({}, noticeSession, n, v).session
  if (noticeOpened?.id === n.id) noticeOpened = null
  await noticeWrite($, async () => {
    if (n.preview) return
    await changeLedger($, l => noteDismiss(l, SESSION0, n, v).ledger)
    await changeStats($, s => bumpStats(s, n, 'dismissed'))
  })
}

async function noticeDismissPress($: $, source: 'config' | 'feed', id: string) {
  const n = await noticeById($, source, id)
  if (!n?.dismissible) return
  await dismissNotice($, n)
  await update($, noticeRev, x => x + 1)
}

/** Close on a notice a button opened: its slot goes back to its own pick. Nothing is counted. */
async function noticeClose($: $, id: string) {
  const opened = { ...noticeSession.opened }
  delete opened[id]
  noticeSession = { ...noticeSession, opened }
  if (noticeOpened?.id === id) noticeOpened = null
  await update($, noticeRev, x => x + 1)
}

/**
 * A notice's buttons as drawn now (buttonsFor: not hidden by config, Queue only signed in and
 * between matches, queued or on the result, Challenge only signed in, between matches and while
 * W6b's form can open, noticeButtonsAt's `challenges`): a Link for open and for
 * install_app (after installAppUrlOk: one bad href refuses the whole tree), a Button for the
 * rest, then Dismiss when it's dismissible, or Close when a button opened it and it isn't.
 */
function noticeButtons(els: El, n: Notice, place: Place, source: 'config' | 'feed', prefix: string, at: { phase: RankedShared['phase']; signedIn: boolean; challenges: boolean }, a: Actions): RenderElement[] {
  const { Button, Link } = els
  const out: RenderElement[] = []
  for (const x of buttonsFor(n, at)) {
    const i = n.actions.indexOf(x)
    const key = `${prefix}-${n.id}-${i}`
    if (x.do === 'open') out.push(<Link key={key} href={x.url} label={x.label ?? undefined} />)
    else if (x.do === 'install_app') {
      if (installAppUrlOk(x.url)) out.push(<Link key={key} href={x.url} label={x.label ?? undefined} />)
    } else out.push(<Button key={key} label={x.label ?? ''} onPress={p => a.noticePress(source, n.id, i, place, p.surface)} />)
  }
  // A plain Button: role="dismiss" marks the button that closes its site (the pane or the band), which a desktop draws as its
  // own close control at the site's edge, so a notice's Dismiss must never carry it (band-clear and ready-decline do).
  if (n.dismissible) out.push(<Button key={`${prefix}-${n.id}-dismiss`} label={NOTICE.dismiss} onPress={() => a.noticeDismiss(source, n.id)} />)
  else if (noticeSession.opened[n.id]) out.push(<Button key={`${prefix}-${n.id}-close`} label={NOTICE.close} onPress={() => a.noticeClose(n.id)} />)
  return out
}

/**
 * A notice as its form draws it. A card: its title, its body through Markdown (notices.ts allows
 * only bold, italics, code and canonical https links on ccsr.gg and github.com) and its buttons,
 * in a full hairline border, signal orange for critical and warn (never a colored edge on one
 * side). A banner is one line in the same border: the title, the body as plain text, the buttons.
 * A line (the World room, the band) is the banner unframed.
 */
function noticeBlock(els: El, n: Notice, form: NoticeForm, words: { title: string; body: string | null }, buttons: RenderElement[]): RenderElement {
  const { Box, Text, Markdown } = els
  const hot = n.level === 'critical' || n.level === 'warn'
  const title = (
    <Text bold color={hot ? ORANGE : undefined} wrap="wrap">
      {words.title}
    </Text>
  )
  if (form === 'card')
    return (
      <Box key={`notice-${n.id}`} flexDirection="column" paddingX={1} borderStyle="round" borderColor={hot ? ORANGE : undefined} borderDimColor={!hot}>
        {title}
        {words.body !== null && <Markdown text={words.body} />}
        {buttons.length > 0 && (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            {buttons}
          </Box>
        )}
      </Box>
    )
  const row = (
    <Box gap={1} alignItems="center" flexWrap="wrap">
      {title}
      {words.body !== null && (
        <Text dimColor wrap="truncate-end">
          {plainText(words.body)}
        </Text>
      )}
      {buttons}
    </Box>
  )
  if (form !== 'banner') return row
  return (
    <Box key={`notice-${n.id}`} paddingX={1} borderStyle="round" borderColor={hot ? ORANGE : undefined} borderDimColor={!hot}>
      {row}
    </Box>
  )
}

/** The pick a `{ do: 'notice' }` press opened, when its place is one of `places` and it may draw there. */
function openedPick(list: readonly Notice[], places: readonly Place[], v: NoticeView): NoticePick | null {
  const o = noticeOpened
  if (!o || !places.includes(o.place)) return null
  const n = list.find(x => x.id === o.id)
  return n && eligible(n, o.place, v) ? { notice: n, slot: o.place, form: formFor(n, o.place) } : null
}

/**
 * The one notice for a screen across `places` (the opened one first, else pickFor, the critical
 * fallback included when the Match tab's top slot is among them), drawn only when its slot is
 * `only` (or any, without it). Its first draw this session counts as its showing.
 */
async function drawPick($: $, e: { surface: string }, els: El, a: Actions, list: readonly Notice[], places: readonly Place[], only?: Place): Promise<RenderElement | null> {
  if (list.length === 0) return null
  const v = await noticeView($, e.surface)
  const pick = openedPick(list, places, v) ?? pickFor(list, places, v)
  if (!pick || (only !== undefined && pick.slot !== only)) return null
  const words = noticeText(pick.notice, v.now, v.skewMs)
  if (!words) return null
  const el = noticeBlock(els, pick.notice, pick.form, words, noticeButtons(els, pick.notice, pick.slot, 'config', 'notice', await noticeButtonsAt($), a))
  noticeDrawn($, pick.notice, v)
  return el
}

/** The Match tab's one notice, drawn where it goes: its top slot (`match`), the queue screen (`queue`) or the result (`result`). */
async function matchNotice($: $, e: { surface: string }, els: El, a: Actions, slot: 'match' | 'queue' | 'result'): Promise<RenderElement | null> {
  const list = await noticesNow($)
  return drawPick($, e, els, a, list, matchTabPlaces((await rankedShared($)).phase), slot)
}

/** The top slot of the tab on screen. The Chat tab's World line draws in the room (worldNotice); Backtest and Lab have none. */
async function noticeTop($: $, e: { surface: string }, els: El, a: Actions, cur: Tab): Promise<RenderElement | null> {
  if (cur === 'match') return matchNotice($, e, els, a, 'match')
  const place: Place | null = cur === 'ranked' || cur === 'grind' || cur === 'chat' || cur === 'settings' ? cur : null
  if (!place) return null
  return drawPick($, e, els, a, (await noticesNow($)).filter(n => n.layout !== 'world'), [place])
}

/** A World notice: a line in the World room, while World is on screen in the Chat tab. */
async function worldNotice($: $, e: { surface: string }, els: El, a: Actions): Promise<RenderElement | null> {
  return drawPick($, e, els, a, (await noticesNow($)).filter(n => n.layout === 'world'), ['chat'])
}

/** The band's notice: one line (a card draws as its banner, unframed here), with its buttons, under the band's switches. */
async function bandNotice($: $, e: RenderInput<'AbovePrompt'>, a: Actions): Promise<RenderElement | null> {
  const list = await noticesNow($)
  if (list.length === 0) return null
  const els = $.ui.resolve(e) as El
  const v = await noticeView($, e.surface)
  const pick = openedPick(list, ['band'], v) ?? pickFor(list, ['band'], v)
  if (!pick) return null
  const words = noticeText(pick.notice, v.now, v.skewMs)
  if (!words) return null
  const el = noticeBlock(els, pick.notice, 'line', words, noticeButtons(els, pick.notice, 'band', 'config', 'band-notice', await noticeButtonsAt($), a))
  noticeDrawn($, pick.notice, v)
  return el
}

/**
 * A live match's feed notices, as lines on the live screen: critical always, warn unless Notices is
 * off (feedLine), each with its buttons; one the player put away stays gone (dismissed or snoozed
 * here, or held away by the store for every session: feedLine's putAway), and one the Match tab's
 * slot already draws isn't drawn twice.
 */
async function feedNoticeLines($: $, e: { surface: string }, els: El, a: Actions, r: RankedMatch): Promise<RenderElement | null> {
  const list = feedNotices(r.notices, await configOf($))
  if (list.length === 0) return null
  const v = await noticeView($, e.surface)
  const cfgList = await noticesNow($)
  const slotPick = openedPick(cfgList, matchTabPlaces(v.phase), v) ?? pickFor(cfgList, matchTabPlaces(v.phase), v)
  const at = await noticeButtonsAt($)
  const { Box } = els
  const lines: RenderElement[] = []
  for (const n of list) {
    if (!feedLine(n, v) || slotPick?.notice.id === n.id) continue
    const words = noticeText(n, v.now, v.skewMs)
    if (!words) continue
    lines.push(noticeBlock(els, n, 'banner', words, noticeButtons(els, n, 'match', 'feed', 'feed', at, a)))
    noticeDrawn($, n, v)
  }
  if (lines.length === 0) return null
  return (
    <Box flexDirection="column" gap={1}>
      {lines}
    </Box>
  )
}

// ================================================================== UI

type El = Elements['desktop']

export type Actions = {
  setTab: (t: Tab) => void
  setPeriod: (p: 'week' | 'month' | 'all') => void
  scanNow: () => void
  loadSessions: (days: number) => void
  backtest: (id: string) => void
  backtestAll: () => void
  race: (id: string) => void
  expand: (id: string | null) => void
  more: () => void
  start: (hours: number) => void
  forfeit: () => void
  chat: (text: string) => void
  setDraft: (text: string) => void
  clearMatch: () => void
  open: (t?: Tab) => void
  setSurface: (key: SurfaceKey, value: string) => void
  askCommit: () => void
  copyRecap: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  /** Queue again after a match, from the band or the Match tab: from the band, a press that queues nothing opens the Match tab. */
  queueAgain: (where: 'band' | 'pane') => void
  setupSeen: () => void
  askForfeit: (isAsking: boolean) => void
  setPreset: (preset: 'full' | 'quiet') => void
  setTracking: (isOn: boolean) => void
  setShare: (isOn: boolean) => void
  setModel: (m: string) => void
  resetRating: () => void
  resetGrind: () => void
  lab: (what: string, surface: string) => void
  signup: (handle: string) => void
  joinWithCode: (code: string) => void
  recoverWith: (key: string) => void
  setJoinMode: (mode: 'new' | 'link' | 'recover') => void
  makeLinkCode: () => void
  newRecoveryKey: () => void
  copyRecoveryKey: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  recoverySaved: () => void
  removeInstall: (id: number) => void
  removeThisInstall: () => void
  setServer: (url: string) => void
  queue: () => void
  leaveQueue: () => void
  toggleLength: (min: number) => void
  accept: () => void
  decline: () => void
  rankedForfeit: () => void
  rankedChat: (text: string) => void
  rankedClear: () => void
  setRoom: (room: ApiRoom) => void
  roomChat: (text: string) => void
  updateMod: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  /** W3b: a bucket row press on the Match tab (`bucket-<id>`): queue there from now on. */
  chooseBucket: (id: string) => void
  /** W3b: a bucket row press on the Ranked or Grind tab (`board-<id>`, `board-grind-<id>`). */
  chooseBoard: (which: 'ranked' | 'grind', id: string) => void
  /** W3b: the bucket checklist's sign-in step, W5b's seam (`checklistSignIn`). */
  checklistSignIn: (provider: Provider) => void
  // W5b: sign-in with a provider.
  startSignIn: (provider: Provider, from: SignInFrom) => void
  cancelSignIn: () => void
  dismissSignIn: () => void
  againSignIn: () => void
  joinSignIn: (handle: string) => void
  switchSignIn: () => void
  copySignInCode: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  unlinkProvider: (provider: Provider) => void
  /** W6b: take a challenge, from its card, the band or the code box. */
  challengeAccept: (id: string, via: 'card' | 'band' | 'code') => void
  /** W6b: decline a challenge to you, or withdraw one of yours. */
  challengeDecline: (id: string) => void
  /** W6b: Mute on a card (the second press mutes the sender). */
  challengeMute: (id: string) => void
  /** W6b: Report on a card asks why; null puts the question away. */
  challengeAskReport: (id: string | null) => void
  challengeReport: (id: string, reason: 'spam' | 'abuse' | 'other') => void
  /** W6b: the form: a fresh one (a handle, or open), a pick in it, the message typed, Send, Cancel. */
  challengeStart: (kind: 'handle' | 'open') => void
  challengePick: (patch: { handle?: string; lengthMin?: number; bucket?: string }) => void
  challengeDraft: (text: string) => void
  challengeSend: () => void
  challengeCancel: () => void
  /** W6b: the code box (a code or its ccsr.gg link), and putting its challenge away. */
  challengeCode: (input: string) => void
  challengeCodeClose: () => void
  /** W6b: Copy link on one of yours. */
  challengeCopy: (id: string, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  /** W6b: Rematch on a result: the form, filled in with them and the match's length (openChallengeForm). */
  challengeRematch: (handle: string, lengthMin: number) => void
  /** W7-2: the Model stats switch in Settings (`stats-on`, `stats-off`): PATCH /me, held on the server. */
  setModelStats: (isOn: boolean) => void
  /** W4b: a notice's button: the action at `index` of notice `id`, from config's notices or the live match's feed, pressed in `place`. */
  noticePress: (source: 'config' | 'feed', id: string, index: number, place: Place, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  /** W4b: a dismissible notice's own Dismiss. */
  noticeDismiss: (source: 'config' | 'feed', id: string) => void
  /** W4b: Close on a notice another notice's button opened, when it can't be dismissed. */
  noticeClose: (id: string) => void
  /** W10b: Replay on a finisher (a ranked match's, by its id, or practice's), and Play on the Finishers view's preview. */
  finisherReplay: (id: string) => void
  finisherPreview: () => void
  /** W10b: a pick in the Finishers view: a callout from config's pool (null is your handle's own headline), or a color. */
  finisherCallout: (callout: string | null) => void
  finisherAccent: (key: string) => void
  /** W10e: Make your own: Make a finisher, Start over (two presses), Preview, Copy the prompt, Ask Claude to fix it. */
  finisherMake: () => void
  finisherRestart: () => void
  finisherCheck: () => void
  finisherCopyPrompt: (surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  finisherFix: () => void
  /** W10e: Submit's slot, its title box as typed, and Submit. */
  finisherSlot: (kind: string) => void
  finisherTitle: (text: string) => void
  finisherSubmit: () => void
  /** W10e: equip art in a slot by its id, or empty the slot (null); `matchId` is a result's, for the line under its art. */
  finisherEquip: (slot: string, id: string | null, matchId?: string) => void
  /** W10e: Delete on your own art (two presses). */
  finisherDelete: (id: string) => void
  /** W10e: the gallery: a sort, a slot (null is every slot) or More; Preview on a row; the code box as typed, and its Equip. */
  finisherGallery: (patch: { sort?: 'top' | 'new'; slot?: string | null; more?: boolean }) => void
  finisherGalleryPreview: (id: string, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') => void
  finisherCode: (text: string) => void
  finisherEquipCode: () => void
  /** W10e: Report on a result's custom art: its reasons open for that match (null closes them), then one sent. */
  finisherAskReport: (matchId: string | null) => void
  finisherReport: (matchId: string, reason: ReportReason) => void
  /** W10e: Play on the draft's preview or a gallery row's. */
  finisherPlay: (which: 'draft' | 'gallery') => void
  /** Settings' Resync (2026-10-12): this session and the store's ranked state start again from the server. */
  resync: () => void
}

export const ORANGE = '#FF6A2A'
const STONE = '#9A9286'

// ------------------------------------------------------------------ format

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

function dur(ms: number) {
  const m = Math.round(ms / 60_000)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  return `${h}h ${String(m % 60).padStart(2, '0')}m`
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function when(t: number) {
  const d = new Date(t)
  return `${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()}/${d.getMonth() + 1} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/**
 * "4m ago" between two clock readings. Its own name: Settings' `ago` takes an ISO time, and with
 * two top-level functions of one name the loader keeps the last, so this one drew "NaN days ago".
 */
function agoMs(t: number, n: number) {
  const s = Math.max(0, Math.round((n - t) / 1000))
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}

function bar(share: number, width: number) {
  const n = Math.max(0, Math.min(width, Math.round(share * width)))
  return '█'.repeat(n) + '░'.repeat(width - n)
}

function hoursLabel(h: number) {
  return h < 1 ? `${Math.round(h * 60)}M` : `${h}H`
}

// ------------------------------------------------------------------ olympia adapters
// The drawings in olympia.ts take plain values; these shape the mod's state for them.

/** The badge for a rating, from the mod's own tiers (pure.ts), which match the server's. */
function tierKey(r: number) {
  return tierOf(r).toLowerCase() as TierKey
}

function outcomeOf(m: Match): 'won' | 'lost' | 'draw' {
  return m.status === 'won' ? 'won' : m.status === 'lost' || m.status === 'forfeit' ? 'lost' : 'draw'
}

function modeOf(m: Match) {
  return m.kind === 'replay' ? 'REPLAY' : 'PRACTICE'
}

function hhmm(t: number) {
  return new Date(t).toTimeString().slice(0, 5)
}

/** A match as the race drawings read it: minutes since the start, each side's commits up to now, or up to the bell or forfeit once it has ended. */
function raceOf(m: Match, handle: string, t: number): Race {
  const end = Math.min(m.status === 'live' ? t : (m.endedAt ?? m.deadline), m.deadline)
  const min = (x: number) => (x - m.startAt) / 60_000
  return {
    hours: m.hours,
    mode: modeOf(m),
    now: min(end),
    hot: m.status === 'live' && m.deadline - t < 10 * 60_000,
    me: { handle, commits: m.feed.filter(f => f.who === 'me' && f.at <= end).map(f => ({ t: min(f.at), points: f.points })) },
    them: { handle: m.opp.handle, commits: m.plan.filter(p => p.at <= end).map(p => ({ t: min(p.at), points: p.points })) },
  }
}

/** Running totals at seven even steps across the match, for the recent-matches sparklines. */
function seriesOf(m: Match) {
  const end = Math.min(m.endedAt ?? m.deadline, m.deadline)
  const upTo = (items: FeedItem[], x: number) => items.filter(i => i.at <= x).reduce((n, i) => n + i.points, 0)
  const xs = Array.from({ length: 7 }, (_, i) => m.startAt + ((end - m.startAt) * i) / 6)
  return { mine: xs.map(x => upTo(m.feed, x)), theirs: xs.map(x => upTo(m.plan, Math.min(x, m.deadline))) }
}

/** A ranked match from the server as the race drawings read it: minutes since the start, each side's scores by author time. */
function raceFromServer(r: RankedMatch, me: string, t: number): Race | null {
  const s = r.summary
  if (!s || !s.started_at) return null
  const start = Date.parse(s.started_at)
  const len = s.length_min
  const mine = s.sides.find(x => x.player.handle === me) ?? s.sides[0]
  const them = s.sides.find(x => x !== mine) ?? s.sides[1]
  const end = s.ended_at ? Math.min(Date.parse(s.ended_at), start + len * 60_000) : t
  const min = (iso: string) => Math.max(0, Math.min(len, (Date.parse(iso) - start) / 60_000))
  const scores = r.events.filter((e): e is Extract<typeof e, { kind: 'score' }> => e.kind === 'score')
  const side = (h: string) => scores.filter(e => e.handle === h).map(e => ({ t: min(e.at), points: e.points, craft: e.craft }))
  const live = s.status === 'live' || s.status === 'grace'
  return {
    hours: len / 60,
    now: Math.max(0, Math.min(len, (Math.min(t, end) - start) / 60_000)),
    mode: modeWord(s),
    hot: live && !!s.deadline && Date.parse(s.deadline) - t < warnMs(s),
    me: { handle: mine.player.handle, commits: side(mine.player.handle) },
    them: { handle: them.player.handle, commits: side(them.player.handle) },
  }
}

/** The drawings' mode word for a server match (W6b): CHALLENGE for a challenge's, else RANKED (an unknown kind reads as ranked, docs/api.md). */
function modeWord(s: Pick<ApiMatchSummary, 'kind'>) {
  return s.kind === 'challenge' ? 'CHALLENGE' : 'RANKED'
}

/** A server match the drawings show unrated (W6b: a challenge): `{ rated: false }` to spread into a drawing's values, else nothing. */
function unratedOf(s: Pick<ApiMatchSummary, 'kind'>): { rated?: false } {
  return s.kind === 'challenge' ? { rated: false } : {}
}

/** The seconds a challenge's ready check runs, for its ring (W6a: max(2 minutes, 2.5 x the inbox poll)), never fewer than are left. */
function offerSeconds(cf: ModConfig, left: number) {
  return Math.max(120, Math.round((2.5 * cf.poll.inbox) / 1000), left)
}

function rankedSides(s: ApiMatchSummary, me: string) {
  const mine = s.sides.find(x => x.player.handle === me) ?? s.sides[0]
  const them = s.sides.find(x => x !== mine) ?? s.sides[1]
  return { mine, them }
}

function rankedOutcome(s: ApiMatchSummary, me: string): 'won' | 'lost' | 'draw' {
  if (s.result === 'draw' || s.status === 'void') return 'draw'
  return s.winner === me ? 'won' : 'lost'
}

function waitLabel(ms: number | null) {
  if (ms === null) return '~?'
  const m = Math.round(ms / 60_000)
  return m < 1 ? '<1 min' : `~${m} min`
}

/** 15m, or 15m and 1h, or 15m, 30m and 1h. */
function andList(words: readonly string[]) {
  return words.length < 2 ? words.join('') : `${words.slice(0, -1).join(', ')} and ${words[words.length - 1]}`
}

// ------------------------------------------------------------------ buckets on the cards (W3b)
// Where you stand is per bucket. Open is GET /me's `player`, exactly as before buckets, so with
// one bucket every card is today's. Another bucket swaps in GET /me's standing there (rating,
// tier, placement, matches, record) and the rank and last matches its own reads found.

/** You as the cards draw you in bucket `id`: Open's player, or that player with the bucket's standing; null before GET /me answers, or with no standing there. */
function meIn(l: LinkState, id: string): ApiPlayer | null {
  if (!l.me || id === OPEN) return l.me
  const st = standingFor({ player: l.me, buckets: l.meBuckets }, id)
  return st ? { ...l.me, rating: st.rating, tier: st.tier, placement: st.placement, matches_played: st.matches ?? 0, record: st.record ?? { w: 0, l: 0, d: 0 } } : null
}

/** Your rank in bucket `id`'s Ranked board (null while placing there, or not read yet). */
function rankIn(l: LinkState, id: string) {
  return id === OPEN ? l.myRank : (l.boards?.[id]?.rank ?? null)
}

/** Your last ranked matches in bucket `id`, newest first. */
function recentIn(l: LinkState, id: string) {
  return id === OPEN ? l.recent : (l.boards?.[id]?.recent ?? null)
}

/** The link as the Ranked tab draws bucket `id`: Open's is the link itself; another's has your standing, its top 10 and your rank there. */
function viewIn(l: LinkState, id: string): LinkState {
  return id === OPEN ? l : { ...l, me: meIn(l, id), ladder: l.boards?.[id]?.ladder ?? null, myRank: rankIn(l, id) }
}

/** The bucket a ready check is for: the offer's, else the server's queue bucket, else Open. */
function offerBucket(o: ApiQueueState['offer'], sh: RankedShared) {
  return bucketIdOf(o?.bucket) ?? sh.bucket ?? OPEN
}

// ------------------------------------------------------------------ band

export async function renderBand($: $, e: RenderInput<'AbovePrompt'>, a: Actions): Promise<RenderElement | null> {
  const { Box, Text, Button, Svg } = $.ui.resolve(e) as El
  const rich = e.surface !== 'terminal'
  const m = await read($, match)
  const t = (await read($, now)) || (await $.clock.now())
  const s = await read($, settings)
  const p = s.surfaces
  const sh = await rankedShared($)
  const l = await read($, link)
  const cfg = await serverCfg($)
  const me = cfg.handle ?? s.handle
  const cf = await configOf($, cfg)
  // Match chat paused by the switchboard: no chat line and no Reply in the band.
  const chatOk = p.bandChat === 'on' && p.chat === 'on' && cf.chat.match

  // The ready check ignores every switch: it's the one thing a player has to answer.
  if (sh.phase === 'offered' && l.queue?.offer) {
    const o = l.queue.offer
    const secs = Math.max(0, Math.round((Date.parse(o.expires_at) - t) / 1000))
    // W6b: a challenge's is unrated: no stakes, and its check runs longer than a ranked one's minute.
    const challenge = o.kind === 'challenge'
    const tierText = o.opponent.placement ? 'Mud, placing' : `${o.opponent.tier} ${o.opponent.rating}`
    const record = `${o.opponent_record.w}-${o.opponent_record.l}`
    const line = challenge ? CHALLENGE.bandOffer(o.opponent.handle, tierText, record) : `${o.opponent.handle} · ${tierText} · ${record} · win +${o.stakes.win}, loss ${o.stakes.loss}`
    return (
      <Box gap={1} alignItems="center" flexWrap="wrap">
        {rich ? (
          <Svg
            source={bandStrip({ kind: 'found', me, them: o.opponent.handle, theirRating: o.opponent.rating, seconds: secs, ...(challenge ? { mode: 'challenge' as const, of: offerSeconds(cf, secs) } : {}) })}
            alt={`${challenge ? 'Challenge' : 'Opponent found'}: ${line}. ${secs} seconds to accept.`}
          />
        ) : (
          <Text bold color={ORANGE}>
            {challenge ? CHALLENGE.bandTitle : 'OPPONENT FOUND'}
          </Text>
        )}
        <Text wrap="truncate-end">{rich ? line : `${line} · ${secs}s`}</Text>
        {o.you_accepted ? (
          <Text dimColor>Accepted. Waiting for {o.opponent.handle}.</Text>
        ) : (
          <>
            <Button key="band-accept" label="Accept" variant="primary" onPress={() => a.accept()} />
            <Button key="band-decline" label="Decline" onPress={() => a.decline()} />
          </>
        )}
        {/* W6b: a challenge's taker waits on the sender for minutes, not a ranked check's one: they can still back out. */}
        {o.you_accepted && challenge && <Button key="band-decline" label="Decline" onPress={() => a.decline()} />}
      </Box>
    )
  }

  if (p.bandMatch === 'on') {
    if (sh.phase === 'queued') {
      const secs = Math.max(0, Math.round((t - sh.since) / 1000))
      const half = l.queue?.range ? Math.round((l.queue.range.max - l.queue.range.min) / 2) : 60
      // W3b: your standing in the bucket you're queued in (placing there draws text, so its hidden rating never shows).
      const qme = meIn(l, sh.bucket ?? OPEN)
      return (
        <Box gap={1} alignItems="center">
          {rich && qme && !qme.placement ? (
            <Svg source={bandStrip({ kind: 'queue', seconds: secs, hours: sh.queuedMin.map(m => m / 60), rating: qme.rating, range: half })} alt={`In queue ${mmss(secs * 1000)}.`} />
          ) : (
            <Text bold color={ORANGE}>
              CCSR in queue {mmss(secs * 1000)}
            </Text>
          )}
          <Text dimColor wrap="truncate-end">
            {LINES.queue[Math.floor(secs / 8) % LINES.queue.length]}
          </Text>
          <Button key="band-open" label="Open" onPress={() => a.open('match')} />
          <Button key="band-leave" label="Leave" onPress={() => a.leaveQueue()} />
        </Box>
      )
    }

    const rk = l.ranked
    if ((sh.phase === 'live' || sh.phase === 'done') && rk?.summary) {
      const sm = rk.summary
      const { mine, them } = rankedSides(sm, me)
      const closed = sm.status === 'finished' || sm.status === 'void'
      const lastChat = [...rk.events].reverse().find((x): x is Extract<typeof x, { kind: 'chat' }> => x.kind === 'chat' && x.handle !== me)
      const ended = sm.ended_at ? Date.parse(sm.ended_at) : t
      if (closed && t - ended <= 15 * 60_000) {
        const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
        const line = rankedResultLine(sm, me)
        return (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            {rich ? (
              <Svg
                source={bandStrip({ kind: 'result', mode: modeWord(sm), outcome: rankedOutcome(sm, me), hours: sm.length_min / 60, delta, ratingBefore: mine.rating_before, ratingAfter: mine.rating_after ?? mine.rating_before, mine: mine.points, theirs: them.points, placing: placingOfSide(mine), ...unratedOf(sm) })}
                alt={line}
              />
            ) : (
              <Text bold color={ORANGE}>
                CCSR
              </Text>
            )}
            <Box flexDirection="column">
              <Text bold>{line}</Text>
              {!rich && (
                <Text dimColor>
                  {mine.points} : {them.points} vs {them.player.handle}
                </Text>
              )}
              {lastChat && chatOk && (
                <Text dimColor wrap="truncate-end">
                  {clean(lastChat.handle)}: {clean(lastChat.text)}
                </Text>
              )}
            </Box>
            {!cf.practiceOnly && <Button key="band-again" label="Queue again" variant="primary" onPress={() => a.queueAgain('band')} />}
            <Button key="band-recap" label="Copy recap" onPress={x => a.copyRecap(x.surface)} />
            <Button key="band-clear" label="Dismiss" role="dismiss" onPress={() => a.rankedClear()} />
          </Box>
        )
      }
      if (!closed) {
        const race = raceFromServer(rk, me, t)
        const left = sm.deadline ? Date.parse(sm.deadline) - t : 0
        const hot = sm.status === 'live' && left <= warnMs(sm)
        const behind = them.points - mine.points
        const offline = l.online === false
        const d = await read($, dirty)
        const offlineAgo = offline && rk.polledAt ? `${Math.round((t - rk.polledAt) / 1000)}s` : undefined
        return (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            {rich && race ? (
              <Svg source={bandStrip({ kind: 'race', race, mode: modeWord(sm), offlineAgo })} alt={`${mine.player.handle} ${mine.points}, ${them.player.handle} ${them.points}. ${clock(left)} to the bell.`} />
            ) : (
              <Text bold color={hot ? ORANGE : undefined}>
                {hot ? 'BELL' : `CCSR ${lengthLabel(sm.length_min).toUpperCase()}`} {clock(left)} · {mine.player.handle} {mine.points} vs {them.points} {them.player.handle}
              </Text>
            )}
            {sm.status === 'grace' ? (
              <Text color={ORANGE}>{countingLine(sm, t)}</Text>
            ) : offline ? (
              <Text dimColor wrap="truncate-end">
                {MOD.offline}
              </Text>
            ) : hot ? (
              <Box flexDirection="column">
                {behind > 0 && (
                  <Text bold color={ORANGE}>
                    {LINES.behind(behind)}
                  </Text>
                )}
                {d && d.files > 0 && <Text dimColor>{MOD.uncommitted(d.files, d.repo)}</Text>}
              </Box>
            ) : lastChat && chatOk ? (
              <Text dimColor wrap="truncate-end">
                {clean(lastChat.handle)}: {clean(lastChat.text)}
              </Text>
            ) : null}
            {hot && !offline && p.spinner === 'on' && <Button key="band-commit" label="Ask Claude to commit" variant="primary" onPress={() => a.askCommit()} />}
            {!hot && !offline && lastChat && chatOk && <Button key="band-reply" label="Reply" onPress={() => a.open('match')} />}
            <Button key="band-open" label="Open" onPress={() => a.open('match')} />
          </Box>
        )
      }
    }

    if (m && m.kind === 'practice' && m.status === 'live') {
      const lastChat = m.chat[m.chat.length - 1]
      const w = Math.max(8, Math.min(24, e.props.bodyColumns - 70))
      const opp = liveOpp(m, t)
      const total = m.myPoints + opp
      return (
        <Box flexDirection="column">
          {rich ? (
            <Box gap={1} alignItems="center">
              <Svg source={bandStrip({ kind: 'race', race: raceOf(m, s.handle, t), mode: modeOf(m) })} alt={`${s.handle} ${m.myPoints}, ${m.opp.handle} ${opp}. ${clock(m.deadline - t)} to the bell.`} />
              <Button key="band-open" label="Open" onPress={() => a.open('match')} />
            </Box>
          ) : (
            <Box gap={1} alignItems="center">
              <Text bold color={ORANGE}>
                CCSR {hoursLabel(m.hours)}
              </Text>
              <Text bold>{clock(m.deadline - t)}</Text>
              <Text bold>
                {s.handle} {m.myPoints}
              </Text>
              <Text color={ORANGE}>{bar(total ? m.myPoints / total : 0.5, w)}</Text>
              <Text>
                {opp} {m.opp.handle}
              </Text>
              <Button key="band-open" label="Open" onPress={() => a.open('match')} />
            </Box>
          )}
          {lastChat && chatOk && (
            <Text dimColor wrap="truncate-end">
              {clean(lastChat.who)}: {clean(lastChat.text)}
            </Text>
          )}
        </Box>
      )
    }

    // W6b: a challenge to you, between matches (a result's 15 minutes and a practice race come first): take it or decline it from here, the newest. Never its message.
    const incoming = sh.phase === 'idle' || sh.phase === 'done' ? await bandChallenge($) : null
    if (incoming) {
      return (
        <Box gap={1} alignItems="center" flexWrap="wrap">
          <Text bold color={ORANGE}>
            {CHALLENGE.bandTitle}
          </Text>
          <Text wrap="truncate-end">{CHALLENGE.bandIncoming(incoming.from.handle, incoming.label)}</Text>
          {!cf.practiceOnly && <Button key="band-ch-accept" label={CHALLENGE.accept} variant="primary" onPress={() => a.challengeAccept(incoming.id, 'band')} />}
          <Button key="band-ch-decline" label={CHALLENGE.decline} onPress={() => a.challengeDecline(incoming.id)} />
          <Button key="band-open" label="Open" onPress={() => a.open('match')} />
        </Box>
      )
    }

    if (m && m.kind === 'practice' && m.status !== 'live' && t - (m.endedAt ?? m.deadline) < 15 * 60_000) {
      const delta = (m.ratingAfter ?? m.ratingBefore) - m.ratingBefore
      if (rich)
        return (
          <Box gap={1} alignItems="center">
            <Svg
              source={bandStrip({ kind: 'result', mode: modeOf(m), outcome: outcomeOf(m), hours: m.hours, delta, ratingBefore: m.ratingBefore, ratingAfter: m.ratingAfter ?? m.ratingBefore, mine: m.myPoints, theirs: m.oppPoints })}
              alt={`${resultWord(m)}, ${m.myPoints} to ${m.oppPoints} vs ${m.opp.handle}.`}
            />
            <Button key="band-open" label="Open" onPress={() => a.open('match')} />
            <Button key="band-clear" label="Dismiss" role="dismiss" onPress={() => a.clearMatch()} />
          </Box>
        )
      return (
        <Box gap={1} alignItems="center">
          <Text bold color={ORANGE}>
            CCSR
          </Text>
          <Text bold>{resultWord(m)}</Text>
          <Text>
            {m.myPoints} to {m.oppPoints} vs {m.opp.handle} · {delta >= 0 ? '+' : ''}
            {delta} · {tierOf(m.ratingAfter ?? m.ratingBefore)} {m.ratingAfter ?? m.ratingBefore}
          </Text>
          <Button key="band-open" label="Open" onPress={() => a.open('match')} />
          <Button key="band-clear" label="Dismiss" role="dismiss" onPress={() => a.clearMatch()} />
        </Box>
      )
    }
  }

  // First run: one prompt, gone for good after either button.
  if (!cfg.token && !s.setupSeen) {
    return (
      <Box gap={1} alignItems="center">
        {rich ? <Svg source={bandStrip({ kind: 'setup' })} alt="CCSR: pick a handle" /> : <Text bold color={ORANGE}>CCSR</Text>}
        <Text>{LINES.handle}</Text>
        <Button
          key="band-setup"
          label="Set up"
          variant="primary"
          onPress={() => {
            a.setupSeen()
            a.open('match')
          }}
        />
        <Button key="band-later" label="Not now" onPress={() => a.setupSeen()} />
      </Box>
    )
  }

  // Between matches: the Grind band, two minutes after a score (or always, or never).
  if (!s.tracking || p.band === 'off') return null
  const list = await read($, ledger)
  const wk = totals(list, periodStart('week', t), await read($, weekTotals))
  const last = list.filter(c => !c.matchOnly).sort((x, y) => y.scoredAt - x.scoredAt)[0]
  if (!last || (p.band === 'after' && t - last.scoredAt > 2 * 60_000)) return null
  const sc = await read($, scan)
  const queueBtn = cfg.token && !cf.practiceOnly ? <Button key="band-queue" label="Queue" onPress={() => a.open('match')} /> : null
  if (rich) {
    // The line is drawn in the strip: the commit's title, or the scan's note while one runs.
    const line = sc.busy ? sc.note : clean(last.title).slice(0, 60)
    return (
      <Box gap={1} alignItems="center">
        <Svg source={bandStrip({ kind: 'grind', points: last.points, category: last.category, craft: last.craft, week: wk.points, rank: l.grindRank ?? undefined, title: line })} alt={`Last commit +${last.points} ${last.category}. Grind ${wk.points} points this week.${line ? ` ${line}` : ''}`} />
        {queueBtn}
        <Button key="band-open" label="Open" onPress={() => a.open('grind')} />
      </Box>
    )
  }
  return (
    <Box gap={1} alignItems="center">
      <Text bold color={ORANGE}>
        CCSR +{last.points}
      </Text>
      <Text wrap="truncate-end">
        {last.category}
        {last.craft !== 'neutral' ? ` · ${last.craft === 'clean' ? 'clean +1' : 'sloppy -1'}` : ''} · {clean(last.title).slice(0, 40)} · Grind {wk.points}
        {l.grindRank ? ` · #${l.grindRank}` : ''}
      </Text>
      {queueBtn}
      <Button key="band-open" label="Open" onPress={() => a.open('grind')} />
    </Box>
  )
}

/** Where a ranked side stands on placement, for the result card and band: still placing, or placed by this match. */
function placingOfSide(side: ApiMatchSummary['sides'][number]) {
  if (side.player.placement) return { played: side.player.placement.played, of: side.player.placement.of }
  if (side.tier_before === 'Mud' && side.tier_after && side.tier_after !== 'Mud') return { played: 3, of: 3, placedIn: side.tier_after.toLowerCase() as TierKey }
  return undefined
}

function resultWord(m: Match) {
  return m.status === 'won' ? 'You won' : m.status === 'lost' ? 'You lost' : m.status === 'draw' ? 'Draw' : m.status === 'forfeit' ? 'Forfeit' : m.status === 'void' ? 'Void' : 'Live'
}

// ------------------------------------------------------------------ pane

// ---------------------------------------------------------------- row spacing

/** What a desktop or a phone draws taller than a line of text. The terminal draws each in one row. */
const TALL: ReadonlySet<string> = new Set(['Button', 'Input', 'Select'])

type BoxEl = Extract<RenderElement, { type: 'Box' }>

const isBox = (n: RenderNode): n is BoxEl => typeof n !== 'string' && n.type === 'Box'
const isColumn = (b: BoxEl) => b.props?.flexDirection === 'column' || b.props?.flexDirection === 'column-reverse'
/** Out of the flow or not drawn: it takes no row of its own. */
const noRow = (n: RenderNode) => isBox(n) && (n.props?.position === 'absolute' || n.props?.display === 'none')

/** Whether a node's top (or bottom) edge is a control: one itself, a row that holds one, or a column whose first (last) row is. A border is an edge of its own. */
function tallEdge(n: RenderNode, top: boolean): boolean {
  if (typeof n === 'string') return false
  if (TALL.has(n.type)) return true
  if (!isBox(n) || noRow(n) || n.props?.borderStyle) return false
  const kids = (n.children ?? []).filter(k => !noRow(k))
  if (!isColumn(n)) return kids.some(k => tallEdge(k, top))
  const k = top ? kids[0] : kids[kids.length - 1]
  return k !== undefined && tallEdge(k, top)
}

/**
 * Room around the controls, off the terminal. A desktop or a phone draws a button or an input
 * taller than a line of text, so in a column with no gap a row of them touches the row above and
 * the row below. Every such column gets a gap of one, and the rows between two controls (lines of
 * text, a drawing) are held together in a column of their own, so text stays as tight as it was.
 * A column that already has a gap, or holds a Box out of the flow, is left as drawn.
 */
function roomy(n: RenderNode, Box: El['Box']): RenderNode {
  if (!isBox(n) || !n.children) return n
  const kids = n.children.map(k => roomy(k, Box))
  const p = n.props ?? {}
  const same = { ...n, children: kids }
  if (!isColumn(n) || Number(p.gap ?? 0) > 0 || Number(p.rowGap ?? 0) > 0 || kids.some(noRow)) return same
  const groups: RenderNode[][] = []
  for (const k of kids) {
    const last = groups[groups.length - 1]
    const prev = last?.[last.length - 1]
    if (last && prev !== undefined && !tallEdge(prev, false) && !tallEdge(k, true)) last.push(k)
    else groups.push([k])
  }
  if (groups.length < 2) return same
  return { ...n, props: { ...p, gap: 1 }, children: groups.map(g => (g.length === 1 ? (g[0] as RenderNode) : Box({ flexDirection: 'column', children: g }))) }
}

/** The five tabs in the frame. Backtest opens from the Grind tab ("Score past sessions") and Lab from `/ccsr lab`. */
const TABS: ['match' | 'ranked' | 'grind' | 'chat' | 'settings', string][] = [
  ['match', 'Match'],
  ['ranked', 'Ranked'],
  ['grind', 'Grind'],
  ['chat', 'Chat'],
  ['settings', 'Settings'],
]

export async function renderPane($: $, e: RenderInput<'Pane'>, a: Actions): Promise<RenderElement> {
  const els = $.ui.resolve(e) as El
  const { Box, Text, Button, Svg } = els
  const rich = e.surface !== 'terminal'
  const cur = await read($, tab)
  const s = await read($, settings)
  const t = (await read($, now)) || (await $.clock.now())
  const list = await read($, ledger)
  const r = await read($, rating)
  const l = await read($, link)
  const wk = totals(list, periodStart('week', t), await read($, weekTotals))
  // The chat poller's heartbeat: it stops once the pane stops drawing.
  paneSeenAt = await $.clock.now()
  // Where this install last drew, for GET /config?surface= (the server keeps it for targeting).
  paneSurface = e.surface
  // W4b: the pane's first draw after a minute without one is the notices' pane_open. The moment is kept now, so this draw's slots
  // see it; the redraw and the toast and flash check are paneTick's, within a second: a draw writes no state and starts no timer.
  if (paneSeenAt - paneDrawnAt > PANE_GAP_MS && recordMoment({ on: 'pane_open' }, paneSeenAt)) paneOpened = true
  paneDrawnAt = paneSeenAt

  let body: RenderElement
  if (cur === 'match') body = await matchTab($, e, els, a, t)
  else if (cur === 'ranked') body = await rankedTab($, e, els, a)
  else if (cur === 'chat') body = await chatTab($, e, els, a)
  else if (cur === 'backtest') body = await backtestTab($, e, els, a, t)
  else if (cur === 'lab') body = await labTab($, e, els, a)
  else if (cur === 'settings') body = await settingsTab($, e, els, a)
  else if (cur === 'finishers') body = await finishersTab($, e, els, a)
  else body = await grindTab($, e, els, a, t)
  // W4b: the tab's own notice slot, on top (the Match tab's queue and result slots draw inside it).
  const top = await noticeTop($, e, els, a, cur)
  if (top) body = (
    <Box flexDirection="column" gap={1}>
      {top}
      {body}
    </Box>
  )
  // The tabs' frame below hugs its buttons on purpose, so only the body gets the room.
  if (rich) body = roomy(body, Box) as RenderElement

  const me = l.me
  const placing = me?.placement ?? null
  const handle = me ? me.handle : s.handle
  const standing = me ? (placing ? `Mud, placing ${placing.played} of ${placing.of}` : `${me.tier} ${me.rating}`) : `${tierOf(r)} ${r} practice`
  // The banner draws the handle on its own line over the rest; the alt and the terminal's line read as one.
  const line = `${standing} · Grind ${wk.points}${l.grindRank ? ` · #${l.grindRank}` : ''}`
  const sub = `${handle} · ${line}`
  const tierK: TierKey = me ? (placing ? 'mud' : (me.tier.toLowerCase() as TierKey)) : tierKey(r)
  // W10b: the Finishers view opens from Settings, so Settings stays lit over it.
  const framed = cur === 'backtest' ? 'grind' : cur === 'lab' || cur === 'finishers' ? 'settings' : cur
  return (
    <Box flexDirection="column" gap={1}>
      {rich ? (
        <Svg source={banner({ handle, sub: line, tier: tierK })} alt={`CCSR. ${sub}`} />
      ) : (
        <Box gap={1}>
          <Text bold color={ORANGE}>
            CCSR
          </Text>
          <Text>{sub}</Text>
        </Box>
      )}
      {rich ? (
        <Box flexDirection="column">
          <Svg source={tabsTop(framed)} alt={`Tabs: ${framed} is open`} />
          <Box>
            {TABS.map(([id, label]) => (
              <Box key={`cell-${id}`} width="20%" justifyContent="center">
                <Button key={`tab-${id}`} label={label} variant={framed === id ? 'primary' : 'secondary'} onPress={() => a.setTab(id)} />
              </Box>
            ))}
          </Box>
          <Svg source={tabsBase(framed)} alt="" />
        </Box>
      ) : (
        <Box gap={1} flexWrap="wrap">
          {TABS.map(([id, label]) => (
            <Button key={`tab-${id}`} label={framed === id ? `▸ ${label}` : label} variant={framed === id ? 'primary' : 'secondary'} onPress={() => a.setTab(id)} />
          ))}
        </Box>
      )}
      {body}
    </Box>
  )
}

// ---------------------------------------------------------------- grind tab

async function grindTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg } = els
  const rich = e.surface !== 'terminal'
  const p = await read($, period)
  const srv = await read($, link)
  const list = await read($, ledger)
  const sc = await read($, scan)
  const s = await read($, settings)
  const since = await read($, trackingSince)
  const weeks = await read($, weekTotals)
  const from = periodStart(p, t)
  const tot = totals(list, from, weeks)
  const problems = sc.problems ?? []
  const inPeriod = list.filter(c => c.authoredAt >= from && !c.matchOnly).sort((x, y) => y.authoredAt - x.authoredAt)

  // columns: days of this week, weeks of this month, or the last 8 weeks
  let cols: { label: string; points: number; isToday: boolean }[] = []
  if (p === 'week') {
    cols = DAYS.map((label, i) => {
      const a0 = from + i * 86_400_000
      const pts = list.filter(c => c.authoredAt >= a0 && c.authoredAt < a0 + 86_400_000 && !c.matchOnly).reduce((n, c) => n + c.points, 0)
      return { label, points: pts, isToday: t >= a0 && t < a0 + 86_400_000 }
    })
  } else {
    const wk0 = periodStart('week', t)
    const n = p === 'month' ? Math.ceil((t - from) / (7 * 86_400_000)) + 1 : 8
    cols = Array.from({ length: Math.min(8, Math.max(1, n)) }, (_, k) => {
      const i = Math.min(8, Math.max(1, n)) - 1 - k
      const a0 = wk0 - i * 7 * 86_400_000
      const pts =
        list.filter(c => c.authoredAt >= Math.max(a0, p === 'month' ? from : 0) && c.authoredAt < a0 + 7 * 86_400_000 && !c.matchOnly).reduce((m, c) => m + c.points, 0) +
        (p === 'all' ? (weeks[String(a0)]?.points ?? 0) : 0)
      const d = new Date(a0)
      return { label: `${d.getDate()}/${d.getMonth() + 1}`, points: pts, isToday: i === 0 }
    })
  }
  const maxPts = Math.max(1, ...cols.map(c => c.points))
  const barW = Math.max(8, Math.min(30, e.props.bodyColumns - 22))
  const label = p === 'week' ? 'this week' : p === 'month' ? 'this month' : 'all time'
  // W3b: with more than one bucket, a row picks whose Grind your rank is among: Open is everyone (as before buckets); another is the players who meet its requirements.
  const bl = bucketsOf(await configOf($))
  const shownRow = bucketRowShown(bl)
  const gpick = shownRow ? pickBucket(bl, (await read($, boardPick)).grind) : null
  const gb = gpick && gpick.id !== OPEN ? (srv.boards?.[gpick.id] ?? null) : null
  const grindRank = gpick && gpick.id !== OPEN ? (gb?.grindRank ?? null) : srv.grindRank
  const grindOf = gpick && gpick.id !== OPEN ? (gb?.grindOf ?? null) : srv.grindOf

  return (
    <Box flexDirection="column" gap={1}>
      {shownRow && (
        <Box flexDirection="column">
          <Box gap={1} flexWrap="wrap">
            {bl.map(b => (
              <Button key={`board-grind-${b.id}`} label={b.label} variant={b.id === (gpick?.id ?? OPEN) ? 'primary' : 'secondary'} onPress={() => a.chooseBoard('grind', b.id)} />
            ))}
          </Box>
          {gpick && gpick.id !== OPEN && (
            <Text dimColor wrap="wrap">
              {BUCKET.grindOnly(gpick.label)}
            </Text>
          )}
        </Box>
      )}
      <Box gap={1}>
        <Button key="p-week" label="This week" variant={p === 'week' ? 'primary' : 'secondary'} onPress={() => a.setPeriod('week')} />
        <Button key="p-month" label="Month" variant={p === 'month' ? 'primary' : 'secondary'} onPress={() => a.setPeriod('month')} />
        <Button key="p-all" label="All time" variant={p === 'all' ? 'primary' : 'secondary'} onPress={() => a.setPeriod('all')} />
      </Box>
      {rich ? (
        <Svg
          source={grind({ points: tot.points, commits: tot.commits, caption: `PTS ${label.toUpperCase()}`, rank: p === 'week' ? (grindRank ?? undefined) : undefined, of: grindOf ?? undefined, days: cols.slice(-7).map(c => ({ label: c.label, points: c.points, today: c.isToday })) })}
          alt={`Grind ${label}: ${tot.points} points from ${tot.commits} commits.`}
        />
      ) : (
        <Box flexDirection="column">
          <Text bold>
            {tot.points} pts · {tot.commits} commits {label}
          </Text>
          {cols.map(c => (
            <Text color={c.isToday ? ORANGE : undefined}>
              {c.label.padEnd(6)} {bar(c.points / maxPts, barW)} {c.points}
            </Text>
          ))}
        </Box>
      )}
      <Box gap={1} flexWrap="wrap" alignItems="center">
        <Button key="scan" label={sc.busy ? 'Scanning...' : 'Scan now'} variant="primary" onPress={() => a.scanNow()} />
        <Button key="past-sessions" label="Score past sessions" onPress={() => a.setTab('backtest')} />
        <Text dimColor wrap="truncate-end">
          {s.tracking ? `Tracking since ${when(since)}` : 'Tracking is off'} · {sc.note || 'not scanned yet'}
          {sc.lastAt ? ` · ${agoMs(sc.lastAt, Math.max(t, sc.lastAt))}` : ''}
        </Text>
      </Box>
      {problems.length > 0 && (
        <Box flexDirection="column" borderStyle="round" borderColor={ORANGE} paddingX={1}>
          <Text bold color={ORANGE}>
            Problems on the last scan ({problems.length}). They retry on the next scan.
          </Text>
          {problems.slice(0, 8).map(pr => (
            <Text dimColor wrap="wrap">
              {pr}
            </Text>
          ))}
        </Box>
      )}
      {inPeriod.length === 0 ? (
        <Text dimColor>
          Nothing scored {label} yet. Commits count from install, in any repo you use Claude Code in.
        </Text>
      ) : (
        <Box flexDirection="column">
          {rich ? (
            <Svg
              source={commitList(
                inPeriod.slice(0, 14).map(c => ({
                  points: c.points,
                  craft: c.craft,
                  category: c.category,
                  title: clean(c.title),
                  repo: c.repoName,
                  added: c.added,
                  deleted: c.deleted,
                  files: c.files,
                  note: c.points <= 1 ? clean(c.reason).slice(0, 48) : undefined,
                })),
              )}
              alt={`${Math.min(14, inPeriod.length)} scored commits ${label}.`}
            />
          ) : (
            <Box flexDirection="column">
              <Text bold>Scored commits</Text>
              {inPeriod.slice(0, 14).map(c => commitRow(els, c, e.props.bodyColumns))}
            </Box>
          )}
          {inPeriod.length > 14 && <Text dimColor>and {inPeriod.length - 14} more</Text>}
        </Box>
      )}
      <Text dimColor>{LINES.multibox}</Text>
    </Box>
  )
}

function commitRow(els: El, c: ScoredCommit, cols: number) {
  const { Box, Text } = els
  return (
    <Box key={`c-${c.pid}`} flexDirection="column" hover={{ backgroundColor: '#26231F' }}>
      <Box gap={1}>
        <Text bold color={c.points >= 8 ? ORANGE : undefined}>{`+${c.points}`.padStart(3)}</Text>
        <Text color={STONE}>{c.category.padEnd(8)}</Text>
        {c.craft === 'clean' && <Text color={ORANGE}>clean +1</Text>}
        {c.craft === 'sloppy' && <Text color={STONE}>sloppy -1</Text>}
        <Text wrap="truncate-end">{clean(c.title).slice(0, Math.max(20, cols - 40))}</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {'    '}
        {c.repoName} · +{c.added} -{c.deleted} in {c.files} file{c.files === 1 ? '' : 's'} · {clean(c.reason)}
        {c.craft !== 'neutral' ? ` · judged ${c.base}, ${c.craft} moves it to ${c.points}` : ''}
        {c.judge === 'rule' ? ' (rule, no judge call)' : ''}
      </Text>
    </Box>
  )
}

// ---------------------------------------------------------------- match tab

/**
 * Recent matches from the profile, as the recent-matches drawing reads them. A row's `forfeit` is
 * that player's own forfeit (docs/api.md; the other side's reads `win`), so it's a loss, read from
 * `result`, never from the delta's sign: a challenge's delta is 0 (W6b), and it draws UNRATED.
 */
function recentRow(x: ApiRecentMatch) {
  const result: 'won' | 'lost' | 'draw' = x.result === 'win' ? 'won' : x.result === 'loss' || x.result === 'forfeit' ? 'lost' : 'draw'
  return { day: DAYS[(new Date(Date.parse(x.ended_at)).getDay() + 6) % 7] ?? '', result, hours: x.length_min / 60, label: lengthLabel(x.length_min), mine: x.score[0], theirs: x.score[1], opponent: x.opponent.handle, opponentRating: x.opponent.rating, delta: x.delta, series: { mine: x.series[0], theirs: x.series[1] }, ...unratedOf(x) }
}

/**
 * Ranked, from the server (docs/ui-spec.md, States): first run, the queue bar
 * and where you stand, the queue, the ready check, the live match, counting,
 * the result. Every line is approved in docs/copy.md; the mod's own come from MOD in copy.ts.
 */
async function rankedBox($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const body = await rankedBody($, e, els, a, t)
  const banner = await recoveryBanner($, e, els, a)
  // W5b: a sign-in started from the first-run card, an action or a bucket, once this install is signed in.
  const card = await signInMatchCard($, e, els, a)
  if (!banner && !card) return body
  const { Box } = els
  return (
    <Box flexDirection="column" gap={1}>
      {card}
      {banner}
      {body}
    </Box>
  )
}

/** Right after a recovery key is made: say why it matters and copy it, until copied or waved off. */
async function recoveryBanner($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement | null> {
  const l = await read($, link)
  const cfg = await serverCfg($)
  if (!l.recoveryFresh || !cfg.token || !cfg.recoveryKey) return null
  const { Box, Text, Button } = els
  return (
    <Box flexDirection="column">
      <Text color={ORANGE} wrap="wrap">
        {ACCOUNT.saveKey(cfg.handle ?? '')}
      </Text>
      <Box gap={1}>
        <Button key="recovery-copy" label={ACCOUNT.copyKey} variant="primary" onPress={() => a.copyRecoveryKey(e.surface)} />
        <Button key="recovery-saved" label={ACCOUNT.savedIt} onPress={() => a.recoverySaved()} />
      </Box>
    </Box>
  )
}

/** The ways in: pick a new handle, link with a code from another install, or a recovery key. */
async function joinBlock($: $, e: RenderInput<'Pane'>, els: El, a: Actions, prefix: string): Promise<RenderElement | null> {
  if (e.surface === 'mobile') return null
  const { Box, Button, Input, Text } = els
  const mode = await read($, joinMode)
  // W11: while the server takes no handle without a GitHub sign-in (and the button is on the card,
  // signInEntry), the handle box gives way to the line that says so: the handle is picked after signing in.
  const cf = await configOf($)
  const viaGitHub = signupsOf(cf.raw).githubRequired && providersOn(cf).length > 0
  return (
    <Box flexDirection="column" gap={1}>
      {mode === 'new' && viaGitHub && <Text wrap="wrap">{MOD.githubFirst}</Text>}
      {mode === 'new' && !viaGitHub && <Input key={`${prefix}join`} label="Handle" placeholder="2 to 20 of a-z, 0-9 and _" submitLabel="Join" onSubmit={v => a.signup(v)} />}
      {mode === 'link' && <Input key={`${prefix}link`} label={ACCOUNT.codeLabel} placeholder={ACCOUNT.codePlaceholder} submitLabel={ACCOUNT.codeSubmit} onSubmit={v => a.joinWithCode(v)} />}
      {mode === 'recover' && <Input key={`${prefix}recover`} label={ACCOUNT.keyLabel} placeholder={ACCOUNT.keyPlaceholder} submitLabel={ACCOUNT.keySubmit} onSubmit={v => a.recoverWith(v)} />}
      <Box gap={1}>
        {mode !== 'new' && <Button key={`${prefix}mode-new`} label={ACCOUNT.newHandle} onPress={() => a.setJoinMode('new')} />}
        {mode !== 'link' && <Button key={`${prefix}mode-link`} label={ACCOUNT.linkWith} onPress={() => a.setJoinMode('link')} />}
        {mode !== 'recover' && <Button key={`${prefix}mode-recover`} label={ACCOUNT.recoverWith} onPress={() => a.setJoinMode('recover')} />}
      </Box>
    </Box>
  )
}

/**
 * A bucket's checklist, in Queue's place while it can't be queued yet (W3b): each row as the
 * server sent it, met or not yet, and what fixes an unmet one. Install the App is a Link to the
 * server's url, drawn only when `installAppUrlOk` passes it (one bad href would refuse the whole
 * pane). Sign in with GitHub is a Button that starts W5b's sign-in (`checklistSignIn`). Any
 * other action draws nothing here; a hidden one (config has its feature off) draws nothing either.
 */
function checklistBox(els: El, b: Bucket, a: Actions): RenderElement {
  const { Box, Text, Button, Link } = els
  return (
    <Box flexDirection="column">
      <Text bold wrap="wrap">
        {BUCKET.checklist(b.label)}
      </Text>
      {b.requires.map(r => {
        const act = r.met || !r.action || r.action.hidden ? null : r.action
        const install = act?.do === 'install_app' && installAppUrlOk(act.url) ? act : null
        const signin = act?.do === 'signin' ? act : null
        return (
          <Box key={`req-${b.id}-${r.id}`} gap={1} alignItems="center" flexWrap="wrap">
            <Text dimColor={r.met} wrap="wrap">
              {r.met ? BUCKET.met(r.label) : BUCKET.unmet(r.label)}
            </Text>
            {install && <Link href={install.url} label={install.label ?? BUCKET.install} />}
            {signin && checklistSignInReady && <Button key={`req-${b.id}-${r.id}-go`} label={signin.label ?? r.label} onPress={() => a.checklistSignIn(signin.provider)} />}
          </Box>
        )
      })}
    </Box>
  )
}

// The checklist's sign-in step: W3b's seam, filled by W5b's sign-in driver. The row's button
// starts the provider's sign-in from the bucket (`startSignIn($, provider, 'bucket')`), whose
// card draws on the Match tab above the Ranked box. After a link or an unlink lands the mod
// reads config again (`refreshConfig($, 'bucket')`, in applySignIn and unlinkProvider): the
// checklist's `met` moves without moving config's version.
const checklistSignInReady: boolean = true
async function checklistSignIn($: $, provider: Provider) {
  await startSignIn($, provider, 'bucket')
}

async function rankedBody($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Input } = els
  const rich = e.surface !== 'terminal'
  const cfg = await serverCfg($)
  const l = await read($, link)
  const sh = await rankedShared($)
  const s = await read($, settings)
  const draft = await read($, chatDraft)
  const me = cfg.handle ?? ''
  // Usage weeks: while both switches are on for everyone, the setup pane says what Model stats will send, before a handle is picked.
  const setupRaw = !cfg.token || l.unknownToken ? (await configOf($)).raw : null
  const setupUsage = !!setupRaw && captureOn(setupRaw) && usageOn(setupRaw)

  if (!cfg.token || l.unknownToken)
    return (
      <Box flexDirection="column" gap={1}>
        {rich ? <Svg source={setupHero({ placementMatches: 3 })} alt={`${LINES.handle} Everyone starts in the mud.`} /> : <Text bold>{LINES.handle}</Text>}
        {signupsOf((await configOf($)).raw).line && (
          <Text color={ORANGE} wrap="wrap">
            {MOD.lineOpen}
          </Text>
        )}
        {await joinBlock($, e, els, a, 'match-')}
        {await signInEntry($, e, els, a, 'first_run')}
        {l.note && (
          <Text color={ORANGE} wrap="wrap">
            {l.note}
          </Text>
        )}
        <Box gap={1} alignItems="center">
          <Text>Grind tracking</Text>
          <Button key="setup-track-on" label="On" variant={s.tracking ? 'primary' : 'secondary'} onPress={() => a.setTracking(true)} />
          <Button key="setup-track-off" label="Off" variant={s.tracking ? 'secondary' : 'primary'} onPress={() => a.setTracking(false)} />
        </Box>
        <Box gap={1} alignItems="center">
          <Text>Show my commit titles to opponents</Text>
          <Button key="setup-share-on" label="On" variant={s.share ? 'primary' : 'secondary'} onPress={() => a.setShare(true)} />
          <Button key="setup-share-off" label="Off" variant={s.share ? 'secondary' : 'primary'} onPress={() => a.setShare(false)} />
        </Box>
        <Text dimColor>{LINES.privacy}</Text>
        {setupUsage && (
          <Text key="setup-usage" dimColor wrap="wrap">
            {EVAL.usageSetup}
          </Text>
        )}
        <Text dimColor>{MOD.autoUpdate}</Text>
      </Box>
    )

  const q = l.queue
  const cf = await configOf($, cfg)
  // The lengths offered to you (GET /queue's lanes), and their labels; a length they don't hold takes config's catalog label, else the mod's own.
  const offered: ApiLane[] = l.lanes ?? []
  const catalog = catalogOf(cf.raw)
  const label = (min: number) => labelFor(min, offered, catalog)
  // W3b: config's buckets. With more than one, the queued view and the ready check say which bucket (its label, the server's, as Text).
  const list = bucketsOf(cf)
  const bucketLine = (id: string) => {
    const name = bucketRowShown(list) ? list.find(b => b.id === id)?.label : undefined
    return name ? <Text dimColor>{name}</Text> : null
  }
  if (sh.phase === 'idle') {
    // W3b: the bucket on screen (the row's pick while config lists it, else Open) and where you stand there. One bucket: no row, and Open's card as before.
    const onScreen = pickBucket(list, sh.bucket)
    const bid = onScreen?.id ?? OPEN
    // Its lanes only: another bucket's still cached (a read in flight when the row moved, say) draw nothing until its own land.
    const shown: ApiLane[] = lanesIn(l, onScreen?.id ?? null) ?? []
    const picked = pickedLengths(sh.lengthsMin, shown)
    const lanes = shown.map(x => ({ min: x.length_min, label: x.label, hours: x.length_min / 60, ticked: picked.includes(x.length_min), wait: waitLabel(x.wait_ms), waiting: x.waiting, swing: x.swing }))
    // The picker line names only lengths offered: the shortest and the longest lane.
    const line = pickerLine(shown.map(x => x.label))
    const mine = meIn(l, bid)
    const myRank = rankIn(l, bid)
    const placing = mine?.placement ?? undefined
    const recent = (recentIn(l, bid) ?? []).slice(0, 3).map(recentRow)
    // Below the server's floor: Update takes Queue's place (the server would refuse the queue anyway).
    const gated = standing(l.release) === 'required'
    // The server's checklist for the bucket on screen isn't met: it takes Queue's place (the server enforces it; the mod draws it as sent).
    // Only with a row left to meet: `can_queue` false with nothing unmet (Open sent without it, say) draws Queue, and the server says no if it must.
    const blocked = !gated && !cf.practiceOnly && !!onScreen && !onScreen.canQueue && onScreen.requires.some(r => !r.met)
    return (
      <Box flexDirection="column" gap={1}>
        {bucketRowShown(list) && (
          <Box flexDirection="column">
            <Box gap={1} flexWrap="wrap">
              {list.map(b => (
                <Button key={`bucket-${b.id}`} label={b.label} variant={b.id === bid ? 'primary' : 'secondary'} onPress={() => a.chooseBucket(b.id)} />
              ))}
            </Box>
            {onScreen?.blurb && (
              <Text dimColor wrap="wrap">
                {onScreen.blurb}
              </Text>
            )}
          </Box>
        )}
        {rich ? (
          <Svg
            source={queueBar({ lanes: lanes.map(x => ({ hours: x.hours, ticked: x.ticked, wait: x.wait, waiting: x.waiting, swing: x.swing ?? undefined })), line })}
            alt={`Queue up. Lose in public. ${line ? `${line} ` : ''}${lanes.map(x => `${x.label} ${x.ticked ? 'ticked' : 'not ticked'}, ${x.wait}, ${x.waiting} waiting${x.swing !== null ? `, swing ${x.swing}` : ''}`).join('. ')}.`}
          />
        ) : (
          <Box flexDirection="column">
            <Box gap={1}>
              <Text bold color={ORANGE}>
                QUEUE UP.
              </Text>
              <Text dimColor>Lose in public.</Text>
            </Box>
            {line && <Text dimColor>{line}</Text>}
            {lanes.map(x => (
              <Text color={x.ticked ? ORANGE : STONE}>
                {x.ticked ? '◉' : '○'} {x.label} · {x.wait} · {x.waiting} waiting{x.swing !== null ? ` · ±${x.swing}` : ''}{x.ticked ? '' : ' · off'}
              </Text>
            ))}
            <Text dimColor>1 pick lengths › 2 queue › 3 accept in 60s › 4 ship before the bell</Text>
          </Box>
        )}
        <Box gap={1} alignItems="center">
          {lanes.map(x => (
            <Button key={`rl-${x.min}`} label={`${x.ticked ? '✓ ' : ''}${x.label}`} onPress={() => a.toggleLength(x.min)} />
          ))}
          {gated ? (
            <Button key="ranked-update" label="Update" variant="primary" onPress={x => a.updateMod(x.surface)} />
          ) : cf.practiceOnly ? (
            // Ranked is paused for this player (queue.practice_only): the line takes Queue's place.
            // W11: for an account still waiting its turn, where it stands, in the same place.
            <Text color={ORANGE} wrap="wrap">
              {lineOf(cf.raw).waiting ? MOD.inLine(lineOf(cf.raw).ahead) : MOD.rankedPaused}
            </Text>
          ) : blocked ? null : (
            <Button key="ranked-queue" label="Queue" variant="primary" onPress={() => a.queue()} />
          )}
        </Box>
        {!gated && cf.practiceOnly && lineOf(cf.raw).waiting && (
          <Text dimColor wrap="wrap">
            {MOD.inLineMore}
          </Text>
        )}
        {gated && l.release && (
          <Text color={ORANGE} wrap="wrap">
            {MOD.updateNeeded(l.release.min, VERSION)}
          </Text>
        )}
        {gated && l.updateNote && (
          <Text dimColor wrap="wrap">
            {l.updateNote}
          </Text>
        )}
        {blocked && onScreen && checklistBox(els, onScreen, a)}
        {l.note && (
          <Text color={ORANGE} wrap="wrap">
            {l.note}
          </Text>
        )}
        {mine &&
          (rich ? (
            <Svg
              source={ratingCard({ rating: mine.rating, rank: myRank ?? undefined, wins: mine.record.w, losses: mine.record.l, placing })}
              alt={placing ? `Mud, placing ${placing.played} of ${placing.of}, ${mine.record.w}-${mine.record.l}.` : `${mine.tier} ${mine.rating}${myRank ? `, rank ${myRank}` : ''}, ${mine.record.w}-${mine.record.l}.`}
            />
          ) : (
            <Text bold>
              {placing ? `Mud · placing ${placing.played} of ${placing.of}` : `${mine.tier} ${mine.rating}${myRank ? ` · #${myRank}` : ''}`} · {mine.record.w}-{mine.record.l}
            </Text>
          ))}
        {mine && mine.matches_played === 0 ? (
          <Text dimColor>{LINES.noHistory}</Text>
        ) : recent.length > 0 ? (
          rich ? (
            <Svg source={recentMatches(recent)} alt={`Recent: ${recent.map(x => `${x.result} ${x.mine}-${x.theirs} vs ${x.opponent}`).join('; ')}`} />
          ) : (
            <Box flexDirection="column">
              {recent.map(x => (
                <Text dimColor>
                  {x.day} {x.result === 'won' ? 'W' : x.result === 'lost' ? 'L' : 'D'} {x.label} {x.mine}-{x.theirs} vs {x.opponent} {x.rated === false ? CHALLENGE.unrated : `${x.delta >= 0 ? '+' : ''}${x.delta}`}
                </Text>
              ))}
            </Box>
          )
        ) : null}
        {await challengeBox($, e, els, a, t)}
      </Box>
    )
  }

  if (sh.phase === 'queued') {
    const secs = Math.max(0, Math.round((t - sh.since) / 1000))
    // W3b: your standing in the bucket the server queued you in: placing there draws text, so its hidden rating never shows.
    const qb = sh.bucket ?? OPEN
    const mine = meIn(l, qb)
    const half = q?.range ? Math.round((q.range.max - q.range.min) / 2) : 60
    const center = q?.range ? Math.round((q.range.max + q.range.min) / 2) : (mine?.rating ?? 1000)
    const widens = (q?.widening ?? []).map(w => ({ range: Math.round((w.range.max - w.range.min) / 2), label: `+${Math.max(1, Math.round(w.after_ms / 60_000))} min` }))
    // What the server queued you for, each with the lane's waiting count and ratings.
    const waiting = sh.queuedMin.map(min => {
      const lane = offered.find(x => x.length_min === min)
      return { min, hours: min / 60, count: lane?.waiting ?? 0, ratings: lane?.ratings ?? [] }
    })
    return (
      <Box flexDirection="column" gap={1}>
        {bucketLine(qb)}
        {rich && mine && !mine.placement ? (
          <Svg
            source={queueSvg({ seconds: secs, hours: waiting.map(w => w.hours), rating: center, range: half, widens, waiting: waiting.map(w => ({ hours: w.hours, count: w.count, ratings: w.ratings })) })}
            alt={`In queue ${mmss(secs * 1000)} for ${andList(waiting.map(w => label(w.min)))}, searching ${center} plus or minus ${half}.`}
          />
        ) : (
          <Box flexDirection="column">
            <Text bold>
              In the queue · {mmss(secs * 1000)} · {andList(waiting.map(w => label(w.min)))}
            </Text>
            {waiting.map(w => (
              <Text dimColor>
                {label(w.min)}: {w.count} waiting
              </Text>
            ))}
          </Box>
        )}
        <Text dimColor>{LINES.queue[Math.floor(secs / 8) % LINES.queue.length]}</Text>
        {await matchNotice($, e, els, a, 'queue')}
        <Box>
          <Button key="ranked-leave" label="Leave queue" onPress={() => a.leaveQueue()} />
        </Box>
        {l.note && (
          <Text color={ORANGE} wrap="wrap">
            {l.note}
          </Text>
        )}
      </Box>
    )
  }

  if (sh.phase === 'offered' && q?.offer) {
    const o = q.offer
    const secs = Math.max(0, Math.round((Date.parse(o.expires_at) - t) / 1000))
    // W3b: the ready check stands you in the offer's bucket: its rating, record, rank and placement, as the opponent's and the stakes are.
    const ob = offerBucket(o, sh)
    const mine = meIn(l, ob)
    // W6b: a challenge's ready check is unrated: UNRATED where the stakes go, never +0, and it runs longer than a minute.
    const challenge = o.kind === 'challenge'
    return (
      <Box flexDirection="column" gap={1}>
        {bucketLine(ob)}
        {rich && mine ? (
          <Svg
            source={readyCheck({
              hours: o.length_min / 60,
              seconds: secs,
              me: { handle: mine.handle, rating: mine.rating, wins: mine.record.w, losses: mine.record.l, rank: rankIn(l, ob) ?? 0, placing: mine.placement ?? undefined },
              them: { handle: o.opponent.handle, rating: o.opponent.rating, wins: o.opponent_record.w, losses: o.opponent_record.l, rank: o.opponent_rank ?? 0, placing: o.opponent.placement ?? undefined },
              stakes: challenge ? null : o.stakes,
              ...(challenge ? { mode: 'challenge' as const, of: offerSeconds(cf, secs) } : {}),
            })}
            alt={challenge ? `Challenge: ${o.opponent.handle}, ${label(o.length_min)}. ${secs} seconds to accept. Unrated.` : `Opponent found: ${o.opponent.handle}, ${label(o.length_min)}. ${secs} seconds to accept. Win ${o.stakes.win}, draw ${o.stakes.draw}, loss ${o.stakes.loss}.`}
          />
        ) : challenge ? (
          <Text bold>{CHALLENGE.readyText(o.opponent.handle, o.opponent.placement ? 'placing' : o.opponent.tier, label(o.length_min), secs)}</Text>
        ) : (
          <Text bold>
            Opponent found: {o.opponent.handle} ({o.opponent.placement ? 'placing' : o.opponent.tier}) · {label(o.length_min)} · {secs}s to accept · win +{o.stakes.win} / loss {o.stakes.loss}
          </Text>
        )}
        {challenge ? !o.you_accepted && <Text>{CHALLENGE.readyTaken(o.opponent.handle)}</Text> : <Text>{LINES.found}</Text>}
        {o.you_accepted ? (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Text dimColor>Accepted. Waiting for {o.opponent.handle}.</Text>
            {/* W6b: a challenge's taker waits on the sender for minutes (max(2 minutes, 2.5 x poll_ms.inbox)), not a ranked check's one: they can still back out. */}
            {challenge && <Button key="ranked-decline" label="Decline" onPress={() => a.decline()} />}
          </Box>
        ) : (
          <Box gap={1}>
            <Button key="ranked-accept" label="Accept" variant="primary" onPress={() => a.accept()} />
            <Button key="ranked-decline" label="Decline" onPress={() => a.decline()} />
          </Box>
        )}
        {l.note && (
          <Text color={ORANGE} wrap="wrap">
            {l.note}
          </Text>
        )}
      </Box>
    )
  }

  const r = l.ranked
  if ((sh.phase === 'live' || sh.phase === 'done') && r?.summary) {
    const sm = r.summary
    const race = raceFromServer(r, me, t)
    const { mine, them } = rankedSides(sm, me)
    const live = sm.status === 'live' || sm.status === 'grace'
    const closed = sm.status === 'finished' || sm.status === 'void'
    const left = sm.deadline ? Date.parse(sm.deadline) - t : 0
    const hot = sm.status === 'live' && left <= warnMs(sm)
    const scores = r.events.filter((x): x is Extract<typeof x, { kind: 'score' }> => x.kind === 'score').slice(-12).reverse()
    const chats = r.events.filter((x): x is Extract<typeof x, { kind: 'chat' }> => x.kind === 'chat').slice(-8)
    const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
    const line = closed ? rankedResultLine(sm, me) : ''
    const asking = await read($, forfeitAsk)
    // W6b: a challenge's match says so, and its result is unrated (never +0). After any match, Rematch sends them a challenge.
    const challenge = sm.kind === 'challenge'
    const kindWord = challenge ? CHALLENGE.liveText(label(sm.length_min)) : `Ranked ${label(sm.length_min)}`
    const rematch = closed && !cf.practiceOnly && challengesOf(cf).send && (await challengesLive($))
    return (
      <Box flexDirection="column" gap={1}>
        {live && l.online === false && <Text color={ORANGE}>{MOD.offline}</Text>}
        {live && (await feedNoticeLines($, e, els, a, r))}
        {rich && race && !closed && <Svg source={raceClimb(race)} alt={`${kindWord}: ${mine.player.handle} ${mine.points}, ${them.player.handle} ${them.points}. ${clock(left)} to the bell.`} />}
        {closed && (await finisherBlock($, e, els, a, sm, me))}
        {rich && race && closed && (
          <Svg
            source={result({
              outcome: rankedOutcome(sm, me),
              mode: modeWord(sm),
              race,
              delta,
              ratingBefore: mine.rating_before,
              ratingAfter: mine.rating_after ?? mine.rating_before,
              commits: { mine: mine.commits, theirs: them.commits },
              biggest: { points: mine.biggest_commit?.points ?? 0, craft: (mine.biggest_commit?.craft as 'clean' | 'neutral' | 'sloppy' | undefined) ?? 'neutral' },
              placing: placingOfSide(mine),
              ...unratedOf(sm),
            })}
            alt={line}
          />
        )}
        {(!rich || !race) && (
          <Text bold>
            {kindWord} · {mine.player.handle} {mine.points} vs {them.points} {them.player.handle} · {closed ? line : sm.deadline ? `${clock(left)} to the bell` : sm.status}
          </Text>
        )}
        {closed && rich && <Text bold>{line}</Text>}
        {sm.status === 'grace' && (
          <Box flexDirection="column">
            <Text color={ORANGE}>{countingLine(sm, t)}</Text>
            <Text dimColor>{MOD.countingRule}</Text>
          </Box>
        )}
        {hot && them.points > mine.points && (
          <Text bold color={ORANGE}>
            {LINES.behind(them.points - mine.points)}
          </Text>
        )}
        {sm.status === 'live' && asking ? (
          <Box gap={1} alignItems="center" flexWrap="wrap">
            <Text bold color={ORANGE}>
              {LINES.forfeit}
            </Text>
            <Button key="ranked-forfeit-yes" label="Forfeit" onPress={() => a.rankedForfeit()} />
            <Button key="ranked-forfeit-no" label="Keep playing" variant="primary" onPress={() => a.askForfeit(false)} />
          </Box>
        ) : (
          <Box gap={1} flexWrap="wrap">
            {live && <Button key="ranked-titles" label={`Titles: ${s.share ? 'shown' : 'private'}`} onPress={() => a.setShare(!s.share)} />}
            {sm.status === 'live' && <Button key="ranked-forfeit" label="Forfeit" onPress={() => a.askForfeit(true)} />}
            {closed && !cf.practiceOnly && <Button key="ranked-again" label="Queue again" variant="primary" onPress={() => a.queueAgain('pane')} />}
            {rematch && <Button key="ranked-rematch" label={CHALLENGE.rematch} onPress={() => a.challengeRematch(them.player.handle, sm.length_min)} />}
            {closed && <Button key="ranked-recap" label="Copy recap" onPress={x => a.copyRecap(x.surface)} />}
            {closed && <Button key="ranked-clear" label="Dismiss" onPress={() => a.rankedClear()} />}
          </Box>
        )}
        {closed && (await matchNotice($, e, els, a, 'result'))}
        {rich && scores.length > 0 ? (
          <Svg
            source={feedSvg(scores.map(x => ({ at: hhmm(Date.parse(x.at)), mine: x.handle === me, handle: x.handle, points: x.points, craft: x.craft, category: x.category, title: x.title, files: x.files, lines: x.lines_added + x.lines_deleted })))}
            alt={`Feed: ${scores.map(x => `${x.handle} +${x.points} ${x.category}`).join('; ')}`}
          />
        ) : scores.length > 0 ? (
          scores.map(x => (
            <Text color={x.handle === me ? undefined : STONE} wrap="truncate-end">
              {hhmm(Date.parse(x.at))} {x.handle.padEnd(11)} +{x.points} {x.category}
              {x.title ? ` · ${clean(x.title)}` : ` · ${x.files} file${x.files === 1 ? '' : 's'}, ${x.lines_added + x.lines_deleted} lines`}
            </Text>
          ))
        ) : (
          <Text dimColor>No commits yet. Only commits score.</Text>
        )}
        {s.surfaces.chat === 'on' ? (
          <Box flexDirection="column">
            <Text dimColor>{LINES.chatExplainer}</Text>
            {!them.chat_enabled && <Text dimColor>{them.player.handle} has chat off.</Text>}
            {chats.map(c => (
              <Box gap={1}>
                <Text bold color={c.handle === me ? ORANGE : undefined}>
                  {clean(c.handle)}:
                </Text>
                <Text wrap="truncate-end">{clean(c.text)}</Text>
              </Box>
            ))}
            {!cf.chat.match ? (
              <Text dimColor>{MOD.chatPaused}</Text>
            ) : (
              them.chat_enabled &&
              e.surface !== 'mobile' && <Input key="ranked-chat" placeholder={LINES.chatPlaceholder[chats.length % 2]} submitLabel="Send" value={draft} onInput={v => a.setDraft(v)} onSubmit={v => a.rankedChat(v)} />
            )}
          </Box>
        ) : (
          <Text dimColor>Chat is off. {them.player.handle} can see that.</Text>
        )}
      </Box>
    )
  }
  return <Text dimColor>Checking with the server.</Text>
}

/** One of yours as the box says it, by how it stands; null for one with nobody to name. */
function outgoingLine(x: Challenge) {
  const who = x.takenBy?.handle ?? x.to?.handle ?? null
  if (x.status === 'pending') return x.to ? CHALLENGE.waiting(x.to.handle, x.label) : CHALLENGE.open(x.label, x.id)
  if (x.status === 'cancelled') return CHALLENGE.withdrawn(x.label)
  if (x.status === 'expired') return CHALLENGE.expired(x.label)
  if (!who) return null
  if (x.status === 'accepted') return CHALLENGE.taken(who, x.label)
  if (x.status === 'played') return CHALLENGE.played(who, x.label)
  return CHALLENGE.declined(who, x.label)
}

/**
 * The challenge box on the Match tab, between matches (W6b), while challenges are on here: the
 * challenges to you, each with its message as Text (only while the Chat switch is on), Accept,
 * Decline, Mute and Report; yours, by how they stand, with Copy link and Withdraw; the form
 * (a handle, or open, the length and the bucket, a message); and the code box, which takes a
 * code or its ccsr.gg link. On mobile the inputs are left out: open challenges, a form a Rematch
 * filled in, and the cards still work. A full hairline border, never a single-side edge.
 */
async function challengeBox($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement | null> {
  if (!(await boxIsMine($))) return null
  const { Box, Text, Button, Input } = els
  const cf = await configOf($)
  const c = challengesOf(cf)
  const ui = await read($, challengeUi)
  const l = await read($, link)
  const sh = await rankedShared($)
  const chatOn = (await read($, settings)).surfaces.chat === 'on'
  const me = (await serverCfg($)).handle ?? ''
  const mobile = e.surface === 'mobile'
  // Ranked paused for this player: the server refuses sending and taking alike (403 ranked_paused), so neither is offered.
  const paused = cf.practiceOnly
  const buckets = bucketsOf(cf)
  const inBucket = (id: string) => (bucketRowShown(buckets) && id !== OPEN ? buckets.find(b => b.id === id)?.label : undefined)
  const words = (id: string) => (chatOn ? (challengeMessages.get(id) ?? null) : null)
  const incoming = (ui.incoming ?? []).filter(x => x.status === 'pending' && x.expiresAt > t)
  const outgoing = ui.outgoing ?? []
  const form = ui.form
  const pick = form ? challengePick(cf, l, sh, form) : null
  const catalog = catalogOf(cf.raw)
  const cc = ui.code
  const ccChallenge = cc?.challenge ?? null
  const takeable = !!ccChallenge && !paused && ccChallenge.status === 'pending' && ccChallenge.expiresAt > t && ccChallenge.from.handle !== me && (ccChallenge.to === null || ccChallenge.to.handle === me)
  const ccWhy = !ccChallenge ? (cc?.problem || CHALLENGE.checking) : ccChallenge.from.handle === me ? CHALLENGE.ownCode : ccChallenge.status !== 'pending' || ccChallenge.expiresAt <= t ? CHALLENGE.closed : ccChallenge.to && ccChallenge.to.handle !== me ? CHALLENGE.forSomeoneElse : CHALLENGE.left(ccChallenge.expiresAt - t)
  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      <Text bold color={STONE}>
        {CHALLENGE.title.toUpperCase()}
      </Text>
      <Text dimColor wrap="wrap">
        {CHALLENGE.explainer}
      </Text>
      {incoming.slice(0, BOX_SHOWN).map(x => {
        const said = words(x.id)
        const where = inBucket(x.bucket)
        return (
          <Box key={`ch-in-${x.id}`} flexDirection="column">
            <Text bold wrap="wrap">
              {where ? CHALLENGE.incomingIn(x.from.handle, x.label, where) : CHALLENGE.incoming(x.from.handle, x.label)}
            </Text>
            <Text dimColor>{CHALLENGE.left(x.expiresAt - t)}</Text>
            {said !== null && <Text wrap="wrap">{said}</Text>}
            {ui.reportAsk === x.id ? (
              <Box gap={1} alignItems="center" flexWrap="wrap">
                <Text>{CHALLENGE.reportAsk(x.from.handle)}</Text>
                {(['spam', 'abuse', 'other'] as const).map(why => (
                  <Button key={`ch-report-${x.id}-${why}`} label={CHALLENGE.reasons[why]} onPress={() => a.challengeReport(x.id, why)} />
                ))}
                <Button key={`ch-report-${x.id}-cancel`} label={CHALLENGE.cancel} onPress={() => a.challengeAskReport(null)} />
              </Box>
            ) : (
              <Box gap={1} flexWrap="wrap">
                {!paused && <Button key={`ch-accept-${x.id}`} label={CHALLENGE.accept} variant="primary" onPress={() => a.challengeAccept(x.id, 'card')} />}
                <Button key={`ch-decline-${x.id}`} label={CHALLENGE.decline} onPress={() => a.challengeDecline(x.id)} />
                <Button key={`ch-mute-${x.id}`} label={CHALLENGE.mute} variant={ui.muteAsk === x.id ? 'primary' : 'secondary'} onPress={() => a.challengeMute(x.id)} />
                <Button key={`ch-report-${x.id}`} label={CHALLENGE.report} onPress={() => a.challengeAskReport(x.id)} />
              </Box>
            )}
          </Box>
        )
      })}
      {incoming.length > BOX_SHOWN && <Text dimColor>{CHALLENGE.more(incoming.length - BOX_SHOWN)}</Text>}
      {outgoing.slice(0, BOX_SHOWN).map(x => {
        const said = x.status === 'pending' ? words(x.id) : null
        const lineText = outgoingLine(x)
        if (lineText === null) return null
        const open = x.status === 'pending' && x.expiresAt > t
        return (
          <Box key={`ch-out-${x.id}`} flexDirection="column">
            <Box gap={1} alignItems="center" flexWrap="wrap">
              <Text dimColor={!open} wrap="wrap">
                {lineText}
              </Text>
              {open && <Text dimColor>{CHALLENGE.left(x.expiresAt - t)}</Text>}
              {open && challengeHref(x.id) && <Button key={`ch-copy-${x.id}`} label={CHALLENGE.copyLink} onPress={p => a.challengeCopy(x.id, p.surface)} />}
              {open && <Button key={`ch-withdraw-${x.id}`} label={CHALLENGE.withdraw} onPress={() => a.challengeDecline(x.id)} />}
            </Box>
            {said !== null && (
              <Text dimColor wrap="wrap">
                {said}
              </Text>
            )}
          </Box>
        )
      })}
      {outgoing.length > BOX_SHOWN && <Text dimColor>{CHALLENGE.more(outgoing.length - BOX_SHOWN)}</Text>}
      {paused ? (
        <Text color={ORANGE} wrap="wrap">
          {CHALLENGE.paused}
        </Text>
      ) : !c.send ? (
        <Text dimColor wrap="wrap">
          {CHALLENGE.sendPaused}
        </Text>
      ) : form && pick ? (
        <Box flexDirection="column">
          <Text bold wrap="wrap">
            {form.kind === 'open' ? CHALLENGE.formOpen : form.handle ? CHALLENGE.formHandle(form.handle) : CHALLENGE.formHandleless}
          </Text>
          {form.kind === 'handle' && !mobile && <Input key="challenge-handle" label={CHALLENGE.handleLabel} placeholder={CHALLENGE.handlePlaceholder} value={form.handle} onInput={v => a.challengePick({ handle: v })} onSubmit={() => a.challengeSend()} />}
          {form.kind === 'handle' && mobile && !form.handle && <Text dimColor wrap="wrap">{CHALLENGE.noHandleHere}</Text>}
          {pick.usable.length > 1 && (
            <Box gap={1} flexWrap="wrap">
              {pick.usable.map(b => (
                <Button key={`ch-bucket-${b.id}`} label={b.label} variant={b.id === pick.bucket ? 'primary' : 'secondary'} onPress={() => a.challengePick({ bucket: b.id })} />
              ))}
            </Box>
          )}
          {pick.lengths.length === 0 ? (
            <Text dimColor>{CHALLENGE.noLength}</Text>
          ) : (
            <Box gap={1} flexWrap="wrap">
              {pick.lengths.map(m => (
                <Button key={`ch-len-${m}`} label={labelFor(m, pick.lanes, catalog)} variant={m === pick.lengthMin ? 'primary' : 'secondary'} onPress={() => a.challengePick({ lengthMin: m })} />
              ))}
            </Box>
          )}
          {c.message_max > 0 && chatOn && !mobile && <Input key="challenge-message" label={CHALLENGE.messageLabel} placeholder={CHALLENGE.messagePlaceholder(c.message_max)} value={challengeDraft} onInput={v => a.challengeDraft(v)} onSubmit={() => a.challengeSend()} />}
          <Box gap={1}>
            {!(form.kind === 'handle' && mobile && !form.handle) && pick.lengthMin !== null && <Button key="challenge-send" label={CHALLENGE.send} variant="primary" onPress={() => a.challengeSend()} />}
            <Button key="challenge-cancel" label={CHALLENGE.cancel} onPress={() => a.challengeCancel()} />
          </Box>
        </Box>
      ) : (
        <Box gap={1} flexWrap="wrap">
          {!mobile && <Button key="challenge-new" label={CHALLENGE.challengeHandle} onPress={() => a.challengeStart('handle')} />}
          {c.open && <Button key="challenge-open" label={CHALLENGE.openOne} onPress={() => a.challengeStart('open')} />}
        </Box>
      )}
      {!mobile && !paused && <Input key="challenge-code" label={CHALLENGE.codeLabel} placeholder={CHALLENGE.codePlaceholder} submitLabel={CHALLENGE.lookUp} onSubmit={v => a.challengeCode(v)} />}
      {cc && (
        <Box flexDirection="column">
          {ccChallenge && (
            <Text bold wrap="wrap">
              {ccChallenge.to ? CHALLENGE.codeTo(ccChallenge.from.handle, ccChallenge.to.handle, ccChallenge.label) : CHALLENGE.codeOpen(ccChallenge.from.handle, ccChallenge.label)}
            </Text>
          )}
          {ccChallenge && words(ccChallenge.id) !== null && <Text wrap="wrap">{words(ccChallenge.id)}</Text>}
          <Text dimColor wrap="wrap">
            {ccWhy}
          </Text>
          <Box gap={1}>
            {takeable && <Button key="ch-code-accept" label={CHALLENGE.accept} variant="primary" onPress={() => a.challengeAccept(cc.code, 'code')} />}
            <Button key="ch-code-close" label={CHALLENGE.close} onPress={() => a.challengeCodeClose()} />
          </Box>
        </Box>
      )}
      {ui.note && (
        <Text color={ORANGE} wrap="wrap">
          {ui.note}
        </Text>
      )}
    </Box>
  )
}

async function matchTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Input } = els
  const rich = e.surface !== 'terminal'
  const m = await read($, match)
  const s = await read($, settings)
  const hist = await read($, history)
  const draft = await read($, chatDraft)
  const asking = await read($, forfeitAsk)
  const ranked = await rankedBox($, e, els, a, t)
  // While ranked is busy (queued, a ready check, a match, a result), practice steps aside.
  if ((await rankedShared($)).phase !== 'idle') return ranked

  if (!m) {
    return (
      <Box flexDirection="column" gap={1}>
        {ranked}
        <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
          <Text bold color={STONE}>
            PRACTICE
          </Text>
          <Text dimColor>{MOD.practice}</Text>
          <Box gap={1} flexWrap="wrap">
            <Button key="m-1" label="1h" onPress={() => a.start(1)} />
            <Button key="m-3" label="3h" onPress={() => a.start(3)} />
            <Button key="m-sprint" label="5 min sprint" onPress={() => a.start(1 / 12)} />
          </Box>
          {hist.length > 0 && (
            <Text dimColor wrap="truncate-end">
              Last practice: {resultWord(hist[0] as Match)} {(hist[0] as Match).myPoints}-{(hist[0] as Match).oppPoints} vs {(hist[0] as Match).opp.handle}
            </Text>
          )}
        </Box>
        {rich && hist.length > 0 && (
          <Svg
            source={recentMatches(
              hist.slice(0, 3).map(past => ({
                day: DAYS[(new Date(past.startAt).getDay() + 6) % 7] ?? '',
                result: outcomeOf(past),
                hours: past.hours,
                mine: past.myPoints,
                theirs: past.oppPoints,
                opponent: past.opp.handle,
                opponentRating: past.opp.rating,
                delta: past.kind === 'practice' && past.ratingAfter !== undefined ? past.ratingAfter - past.ratingBefore : 0,
                series: seriesOf(past),
              })),
            )}
            alt={`Recent practice: ${hist.slice(0, 3).map(past => `${resultWord(past)} ${past.myPoints}-${past.oppPoints} vs ${past.opp.handle}`).join('; ')}`}
          />
        )}
      </Box>
    )
  }

  const live = m.status === 'live'
  const oppPts = liveOpp(m, t)
  const span = m.deadline - m.startAt
  const label = m.kind === 'replay' ? `REPLAY · ${(m.label ?? '').toUpperCase().slice(0, 40)}` : `PRACTICE · ${hoursLabel(m.hours)}`
  const clockText = live ? clock(m.deadline - t) : resultWord(m).toUpperCase()
  const statusText = live
    ? `${m.opp.handle} · ${tierOf(m.opp.rating)} ${m.opp.rating} · paces ${Math.round(m.opp.pace)} pts/h`
    : m.kind === 'replay'
      ? `unrated replay over ${dur(span)} · bot seeded from the session`
      : `rating ${m.ratingBefore} -> ${m.ratingAfter ?? m.ratingBefore}`
  const feed = [...m.feed, ...m.plan.filter(p => p.at <= Math.min(t, m.deadline))].sort((x, y) => y.at - x.at)
  const w = Math.max(8, Math.min(30, e.props.bodyColumns - 26))
  const total = m.myPoints + oppPts

  return (
    <Box flexDirection="column" gap={1}>
      {!live && (await practiceFinisherBlock($, e, els, a, m))}
      {!live && <Text bold>{resultLine(m)}</Text>}
      {rich && !live ? (
        <Svg
          source={result({
            outcome: outcomeOf(m),
            mode: modeOf(m),
            race: raceOf(m, s.handle, t),
            delta: (m.ratingAfter ?? m.ratingBefore) - m.ratingBefore,
            ratingBefore: m.ratingBefore,
            ratingAfter: m.ratingAfter ?? m.ratingBefore,
            commits: { mine: m.feed.filter(f => f.who === 'me').length, theirs: m.plan.filter(p => p.at <= Math.min(m.endedAt ?? m.deadline, m.deadline)).length },
            biggest: { points: Math.max(0, ...m.feed.filter(f => f.who === 'me').map(f => f.points)), craft: 'neutral' },
          })}
          alt={`${resultWord(m)}: ${s.handle} ${m.myPoints}, ${m.opp.handle} ${oppPts}.`}
        />
      ) : rich ? (
        <Box flexDirection="column">
          <Svg source={raceClimb(raceOf(m, s.handle, t))} alt={`${label}. ${s.handle} ${m.myPoints}, ${m.opp.handle} ${oppPts}. ${clockText} to the bell.`} />
          <Text dimColor>{statusText}</Text>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Box gap={2}>
            <Text bold color={ORANGE}>{label}</Text>
            <Text bold>{clockText}</Text>
          </Box>
          <Text>
            {s.handle.padEnd(12)} <Text color={ORANGE}>{bar(total ? m.myPoints / Math.max(m.myPoints, oppPts) : 0, w)}</Text> {m.myPoints}
          </Text>
          <Text>
            {m.opp.handle.padEnd(12)} {bar(total ? oppPts / Math.max(m.myPoints, oppPts) : 0, w)} {oppPts}
          </Text>
          <Text dimColor>{statusText}</Text>
        </Box>
      )}
      {live && asking ? (
        <Box gap={1} alignItems="center" flexWrap="wrap">
          <Text bold color={ORANGE}>
            {LINES.forfeit}
          </Text>
          <Button key="forfeit-yes" label="Forfeit" onPress={() => a.forfeit()} />
          <Button key="forfeit-no" label="Keep playing" variant="primary" onPress={() => a.askForfeit(false)} />
        </Box>
      ) : (
        <Box gap={1}>
          {live && <Button key="forfeit" label="Forfeit" onPress={() => a.askForfeit(true)} />}
          {!live && <Button key="new" label="New match" variant="primary" onPress={() => a.clearMatch()} />}
          <Button key="share" label={`Titles: ${s.share ? 'shown' : 'private'}`} onPress={() => a.setShare(!s.share)} />
        </Box>
      )}
      {rich && feed.length > 0 ? (
        <Svg
          source={feedSvg(
            feed.slice(0, 12).map(f => ({
              at: hhmm(f.at),
              mine: f.who === 'me',
              handle: f.who === 'me' ? s.handle : m.opp.handle,
              points: f.points,
              craft: 'neutral',
              category: f.category,
              title: f.who === 'me' && f.title ? clean(f.title) : null,
              files: 0,
              lines: 0,
            })),
          )}
          alt={`Feed: ${feed.slice(0, 12).map(f => `${f.who === 'me' ? s.handle : m.opp.handle} +${f.points} ${f.category}`).join('; ')}`}
        />
      ) : (
      <Box flexDirection="column">
        <Text bold>Feed</Text>
        {feed.length === 0 && <Text dimColor>No points yet. The first commit lands here within a couple of seconds.</Text>}
        {feed.slice(0, 12).map(f => (
          <Text color={f.who === 'me' ? undefined : STONE} wrap="truncate-end">
            {new Date(f.at).toTimeString().slice(0, 5)} {f.who === 'me' ? s.handle.padEnd(11) : m.opp.handle.padEnd(11)} +{f.points} {f.category}
            {f.who === 'me' && f.title ? ` · ${clean(f.title)}` : ''}
          </Text>
        ))}
      </Box>
      )}
      {m.kind === 'practice' && s.surfaces.chat !== 'on' && <Text dimColor>Chat is off. Your opponent sees "chat off". Turn it back on in Settings.</Text>}
      {m.kind === 'practice' && s.surfaces.chat === 'on' && (
        <Box flexDirection="column">
          <Text dimColor>{LINES.chatExplainer}</Text>
          {m.chat.slice(-8).map(c => (
            <Box gap={1}>
              <Text bold color={c.who === s.handle ? ORANGE : undefined}>
                {clean(c.who)}:
              </Text>
              <Text wrap="truncate-end">{clean(c.text)}</Text>
            </Box>
          ))}
          {live && e.surface !== 'mobile' && (
            <Input key="chat" placeholder={LINES.chatPlaceholder[m.chat.length % 2]} submitLabel="Send" value={draft} onInput={v => a.setDraft(v)} onSubmit={v => a.chat(v)} />
          )}
        </Box>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------- ranked tab

// The mock standings everything shares (Jaen, 2026-10-07): jaen is #1 at 1712, 41-9, and
// is the one row left out here, since your own row is your real practice rating.
const SAMPLE: [string, number, string][] = [
  ['10xgary', 1688, '38-12'],
  ['nova_ships', 1655, '36-14'],
  ['rk', 1488, '30-14'],
  ['vex', 1391, '27-15'],
  ['tokyo_drift', 1340, '22-16'],
  ['quietcommit', 902, '5-11'],
]

async function rankedTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Svg } = els
  const rich = e.surface !== 'terminal'
  const l = await read($, link)
  // W3b: with more than one bucket, a row picks whose board shows (`board-<id>`); Open is the link as before buckets.
  const conf = await configOf($)
  const list = bucketsOf(conf)
  // W5b: while config has GitHub sign-in on, a handle with GitHub linked carries the ladder badge, on every bucket's board.
  const badges = providersOn(conf).includes('github')
  // While config's number_one.custom is on, the #1 card draws what its player set (their row's `number_one`), on every bucket's board.
  const custom = numberOneOn(conf.raw)
  const pick = bucketRowShown(list) ? pickBucket(list, (await read($, boardPick)).ranked) : null
  if (pick && pick.id !== OPEN) {
    const v = viewIn(l, pick.id)
    return boardRow(els, list, pick, a, v.me && v.ladder ? serverRanked(els, rich, v, badges, custom) : <Text dimColor>{BUCKET.loading}</Text>)
  }
  if (l.me && l.ladder) return boardRow(els, list, pick, a, serverRanked(els, rich, l, badges, custom))
  const r = await read($, rating)
  const rec = await read($, record)
  const s = await read($, settings)
  const rows = [...SAMPLE.map(([handle, rt, wl]) => ({ handle, rt, wl, me: false })), { handle: s.handle, rt: r, wl: `${rec.w}-${rec.l}${rec.d ? `-${rec.d}` : ''}`, me: true }].sort((x, y) => y.rt - x.rt)
  const pw = Math.max(15, ...rows.map(row => row.handle.length + 2))

  const top = rows[0]
  return boardRow(
    els,
    list,
    pick,
    a,
    <Box flexDirection="column" gap={1}>
      {top && numberOneCard(els, rich, { handle: top.handle, rating: top.rt, wins: Number(top.wl.split('-')[0]) || 0, losses: Number(top.wl.split('-')[1]) || 0 })}
      {rich ? <Svg source={ratingCard({ rating: r, wins: rec.w, losses: rec.l })} alt={`Practice rating ${r}, ${tierOf(r)}, ${rec.w}-${rec.l}.`} /> : null}
      {rich ? <Svg source={tierFrieze({ handle: s.handle, rating: r })} alt={`Tiers. You are ${tierOf(r)} at ${r}.`} /> : null}
      {rich ? (
        <Svg
          source={ladder(rows.map((row, i) => ({ rank: i + 1, handle: row.handle, rating: row.rt, wins: Number(row.wl.split('-')[0]) || 0, losses: Number(row.wl.split('-')[1]) || 0, me: row.me })))}
          alt={`Sample ladder: ${rows.map((row, i) => `${i + 1} ${row.handle} ${row.rt}`).join('; ')}`}
        />
      ) : null}
      <Text dimColor>Sample ladder with made-up players. Your row is real: your practice rating and record. The live ladder comes with the server.</Text>
      {!rich && (
        <Box flexDirection="column">
          <Text bold>{'#'.padEnd(4)}{'Player'.padEnd(pw)}{'Tier'.padEnd(10)}{'Elo'.padEnd(6)}W-L</Text>
          {rows.map((row, i) => (
            <Text bold={row.me} color={row.me ? ORANGE : undefined}>
              {String(i + 1).padEnd(4)}
              {row.handle.padEnd(pw)}
              {tierOf(row.rt).padEnd(10)}
              {String(row.rt).padEnd(6)}
              {row.wl}
            </Text>
          ))}
        </Box>
      )}
      <Text dimColor>
        Elo: K 40 for your first 10 matches, then 24. Win, loss or draw only. Tiers: Mud, Iron 650, Bronze 800, Silver 950, Gold 1100, Platinum 1250, Diamond 1400, Master 1600.
      </Text>
    </Box>,
  )
}

/**
 * The Ranked tab's bucket row over its body (W3b): one button per bucket (`board-<id>`, the
 * server's label as the button's text) and the picked bucket's blurb. With one bucket (`pick`
 * null) it is the body alone, exactly as before buckets.
 */
function boardRow(els: El, list: readonly Bucket[], pick: Bucket | null, a: Actions, body: RenderElement): RenderElement {
  if (!pick) return body
  const { Box, Text, Button } = els
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Box gap={1} flexWrap="wrap">
          {list.map(b => (
            <Button key={`board-${b.id}`} label={b.label} variant={b.id === pick.id ? 'primary' : 'secondary'} onPress={() => a.chooseBoard('ranked', b.id)} />
          ))}
        </Box>
        {pick.blurb && (
          <Text dimColor wrap="wrap">
            {pick.blurb}
          </Text>
        )}
      </Box>
      {body}
    </Box>
  )
}

/**
 * The Ranked tab from the server: your card (Mud while placing), the frieze, the top 10 and your
 * row. `githubBadges` (W5b, config's sign-in on): a handle with GitHub linked carries the badge.
 * `custom` (config's number_one.custom): the #1 card draws the line and X tag on the top row.
 */
function serverRanked(els: El, rich: boolean, l: LinkState, githubBadges = false, custom = false) {
  const { Box, Text, Svg } = els
  const me = l.me as ApiPlayer
  const placing = me.placement ?? undefined
  const rows = (l.ladder ?? []).map(x => ({ rank: x.rank, handle: x.player.handle, rating: x.player.rating, wins: x.w, losses: x.l, me: x.player.handle === me.handle, github: githubBadges && refLinked(x.player, 'github') }))
  const mineShown = rows.some(x => x.me)
  const ladderRows = mineShown || l.myRank === null ? rows : [...rows, null, { rank: l.myRank, handle: me.handle, rating: me.rating, wins: me.record.w, losses: me.record.l, me: true, github: githubBadges && refLinked(me, 'github') }]
  const top = l.ladder?.[0]
  return (
    <Box flexDirection="column" gap={1}>
      {top && numberOneCard(els, rich, { handle: top.player.handle, rating: top.player.rating, wins: top.w, losses: top.l }, custom ? numberOneOf(top) : null)}
      {rich && <Svg source={ratingCard({ rating: me.rating, rank: l.myRank ?? undefined, wins: me.record.w, losses: me.record.l, placing })} alt={placing ? `Mud, placing ${placing.played} of ${placing.of}.` : `${me.tier} ${me.rating}${l.myRank ? `, #${l.myRank}` : ''}, ${me.record.w}-${me.record.l}.`} />}
      {rich && <Svg source={tierFrieze({ handle: me.handle, rating: me.rating, placing })} alt={placing ? 'Tiers. You are placing in Mud.' : `Tiers. You are ${me.tier} at ${me.rating}.`} />}
      {rich && ladderRows.length > 0 ? (
        <Svg source={ladder(ladderRows)} alt={`Ranked: ${rows.map(x => `${x.rank} ${x.handle} ${x.rating}${x.github ? ` ${PROVIDER_NAMES.github}` : ''}`).join('; ')}`} />
      ) : (
        <Box flexDirection="column">
          {ladderRows.length === 0 && <Text dimColor>Nobody is ranked yet.</Text>}
          {ladderRows.map(x =>
            x ? (
              <Text bold={x.me} color={x.me ? ORANGE : undefined}>
                {String(x.rank).padEnd(4)}
                {x.handle.padEnd(16)}
                {String(x.rating).padEnd(6)}
                {x.wins}-{x.losses}
                {x.github ? `  ${PROVIDER_NAMES.github}` : ''}
              </Text>
            ) : (
              <Text dimColor>...</Text>
            ),
          )}
        </Box>
      )}
      {placing ? <Text dimColor>{MOD.notRanked}</Text> : l.myRank && l.myRank > 30 ? <Text dimColor>{LINES.farDown(l.myRank)}</Text> : null}
    </Box>
  )
}

let roastIndex = 2

/** Where the #1 card's X tag may go: a profile on x.com, nowhere else. */
const X_HOSTS: readonly string[] = ['x.com']

/**
 * The #1 card (copy.md): the #1 player's coin and stat line, and one line under them. That line
 * is one roast from the pool, a new one each visit to Ranked, unless `own` (config's
 * number_one.custom, and what the server sends on their row) carries the line they set. Their X
 * tag, when it carries one, is a link under the card.
 */
function numberOneCard(els: El, rich: boolean, top: { handle: string; rating: number; wins: number; losses: number }, own: NumberOneOwn | null = null) {
  const { Box, Text, Svg, Link } = els
  const roast = own?.line ?? (ROASTS[roastIndex % ROASTS.length] ?? '').replace(/\{handle\}/g, top.handle)
  const href = own?.x ? xProfile(own.x) : null
  const tag = own?.x && safeLink(href, X_HOSTS) ? <Link key="number-one-x" href={href} label={LINES.onX(own.x)} /> : null
  if (rich) {
    // The drawing holds three short lines; the alt keeps the line whole.
    const card = <Svg source={numberOne({ ...top, roast: own?.line ? fitCardLine(own.line) : roast })} alt={`${LINES.numberOne}: ${top.handle}, ${top.rating}. ${roast}`} />
    if (!tag) return card
    return (
      <Box flexDirection="column">
        {card}
        {tag}
      </Box>
    )
  }
  return (
    <Box flexDirection="column">
      <Text dimColor>{LINES.numberOne.toUpperCase()}</Text>
      <Text bold color={ORANGE}>
        {top.handle} · {tierOf(top.rating)} · {top.rating} Elo · {top.wins}-{top.losses}
      </Text>
      <Text>{roast}</Text>
      {tag}
    </Box>
  )
}

// ---------------------------------------------------------------- chat tab

const SYSTEM_LINE: Record<'placed' | 'promoted' | 'reached_number_one', (h: string, tier: string) => string> = {
  // Approved (docs/copy.md, "The mod").
  placed: (h, tier) => `${h} placed in ${tier}.`,
  promoted: (h, tier) => `${h} reached ${tier}.`,
  reached_number_one: h => `${h} is the new #1.`,
}

async function chatTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Input } = els
  const rich = e.surface !== 'terminal'
  const cfg = await serverCfg($)
  const l = await read($, link)
  const s = await read($, settings)
  const draft = await read($, chatDraft)
  if (!cfg.token)
    return (
      <Box flexDirection="column">
        <Text dimColor>Pick a handle in Settings to chat.</Text>
        <Button key="chat-join" label="Open Settings" onPress={() => a.setTab('settings')} />
      </Box>
    )
  if (s.surfaces.chat !== 'on') return <Text dimColor>Chat is off. Turn it on in Settings.</Text>
  const cf = await configOf($, cfg)
  // Rooms the server lists that this mod knows; a room switched off (by config or the server's `paused`) has no button and isn't read.
  const rooms = (l.rooms ?? []).filter(x => ROOMS.includes(x.room))
  const off = (r: ApiRoom) => roomOff(cf, l.rooms, r)
  const room = shownRoom(cf, l)
  // A line it can't draw (an event it has no words for, a missing tier) is dropped, never thrown on.
  const lines = (room && l.lobby && l.lobby.room === room ? l.lobby.events : []).filter(drawableLine).slice(-12)
  const me = cfg.handle ?? ''
  const msgs = lines.map(x =>
    x.kind === 'chat'
      ? { at: hhmm(Date.parse(x.at)), handle: x.player.handle, tier: x.player.tier.toLowerCase() as TierKey, rank: x.rank ?? undefined, text: x.text, mine: x.player.handle === me }
      : { at: hhmm(Date.parse(x.at)), handle: x.handle, tier: String(x.tier).toLowerCase() as TierKey, text: SYSTEM_LINE[x.event as keyof typeof SYSTEM_LINE](x.handle, String(x.tier)), system: true },
  )
  const open = rooms.filter(x => x.can_post && !off(x.room))
  const roomName = (r: string) => (r === 'world' ? 'World' : `${r[0]?.toUpperCase()}${r.slice(1)} room`)
  const pausedMine = myRooms(l).filter(off)
  const current = room ?? l.room
  return (
    <Box flexDirection="column" gap={1}>
      {rich && rooms.length > 0 && <Svg source={chatRooms({ rooms: rooms.map(x => ({ key: x.room as 'world' | TierKey, online: x.online, open: x.can_post && !off(x.room) })), current: current as 'world' | TierKey })} alt={`Chat rooms. ${roomName(current)}, ${rooms.find(x => x.room === current)?.online ?? 0} online.`} />}
      <Box gap={1} alignItems="center" flexWrap="wrap">
        {open.map(x => (
          <Button key={`room-${x.room}`} label={roomName(x.room)} variant={x.room === room ? 'primary' : 'secondary'} onPress={() => a.setRoom(x.room)} />
        ))}
        {rooms.length > open.length && <Text dimColor>{MOD.locked}</Text>}
      </Box>
      {room &&
        pausedMine.map(r => (
          <Text key={`paused-${r}`} dimColor>
            {MOD.roomPaused(roomName(r))}
          </Text>
        ))}
      {room === 'world' && (await worldNotice($, e, els, a))}
      {!room ? (
        <Text color={ORANGE}>{MOD.chatPaused}</Text>
      ) : rich ? (
        <Svg source={chatLog({ me, messages: msgs })} alt={msgs.length ? msgs.map(m => `${m.handle}: ${m.text}`).join(' / ') : 'No messages yet.'} />
      ) : (
        <Box flexDirection="column">
          {msgs.length === 0 && <Text dimColor>quiet in here</Text>}
          {msgs.map(m => (
            <Text dimColor={!!m.system} color={m.mine ? ORANGE : undefined} wrap="truncate-end">
              {m.at} {m.system ? m.text : `${m.handle}: ${clean(m.text)}`}
            </Text>
          ))}
        </Box>
      )}
      {room && e.surface !== 'mobile' && <Input key="room-chat" placeholder={LINES.chatPlaceholder[msgs.length % 2]} submitLabel="Send" value={draft} onInput={v => a.setDraft(v)} onSubmit={v => a.roomChat(v)} />}
      <Text dimColor>Drawn here only. Chat never reaches Claude's context.</Text>
      {l.note && <Text color={ORANGE} wrap="wrap">{l.note}</Text>}
    </Box>
  )
}

// ---------------------------------------------------------------- backtest tab

async function backtestTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions, t: number): Promise<RenderElement> {
  const { Box, Text, Button, Svg } = els
  const rich = e.surface !== 'terminal'
  const list = await read($, sessions)
  const runs = await read($, backtests)
  const note = await read($, sessionsNote)
  const open = await read($, expanded)
  const limit = await read($, btLimit)
  const scored = list.filter(s => ['done', 'partial', 'running'].includes(runs[s.id]?.status ?? ''))
  const sum = scored.reduce((n, s) => n + (runs[s.id]?.points ?? 0), 0)

  return (
    <Box flexDirection="column" gap={1}>
      <Box>
        <Button key="back-grind" label="Back to the Grind" onPress={() => a.setTab('grind')} />
      </Box>
      <Text>How would your past Claude Code sessions have scored? Each session's window is its first to last message; commits you authored in its repo inside that window count.</Text>
      <Box gap={1} flexWrap="wrap" alignItems="center">
        <Button key="bt-7" label="Load 7 days" variant={list.length ? 'secondary' : 'primary'} onPress={() => a.loadSessions(7)} />
        <Button key="bt-14" label="14 days" onPress={() => a.loadSessions(14)} />
        {list.length > 0 && <Button key="bt-all" label={`Score all ${Math.min(list.length, limit)} shown`} variant="primary" onPress={() => a.backtestAll()} />}
        <Text dimColor>{note || 'Nothing loaded yet'}</Text>
      </Box>
      {rich && scored.length > 0 && (
        <Svg
          source={sessionBars(scored.slice(0, 12).map(s => ({ label: s.title, points: runs[s.id]?.points ?? 0, pending: runs[s.id]?.status === 'running' })))}
          alt={`${scored.length} sessions scored, ${sum} points in all.`}
        />
      )}
      {scored.length > 0 && (
        <Text bold>
          {sum} points across {scored.length} scored session{scored.length === 1 ? '' : 's'} (a commit inside two sessions' windows counts in both here)
        </Text>
      )}
      {list.slice(0, limit).map(s => sessionRow(els, s, runs[s.id], open === s.id, a, e.props.bodyColumns, t))}
      {list.length > limit && <Button key="bt-more" label={`Show more (${list.length - limit})`} onPress={() => a.more()} />}
    </Box>
  )
}

function sessionRow(els: El, s: PastSession, run: BacktestRun | undefined, isOpen: boolean, a: Actions, cols: number, t: number) {
  const { Box, Text, Button } = els
  const status = !run
    ? 'not scored'
    : run.status === 'running'
      ? `scoring ${run.done}/${run.total || '?'}`
      : run.status === 'error'
        ? `error: ${run.note}`
        : run.total === 0
          ? 'no commits'
          : `${run.points} pts · ${run.commits.length} commit${run.commits.length === 1 ? '' : 's'}${run.status === 'partial' ? ' · partial' : ''}`
  return (
    <Box key={`s-${s.id}`} flexDirection="column" borderStyle="round" borderColor="#34302B" paddingX={1}>
      <Box justifyContent="space-between" gap={1}>
        <Text bold wrap="truncate-end">{s.title.slice(0, Math.max(20, cols - 34))}</Text>
        <Text color={run?.status === 'done' && run.points > 0 ? ORANGE : STONE}>{status}</Text>
      </Box>
      <Text dimColor wrap="truncate-end">
        {s.project} · {when(s.startAt)} · {dur(s.endAt - s.startAt)} · {agoMs(s.endAt, Math.max(t, s.endAt))}
      </Text>
      {run?.status === 'partial' && <Text dimColor wrap="wrap">{run.note}</Text>}
      <Box gap={1}>
        {(!run || run.status !== 'running') && <Button key={`bt-${s.id}`} label={run ? 'Rescore' : 'Score'} onPress={() => a.backtest(s.id)} />}
        {(run?.status === 'done' || run?.status === 'partial') && run.commits.length > 0 && <Button key={`race-${s.id}`} label="Race it" onPress={() => a.race(s.id)} />}
        {(run?.status === 'done' || run?.status === 'partial') && run.commits.length > 0 && (
          <Button key={`ex-${s.id}`} label={isOpen ? 'Hide commits' : 'Commits'} dimColor onPress={() => a.expand(isOpen ? null : s.id)} />
        )}
      </Box>
      {isOpen && run && run.commits.map(c => commitRow(els, c, cols))}
    </Box>
  )
}

// ---------------------------------------------------------------- lab tab

async function labTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button, Svg, Code, Markdown, Link, Select } = els
  const rich = e.surface !== 'terminal'
  const note = await read($, labNote)
  let surfaces: readonly string[] = []
  try {
    surfaces = await $.session.surfaces()
  } catch {}
  return (
    <Box flexDirection="column" gap={1}>
      <Text>Every drawing piece the mods API gives this surface, live. Press things.</Text>
      <Text dimColor>
        surface {e.surface} · pane {e.props.placement} · {e.props.bodyColumns} columns wide{e.viewport ? ` · viewport ${e.viewport.columns}x${e.viewport.rows}` : ''} · session draws on {surfaces.join(', ') || 'nothing'}
      </Text>
      <Box gap={1} flexWrap="wrap">
        <Button key="lab-toast" label="Toast" onPress={p => a.lab('toast', p.surface)} />
        <Button key="lab-status" label="Status line" onPress={p => a.lab('status', p.surface)} />
        <Button key="lab-ask" label="Ask dialog" onPress={p => a.lab('ask', p.surface)} />
        <Button key="lab-copy" label="Copy to clipboard" onPress={p => a.lab('copy', p.surface)} />
        <Button key="lab-dialog" label="Pane as dialog" onPress={p => a.lab('dialog', p.surface)} />
        <Button key="lab-git" label="Git check" variant="primary" onPress={p => a.lab('git', p.surface)} />
        <Button key="lab-judge" label="Judge ping" onPress={p => a.lab('judge', p.surface)} />
        <Button key="lab-calibrate" label="Calibrate (10 commits x2, uses your plan)" onPress={p => a.lab('calibrate', p.surface)} />
      </Box>
      {note ? <Text color={ORANGE} wrap="wrap">{note}</Text> : null}
      <Text bold>Hover card</Text>
      <Box key="hover-demo" flexDirection="column">
        <Text>Point at this row: a card appears over it, no hook runs.</Text>
        <Box position="absolute" top={-3} left={4} display="none" hover={{ display: 'flex' }} borderStyle="round" borderColor={ORANGE} paddingX={1} backgroundColor="#141312">
          <Text color="#E6DED1">+8 · feature · per-workspace rate limits</Text>
        </Box>
      </Box>
      <Text bold>Markdown</Text>
      <Markdown text={'**Story points** add up: ten small commits of one feature earn about what one big commit would.\n\n| pts | typical |\n|---|---|\n| 3 | a fix that took digging |\n| 8 | a feature with a migration |\n\nSite: [ccsr.gg](https://ccsr.gg)'} />
      <Text bold>Code, as a diff</Text>
      <Code format="diff" path="src/rate-limit.ts" language="ts" source={'@@ -1,3 +1,4 @@\n import { Hono } from "hono"\n-const LIMIT = 100\n+const LIMIT = Number(process.env.RATE_LIMIT ?? 100)\n+const perWorkspace = new Map<string, number>()\n export const app = new Hono()'} />
      {e.surface !== 'mobile' && (
        <Select
          key="lab-select"
          label="Select"
          options={[{ value: 'olympia', label: 'Olympia' }, { value: 'stadion', label: 'Stadion' }, { value: 'temple', label: 'Temple' }]}
          onSelect={(v, p) => a.lab(`select:${v}`, p.surface)}
        />
      )}
      <Link href="https://code.claude.com/docs/en/plugins/mods/overview" label="Mods docs" />
      {rich ? (
        <Box flexDirection="column">
          <Text bold>Interactive SVG (CSS hover and SMIL animation, no script)</Text>
          <Svg isInteractive alt="A coin spinning on a column" source={coinSvg()} />
        </Box>
      ) : (
        <Text dimColor>Svg is a desktop element. The terminal gets Raster and Image instead.</Text>
      )}
    </Box>
  )
}

function coinSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="140" viewBox="0 0 720 140"><style>.c{transition:transform .3s;transform-origin:360px 60px}.c:hover{transform:scale(1.25)}</style><rect width="720" height="140" rx="6" fill="#141312"/><g class="c"><ellipse cx="360" cy="60" rx="34" ry="34" fill="#FF6A2A" stroke="#E6DED1" stroke-dasharray="3 3"><animate attributeName="rx" values="34;4;34" dur="2.4s" repeatCount="indefinite"/></ellipse><text x="360" y="66" text-anchor="middle" font-family="ui-monospace,monospace" font-size="16" font-weight="700" fill="#141312">CC<animate attributeName="opacity" values="1;0;1" dur="2.4s" repeatCount="indefinite"/></text></g><text x="360" y="124" text-anchor="middle" font-family="ui-monospace,monospace" font-size="11" fill="#9A9286" letter-spacing="2">HOVER THE COIN</text><text x="24" y="24" font-family="ui-monospace,monospace" font-size="9" fill="#34302B">0110100101101001011010010110100101101001</text></svg>`
}

// ---------------------------------------------------------------- settings tab

/**
 * Report a bug (W4b): through the server's go link, which counts the press and can point
 * somewhere else without a release. W4a seeds `bug` with Jaen's profile on X.
 */
const BUG_LINK = 'https://ccsr.gg/go/bug'

/** "4 min ago" from an ISO time. */
function ago(iso: string | null, now: number) {
  if (!iso) return 'never'
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000))
  if (m < 1) return 'now'
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}

/** Settings, signed in: the recovery key, the account's installs, link another, remove this one. */
async function accountRows($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button } = els
  const l = await read($, link)
  const cfg = await serverCfg($)
  const now = await $.clock.now()
  const has = l.account?.has_recovery_key ?? false
  return (
    <Box flexDirection="column" gap={1}>
      <Box flexDirection="column">
        <Text dimColor wrap="wrap">
          {!has ? ACCOUNT.noKey : cfg.recoveryKey ? ACCOUNT.hasKey : ACCOUNT.keyElsewhere}
        </Text>
        <Box gap={1}>
          {has && cfg.recoveryKey && <Button key="recovery-copy-settings" label={ACCOUNT.copyKey} onPress={() => a.copyRecoveryKey(e.surface)} />}
          <Button key="recovery-new" label={ACCOUNT.newKey} variant={has ? 'secondary' : 'primary'} onPress={() => a.newRecoveryKey()} />
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold color={STONE}>
          {ACCOUNT.installs.toUpperCase()}
        </Text>
        {(l.installs ?? []).map(i => (
          <Box key={`install-${i.id}`} gap={1} alignItems="center">
            <Text wrap="truncate-end">
              {i.label || 'unnamed'} · {i.this ? ACCOUNT.thisInstall : ACCOUNT.seen(ago(i.last_seen_at, now))}
            </Text>
            {!i.this && <Button key={`install-remove-${i.id}`} label={ACCOUNT.remove} onPress={() => a.removeInstall(i.id)} />}
          </Box>
        ))}
        {l.linkCode && Date.parse(l.linkCode.expiresAt) > now ? (
          <Text color={ORANGE} wrap="wrap">
            {ACCOUNT.codeShown(l.linkCode.code)}
          </Text>
        ) : null}
        <Box gap={1}>
          <Button key="link-another" label={ACCOUNT.linkAnother} onPress={() => a.makeLinkCode()} />
          <Button key="remove-this" label={ACCOUNT.removeThis} variant={l.confirmRemove ? 'primary' : 'secondary'} onPress={() => a.removeThisInstall()} />
        </Box>
      </Box>
    </Box>
  )
}

/** Settings, while eval capture is on for this player (W7-2): Model stats, held on the server, on by default. */
async function modelStatsRow($: $, els: El, a: Actions, cfg: ServerConfig): Promise<RenderElement> {
  const { Box, Text, Button } = els
  const isOn = (await modelStatsOf($, cfg)) !== false
  return (
    <Box flexDirection="column">
      <Box gap={1} alignItems="center">
        <Text>{EVAL.label}</Text>
        <Button key="stats-on" label={EVAL.on} variant={isOn ? 'primary' : 'secondary'} onPress={() => a.setModelStats(true)} />
        <Button key="stats-off" label={EVAL.off} variant={isOn ? 'secondary' : 'primary'} onPress={() => a.setModelStats(false)} />
      </Box>
      <Text dimColor>{EVAL.what}</Text>
    </Box>
  )
}

async function settingsTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button, Input, Select, Link } = els
  const s = await read($, settings)
  const r = await read($, rating)
  const list = await read($, ledger)
  const sw = s.surfaces
  const l = await read($, link)
  const cfg = await serverCfg($)
  const cf = await configOf($, cfg)
  const claude = await claudeVersion($)
  // The Server section's lines: approved with the rest of the mod's copy (docs/copy.md, "The mod").
  const server = (
    <Box flexDirection="column">
      <Text bold>Server</Text>
      <Text dimColor wrap="truncate-end">
        {cfg.url} · {l.online === null ? 'not checked yet' : l.online ? 'online' : 'offline'}
        {l.outbox ? ` · ${l.outbox} score${l.outbox === 1 ? '' : 's'} waiting to send` : ''}
        {l.season ? ` · season ${l.season.id}: ${l.season.model}, ${l.season.rubric}` : ''}
      </Text>
      {l.me ? (
        <Text>
          Signed in as {l.me.handle} · {l.me.placement ? `${l.me.tier}, placing ${l.me.placement.played} of ${l.me.placement.of}` : `${l.me.tier} ${l.me.rating}`}
        </Text>
      ) : cfg.token && !l.unknownToken ? (
        <Text dimColor>Signed in as {cfg.handle}; checking with the server.</Text>
      ) : (
        await joinBlock($, e, els, a, '')
      )}
      {l.me && (await accountRows($, e, els, a))}
      {await signInSettings($, e, els, a)}
      {l.note && <Text color={ORANGE} wrap="wrap">{l.note}</Text>}
      {e.surface !== 'mobile' && <Input key="server-url" label="Server URL" value={cfg.url} submitLabel="Use" onSubmit={v => a.setServer(v)} />}
    </Box>
  )
  return (
    <Box flexDirection="column" gap={1}>
      {server}
      <Box gap={1} alignItems="center">
        <Text>Grind tracking</Text>
        <Button key="track-on" label="On" variant={s.tracking ? 'primary' : 'secondary'} onPress={() => a.setTracking(true)} />
        <Button key="track-off" label="Off" variant={s.tracking ? 'secondary' : 'primary'} onPress={() => a.setTracking(false)} />
      </Box>
      <Box gap={1} alignItems="center">
        <Text bold>Surfaces</Text>
        <Button key="preset-full" label="Full" variant={presetOf(sw) === 'full' ? 'primary' : 'secondary'} onPress={() => a.setPreset('full')} />
        <Button key="preset-quiet" label="Quiet" variant={presetOf(sw) === 'quiet' ? 'primary' : 'secondary'} onPress={() => a.setPreset('quiet')} />
        {presetOf(sw) === 'custom' && <Text dimColor>Custom</Text>}
      </Box>
      {/* W6b: the Challenges switch only while config's `challenges` reads on for this player: dark, there's no challenge UI at all. */}
      {/* W10b: the two finisher switches only while config's `finishers` is on: off, or a server before W10a, the result card is today's. */}
      {SURFACE_ROWS.filter(row => (row[0] !== 'challenges' || challengesOf(cf).on) && ((row[0] !== 'finishers' && row[0] !== 'oppFinishers') || finishersOf(cf.raw).on)).map(row =>
        row[0] === 'group' ? (
          <Text bold color={STONE}>
            {row[1].toUpperCase()}
          </Text>
        ) : (
          <Box flexDirection="column">
            <Box gap={1} alignItems="center" flexWrap="wrap">
              <Text>{row[1]}</Text>
              {row[2].map(([value, label]) => (
                // The Challenges, Notices and two finisher switches' keys are spelled out in code by switchKey: scripts/freeze-manifest.txt looks for each one.
                <Button
                  key={switchKey(row[0] as SurfaceKey, value)}
                  label={label}
                  variant={sw[row[0] as SurfaceKey] === value ? 'primary' : 'secondary'}
                  onPress={() => a.setSurface(row[0] as SurfaceKey, value)}
                />
              ))}
            </Box>
            <Text dimColor>{SURFACE_WHAT[row[0] as SurfaceKey]}</Text>
          </Box>
        ),
      )}
      {/* W10b: the Finishers view (your callout and color), while config has finishers on and the server knows this install. */}
      {finishersOf(cf.raw).on && l.me && (
        <Box>
          <Button key="finishers-open" label={FINISHER.open} onPress={() => a.setTab('finishers')} />
        </Box>
      )}
      <Text dimColor>These stay on this machine and apply to every session; chat off also tells your opponent. The match-found check can't be turned off.</Text>
      <Box gap={1} alignItems="center">
        <Text>Show my commit titles to opponents</Text>
        <Button key="share-on" label="On" variant={s.share ? 'primary' : 'secondary'} onPress={() => a.setShare(true)} />
        <Button key="share-off" label="Off" variant={s.share ? 'secondary' : 'primary'} onPress={() => a.setShare(false)} />
      </Box>
      {l.me && captureOn(cf.raw) && (await modelStatsRow($, els, a, cfg))}
      {e.surface !== 'mobile' && (
        <Select
          key="model"
          label="Judge model (one per season once ranked exists)"
          value={s.model}
          options={[
            { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5 (pinned, default)' },
            { value: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5 (cheaper)' },
            { value: 'sonnet', label: 'sonnet (alias)' },
          ]}
          onSelect={v => a.setModel(v)}
        />
      )}
      <Box gap={1} flexWrap="wrap">
        <Button key="reset-rating" label={`Reset practice rating (${r})`} onPress={() => a.resetRating()} />
        <Button key="reset-grind" label={`Reset Grind: tracking starts now (${list.length} commits)`} onPress={() => a.resetGrind()} />
      </Box>
      <Text bold>What leaves your machine</Text>
      {privacyLines(cf, RUBRIC).map((x, i) => (
        <Text key={`privacy-${i}`} dimColor>
          {x}
        </Text>
      ))}
      <Text bold>Version</Text>
      <Text dimColor>{MOD.version(VERSION)}</Text>
      <Text dimColor>{MOD.claudeFloor(CLAUDE_FLOOR.terminal, CLAUDE_FLOOR.desktop, claude)}</Text>
      <Text dimColor>{MOD.autoUpdate}</Text>
      {l.release && standing(l.release) !== 'current' && (
        <Box gap={1} alignItems="center" flexWrap="wrap">
          <Text>{MOD.updateOut(l.release.latest)}</Text>
          <Button key="settings-update" label="Update" onPress={x => a.updateMod(x.surface)} />
        </Box>
      )}
      {l.updateNote && (
        <Text dimColor wrap="wrap">
          {l.updateNote}
        </Text>
      )}
      <Text bold>{MOD.resyncTitle}</Text>
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Text wrap="wrap">{MOD.resyncLead}</Text>
        <Button key="settings-resync" label={MOD.resync} onPress={() => a.resync()} />
      </Box>
      <Text bold>Report a bug</Text>
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Text>Tag or DM</Text>
        <Link href={BUG_LINK} label="@speedrunjaen" />
        <Text>on X.</Text>
      </Box>
    </Box>
  )
}


// ---------------------------------------------------------------- finishers (W10b)
// The six win animations (finishers.ts) on a decided match, from the server's pick
// (MatchSummary.finisher), on the winner's and the loser's screens; practice and replays pick
// their own with the same rules (finisherplay.ts). Each match's finisher plays once on this
// machine: its first draw goes in the store (K.finisherSeen), and every draw after the
// animation's end shows its last frame (freeze), never the playing string, since a new source or
// a remount restarts every CSS animation. Replay plays it again in this session, a counter comment
// making the source new. The terminal draws the same beats as text. The Finishers view (a tab off
// Settings, framed as Settings) picks your callout and color through PATCH /me/finishers. Server
// text (titles, lines) is cleaned by finisherOf and escaped by the drawing, and never reaches a
// command reply, $.prompt or $.session.append.

/** Post to X and Post the L: ccsr.gg's share redirect (W10c), which counts the click and opens X's composer with the server's post. */
const SHARE_BASE = 'https://ccsr.gg/s/'
/** The Finishers view's preview plays under this id, never a match's. */
const PREVIEW_ID = 'preview'

/** Where each finisher is in this session: when its play started (its first draw on this machine, or a Replay) and the Replay count. */
const finisherPlays = new Map<string, { at: number; n: number }>()
/** One redraw timer per beat of a play, so redraws never stack them. */
const finisherTimers = new Map<string, { cancel: () => void }>()
/** The drawings built lately, by what they were built from, so a redraw builds nothing. */
const finisherMemo = new Map<string, FinisherDrawing>()

/** A Settings switch's button key. The Challenges, Notices and two finisher switches' are spelled out, for scripts/freeze-manifest.txt. */
function switchKey(row: SurfaceKey, value: string) {
  if (row === 'challenges') return `sw-challenges-${value}`
  if (row === 'notices') return `sw-notices-${value}`
  if (row === 'finishers') return `sw-finishers-${value}`
  if (row === 'oppFinishers') return `sw-opp-finishers-${value}`
  return `sw-${row}-${value}`
}

/** "Bronze" from config's lowercase "bronze". */
function tierName(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** The drawing for an input, built once (the newest four are kept). */
function finisherDrawing(input: FinisherInput, short: boolean): FinisherDrawing {
  const key = JSON.stringify([input, short])
  const have = finisherMemo.get(key)
  if (have) return have
  const drawing = buildFinisher(input, { short })
  finisherMemo.set(key, drawing)
  for (const k of [...finisherMemo.keys()].slice(0, Math.max(0, finisherMemo.size - 4))) finisherMemo.delete(k)
  return drawing
}

/** The share link for one screen of a match: Post to X on the winner's, Post the L on the loser's; null when it isn't a link the mod may draw (safeLink). */
function shareLink(id: string, view: 'win' | 'lose') {
  const path = sharePath(id, view)
  const href = path ? `${SHARE_BASE}${path}` : null
  return href && safeLink(href, ['ccsr.gg']) ? { href, label: view === 'win' ? FINISHER.postWin : FINISHER.postLoss } : null
}

/**
 * When this match's finisher started playing here: this session's last Replay, else its first
 * draw on this machine (the store's record, written now when there is none, after this draw).
 */
async function finisherStart($: $, id: string, t: number) {
  const here = finisherPlays.get(id)
  if (here) return here
  const seen = seenOf(await storeGet<unknown>($, K.finisherSeen, []))
  const first = seen.find(x => x.id === id)
  const play = { at: first ? first.at : t, n: 0 }
  finisherPlays.set(id, play)
  for (const k of [...finisherPlays.keys()].slice(0, Math.max(0, finisherPlays.size - 20))) if (k !== PREVIEW_ID) finisherPlays.delete(k)
  // Never awaited inside the draw: every other session, and every draw after the animation's end, shows the last frame.
  if (!first) void save($, K.finisherSeen, seenWith(seen, id, t))
  return play
}

/** A redraw `ms` from now (finisherRev moves), once per `key`. */
function finisherAfter($: $, key: string, ms: number) {
  if (finisherTimers.has(key)) return
  finisherTimers.set(
    key,
    $.clock.after(Math.max(0, ms) + 40, () => {
      finisherTimers.delete(key)
      void update($, finisherRev, n => n + 1)
    }),
  )
}

/** What a finisher on screen needs: its id (a match's, or the preview's), its drawing's input, when it started playing here (null: its last frame), its replay button and its share link. */
type FinisherShow = { id: string; input: FinisherInput; play: { at: number; n: number } | null; replayKey: string; replayLabel: string; onReplay: () => void; share: { href: string; label: string } | null }

/**
 * A finisher on screen: the drawing (desktop, VS Code, mobile) or the terminal's beats, then its
 * buttons. The drawing plays from its start for `totalMs`, then shows `freeze(svg, totalMs +
 * 3000)`; Short is the drawing's own (the action already over, the headline at once). The
 * terminal draws the bell line, the headline as four half-block rows in the accent color (one
 * bold line when the rows are wider than the pane), an inverted flash, then the line and the
 * stats; Short draws them at once.
 */
async function finisherView($: $, e: RenderInput<'Pane'>, els: El, f: FinisherShow): Promise<RenderElement> {
  await read($, finisherRev)
  const { Box, Text, Button, Svg, Link } = els
  const short = (await read($, settings)).surfaces.finishers === 'short'
  const t = await $.clock.now()
  const words = finisherWords(f.input)
  const buttons = (
    <Box gap={1} alignItems="center" flexWrap="wrap">
      <Button key={f.replayKey} label={f.replayLabel} onPress={() => f.onReplay()} />
      {f.share && <Link href={f.share.href} label={f.share.label} />}
    </Box>
  )
  const elapsed = f.play ? t - f.play.at : Number.POSITIVE_INFINITY
  if (e.surface === 'terminal') {
    const phase = termPhase(elapsed, short)
    if (f.play && phase !== 'done') for (const beat of TERM_BEATS) if (beat > elapsed) finisherAfter($, `${f.id}:${f.play.n}:${beat}`, beat - elapsed)
    const color = accentOf(f.input.accent).base
    const rows = termRows(words.title, e.props.bodyColumns)
    const flash = phase === 'flash'
    return (
      <Box flexDirection="column">
        <Text dimColor>{FINISHER.bell}</Text>
        {phase !== 'bell' &&
          (rows ? (
            rows.map(r => (
              <Text color={color} inverse={flash} wrap="truncate-end">
                {r}
              </Text>
            ))
          ) : (
            <Text bold color={color} inverse={flash}>
              {words.title}
            </Text>
          ))}
        {phase === 'done' && words.line && (
          <Text bold wrap="wrap">
            {words.line}
          </Text>
        )}
        {phase === 'done' && (
          <Text dimColor wrap="wrap">
            {words.stats}
          </Text>
        )}
        {buttons}
      </Box>
    )
  }
  const drawing = finisherDrawing(f.input, short)
  const playing = !!f.play && elapsed < drawing.totalMs
  if (f.play && playing) finisherAfter($, `${f.id}:${f.play.n}`, drawing.totalMs - elapsed)
  const source = playing ? withCounter(drawing.svg, f.play?.n ?? 0) : freeze(drawing.svg, drawing.totalMs + 3000)
  return (
    <Box flexDirection="column">
      <Svg source={source} alt={FINISHER.alt(words.title, words.line, words.stats)} />
      {buttons}
    </Box>
  )
}

/**
 * A decided ranked match's finisher, from the server's pick, above today's result card, which
 * stays. Null (today's card only) while config has finishers off, with Finishers set to Off, and
 * for a match with none (a draw, a void, a forfeit, a match decided before W10a).
 */
async function finisherBlock($: $, e: RenderInput<'Pane'>, els: El, a: Actions, sm: ApiMatchSummary, me: string): Promise<RenderElement | null> {
  const sw = (await read($, settings)).surfaces
  if (sw.finishers === 'off') return null
  const cfg = finishersOf((await configOf($)).raw)
  const f = cfg.on ? finisherOf(sm.finisher) : null
  const input = f ? finisherInput(sm, me, f, { theirs: sw.oppFinishers !== 'default' }) : null
  if (!f || !input) return null
  // W10e: the win's custom art, where this screen draws it (artShown): while it's being fetched, a line and no play yet; held,
  // it plays in our frame from the start; failed, the default kind plays. Either way it plays once, from its first draw.
  const art = await artFor($, e.surface, sm, input, sw.oppFinishers !== 'default', cleanServer(me))
  if (art === 'loading') {
    const { Text } = els
    return <Text dimColor>{CUSTOM.loading}</Text>
  }
  const play = await finisherStart($, sm.id, await $.clock.now())
  const show: FinisherShow = { id: sm.id, input, play, replayKey: 'ranked-replay', replayLabel: FINISHER.replay, onReplay: () => a.finisherReplay(sm.id), share: cfg.share ? shareLink(sm.id, input.view) : null }
  if (art) return customFrame($, els, show, art.held, art.ref.by, await artActions($, els, a, sm, art.ref, cleanServer(me), kindOf(f.kind)))
  return finisherView($, e, els, show)
}

/** A finished practice match's or replay's finisher, picked here with the server's rules over its own commits; null for a draw, a void or a forfeit. */
async function practiceFinisherBlock($: $, e: RenderInput<'Pane'>, els: El, a: Actions, m: Match): Promise<RenderElement | null> {
  if (m.status === 'live') return null
  const s = await read($, settings)
  if (s.surfaces.finishers === 'off' || !finishersOf((await configOf($)).raw).on) return null
  const input = practiceFinisher(m, s.handle)
  if (!input) return null
  const play = await finisherStart($, m.id, await $.clock.now())
  return finisherView($, e, els, { id: m.id, input, play, replayKey: 'practice-replay', replayLabel: FINISHER.replay, onReplay: () => a.finisherReplay(m.id), share: null })
}

/** Replay (and the preview's Play): the finisher plays again here from now, its source made new by the counter (withCounter). */
async function replayFinisher($: $, id: string) {
  const t = await $.clock.now()
  finisherPlays.set(id, { at: t, n: (finisherPlays.get(id)?.n ?? 0) + 1 })
  await update($, finisherRev, n => n + 1)
}

async function playPreview($: $) {
  await replayFinisher($, PREVIEW_ID)
}

/**
 * The finisher's own sound for the ranked match just decided (config's finishers.sounds, only
 * https://ccsr.gg/sfx/), while finishers are on and Finishers isn't Off; null for the mod's own
 * stings. ring() asks only for the result's win or loss sting, which pollMatch rings right after
 * it holds the decided summary.
 */
async function finisherSting($: $): Promise<string | null> {
  if ((await read($, settings)).surfaces.finishers === 'off') return null
  const f = finisherOf((await read($, link)).ranked?.summary?.finisher)
  return f ? soundFor(finishersOf((await configOf($)).raw), f.kind) : null
}

/**
 * GET /me/finishers for the Finishers view: your picks and which colors you've unlocked, which
 * move outside config's version. `keepNote` keeps a refusal's line on screen (the read after it).
 */
async function refreshFinishers($: $, keepNote: boolean) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const key = keyOf(cfg)
  await update($, finisherUi, u => ({ key, me: u.key === key ? u.me : null, busy: true, note: keepNote && u.key === key ? u.note : '' }))
  const r = await api($, 'GET', '/me/finishers', undefined, { keepNote: true })
  if (keyOf(await serverCfg($)) !== key) return
  const mine = r.status === 200 ? finisherMeOf(r.json) : null
  await update($, finisherUi, u => (u.key !== key ? u : mine ? { ...u, me: mine, busy: false } : { ...u, busy: false, note: u.note || failLine(r) }))
  // W10e: the same answer carries your own art and what each slot plays (My finishers).
  if (r.status === 200) await holdMine($, key, r.json)
}

/** Why the server refused a pick, in its own words when it gave some, else the mod's line for the code. */
function finisherRefusal(r: { status: number; json: unknown }) {
  const err = errorOf(r.json)
  if (err && err.message !== err.code) return err.message
  if (err?.code === 'callout_unknown') return FINISHER.calloutGone
  const tier = (r.json as { tier?: unknown } | null)?.tier
  if (err?.code === 'accent_locked' && typeof tier === 'string' && /^[a-z]{2,16}$/.test(tier)) return FINISHER.locked(tierName(tier))
  return failLine(r)
}

/**
 * A pick in the Finishers view, as PATCH /me/finishers takes it. Its answer is the view's new
 * state. A refusal shows the server's line; callout_unknown means the pool changed under this
 * mod (config is read again) and accent_locked that your tier moved: either way the picks are
 * read again.
 */
async function patchFinishers($: $, body: { callout: string | null } | { accent: string }) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const key = keyOf(cfg)
  await update($, finisherUi, u => ({ ...u, busy: true, note: '' }))
  const r = await api($, 'PATCH', '/me/finishers', body, { keepNote: true })
  if (keyOf(await serverCfg($)) !== key) return
  const mine = r.status === 200 ? finisherMeOf(r.json) : null
  if (mine) {
    await update($, finisherUi, u => ({ ...u, key, me: mine, busy: false, note: '' }))
    // W10e: PATCH answers GET's shape, your art and equips included.
    await holdMine($, key, r.json)
    return
  }
  await update($, finisherUi, u => ({ ...u, busy: false, note: finisherRefusal(r) }))
  const code = errorOf(r.json)?.code
  if (code === 'callout_unknown') void refreshConfig($, 'bucket').catch(() => null)
  if (code === 'callout_unknown' || code === 'accent_locked') void refreshFinishers($, true).catch(() => null)
}

async function pickCallout($: $, callout: string | null) {
  await patchFinishers($, { callout })
}

async function pickAccent($: $, key: string) {
  await patchFinishers($, { accent: key })
}

/**
 * The Finishers view, off Settings (and a notice's `{ do: 'tab', tab: 'finishers' }`): the
 * callouts from config, the colors you've unlocked (a locked one says the tier that unlocks
 * it), and your knockout previewed on its last frame, with Play. Your picks and the locks come
 * from GET /me/finishers, read each time it opens (selectTab); a pick is PATCH /me/finishers.
 * With finishers off, or this install not signed in, it says why and offers nothing to pick.
 */
async function finishersTab($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement> {
  const { Box, Text, Button } = els
  const cfg = await serverCfg($)
  const l = await read($, link)
  const fc = finishersOf((await configOf($, cfg)).raw)
  const ui = await read($, finisherUi)
  const back = (
    <Box>
      <Button key="back-settings" label={FINISHER.back} onPress={() => a.setTab('settings')} />
    </Box>
  )
  const head = (
    <Box flexDirection="column">
      <Text bold>{FINISHER.title}</Text>
      <Text dimColor wrap="wrap">
        {FINISHER.what}
      </Text>
    </Box>
  )
  if (!fc.on || !cfg.token || l.unknownToken)
    return (
      <Box flexDirection="column" gap={1}>
        {head}
        <Text dimColor wrap="wrap">
          {fc.on ? FINISHER.signIn : FINISHER.off}
        </Text>
        {back}
      </Box>
    )
  const mine = ui.key === keyOf(cfg) ? ui.me : null
  const handle = cleanServer(l.me?.handle ?? cfg.handle ?? '')
  const accents = mine && mine.accents.length > 0 ? mine.accents : fc.accents
  const callout = mine && mine.callout !== null && fc.callouts.includes(mine.callout) ? mine.callout : null
  const accent = mine?.accent ?? 'signal'
  const input = previewInput({ handle, callout, accent, tier: l.me && !l.me.placement ? l.me.tier : 'Mud' })
  const preview = await finisherView($, e, els, { id: PREVIEW_ID, input, play: finisherPlays.get(PREVIEW_ID) ?? null, replayKey: 'fin-play', replayLabel: FINISHER.play, onReplay: () => a.finisherPreview(), share: null })
  return (
    <Box flexDirection="column" gap={1}>
      {head}
      {!mine && !ui.note && <Text dimColor>{FINISHER.checking}</Text>}
      <Box flexDirection="column">
        <Text bold color={STONE}>
          {FINISHER.callout.toUpperCase()}
        </Text>
        <Box gap={1} flexWrap="wrap">
          <Button key="fin-callout-none" label={FINISHER.handleCallout(handle)} variant={mine && callout === null ? 'primary' : 'secondary'} onPress={() => a.finisherCallout(null)} />
          {fc.callouts.map((c, i) => (
            <Button key={`fin-callout-${i}`} label={c} variant={callout === c ? 'primary' : 'secondary'} onPress={() => a.finisherCallout(c)} />
          ))}
        </Box>
      </Box>
      <Box flexDirection="column">
        <Text bold color={STONE}>
          {FINISHER.color.toUpperCase()}
        </Text>
        {/* Each color as a swatch beside its name: a Button once unlocked, else the tier that unlocks it. */}
        <Box gap={2} flexWrap="wrap">
          {accents
            .filter(x => x.unlocked)
            .map(x => (
              <Box key={`fin-swatch-${x.key}`} gap={1} alignItems="center">
                <Text color={accentOf(x.key).base}>■</Text>
                <Button key={`fin-accent-${x.key}`} label={FINISHER.accents[x.key] ?? x.key} variant={mine && accent === x.key ? 'primary' : 'secondary'} onPress={() => a.finisherAccent(x.key)} />
              </Box>
            ))}
        </Box>
        {accents
          .filter(x => !x.unlocked && x.tier)
          .map(x => (
            <Box key={`fin-locked-${x.key}`} gap={1}>
              <Text color={accentOf(x.key).base} dimColor>
                ■
              </Text>
              <Text>{FINISHER.accents[x.key] ?? x.key}</Text>
              <Text dimColor>{FINISHER.unlocks(tierName(x.tier ?? ''))}</Text>
            </Box>
          ))}
      </Box>
      <Box flexDirection="column">
        <Text bold color={STONE}>
          {FINISHER.preview.toUpperCase()}
        </Text>
        {preview}
      </Box>
      {/* W10e: Make your own, My finishers and the gallery, each only while config's finishers.custom has it on for you. */}
      {await customSections($, e, els, a)}
      {ui.note && (
        <Text color={ORANGE} wrap="wrap">
          {cleanServer(ui.note)}
        </Text>
      )}
      {back}
    </Box>
  )
}


// ---------------------------------------------------------------- custom finishers (W10e)
// Players' own finisher art, dark until config's `finishers.custom` says otherwise (customOf in
// finishers-custom.ts reads it). Authoring uses the player's own Claude: Make a finisher writes
// ~/ccsr-finisher/SPEC.md and starter.svg from the files this mod ships (mod/finishers/), writes
// finisher.svg from the starter only when it's missing, and puts CUSTOM.prompt in the prompt box
// (or offers it to copy). Preview checks finisher.svg with the shared validator (finisherart.ts's
// checkArt, config's limits held to its ceilings) and draws it in our frame; Submit posts
// { slot, title, svg }, the check being advice only (the server decides). A win's art
// (MatchSummary.finisher.art) draws as three stacked Svgs, our HUD, the art sanitized again with
// the validator's ceilings, our strip, where artShown says; any fetch or check failure draws the
// default kind. Other players' art, titles and handles live only in this module's memory (art in
// an 8-entry LRU): never $.state, $.store, the disk, a prompt or a command reply. `customRev`
// moves the redraw.

/** The draft folder under the home directory, and its three files, overwritten in place ($.fs has no delete). */
const DRAFT_DIR = 'ccsr-finisher'
const DRAFT = { spec: 'SPEC.md', starter: 'starter.svg', art: 'finisher.svg' } as const
/** The previews' plays (finisherPlays): never a match's id. */
const DRAFT_PLAY = 'draft'
const GALLERY_PLAY = 'gallery'
/** Sanitized art kept in memory, by sha256: the newest 8. Art that failed: the newest 64. */
const ART_KEEP = 8
const ART_FAILED_KEEP = 64
/** The art a decided match played, by match id: the newest 20. */
const ART_REFS_KEEP = 20
/** An art fetch that hasn't answered by then draws the default kind ($.http.fetch has no timeout). */
const ART_FETCH_MS = 10_000
/** My finishers reads GET /me/finishers again while one of yours is pending: at most once a minute, for 30 minutes. */
const MINE_EVERY_MS = 60_000
const MINE_FOR_MS = 30 * 60_000
const MINE_LOOP = 'finishers-mine'
/** A server's message drawn as a note, cut to a line's worth. */
const NOTE_MAX = 280

/** Art fetched and checked here: the canonical art, how long it runs, and its held last frame. */
type HeldArt = { clean: string; durationMs: number; frozen: string }
type GalleryUi = { sort: 'top' | 'new'; slot: FinisherKind | null; items: Art[]; total: number; read: boolean; note: string }
/** The custom finishers' state in the Finishers view, for one account. Module memory only (other players' titles and handles are in it). */
type CustomUi = {
  /** `<server url>|<handle>`: whose this is. Another account's never draws. */
  key: string
  /** GET /me/finishers' `mine` and `equips`, as last read; null until then. */
  me: CustomMe | null
  /** The last Preview: what the check found, the sanitized art when it passed, how long it runs and its held last frame. */
  draft: { problems: Problem[]; clean: string | null; durationMs: number; frozen: string | null } | null
  /** The last Submit's 422 `finisher_invalid` problems, drawn with the same lines. */
  refused: Problem[] | null
  note: string
  /** A prompt Make or Ask Claude to fix it couldn't put in the box, for Copy the prompt. */
  prompt: string | null
  restartAsk: boolean
  deleteAsk: string | null
  slot: FinisherKind
  gallery: GalleryUi
  galleryPreview: Art | null
}

function customUi0(key: string): CustomUi {
  return { key, me: null, draft: null, refused: null, note: '', prompt: null, restartAsk: false, deleteAsk: null, slot: 'knockout', gallery: { sort: 'top', slot: null, items: [], total: 0, read: false, note: '' }, galleryPreview: null }
}

let customUi: CustomUi = customUi0('')
/** The title box and the code box, as typed (module variables, like the challenge message). */
let customTitle = ''
let customCode = ''
const artRefs = new Map<string, ArtRef>()
const artHeld = new Map<string, HeldArt>()
const artFailed = new Set<string>()
const artLoading = new Set<string>()
/** A line under a result's custom art (reported, equipped, or why not), by match id. */
const artNotes = new Map<string, string>()
/** The match whose art's report reasons are open. */
let reportOpen: string | null = null
let minePollSince = 0
/** Our HUD and strip around custom art, built once per input. */
const frameMemo = new Map<string, string>()

/** This account's custom state: a fresh one when the account changed. */
function customFor(key: string) {
  if (customUi.key !== key) customUi = customUi0(key)
  return customUi
}

async function customMoved($: $) {
  await update($, customRev, n => n + 1)
}

/** A line for this account's Finishers view, then a redraw. */
async function customNote($: $, key: string, note: string) {
  customFor(key).note = note
  await customMoved($)
}

/** A table's own entry (never one every object inherits: a server can send `constructor`), else the fallback. */
function ownLine(table: Readonly<Record<string, string>>, key: string, fallback: string) {
  return Object.hasOwn(table, key) ? (table[key] ?? fallback) : fallback
}

const slotName = (k: string) => ownLine(CUSTOM.slots, k, CUSTOM.slotOther)

/** A problem as the mod draws it (and as Ask Claude to fix it sends it): its own line for the code, and where. */
function problemLine(p: Problem) {
  const line = ownLine(CUSTOM.problems, p.code, CUSTOM.problemOther)
  return p.at === null ? line : `${line} ${CUSTOM.at(p.at)}`
}

/** Your art's status in a line: a rejection says why, in the mod's words for each reason. */
function artStatusLine(art: Art) {
  if (art.status === 'rejected') return CUSTOM.rejected(art.reasons.map(r => ownLine(CUSTOM.reasons, r, CUSTOM.reasonOther)).join(', '))
  return ownLine(CUSTOM.status, art.status, CUSTOM.statusOther)
}

/** A refusal in the server's own words (a code added after the freeze still reads), else the mod's line for the status. */
function customRefusal(r: { status: number; json: unknown }) {
  const err = errorOf(r.json)
  if (err && err.message !== err.code) return cleanServer(err.message).slice(0, NOTE_MAX)
  return reachedOf(r) ? MOD.answered(r.status) : MOD.noServer
}

/** ~/ccsr-finisher: the folder the player points Claude at. It holds no secret and no other player's art. */
async function draftDir($: $) {
  const home = (await $.env.get('HOME').catch(() => undefined)) || (await $.env.get('USERPROFILE').catch(() => undefined))
  return home ? `${home.replace(/[\\/]+$/, '')}/${DRAFT_DIR}` : null
}

/** The authoring files this mod ships (mod/finishers/), as bundled: never anything from the server. */
async function readBundle($: $) {
  try {
    const spec = String(await $.fs.read(`${$.plugin.root}/finishers/${DRAFT.spec}`))
    const starter = String(await $.fs.read(`${$.plugin.root}/finishers/${DRAFT.starter}`))
    return spec && starter ? { spec, starter } : null
  } catch {
    return null
  }
}

/**
 * Puts `text` in the prompt box, unless the box holds a draft of the player's (a fill would replace
 * it) or the engine can't (a dialog is open, or headless): then Copy the prompt offers it. True when
 * it's in the box.
 */
async function fillPrompt($: $, key: string, text: string) {
  let draft = ''
  try {
    draft = (await $.prompt.read()).text
  } catch {
    draft = ''
  }
  if (!draft.trim()) {
    try {
      if ((await $.prompt.fill({ text })).isFilled) {
        customFor(key).prompt = null
        return true
      }
    } catch {
      // Not filled: offered to copy below.
    }
  }
  customFor(key).prompt = text
  return false
}

/**
 * Make a finisher: SPEC.md and starter.svg in ~/ccsr-finisher from the files this mod ships, and
 * finisher.svg from the starter only when $.fs.exists says it's missing, so a second press never
 * loses work. Then the bundled prompt goes in the prompt box; Claude Code asks before Claude reads
 * or edits outside the project.
 */
async function makeFinisher($: $) {
  const cfg = await serverCfg($)
  const key = keyOf(cfg)
  if (!customOf((await configOf($, cfg)).raw).create) return
  customFor(key).restartAsk = false
  const dir = await draftDir($)
  if (!dir) return customNote($, key, CUSTOM.noHome)
  const bundle = await readBundle($)
  if (!bundle) return customNote($, key, CUSTOM.noBundle)
  let kept = false
  try {
    await $.fs.write(`${dir}/${DRAFT.spec}`, bundle.spec)
    await $.fs.write(`${dir}/${DRAFT.starter}`, bundle.starter)
    kept = await $.fs.exists(`${dir}/${DRAFT.art}`)
    if (!kept) await $.fs.write(`${dir}/${DRAFT.art}`, bundle.starter)
  } catch {
    return customNote($, key, CUSTOM.notWritten)
  }
  const filled = await fillPrompt($, key, CUSTOM.prompt)
  await customNote($, key, `${kept ? CUSTOM.madeKept : CUSTOM.made} ${filled ? CUSTOM.filled : CUSTOM.notFilled}`)
}

/** Start over: the first press asks, the second writes finisher.svg from the starter again. */
async function restartFinisher($: $) {
  const cfg = await serverCfg($)
  const key = keyOf(cfg)
  if (!customOf((await configOf($, cfg)).raw).create) return
  const ui = customFor(key)
  if (!ui.restartAsk) {
    ui.restartAsk = true
    return customNote($, key, CUSTOM.restartAsk)
  }
  ui.restartAsk = false
  const dir = await draftDir($)
  if (!dir) return customNote($, key, CUSTOM.noHome)
  const bundle = await readBundle($)
  if (!bundle) return customNote($, key, CUSTOM.noBundle)
  try {
    await $.fs.write(`${dir}/${DRAFT.art}`, bundle.starter)
  } catch {
    return customNote($, key, CUSTOM.notWritten)
  }
  ui.draft = null
  ui.refused = null
  await customNote($, key, CUSTOM.restarted)
}

/** finisher.svg as it stands, or null after saying why (no home folder, none yet, unreadable). */
async function readDraft($: $, key: string): Promise<string | null> {
  const dir = await draftDir($)
  if (!dir) {
    await customNote($, key, CUSTOM.noHome)
    return null
  }
  const path = `${dir}/${DRAFT.art}`
  try {
    if (!(await $.fs.exists(path))) {
      await customNote($, key, CUSTOM.noDraft)
      return null
    }
    return String(await $.fs.read(path))
  } catch {
    await customNote($, key, CUSTOM.notRead)
    return null
  }
}

/**
 * Preview: finisher.svg through the shared validator (checkArt, config's limits held to the
 * module's ceilings), its problems drawn with the mod's own lines, and when it passes, the art in
 * our frame on its last frame, with Play.
 */
async function checkDraft($: $) {
  const cfg = await serverCfg($)
  const key = keyOf(cfg)
  const cc = customOf((await configOf($, cfg)).raw)
  if (!cc.create) return
  const ui = customFor(key)
  ui.restartAsk = false
  const svg = await readDraft($, key)
  if (svg === null) return
  const check = checkArt(svg, cc.limits)
  const clean = check.ok ? check.clean : null
  const frozen = clean ? freezeArt(clean, (customTiming(check.stats.duration_ms).totalMs + 3000) / 1000) : null
  ui.draft = { problems: localProblems(check.problems), clean, durationMs: check.stats.duration_ms, frozen }
  ui.refused = null
  ui.note = ''
  // The preview starts on its last frame; Play plays it.
  finisherPlays.delete(DRAFT_PLAY)
  await customMoved($)
}

/**
 * Ask Claude to fix it: only the mod's own problem lines (and where in the file), for the player's
 * own file. A title the server refused is the title box's (drawn there), never a problem in the file.
 */
async function fixDraft($: $) {
  const key = keyOf(await serverCfg($))
  const ui = customFor(key)
  const refused = artProblems(ui.refused)
  const list = refused.length ? refused : artProblems(ui.draft?.problems)
  if (!list.length) return
  const filled = await fillPrompt($, key, CUSTOM.fixPrompt(list.map(problemLine)))
  await customNote($, key, filled ? CUSTOM.fixFilled : CUSTOM.notFilled)
}

async function copyCustomPrompt($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const key = keyOf(await serverCfg($))
  const text = customFor(key).prompt ?? CUSTOM.prompt
  const c = await $.ui.copy({ text, surface }).catch(() => ({ isCopied: false }))
  await customNote($, key, c.isCopied ? CUSTOM.copied : CUSTOM.notCopied)
}

async function pickCustomSlot($: $, kind: string) {
  const key = keyOf(await serverCfg($))
  customFor(key).slot = kindOf(kind)
  await customMoved($)
}

/**
 * Submit: POST /finishers with exactly { slot, title, svg }, finisher.svg read again as it stands.
 * The local check never blocks it (the server's allowlist can widen after the freeze). A 422 draws
 * its problems with the same lines; any other refusal shows the server's message.
 */
async function submitDraft($: $) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const key = keyOf(cfg)
  if (!customOf((await configOf($, cfg)).raw).create) return
  const ui = customFor(key)
  ui.restartAsk = false
  const svg = await readDraft($, key)
  if (svg === null) return
  const slot = ui.slot
  const title = titleFor(customTitle, CUSTOM.defaultTitle(slotName(slot)))
  const r = await api($, 'POST', '/finishers', { slot, title, svg }, { keepNote: true })
  if (keyOf(await serverCfg($)) !== key) return
  const err = errorOf(r.json)
  if (r.status === 201) {
    ui.refused = null
    await customNote($, key, CUSTOM.sent)
    // Your art, the new one pending: My finishers reads it, and reads again until it is reviewed.
    void refreshFinishers($, true).catch(() => null)
    return
  }
  if (r.status === 422 && err?.code === 'finisher_invalid') {
    ui.refused = problemsOf(r.json)
    return customNote($, key, '')
  }
  ui.refused = null
  if (err?.code === 'finishers_closed') void refreshConfig($, 'bucket').catch(() => null)
  await customNote($, key, customRefusal(r))
}

/**
 * GET /me/finishers' (or PATCH's) `mine` and `equips`, for this account: My finishers draws them.
 * Your art that left review since this session last read it gets one toast on the machine (the
 * store's finisherTold, ids only), under the Toasts switch; while any is pending the poll runs.
 */
async function holdMine($: $, key: string, json: unknown) {
  const ui = customFor(key)
  const before = ui.me
  const next = customMeOf(json)
  ui.me = next
  await customMoved($)
  if (before) {
    const done = next.mine.filter(x => (x.status === 'approved' || x.status === 'rejected') && before.mine.some(b => b.id === x.id && b.status === 'pending'))
    if (done.length) await tellReviewed($, done)
  }
  if (next.mine.some(x => x.status === 'pending')) await startMinePoll($)
}

async function tellReviewed($: $, done: Art[]) {
  const raw = await storeGet<unknown>($, K.finisherTold, [])
  const told = Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []
  const fresh = done.filter(x => !told.includes(x.id))
  if (!fresh.length) return
  await save($, K.finisherTold, [...told, ...fresh.map(x => x.id)].slice(-20))
  for (const x of fresh) await ambient($, x.status === 'approved' ? CUSTOM.toastApproved(slotName(x.slot).toLowerCase()) : CUSTOM.toastRejected(slotName(x.slot).toLowerCase()))
}

/** My finishers' poll: GET /me/finishers at max(60 s, poll_ms.idle) while one of yours is pending, for 30 minutes at most. */
async function startMinePoll($: $) {
  if (loops.has(MINE_LOOP)) return
  minePollSince = await $.clock.now()
  loop($, MINE_LOOP, async () => Math.max(MINE_EVERY_MS, (await configOf($)).poll.idle), isCurrent => pollMine($, isCurrent))
}

async function pollMine($: $, isCurrent: () => boolean): Promise<Answer | void> {
  const cfg = await serverCfg($)
  if (!cfg.token || (await $.clock.now()) - minePollSince > MINE_FOR_MS) return stopLoop(MINE_LOOP)
  const key = keyOf(cfg)
  const r = await api($, 'GET', '/me/finishers', undefined, { keepNote: true })
  if (!isCurrent() || keyOf(await serverCfg($)) !== key) return r
  if (r.status === 200) {
    await holdMine($, key, r.json)
    if (!customFor(key).me?.mine.some(x => x.status === 'pending')) stopLoop(MINE_LOOP)
  }
  return r
}

/**
 * Equips art in a slot (PATCH /me/finishers `{ equip: { slot, id } }`, or `{ slot, code }` for a
 * typed code), or empties the slot (`id: null`). A code typed for another slot goes once more in
 * the slot the server names (409 finisher_wrong_slot), so a code needs no slot picked. The answer
 * has GET /me/finishers' shape, which My finishers and the picks take. `matchId` puts the line
 * under that result's art instead of in the view.
 */
async function equipArt($: $, slot: string, pick: { id: string | null } | { code: string }, matchId: string | null) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const key = keyOf(cfg)
  let used = kindOf(slot)
  let r = await api($, 'PATCH', '/me/finishers', { equip: { slot: used, ...pick } }, { keepNote: true })
  const named = 'code' in pick && r.status === 409 && errorOf(r.json)?.code === 'finisher_wrong_slot' ? wrongSlotOf(r.json) : null
  if (named && named !== used) {
    used = named
    r = await api($, 'PATCH', '/me/finishers', { equip: { slot: used, ...pick } }, { keepNote: true })
  }
  if (keyOf(await serverCfg($)) !== key) return
  let line: string
  if (r.status === 200) {
    await holdMine($, key, r.json)
    const picks = finisherMeOf(r.json)
    if (picks) await update($, finisherUi, u => (u.key === key ? { ...u, me: picks } : u))
    line = 'id' in pick && pick.id === null ? CUSTOM.unequippedNow(slotName(used).toLowerCase()) : CUSTOM.equippedNow(slotName(used).toLowerCase())
  } else {
    if (errorOf(r.json)?.code === 'finishers_closed') void refreshConfig($, 'bucket').catch(() => null)
    line = customRefusal(r)
  }
  if (!matchId) return customNote($, key, line)
  artNotes.set(matchId, line)
  await update($, finisherRev, n => n + 1)
}

/** Equip a code: the typed code (any case, spaces and dashes ignored), in the gallery's slot, or wherever the server says it goes. */
async function equipTypedCode($: $) {
  const key = keyOf(await serverCfg($))
  const code = artCode(customCode)
  if (!code) return customNote($, key, CUSTOM.badCode)
  await equipArt($, customFor(key).gallery.slot ?? 'knockout', { code }, null)
}

/** Delete on your own art: the first press asks, the second deletes it (DELETE /finishers/:id) and reads your art again. */
async function deleteArt($: $, id: string) {
  const cfg = await serverCfg($)
  if (!cfg.token) return
  const key = keyOf(cfg)
  const ui = customFor(key)
  if (ui.deleteAsk !== id) {
    ui.deleteAsk = id
    return customNote($, key, CUSTOM.deleteAsk)
  }
  ui.deleteAsk = null
  const r = await api($, 'DELETE', `/finishers/${id}`, undefined, { keepNote: true })
  if (keyOf(await serverCfg($)) !== key) return
  await customNote($, key, r.status === 204 ? CUSTOM.deleted : customRefusal(r))
  void refreshFinishers($, true).catch(() => null)
}

/**
 * The gallery (GET /finishers?sort=&slot=&offset=&limit=20), while config's gallery is on for you:
 * a sort or a slot reads its first page, More appends the next. A 403 finishers_closed means config
 * is stale, so it is read again.
 */
async function readGallery($: $, patch: { sort?: 'top' | 'new'; slot?: string | null; more?: boolean }) {
  const cfg = await serverCfg($)
  if (!cfg.token || !customOf((await configOf($, cfg)).raw).gallery) return
  const key = keyOf(cfg)
  const ui = customFor(key)
  const g = ui.gallery
  if (patch.sort) g.sort = patch.sort
  if (patch.slot !== undefined) g.slot = patch.slot === null ? null : kindOf(patch.slot)
  const offset = patch.more ? g.items.length : 0
  await customMoved($)
  const r = await api($, 'GET', `/finishers?sort=${g.sort}${g.slot ? `&slot=${g.slot}` : ''}&offset=${offset}&limit=${GALLERY_PAGE}`, undefined, { keepNote: true })
  if (keyOf(await serverCfg($)) !== key) return
  const now2 = customFor(key).gallery
  const page = r.status === 200 ? galleryOf(r.json) : null
  if (page) {
    now2.items = patch.more ? [...now2.items, ...page.items.filter(x => !now2.items.some(y => y.id === x.id))] : page.items
    now2.total = page.total
    now2.read = true
    now2.note = ''
  } else {
    now2.note = customRefusal(r)
    if (errorOf(r.json)?.code === 'finishers_closed') void refreshConfig($, 'bucket').catch(() => null)
  }
  await customMoved($)
}

/** Preview on a gallery row: that art in our frame (fetched into memory only on a surface that draws it), on its last frame, with Play. */
async function previewGalleryArt($: $, id: string, surface: string) {
  const cfg = await serverCfg($)
  const key = keyOf(cfg)
  const ui = customFor(key)
  const art = ui.gallery.items.find(x => x.id === id) ?? null
  ui.galleryPreview = art
  finisherPlays.delete(GALLERY_PLAY)
  await customMoved($)
  if (art?.sha256 && drawsArt(customOf((await configOf($, cfg)).raw), surface)) wantArt($, { id: art.id, sha256: art.sha256 }, false)
}

/** The Finishers view opened: the gallery's first page, while it is on for you. */
async function customOpened($: $) {
  const cfg = await serverCfg($)
  if (cfg.token && customOf((await configOf($, cfg)).raw).gallery) await readGallery($, {})
}

async function askArtReport($: $, matchId: string | null) {
  reportOpen = matchId
  await update($, finisherRev, n => n + 1)
}

/** Report on a result's custom art: POST /finishers/:id/report with the reason and the match it played in. */
async function reportArt($: $, matchId: string, reason: ReportReason) {
  reportOpen = null
  const ref = artRefs.get(matchId)
  if (!ref || !(REPORT_REASONS as readonly string[]).includes(reason)) return
  const body = /^m_[A-Za-z0-9_-]{12}$/.test(matchId) ? { reason, match_id: matchId } : { reason }
  const r = await api($, 'POST', `/finishers/${ref.id}/report`, body, { keepNote: true })
  artNotes.set(matchId, r.status === 204 ? CUSTOM.reported : customRefusal(r))
  await update($, finisherRev, n => n + 1)
}

/** Art held in memory, the most recently drawn kept longest. */
function heldArt(sha: string) {
  const held = artHeld.get(sha)
  if (held) {
    artHeld.delete(sha)
    artHeld.set(sha, held)
  }
  return held
}

/**
 * Starts fetching `ref`'s art unless it is held, failed or already coming. From a draw (`inDraw`)
 * it starts on a timer, since a draw writes nothing and the fetch's redraw is a state write.
 */
function wantArt($: $, ref: { id: string; sha256: string }, inDraw: boolean) {
  if (artHeld.has(ref.sha256) || artFailed.has(ref.sha256) || artLoading.has(ref.sha256)) return
  artLoading.add(ref.sha256)
  const go = () => void fetchArt($, ref).catch(err => $.ui.log(`CCSR finisherart: ${(err as Error).message}`))
  if (inDraw) $.clock.after(0, go)
  else go()
}

/**
 * GET /finishers/:id/art into memory: the art the server sent (its sha256 the ref's), checked again
 * with the validator's ceilings (art approved under higher limits stays approved when they are
 * lowered), and its held last frame. A refusal, an answer that doesn't hold, a check that fails or
 * no answer in 10 s marks it failed: it draws the default kind this session.
 */
async function fetchArt($: $, ref: { id: string; sha256: string }) {
  let settled = false
  const fail = () => {
    if (settled) return
    settled = true
    artLoading.delete(ref.sha256)
    artFailed.add(ref.sha256)
    for (const k of [...artFailed].slice(0, Math.max(0, artFailed.size - ART_FAILED_KEEP))) artFailed.delete(k)
    void update($, finisherRev, n => n + 1)
    void customMoved($)
  }
  const watchdog = $.clock.after(ART_FETCH_MS, fail)
  try {
    const r = await api($, 'GET', `/finishers/${ref.id}/art`, undefined, { keepNote: true })
    if (settled) return
    const body = (r.json ?? {}) as { id?: unknown; sha256?: unknown; svg?: unknown }
    if (r.status !== 200 || body.id !== ref.id || body.sha256 !== ref.sha256 || typeof body.svg !== 'string' || (await sha256hex(body.svg)) !== ref.sha256) return fail()
    const check = checkArt(body.svg, ART_CEILINGS)
    const clean = check.ok ? check.clean : null
    const frozen = clean ? freezeArt(clean, (customTiming(check.stats.duration_ms).totalMs + 3000) / 1000) : null
    if (!clean || !frozen || settled) return fail()
    settled = true
    watchdog.cancel()
    artLoading.delete(ref.sha256)
    artHeld.set(ref.sha256, { clean, durationMs: check.stats.duration_ms, frozen })
    for (const k of [...artHeld.keys()].slice(0, Math.max(0, artHeld.size - ART_KEEP))) artHeld.delete(k)
    await update($, finisherRev, n => n + 1)
    await customMoved($)
  } catch {
    fail()
  }
}

/**
 * Takes a summary's `finisher.art` into module memory, never the link atom ($.state), and starts
 * fetching the art when this pane draws it (so a result rarely waits on it). Returns the summary
 * without it.
 */
async function keepArtRef($: $, sm: ApiMatchSummary): Promise<ApiMatchSummary> {
  const f = sm.finisher
  if (!f || f.art === undefined) return sm
  const ref = artRefOf(f.art)
  if (!ref) artRefs.delete(sm.id)
  else {
    artRefs.delete(sm.id)
    artRefs.set(sm.id, ref)
    for (const k of [...artRefs.keys()].slice(0, Math.max(0, artRefs.size - ART_REFS_KEEP))) artRefs.delete(k)
    const me = cleanServer((await serverCfg($)).handle ?? '')
    const sw = (await read($, settings)).surfaces
    const custom = customOf((await configOf($)).raw)
    if (paneSurface && sw.finishers !== 'off' && artShown({ custom, surface: paneSurface, view: sm.winner === me ? 'win' : 'lose', theirs: sw.oppFinishers !== 'default', own: ref.by === me })) wantArt($, ref, false)
  }
  return { ...sm, finisher: { ...f, art: null } }
}

/**
 * The custom art a decided match's finisher draws on this screen: the art held in memory, 'loading'
 * while it is being fetched (a fetch is started), or null for the default kind (no art, not drawn
 * here, or a fetch or check that failed).
 */
async function artFor($: $, surface: string, sm: ApiMatchSummary, input: FinisherInput, theirs: boolean, me: string): Promise<{ ref: ArtRef; held: HeldArt } | 'loading' | null> {
  // The fetch's redraw moves finisherRev: every branch reads it, the loading line's included, or a draw that shows the line
  // would never hear the art land (found in the suite: the line stayed until some other state happened to move).
  await read($, finisherRev)
  const ref = artRefs.get(sm.id)
  if (!ref) return null
  const custom = customOf((await configOf($)).raw)
  if (!artShown({ custom, surface, view: input.view, theirs, own: ref.by === me })) return null
  const held = heldArt(ref.sha256)
  if (held) return { ref, held }
  if (artFailed.has(ref.sha256)) return null
  wantArt($, ref, true)
  return 'loading'
}

/** Our HUD and strip for custom art, each built once per input. */
function customHud(input: FinisherInput) {
  const key = `hud ${JSON.stringify(input)}`
  const have = frameMemo.get(key)
  if (have !== undefined) return have
  const svg = finisherHud(input)
  frameMemo.set(key, svg)
  for (const k of [...frameMemo.keys()].slice(0, Math.max(0, frameMemo.size - 8))) frameMemo.delete(k)
  return svg
}

function customStrip(input: FinisherInput, atMs: number) {
  const key = `strip ${atMs} ${JSON.stringify(input)}`
  const have = frameMemo.get(key)
  if (have !== undefined) return have
  const svg = finisherStrip(input, { atMs })
  frameMemo.set(key, svg)
  for (const k of [...frameMemo.keys()].slice(0, Math.max(0, frameMemo.size - 8))) frameMemo.delete(k)
  return svg
}

/**
 * Custom art on screen: three stacked Svgs with no gap, our HUD (the handles, the points, the bell
 * at 0.8 s), the art, our strip (the line and the stats, in at customTiming's lineAtMs), playing
 * from the start for customTiming's totalMs, then each held on its last frame at totalMs + 3000
 * (freeze for ours, freezeArt for the art), as the six finishers do. Short draws the held frames at
 * once. Replay changes all three sources (withCounter). Then "Finisher by {handle}" as Text, Replay,
 * the share link, and `extra` (a result's Report and Equip this).
 */
async function customFrame($: $, els: El, f: FinisherShow, held: HeldArt, by: string, extra: RenderElement | null): Promise<RenderElement> {
  await read($, finisherRev)
  const { Box, Text, Button, Svg, Link } = els
  const short = (await read($, settings)).surfaces.finishers === 'short'
  const t = await $.clock.now()
  const { lineAtMs, totalMs } = customTiming(held.durationMs)
  const hud = customHud(f.input)
  const strip = customStrip(f.input, lineAtMs)
  const elapsed = f.play ? t - f.play.at : Number.POSITIVE_INFINITY
  const playing = !short && !!f.play && elapsed < totalMs
  if (f.play && playing) finisherAfter($, `${f.id}:${f.play.n}:custom`, totalMs - elapsed)
  const n = f.play?.n ?? 0
  const hold = totalMs + 3000
  const words = finisherWords(f.input)
  return (
    <Box flexDirection="column">
      <Svg source={playing ? withCounter(hud, n) : freeze(hud, hold)} alt={words.stats} />
      <Svg source={playing ? withCounter(held.clean, n) : held.frozen} alt={CUSTOM.artAlt(by)} />
      <Svg source={playing ? withCounter(strip, n) : freeze(strip, hold)} alt={words.line} />
      <Text dimColor>{CUSTOM.by(by)}</Text>
      <Box gap={1} alignItems="center" flexWrap="wrap">
        <Button key={f.replayKey} label={f.replayLabel} onPress={() => f.onReplay()} />
        {f.share && <Link href={f.share.href} label={f.share.label} />}
      </Box>
      {extra}
    </Box>
  )
}

/** Under a result's custom art: Report (its six reasons, two presses) and Equip this (while the gallery is on for you), for another player's art; then any line. */
async function artActions($: $, els: El, a: Actions, sm: ApiMatchSummary, ref: ArtRef, me: string, slot: string): Promise<RenderElement | null> {
  const { Box, Text, Button } = els
  const note = artNotes.get(sm.id)
  const theirs = ref.by !== me
  if (!theirs && !note) return null
  const gallery = customOf((await configOf($)).raw).gallery
  return (
    <Box flexDirection="column">
      {theirs &&
        (reportOpen === sm.id ? (
          <Box flexDirection="column">
            <Text>{CUSTOM.reportAsk}</Text>
            <Box gap={1} flexWrap="wrap">
              {REPORT_REASONS.map(r => (
                <Button key={`ranked-report-${r}`} label={ownLine(CUSTOM.reportReasons, r, r)} onPress={() => a.finisherReport(sm.id, r)} />
              ))}
              <Button key="ranked-report-cancel" label={CUSTOM.cancel} onPress={() => a.finisherAskReport(null)} />
            </Box>
          </Box>
        ) : (
          <Box gap={1} flexWrap="wrap">
            <Button key="ranked-report" label={CUSTOM.report} onPress={() => a.finisherAskReport(sm.id)} />
            {gallery && <Button key="ranked-equip-art" label={CUSTOM.equipThis} onPress={() => a.finisherEquip(slot, ref.id, sm.id)} />}
          </Box>
        ))}
      {note && (
        <Text dimColor wrap="wrap">
          {note}
        </Text>
      )}
    </Box>
  )
}

/** A preview of art in our frame with sample data, or why it doesn't draw: the draft's (your own file) and a gallery row's. */
async function customPreview($: $, els: El, a: Actions, o: { play: string; held: HeldArt | null; loading: boolean; by: string; input: FinisherInput; drawn: boolean }) {
  const { Text } = els
  if (!o.drawn) return <Text dimColor>{CUSTOM.noSurface}</Text>
  if (!o.held) return o.loading ? <Text dimColor>{CUSTOM.loading}</Text> : <Text dimColor>{CUSTOM.previewFailed}</Text>
  const show: FinisherShow = { id: o.play, input: o.input, play: finisherPlays.get(o.play) ?? null, replayKey: `fin-${o.play}-play`, replayLabel: FINISHER.play, onReplay: () => a.finisherPlay(o.play === DRAFT_PLAY ? 'draft' : 'gallery'), share: null }
  return customFrame($, els, show, o.held, o.by, null)
}

/**
 * W10e's part of the Finishers view, under W10b's picks: Make your own (while config's create is on
 * for you), My finishers (your art and what each slot plays, while you have any or may make some)
 * and the gallery (while gallery is on for you). Nothing at all while none of them is.
 */
async function customSections($: $, e: RenderInput<'Pane'>, els: El, a: Actions): Promise<RenderElement | null> {
  await read($, customRev)
  const { Box, Text, Button, Input } = els
  const cfg = await serverCfg($)
  const l = await read($, link)
  const cc = customOf((await configOf($, cfg)).raw)
  const ui = customFor(keyOf(cfg))
  const me = ui.me
  const hasMine = !!me && (me.mine.length > 0 || Object.keys(me.equips).length > 0)
  if (!cc.create && !cc.gallery && !hasMine) return null
  const mobile = e.surface === 'mobile'
  const handle = cleanServer(l.me?.handle ?? cfg.handle ?? '')
  const sample = previewInput({ handle, callout: null, accent: 'signal', tier: l.me && !l.me.placement ? l.me.tier : 'Mud' })
  const head = (label: string) => (
    <Text bold color={STONE}>
      {label.toUpperCase()}
    </Text>
  )
  const lines = (list: Problem[], first: string) => (
    <Box flexDirection="column">
      <Text dimColor wrap="wrap">
        {first}
      </Text>
      {list.map(p => (
        <Text wrap="wrap">{`- ${problemLine(p)}`}</Text>
      ))}
    </Box>
  )
  // Make your own.
  let make: RenderElement | null = null
  if (cc.create) {
    const d = ui.draft
    const draftArt = d?.clean && d.frozen ? { clean: d.clean, durationMs: d.durationMs, frozen: d.frozen } : null
    // A refusal's problems in the file go in its list (and to Ask Claude to fix it); a refused title is drawn by the title box.
    const refusedArt = artProblems(ui.refused)
    const fixable = artProblems(d?.problems).length > 0 || refusedArt.length > 0
    make = (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          {head(CUSTOM.make)}
          <Text dimColor wrap="wrap">
            {CUSTOM.makeWhat}
          </Text>
        </Box>
        <Box gap={1} flexWrap="wrap">
          <Button key="fin-make" label={CUSTOM.makeButton} onPress={() => a.finisherMake()} />
          <Button key="fin-check" label={CUSTOM.check} onPress={() => a.finisherCheck()} />
          <Button key="fin-restart" label={CUSTOM.restart} onPress={() => a.finisherRestart()} />
          {ui.prompt && <Button key="fin-copy-prompt" label={CUSTOM.copyPrompt} onPress={x => a.finisherCopyPrompt(x.surface)} />}
        </Box>
        {d && d.problems.length > 0 && lines(d.problems, CUSTOM.found)}
        {d && d.problems.length === 0 && <Text dimColor>{CUSTOM.clean((d.durationMs / 1000).toFixed(1))}</Text>}
        {/* Your own file, sanitized, but custom art all the same: only on a surface config lists (never the terminal), as a gallery row's. */}
        {d && d.problems.length === 0 && draftArt && (await customPreview($, els, a, { play: DRAFT_PLAY, held: draftArt, loading: false, by: handle, input: sample, drawn: drawsArt(cc, e.surface) }))}
        {refusedArt.length > 0 && lines(refusedArt, CUSTOM.refused)}
        {fixable && (
          <Box>
            <Button key="fin-fix" label={CUSTOM.fix} onPress={() => a.finisherFix()} />
          </Box>
        )}
        <Box gap={1} alignItems="center" flexWrap="wrap">
          <Text>{CUSTOM.slot}</Text>
          {KINDS.map(k => (
            <Button key={`fin-slot-${k}`} label={slotName(k)} variant={ui.slot === k ? 'primary' : 'secondary'} onPress={() => a.finisherSlot(k)} />
          ))}
        </Box>
        {!mobile && <Input key="fin-title" label={CUSTOM.titleLabel} placeholder={CUSTOM.titlePlaceholder} value={customTitle} onInput={v => a.finisherTitle(v)} onSubmit={v => a.finisherTitle(v)} />}
        {titleRefused(ui.refused) && (
          <Text color={ORANGE} wrap="wrap">
            {problemLine({ code: TITLE_PROBLEM, at: null })}
          </Text>
        )}
        <Box>
          <Button key="fin-submit" label={CUSTOM.submit} variant="primary" onPress={() => a.finisherSubmit()} />
        </Box>
      </Box>
    )
  }
  // My finishers, and what each slot plays.
  let mine: RenderElement | null = null
  if (cc.create || hasMine) {
    // Your own equipped art says so on its row (with Unequip); the list under it is other players' art you equipped.
    const equipped = KINDS.filter(k => {
      const ref = me?.equips[k]
      return !!ref && !me?.mine.some(x => x.id === ref.id)
    })
    mine = (
      <Box flexDirection="column" gap={1}>
        {head(CUSTOM.mine)}
        {!me ? (
          <Text dimColor>{FINISHER.checking}</Text>
        ) : me.mine.length === 0 ? (
          <Text dimColor>{CUSTOM.noneYet}</Text>
        ) : (
          me.mine.map(art => {
            const isOn = me.equips[kindOf(art.slot)]?.id === art.id
            const line = isOn ? `${artStatusLine(art)} ${CUSTOM.equippedTag}` : artStatusLine(art)
            return (
              <Box key={`fin-art-${art.id}`} flexDirection="column">
                <Text>{CUSTOM.row(art.title, slotName(art.slot))}</Text>
                <Text dimColor wrap="wrap">
                  {art.code ? `${line} ${CUSTOM.code(art.code)}` : line}
                </Text>
                <Box gap={1} flexWrap="wrap">
                  {art.status === 'approved' &&
                    (isOn ? (
                      <Button key={`fin-unequip-${art.id}`} label={CUSTOM.unequip} onPress={() => a.finisherEquip(art.slot, null)} />
                    ) : (
                      <Button key={`fin-equip-${art.id}`} label={CUSTOM.equip} onPress={() => a.finisherEquip(art.slot, art.id)} />
                    ))}
                  <Button key={`fin-delete-${art.id}`} label={CUSTOM.delete} onPress={() => a.finisherDelete(art.id)} />
                </Box>
              </Box>
            )
          })
        )}
        {equipped.length > 0 && (
          <Box flexDirection="column">
            <Text bold>{CUSTOM.equipped}</Text>
            {equipped.map(k => {
              const ref = me?.equips[k]
              return (
                <Box key={`fin-equipped-${k}`} gap={1} alignItems="center" flexWrap="wrap">
                  <Text>{CUSTOM.equippedBy(slotName(k), ref?.by ?? '')}</Text>
                  <Button key={`fin-unequip-${k}`} label={CUSTOM.unequip} onPress={() => a.finisherEquip(k, null)} />
                </Box>
              )
            })}
          </Box>
        )}
      </Box>
    )
  }
  // The gallery.
  let gallery: RenderElement | null = null
  if (cc.gallery) {
    const g = ui.gallery
    const p = ui.galleryPreview
    const drawn = drawsArt(cc, e.surface)
    const held = p?.sha256 ? (artHeld.get(p.sha256) ?? null) : null
    gallery = (
      <Box flexDirection="column" gap={1}>
        {head(CUSTOM.gallery)}
        <Box gap={1} flexWrap="wrap">
          <Button key="fin-gallery-top" label={CUSTOM.top} variant={g.sort === 'top' ? 'primary' : 'secondary'} onPress={() => a.finisherGallery({ sort: 'top' })} />
          <Button key="fin-gallery-new" label={CUSTOM.newest} variant={g.sort === 'new' ? 'primary' : 'secondary'} onPress={() => a.finisherGallery({ sort: 'new' })} />
        </Box>
        <Box gap={1} flexWrap="wrap">
          <Button key="fin-gallery-all" label={CUSTOM.allSlots} variant={g.slot === null ? 'primary' : 'secondary'} onPress={() => a.finisherGallery({ slot: null })} />
          {KINDS.map(k => (
            <Button key={`fin-gallery-slot-${k}`} label={slotName(k)} variant={g.slot === k ? 'primary' : 'secondary'} onPress={() => a.finisherGallery({ slot: k })} />
          ))}
        </Box>
        {!g.read && !g.note && <Text dimColor>{FINISHER.checking}</Text>}
        {g.read && g.items.length === 0 && <Text dimColor>{CUSTOM.empty}</Text>}
        {g.items.map(art => (
          <Box key={`fin-gallery-row-${art.id}`} flexDirection="column">
            <Text>{CUSTOM.galleryRow(art.title, art.by, slotName(art.slot))}</Text>
            <Box gap={1} alignItems="center" flexWrap="wrap">
              <Text dimColor>{CUSTOM.plays(art.plays)}</Text>
              <Button key={`fin-gallery-preview-${art.id}`} label={CUSTOM.preview} onPress={x => a.finisherGalleryPreview(art.id, x.surface)} />
              <Button key={`fin-gallery-equip-${art.id}`} label={CUSTOM.equip} onPress={() => a.finisherEquip(art.slot, art.id)} />
            </Box>
          </Box>
        ))}
        {g.items.length < g.total && (
          <Box>
            <Button key="fin-gallery-more" label={CUSTOM.more} onPress={() => a.finisherGallery({ more: true })} />
          </Box>
        )}
        {p && (await customPreview($, els, a, { play: GALLERY_PLAY, held, loading: !!p.sha256 && artLoading.has(p.sha256), by: p.by, input: sample, drawn }))}
        {g.note && (
          <Text color={ORANGE} wrap="wrap">
            {g.note}
          </Text>
        )}
        <Box gap={1} alignItems="center" flexWrap="wrap">
          {!mobile && <Input key="fin-code" label={CUSTOM.codeLabel} placeholder={CUSTOM.codePlaceholder} value={customCode} onInput={v => a.finisherCode(v)} onSubmit={v => {
                a.finisherCode(v)
                a.finisherEquipCode()
              }} />}
          <Button key="fin-code-equip" label={CUSTOM.equip} onPress={() => a.finisherEquipCode()} />
        </Box>
      </Box>
    )
  }
  return (
    <Box flexDirection="column" gap={1}>
      {make}
      {mine}
      {gallery}
      {ui.note && (
        <Text color={ORANGE} wrap="wrap">
          {ui.note}
        </Text>
      )}
    </Box>
  )
}


// ================================================================== REGISTER

const PANE = 'ccsr'
const READY = 'ccsr-ready'
const LIVE_WINDOW = 10 * 60_000

const HELP = `CCSR commands:
/ccsr                    open the CCSR pane
/ccsr grind              this week, month and all time
/ccsr scan               look for new commits now
/ccsr backtest [days]    score your past sessions (default 7 days)
/ccsr match 1h|3h|sprint practice match against a bot
/ccsr forfeit            give up the live match
/ccsr tracking on|off    Grind tracking
/ccsr share on|off       show your commit titles to opponents
/ccsr band on|off        the bar above the prompt
/ccsr quiet on|off       Quiet: the race band in a match, the noise around it off
/ccsr last               your last result as a scorecard
/ccsr status             one line of where you stand
Chat lives in the pane only, so it never reaches Claude.`

/** The help text, with W6b's `/ccsr challenge` line only while challenges are on for this player. */
function helpText(cf: Pick<ModConfig, 'raw'>) {
  return challengesOf(cf).on ? HELP.replace('\nChat lives in the pane only', `\n${CHALLENGE.help}\nChat lives in the pane only`) : HELP
}

/**
 * A toast nobody asked for (a score, an opponent commit, a warning, a result):
 * shown only while toasts are on and Quiet is off. `ready` is the match-found
 * ready check, which no setting turns off. Replies to a button press or a
 * command are not ambient and always show.
 */
async function ambient($: $, text: string, kind: 'note' | 'match' | 'ready' = 'note', timeoutMs = 6000) {
  const p = (await read($, settings)).surfaces
  if (kind === 'ready' || p.toasts === 'all' || (p.toasts === 'match' && kind === 'match')) $.ui.toast(text, { timeoutMs })
}

/**
 * One of the mod's sounds (mod/sounds/), while Sounds is on. W10b: the result's win or loss sting
 * is the finisher's own recorded sound when config names one for its kind (finisherSting), and the
 * mod's own wav when it names none or that one won't play. The recorded one is started, never
 * awaited: the engine fetches it with no stated timeout and play resolves only once it has played,
 * and pollMatch rings the result inside the ranked loop's tick, which a slow or stalled fetch would
 * hold until the watchdog gave up on it (a failure, so the loop backed off as the result landed).
 */
async function ring($: $, name: 'chime' | 'bell' | 'win' | 'loss') {
  if ((await read($, settings)).surfaces.sounds !== 'on') return
  try {
    const url = name === 'win' || name === 'loss' ? await finisherSting($) : null
    if (url)
      void $.audio
        .play({ url })
        .catch(() => $.audio.play({ asset: `sounds/${name}.wav` }))
        .catch(() => null)
    else await $.audio.play({ asset: `sounds/${name}.wav` })
  } catch {
    // No player on this platform (a Linux or Windows terminal): stay quiet.
  }
}

async function refreshStatus($: $) {
  $.ui.status(await statusLine($))
}

function mmss(ms: number) {
  const sec = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

/** The line after the bell, until the result: what is still happening, and how long until the result when the server gave the grace's end. */
function countingLine(sm: { grace_ends_at?: string | null }, t: number) {
  const left = resultInMs(sm, t)
  return left === null ? MOD.counting : left <= 0 ? MOD.deciding : MOD.countingIn(mmss(left))
}

/** The status line for where the player is (docs/ui-spec.md, States): full, short, or off. */
async function statusLine($: $): Promise<string | undefined> {
  const s = await read($, settings)
  if (s.surfaces.status === 'off') return undefined
  const short = s.surfaces.status === 'short'
  const t = await $.clock.now()
  const cfg = await serverCfg($)
  const l = await read($, link)
  const sh = await rankedShared($)
  // W4b: a notice's status flash, for its 8 s; the ready check's line is never covered.
  if (noticeFlash && t < noticeFlash.until && sh.phase !== 'offered') return short ? noticeFlash.short : noticeFlash.full
  const placing = l.me?.placement ?? null
  const tier = l.me ? (placing ? `Mud, placing ${placing.played} of ${placing.of}` : `${l.me.tier} ${l.me.rating}`) : null
  if (sh.phase === 'queued') {
    const catalog = catalogOf((await configOf($, cfg)).raw)
    const labels = sh.queuedMin.map(m => labelFor(m, l.lanes, catalog))
    return short ? `◆ queue ${mmss(t - sh.since)}` : `◆ CCSR  in queue ${mmss(t - sh.since)}${labels.length ? ` · ${labels.join(' ')}` : ''}`
  }
  if (sh.phase === 'offered' && l.queue?.offer) {
    const o = l.queue.offer
    const left = mmss(Date.parse(o.expires_at) - t)
    // W6b: a challenge's ready check: the sender accepts; the taker already did, and waits on them.
    if (o.kind === 'challenge' && o.you_accepted) return short ? CHALLENGE.statusShortWaiting(left) : CHALLENGE.statusWaiting(o.opponent.handle)
    if (o.kind === 'challenge' && !short) return CHALLENGE.statusAccept(left)
    return short ? `◆ accept ${left}` : `◆ CCSR  opponent found · accept in ${left}`
  }
  if (sh.phase === 'live' && l.ranked?.summary) {
    const sm = l.ranked.summary
    const { mine, them } = rankedSides(sm, cfg.handle ?? '')
    const score = `${mine.points}-${them.points}`
    if (sm.status === 'grace') {
      // Counting after the bell: the time until the result when the server gave the grace's end, else the old word.
      const result = resultInMs(sm, t)
      if (!result) return short ? `◆ counting ${score}` : `◆ CCSR  bell · counting · ${score}`
      return short ? `◆ result ${mmss(result)} · ${score}` : `◆ CCSR  bell · result in ${mmss(result)} · ${score}`
    }
    if (l.online === false) return short ? `◆ offline · ${l.outbox} waiting` : `◆ CCSR  offline · ${l.outbox} score${l.outbox === 1 ? '' : 's'} waiting`
    const left = sm.deadline ? Date.parse(sm.deadline) - t : 0
    if (short) return `◆ ${score} · ${clock(left)}`
    const d = await read($, dirty)
    if (left <= warnMs(sm) && d && d.files > 0) return `◆ CCSR  live ${score} · ${clock(left)} · ${d.files} file${d.files === 1 ? '' : 's'} uncommitted`
    return `◆ CCSR  live ${score} · ${clock(left)}${tier ? ` · ${tier}` : ''}`
  }
  const m = await read($, match)
  if (m && m.status === 'live' && m.kind === 'practice') {
    const score = `${m.myPoints}-${liveOpp(m, t)}`
    return short ? `◆ ${score} · ${clock(m.deadline - t)}` : `◆ CCSR  practice ${score} · ${clock(m.deadline - t)} · vs ${m.opp.handle}`
  }
  if (!cfg.token) return short ? '◆ CCSR · not set up' : '◆ CCSR · not set up · /ccsr to start'
  const wk = totals(await read($, ledger), periodStart('week', t), await read($, weekTotals))
  if (short) return `◆ ${placing ? `Mud ${placing.played}/${placing.of}` : (l.me?.rating ?? '')} · Grind ${wk.points}`
  return `◆ CCSR  ${tier ?? cfg.handle} · ${s.tracking ? `Grind ${wk.points} this week${l.grindRank ? ` · #${l.grindRank}` : ''}` : 'Grind off'} · open with /ccsr`
}

let lastDirtyAt = 0

/** Uncommitted files in this session's repo, for the last 10 minutes of a match. Every 30 seconds at most. */
async function checkDirty($: $) {
  const t = await $.clock.now()
  if (t - lastDirtyAt < 30_000) return
  lastDirtyAt = t
  try {
    const root = await repoRoot($, await $.session.cwd())
    if (!root) return
    const r = await git($, root, ['status', '--porcelain'], 10_000)
    if (r.exitCode === 0) await update($, dirty, () => ({ repo: repoName(root), files: r.stdout.split('\n').filter(x => x.trim()).length }))
  } catch {
    // No git here (or the Desktop app refused a process): the band just skips the count.
  }
}

async function onScore($: $, c: ScoredCommit, coder: CoderBlock | null = null) {
  // To the server: the Grind while tracking is on, and a ranked match whenever one is running.
  const ranked = (await read($, link)).ranked?.summary?.status
  if (!c.matchOnly || ranked === 'live' || ranked === 'grace') {
    // The coder block (W7-2) rides with the score into the outbox, never into the ledger.
    await enqueue($, [c], coder ? new Map([[c.pid, coder]]) : undefined)
    void flushOutbox($)
  }
  const counted = (await syncMatch($)) > 0
  const where = counted || ranked === 'live' || ranked === 'grace' ? 'match' : 'grind'
  await update($, badges, all => {
    const hit = Object.entries(all).find(([, b]) => b.status === 'scoring' && c.sha.startsWith(b.sha))
    return hit ? { ...all, [hit[0]]: { ...hit[1], status: 'done' as const, where, points: c.points, base: c.base, category: c.category, craft: c.craft, reason: clean(c.reason) } } : all
  })
  if (c.authoredAt >= loadedAt - LIVE_WINDOW) turnPoints += c.points
  if (c.authoredAt >= loadedAt - LIVE_WINDOW) {
    const craft = c.craft === 'clean' ? ' · clean +1' : c.craft === 'sloppy' ? ' · sloppy -1' : ''
    await ambient($, `+${c.points} points · ${c.category}${craft} · ${clean(c.title).slice(0, 60)}${counted ? ' · counts in your match' : ''}`)
    // W4b: the notices' score trigger, and first_score for the first one on this machine (never for a rescore).
    void noticeScored($, c).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  }
  await refreshStatus($)
}

/**
 * Single-flight per session. A call made while a scan runs gets that scan and
 * asks for one more after it (forced if any caller wanted force), so a commit
 * landing mid-scan is never dropped. The slot clears as soon as the scan
 * settles, before anyone awaiting it resumes, so they can start a fresh one.
 */
function runScan($: $, force = false): Promise<ScanResult> {
  if (scanning) {
    rescan = { force: force || !!rescan?.force }
    return scanning
  }
  const job = scanGrind($, force, (c, coder) => onScore($, c, coder))
  scanning = job
  const settle = () => {
    if (scanning === job) scanning = null
    if (rescan && !scanning) {
      const again = rescan.force
      rescan = null
      void runScan($, again).catch(() => null)
    }
  }
  job.then(settle, settle)
  void job.then(() => afterScan($)).catch(() => null)
  return job
}

async function afterScan($: $) {
  await syncMatch($)
  await flushOutbox($)
  await refreshStatus($)
}

function scheduleScan($: $, ms = 1500) {
  scanSoon?.cancel()
  scanSoon = $.clock.after(ms, () => void runScan($).catch(err => $.ui.log(`CCSR scan: ${(err as Error).message}`)))
}

function startTicker($: $) {
  stopTicker?.()
  const timer = $.clock.every(1000, () => void tickOnce($, timer))
  stopTicker = () => timer.cancel()
}

async function tickOnce($: $, timer: { cancel: () => void }) {
  await tick($, text => void ambient($, text, 'note', 5000))
  const m = await read($, match)
  if (!m || m.status !== 'live') {
    timer.cancel()
    if (stopTicker) stopTicker = null
  }
  await refreshStatus($)
}

/** Every 30 seconds in every session: the clock moves, shared values refresh, a match another session started gets a ticker here too. */
async function slowSync($: $) {
  const t = await $.clock.now()
  await update($, now, () => t)
  await syncFromStore($)
  // The account and the boards as another session's read last found them: taken, never asked for again.
  await adoptSeen($)
  const m = await read($, match)
  if (m && m.status === 'live' && m.kind === 'practice' && !stopTicker) startTicker($)
  // Another session joined the queue or a match: follow it here too.
  const sh = await rankedShared($)
  if (sh.phase === 'queued' || sh.phase === 'offered' || sh.phase === 'live') startRankedPoll($)
  // Between matches with the Match tab on screen (a pane the engine opened by itself, say): the lanes poll.
  else await idlePoll($)
  // The account (rating, tier, the placement count, the record) is this session's own copy too, and only the session whose poll
  // read a result asked for it again: every other one drew "placing 0 of 3" until it was restarted. So a session that sees the
  // store leave a match it didn't read the result of reads its account and boards once. Never on a timer: GET /me is not a cheap read.
  const rk = sh.phase === 'live' && sh.matchId ? `live:${sh.matchId}` : sh.phase
  const was = rankedSeen?.startsWith('live:') ? rankedSeen.slice(5) : null
  rankedSeen = rk
  if (was !== null && `live:${was}` !== rk && was !== accountAfter && (await serverCfg($)).token)
    void refreshAccount($)
      .then(() => refreshBoards($))
      .then(() => refreshStatus($))
      .catch(() => null)
  // The account a result still owes this session (accountOwed): no read of its own answered and no newer copy came from the session
  // that read the result. Asked for a minute on, and again each minute a few times: the status line and the cards follow.
  else if (accountOwed && t - accountOwed.since >= ACCOUNT_OWED_MS && (await serverCfg($)).token) {
    accountOwed = accountOwed.tries + 1 >= ACCOUNT_OWED_TRIES ? null : { ...accountOwed, since: t, tries: accountOwed.tries + 1 }
    void refreshAccount($)
      .then(() => refreshBoards($))
      .then(() => refreshStatus($))
      .catch(() => null)
  }
  // A loop whose timer was lost (a refused wait, a throw before it re-armed) starts again.
  await reviveLoops($)
  // The config, every poll_ms.config (another session's fresh read is taken instead of asking again).
  if (t - configReadAt >= (await configOf($)).poll.config) void refreshConfig($, 'timer').catch(() => null)
  // W4b: a toast or a flash due now (a window that opened, a queue that waited long enough), and the pane's countdowns.
  void noticeAlerts($).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
  await flushOutbox($)
  // W7-2: model calls waiting in memory go to this machine's records, so another session's scan sees them.
  if (capturing && stepsPending.length > 0) void writeCalls($)
  await refreshStatus($)
}

/**
 * Settings' Resync: this session, and the store's ranked state, start again from what the server
 * says. The way out of a state nothing else gets a player out of: a phase the store kept for a
 * match that is over or was never on this server, a copy that stopped moving. Nothing is touched
 * without a usable answer: only a 200, or a 404 for the stored match, changes anything, so a
 * server that can't be reached, is failing (5xx) or is shedding (429) never costs a player the
 * match they are in (the mod has no other way to find it again). A match still running is kept,
 * its page read again from the start; a ready check still open is left as it is; a queue the
 * server still has comes back with the queue read; a result still on screen is dismissed.
 */
async function resync($: $) {
  await syncFromStore($)
  const signedIn = !!(await serverCfg($)).token
  const sh = await rankedShared($)
  // Signed out there is no account or match to ask about: the season is the read that says the server answers.
  const m = await api($, 'GET', !signedIn ? '/season' : sh.matchId ? `/matches/${sh.matchId}` : '/me')
  if (!reachedOf(m)) {
    $.ui.toast(IDENTITY.offline)
    return
  }
  if (m.status !== 200 && !(signedIn && sh.matchId && m.status === 404)) {
    $.ui.toast(failLine(m))
    return
  }
  if (!signedIn) {
    // The keyring may sign this install in (refreshAccount, with no token).
    await refreshAccount($)
    await refreshStatus($)
    $.ui.toast(MOD.resynced)
    return
  }
  const summary = sh.matchId && m.status === 200 ? (m.json as { match: ApiMatchSummary }).match : null
  // A ready check still open: the phase and its match stay as they are (going idle and back would show the match-found toast
  // and ring its chime again), and the queue read below brings the offer as the server has it now.
  if (sh.phase === 'offered' && summary && summary.id === sh.matchId && summary.status === 'offered') {
    await pollRankedNow($)
    await refreshAccount($)
    await refreshBoards($)
    void refreshConfig($, 'timer').catch(() => null)
    await flushOutbox($)
    await reviveLoops($)
    await refreshStatus($)
    $.ui.toast(MOD.resynced)
    return
  }
  // This session's own copies go: each is read again below.
  await update($, link, l => ({ ...l, ranked: null, queue: null, lanes: null, lanesBucket: null, note: '' }))
  await update($, forfeitAsk, () => false)
  if (summary && (summary.status === 'live' || summary.status === 'grace')) {
    const kept = await keepArtRef($, summary)
    await setRanked($, { phase: 'live', matchId: kept.id })
    await update($, link, l => ({ ...l, ranked: { id: kept.id, summary: kept, events: [], cursor: 0, polledAt: 0 } }))
  } else {
    // Idle, as far as this machine knows: the ranked loop's next read is the queue's, whatever tab is on screen.
    await setRanked($, { phase: 'idle', matchId: null })
    lanesOnce = true
  }
  await pollRankedNow($)
  await refreshAccount($)
  await refreshBoards($)
  void refreshConfig($, 'timer').catch(() => null)
  await flushOutbox($)
  await reviveLoops($)
  await refreshStatus($)
  $.ui.toast(MOD.resynced)
}

async function openPane($: $, t?: Tab) {
  if (t) await update($, tab, () => t)
  const r = await $.ui.open({ id: PANE, title: 'CCSR' })
  // A rename since this session's last account read shows from here on (never awaited by the reply).
  void syncHandle($).catch(err => $.ui.log(`CCSR account: ${(err as Error).message}`))
  // Opened on the Match tab: the lanes now, without holding up a command's reply.
  if ((await read($, tab)) === 'match') void showLanes($).catch(err => $.ui.log(`CCSR lanes: ${(err as Error).message}`))
  return r
}

async function startMatch($: $, hours: number) {
  const m = await startPractice($, hours)
  if (!m) {
    $.ui.toast('Finish or forfeit the live match first.')
    return null
  }
  startTicker($)
  await ambient($, `Match found: ${m.opp.handle} (${tierOf(m.opp.rating)} ${m.opp.rating}). Bell in ${clock(m.deadline - m.startAt)}. Only commits count.`, 'ready')
  await refreshStatus($)
  return m
}

/** One surface switch. Chat off is the one the server hears about, so the opponent sees "chat off". W6b: so is Challenges. */
async function setSurface($: $, key: SurfaceKey, value: string) {
  await saveSettings($, { surfaces: { [key]: value } as Partial<Surfaces> })
  if (key === 'chat') await tellChat($)
  if (key === 'challenges') await switchChallenges($)
  // W6b: a challenge's message follows the Chat switch, on the server too (it moves the inbox's rev): read it again.
  if (key === 'chat' && (await challengesLive($))) await pollInboxNow($)
  await refreshStatus($)
}

/**
 * Full turns every surface on; Quiet keeps the race band in a match and cuts the noise around it.
 * W6b: neither moves the Challenges switch, which opens an inbox to anyone: that stays the player's own call.
 */
async function setPreset($: $, preset: 'full' | 'quiet') {
  const { challenges: _kept, ...surfaces } = preset === 'full' ? FULL : QUIET
  await saveSettings($, { surfaces })
  await tellChat($)
  await refreshStatus($)
}

/**
 * W6b: the Challenges switch was pressed: kept as a press the server hasn't confirmed, told, and
 * the inbox starts (read afresh) or stops with it. Off stops the inbox before the withdrawal, so
 * its reads never compete with the withdrawal's for W6a's one a second.
 */
async function switchChallenges($: $) {
  const cfg = await serverCfg($)
  const on = (await read($, settings)).surfaces.challenges !== 'off'
  if (cfg.token && challengesOf(await configOf($, cfg)).on) await save($, K.challengesPress, { key: keyOf(cfg), on, at: await $.clock.now(), told: null } satisfies ChallengesPress)
  if (!on) await challengesTick($, true)
  await tellChallenges($, true)
  if (on) await challengesTick($, true)
}

async function tellChat($: $) {
  if (!(await serverCfg($)).token) return
  const on = (await read($, settings)).surfaces.chat === 'on'
  if ((await read($, link)).me?.chat_enabled === on) return
  const r = await api($, 'PATCH', '/me', { chat_enabled: on })
  if (r.status === 200) await update($, link, l => ({ ...l, me: (r.json as { player: ApiPlayer }).player }))
}

/** Ask Claude to commit (the band at the bell): a line in the chat box. The player presses Enter; the mod never sends it. */
async function askCommit($: $) {
  try {
    await $.prompt.fill({ text: MOD.fill, mode: 'insert' })
  } catch {
    // The chat box isn't there (a headless session): nothing to fill.
  }
}

/** Copy recap: the last result in one line, scores and handles only. */
async function copyRecap($: $, surface: 'terminal' | 'desktop' | 'vscode' | 'mobile') {
  const text = await recapText($)
  if (text) await $.ui.copy({ text, surface })
}

async function recapText($: $): Promise<string | null> {
  const l = await read($, link)
  const me = (await serverCfg($)).handle ?? ''
  const sm = l.ranked?.summary
  if (sm && (sm.status === 'finished' || sm.status === 'void')) {
    const { mine, them } = rankedSides(sm, me)
    const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
    const placing = mine.player.placement
    // W6b: a challenge's is unrated, never +0. Scores and handles only, like the rest.
    if (sm.kind === 'challenge') return CHALLENGE.recap(lengthLabel(sm.length_min), mine.player.handle, mine.points, them.player.handle, them.points)
    // This text reaches Claude (/ccsr last): the length in the mod's own words, never a server label.
    return `CCSR ${lengthLabel(sm.length_min)}: ${mine.player.handle} ${mine.points}, ${them.player.handle} ${them.points}. ${placing ? `Mud, placing ${placing.played} of ${placing.of}` : `${delta >= 0 ? '+' : ''}${delta} to ${mine.rating_after ?? mine.rating_before}`}.`
  }
  const last = (await read($, history))[0]
  if (!last) return null
  const s = await read($, settings)
  return `CCSR practice ${hoursLabel(last.hours).toLowerCase()}: ${s.handle} ${last.myPoints}, ${last.opp.handle} ${last.oppPoints}.`
}

async function queueAgain($: $, where: 'band' | 'pane') {
  if ((await configOf($)).practiceOnly) return
  await clearRanked($)
  // The band draws no note and no toggles: a press there that queued nothing opens the Match tab, where both say why.
  if (!(await joinQueue($)) && where === 'band') await openPane($, 'match')
}

async function setupSeen($: $) {
  await saveSettings($, { setupSeen: true })
}

async function backtestAll($: $) {
  const list = await read($, sessions)
  const limit = await read($, btLimit)
  const runs = await read($, backtests)
  for (const s of list.slice(0, limit)) {
    if (runs[s.id]?.status === 'done') continue
    await backtestSession($, s)
  }
}

async function resetGrind($: $) {
  const live = await storeGet<Match | null>($, K.match, null)
  if (live && live.status === 'live') return $.ui.toast('Finish or forfeit the live match first: its points come from the Grind ledger.')
  const t = await $.clock.now()
  await save($, K.since, t)
  await save($, K.ledger, [])
  await save($, K.weeks, {})
  await update($, trackingSince, () => t)
  await update($, ledger, () => [])
  await update($, weekTotals, () => ({}))
  await refreshStatus($)
}

async function resetRating($: $) {
  await save($, K.rating, START_RATING)
  await save($, K.record, { w: 0, l: 0, d: 0 })
  await update($, rating, () => START_RATING)
  await update($, record, () => ({ w: 0, l: 0, d: 0 }))
  await refreshStatus($)
}

async function raceSession($: $, id: string) {
  const stored = await storeGet<Match | null>($, K.match, null)
  if (stored && stored.status === 'live') return $.ui.toast('Finish or forfeit the live match first.')
  const s = (await read($, sessions)).find(x => x.id === id)
  const run = (await read($, backtests))[id]
  if (!s || !run) return
  const m = await replay($, s, run)
  await update($, tab, () => 'match')
  $.ui.toast(`Replay: ${m.myPoints} to ${m.oppPoints} vs ${m.opp.handle}`)
}

async function backtestOne($: $, id: string) {
  const s = (await read($, sessions)).find(x => x.id === id)
  if (s) await backtestSession($, s)
}

async function forfeit($: $) {
  await update($, forfeitAsk, () => false)
  await bell($, text => $.ui.toast(text, { timeoutMs: 6000 }), true)
  await refreshStatus($)
}

function actions($: $): Actions {
  const go = (p: Promise<unknown>) => {
    p.catch(err => $.ui.toast(`CCSR: ${clean((err as Error).message)}`))
  }
  return {
    setTab: t => go(selectTab($, t)),
    setPeriod: p => go(update($, period, () => p)),
    scanNow: () => go(runScan($, true)),
    loadSessions: days => go(discoverSessions($, days)),
    backtest: id => go(backtestOne($, id)),
    backtestAll: () => go(backtestAll($)),
    race: id => go(raceSession($, id)),
    expand: id => go(update($, expanded, () => id)),
    more: () => go(update($, btLimit, n => n + 30)),
    start: hours => go(startMatch($, hours)),
    forfeit: () => go(forfeit($)),
    chat: text => go(sendChat($, text)),
    setDraft: text => go(update($, chatDraft, () => text)),
    clearMatch: () => go(clearMatch($).then(() => refreshStatus($))),
    open: t => go(openPane($, t)),
    setSurface: (key, value) => go(setSurface($, key, value)),
    askCommit: () => go(askCommit($)),
    copyRecap: surface => go(copyRecap($, surface)),
    queueAgain: where => go(queueAgain($, where)),
    setupSeen: () => go(setupSeen($)),
    askForfeit: isAsking => go(update($, forfeitAsk, () => isAsking)),
    setPreset: preset => go(setPreset($, preset)),
    setTracking: isOn => go(saveSettings($, { tracking: isOn }).then(() => refreshStatus($))),
    setShare: isOn => go(saveSettings($, { share: isOn })),
    setModel: m => go(saveSettings($, { model: m })),
    resetRating: () => go(resetRating($)),
    resetGrind: () => go(resetGrind($)),
    lab: (what, surface) => go(lab($, what, surface)),
    signup: h => go(signup($, h)),
    joinWithCode: code => go(joinWithCode($, code)),
    recoverWith: key => go(recoverWith($, key)),
    setJoinMode: mode => go(update($, joinMode, () => mode)),
    makeLinkCode: () => go(makeLinkCode($)),
    newRecoveryKey: () => go(newRecoveryKey($)),
    copyRecoveryKey: surface => go(copyRecoveryKey($, surface)),
    recoverySaved: () => go(update($, link, l => ({ ...l, recoveryFresh: false }))),
    removeInstall: id => go(removeInstall($, id)),
    removeThisInstall: () => go(removeThisInstall($)),
    setServer: url => go(setServerUrl($, url)),
    queue: () => go(joinQueue($)),
    leaveQueue: () => go(leaveQueue($)),
    toggleLength: min => go(toggleLength($, min)),
    accept: () => go(acceptOffer($)),
    decline: () => go(declineOffer($)),
    rankedForfeit: () => go(forfeitRanked($)),
    rankedChat: text => go(sendRankedChat($, text)),
    rankedClear: () => go(clearRanked($)),
    setRoom: room => go(setRoom($, room)),
    roomChat: text => go(postRoom($, text)),
    updateMod: surface => go(updateMod($, surface)),
    chooseBucket: id => go(chooseBucket($, id)),
    chooseBoard: (which, id) => go(chooseBoard($, which, id)),
    checklistSignIn: provider => go(checklistSignIn($, provider)),
    startSignIn: (provider, from) => go(startSignIn($, provider, from)),
    cancelSignIn: () => go(cancelSignInCard($)),
    dismissSignIn: () => go(dismissSignInCard($)),
    againSignIn: () => go(againSignIn($)),
    joinSignIn: handle => go(joinSignIn($, handle)),
    switchSignIn: () => go(switchSignIn($)),
    copySignInCode: surface => go(copySignInCode($, surface)),
    unlinkProvider: provider => go(unlinkProvider($, provider)),
    challengeAccept: (id, via) => go(takeChallenge($, id, via)),
    challengeDecline: id => go(dropChallenge($, id)),
    challengeMute: id => go(muteSender($, id)),
    challengeAskReport: id => go(askReport($, id)),
    challengeReport: (id, reason) => go(reportOne($, id, reason)),
    challengeStart: kind => go(startChallengeForm($, kind)),
    challengePick: patch => go(pickChallenge($, patch)),
    challengeDraft: text => {
      // The player's own words, kept out of $.state (a module variable): no redraw needed, the box holds what was typed.
      challengeDraft = text
    },
    challengeSend: () => go(sendChallenge($)),
    challengeCancel: () => go(pickChallenge($, null)),
    challengeCode: input => go(lookUpCode($, input)),
    challengeCodeClose: () => go(closeCode($)),
    challengeCopy: (id, surface) => go(copyChallengeLink($, id, surface)),
    challengeRematch: (handle, lengthMin) => go(openChallengeForm($, handle, lengthMin)),
    setModelStats: isOn => go(setModelStats($, isOn)),
    noticePress: (source, id, index, place, surface) => go(noticePress($, source, id, index, place, surface)),
    noticeDismiss: (source, id) => go(noticeDismissPress($, source, id)),
    noticeClose: id => go(noticeClose($, id)),
    finisherReplay: id => go(replayFinisher($, id)),
    finisherPreview: () => go(playPreview($)),
    finisherCallout: callout => go(pickCallout($, callout)),
    finisherAccent: key => go(pickAccent($, key)),
    finisherMake: () => go(makeFinisher($)),
    finisherRestart: () => go(restartFinisher($)),
    finisherCheck: () => go(checkDraft($)),
    finisherCopyPrompt: surface => go(copyCustomPrompt($, surface)),
    finisherFix: () => go(fixDraft($)),
    finisherSlot: kind => go(pickCustomSlot($, kind)),
    finisherTitle: text => {
      // The player's own words, kept out of $.state (a module variable): the box holds what was typed.
      customTitle = text
    },
    finisherSubmit: () => go(submitDraft($)),
    finisherEquip: (slot, id, matchId) => go(equipArt($, slot, { id }, matchId ?? null)),
    finisherDelete: id => go(deleteArt($, id)),
    finisherGallery: patch => go(readGallery($, patch)),
    finisherGalleryPreview: (id, surface) => go(previewGalleryArt($, id, surface)),
    finisherCode: text => {
      customCode = text
    },
    finisherEquipCode: () => go(equipTypedCode($)),
    finisherAskReport: matchId => go(askArtReport($, matchId)),
    finisherReport: (matchId, reason) => go(reportArt($, matchId, reason)),
    finisherPlay: which => go(replayFinisher($, which === 'draft' ? DRAFT_PLAY : GALLERY_PLAY)),
    resync: () => go(resync($)),
  }
}

async function lab($: $, what: string, surface: string) {
  const note = (text: string) => update($, labNote, () => text)
  if (what === 'toast') {
    $.ui.toast('+8 points · feature · clean +1 · per-workspace rate limits', { timeoutMs: 6000 })
    return note('Toast sent: top right of the transcript, a click dismisses it.')
  }
  if (what === 'status') {
    $.ui.status('CCSR · Gold 1184 · Grind #212 this week · in a match')
    $.clock.after(6000, () => void refreshStatus($))
    return note('Status line replaced for 6 seconds, under the prompt.')
  }
  if (what === 'ask') {
    const answer = await $.ui.ask('Match found: 3H vs 10xgary (Gold 1184). Accept?', { header: 'CCSR', options: ['Accept', 'Decline'] })
    return note(`ui.ask answered: ${answer || '(dismissed)'}`)
  }
  if (what === 'copy') {
    const r = await $.ui.copy({ text: 'https://ccsr.gg/m/demo', surface: surface as 'desktop' })
    return note(r.isCopied ? 'Copied https://ccsr.gg/m/demo to your clipboard.' : `Copy refused: ${r.reason}`)
  }
  if (what === 'dialog') {
    const r = await $.ui.open({ id: READY, title: 'Match found', focus: true, closeOnEscape: true, holdToasts: true, rows: 9 })
    return note(r.isPlaced ? 'Ready check opened as a focused dialog pane. Esc closes it.' : `Dialog not placed: ${r.reason}`)
  }
  if (what === 'git') {
    try {
      const cwd = await $.session.cwd()
      const r = await $.process.run(['git', 'log', '-1', '--format=%h %s (%ar)'], { cwd })
      return note(r.exitCode === 0 ? `$.process works on ${surface}: git log -1 in ${cwd} -> ${clean(r.stdout.trim())}` : `git ran but failed (exit ${r.exitCode}): ${clean(r.stderr.trim().slice(0, 160))}`)
    } catch (err) {
      return note(`$.process refused on ${surface}: ${clean((err as Error).message)}`)
    }
  }
  if (what === 'judge') {
    const model = (await read($, settings)).model
    const started = await $.clock.now()
    const r = await $.model.complete({ model, prompt: 'Reply with the single word: ready', maxTokens: 10 })
    const ms = (await $.clock.now()) - started
    return note(
      r.isAnswered
        ? `${model} answered "${clean(r.text.trim())}" in ${ms} ms (${r.usage.input_tokens} in, ${r.usage.output_tokens} out tokens).`
        : `Judge call failed: ${r.reason}${r.reason === 'api-error' ? ` ${r.status ?? ''} ${String(r.error)}` : ''}`,
    )
  }
  if (what === 'calibrate') {
    await note('Calibration: picking 10 commits from the last 7 days')
    const out = await calibrate($, 10, 2, 7, false)
    const d = Object.entries(out.summary.distribution).map(([p, n]) => `${p}:${n}`).join(' ')
    return note(`Calibration (${out.summary.model}, ${out.summary.rubric}): ${out.summary.identicalAcrossRuns} identical across runs, mean spread ${out.summary.meanSpreadSteps} steps, mean ${out.summary.meanPoints} pts. Points: ${d}. Craft: ${JSON.stringify(out.summary.craft)}.`)
  }
  if (what.startsWith('select:')) return note(`Select picked: ${what.slice(7)}`)
}

/**
 * One step of the boot, on its own: a step that throws is logged and the boot goes on, so no
 * failure up here leaves a load of this module without what comes after it.
 */
async function bootStep($: $, name: string, fn: () => Promise<unknown>) {
  try {
    await fn()
  } catch (err) {
    try {
      $.ui.log(`CCSR boot (${name}): ${clean(String((err as Error | undefined)?.message ?? err))}`)
    } catch {
      // Nowhere to say it.
    }
  }
}

async function boot($: $, cwd: string) {
  loadedAt = await $.clock.now()
  // A load after the first (a mod update, a reload: the desktop app reloads the plugin in every open session at once) finds the
  // pane and the band already on screen, drawn by the module that is gone. Their buttons call that module's closures, which
  // nothing holds any more, so every press is dropped until something draws them again; and nothing did, until a state write
  // happened to land. So the first thing a load does is draw them again: asked of the engine, and by a state write they read.
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // An engine without it: the state write below draws them.
  }
  await bootStep($, 'redraw', () => update($, now, () => loadedAt))
  // The timers next, before anything that can be slow or fail: a reload cancels the old module's, and a boot that stalls or
  // throws further down used to leave a load that drew but never ticked. Every 30 seconds the shared values; every two minutes
  // the scan, and a look for repos the sessions here haven't opened (one session per machine takes it); every second, what a
  // draw of the pane left to do (paneTick).
  $.clock.every(30_000, () => void slowSync($))
  $.clock.every(120_000, () => {
    void runScan($).catch(err => $.ui.log(`CCSR scan: ${(err as Error).message}`))
    lookAround($)
  })
  $.clock.every(PANE_TICK_MS, () => void paneTick($).catch(err => $.ui.log(`CCSR pane: ${(err as Error).message}`)))
  // Where the pane last drew, as the module before this one left it: a pane that was up through the reload hasn't just opened.
  await bootStep($, 'pane', async () => {
    paneKeptAt = (await read($, paneAt)) || 0
    paneDrawnAt = Math.max(paneDrawnAt, paneKeptAt)
  })
  await bootStep($, 'session', async () => {
    owner = await $.session.id()
  })
  // The watch list's memory is this session's: what a folder's repo was, and how often a look failed.
  dirRoots.clear()
  lookFails = 0
  await bootStep($, 'command', () =>
    $.command.register({
      name: 'ccsr',
      description: 'Claude Code Ship Race: open the pane, Grind, backtests, practice matches',
      argumentHint: '[grind|scan|backtest|match 1h|forfeit|quiet|help]',
    }),
  )
  try {
    const migrated = await loadAll($)
    if (migrated) await ambient($, `CCSR updated: rubric ${RUBRIC}. Your Grind is being rescored from git.`, 'note', 8000)
  } catch (err) {
    $.ui.toast(`CCSR could not load its data: ${clean((err as Error).message)}`, { timeoutMs: 8000 })
  }
  await bootStep($, 'scan state', () => update($, scan, cur => ({ ...SCAN0, ...cur, busy: false, problems: cur.problems ?? [] })))
  await bootStep($, 'backtests', () =>
    update($, backtests, all =>
      Object.fromEntries(Object.entries(all).map(([k, r]) => [k, r.status === 'running' ? { ...r, status: 'error' as const, note: 'Interrupted by a reload, press Rescore' } : r])),
    ),
  )
  await bootStep($, 'repo', async () => {
    const repo = await $.session.repo()
    const root = await repoRoot($, repo?.root ?? cwd)
    if (root) await addRepo($, root)
  })
  // A developer tool (it spends the player's usage when Claude calls it): only with CCSR_DEV=1, never in a player's tool list.
  let isDev = false
  try {
    isDev = (await $.env.get('CCSR_DEV')) === '1'
  } catch {
    isDev = false
  }
  if (isDev) await bootStep($, 'tool', () => $.tool.register({
    name: 'calibrate',
    description:
      "CCSR developer tool: scores the player's recent commits several times each with the current judge model and rubric (no cache) and returns the spread, the points distribution, how often the craft mark fires, and per-commit runs. With pairs, also compares GitHub squash merges against the sum of their branch commits. Spends the player's Claude usage: about count x runs model calls.",
    inputSchema: {
      type: 'object',
      properties: {
        count: { type: 'number', description: 'How many commits to score (default 20, max 60)' },
        runs: { type: 'number', description: 'Judge runs per commit (default 3, max 5)' },
        days: { type: 'number', description: 'Look back this many days (default 7)' },
        pairs: { type: 'boolean', description: 'Also compare squash merges with their branch commits (default true)' },
      },
    },
  }))
  await bootStep($, 'practice', async () => {
    const m = await read($, match)
    if (m && m.status === 'live' && m.kind === 'practice') startTicker($)
  })
  await bootStep($, 'outbox count', () => update($, link, l => ({ ...l, outbox: 0 })))
  // The switchboard: a fresh copy another session read is taken at once, else it's asked for.
  void refreshConfig($, 'boot').catch(err => $.ui.log(`CCSR config: ${(err as Error).message}`))
  void refreshAccount($)
    .then(() => flushOutbox($))
    .catch(err => $.ui.log(`CCSR account: ${(err as Error).message}`))
  // A session begins with what the machine's other sessions last read: the match or its result, the lanes, the account and boards.
  // Never awaited: boot goes on as it did, and nothing below waits on the store for it.
  void applyShare($)
    .then(() => adoptSeen($))
    .then(() => refreshStatus($))
    .catch(err => $.ui.log(`CCSR ranked: ${(err as Error).message}`))
  await bootStep($, 'ranked', async () => {
    const sh = await rankedShared($)
    if (sh.phase === 'queued' || sh.phase === 'offered' || sh.phase === 'live') startRankedPoll($)
  })
  scheduleScan($, 2500)
  // The seed on this install's first session, and a first look.
  lookAround($)
  await bootStep($, 'status', () => refreshStatus($))
  // W3b: a bucket config lists that GET /me had no standing for (switched on since) reads GET /me again, and a bucket on screen
  // that config moved gets its lanes. Never awaited: a config read waits on each tick, and $.http.fetch has no timeout, so a
  // request that never answers would hold every later config read.
  if (!bucketTicking) {
    bucketTicking = true
    onConfigTick(c => void standingsTick($, c).catch(err => $.ui.log(`CCSR standings: ${(err as Error).message}`)))
    onConfigTick(c => void lanesTick($, c).catch(err => $.ui.log(`CCSR lanes: ${(err as Error).message}`)))
  }
  // W5b: the new-install warning rides the config's cadence (GET /me at most every 10 minutes, only while sign-in is on).
  if (!identityTicking) {
    identityTicking = true
    // Not awaited: a config read never waits on GET /me.
    onConfigTick(() => {
      void refreshIdentity($, IDENTITY_TICK_MS).catch(() => null)
      void retryOrphans($).catch(() => null)
    })
  }
  // W6b: the challenge inbox follows config's `challenges` (and with it a sign-in, a sign-out and a server switch, which all read
  // config): started, and read at once, when challenges come on here; stopped, the box emptied, when they go off. A Challenges
  // press the server hasn't confirmed goes again after it. Never awaited.
  if (!challengesTicking) {
    challengesTicking = true
    onConfigTick(() => void challengesTick($)
      .then(() => tellChallenges($))
      .catch(err => $.ui.log(`CCSR challenges: ${(err as Error).message}`)))
  }
  // W7-2: eval capture follows the config held for this account and Model stats; every config read or adoption checks it again.
  // syncCapture asks the server nothing (the store, the call records, git for the repo key), so the tick may wait on it.
  if (!captureTicking) {
    captureTicking = true
    onConfigTick(() => syncCapture($))
  }
  // Usage weeks ride capture: after syncCapture on every config tick, and once at boot. Never awaited: the script may run for
  // minutes and the post is a request. usageTick never throws.
  if (!usageTicking) {
    usageTicking = true
    onConfigTick(() => void usageTick($))
  }
  void syncCapture($)
    .catch(err => $.ui.log(`CCSR eval: ${(err as Error).message}`))
    .then(() => usageTick($))
  // W4b: after every config read, the ledger kept small and the toast or flash a new notice may bring; on the config timer and at
  // boot, the stats post too (under a lease, at most one per 90 s from this store). Never awaited, as above: the post is a request.
  if (!noticeTicking) {
    noticeTicking = true
    onConfigTick((c, why) => void noticeConfigTick($, c, why).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`)))
  }
  void noticeEvent($, { on: 'session_start' }).catch(err => $.ui.log(`CCSR notices: ${(err as Error).message}`))
}

async function commandText($: $, args: string, signal?: AbortSignal): Promise<string> {
  const [sub = '', ...rest] = args.trim().split(/\s+/)
  const arg = rest.join(' ')
  const t = await $.clock.now()

  if (sub === '' || sub === 'open') {
    const r = await openPane($)
    return r.isPlaced ? 'CCSR pane opened.' : `CCSR pane is waiting: ${r.reason}`
  }
  if (sub === 'help') return helpText(await configOf($))
  if (sub === 'challenge') return challengeCommand($, arg)
  if (sub === 'last') {
    // This text reaches Claude: scores and handles only, never chat or an opponent's titles. The row draws as a scorecard.
    return (await recapText($)) ?? 'No result yet.'
  }
  if (sub === 'lab') {
    const r = await openPane($, 'lab')
    return r.isPlaced ? 'CCSR lab tools opened.' : `CCSR pane is waiting: ${r.reason}`
  }
  if (sub === 'status') {
    const s = await read($, settings)
    const rt = await read($, rating)
    const rec = await read($, record)
    const wk = totals(await read($, ledger), periodStart('week', t), await read($, weekTotals))
    const m = await read($, match)
    return `${s.handle} · ${tierOf(rt)} ${rt} practice (${rec.w}-${rec.l}${rec.d ? `-${rec.d}` : ''}) · Grind ${wk.points} pts, ${wk.commits} commits this week${m && m.status === 'live' ? ` · in a match: ${m.myPoints} vs ${liveOpp(m, t)} ${m.opp.handle}, ${clock(m.deadline - t)} left` : ''}`
  }
  if (sub === 'grind') {
    const list = await read($, ledger)
    const weeks = await read($, weekTotals)
    const w = totals(list, periodStart('week', t), weeks)
    const mo = totals(list, periodStart('month', t), weeks)
    const all = totals(list, 0, weeks)
    const last = [...list].sort((a, b) => b.authoredAt - a.authoredAt).slice(0, 5)
    return [
      `Grind: ${w.points} pts / ${w.commits} commits this week · ${mo.points} this month · ${all.points} all time`,
      ...last.map(c => `  +${c.points} ${c.category}${c.craft !== 'neutral' ? ` (${c.craft})` : ''} · ${c.repoName} · ${clean(c.title).slice(0, 70)}`),
    ].join('\n')
  }
  if (sub === 'scan') {
    const r = await runScan($, true)
    return `Scanned: ${r.added.length} new commit${r.added.length === 1 ? '' : 's'}${r.errors.length ? `; problems: ${r.errors.slice(0, 3).join('; ')}` : ''}`
  }
  if (sub === 'backtest') {
    // Titles stay in the pane: this text reaches Claude, and session titles are other projects' prompts.
    const days = Math.max(1, Math.min(30, Number(arg) || 7))
    const list = (await discoverSessions($, days)).slice(0, 20)
    const lines: string[] = []
    let sum = 0
    for (const s of list) {
      if (signal?.aborted) break
      const run = await backtestSession($, s, signal)
      sum += run.points
      lines.push(`  ${String(run.points).padStart(3)} pts  ${String(run.commits.length).padStart(2)} commits  ${s.project.padEnd(18).slice(0, 18)}  ${when(s.startAt)}  ${dur(s.endAt - s.startAt)}${run.status === 'partial' ? '  partial' : ''}`)
    }
    await update($, tab, () => 'backtest')
    return [`Backtest, last ${days} days (${lines.length} sessions, ${sum} points). Open /ccsr for titles and commits.`, ...lines].join('\n')
  }
  if (sub === 'match' || sub === 'queue') {
    const hours = /sprint|5m/.test(arg) ? 1 / 12 : Number((arg.match(/(\d+)\s*h/) ?? [])[1] ?? 1)
    if (![1 / 12, 1, 3].includes(hours)) return 'Lengths: 1h, 3h (and sprint, a 5 minute practice).'
    const m = await startMatch($, hours)
    return m ? `Practice match on: ${m.opp.handle}, bell in ${clock(m.deadline - m.startAt)}. Only commits count.` : 'A match is already live.'
  }
  if (sub === 'chat') return 'Chat lives in the CCSR pane only, so your opponent never reaches Claude. Open /ccsr.'
  if (sub === 'forfeit') {
    const m = await bell($, text => $.ui.toast(text), true)
    await refreshStatus($)
    return m ? `Forfeited. Rating ${m.ratingBefore} -> ${m.ratingAfter}.` : 'No live match.'
  }
  if (sub === 'tracking' || sub === 'share' || sub === 'band' || sub === 'quiet') {
    if (arg !== 'on' && arg !== 'off') return `/ccsr ${sub} on|off`
    const isOn = arg === 'on'
    if (sub === 'band') {
      await setSurface($, 'band', isOn ? 'after' : 'off')
      await setSurface($, 'bandMatch', isOn ? 'on' : 'off')
    } else if (sub === 'quiet') await setPreset($, isOn ? 'quiet' : 'full')
    else await saveSettings($, sub === 'tracking' ? { tracking: isOn } : { share: isOn })
    await refreshStatus($)
    return `${sub === 'tracking' ? 'Grind tracking' : sub === 'share' ? 'Commit titles' : sub === 'band' ? 'Band' : 'Quiet'} ${arg}.${sub === 'quiet' && isOn ? ' The band stays during a match; the match-found check always shows.' : ''}`
  }
  return helpText(await configOf($))
}

/**
 * `/ccsr challenge [code or link]` (W6b; the site's ccsr.gg/c/<code> page tells players to run
 * it): with a code, or its link, the pane opens on that challenge, looked up, with Accept; with
 * none, on the form. Its reply is a transcript row Claude reads, so it names no handle and never
 * carries a message, whatever the challenge says, and it only says the pane opened when it did:
 * queued, in a ready check or in a match the box isn't drawn, so it says the challenge waits; a
 * pane the engine keeps waiting answers as plain `/ccsr` does. While challenges are off nothing
 * is asked of the server.
 */
async function challengeCommand($: $, arg: string) {
  const cfg = await serverCfg($)
  const cf = await configOf($, cfg)
  if (!challengesOf(cf).on) return CHALLENGE.reply.off
  if (!cfg.token || (await read($, link)).unknownToken) {
    await openPane($, 'match')
    return CHALLENGE.reply.signIn
  }
  if ((await read($, settings)).surfaces.challenges === 'off') return CHALLENGE.reply.switchedOff
  const code = arg.trim() ? challengeCode(arg) : null
  if (arg.trim() && !code) return CHALLENGE.reply.notACode
  const sh = await rankedShared($)
  if (boxHidden(sh)) return CHALLENGE.reply.busy
  if (code) {
    if (sh.phase === 'done') await clearRanked($)
    // The lookup draws in the pane when it lands; the reply never waits on the server.
    void lookUpCode($, arg).catch(err => $.ui.log(`CCSR challenges: ${(err as Error).message}`))
  } else {
    if (cf.practiceOnly) return CHALLENGE.paused
    if (!(await fillChallengeForm($))) return CHALLENGE.sendPaused
  }
  const r = await openPane($, 'match')
  if (!r.isPlaced) return `CCSR pane is waiting: ${r.reason}`
  return code ? CHALLENGE.reply.opened : CHALLENGE.reply.form
}

async function calibrateTool($: $, input: Record<string, unknown>) {
  const count = Math.max(1, Math.min(60, Number(input.count) || 20))
  const runs = Math.max(1, Math.min(5, Number(input.runs) || 3))
  const days = Math.max(1, Math.min(30, Number(input.days) || 7))
  const pairs = input.pairs !== false
  const out = await calibrate($, count, runs, days, pairs)
  const text = JSON.stringify(out)
  // Kept on disk too, so a failed return never loses a paid run.
  try {
    const home = (await $.env.get('HOME')) ?? ''
    if (home) await $.fs.write(`${home}/.claude/ccsr-calibration-${await $.clock.now()}.json`, text)
  } catch {}
  return text
}

async function readyDialog($: $, e: RenderInput<'Pane'>) {
  const { Box, Text, Button } = $.ui.resolve(e)
  const r = await read($, rating)
  const close = () => void $.ui.close({ id: READY })
  return (
    <Box flexDirection="column" gap={1}>
      <Text bold color="#FF6A2A">Match found · 5 min sprint</Text>
      <Text>
        10xgary · {tierOf(r + 12)} {r + 12} · you have 60 seconds to accept
      </Text>
      <Box gap={1}>
        <Button
          key="ready-accept"
          label="Accept"
          variant="primary"
          autoFocus
          onPress={() => {
            close()
            void startMatch($, 1 / 12)
          }}
        />
        <Button key="ready-decline" label="Decline" role="dismiss" onPress={close} />
      </Box>
    </Box>
  )
}

// ------------------------------------------------------------------ transcript sites

/** `[main 8c41e2a] subject` from git commit's output: the sha the scan will score. */
function commitSha(stdout: string) {
  return /^\[[^\]\s]+(?: \([^)]*\))? ([0-9a-f]{7,40})\] /m.exec(stdout)?.[1] ?? null
}

async function inMatch($: $) {
  const sh = await rankedShared($)
  if (sh.phase === 'live') return true
  const m = await read($, match)
  return !!m && m.status === 'live'
}

/** Before Claude's git commit runs: under its permission prompt, "counts in your match". */
async function beforeCommit($: $, id: string) {
  if ((await read($, settings)).surfaces.marks !== 'on' || !(await inMatch($))) return
  try {
    $.ui.notice(id, MOD.notice)
  } catch {
    // No dialog open for this call: nothing to annotate.
  }
}

/** After it ran: the row shows "scoring" until the scan scores that sha. */
async function afterCommit($: $, id: string, stdout: string) {
  const sha = commitSha(stdout)
  if (!sha) return
  const where = (await inMatch($)) ? 'match' : 'grind'
  await update($, badges, all => ({ ...Object.fromEntries(Object.entries(all).slice(-60)), [id]: { sha, status: 'scoring' as const, where } }))
}

async function drawBadge($: $, e: RenderInput<'ToolUse'>, row: RenderElement): Promise<RenderElement> {
  const b = (await read($, badges))[e.requestId]
  if (!b) return row
  const { Box, Text, Svg } = $.ui.resolve(e) as El
  const where = b.status === 'scoring' ? 'scoring' : b.where
  const craft = b.craft === 'clean' ? ' · ▲ clean +1' : b.craft === 'sloppy' ? ' · ▼ sloppy -1' : ''
  if (e.surface === 'terminal')
    return (
      <Box flexDirection="column">
        {row}
        <Text color={ORANGE}>{b.status === 'scoring' ? '  ◆ CCSR scoring' : `  ◆ CCSR +${b.points ?? 0} ${b.category ?? ''}${craft} · ${where}`}</Text>
      </Box>
    )
  return (
    <Box flexDirection="column">
      {row}
      <Box key={`badge-${e.requestId}`} flexDirection="column">
        <Svg source={commitBadge({ points: b.points ?? 0, category: b.category ?? '', craft: b.craft ?? 'neutral', where })} alt={b.status === 'scoring' ? 'CCSR scoring' : `CCSR +${b.points ?? 0} ${b.category ?? ''}, ${where}.`} />
        {b.reason && (
          <Box display="none" hover={{ display: 'flex' }} flexDirection="column" paddingX={1}>
            <Text dimColor>{b.reason}</Text>
            {b.craft && b.craft !== 'neutral' && (
              <Text dimColor>
                Judged {b.base}, {b.craft} moves it to {b.points}.
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}

/** Minutes and seconds left when the bell is near: within the match's last minutes in ranked (warnMs), 10 minutes in practice; null otherwise. */
async function bellLeft($: $): Promise<number | null> {
  const t = await $.clock.now()
  const sh = await rankedShared($)
  const sm = (await read($, link)).ranked?.summary
  if (sh.phase === 'live' && sm?.status === 'live' && sm.deadline) {
    const left = Date.parse(sm.deadline) - t
    return left > 0 && left <= warnMs(sm) ? left : null
  }
  const m = await read($, match)
  if (m && m.status === 'live') {
    const left = m.deadline - t
    return left > 0 && left <= WARN_MS ? left : null
  }
  return null
}

async function spinnerFor($: $, e: RenderInput<'Spinner'>) {
  if ((await read($, settings)).surfaces.spinner !== 'on') return null
  await read($, now)
  const left = await bellLeft($)
  return left === null ? null : { ...e, props: { ...e.props, message: MOD.spin(mmss(left)), suffix: '' } }
}

async function hintFor($: $, e: RenderInput<'PromptHint'>) {
  if ((await read($, settings)).surfaces.hint !== 'auto') return null
  const l = await read($, link)
  if ((await rankedShared($)).phase !== 'live' || (l.me?.matches_played ?? 0) >= 3) return null
  if (e.surface === 'terminal') return { ...e, props: { ...e.props, tail: MOD.hint } }
  if (e.props.isWorking || e.props.isDraft) return null
  return { ...e, props: { ...e.props, hint: e.props.hint ? `${e.props.hint} · ${MOD.hint}` : MOD.hint } }
}

async function modeFor($: $, e: RenderInput<'SessionMode'>) {
  if ((await read($, settings)).surfaces.mode !== 'on') return null
  const sh = await rankedShared($)
  const l = await read($, link)
  const left = await bellLeft($)
  const label =
    sh.phase === 'queued' ? 'CCSR queued'
    : sh.phase === 'offered' ? 'CCSR found'
    : sh.phase === 'live' ? (l.ranked?.summary?.status === 'grace' ? 'CCSR bell' : l.online === false ? 'CCSR offline' : left !== null ? `CCSR ${mmss(left)}` : 'CCSR live')
    : (await inMatch($)) ? (left !== null ? `CCSR ${mmss(left)}` : 'CCSR practice')
    : null
  return label ? { ...e, props: { ...e.props, modes: [...e.props.modes, label] } } : null
}

/** `/ccsr last` draws as a scorecard in the transcript; its text (what Claude reads) is scores and handles only. */
async function drawScorecard($: $, e: RenderInput<'CommandOutput'>): Promise<RenderElement | null> {
  const l = await read($, link)
  const me = (await serverCfg($)).handle ?? ''
  const sm = l.ranked?.summary
  if (!sm || (sm.status !== 'finished' && sm.status !== 'void')) return null
  const { mine, them } = rankedSides(sm, me)
  const delta = (mine.rating_after ?? mine.rating_before) - mine.rating_before
  const outcome = rankedOutcome(sm, me)
  const { Box, Text, Svg } = $.ui.resolve(e) as El
  const word = outcome === 'won' ? 'victory' : outcome === 'lost' ? 'loss' : 'draw'
  if (e.surface === 'terminal')
    return (
      <Box flexDirection="column">
        <Text bold color={ORANGE}>
          {sm.kind === 'challenge' ? CHALLENGE.scoreTitle(lengthLabel(sm.length_min), word) : `CCSR · ranked ${lengthLabel(sm.length_min)} · ${word}`}
        </Text>
        <Text>
          {mine.player.handle} {mine.points} : {them.points} {them.player.handle} · {mine.commits} commits to {them.commits}
        </Text>
        <Text>{rankedResultLine(sm, me)}</Text>
      </Box>
    )
  return (
    <Svg
      source={scorecard({ outcome, hours: sm.length_min / 60, me: mine.player.handle, them: them.player.handle, mine: mine.points, theirs: them.points, commits: { mine: mine.commits, theirs: them.commits }, delta, ratingBefore: mine.rating_before, ratingAfter: mine.rating_after ?? mine.rating_before, placing: placingOfSide(mine), mode: modeWord(sm), ...unratedOf(sm) })}
      alt={rankedResultLine(sm, me)}
    />
  )
}

async function onTurnDone($: $, durationMs: number) {
  if (turnPoints <= 0) return
  const pts = turnPoints
  turnPoints = 0
  await update($, turnMarks, all => ({ ...Object.fromEntries(Object.entries(all).slice(-40)), [String(durationMs)]: pts }))
}

async function turnLine($: $, e: RenderInput<'TurnDuration'>): Promise<RenderElement | null> {
  if ((await read($, settings)).surfaces.extras !== 'on') return null
  const pts = (await read($, turnMarks))[String(e.props.durationMs)]
  if (!pts) return null
  const { Box, Text } = $.ui.resolve(e)
  const sec = Math.max(1, Math.round(e.props.durationMs / 1000))
  return (
    <Box gap={1}>
      <Text dimColor>
        {e.props.word} for {sec < 60 ? `${sec}s` : `${Math.floor(sec / 60)}m ${sec % 60}s`}
      </Text>
      <Text color={ORANGE}>· CCSR +{pts}</Text>
    </Box>
  )
}

/**
 * The band: renderBand reads every switch (the ready check ignores them); a survey always wins the
 * slot. W4b: a band notice (notices.ts: Band when idle between matches, Band in matches from the
 * queue to the result, never over the ready check) stacks above whatever the band draws.
 */
async function bandOrPass($: $, e: RenderInput<'AbovePrompt'>) {
  if (e.props.hasSurvey) return null
  const a = actions($)
  const band = await renderBand($, e, a)
  const notice = await bandNotice($, e, a)
  if (!notice) return band
  if (!band) return notice
  const { Box } = $.ui.resolve(e) as El
  return (
    <Box flexDirection="column">
      {notice}
      {band}
    </Box>
  )
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const started = await next(e)
    // W4b: where this session draws, for a notice's surfaces before the pane has drawn anywhere.
    sessionSurface = e.surface ?? null
    await boot($, e.cwd)
    return started
  })

  on('prompt.submit', ($, e, next) => {
    turnPoints = 0
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    if (!e.agentId) await onTurnDone($, e.durationMs)
    const repo = await $.session.repo()
    if (repo) {
      const root = await repoRoot($, repo.root)
      if (root) await addRepo($, root)
    }
    scheduleScan($)
    return done
  })

  on('tool.call', { tool: 'Bash' }, async ($, e, next) => {
    const isCommit = isCommitCommand(String(e.command))
    // Where the shell is before the command runs, for followCommit below.
    const cwdBefore = isCommit ? await $.session.cwd().catch(() => null) : null
    if (isCommit) await beforeCommit($, e.tool_use_id)
    const ran = await next(e)
    if (isCommit) {
      if (ran.result) await afterCommit($, e.tool_use_id, String((ran.result as { stdout?: string }).stdout ?? ''))
      scheduleScan($, 800)
      // The commit may have landed in another repo (`cd ../api && git commit`, `git -C`): it joins the list and is scanned too.
      // Never awaited: the Bash call's answer doesn't wait on git.
      void followCommit($, String(e.command), cwdBefore)
        .then(joined => {
          if (joined > 0) scheduleScan($, 800)
        })
        .catch(err => $.ui.log(`CCSR repos: ${clean(String((err as Error | undefined)?.message ?? err))}`, { to: 'debug' }))
    }
    return ran
  })

  on('tool.call', { tool: 'mcp__ccsr__calibrate' }, async ($, e) => {
    const text = await calibrateTool($, e as unknown as Record<string, unknown>)
    // A plugin tool's result is a string or an array of content blocks, never an object.
    return { result: text }
  })

  on('command.run', { command: 'ccsr' }, async ($, e, next) => ({ text: await commandText($, e.args, next.signal) }))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => renderPane($, e, actions($)))

  on('ui.render', { component: 'Pane', requestId: READY }, async ($, e) => readyDialog($, e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const tree = await bandOrPass($, e)
    return tree ?? next(e)
  })

  on('ui.render', { component: 'ToolUse' }, async ($, e, next) => {
    if (e.props.tool !== 'Bash' || (await read($, settings)).surfaces.marks !== 'on' || !(await read($, badges))[e.requestId]) return next(e)
    return drawBadge($, e, await next(e))
  })

  on('ui.render', { component: 'CommandOutput', props: { command: 'ccsr' } }, async ($, e, next) => {
    if (e.props.args.trim() !== 'last') return next(e)
    return (await drawScorecard($, e)) ?? next(e)
  })

  on('ui.render', { component: 'Spinner' }, async ($, e, next) => next((await spinnerFor($, e)) ?? e))

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => next((await hintFor($, e)) ?? e))

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => next((await modeFor($, e)) ?? e))

  on('ui.render', { component: 'TurnDuration' }, async ($, e, next) => (await turnLine($, e)) ?? next(e))

  // W7-2: eval capture's observers. Each passes what it gets through untouched. turn.step makes
  // no `$` call and awaits nothing but next: it notes the call in module memory, and the writes
  // happen on PostToolUse, the scans, slowSync and session.end.
  on('turn.step', async function* ($, e, next) {
    const r = yield* next(e)
    if (capturing) noteStep(e, r)
    return r
  })

  on('classic.PostToolUse', async ($, e, next) => {
    // Noted before the settings hooks run (no `$` call), so a scan right after finds it; written after.
    const noted = capturing && e.tool_name === 'Bash' && noteBash(e)
    const out = await next(e)
    if (noted) await writeCalls($)
    return out
  })

  on('session.end', async ($, e, next) => {
    // The whole chain shares one short bound: the write gets what's left of it, less a margin.
    if (capturing) await Promise.race([writeCalls($), $.clock.sleep(Math.max(0, Math.min(1000, next.budget.remainingMs - 300)))])
    // One poller per machine: a session that ends hands the lease on, so the next session to tick polls at once.
    await Promise.race([dropLead($).catch(() => null), $.clock.sleep(Math.max(0, Math.min(300, next.budget.remainingMs - 200)))])
    return next(e)
  })
}
