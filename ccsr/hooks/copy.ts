// Every user-facing line the mod draws that isn't data, all approved in
// docs/copy.md (change a line there first, then here). Pure: no `$` here, so
// register.tsx can import it.

import type { Surfaces } from '../types'
import { PROVIDERS } from './actions'
import { captureOn } from './coder'
import { signupsOf } from './config'
import type { ModConfig } from './config'
import { signinMode } from './identity'
import { challengeCfg } from './challenges'
// W4b: the Notices setting for stored switches (notices.ts reads QUIET from here; both are used only inside functions).
import { noticeSettingFrom } from './notices'
import { backfillOn } from './transcripts'
import { usageOn } from './usage'
// W10e: custom finishers' privacy line follows config's `finishers.custom.create`.
import { customOf } from './finishers-custom'

/** Approved in docs/copy.md. */
export const LINES = {
  handle: "Pick a handle. It'll be on a lot of Ls.",
  privacy: 'Your code never leaves your machine. Only the points do. And the trash talk.',
  lengths: '1h for a quick L. 3h for a long one.',
  queue: ["Matching you with someone who also thinks it's the model.", "Searching for someone at your Elo. It's crowded down here.", 'Matched in seconds. Humbled in hours.'],
  found: 'Opponent found. They also have Claude. That was your only advantage.',
  behind: (n: number) => `You're down ${n}. Have you tried being up ${n}.`,
  forfeit: 'Forfeit now and they win on attendance.',
  chatPlaceholder: ["Your Claude can't see this chat. Cry freely.", 'Type your excuse here. Your opponent will read it.'],
  chatExplainer: "Talk trash with your opponent. Your Claude can't see the chat, so no, you can't prompt-inject them into losing.",
  zero: 'Scored 0. Claude read the diff and decided not to talk about it.',
  one: '1 point. Claude was being nice.',
  noHistory: 'No matches yet. Undefeated through cowardice.',
  multibox: 'Multiboxing is legal. The sweats already knew.',
  farDown: (rank: number) => `Rank ${rank}. Somebody has to hold the ladder up.`,
  numberOne: '#1 Claude Code ranked player (world)',
  onX: (handle: string) => `@${handle} on X`,
  reportBug: 'Tag or DM',
  win: (d: number) => `Victory. +${d}. Co-Authored-By: Claude.`,
  loss: ['Great CLAUDE.md though.', 'Same Claude. Different idiot.', "It wasn't the model.", 'Gorgeous plan mode output though.', 'Your Claude is asking for a transfer.'],
  draw: 'Draw. No diff.',
  youForfeited: (d: number) => `Forfeit. ${d}. [Request interrupted by user]`,
  theyForfeited: (d: number) => `Opponent forfeited. +${d}. Won on attendance.`,
  void: 'Void. Nothing to commit, working tree clean.',
}

/** The results table (copy.md): `{Result}. {delta}. {line}`, a loss picking its line by `seed`. */
export function resultText(outcome: 'won' | 'lost' | 'draw' | 'void', how: 'points' | 'forfeit', delta: number, seed: number) {
  if (outcome === 'void') return LINES.void
  if (outcome === 'draw') return LINES.draw
  if (how === 'forfeit') return outcome === 'won' ? LINES.theyForfeited(Math.abs(delta)) : LINES.youForfeited(delta)
  if (outcome === 'won') return LINES.win(Math.abs(delta))
  return `Loss. ${delta}. ${LINES.loss[Math.abs(seed) % LINES.loss.length]}`
}

/** The #1 card's roast pool, approved. {handle} is the #1 player. */
export const ROASTS = [
  'Took a 21 point shit on main this morning',
  "Your whole career is one of {handle}'s background sessions",
  "Do not talk to {handle}. They're at 94% context",
  'Ripping the Esc key out with their teeth so they can never interrupt Claude again',
  'Saying "You\'re absolutely right" back to Claude out loud like a hostage',
  'Nobody knows what {handle} is building. Could be a todo app. Could be God',
  'Their Claude calls them boss. Yours calls you the user.',
  'Approving permission prompts with their forehead because both hands are on other keyboards',
  'Got a 21 on one commit and had to lie face down on the kitchen floor',
  'Could beat you with one session on a library computer. Has offered.',
  "If you're reading this, you're not #1. Sorry you had to find out from a website.",
  'I plan on letting the Elo change me',
  'Become unqueueable',
  'Pissed on the top of the ladder so nobody else can have it',
  'How is {handle} shipping that much. How many terminals is that. Is that a thing. What',
  'Their git log scrolls for one thousand years. Yours says wip, wip2, fix wip',
  'Gets rate limited the way you get tired.',
  'Has never seen "nothing to commit, working tree clean" in their life.',
  "So my mum found out I'm not the #1 Claude Code player. She asked why. Good fucking question mum.",
  'The leaderboard is sorted by skill issue, ascending.',
  'Feeding 9 Claude sessions like a guy feeding pigeons at the park',
  'Force pushes to main and main says thank you',
  'Make eye contact with {handle} and your Claude starts apologizing',
  'Just some freak with nine terminals and no witnesses',
  'Loss is a word {handle} learned from you',
  'Opened another session while you were reading this.',
  'Their merge conflicts resolve out of fear.',
  'Their CLAUDE.md is 4,000 lines and 600 of them are threats.',
  "Doesn't sleep. Just runs /compact.",
  "Has a tattoo of a 21. Doesn't remember the commit.",
  'Commits like the repo owes them money',
  'Their Claude has a 401k now.',
  'Microwaving fish at the desk to intimidate an opponent in another country',
]

