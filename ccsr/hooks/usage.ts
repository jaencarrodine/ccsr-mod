// Usage weeks (the usage lift study), dark behind config's `eval_weeks`: how much this install
// used Claude Code in the four weeks before the account's first install and in each week since,
// so the same player's before and after can be compared. Pure: no `$` here. register.tsx runs
// the script (`$.process.run`), asks the server for the anchor and posts the rows.
//
// What leaves the machine, per week and nothing finer: the week's number counted from the
// anchor, how many of its days the transcripts here can speak for, on how many of them Claude
// Code answered at all, and four token counts. Never a model, a client, a repo, a path, a
// session, a time of day or a date: the server knows the anchor, so a week number is enough.
//
// Where the counts come from: Claude Code's own transcripts under this config dir, the same
// files the transcript fallback reads (transcripts.ts), by the same rules: one count per
// message id (the largest any of its entries carries), `<synthetic>` entries skipped, only the
// top-level usage totals. `$.fs.read` stops at 4 MiB and a busy month is gigabytes, so `sh`
// does the reading: grep keeps the entries that carry a usage object, awk takes the id, the
// minute and the four counts from each, sort brings an id's entries together, and a second awk
// keeps one count per id and adds them up in ten-minute steps. Only those sums reach the mod.
//
// Coverage, so a quiet week is never a guess. Claude Code sweeps a session's transcript once
// it is older than `cleanupPeriodDays` (30 by default), and its subagents' files with it. It
// never sweeps a session the desktop app started, whatever its age (read from Claude Code
// 2.1.296), so an old transcript proves nothing by being there. A day counts only when it is
// newer than both of these: the setting less a day (`retentionDays`, from the config dir's
// settings.json), and the oldest transcript the sweep could have taken and didn't (`cover`:
// a session's own file whose first and last entries name an entrypoint other than the desktop
// app's). A day before that is unknown, never zero: its week sends fewer `days`, or no row.
// Not seen at all: a desktop session the player deleted by hand, at any age.
//
// The rules:
//   - Only whole weeks, counted from the anchor the server holds (the account's first
//     install): weeks -4 to -1 are the baseline, 0 and up are since. Each is sent once.
//   - Only while capture is on (coder.ts `captureOn`, Model stats not off) and config's
//     `eval_weeks` is. Model stats off stops it, and the server erases what it kept.
//   - Read at install, sent after a finished match (Jaen, 2026-10-12). The baseline is read
//     as soon as the switches are on, while the transcripts still reach back four weeks, and
//     its weekly totals wait in this install's store (`held`). Nothing is posted until GET
//     /me, asked right before the post with the token the weeks were read under, says the
//     account has a match played and Model stats isn't off: by then the setup pane and
//     Settings have said what will go. The server keeps a week only for an account with a
//     finished match, whatever a mod sends.
//   - A read that isn't whole sends nothing: every stage of the script reports how it ended,
//     and one that failed (a file that can't be read, a full disk) is a failure, never zeros.
//   - One session per machine at a time, and a failure waits USAGE_RETRY_MS. A machine with no
//     `sh` never sends a row.
//   - `eval_usage` was this switch's first name, and POST /usage's `v: 1` its first body. The
//     mods that shipped with them (0.5.2 to 0.5.7) sent the baseline at Join, so both are
//     retired: the server serves no `eval_usage` and keeps no `v: 1` body, and those mods stay
//     silent.

import type { Tokens } from './coder'

/** POST /usage's body version. 2: from a mod that holds its weeks until a finished match (the server keeps nothing from 1). */
export const USAGE_V = 2
export const DAY_MS = 86_400_000
export const WEEK_MS = 7 * DAY_MS
/** The weeks before the anchor that make the baseline: -4 to -1. */
export const BASELINE_WEEKS = 4
/** How far back one run reads, in days: the baseline, and five weeks an install may have gone unread. Weeks that start before it are passed over. */
export const READ_DAYS_MAX = 63
/** At most this many weeks in one post (the server's limit too). */
export const WEEKS_PER_POST = 60
/** The script's time limit: `$.process.run`'s most. A month of a busy machine reads in under two minutes. */
export const USAGE_TIMEOUT_MS = 600_000
/** A run still going holds the slot this long, past its own limit, so a session that ends mid-run frees it. */
export const USAGE_FLIGHT_MS = 12 * 60_000
/** A run or a post that failed is tried again this long after. */
export const USAGE_RETRY_MS = 6 * 3_600_000
/** Claude Code's `cleanupPeriodDays` when settings.json doesn't say. */
export const RETENTION_DAYS = 30
/** A session stops trying after this many failures in a row (and at the first one that says it can't run `sh` at all). */
export const USAGE_STRIKES = 3
/** The most a week's count may be: the server's TOKENS_MAX. */
const COUNT_MAX = 1_000_000_000_000

