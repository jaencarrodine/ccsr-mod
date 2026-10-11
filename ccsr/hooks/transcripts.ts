// The transcript fallback (W7-3, build plan "Mod lane"), dark behind `eval_backfill`: for a
// commit with no live call record, the player's own Claude Code transcripts say which model
// answered. Pure: no `$` here. register.tsx's scan lists and reads the files (`$.fs`), and
// hands their text to `callsFromTranscript`; coder.ts's `coderBlocks` attributes the calls
// with `source: 'transcript'`, over the same windows as the live records (`windowsOf`). The
// calls stay in the scan's memory: never in the call records under ~/.ccsr/calls.
//
// A transcript is JSONL, one entry per line. Only keys and numbers are read from it:
//   - an assistant entry's `message.id`, `message.model` and `message.usage` counts, its
//     `timestamp`, `isSidechain`, `entrypoint` and `version`, and its `uuid`;
//   - a tool result entry's `toolUseResult.gitOperation.commit.sha` (Claude Code's own
//     classification of the Bash call), tied to the assistant entry that made the call
//     through `sourceToolAssistantUUID`, else `parentUuid`.
// Message text, tool input and output, thinking, paths, cwd, session ids and branch names are
// never read, and nothing read here leaves the machine except through the coder block.
//
// The rules:
//   - Dedupe by `message.id`: one response is written as several entries (one per content
//     block), each repeating its usage. Each count is the largest any of them carries.
//   - Skip `<synthetic>`: entries Claude Code writes itself (an API error, an interrupt) are
//     no model call.
//   - Never sum `usage.iterations[]` (coder.ts's `tokensOf` reads the top-level totals only).
//   - A subagent's file (`<session>/subagents/agent-*.jsonl`, or a workflow agent's,
//     `<session>/subagents/workflows/<run>/agent-*.jsonl`) is merged with the main one, and
//     its calls are `subagent`; so are sidechain entries in an older main file. A run's
//     `journal.jsonl` holds no model call and is never read.
//   - The scan reads at most FILES_PER_COMMIT files per commit and FILES_PER_SCAN per scan,
//     skips any file over FILE_MAX_BYTES, and finds them under CLAUDE_CONFIG_DIR, else
//     ~/.claude (`transcriptsDirOf`).
//   - Only while config's `eval_backfill` is on (`backfillOn`) and capture is (coder.ts's
//     `captureOn`, Model stats not off), and only for a commit whose live block is `none` or
//     missing. A window's vote counts only when every file that could hold one of its calls
//     was read (`readPlan`'s `complete`); a sha match counts whenever it is found.

import { clientOf, modelId, shasOf, tokensOf, versionOf, type Call, type Tokens } from './coder'

export const FILE_MAX_BYTES = 4 * 1024 * 1024
export const FILES_PER_COMMIT = 5
export const FILES_PER_SCAN = 20
/**
 * How long a subagent or a workflow run may keep writing after its session's own file last
 * changed (it runs in the background while the session sits idle): the scan lists the
 * subagent folders of every session written this long before a window opened, or since.
 */
export const BACKGROUND_MS = 24 * 3_600_000
/** At most this many sessions' subagent folders listed in one project folder for a window: past it, the window can't be read whole. */
export const SESSIONS_MAX = 20
/** At most this many folders of sessions started in a repo's subfolders looked at: past it, no window of that repo can be read whole. */
export const TWINS_MAX = 20
/** A message id, as the API writes it (`msg_...`). */
const MESSAGE_ID = /^[A-Za-z0-9_-]{1,128}$/
const UUID = /^[A-Za-z0-9-]{1,64}$/

/** A call as read from a transcript, with the message id it was deduped by. */
export type TranscriptCall = Call & { id: string }

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function maxTokens(a: Tokens, b: Tokens): Tokens {
  return { input: Math.max(a.input, b.input), output: Math.max(a.output, b.output), cache_read: Math.max(a.cache_read, b.cache_read), cache_write: Math.max(a.cache_write, b.cache_write) }
}