/** The mod's own lines (docs/copy.md, "The mod", approved 2026-10-08). */
export const MOD = {
  warn10: '10 minutes to the bell. Only commits score.',
  warn1: '1 minute to the bell. Only commits score.',
  uncommitted: (n: number, repo: string) => `${n} file${n === 1 ? '' : 's'} uncommitted in ${repo}. Only commits score.`,
  spin: (clock: string) => `Ship before the bell · ${clock}`,
  fill: "Commit what's working now.",
  hint: 'Only commits score.',
  lead: (who: string, a: number, b: number) => `${who} took the lead, ${a}-${b}.`,
  offline: "Can't reach ccsr.gg. Scores wait here and send when it's back.",
  notice: 'Counts in your match.',
  /** After the bell, until the result: your Claude may still be scoring a commit made before it. With no clock from the server. */
  counting: 'Bell. Still scoring commits made before it.',
  /** The same, with the time until the result (the match's grace: 1 minute at 15m, 2 at 30m, 3 at 1h and 3h). */
  countingIn: (left: string) => `Bell. Still scoring commits made before it. Result in ${left}.`,
  /** The grace is over and the result hasn't been read yet (a few seconds). */
  deciding: 'Bell. Working out the result.',
  /** Under it, in the pane. */
  countingRule: "Commits made after the bell don't count in this match.",
  // Settings, Resync (2026-10-12): the way out of a state the mod doesn't leave by itself.
  resyncTitle: 'Stuck or out of date?',
  resyncLead: 'Resync reads your account, queue and match from the server again.',
  resync: 'Resync',
  resynced: 'Resynced with the server.',
  notRanked: 'Not ranked until placed.',
  locked: 'Rooms above your tier are locked.',
  practice: 'Practice against a bot. Your commits score for real; the rating is practice only.',
  // Updates (docs/copy.md, "The mod", approved 2026-10-08).
  updateOut: (latest: string) => `CCSR ${latest} is out. Update between matches.`,
  updateNeeded: (min: string, version: string) => `Ranked needs CCSR ${min}. You're on CCSR ${version}.`,
  updated: 'Updated. Restart Claude Code to load it.',
  updating: 'Updating CCSR.',
  updateCopied: 'Copied the update command. Run it in a terminal, then restart Claude Code.',
  version: (v: string) => `CCSR ${v}`,
  autoUpdate: "Turn on auto-update for ccsr in /plugin and you'll never see the Update button.",
  // The switchboard (docs/copy.md, "W1: the switchboard"): Settings > Version names the Claude Code floor.
  claudeFloor: (terminal: string, desktop: string, version: string | null) =>
    version ? `CCSR needs Claude Code ${terminal} or later (${desktop} in the desktop app). You're on Claude Code ${version}.` : `CCSR needs Claude Code ${terminal} or later (${desktop} in the desktop app).`,
  // Kill switches: ranked paused (practice only) and chat paused.
  rankedPaused: 'Ranked is paused for now. Practice is still open.',
  // The line (docs/copy.md, "W11: the line", the mod's lines): in Queue's place while this account waits its turn.
  inLine: (ahead: number) => (ahead > 0 ? `You're in line. About ${ahead} ahead of you.` : "You're next in line."),
  inLineMore: "Your handle is yours. Ranked opens here when it's your turn. Practice and the Grind are open now.",
  // The join card: the server takes no handle without a GitHub sign-in, and new accounts wait.
  githubFirst: 'Sign in with GitHub to claim a handle.',
  lineOpen: "CCSR is full right now. Claim your handle and you're in line.",
  chatPaused: 'Chat is paused for now.',
  roomPaused: (room: string) => `${room} is paused for now.`,
  // Why you left the queue (QueueState.cancelled.reason): the known ones, and one line for any other.
  youExpired: "You didn't accept. Out of the queue.",
  theyDeclined: 'They declined. Back in the queue.',
  theyExpired: "They didn't accept. Back in the queue.",
  pausedOut: "Ranked is paused for now. You're out of the queue.",
  outOfQueue: "Out of the queue. Queue again when you're ready.",
  // Lengths from the server (docs/copy.md, "W2: lengths in minutes and weighted Elo", the mod's lines).
  lengthOff: "Every length you queued for is off for now. You're out of the queue.",
  noLengths: 'No lengths are offered right now. Queue again in a bit.',
  /** Queue with a pick none of which is offered now (a 0.3.0 3h only, or a length switched off since). */
  pickOff: 'None of your lengths is offered right now. Tick one under the queue bar.',
  /** Queue with every length unticked. */
  tickOne: 'Tick a length to queue.',
  /** A Queue, Leave or Decline press, or the lanes read a Queue waits for, that didn't reach the server, or one it refused with no message of its own. */
  noServer: "Can't reach the server.",
  answered: (status: number) => `The server answered ${status}.`,
  /** The warning before the bell, at the match's last minutes: 10 at 1h, 5 at 30m, 3 at 15m; one minute has its own line. */
  warnAt: (min: number) => (min === 1 ? '1 minute to the bell. Only commits score.' : `${min} minutes to the bell. Only commits score.`),
}

/**
 * The length picker's line, from the shortest and longest lengths offered, so the
 * frozen mod never names a length that isn't: "15m for a quick L. 1h for a long one."
 * With one length offered its own line; with none, no line ('').
 */
export function pickerLine(labels: readonly string[]) {
  const short = labels[0]
  const long = labels[labels.length - 1]
  if (!short || !long) return ''
  if (labels.length === 1) return `${short} only for now. Still plenty of time to lose.`
  return `${short} for a quick L. ${long} for a long one.`
}

/**
 * The mod's own lines for buckets (docs/copy.md, "W3: buckets", W3b). A bucket's label and
 * blurb and each checklist row's label are the server's, drawn as Text, never Markdown; these
 * are the words around them. With one bucket none of them shows.
 */
export const BUCKET = {
  /** Over the checklist, in Queue's place, while the bucket on screen can't be queued yet (`can_queue` false). */
  checklist: (bucket: string) => `To queue in ${bucket}:`,
  /** A checklist row the server says you meet, then one you don't yet. */
  met: (label: string) => `✓ ${label}`,
  unmet: (label: string) => `○ ${label}`,
  /** The install step's link to GitHub, when the server's action carries no label of its own. */
  install: 'Install on GitHub',
  /** The Grind tab with another bucket picked: who that board counts. */
  grindOnly: (bucket: string) => `Players who meet ${bucket}'s requirements, ranked among themselves.`,
  /** Another bucket's board on the Ranked tab, before its first read lands. */
  loading: 'Checking with the server.',
}

/**
 * The toast for a `cancelled.reason` from `GET /queue`. A reason this mod
 * doesn't know (the server adds them: bucket_closed, verification_required)
 * gets the neutral line, never "They didn't accept". `length_off` (W2: every
 * length you queued for was switched off) has its own.
 * `update_required` has its own line with the versions (MOD.updateNeeded).
 */
export function cancelledLine(reason: string) {
  if (reason === 'you_expired') return MOD.youExpired
  if (reason === 'opponent_declined') return MOD.theyDeclined
  if (reason === 'opponent_expired') return MOD.theyExpired
  if (reason === 'ranked_paused') return MOD.pausedOut
  if (reason === 'length_off') return MOD.lengthOff
  return MOD.outOfQueue
}

/** What leaves your machine, under Settings: the privacy line, then what a scored commit sends. */
const SENDS =
  'Each scored commit sends its points, category, size and author time, with salted hashes standing in for the repo and the commit. Its title goes only if you share titles. Each judge call runs on your own Claude plan, one call per new commit.'

/**
 * The Settings privacy block, line by line. Later items append their own
 * lines here, each gated on its config section, so the block says what this
 * player's mod actually sends (eval capture's coder block, GitHub sign-in).
 */