/**
 * The read. `$1` is the transcripts folder, `$2` how many days back to read, `$3` how many
 * days back to look for the oldest transcript the sweep could have taken. Prints, in any
 * order before `end`:
 *   b <YYYY-MM-DDTHH:M> <input> <output> <cache_read> <cache_write>   one ten-minute step (UTC)
 *   f <status>, a <status>, s <status>                                how find and grep, the first awk and sort ended
 *   scan                                                              the last awk reached its end
 *   cover <days>|none                                                 a sweepable transcript at least this old is still there; none: there are transcripts and none is sweepable; 0 with no transcript, or no folder, at all
 *   end
 * POSIX sh, find, grep, awk, sort and head only, bytes not characters (LC_ALL=C), and no awk
 * feature past POSIX: it runs under macOS's awk, gawk, mawk and busybox the same. It writes
 * no file: its only redirections are errors to /dev/null and the stages' statuses to the
 * script's own output (fd 3). The reading stages run under `nice -n 19` where there is a
 * `nice`: a month of a busy machine is a minute or two of one core, and it should be the
 * last thing that core does.
 *
 * A pipeline's own status is its last command's, so each earlier stage says how it ended.
 * grep runs through `sh -c` so that "no match in these files" (1) passes and "couldn't read
 * one" (2) fails find; a file that vanished mid-read fails it too, and the run is tried again.
 *
 * The first awk, per entry with a usage object: skip a tool result (a subagent's result
 * repeats its usage) and a `<synthetic>` entry; the id is the first `"id":"msg_` in the entry's
 * first 4000 bytes; the usage object is the last one in the line that starts with
 * `input_tokens` (else the last one), since content comes before it; nested objects are cut
 * out of it so only its own keys are read (`iterations[]` repeats them); the minute is the
 * `timestamp` after it, else the entry's first.
 *
 * `cover`: only a session's own file counts (two levels down, never a subagent's, which stays
 * as long as its session does), and only one whose first entrypoint (in its first 64 KiB) and
 * last (in its last 64 KiB) are both named and neither is the desktop app's
 * (`claude-desktop`, `claude-desktop-3p`, `local-agent`, `local_agent`: Claude Code never
 * sweeps those by age, and a terminal session carried on in the desktop app is one of them).
 * A file that names none at either end is passed over. At most 200 files are looked
 * at per day of age, oldest ages first, and each file once. With no transcript there at all
 * (or no folder) nothing can be said, and that is `cover 0`: no day counts.
 */