function merge(a: TranscriptCall, b: TranscriptCall): TranscriptCall {
  return {
    ...a,
    at: Math.max(a.at, b.at),
    model: a.model ?? b.model,
    agent: a.agent === 'subagent' || b.agent === 'subagent' ? 'subagent' : (a.agent ?? b.agent),
    client: a.client ?? b.client,
    clientVersion: a.clientVersion ?? b.clientVersion,
    tokens: maxTokens(a.tokens, b.tokens),
    shas: [...new Set([...a.shas, ...b.shas])],
  }
}

/**
 * The model calls in one transcript file's text, deduped by message id, oldest first. Lines
 * that don't parse are skipped. With `window`, only calls answered in [from, to) are kept.
 * `subagent`: the file is a subagent's. Never throws.
 */
export function callsFromTranscript(text: string, o: { subagent: boolean; window?: { from: number; to: number } }): TranscriptCall[] {
  const byId = new Map<string, TranscriptCall>()
  const idOfUuid = new Map<string, string>()
  const results: { link: string; shas: string[] }[] = []
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue
    let e: unknown
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    if (!isObject(e)) continue
    if (e.type === 'user' && e.toolUseResult !== undefined) {
      const shas = shasOf(e.toolUseResult)
      const link = typeof e.sourceToolAssistantUUID === 'string' ? e.sourceToolAssistantUUID : e.parentUuid
      if (shas.length > 0 && typeof link === 'string') results.push({ link, shas })
      continue
    }
    if (e.type !== 'assistant' || !isObject(e.message)) continue
    const m = e.message
    if (typeof m.id !== 'string' || !MESSAGE_ID.test(m.id)) continue
    if (m.model === '<synthetic>') continue
    const at = typeof e.timestamp === 'string' ? Date.parse(e.timestamp) : NaN
    if (!Number.isFinite(at)) continue
    if (typeof e.uuid === 'string' && UUID.test(e.uuid)) idOfUuid.set(e.uuid, m.id)
    const call: TranscriptCall = {
      id: m.id,
      at,
      model: modelId(m.model),
      effort: null,
      agent: o.subagent || e.isSidechain === true ? 'subagent' : 'main',
      client: clientOf(e.entrypoint),
      clientVersion: versionOf(e.version),
      tokens: tokensOf(m.usage),
      shas: [],
      error: false,
      repo: null,
    }
    const had = byId.get(m.id)
    byId.set(m.id, had ? merge(had, call) : call)
  }
  for (const r of results) {
    const id = idOfUuid.get(r.link)
    const c = id === undefined ? undefined : byId.get(id)
    if (c) byId.set(c.id, { ...c, shas: [...new Set([...c.shas, ...r.shas])] })
  }
  let calls = [...byId.values()]
  if (o.window) {
    const { from, to } = o.window
    calls = calls.filter(c => c.at >= from && c.at < to)
  }
  return calls.sort((a, b) => a.at - b.at)
}

/**
 * The calls of several files (a session and its subagents, other sessions), one per message
 * id, oldest first, ready for `coderFor`. The id is dropped: it has done its job.
 */
export function mergeTranscripts(lists: readonly (readonly TranscriptCall[])[]): Call[] {
  const byId = new Map<string, TranscriptCall>()
  for (const list of lists) for (const c of list) byId.set(c.id, byId.has(c.id) ? merge(byId.get(c.id)!, c) : c)
  return [...byId.values()].sort((a, b) => a.at - b.at).map(({ id: _id, ...call }) => call)
}

/**
 * A subagent's transcript, by its path: `<session>/subagents/<agent>.jsonl`, or a workflow
 * agent's, `<session>/subagents/workflows/<run>/<agent>.jsonl` (Claude Code 2.1.293).
 */
export function isSubagentFile(path: string) {
  return /[\\/]subagents[\\/](?:workflows[\\/](?:[^\\/]+[\\/])?)?[^\\/]+\.jsonl$/.test(path)
}

/**
 * Which transcript files to read for one commit: `.jsonl` files no larger than
 * FILE_MAX_BYTES, written to at or after the window opened (one last written before it
 * can't hold a call inside it), newest first, at most FILES_PER_COMMIT and what is left of
 * the scan's `budget`.
 */