export function privacyLines(cfg: ModConfig, rubric: string): string[] {
  const lines = [LINES.privacy, `${SENDS} Rubric ${rubric}.`]
  // W5b: sign-in, while config turns a provider on for this player.
  // W11: with signups.email on, the line says a new handle's email is kept too.
  const email = signupsOf(cfg.raw).email
  for (const p of PROVIDERS) if (signinMode(cfg.raw, p) !== 'off') lines.push((email ? IDENTITY.sendsEmail : IDENTITY.sends)(PROVIDER_NAMES[p] ?? p))
  // W6b: challenges, while config turns them on for this player.
  if (challengeCfg(cfg.raw.challenges).on) lines.push(CHALLENGE.sends)
  // W7-2: while eval capture is on for this player, what Model stats adds, in its own words.
  if (captureOn(cfg.raw)) lines.push(EVAL.privacy)
  // W7-3: while the transcript fallback is on too, that the mod looks in Claude Code's logs here, and what it keeps from them.
  if (captureOn(cfg.raw) && backfillOn(cfg.raw)) lines.push(EVAL.logs)
  // Usage weeks: while eval_weeks is on too, that the mod adds up Claude Code's logs here by week, what it sends of them, and that Off erases them.
  if (captureOn(cfg.raw) && usageOn(cfg.raw)) lines.push(EVAL.usage)
  // W4b: a server with notices (W4a) gets their counts back: ids and counts, never their words.
  if (Array.isArray(cfg.raw.notices)) lines.push(NOTICE.privacy)
  // W10e: while making finishers is on for this player, what a submitted finisher sends.
  if (customOf(cfg.raw).create) lines.push(CUSTOM.privacy)
  return lines
}

// ------------------------------------------------------------------ challenges (W6b)

/** "22h left": a challenge's time to take it, in days, hours or minutes (the site's facts use the same words). */
function leftWords(ms: number) {
  const m = Math.max(1, Math.floor(ms / 60_000))
  if (m >= 1440) return `${Math.floor(m / 1440)}d`
  if (m >= 60) return `${Math.floor(m / 60)}h`
  return `${m}m`
}

/**
 * The challenge lines (docs/copy.md, "W6: challenges", the mod's table). Handles, lengths and
 * bucket labels are filled in; a challenge's message is the player's own text, drawn as Text
 * beside these and never inside one. None of these reach a command reply except `reply`'s,
 * which name no handle and carry no message.
 */
export const CHALLENGE = {
  // The Match tab's box.
  title: 'Challenges',
  explainer: 'A match on your own projects, unrated. Bragging rights only.',
  incoming: (handle: string, len: string) => `${handle} challenged you to a ${len} match.`,
  incomingIn: (handle: string, len: string, bucket: string) => `${handle} challenged you to a ${len} match in ${bucket}.`,
  left: (ms: number) => `${leftWords(ms)} left`,
  accept: 'Accept',
  decline: 'Decline',
  mute: 'Mute',
  muteAsk: (handle: string) => `Press Mute again to mute ${handle}. Their challenges and chat stop showing for you.`,
  muted: (handle: string) => `Muted ${handle}.`,
  report: 'Report',
  reportAsk: (handle: string) => `Report ${handle}'s challenge as:`,
  reasons: { spam: 'Spam', abuse: 'Abuse', other: 'Other' } as Record<'spam' | 'abuse' | 'other', string>,
  reported: 'Reported.',
  cancel: 'Cancel',
  // Yours, by how they stand.
  waiting: (handle: string, len: string) => `To ${handle}, ${len}. Waiting.`,
  open: (len: string, code: string) => `Open, ${len}: code ${code}. Anyone with the link can take it.`,
  taken: (handle: string, len: string) => `${handle} took your ${len} challenge.`,
  played: (handle: string, len: string) => `Your ${len} challenge with ${handle} was played.`,
  declined: (handle: string, len: string) => `${handle} declined your ${len} challenge.`,
  withdrawn: (len: string) => `Your ${len} challenge was withdrawn.`,
  expired: (len: string) => `Your ${len} challenge expired.`,
  withdraw: 'Withdraw',
  copyLink: 'Copy link',
  copied: 'Copied the link.',
  more: (n: number) => `And ${n} more.`,
  // Sending one.
  challengeHandle: 'Challenge a handle',
  openOne: 'Open challenge',
  formHandle: (handle: string) => `Challenge ${handle}`,
  formHandleless: 'Challenge a handle',
  formOpen: 'Open challenge: anyone with the link can take it.',
  handleLabel: 'Handle',
  handlePlaceholder: "Who you're challenging",
  messageLabel: 'Message',
  messagePlaceholder: (n: number) => `Optional, up to ${n} characters`,
  send: 'Send',
  sent: (handle: string) => `Challenge sent to ${handle}.`,
  openSent: 'Open challenge made. Copy its link and post it anywhere.',
  pickHandle: 'Type a handle to challenge.',
  noLength: 'No lengths are offered for challenges right now.',
  messageOff: "Challenges can't carry a message right now. Send it without one.",
  messageLong: (n: number) => `Keep the message to ${n} characters.`,
  noHandleHere: 'Challenge a handle from the terminal or the desktop app. This screen can only make an open one.',
  /** The server's own lines (W6a), drawn in the form's place when sending or ranked is paused for this player. */
  sendPaused: 'Sending challenges is paused for now.',
  paused: 'Ranked is paused for now, and challenges with it. Try again in a bit.',
  // A code or link typed in.
  codeLabel: 'Code',
  codePlaceholder: 'Have a code or link? Paste it here.',
  lookUp: 'Look up',
  notACode: "That isn't a challenge code or link.",
  checking: 'Checking with the server.',
  codeTo: (from: string, to: string, len: string) => `${from} challenged ${to} to a ${len} match.`,
  codeOpen: (from: string, len: string) => `${from} challenged anyone with the link to a ${len} match.`,
  ownCode: "That's your own challenge.",
  forSomeoneElse: 'That challenge is for someone else.',
  closed: 'That challenge is closed.',
  close: 'Close',
  // The ready check, the match and the result.
  readyTaken: (handle: string) => `${handle} took your challenge. Accept to start the match.`,
  readyText: (handle: string, tier: string, len: string, secs: number) => `Challenge: ${handle} (${tier}) · ${len} · ${secs}s to accept · unrated`,
  bandOffer: (handle: string, tier: string, record: string) => `${handle} · ${tier} · ${record} · unrated`,
  on: (handle: string, len: string) => `The ${len} challenge with ${handle} is on. Only commits score.`,
  noMatch: 'The ready check ended without a match.',
  liveText: (len: string) => `Challenge ${len}`,
  rematch: 'Rematch',
  recap: (len: string, me: string, mine: number, them: string, theirs: number) => `CCSR ${len} challenge: ${me} ${mine}, ${them} ${theirs}. Unrated.`,
  scoreTitle: (len: string, outcome: string) => `CCSR · challenge ${len} · ${outcome}`,
  unrated: 'unrated',
  // The band.
  bandTitle: 'CHALLENGE',
  bandIncoming: (handle: string, len: string) => `${handle} challenged you · ${len} · unrated`,
  // Toasts.
  toastIncoming: (handle: string, len: string) => `${handle} challenged you to a ${len} match. Unrated.`,
  // The status line.
  statusAccept: (left: string) => `◆ CCSR  challenge · accept in ${left}`,
  statusWaiting: (handle: string) => `◆ CCSR  challenge · waiting for ${handle}`,
  statusShortWaiting: (left: string) => `◆ waiting ${left}`,
  // Settings, What leaves your machine (privacyLines), while challenges are on.
  sends: 'A challenge sends the handle you challenge, its length and any message you add. Messages show in the pane only and never reach Claude.',
  // Settings: the switch went off, and one of yours couldn't be withdrawn yet (the press's reply, a toast).
  withdrawLeft: "Couldn't withdraw all of your challenges yet. CCSR tries again in a few minutes.",
  // `/ccsr challenge`: what Claude reads, so no handle and no message, ever.
  help: '/ccsr challenge <code>   take a challenge from its code or link',
  reply: {
    off: "Challenges aren't open yet.",
    switchedOff: 'Challenges are off in Settings. Turn them on to take one.',
    signIn: 'Pick a handle in the CCSR pane first, then run this again.',
    form: 'Opened the challenge form in the CCSR pane.',
    notACode: "That isn't a challenge code or link.",
    opened: 'Opened the challenge in the CCSR pane. Accept it there to play.',
    // Queued, in a ready check or in a match: the challenge box isn't drawn until it's done.
    busy: 'Challenges show between matches. Run this again once your match or queue is done.',
  },
}