export const USAGE_SCRIPT = String.raw`
LC_ALL=C
export LC_ALL
cd "$1" 2>/dev/null || { echo "f 0"; echo "a 0"; echo "s 0"; echo scan; echo "cover 0"; echo end; exit 0; }
low=
if command -v nice >/dev/null 2>&1; then low="nice -n 19"; fi
{
  { $low find . -name '*.jsonl' -type f -mtime -"$2" -exec sh -c 'grep -a -h "$0" "$@"; [ "$?" -le 1 ]' '"usage":{' {} + 2>/dev/null; echo "f $?" >&3; } |
  { $low awk '
function num(u, key,   i, v) {
  i = index(u, "\"" key "\":")
  if (!i) return 0
  v = substr(u, i + length(key) + 3, 16)
  return match(v, /^[0-9]+/) ? substr(v, 1, RLENGTH) : 0
}
index($0, "\"toolUseResult\":") > 0 { next }
{
  head = substr($0, 1, 4000)
  if (index(head, "\"model\":\"<synthetic>\"") > 0) next
  i = index(head, "\"id\":\"msg_")
  if (!i) next
  id = substr(head, i + 6, 140)
  j = index(id, "\"")
  if (j < 2) next
  id = substr(id, 1, j - 1)
  if (id !~ /^[A-Za-z0-9_-]+$/) next
  s = $0
  k = 0
  while ((i = index(s, "\"usage\":{\"input_tokens\":")) > 0) { s = substr(s, i + 9); k = 1 }
  if (!k) while ((i = index(s, "\"usage\":{")) > 0) { s = substr(s, i + 9); k = 1 }
  if (!k) next
  i = index(s, "\"timestamp\":\"")
  if (i) t = substr(s, i + 13, 16)
  else {
    i = index($0, "\"timestamp\":\"")
    if (!i) next
    t = substr($0, i + 13, 16)
  }
  if (t !~ /^[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]$/) next
  u = substr(s, 1, 20000)
  while (gsub(/[{][^{}]*[}]/, "", u)) ;
  i = index(u, "}")
  if (i) u = substr(u, 1, i - 1)
  print id, t, num(u, "input_tokens"), num(u, "output_tokens"), num(u, "cache_read_input_tokens"), num(u, "cache_creation_input_tokens")
}'; echo "a $?" >&3; } |
  { $low sort; echo "s $?" >&3; } |
  $low awk '
function flush(   b) {
  if (id == "") return
  b = substr(t, 1, 15)
  if (!(b in seen)) { seen[b] = 1; order[++n] = b }
  a[b] += ti; o[b] += to; r[b] += tr; w[b] += tw
}
{
  if ($1 != id) { flush(); id = $1; t = $2; ti = $3 + 0; to = $4 + 0; tr = $5 + 0; tw = $6 + 0; next }
  if ($2 > t) t = $2
  if ($3 + 0 > ti) ti = $3 + 0
  if ($4 + 0 > to) to = $4 + 0
  if ($5 + 0 > tr) tr = $5 + 0
  if ($6 + 0 > tw) tw = $6 + 0
}
END {
  flush()
  for (x = 1; x <= n; x++) printf "b %s %.0f %.0f %.0f %.0f\n", order[x], a[order[x]], o[order[x]], r[order[x]], w[order[x]]
  print "scan"
}'
} 3>&1
sweepable() {
  for e in "$(head -c 65536 "$1" 2>/dev/null | grep -a -o -m1 '"entrypoint":"[^"]*"' | head -n 1)" "$(tail -c 65536 "$1" 2>/dev/null | grep -a -o '"entrypoint":"[^"]*"' | tail -n 1)"; do
    case "$e" in
      ''|'"entrypoint":"claude-desktop"'|'"entrypoint":"claude-desktop-3p"'|'"entrypoint":"local-agent"'|'"entrypoint":"local_agent"') return 1 ;;
    esac
  done
  return 0
}
probe() {
  find . -maxdepth 2 -name '*.jsonl' -type f -mtime "$1" 2>/dev/null | head -n 200 | while IFS= read -r f; do
    if sweepable "$f"; then echo y; break; fi
  done
}
c=none
n="$3"
if [ -n "$(probe "+$n")" ]; then c=$((n + 1)); else
  while [ "$n" -ge 0 ]; do
    if [ -n "$(probe "$n")" ]; then c="$n"; break; fi
    n=$((n - 1))
  done
fi
if [ "$c" = none ] && [ -z "$(find . -maxdepth 2 -name '*.jsonl' -type f 2>/dev/null | head -n 1)" ]; then c=0; fi
echo "cover $c"
echo end
`

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Config's `eval_weeks`: only `true` is on (a missing key, a server before it, is off). `eval_usage`, its first name, is never read. */
export function usageOn(raw: unknown): boolean {
  return isObject(raw) && raw.eval_weeks === true
}

/** One ten-minute step of the read: when it starts (ms) and what Claude Code spent in it. */
export type UsageStep = { at: number; tokens: Tokens }
/**
 * What the script printed: the steps, and how old (in whole days) the oldest transcript is
 * that the sweep could have taken and didn't. Null: no such transcript is there at all, so
 * only the setting speaks for what was kept.
 */