export function pickTranscripts(files: readonly { path: string; size: number; mtimeMs: number }[], o: { from: number; budget: number }): string[] {
  const cap = Math.max(0, Math.min(FILES_PER_COMMIT, Math.floor(o.budget)))
  return files
    .filter(f => /\.jsonl$/.test(f.path) && Number.isFinite(f.size) && f.size >= 0 && f.size <= FILE_MAX_BYTES && Number.isFinite(f.mtimeMs) && f.mtimeMs >= o.from)
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, cap)
    .map(f => f.path)
}

/** Config's `eval_backfill`: only `true` is on (a missing key, a server before W7-1, is off). */
export function backfillOn(raw: unknown): boolean {
  return isObject(raw) && raw.eval_backfill === true
}

/** A transcript file as the folder listing gives it. */
export type TranscriptFile = { path: string; size: number; mtimeMs: number }

/**
 * The reads for one commit whose window opens at `from`, given the files the scan has read
 * already (`read`) and what is left of its budget: `use`, the files whose calls count
 * (`pickTranscripts`': at most FILES_PER_COMMIT, newest first, none over FILE_MAX_BYTES),
 * `fresh`, those of them still to read, at most `budget`, and `complete`, whether `use` is
 * every file that could hold a call in the window (a `.jsonl` file written at or after it
 * opened, or with no time to tell, whatever its size). When it isn't, a window's vote would
 * count only part of its calls, so only a sha match may name the coder.
 */
export function readPlan(files: readonly TranscriptFile[], o: { from: number; read: ReadonlySet<string>; budget: number }): { use: string[]; fresh: string[]; complete: boolean } {
  const could = [...new Map(files.map(f => [f.path, f])).values()].filter(f => /\.jsonl$/.test(f.path) && !(Number.isFinite(f.mtimeMs) && f.mtimeMs < o.from))
  const picked = pickTranscripts(could, { from: o.from, budget: FILES_PER_COMMIT })
  const fresh = picked.filter(p => !o.read.has(p)).slice(0, Math.max(0, Math.floor(o.budget) || 0))
  const use = picked.filter(p => o.read.has(p) || fresh.includes(p))
  return { use, fresh, complete: use.length === could.length }
}

/**
 * Where Claude Code keeps its transcripts: `<config dir>/projects`, the config dir being
 * CLAUDE_CONFIG_DIR when it is set to an absolute path (or one under `~`), else ~/.claude.
 */
export function transcriptsDirOf(env: { CLAUDE_CONFIG_DIR?: string | undefined }, home: string): string {
  const raw = (env.CLAUDE_CONFIG_DIR ?? '').trim()
  let dir = `${home.replace(/[\\/]+$/, '')}/.claude`
  if (raw.startsWith('~/') || raw === '~') dir = home.replace(/[\\/]+$/, '') + raw.slice(1)
  else if (raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) dir = raw
  return `${dir.replace(/[\\/]+$/, '')}/projects`
}

/** Java's string hash, as Claude Code names a long project folder with. */
function javaHash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0
  return h
}

/**
 * The folder under `projects` that holds the transcripts of sessions started in `cwd`, as
 * Claude Code names it (read from Claude Code 2.1.293): every character but a letter or
 * digit becomes `-`, and a name over 200 characters is cut there with a hash added.
 */
export function projectDirOf(cwd: string): string {
  const name = cwd.replace(/[^a-zA-Z0-9]/g, '-')
  return name.length <= 200 ? name : `${name.slice(0, 200)}-${Math.abs(javaHash(cwd)).toString(36)}`
}

/**
 * What the folder of every session started in a subfolder of `cwd` starts with
 * (`projectDirOf` of `<cwd>/<sub>`), long names included. Another folder whose path only
 * starts the same (`/work/acme-api-v2` beside `/work/acme-api`) has the same start, and the
 * two can't be told apart by name: the fallback never reads either, it only looks for their
 * transcripts' times (register.tsx).
 */
export function subfolderPrefixOf(cwd: string): string {
  return `${cwd.replace(/[^a-zA-Z0-9]/g, '-').slice(0, 200)}-`
}