/**
 * A challenge's result in one line (docs/copy.md, W6c's own lines and the mod's): the results
 * table with "Unrated" where the Elo change goes, never "+0". A loss picks its line by `seed`.
 */
export function challengeResultText(outcome: 'won' | 'lost' | 'draw' | 'void', how: 'points' | 'forfeit', seed: number) {
  if (outcome === 'void') return LINES.void
  if (outcome === 'draw') return LINES.draw
  if (how === 'forfeit') return outcome === 'won' ? 'Opponent forfeited. Unrated. Won on attendance.' : 'Forfeit. Unrated. [Request interrupted by user]'
  if (outcome === 'won') return 'Victory. Unrated. Co-Authored-By: Claude.'
  return `Loss. Unrated. ${LINES.loss[Math.abs(seed) % LINES.loss.length]}`
}

// ------------------------------------------------------------------ eval capture (W7-2)

/** Model stats in Settings and its privacy line (docs/copy.md, "W7: eval capture"). Shown only while config's eval_capture is on. */
export const EVAL = {
  label: 'Model stats',
  on: 'On',
  off: 'Off',
  what: 'Which model, effort and client made each scored commit, and its token counts. Off stops sending it and erases it from the live database; backup copies age out on their own.',
  privacy:
    'With Model stats on, each scored commit also sends the coding model, the effort, main session or subagent, the client and its version, and four token counts. Never a session id, a path, a command or a repo name.',
  /** W7-3: the transcript fallback, while config's eval_backfill is on too (dark, QA only). */
  logs: "With Model stats on, a scored commit with no call record takes its model from Claude Code's logs on this machine. From them the mod keeps only ids, times, the model, main session or subagent, the client and its version, and token counts. Never a prompt, a reply or code.",
  /** Usage weeks, while config's eval_weeks is on too: Settings' What leaves your machine. It says what Off does, since Model stats off is the only way to erase them. */
  usage:
    "With Model stats on, the mod also adds up your Claude Code use by week, from four weeks before you joined, and sends only the totals, after your first finished match: the days it could read, the days you used it, and four token counts. It reads Claude Code's logs on this machine for them. Never a prompt, a reply, code, a model or a repo. Model stats off stops it and erases the totals from the live database.",
  /** Usage weeks on the setup pane, under the privacy line, before a handle is picked: what will go, when, and where the off switch is. */
  usageSetup:
    'With Model stats on, the mod also sends weekly totals of your Claude Code use, from four weeks before you join: days and token counts, never code. The first go after your first finished match. Model stats in Settings turns it off.',
}

// ------------------------------------------------------------------ notices

/**
 * The words the mod adds when it draws a server notice (docs/copy.md, "W4: notices"):
 * `{countdown:<time>}`, `{local:<time>}`, a toast and a cut status flash. The notice's own
 * text is the server's, logged where W4a keeps it. notices.ts holds the widths these fit
 * (FILL_WIDTH: 11 for a countdown, 9 for a local time).
 */
export const NOTICE = {
  now: 'now',
  underMin: '<1 min',
  min: (m: number) => `${m} min`,
  hMin: (h: number, m: number) => `${h} h ${m} min`,
  h: (h: number) => `${h} h`,
  days: (d: number) => `${d} days`,
  weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as readonly string[],
  local: (weekday: string, hh: string, mm: string) => `${weekday} ${hh}:${mm}`,
  toast: (title: string, body: string) => `${title} · ${body}`,
  cut: (start: string) => `${start}…`,
  // W4b: the buttons the mod adds to a notice, and what a press says back.
  /** A dismissible notice's own button. */
  dismiss: 'Dismiss',
  /** A notice another notice's button opened, when it can't be dismissed: it goes back to its slot's own pick. */
  close: 'Close',
  /** A Copy button's text is on the clipboard (when the clipboard refuses, the toast is the text itself). */
  copied: 'Copied.',
  /** Settings, What leaves your machine, on a server with notices. */
  privacy: 'Notices from CCSR send back only their id and how often each was shown, pressed or dismissed, never their words.',
}

// ------------------------------------------------------------------ accounts and installs

/** The account lines (link codes, recovery keys, installs), approved in docs/copy.md on 2026-10-08. */
export const ACCOUNT = {
  linkWith: 'Link with a code',
  recoverWith: 'Use a recovery key',
  newHandle: 'Pick a handle',
  codeLabel: 'Link code',
  codePlaceholder: 'The 6 letters from your other install',
  codeSubmit: 'Link',
  keyLabel: 'Recovery key',
  keyPlaceholder: 'ccsr_rec_...',
  keySubmit: 'Sign in',
  saveKey: (h: string) => `Save your recovery key. It gets you back into ${h} from any machine if this one loses its sign-in.`,
  copyKey: 'Copy recovery key',
  copied: 'Copied. Keep it somewhere safe, like a password manager.',
  savedIt: 'Saved it',
  hasKey: 'Recovery key on this install.',
  keyElsewhere: 'Your recovery key was made on another install. Make a new one here to see it; the old one stops working.',
  noKey: 'No recovery key yet. Make one so you can get back in from another machine.',
  newKey: 'Make a new recovery key',
  linkAnother: 'Link another install',
  codeShown: (code: string) => `Enter ${code} in the other install's Match tab, under Link with a code. Works once, for 10 minutes.`,
  installs: 'Installs',
  thisInstall: 'this install',
  seen: (ago: string) => `seen ${ago}`,
  remove: 'Remove',
  removeThis: 'Remove this install',
  removeWarn: (h: string) => `This signs this install out of ${h}. Press again to remove it. Without another install or your recovery key, you can't get back in.`,
  removed: 'This install was removed from its account. Link it again or use your recovery key.',
  unknown: "The server doesn't know this install's sign-in. Check the server address, link with a code, or use your recovery key.",
  autoLinked: (h: string) => `Signed in as ${h} from another install on this machine.`,
  scoredElsewhere: 'Scored by your other install.',
}