export type UsageRead = { steps: UsageStep[]; sweepDays: number | null }

const STEP = /^b (\d{4}-\d{2}-\d{2}T\d{2}:\d) (\d{1,15}) (\d{1,15}) (\d{1,15}) (\d{1,15})$/

/**
 * The script's output, or null when it isn't whole: find and grep, the first awk and sort
 * must each have ended well (`f 0`, `a 0`, `s 0`), and `scan`, `cover` and `end` must all be
 * there. So a cut output, a script that died halfway, a file grep couldn't read and a sort
 * with no room are all no read, never a read of nothing. A line it can't read is passed over.
 */
export function readUsage(stdout: string): UsageRead | null {
  const steps: UsageStep[] = []
  const ok = { f: false, a: false, s: false, scan: false, end: false }
  let cover: number | null | undefined
  for (const line of stdout.split('\n')) {
    if (line === 'f 0') ok.f = true
    else if (line === 'a 0') ok.a = true
    else if (line === 's 0') ok.s = true
    else if (line === 'scan') ok.scan = true
    else if (line === 'end') ok.end = true
    else if (line === 'cover none') cover = null
    else if (line.startsWith('cover ')) {
      const n = Number(line.slice(6))
      if (/^\d{1,6}$/.test(line.slice(6)) && Number.isInteger(n)) cover = n
    } else {
      const m = STEP.exec(line)
      if (!m) continue
      const at = Date.parse(`${m[1]}0:00Z`)
      if (!Number.isFinite(at)) continue
      steps.push({ at, tokens: { input: Number(m[2]), output: Number(m[3]), cache_read: Number(m[4]), cache_write: Number(m[5]) } })
    }
  }
  return ok.f && ok.a && ok.s && ok.scan && ok.end && cover !== undefined ? { steps, sweepDays: cover } : null
}

/**
 * Claude Code's `cleanupPeriodDays` from the config dir's settings.json: how long a swept
 * session's transcript is kept. RETENTION_DAYS when the file is missing, doesn't parse or
 * doesn't say; 0 for a setting that keeps nothing.
 */
export function retentionDays(settingsText: string | null | undefined): number {
  if (typeof settingsText !== 'string') return RETENTION_DAYS
  try {
    const v = (JSON.parse(settingsText) as { cleanupPeriodDays?: unknown } | null)?.cleanupPeriodDays
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.min(100_000, Math.floor(v)) : RETENTION_DAYS
  } catch {
    return RETENTION_DAYS
  }
}

/**
 * How many days back the read can speak for: the setting less a day, and no further than the
 * oldest transcript the sweep could have taken and didn't (`sweepDays`), when there is one.
 * Both must hold: the setting alone would claim days swept before it was raised, and an old
 * transcript alone would claim days on a machine whose setting we couldn't read.
 */
export function coverDays(read: Pick<UsageRead, 'sweepDays'>, retention: number): number {
  const kept = Math.max(0, Math.floor(retention) - 1)
  return read.sweepDays === null ? kept : Math.max(0, Math.min(kept, read.sweepDays))
}

/** When week `week` starts: weeks are counted from the anchor, seven days each. */
export function weekStart(anchor: number, week: number) {
  return anchor + week * WEEK_MS
}

/** The newest week that is over at `now`: -1 until the anchor is a week old. */
export function lastWholeWeek(anchor: number, now: number) {
  return Math.floor((now - anchor) / WEEK_MS) - 1
}

/** One run: the weeks it speaks for and how many days back the script reads. */
export type UsagePlan = { first: number; last: number; readDays: number }

/**
 * The next run, or null when no week is waiting. `through` is the newest week already
 * handled (null: none, so the baseline is first). `now` is the server's time (the anchor is
 * the server's): the local clock plus the config read's skew. Weeks that start more than
 * READ_DAYS_MAX days ago are passed over.
 */
