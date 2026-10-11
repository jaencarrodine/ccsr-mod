// CCSR mod: the values it keeps in $.state, and the shapes they hold.

// W10b: 'finishers' is the Finishers view, opened from Settings and from a notice's `{ do: 'tab', tab: 'finishers' }`; it isn't one of the frame's five.
export type Tab = 'match' | 'ranked' | 'grind' | 'chat' | 'backtest' | 'lab' | 'settings' | 'finishers'

export type Period = 'week' | 'month' | 'all'

export type Craft = 'clean' | 'neutral' | 'sloppy'

/** One commit after the judge (or a skip rule) has scored it. */
export type ScoredCommit = {
  /** Change fingerprint: `git patch-id --stable`, or the sha for an empty diff. */
  pid: string
  sha: string
  repoName: string
  title: string
  /** Final points: `base` moved one step on the scale by `craft`. */
  points: number
  /** Points before the craft step. */
  base: number
  craft: Craft
  category: string
  reason: string
  added: number
  deleted: number
  files: number
  /** Author time, epoch ms. */
  authoredAt: number
  scoredAt: number
  /** The model that answered, or `rule` when a skip rule set 0. */
  judge: string
  /** The model the settings asked for; a cached verdict is reused only for the same one. */
  asked: string
  rubric: string
  /** Scored while Grind tracking was off, only because it fell inside a live match: never counts for the Grind. */
  matchOnly?: true
}

/** Every surface's off switch (docs/ui-spec.md, Settings). The match-found ready check ignores all of them. */
export type Surfaces = {
  band: 'after' | 'always' | 'off'
  bandMatch: 'on' | 'off'
  bandChat: 'on' | 'off'
  toasts: 'all' | 'match' | 'off'
  sounds: 'on' | 'off'
  status: 'full' | 'short' | 'off'
  mode: 'on' | 'off'
  hint: 'auto' | 'off'
  spinner: 'on' | 'off'
  marks: 'on' | 'off'
  extras: 'on' | 'off'
  /** W10b: the win animation on a decided match: the whole finisher, the headline at once, or the plain result card. Shown only while config's `finishers` is on. */
  finishers: 'full' | 'short' | 'off'
  /** W10b: an opponent's finisher with their callout and color, or with the default headline in Signal. Shown only while config's `finishers` is on. */
  oppFinishers: 'theirs' | 'default'
  chat: 'on' | 'off'
  /** W6b: the Challenges switch, drawn only while config's `challenges` is on; off also tells the server (`PATCH /me { challenges_enabled }`). */
  challenges: 'on' | 'off'
  /** W4b: notices from the server: every one, critical and warn only, or none but a critical one in the Match tab. */
  notices: 'all' | 'important' | 'off'
}

export type ModSettings = {
  handle: string
  tracking: boolean
  share: boolean
  model: string
  surfaces: Surfaces
  /** The first-run band was answered (Set up or Not now): it never shows again. */
  setupSeen?: boolean
  /** From before the 12 switches: read once to carry an old Quiet choice over, never written. */
  quiet?: boolean
}

export type ScanStatus = {
  busy: boolean
  lastAt: number
  note: string
  /** Every problem from the last scan, in full: one line per repo or commit. */
  problems: string[]
}

export type PastSession = {
  id: string
  title: string
  project: string
  cwd: string
  startAt: number
  endAt: number
}

export type BacktestRun = {
  sessionId: string
  status: 'running' | 'done' | 'partial' | 'error'
  done: number
  total: number
  points: number
  skipped: number
  failed: number
  deferred: number
  commits: ScoredCommit[]
  note: string
}

export type FeedItem = {
  at: number
  who: 'me' | 'opp'
  points: number
  category: string
  title?: string
}

export type ChatLine = {
  at: number
  who: string
  text: string
}

export type Opponent = {
  handle: string
  rating: number
  /** Points per hour the practice bot aims for. */
  pace: number
}

export type Match = {
  id: string
  kind: 'practice' | 'replay'
  hours: number
  startAt: number
  deadline: number
  opp: Opponent
  /** The bot's whole match, generated at the start: its points at time t are the plan items at or before t. */
  plan: FeedItem[]
  myPoints: number
  /** Final opponent points, set at the bell; while live it is derived from `plan`. */
  oppPoints: number
  /** My scored commits in the window, counted once each by patch id. */
  feed: FeedItem[]
  counted: string[]
  chat: ChatLine[]
  status: 'live' | 'won' | 'lost' | 'draw' | 'forfeit' | 'void'
  ratingBefore: number
  ratingAfter?: number
  /** The session that drives the clock, the bot and the bell; another takes over when the lease goes stale. */
  lease: { owner: string; at: number }
  endedAt?: number
  label?: string
}