// ------------------------------------------------------------------ sign-in with a provider (W5b)

/** A sign-in provider's name as the mod writes it. GitHub is the only one; another needs a mod update for its link domain anyway. */
export const PROVIDER_NAMES: Readonly<Record<string, string>> = { github: 'GitHub' }

/**
 * The sign-in lines (docs/copy.md, "W5: GitHub sign-in", the mod's table), drawn only while
 * config's `signin` turns the provider on. `provider` is its name (PROVIDER_NAMES). The card
 * draws the server's message instead of an ended line when the server sent one.
 * server/test/identity-copy.test.ts renders every value here with its parameter names in
 * braces and finds it in docs/copy.md.
 */
export const IDENTITY = {
  // The ways in: the first-run card and Settings.
  signIn: (provider: string) => `Sign in with ${provider}`,
  link: (provider: string) => `Link ${provider}`,
  notLinked: (provider: string) => `No ${provider} account linked. Link one and you can sign in with it on any machine.`,
  linked: (provider: string, login: string) => `Linked to ${provider} @${login}.`,
  linkedNoLogin: (provider: string) => `Linked to ${provider}.`,
  unlink: (provider: string) => `Unlink ${provider}`,
  unlinkWarn: (provider: string) => `Press again to unlink ${provider}. You can link it again any time.`,
  unlinked: (provider: string) => `${provider} unlinked.`,
  // The card: asking for a code, then the code.
  starting: (provider: string) => `Asking ${provider} for a code.`,
  enterCode: (provider: string) => `Enter this code on ${provider} and approve CCSR. This card moves on by itself.`,
  openPage: (provider: string) => `Open ${provider}`,
  noLink: (provider: string) => `Open ${provider}'s device sign-in page and enter the code.`,
  copyCode: 'Copy code',
  copied: 'Copied the code.',
  privacy: (provider: string) => `CCSR reads your ${provider} id and login and keeps no ${provider} token. Signing in can't read your repos.`,
  // W11: while config's signups.email is on, a new handle made through sign-in keeps the account's email.
  privacyEmail: (provider: string) =>
    `CCSR reads your ${provider} id and login, and for a new handle your email address, to email you once when it's your turn to play. It keeps no ${provider} token, and signing in can't read your repos.`,
  cancel: 'Cancel',
  busy: 'One moment.',
  // A fresh install whose account has no handle yet: pick one.
  pickHandle: (provider: string, login: string) => `${provider} @${login} has no handle yet. Pick one and it starts linked.`,
  pickHandleNoLogin: (provider: string) => `That ${provider} account has no handle yet. Pick one and it starts linked.`,
  typeElsewhere: "Pick your handle in the terminal or the desktop app. This screen can't type one.",
  // The account is another handle's, or this handle has another account.
  taken: (provider: string, login: string, handle: string) => `${provider} @${login} is linked to ${handle}. Sign this install in to ${handle}, or cancel.`,
  takenNoLogin: (provider: string, handle: string) => `That ${provider} account is linked to ${handle}. Sign this install in to ${handle}, or cancel.`,
  takenElsewhere: (provider: string) => `That ${provider} account is linked to another handle.`,
  switchTo: (handle: string) => `Sign in to ${handle}`,
  switchWarn: (handle: string) => `This install leaves ${handle}. Copy its recovery key first if no other install can get you back in.`,
  handleLinked: (provider: string) => `This handle already has another ${provider} account linked. Unlink it in Settings to link this one.`,
  cantLink: (provider: string) => `That ${provider} account can't be linked here.`,
  // Why a press didn't go through; the card stays.
  outbox: "Scores from this handle are still sending. Switch once they're sent.",
  inMatch: "You're in a match. Switch handles once it's over.",
  offline: "Can't reach the server. Try again when it's back.",
  badHandle: 'Invalid handle. Use 2 to 20 of a-z, 0-9 and _.',
  handleTaken: 'That handle is taken.',
  refused: 'The server refused that.',
  // Done.
  signedInAs: (handle: string, provider: string, login: string) => `Signed in as ${handle} with ${provider} @${login}.`,
  signedInAsNoLogin: (handle: string, provider: string) => `Signed in as ${handle} with ${provider}.`,
  done: 'Done',
  // Over, by why (identity.ts EndWhy).
  ended: {
    expired: () => "The code expired. Start again when you're ready.",
    denied: (provider: string) => `Sign-in was denied on ${provider}.`,
    failed: (provider: string) => `${provider} sign-in didn't finish. Try again.`,
    cancelled: () => 'Sign-in cancelled.',
    closed: () => 'That sign-in was closed. Start again if you still want it.',
    unavailable: (provider: string) => `Sign in with ${provider} isn't set up on this server yet.`,
    busy: () => 'Too many sign-ins just now. Try again in a minute.',
    unsupported: () => "That sign-in isn't one CCSR has.",
    invalid: () => 'That sign-in has ended. Start again.',
    taken: (provider: string) => `That ${provider} account is already linked to another handle.`,
    update: () => 'Update CCSR to sign in.',
    offline: () => "Can't reach the server. Try again when it's back.",
    refused: () => 'The server refused the sign-in.',
  },
  startAgain: 'Start again',
  close: 'Close',
  // The account's other installs: one that signed in with the provider in the last day.
  newInstall: (provider: string, label: string) => `A new install signed in with ${provider}: ${label}. Remove it in Settings if it isn't yours.`,
  /** {label} for an install with no label. */
  unnamed: 'unnamed',
  // Settings, What leaves your machine (privacyLines), while sign-in is on.
  sends: (provider: string) => `Signing in with ${provider} shares your ${provider} id and login with CCSR. No ${provider} token is kept, and sign-in can't read your repos.`,
  // W11: the same line while config's signups.email is on.
  sendsEmail: (provider: string) =>
    `Signing in with ${provider} shares your ${provider} id and login with CCSR, and for a new handle your email address, used once to say it's your turn. No ${provider} token is kept, and sign-in can't read your repos.`,
}

// ------------------------------------------------------------------ the surface switches (docs/ui-spec.md, Settings)

// W6b: `challenges` (the Challenges switch) is on in both, so an older store reads it as on. A preset
// press leaves it as it is (setPreset, presetOf): it opens an inbox to anyone, the player's own call.
// W4b: `notices` is a preset's: all on Full, important on Quiet (surfacesFrom reads an older store's).
// W10b: `finishers` is full on Full and short on Quiet; `oppFinishers` is theirs in both.
export const FULL: Surfaces = { band: 'after', bandMatch: 'on', bandChat: 'on', toasts: 'all', sounds: 'on', status: 'full', mode: 'on', hint: 'auto', spinner: 'on', marks: 'on', extras: 'on', chat: 'on', challenges: 'on', notices: 'all', finishers: 'full', oppFinishers: 'theirs' }
export const QUIET: Surfaces = { band: 'off', bandMatch: 'on', bandChat: 'off', toasts: 'match', sounds: 'off', status: 'short', mode: 'off', hint: 'off', spinner: 'off', marks: 'on', extras: 'off', chat: 'on', challenges: 'on', notices: 'important', finishers: 'short', oppFinishers: 'theirs' }