export function usagePlan(o: { anchor: number; through: number | null; now: number }): UsagePlan | null {
  if (!Number.isFinite(o.anchor) || !Number.isFinite(o.now) || o.now < o.anchor) return null
  const last = lastWholeWeek(o.anchor, o.now)
  let first = Math.max(o.through === null ? -BASELINE_WEEKS : o.through + 1, -BASELINE_WEEKS)
  if (last < first) return null
  first = Math.max(first, Math.ceil((o.now - READ_DAYS_MAX * DAY_MS - o.anchor) / WEEK_MS))
  const readDays = first > last ? 0 : Math.min(READ_DAYS_MAX, Math.ceil((o.now - weekStart(o.anchor, first)) / DAY_MS)) + 1
  return { first, last, readDays }
}

/** A week as sent. */
export type UsageWeek = { week: number; days: number; active_days: number; tokens: Tokens }

/**
 * The rows for a run's weeks. `now` is when the script ended and `cover` how many days back
 * from then the read can speak for (`coverDays`): every day that starts at or after
 * `now - cover` is whole. A week with no such day gets no row. A step counts in the day it
 * starts in, and a day with a step is an active one.
 */
export function usageWeeks(read: UsageRead, o: { anchor: number; first: number; last: number; now: number; cover: number }): UsageWeek[] {
  const cover = o.now - Math.max(0, o.cover) * DAY_MS
  const rows: UsageWeek[] = []
  for (let week = o.first; week <= o.last && rows.length < WEEKS_PER_POST; week++) {
    const start = weekStart(o.anchor, week)
    const tokens: Tokens = { input: 0, output: 0, cache_read: 0, cache_write: 0 }
    let days = 0
    let active = 0
    for (let d = 0; d < 7; d++) {
      const from = start + d * DAY_MS
      if (from < cover || from + DAY_MS > o.now) continue
      days++
      let any = false
      for (const s of read.steps) {
        if (s.at < from || s.at >= from + DAY_MS) continue
        any = true
        tokens.input = Math.min(COUNT_MAX, tokens.input + s.tokens.input)
        tokens.output = Math.min(COUNT_MAX, tokens.output + s.tokens.output)
        tokens.cache_read = Math.min(COUNT_MAX, tokens.cache_read + s.tokens.cache_read)
        tokens.cache_write = Math.min(COUNT_MAX, tokens.cache_write + s.tokens.cache_write)
      }
      if (any) active++
    }
    if (days > 0) rows.push({ week, days, active_days: active, tokens })
  }
  return rows
}

/** POST /usage's body: keys exactly `v, weeks`, each week exactly `week, days, active_days, tokens`. */
export function usageBody(rows: readonly UsageWeek[]) {
  return { v: USAGE_V, weeks: rows.map(r => ({ week: r.week, days: r.days, active_days: r.active_days, tokens: { input: r.tokens.input, output: r.tokens.output, cache_read: r.tokens.cache_read, cache_write: r.tokens.cache_write } })) }
}

/**
 * GET /usage's or POST /usage's answer: the anchor (ms) and the newest week the server holds
 * for this install (null: none). Null when it can't be read.
 */
export function usageAnswer(json: unknown): { anchor: number; through: number | null } | null {
  if (!isObject(json) || typeof json.anchor !== 'string') return null
  const anchor = Date.parse(json.anchor)
  if (!Number.isFinite(anchor)) return null
  const through = typeof json.through === 'number' && Number.isInteger(json.through) && json.through >= -BASELINE_WEEKS && json.through <= 100_000 ? json.through : null
  return { anchor, through }
}

/** The most weeks an install holds while it waits for a finished match: more than a year of them. Past it the oldest go. */
export const HELD_MAX = WEEKS_PER_POST

/**
 * The store's `usage`: for which account (`<server url>|<handle>`), its anchor, the newest
 * week read here, the weeks read and not sent yet (`held`: weekly totals only, waiting for the
 * account's first finished match, or for a post that went through), the week the server last
 * kept less of than was sent (tried once more, then let go), when a run last began and when
 * one last failed. Anything unreadable, or another account's, is a fresh start.
 */
export type UsageState = { key: string; anchor: number | null; through: number | null; held: UsageWeek[]; again: number | null; tried: number; failed: number }

