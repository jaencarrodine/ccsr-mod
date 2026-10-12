// Usage weeks (the usage lift study), dark behind config's `eval_usage`: how much this install
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
// Coverage, so a quiet week is never a guess: Claude Code deletes transcripts by age, oldest
// first, so a transcript last written N days ago proves nothing newer than it was deleted.
// The script says how old the oldest one is (`cover`), and a day counts only when it starts
// after that. A day before it is unknown, never zero: its week sends fewer `days`, or no row.
//
// The rules:
//   - Only whole weeks, counted from the anchor the server holds (the account's first
//     install): weeks -4 to -1 are the baseline, 0 and up are since. Each is sent once.
//   - Only while capture is on (coder.ts `captureOn`, Model stats not off) and config's
//     `eval_usage` is. Model stats off stops it, and the server erases what it kept.
//   - One session per machine at a time, and a failure waits USAGE_RETRY_MS. A machine with no
//     `sh` never sends a row.

import type { Tokens } from './coder'

export const USAGE_V = 1
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
/** A session stops trying after this many failures in a row (and at the first one that says it can't run `sh` at all). */
export const USAGE_STRIKES = 3
/** The most a week's count may be: the server's TOKENS_MAX. */
const COUNT_MAX = 1_000_000_000_000

/**
 * The read. `$1` is the transcripts folder, `$2` how many days back to read, `$3` how many
 * days back to look for the oldest transcript. Prints, in any order before `end`:
 *   b <YYYY-MM-DDTHH:M> <input> <output> <cache_read> <cache_write>   one ten-minute step (UTC)
 *   scan                                                              the sums are whole
 *   cover <days>                                                      a transcript at least this old is still there
 *   end
 * POSIX sh, find, grep, awk and sort only, bytes not characters (LC_ALL=C), and no awk
 * feature past POSIX: it runs under macOS's awk, gawk, mawk and busybox the same.
 *
 * The first awk, per entry with a usage object: skip a tool result (a subagent's result
 * repeats its usage) and a `<synthetic>` entry; the id is the first `"id":"msg_` in the entry's
 * first 4000 bytes; the usage object is the last one in the line that starts with
 * `input_tokens` (else the last one), since content comes before it; nested objects are cut
 * out of it so only its own keys are read (`iterations[]` repeats them); the minute is the
 * `timestamp` after it, else the entry's first.
 */
export const USAGE_SCRIPT = String.raw`
LC_ALL=C
export LC_ALL
cd "$1" 2>/dev/null || { echo scan; echo "cover 0"; echo end; exit 0; }
find . -name '*.jsonl' -type f -mtime -"$2" -exec grep -a -h '"usage":{' {} + 2>/dev/null | awk '
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
}' | sort | awk '
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
n="$3"
while [ "$n" -ge 0 ]; do
  if [ -n "$(find . -name '*.jsonl' -type f -mtime +"$n" 2>/dev/null | head -n 1)" ]; then break; fi
  n=$((n - 1))
done
echo "cover $((n + 1))"
echo end
`

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** Config's `eval_usage`: only `true` is on (a missing key, a server before it, is off). */
export function usageOn(raw: unknown): boolean {
  return isObject(raw) && raw.eval_usage === true
}

/** One ten-minute step of the read: when it starts (ms) and what Claude Code spent in it. */
export type UsageStep = { at: number; tokens: Tokens }
/** What the script printed: the steps, and how many days back the oldest transcript proves nothing was deleted. */
export type UsageRead = { steps: UsageStep[]; coverDays: number }

const STEP = /^b (\d{4}-\d{2}-\d{2}T\d{2}:\d) (\d{1,15}) (\d{1,15}) (\d{1,15}) (\d{1,15})$/

/**
 * The script's output, or null when it isn't whole: `scan`, `cover` and `end` must all be
 * there (a cut output, a script that died halfway). A line it can't read is passed over.
 */
export function readUsage(stdout: string): UsageRead | null {
  const steps: UsageStep[] = []
  let scanned = false
  let ended = false
  let coverDays: number | null = null
  for (const line of stdout.split('\n')) {
    if (line === 'scan') scanned = true
    else if (line === 'end') ended = true
    else if (line.startsWith('cover ')) {
      const n = Number(line.slice(6))
      if (Number.isInteger(n) && n >= 0 && n <= 100_000) coverDays = n
    } else {
      const m = STEP.exec(line)
      if (!m) continue
      const at = Date.parse(`${m[1]}0:00Z`)
      if (!Number.isFinite(at)) continue
      steps.push({ at, tokens: { input: Number(m[2]), output: Number(m[3]), cache_read: Number(m[4]), cache_write: Number(m[5]) } })
    }
  }
  return scanned && ended && coverDays !== null ? { steps, coverDays } : null
}