export type SurfaceKey = keyof Surfaces

/** The switch labels and their notes (docs/copy.md, "The mod", approved 2026-10-08). */
export const SURFACE_ROWS: (['group', string] | [SurfaceKey, string, [string, string][]])[] = [
  ['group', 'In the band'],
  ['band', 'Band when idle', [['after', 'After a score'], ['always', 'Always'], ['off', 'Off']]],
  ['bandMatch', 'Band in matches', [['on', 'On'], ['off', 'Off']]],
  ['bandChat', 'Chat line in the band', [['on', 'On'], ['off', 'Off']]],
  ['group', 'Alerts'],
  ['toasts', 'Toasts', [['all', 'All'], ['match', 'Match only'], ['off', 'Off']]],
  ['sounds', 'Sounds', [['on', 'On'], ['off', 'Off']]],
  // W4b: the Notices setting. Settings spells its buttons' keys out in register.tsx, where the freeze manifest looks for them.
  ['notices', 'Notices', [['all', 'All'], ['important', 'Important only'], ['off', 'Off']]],
  ['group', 'Around the prompt'],
  ['status', 'Status line', [['full', 'Full'], ['short', 'Short'], ['off', 'Off']]],
  ['mode', 'Badge by the prompt', [['on', 'On'], ['off', 'Off']]],
  ['hint', 'Rules hint', [['auto', 'First 3 matches'], ['off', 'Off']]],
  ['spinner', 'Ship-it line at the bell', [['on', 'On'], ['off', 'Off']]],
  ['group', 'In the transcript'],
  ['marks', 'Points on commit rows', [['on', 'On'], ['off', 'Off']]],
  ['extras', 'Terminal extras', [['on', 'On'], ['off', 'Off']]],
  ['group', 'Opponent'],
  ['chat', 'Chat', [['on', 'On'], ['off', 'Off']]],
  // W6b: drawn only while config's `challenges` reads on for this player (Settings filters it out otherwise).
  ['challenges', 'Challenges', [['on', 'On'], ['off', 'Off']]],
  // W10b: the win animations, drawn only while config's `finishers` is on for this player (Settings filters them out
  // otherwise). Settings spells their button keys out (switchKey in register.tsx), as it does the Challenges switch's.
  ['finishers', 'Finishers', [['full', 'Full'], ['short', 'Short'], ['off', 'Off']]],
  ['oppFinishers', 'Opponent finishers', [['theirs', 'Theirs'], ['default', 'Default']]],
]

export const SURFACE_WHAT: Record<SurfaceKey, string> = {
  band: 'The Grind band between matches. After a score: two minutes, then gone.',
  bandMatch: 'The band while queued, racing and for the result. The ready check still shows.',
  bandChat: 'The newest chat line beside the score. Chat stays in the pane.',
  toasts: 'Match only keeps opponent found, the 10 and 1 minute warnings, the result and going offline. Off keeps opponent found only.',
  sounds: 'The chime, the clock at 1:00 and the result sting.',
  notices: 'Banners, cards and lines from CCSR, like a new season or an outage. Important only keeps warnings and outages. Off keeps outages, in the Match tab.',
  status: 'Short is the score and clock only, about 20 characters.',
  mode: 'The CCSR badge at the right of the prompt footer.',
  hint: 'The rules line under the prompt.',
  spinner: 'At the bell, Claude keeps its own working line.',
  marks: 'Points on the git commit row and permission prompts. The toast, the feed and the Grind tab still show them.',
  extras: 'Points on the end-of-turn line (terminal).',
  chat: 'Chat in the band and the pane. Your opponent sees that your chat is off.',
  challenges: "Other players can challenge you to unrated matches. Off turns new ones away, declines what's waiting and withdraws yours.",
  finishers: 'The win animation on a decided match, on both screens. Short lands the headline at once. Off keeps the plain result card.',
  oppFinishers: "Theirs plays an opponent's finisher with their callout and color. Default plays it with the plain headline in Signal.",
}

export function presetOf(p: Surfaces): 'full' | 'quiet' | 'custom' {
  // W6b: the Challenges switch is no preset's, so either value leaves Full or Quiet as it is.
  const same = (q: Surfaces) => (Object.keys(q) as SurfaceKey[]).every(k => k === 'challenges' || p[k] === q[k])
  return same(FULL) ? 'full' : same(QUIET) ? 'quiet' : 'custom'
}

/**
 * Settings from before the 12 switches held four booleans and a Quiet flag:
 * map them onto the new shape so nobody's choices are lost on update. W4b:
 * the Notices setting is the stored one when set; a store from before it gets
 * `important` when its 12 older switches equal Quiet's (so a Quiet player
 * stays on Quiet, not Custom), else `all` (noticeSettingFrom compares only
 * those 12, so a later switch never moves it).
 */
export function surfacesFrom(old: unknown, quiet: boolean): Surfaces {
  return withFinisherSwitches(storedSurfaces(old, quiet), old)
}

/** The stored switches, every one but W10b's two (withFinisherSwitches fills those). */
function storedSurfaces(old: unknown, quiet: boolean): Surfaces {
  const base = quiet ? { ...QUIET } : { ...FULL }
  if (!old || typeof old !== 'object') return base
  const o = old as Record<string, unknown>
  if (typeof o.band === 'string') return { ...base, ...(o as Partial<Surfaces>), notices: noticeSettingFrom(o) }
  const on = (k: string) => o[k] !== false
  return {
    ...base,
    band: on('band') ? base.band : 'off',
    bandMatch: on('band') ? 'on' : 'off',
    toasts: on('toasts') ? base.toasts : 'off',
    status: on('status') ? base.status : 'off',
    chat: on('chat') ? 'on' : 'off',
  }
}

/** The 12 switches every store holds since 2026-10-08: a stored set is Quiet's when these equal QUIET's (the later switches never count). */
const TWELVE: readonly SurfaceKey[] = ['band', 'bandMatch', 'bandChat', 'toasts', 'sounds', 'status', 'mode', 'hint', 'spinner', 'marks', 'extras', 'chat']

/**
 * W10b's two switches on a stored set: the stored value when it is one, else the preset's. A
 * store from before them (the 12 switches, any later ones besides) gets Quiet's Short when its
 * 12 older switches equal Quiet's, so a Quiet player stays on Quiet, not Custom; anyone else gets
 * Full's. Opponent finishers is Theirs in both presets. A set from before the 12 switches (four
 * booleans and a Quiet flag) keeps whichever preset its flag picked.
 */