/** A held week as the store gave it back, or null: exactly the numbers a row carries, each in range. */
function heldWeek(raw: unknown): UsageWeek | null {
  if (!isObject(raw) || !isObject(raw.tokens)) return null
  const whole = (v: unknown, min: number, max: number) => (typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max ? v : null)
  const week = whole(raw.week, -BASELINE_WEEKS, 100_000)
  const days = whole(raw.days, 1, 7)
  const active = whole(raw.active_days, 0, 7)
  const t = raw.tokens
  const tokens = { input: whole(t.input, 0, COUNT_MAX), output: whole(t.output, 0, COUNT_MAX), cache_read: whole(t.cache_read, 0, COUNT_MAX), cache_write: whole(t.cache_write, 0, COUNT_MAX) }
  if (week === null || days === null || active === null || active > days) return null
  if (tokens.input === null || tokens.output === null || tokens.cache_read === null || tokens.cache_write === null) return null
  return { week, days, active_days: active, tokens: tokens as Tokens }
}

/**
 * `rows` joined to the weeks already held: one row per week (a newer read of a week replaces
 * the held one only when it covers more of its days), oldest first, the newest HELD_MAX kept.
 */
export function holdWeeks(held: readonly UsageWeek[], rows: readonly UsageWeek[]): UsageWeek[] {
  const by = new Map<number, UsageWeek>()
  for (const r of [...held, ...rows]) {
    const had = by.get(r.week)
    if (!had || r.days > had.days) by.set(r.week, r)
  }
  return [...by.values()].sort((a, b) => a.week - b.week).slice(-HELD_MAX)
}

export function usageState(raw: unknown, key: string): UsageState {
  const fresh: UsageState = { key, anchor: null, through: null, held: [], again: null, tried: 0, failed: 0 }
  if (!isObject(raw) || raw.key !== key) return fresh
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  const week = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= -BASELINE_WEEKS ? v : null)
  return {
    key,
    anchor: typeof raw.anchor === 'number' && Number.isFinite(raw.anchor) && raw.anchor > 0 ? raw.anchor : null,
    through: week(raw.through),
    held: holdWeeks([], (Array.isArray(raw.held) ? raw.held : []).map(heldWeek).filter((w): w is UsageWeek => w !== null)),
    again: week(raw.again),
    tried: n(raw.tried),
    failed: n(raw.failed),
  }
}

/**
 * Whether a pass is due. `now` is the local clock (the stamps are local) and `serverNow` the
 * server's time (the anchor is the server's). `played`: the account has a finished match, as
 * the server's own GET /me last said. Due when no run is in flight, the last failure is old
 * enough, and there is something to do: the anchor to ask for, a week to read, or held weeks
 * the account may now send. Held weeks alone, before a finished match, are nothing to do.
 */
export function usageDue(s: UsageState, o: { now: number; serverNow?: number; played: boolean }): boolean {
  if (o.now - s.tried < USAGE_FLIGHT_MS) return false
  if (o.now - s.failed < USAGE_RETRY_MS) return false
  if (s.anchor === null) return true
  return usagePlan({ anchor: s.anchor, through: s.through, now: o.serverNow ?? o.now }) !== null || (o.played && s.held.length > 0)
}

/**
 * After a post of the held weeks: the server answered with the newest week it holds for this
 * install. When that is older than the newest week sent, it kept less than it was given (its
 * clock says the week isn't over yet, or a switch moved under the post, or it sees no finished
 * match yet). The first time for a week, the held weeks stay and are sent once more on a
 * later run; the second time they are let go, so a week the server will never keep (Model
 * stats changed since it began) costs one more post, not one every six hours for good.
 */
export function afterPost(s: UsageState, o: { sent: number; held: number | null }): { state: UsageState; again: boolean } {
  const short = o.held === null || o.held < o.sent
  if (short && s.again !== o.sent) return { state: { ...s, again: o.sent }, again: true }
  return { state: { ...s, held: [], again: null }, again: false }
}

/**
 * A failure worth another try on this machine (the script ran and exited badly, ran out of
 * time, or its output wasn't whole), as repos.ts's `isTransientLookFailure` reads the engine's
 * words. Anything else means `sh` can't start here, and the session stops trying.
 */
export function isTransientUsageFailure(message: string) {
  return /^sh exited \d+$/.test(message) || message === 'output not whole' || /tim(e|ed) ?out|still running after/i.test(message)
}