export type Record3 = { w: number; l: number; d: number }

export type WeekTotals = Record<string, { points: number; commits: number }>

// ------------------------------------------------------------------ the server (docs/api.md v0.2)

export type ApiTier = 'Mud' | 'Iron' | 'Bronze' | 'Silver' | 'Gold' | 'Platinum' | 'Diamond' | 'Master'
/** A match length in minutes (API v0.5, W2): 15, 30, 60, 180, whatever the server's catalog holds. The deprecated `length` (hours) is never read. */
export type LengthMin = number

/** What a result is worth to you: your Elo change for a win, a draw and a loss, exactly what the server applies. */
export type ApiStakes = { win: number; draw: number; loss: number }

/** One length offered to you in `GET /queue`'s `lanes` (W2), shortest first. */
export type ApiLane = {
  length_min: LengthMin
  /** The server's label: 15m, 1h. */
  label: string
  waiting: number
  /** How long the last day's pairs at this length waited; null with none. */
  wait_ms: number | null
  /** Waiting players' ratings near yours: rounded to 10, each once, ascending, no handles. */
  ratings: number[]
  /** What an even match here is worth to you, either way; null when the server's isn't a number. */
  swing: number | null
}

export type ApiPlayerRef = { handle: string; rating: number; tier: ApiTier; is_top_100: boolean; placement: { played: number; of: number } | null }
export type ApiPlayer = ApiPlayerRef & { matches_played: number; record: { w: number; l: number; d: number }; chat_enabled: boolean; joined_at: string; /** W6: the server's copy of the Challenges switch. */ challenges_enabled?: boolean }

/** W6: a match is ranked or a challenge (played like ranked, never rated). Any other value reads as ranked. */
export type ApiMatchKind = 'ranked' | 'challenge' | (string & {})
export type ApiSeason = { id: string; model: string; rubric: string; starts_at: string; ends_at: string | null; tiers: { name: ApiTier; min: number }[] }

export type ApiOffer = {
  match_id: string
  length_min: LengthMin
  /** W3: the bucket the match is in; the opponent's ref, record and rank, and the stakes, are that bucket's. Read through `bucketIdOf`. */
  bucket?: string
  opponent: ApiPlayerRef
  opponent_record: { w: number; l: number; d: number }
  opponent_rank: number | null
  stakes: ApiStakes
  expires_at: string
  you_accepted: boolean
  /** W6: 'challenge' for a challenge's ready check (stakes all zeros, never drawn; the taker has already accepted). */
  kind?: ApiMatchKind
  /** W6: the challenge's code. */
  challenge_id?: string | null
}

export type ApiQueueState = {
  status: 'idle' | 'queued' | 'offered'
  offer: ApiOffer | null
  wait_ms: number | null
  range: { min: number; max: number } | null
  widening: { after_ms: number; range: { min: number; max: number } }[] | null
  /** The lengths offered to you, whatever your status (W2). Read through `lanesOf` in pure.ts, which drops any it can't hold. */
  lanes?: unknown
  /**
   * W3: the bucket this answer is about: your entry's while queued or offered (the mod adopts
   * it), else the `?bucket=` asked for when it's on for you, else Open. Read through `bucketIdOf`.
   */
  bucket?: string
  /**
   * Why your last offer died or you left the queue. The server adds reasons over time
   * (ranked_paused, bucket_closed, length_off, verification_required), so any string can
   * arrive: one this mod doesn't know gets the neutral line (cancelledLine in copy.ts).
   */
  cancelled: { reason: 'opponent_declined' | 'opponent_expired' | 'you_expired' | 'update_required' | 'ranked_paused' | 'length_off' | (string & {}) } | null
}

export type ApiMatchStatus = 'offered' | 'live' | 'grace' | 'finished' | 'void' | 'cancelled'