function withFinisherSwitches(s: Surfaces, old: unknown): Surfaces {
  const o: Record<string, unknown> = old && typeof old === 'object' ? (old as Record<string, unknown>) : {}
  const twelve = typeof o.band === 'string'
  const finishers = o.finishers === 'full' || o.finishers === 'short' || o.finishers === 'off' ? o.finishers : twelve ? (TWELVE.every(k => o[k] === QUIET[k]) ? QUIET.finishers : FULL.finishers) : s.finishers
  const oppFinishers = o.oppFinishers === 'theirs' || o.oppFinishers === 'default' ? o.oppFinishers : FULL.oppFinishers
  return { ...s, finishers, oppFinishers }
}

// ------------------------------------------------------------------ finishers (W10b)

/** What a finisher's lines fill in, for the ones the mod builds itself: the final score, the winner's scored commits and their Elo change, signed (`+12`), or null for none. */
export type FinisherFacts = { w: number; l: number; commits: number; delta: string | null }

/**
 * The finisher lines the mod draws (docs/copy.md, "Finishers" and "W10"). A ranked match's
 * headline and lines are the server's (`MatchSummary.finisher`); the mod builds them only for
 * practice and the Finishers view's preview, with the same words as server/src/copy.ts
 * (`winLine`, `lossLine`). Then the result's buttons, the terminal's bell line, and Settings'
 * Finishers view. Nothing here reaches a command reply.
 */
export const FINISHER = {
  /** The line under the headline on the winner's screen. */
  winLine: (kind: string, f: FinisherFacts): string =>
    kind === 'flawless'
      ? 'They scored 0. Co-Authored-By: Claude.'
      : kind === 'combo'
        ? `${f.commits} commits. ${f.commits} hits.`
        : kind === 'clutch'
          ? 'Behind until the last commit.'
          : kind === 'photo'
            ? `Won by ${f.w - f.l}. Every point was load-bearing.`
            : f.delta === null
              ? 'Victory. Co-Authored-By: Claude.'
              : `Victory. ${f.delta}. Co-Authored-By: Claude.`,
  /** The line under the headline on the loser's screen. None carries an Elo change. */
  lossLine: (kind: string, f: FinisherFacts): string =>
    kind === 'flawless'
      ? 'nothing to commit, working tree clean'
      : kind === 'shipality'
        ? '[Request interrupted by user]'
        : kind === 'combo'
          ? 'Your Claude is asking for a transfer.'
          : kind === 'clutch'
            ? 'You were absolutely right until the bell.'
            : kind === 'photo'
              ? f.w - f.l === 1
                ? 'By 1 point. Great CLAUDE.md though.'
                : `By ${f.w - f.l} points. Great CLAUDE.md though.`
              : 'Same Claude. Different idiot.',
  // The result: the buttons under the finisher, the terminal's first line, and the drawing's alt text.
  replay: 'Replay',
  postWin: 'Post to X',
  postLoss: 'Post the L',
  bell: 'Bell. Counting the last commits.',
  alt: (title: string, line: string, stats: string) => `${title} ${line} ${stats}`,
  // Settings: the button that opens the Finishers view.
  open: 'Finishers',
  // The Finishers view.
  title: 'Finishers',
  what: 'Your callout headlines your knockouts, and your color paints every finisher you win. A match keeps the picks it was won with.',
  callout: 'Callout',
  /** The callout chip for none: the knockout's own headline. */
  handleCallout: (handle: string) => `${handle.toUpperCase()} WINS.`,
  color: 'Color',
  /** The colors by key; one the mod can't draw isn't offered. */
  accents: { signal: 'Signal', mud: 'Mud', bronze: 'Bronze', gold: 'Gold', diamond: 'Diamond', blood: 'Blood' } as Readonly<Record<string, string>>,
  /** A color locked for you: the tier that unlocks it (capitalized from config's lowercase `tier`). */
  unlocks: (tier: string) => `Unlocks at ${tier}.`,
  preview: 'Your knockout',
  play: 'Play',
  back: 'Back to Settings',
  checking: 'Checking with the server.',
  signIn: 'Pick a handle first. Your callout and color live on your account.',
  off: 'Finishers are off for now.',
  /** The server's refusals, when its answer carries no message of its own. */
  calloutGone: "That callout isn't on the list anymore.",
  locked: (tier: string) => `That color unlocks at ${tier}.`,
  /** The preview's other coin, drawn as OPPONENT: a plain word, never a real player's handle from the server. */
  sample: 'opponent',
}

// ------------------------------------------------------------------ custom finishers (W10e)

/**
 * Custom finishers in the Finishers view and on the result (docs/copy.md, "W10", the mod's custom
 * finisher table). The prompts are bundled text plus the draft folder's path, never server text: a
 * problem draws its own line here by its code, and the server's message for it is never shown or
 * put in a prompt. An art's title and its owner's handle are the server's, drawn as Text beside
 * these, never inside a prompt.
 */
