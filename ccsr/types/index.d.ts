// CCSR mod: the values it keeps in $.state, and the shapes they hold.

export type Tab = 'match' | 'ranked' | 'grind' | 'chat' | 'backtest' | 'lab' | 'settings'

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
  chat: 'on' | 'off'
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
export type ApiLength = 1 | 3

export type ApiPlayerRef = { handle: string; rating: number; tier: ApiTier; is_top_100: boolean; placement: { played: number; of: number } | null }
export type ApiPlayer = ApiPlayerRef & { matches_played: number; record: { w: number; l: number; d: number }; chat_enabled: boolean; joined_at: string }
export type ApiSeason = { id: string; model: string; rubric: string; starts_at: string; ends_at: string | null; tiers: { name: ApiTier; min: number }[] }

export type ApiOffer = {
  match_id: string
  length: ApiLength
  opponent: ApiPlayerRef
  opponent_record: { w: number; l: number; d: number }
  opponent_rank: number | null
  stakes: { win: number; draw: number; loss: number }
  expires_at: string
  you_accepted: boolean
}

export type ApiQueueState = {
  status: 'idle' | 'queued' | 'offered'
  offer: ApiOffer | null
  wait_ms: number | null
  range: { min: number; max: number } | null
  widening: { after_ms: number; range: { min: number; max: number } }[] | null
  per_length: Record<'1' | '3', { waiting: number; wait_ms: number | null; ratings: number[] }>
  cancelled: { reason: 'opponent_declined' | 'opponent_expired' | 'you_expired' | 'update_required' } | null
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
  length: ApiLength
  status: ApiMatchStatus
  started_at: string | null
  deadline: string | null
  ended_at: string | null
  sides: [ApiMatchSide, ApiMatchSide]
  winner: string | null
  result: 'win' | 'draw' | 'forfeit' | 'void' | null
  latest: ApiFeedItem | null
  spectators: number
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

/** The server connection as the mod keeps it in `$.store`. */
export type ServerConfig = { url: string; token: string | null; handle: string | null }

/** A ranked match as the mod follows it: the summary from the last poll, the feed and chat so far, the cursor. */
export type RankedMatch = { id: string; summary: ApiMatchSummary | null; events: ApiMatchEvent[]; cursor: number; polledAt: number }


export type ApiRankedRow = { rank: number; player: ApiPlayerRef; w: number; l: number; d: number; matches_played: number }
export type ApiRoom = 'world' | 'mud' | 'iron' | 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' | 'master'
export type ApiLobbyItem =
  | { seq: number; kind: 'chat'; at: string; room: ApiRoom; player: ApiPlayerRef; rank: number | null; text: string }
  | { seq: number; kind: 'system'; at: string; room: ApiRoom; event: 'placed' | 'promoted' | 'reached_number_one'; handle: string; tier: ApiTier }

/** Where this player is in ranked, shared by every session through the store. */
export type RankedShared = { phase: 'idle' | 'queued' | 'offered' | 'live' | 'done'; matchId: string | null; lengths: (1 | 3)[]; since: number }

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
  ranked: RankedMatch | null
  /** The Ranked board's top 10, your rank on it, and how many play the Grind this week. */
  ladder: ApiRankedRow[] | null
  myRank: number | null
  grindOf: number | null
  /** The chat rooms: which exist, who's in them, where you can post; the room on screen and its lines. */
  rooms: { room: ApiRoom; online: number; can_post: boolean }[] | null
  room: ApiRoom
  lobby: { room: ApiRoom; events: ApiLobbyItem[]; cursor: number } | null
  /** Your last ranked matches from your profile, newest first, for the Match tab. */
  recent: ApiRecentMatch[] | null
  /** The mod's release line from the server's x-ccsr-latest and x-ccsr-min headers; null until a server sends it. */
  release: { latest: string; min: string } | null
  /** What the last Update press did. */
  updateNote: string
}

export type ApiRecentMatch = {
  id: string
  opponent: ApiPlayerRef
  length: ApiLength
  result: 'win' | 'loss' | 'draw' | 'forfeit' | 'void'
  score: [number, number]
  delta: number
  ended_at: string
  series: [number[], number[]]
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
    }
  }
}