/** When week `week` starts: weeks are counted from the anchor, seven days each. */
export function weekStart(anchor: number, week: number) {
  return anchor + week * WEEK_MS
}

/** The newest week that is over at `now`: -1 until the anchor is a week old. */
export function lastWholeWeek(anchor: number, now: number) {
  return Math.floor((now - anchor) / WEEK_MS) - 1
}

/** One run: the weeks it speaks for and what to hand the script. */
export type UsagePlan = { first: number; last: number; readDays: number; coverDays: number }

/**
 * The next run, or null when no week is waiting. `through` is the newest week already
 * handled (null: none, so the baseline is first). Weeks that start more than READ_DAYS_MAX
 * days ago are passed over: `first` is the oldest week the read can still reach, which may be
 * past `last`, and then there is nothing to read and `last` is simply handled.
 */
export function usagePlan(o: { anchor: number; through: number | null; now: number }): UsagePlan | null {
  if (!Number.isFinite(o.anchor) || !Number.isFinite(o.now) || o.now < o.anchor) return null
  const last = lastWholeWeek(o.anchor, o.now)
  let first = Math.max(o.through === null ? -BASELINE_WEEKS : o.through + 1, -BASELINE_WEEKS)
  if (last < first) return null
  first = Math.max(first, Math.ceil((o.now - READ_DAYS_MAX * DAY_MS - o.anchor) / WEEK_MS))
  const readDays = first > last ? 0 : Math.min(READ_DAYS_MAX, Math.ceil((o.now - weekStart(o.anchor, first)) / DAY_MS)) + 1
  return { first, last, readDays, coverDays: readDays }
}

/** A week as sent. */
export type UsageWeek = { week: number; days: number; active_days: number; tokens: Tokens }

/**
 * The rows for a run's weeks. `now` is when the script ended: a transcript at least
 * `coverDays` old was still there then, so every day that starts at or after
 * `now - coverDays` is whole. A week with no such day gets no row. A step counts in the day
 * it starts in, and a day with a step is an active one.
 */
export function usageWeeks(read: UsageRead, o: { anchor: number; first: number; last: number; now: number }): UsageWeek[] {
  const cover = o.now - read.coverDays * DAY_MS
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

/**
 * The store's `usage`: for which account (`<server url>|<handle>`), its anchor, the newest
 * week handled here, when a run last began and when one last failed. Anything unreadable,
 * or another account's, is a fresh start.
 */
export type UsageState = { key: string; anchor: number | null; through: number | null; tried: number; failed: number }

export function usageState(raw: unknown, key: string): UsageState {
  const fresh: UsageState = { key, anchor: null, through: null, tried: 0, failed: 0 }
  if (!isObject(raw) || raw.key !== key) return fresh
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0)
  return {
    key,
    anchor: typeof raw.anchor === 'number' && Number.isFinite(raw.anchor) && raw.anchor > 0 ? raw.anchor : null,
    through: typeof raw.through === 'number' && Number.isInteger(raw.through) && raw.through >= -BASELINE_WEEKS ? raw.through : null,
    tried: n(raw.tried),
    failed: n(raw.failed),
  }
}

/**
 * Whether a run is due at `now`: a week is waiting (or the anchor isn't known yet), no run is
 * in flight and the last failure is old enough.
 */
export function usageDue(s: UsageState, now: number): boolean {
  if (now - s.tried < USAGE_FLIGHT_MS) return false
  if (now - s.failed < USAGE_RETRY_MS) return false
  return s.anchor === null || usagePlan({ anchor: s.anchor, through: s.through, now }) !== null
}

/**
 * A failure worth another try on this machine (the script ran and exited badly, ran out of
 * time, or its output was cut), as repos.ts's `isTransientLookFailure` reads the engine's
 * words. Anything else means `sh` can't start here, and the session stops trying.
 */
export function isTransientUsageFailure(message: string) {
  return /^sh exited \d+$/.test(message) || message === 'output not whole' || /tim(e|ed) ?out|still running after/i.test(message)
}