export type ApiMatchSide = {
  player: ApiPlayerRef
  points: number
  commits: number
  rating_before: number
  rating_after: number | null
  tier_before: ApiTier
  tier_after: ApiTier | null
  /** W2: this side's stakes while a rated match is undecided; null once decided or unrated. */
  stakes?: ApiStakes | null
  chat_enabled: boolean
  last_active_at: string | null
  biggest_commit: { points: number; category: string; craft: string; title: string | null } | null
}

export type ApiFeedItem = {
  seq: number
  kind: 'score'
  at: string
  handle: string
  points: number
  base: number
  craft: 'clean' | 'neutral' | 'sloppy'
  category: string
  lines_added: number
  lines_deleted: number
  files: number
  title: string | null
  flagged: boolean
  replaces_seq: number | null
}
export type ApiChatItem = { seq: number; kind: 'chat'; at: string; handle: string; text: string }
export type ApiSystemItem = { seq: number; kind: 'system'; at: string; event: 'started' | 'forfeit' | 'grace' | 'finished' | 'void'; handle: string | null }
export type ApiMatchEvent = ApiFeedItem | ApiChatItem | ApiSystemItem

export type ApiMatchSummary = {
  id: string
  length_min: LengthMin
  /** W3: the bucket it was made in; its sides' refs and stakes are that bucket's. */
  bucket?: string
  /** W6: 'challenge' for a challenge's match: unrated, so no Elo, stakes or rating change is drawn for it. */
  kind?: ApiMatchKind
  challenge_id?: string | null
  status: ApiMatchStatus
  started_at: string | null
  deadline: string | null
  /** W2: deadline plus the match's grace (3 minutes at 15m, 10 at 1h); null until the clock starts. */
  grace_ends_at?: string | null
  ended_at: string | null
  sides: [ApiMatchSide, ApiMatchSide]
  winner: string | null
  result: 'win' | 'draw' | 'forfeit' | 'void' | null
  /** W10a: the finisher a decided win ends with; null while open, for a draw, a void or a forfeit, and before W10a. Read only through `finisherOf` (finisherplay.ts), which cleans every string. */
  finisher?: ApiFinisher | null
  latest: ApiFeedItem | null
  spectators: number
}

/**
 * W10a's `Finisher` (docs/api.md, Finishers), as the server sends it. A kind or an accent the
 * mod doesn't know draws as knockout or signal; `art` is W10d's, drawn by W10e.
 */
export type ApiFinisher = {
  kind: string
  title: string
  lines: { win: string; loss: string }
  accent: string
  cameo: boolean
  hits: number | null
  clutch_min: number | null
  art?: { id: string; by: string; sha256: string; duration_ms: number } | null
}

export type ApiScoreBody = {
  fingerprint: string
  identity: string
  repo_hash: string
  authored_at: string
  points: number
  base: number
  craft: 'clean' | 'neutral' | 'sloppy'
  category: string
  lines_added: number
  lines_deleted: number
  files: number
  title?: string
  model: string
  rubric: string
  /** W7-2: which model, effort, agent and client made the commit (docs/api.md, "The coder block"); only while eval capture and Model stats are on. */
  coder?: ApiCoder
}

/** The coder block, `CoderBlock` in mod/hooks/coder.ts (repeated here, since the contract imports nothing). */
export type ApiCoder = {
  v: 1
  source: 'live' | 'transcript' | 'none'
  match: 'sha' | 'window' | 'ambiguous' | null
  model: string | null
  effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max' | 'other' | null
  agent: 'main' | 'subagent' | null
  client: 'cli' | 'desktop' | 'vscode' | 'jetbrains' | 'web' | 'sdk' | 'other' | null
  client_version: string | null
  tokens: { input: number; output: number; cache_read: number; cache_write: number }
}

export type ApiScoreReply = {
  accepted: boolean
  duplicate: boolean
  replaced: boolean
  match_id: string | null
  match: { status: ApiMatchStatus; mine: number; theirs: number; deadline: string } | null
  grind: { week: { points: number; commits: number }; month: { points: number; commits: number }; all: { points: number; commits: number } }
  grind_week_rank: number | null
}

/** A score waiting to reach the server, kept in the store until it does or is refused for good. */
export type OutboxItem = { pid: string; body: ApiScoreBody; tries: number; nextAt: number; lastError?: string }

/** One account on one server, as an install keeps it. */
export type SavedAccount = { token: string; handle: string | null; recoveryKey?: string | null }

