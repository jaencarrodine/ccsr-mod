// Every user-facing line the mod draws that isn't data, all approved in
// docs/copy.md (change a line there first, then here). Pure: no `$` here, so
// register.tsx can import it.

import type { Surfaces } from '../types'

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
  counting: 'Bell. Scoring commits made before it.',
  notRanked: 'Not ranked until placed.',
  locked: 'Rooms above your tier are locked.',
  practice: 'Practice against a bot. Your commits score for real; the rating is practice only.',
  // Updates (docs/copy.md, "The mod", approved 2026-10-08 as Jaen's defaults).
  updateOut: (latest: string) => `CCSR ${latest} is out. Update between matches.`,
  updateNeeded: (min: string, version: string) => `Ranked needs CCSR ${min}. You're on CCSR ${version}.`,
  updated: 'Updated. Restart Claude Code to load it.',
  // TODO copy: the rest of the update lines.
  updating: 'Updating CCSR.',
  updateCopied: 'Copied the update command. Run it in a terminal, then restart Claude Code.',
  version: (v: string) => `CCSR ${v}`,
}

// ------------------------------------------------------------------ the surface switches (docs/ui-spec.md, Settings)

export const FULL: Surfaces = { band: 'after', bandMatch: 'on', bandChat: 'on', toasts: 'all', sounds: 'on', status: 'full', mode: 'on', hint: 'auto', spinner: 'on', marks: 'on', extras: 'on', chat: 'on' }
export const QUIET: Surfaces = { band: 'off', bandMatch: 'on', bandChat: 'off', toasts: 'match', sounds: 'off', status: 'short', mode: 'off', hint: 'off', spinner: 'off', marks: 'on', extras: 'off', chat: 'on' }

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
]

export const SURFACE_WHAT: Record<SurfaceKey, string> = {
  band: 'The Grind band between matches. After a score: two minutes, then gone.',
  bandMatch: 'The band while queued, racing and for the result. The ready check still shows.',
  bandChat: 'The newest chat line beside the score. Chat stays in the pane.',
  toasts: 'Match only keeps opponent found, the 10 and 1 minute warnings, the result and going offline. Off keeps opponent found only.',
  sounds: 'The chime, the bell at 1:00 and the result sting.',
  status: 'Short is the score and clock only, about 20 characters.',
  mode: 'The CCSR badge at the right of the prompt footer.',
  hint: 'The rules line under the prompt.',
  spinner: 'At the bell, Claude keeps its own working line.',
  marks: 'Points on the git commit row and permission prompts. The toast, the feed and the Grind tab still show them.',
  extras: 'Points on the end-of-turn line (terminal).',
  chat: 'Chat in the band and the pane. Your opponent sees that your chat is off.',
}

export function presetOf(p: Surfaces): 'full' | 'quiet' | 'custom' {
  const same = (q: Surfaces) => (Object.keys(q) as SurfaceKey[]).every(k => p[k] === q[k])
  return same(FULL) ? 'full' : same(QUIET) ? 'quiet' : 'custom'
}

/**
 * Settings from before the 12 switches held four booleans and a Quiet flag:
 * map them onto the new shape so nobody's choices are lost on update.
 */
export function surfacesFrom(old: unknown, quiet: boolean): Surfaces {
  const base = quiet ? { ...QUIET } : { ...FULL }
  if (!old || typeof old !== 'object') return base
  const o = old as Record<string, unknown>
  if (typeof o.band === 'string') return { ...base, ...(o as Partial<Surfaces>) }
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