export const CUSTOM = {
  // The slots, by kind (the kind a win plays as; one this version doesn't know draws `slotOther`).
  slots: { knockout: 'Knockout', flawless: 'Flawless ship', shipality: 'Shipality', combo: 'Ultra combo', clutch: 'Clutch', photo: 'Photo finish' } as Readonly<Record<string, string>>,
  slotOther: 'Another slot',
  // Make your own (only while config's finishers.custom.create is on for you).
  make: 'Make your own',
  makeWhat: 'Draw a finisher with your own Claude. It plays between our HUD and result strip when you win in its slot, once a review approves it.',
  makeButton: 'Make a finisher',
  restart: 'Start over',
  check: 'Preview',
  /** The bundled prompt, put in your prompt box by Make a finisher (or copied). */
  prompt: 'Make me a CCSR finisher. Read ~/ccsr-finisher/SPEC.md, then edit ~/ccsr-finisher/finisher.svg.',
  /** Ask Claude to fix it: the first line, then one line per problem, as the check draws them. */
  fixPrompt: (lines: readonly string[]) => `Fix these problems in ~/ccsr-finisher/finisher.svg. The rules are in ~/ccsr-finisher/SPEC.md.\n${lines.map(x => `- ${x}`).join('\n')}`,
  fix: 'Ask Claude to fix it',
  copyPrompt: 'Copy the prompt',
  made: 'Wrote SPEC.md, starter.svg and finisher.svg to ~/ccsr-finisher.',
  madeKept: 'Wrote SPEC.md and starter.svg to ~/ccsr-finisher, and kept your finisher.svg.',
  filled: 'The prompt is in your prompt box. Send it, and Claude asks before it reads or edits outside your project.',
  notFilled: 'Copy the prompt and send it to Claude.',
  fixFilled: 'The problems are in your prompt box. Send them to Claude.',
  copied: 'Copied the prompt.',
  notCopied: "Couldn't copy here. Press Copy the prompt in the desktop app or the terminal.",
  restartAsk: 'Press Start over again to replace finisher.svg with the starter.',
  restarted: 'finisher.svg is the starter again.',
  noHome: "There's no home folder here to make ~/ccsr-finisher in.",
  noBundle: 'This install is missing its finisher files. Update CCSR, then try again.',
  notWritten: "Couldn't write the files to ~/ccsr-finisher.",
  noDraft: 'No finisher.svg yet. Press Make a finisher first.',
  notRead: "Couldn't read ~/ccsr-finisher/finisher.svg.",
  // The check (Preview), and the server's refusal of a submitted finisher.
  clean: (seconds: string) => `No problems found. It runs ${seconds} s.`,
  found: 'The check found these. The server checks again when you submit.',
  refused: 'The server refused it for these:',
  problems: {
    not_svg: "finisher.svg isn't one SVG drawing the check can read.",
    not_ascii: 'It has a character outside printable ASCII. Draw text as paths.',
    too_large: "It's over the size limit.",
    too_many_elements: 'It has too many elements.',
    too_deep: 'Its elements nest too deeply.',
    doctype: 'It declares a DOCTYPE or entities.',
    script: 'It has a script. Nothing runs in a finisher.',
    foreign_object: 'It has a foreignObject.',
    event_handler: 'It has an event handler attribute.',
    external_ref: 'It points to something outside the file. Only #id references work.',
    image: 'It embeds an image. Draw it with shapes instead.',
    element_not_allowed: "It uses an element SPEC.md doesn't allow.",
    attribute_not_allowed: "It has an attribute or value SPEC.md doesn't allow.",
    css_not_allowed: "Its CSS uses something SPEC.md doesn't allow.",
    smil: 'It animates with SMIL. Use CSS keyframes.',
    too_long: 'An animation runs past the time limit.',
    infinite: 'An animation repeats forever.',
    flashing: 'An animation flashes too fast.',
    too_complex: 'Its timeline changes at more than 32 instants.',
    filter_not_allowed: "It uses a filter SPEC.md doesn't allow.",
    use_loop: 'A use, mask, clip path or pattern refers back to itself.',
    use_budget: 'It draws too much: too much text, path detail or repetition through use, masks, clip paths or patterns.',
    bad_viewbox: 'Its viewBox must be 0 0 960 408.',
    /** Drawn by the title box, never in the list or the fix prompt (the title isn't in finisher.svg). The server refuses an exclamation point too (its copy rule). */
    bad_title: 'The title must be 1 to 32 printable ASCII characters, with no exclamation point.',
  } as Readonly<Record<string, string>>,
  /** A problem code this version has no line for (the server's allowlist moved after the freeze). */
  problemOther: 'The server found a problem this version of CCSR has no words for.',
  at: (n: number) => `At character ${n}.`,
  // Submit.
  slot: 'Slot',
  titleLabel: 'Title',
  titlePlaceholder: 'Up to 32 characters',
  /** The title sent when none was typed (mobile has no title box). */
  defaultTitle: (slot: string) => `${slot} finisher`,
  submit: 'Submit',
  sent: 'Sent for review. It shows under My finishers, and plays in your wins once it is approved and equipped.',
  // My finishers.
  mine: 'My finishers',
  noneYet: "You haven't sent a finisher yet.",
  row: (title: string, slot: string) => `${title} · ${slot}`,
  code: (code: string) => `Code ${code}`,
  status: {
    pending: 'Waiting for review.',
    approved: 'Approved.',
    pulled: 'Pulled after reports. It is being reviewed again.',
    held: 'Held after a copyright claim.',
  } as Readonly<Record<string, string>>,
  rejected: (reasons: string) => (reasons ? `Not approved: ${reasons}.` : 'Not approved.'),
  statusOther: "This version of CCSR can't show its status.",
  reasons: {
    sexual: 'sexual content',
    hate: 'hate',
    slur: 'a slur',
    real_person: 'a real person',
    anthropic_mark: "Anthropic's or Claude's marks",
    brand_or_character: 'a brand or a character',
    imitates_ccsr: 'it copies CCSR or Claude Code',
    gore: 'gore',
    link_or_instruction: 'a link or instructions',
    flashing: 'flashing',
    unsure: 'the review was unsure',
    review_refused: 'the review refused to judge it',
    reports: 'reports from players',
    copyright: 'a copyright claim',
    draw_too_slow: 'it draws too slowly',
  } as Readonly<Record<string, string>>,
  reasonOther: 'a reason this version has no words for',
  equip: 'Equip',
  unequip: 'Unequip',
  delete: 'Delete',
  deleteAsk: 'Press Delete again to delete it for good. Its code stops working.',
  deleted: 'Deleted.',
  /** Your own art's row, while it plays in its slot. */
  equippedTag: 'Equipped.',
  /** Other players' art you equipped (from the gallery, a code or a result): the heading, and a slot with one. */
  equipped: 'Equipped',
  equippedBy: (slot: string, handle: string) => `${slot}: by ${handle}`,
  equippedNow: (slot: string) => `Equipped for your ${slot} wins.`,
  unequippedNow: (slot: string) => `Unequipped. Your ${slot} wins play the default.`,
  toastApproved: (slot: string) => `Your ${slot} finisher was approved. Equip it under Settings, Finishers.`,
  toastRejected: (slot: string) => `Your ${slot} finisher wasn't approved. Settings, Finishers says why.`,
  // The gallery (only while config's finishers.custom.gallery is on for you).
  gallery: 'Gallery',
  top: 'Top',
  newest: 'New',
  allSlots: 'All slots',
  more: 'More',
  empty: 'Nothing here yet.',
  galleryRow: (title: string, handle: string, slot: string) => `${title} by ${handle} · ${slot}`,
  plays: (n: number) => (n === 1 ? '1 play' : `${n} plays`),
  preview: 'Preview',
  codeLabel: 'Equip a code',
  codePlaceholder: '6 letters and digits',
  badCode: 'A code is 6 letters and digits.',
  // On the result, and around any custom art the mod draws.
  by: (handle: string) => `Finisher by ${handle}`,
  artAlt: (handle: string) => `A custom finisher by ${handle}.`,
  loading: 'Loading the finisher.',
  previewFailed: "Couldn't load that finisher.",
  noSurface: "Custom finishers don't draw here.",
  report: 'Report',
  reportAsk: 'Report this finisher as:',
  reportReasons: { sexual: 'Sexual', hate: 'Hate', real_person: 'A real person', copyright: 'Copyright', imitates_ccsr: 'Copies CCSR', other: 'Other' } as Readonly<Record<string, string>>,
  reported: 'Reported. Thanks.',
  cancel: 'Cancel',
  equipThis: 'Equip this',
  // Settings, What leaves your machine, while making finishers is on for you.
  privacy: 'Submitting a finisher sends its SVG, title and slot, which your Claude may have drawn, and nothing else from ~/ccsr-finisher. A review by Claude decides before anyone else sees it.',
}