/**
 * The server connection as the mod keeps it in `$.store`. `saved` holds the
 * accounts for other server addresses, so switching servers never loses one.
 * `recoveryKey` is the account's recovery key when this install made or saw it.
 */
export type ServerConfig = { url: string; token: string | null; handle: string | null; recoveryKey?: string | null; saved?: Record<string, SavedAccount> }

/**
 * `GET /me`'s account block: the salt every install hashes repos with, recovery, which install this is.
 * W5: the linked accounts and the other installs that signed in during the last day; read only
 * through identity.ts (`linkedLogin`, `newInstallsVia`), which drops what doesn't read.
 */
export type ApiAccount = {
  salt: string | null
  has_recovery_key: boolean
  recovery_made_at: string | null
  install: { id: number; label: string }
  identities?: { provider: string; login: string; linked_at: string }[]
  new_installs?: { label: string; via: 'github' | 'link' | 'recover' | (string & {}); at: string }[]
}

/** One install (a Claude Code config dir on some machine) signed in to the account. */
export type ApiInstall = { id: number; label: string; created_at: string; last_seen_at: string | null; this: boolean }

/** The machine-wide keyring at ~/.ccsr/keyring.json: survives a wiped config dir, a reinstall, a second config dir. */
export type Keyring = { v: 1; servers: Record<string, { handle: string | null; token: string; recovery_key?: string | null }> }

/** A ranked match as the mod follows it: the summary from the last poll, the feed and chat so far, the cursor. */
export type RankedMatch = {
  id: string
  summary: ApiMatchSummary | null
  events: ApiMatchEvent[]
  cursor: number
  polledAt: number
  /** W4b: the newest events page's `notices` (critical and warn, for a side of a live or grace match), as sent; read only through `feedNotices` (notices.ts). */
  notices?: unknown
}


export type ApiRankedRow = { rank: number; player: ApiPlayerRef; w: number; l: number; d: number; matches_played: number }
export type ApiRoom = 'world' | 'mud' | 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master'
export type ApiLobbyItem =
  | { seq: number; kind: 'chat'; at: string; room: ApiRoom; player: ApiPlayerRef; rank: number | null; text: string }
  // The server may add events and, from a broken row, send a null tier: the Chat tab drops any line it can't draw.
  | { seq: number; kind: 'system'; at: string; room: ApiRoom; event: 'placed' | 'promoted' | 'reached_number_one' | (string & {}); handle: string; tier: ApiTier | null }

/**
 * Where this player is in ranked, shared by every session through the store.
 * `lengthsMin` is the lengths picked to queue for, in minutes: null is every
 * length offered (the default, and what an old stored "both ticked" reads as).
 * `queuedMin` is what the server queued them for (POST /queue's `lengths_min`).
 * 0.3.0 kept `lengths` in hours here; it's read once by `lengthsFromStore` and never written.
 * `bucket` (W3b) is the bucket the Match tab queues in: the bucket row's pick (null is Open,
 * and a pick config no longer lists reads as Open while idle), and while queued or offered
 * the server's (`QueueState.bucket`, adopted as it comes).
 */
export type RankedShared = { phase: 'idle' | 'queued' | 'offered' | 'live' | 'done'; matchId: string | null; lengthsMin: number[] | null; queuedMin: number[]; since: number; bucket: string | null }

/**
 * A bucket's boards besides Open's (W3b), as this session last read them: its top 10, your
 * rank and last matches there (`GET /players/:handle?bucket=`), and its Grind: your rank among
 * the players who meet its requirements and how many they are (`GET /boards/grind?bucket=`).
 * Open's stay in `LinkState`'s own fields, as before buckets.
 */
export type BucketBoard = { ladder: ApiRankedRow[] | null; rank: number | null; recent: ApiRecentMatch[] | null; grindRank: number | null; grindOf: number | null }

/** The CCSR server as this session last saw it (docs/api.md). */
export type LinkState = {
  /** null before the first request; false while the server can't be reached. */
  online: boolean | null
  note: string
  me: ApiPlayer | null
  season: ApiSeason | null
  grind: ApiScoreReply['grind'] | null
  grindRank: number | null
  /** Scores waiting to send. */
  outbox: number
  queue: ApiQueueState | null
  /** The lengths offered to you, from the newest GET /queue that carried them (kept through a match, for Queue again); null before one. */
  lanes: ApiLane[] | null
  ranked: RankedMatch | null
  /** The Ranked board's top 10, your rank on it, and how many play the Grind this week. */
  ladder: ApiRankedRow[] | null
  myRank: number | null
  grindOf: number | null
  /** The chat rooms: which exist, who's in them, where you can post; the room on screen and its lines. */
  rooms: { room: ApiRoom; online: number; can_post: boolean; paused?: boolean }[] | null
  room: ApiRoom
  /** The room on screen's lines from a cursor, and the room's epoch when the server sends one (a change means lines were removed: read it again from 0). */
  lobby: { room: ApiRoom; events: ApiLobbyItem[]; cursor: number; epoch?: number } | null
  /** Your last ranked matches from your profile, newest first, for the Match tab. */
  recent: ApiRecentMatch[] | null
  /** The mod's release line from the server's x-ccsr-latest and x-ccsr-min headers; null until a server sends it. */
  release: { latest: string; min: string } | null
  /** What the last Update press did. */
  updateNote: string
  /** The account block from `/me`, the account's installs, and an open link code. */
  account: ApiAccount | null
  installs: ApiInstall[] | null
  linkCode: { code: string; expiresAt: string } | null
  /** The server answered `unauthorized` for the token this install holds: kept, never dropped, until the player signs in another way. */
  unknownToken: boolean
  /** A recovery key was just made and not yet copied. */
  recoveryFresh: boolean
  /** Remove this install was pressed once; the second press removes it. */
  confirmRemove: boolean
  /** W3: GET /me's `buckets`, where you stand in each bucket on for you, as sent; read only through `standingFor` (buckets.ts). */
  meBuckets: unknown[] | null
  /** W3b: the boards of the buckets besides Open that are on screen, by bucket id. */
  boards: Record<string, BucketBoard> | null
  /**
   * W3b: the bucket `lanes` are (the answer's `bucket`, else the one asked for); null with no
   * bucket named either way (a server before W3a). Lanes are drawn and queued with only for
   * that bucket: read through `lanesIn` in register.tsx.
   */
  lanesBucket: string | null
}

export type ApiRecentMatch = {
  id: string
  /** W6: a challenge's row has delta 0: who won or forfeited is read from `result`, never from the delta's sign. */
  kind?: ApiMatchKind
  opponent: ApiPlayerRef
  length_min: LengthMin
  result: 'win' | 'loss' | 'draw' | 'forfeit' | 'void'
  score: [number, number]
  delta: number
  ended_at: string
  series: [number[], number[]]
}

/**
 * The server's config as this session holds it: `ModConfig` from mod/hooks/config.ts
 * (repeated here, since the contract imports nothing), plus whose it is and when its read began.
 */
export type ConfigState = {
  version: string
  poll: { queued: number; offered: number; live: number; idle: number; chat: number; config: number; inbox: number }
  chat: { world: boolean; tiers: boolean; match: boolean }
  practiceOnly: boolean
  raw: Record<string, unknown>
  /** The server URL and handle it was read for, `<url>|<handle>`; '' before any read. */
  key: string
  /** When its read began (ms); 0 for the built-in default. */
  readAt: number
}

/** W6b: a player as a challenge names them (challenges.ts `ChallengeRef`, repeated here since the contract imports nothing). */
export type ChallengeRefView = { readonly handle: string; readonly rating: number; readonly tier: ApiTier; readonly placing: { readonly played: number; readonly of: number } | null }

/** W6b: a challenge as the mod reads it, its message apart (challenges.ts `Challenge`, repeated here). */
export type ChallengeView = {
  readonly id: string
  readonly from: ChallengeRefView
  readonly to: ChallengeRefView | null
  readonly lengthMin: number
  readonly label: string
  readonly bucket: string
  readonly status: 'pending' | 'accepted' | 'played' | 'declined' | 'cancelled' | 'expired'
  readonly createdAt: number
  readonly expiresAt: number
  readonly takenBy: ChallengeRefView | null
  readonly lastOffer: 'expired' | 'declined' | null
  readonly match: { readonly id: string; readonly status: string; readonly result: string | null; readonly winner: string | null } | null
}

/**
 * W6b: the challenge box as this session draws it. No challenge message is ever here (`$.state`
 * is readable by every plugin): messages live in a module variable in register.tsx, and `rev`
 * moves whenever they or the inbox change, so the pane redraws. The challenges themselves are
 * challenges.ts's `Challenge`, which has no message.
 */
export type ChallengeUi = {
  rev: number
  /** The inbox as last read (this session's, or another session's from the store); null before one. */
  incoming: ChallengeView[] | null
  outgoing: ChallengeView[] | null
  /** The form: closed, or open for a handle or an open challenge, with the length and bucket picked. */
  form: { kind: 'handle' | 'open'; handle: string; lengthMin: number | null; bucket: string | null } | null
  /** A code or link looked up: its code, the challenge once read (null while checking), or why not. */
  code: { code: string; challenge: ChallengeView | null; problem: string } | null
  /** The box's note: a refusal's message, or what a press did. */
  note: string
  /** The challenge whose Mute or Report was pressed once (the second press, or a reason, does it). */
  muteAsk: string | null
  reportAsk: string | null
}

/**
 * W10b: the Finishers view as this session draws it: `GET /me/finishers` as last read for
 * `key` (`<server url>|<handle>`; null before a read), whether a read or a pick is out, and the
 * view's note (a refusal's message, or why there is nothing to pick).
 */
export type FinisherUi = {
  key: string
  me: { callout: string | null; accent: string; accents: { key: string; unlocked: boolean; tier: string | null }[] } | null
  busy: boolean
  note: string
}

/** A score badge for the Bash row that ran git commit, keyed by its tool_use_id. */
export type CommitBadge = { sha: string; status: 'scoring' | 'done'; where: 'grind' | 'match' | 'waiting'; points?: number; base?: number; category?: string; craft?: Craft; reason?: string }

// Inside this block `Shaped` is the engine's own type (claude-code's Shaped<T>);
// the contract must not import anything.
declare module 'claude-code' {
  interface PluginState {
    ccsr: {
      tab: Tab
      period: Period
      ledger: Shaped<ScoredCommit[]>
      weekTotals: WeekTotals
      settings: ModSettings
      scan: Shaped<ScanStatus>
      sessions: Shaped<PastSession[]>
      sessionsNote: string
      backtests: Shaped<Record<string, BacktestRun>>
      match: Shaped<Match | null>
      history: Shaped<Match[]>
      now: number
      rating: number
      record: Record3
      trackingSince: number
      expanded: string | null
      btLimit: number
      labNote: string
      /** The match chat box's text: kept here so the once-a-second redraw in a match doesn't wipe typing, and cleared on Send. */
      chatDraft: string
      link: LinkState
      badges: Record<string, CommitBadge>
      /** Points scored during a turn, by the turn's durationMs, for the terminal's end-of-turn line. */
      turnMarks: Record<string, number>
      /** Uncommitted files in this session's repo, checked in the last 10 minutes of a match. */
      dirty: { repo: string; files: number } | null
      /** Forfeit was pressed once: the pane asks to confirm before it costs rating. */
      forfeitAsk: boolean
      /** W3b: the bucket the Ranked tab's and the Grind tab's boards show (null is Open), picked from their bucket rows. */
      boardPick: { ranked: string | null; grind: string | null }
      /** W6b: the challenge box (no challenge message is ever in it: see ChallengeUi). */
      challengeUi: ChallengeUi
      joinMode: 'new' | 'link' | 'recover'
      /** The server's config (GET /config) for this server and handle; configOf in register.tsx reads it. */
      config: Shaped<ConfigState>
      /**
       * W5b: moves on every change of the sign-in card, so the pane redraws. The card itself is a
       * module variable in register.tsx, never state: it holds the code the player types on the
       * provider's page, and every plugin can read `$.state`.
       */
      signinRev: number
      /** W5b: the Settings row's note (unlinked, or why not), whether the card's code was copied, and Unlink's first press. */
      signinUi: { note: string; copied: boolean; unlinkAsk: boolean }
      /** W4b: moves when this session's notices change (a trigger, a press, a dismissal, a flash), so what draws them draws again. */
      noticeRev: number
      /** W10b: moves when a finisher starts, replays or settles on its last frame, so the result redraws on time. Which ones played lives in the store (`finisherSeen`). */
      finisherRev: number
      /** W10b: the Finishers view (FinisherUi). */
      finisherUi: FinisherUi
      /**
       * W10e: moves on every change of the custom finishers' state (the draft's check, your art,
       * the gallery, a result's art), which lives in register.tsx's module memory, never state:
       * other players' art, titles and handles are in it, and every plugin can read `$.state`.
       */
      customRev: number
    }
  }
}
