// The watch list's pure half (no `$` in this file): which folders a Bash command ran git in,
// and which folders Claude Code's own transcripts name. register.tsx asks git for each
// folder's repo and adds it to the Grind's repos, so a commit counts wherever it lands:
//   - a session open in one repo that commits into another (`cd ../api && git commit`, or
//     `git -C ../api commit`): `gitDirs` reads the command the Bash hook saw;
//   - a session that was open before the mod was installed (it has no hooks until it
//     restarts): the look reads the tail of the transcripts written in the last minutes, for
//     the folders they ran in and the git commands that committed;
//   - a repo no session is open in right now: the seed, once per install, reads the folder
//     each project of the last SEED_DAYS days started in.
// Tracking still starts at install: a repo that joins the list is scored from then on, never
// from before. Only folders are taken from a transcript, and they stay on this machine.
// A look or a seed that fails says so in the debug log only, never in the transcript.

/** How far back the seed looks for projects, in days. */
export const SEED_DAYS = 30
/** A seed that failed (a slow disk, a script that exited badly) is tried again this long after. */
export const SEED_RETRY_MS = 6 * 3_600_000
/** A seed still running holds the seed this long, past its own two-minute limit: a session that ends mid-seed frees it in minutes, not hours. */
export const SEED_FLIGHT_MS = 3 * 60_000
/** A session stops looking after this many failures in a row (and at the first one that says it can't run `sh` at all). */
export const LOOK_STRIKES = 3
/** How far back a look reads, in minutes: the timer's two, the lease's slack and a late write. */
export const LOOK_MINUTES = 10
/** A look at most this often on one machine, whichever session takes it. */
export const LOOK_EVERY_MS = 100_000
/** At most this many folders from one command, and from one look. */
export const DIRS_PER_COMMAND = 8
export const DIRS_PER_LOOK = 400

/**
 * The seed: the folder each project started in, one line per project with a transcript
 * written in the last `$2` days. `$1` is the transcripts folder. A project's sessions share
 * the folder they started in, so one transcript's first `cwd` says it. Project folders are
 * named from a path, so they start with a dash: `./` keeps find from reading one as an option.
 */
export const SEED_SCRIPT = `
cd "$1" 2>/dev/null || exit 0
for d in ./*/; do
  f=$(find "$d" -maxdepth 1 -name '*.jsonl' -type f -mtime -"$2" 2>/dev/null | head -n 1)
  [ -z "$f" ] && continue
  head -c 262144 "$f" | LC_ALL=C grep -a -m1 -o '"cwd":"[^"]*"'
done | sort -u | head -n ${DIRS_PER_LOOK}
`

/**
 * The look: for each transcript written in the last `$2` minutes, the folders its last 4 MiB
 * ran in and the entries there that call Bash with a commit. `$1` is the transcripts folder.
 */
export const LOOK_SCRIPT = `
cd "$1" 2>/dev/null || exit 0
find . -maxdepth 2 -name '*.jsonl' -type f -mmin -"$2" 2>/dev/null | head -n 40 | while IFS= read -r f; do
  tail -c 4194304 "$f" | LC_ALL=C grep -a -o '"cwd":"[^"]*"' | sort -u
  tail -c 4194304 "$f" | LC_ALL=C grep -a '"name":"Bash"' | LC_ALL=C grep -a 'commit' | awk 'length($0) < 65536'
done | head -c 2000000
`

/** A Bash command that runs `git commit`, by the same test the Bash hook has always used. */
export function isCommitCommand(command: string) {
  return /\bgit\b[^\n]*\bcommit\b/.test(command)
}

/**
 * Temp folders never join the watch list: a scratch repo a test or a session made there is
 * not the player's work. `tmp` is the machine's TMPDIR when it has one.
 */
export function isTempDir(path: string, tmp?: string | null) {
  const p = path.replace(/\\/g, '/')
  const own = (tmp ?? '').replace(/\\/g, '/').replace(/\/+$/, '')
  if (own.length > 1 && (p === own || p.startsWith(`${own}/`))) return true
  return /^(\/private)?\/(tmp|var\/tmp|var\/folders)(\/|$)/.test(p) || /^\/dev\/shm(\/|$)/.test(p) || /\/AppData\/Local\/Temp(\/|$)/i.test(p)
}

/** `a/./b/../c` as `a/c`, with no trailing slash. A Windows drive path is left as it is. */
function normalize(path: string) {
  if (!path.startsWith('/')) return path
  const out: string[] = []
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') out.pop()
    else out.push(part)
  }
  return `/${out.join('/')}`
}

function isAbsolute(path: string) {
  return path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)
}

/** `path` from `base`; null when it is relative and the shell's folder isn't known. */
function resolve(base: string | null, path: string) {
  if (isAbsolute(path)) return normalize(path)
  return base ? normalize(`${base}/${path}`) : null
}

/** A shell word; `opaque` when it holds something this can't follow (a variable but HOME, a command substitution, a glob). */
type Word = { text: string; opaque: boolean }

/** How long `$HOME` or `${HOME}` is at `i`, or 0. */
function homeVar(s: string, i: number) {
  if (s.startsWith('${HOME}', i)) return 7
  return s.startsWith('$HOME', i) && !/\w/.test(s[i + 5] ?? '') ? 5 : 0
}

/** The command without its here-documents' bodies: a commit message fed on stdin is no command. */
function withoutHeredocs(command: string) {
  const out: string[] = []
  const waiting: { word: string; tabs: boolean }[] = []
  for (const line of command.split('\n')) {
    const until = waiting[0]
    if (until) {
      if ((until.tabs ? line.replace(/^\t+/, '') : line) === until.word) waiting.shift()
      continue
    }
    out.push(line)
    for (const m of line.matchAll(/(?<!<)<<(?!<)(-?)\s*(?:'([^']+)'|"([^"]+)"|\\?([A-Za-z_][\w.-]*))/g)) waiting.push({ word: m[2] ?? m[3] ?? m[4] ?? '', tabs: m[1] === '-' })
  }
  return out.join('\n')
}

/**
 * The script as simple commands, each a list of words, split at `&&`, `||`, `;`, `|`, `&` and
 * newlines. Quotes and backslashes are read as the shell reads them; `~` and HOME become
 * `home`. A `(` and a `)` come out as commands of their own, so a subshell's `cd` can end with it.
 */
function commandsOf(script: string, home: string | null): Word[][] {
  const out: Word[][] = []
  let cur: Word[] = []
  let text = ''
  let opaque = false
  let open = false
  const endWord = () => {
    if (open) cur.push({ text, opaque })
    text = ''
    opaque = false
    open = false
  }
  const endCommand = () => {
    endWord()
    if (cur.length > 0) out.push(cur)
    cur = []
  }
  for (let i = 0; i < script.length; i++) {
    const c = script[i] as string
    if (c === "'") {
      const end = script.indexOf("'", i + 1)
      text += script.slice(i + 1, end < 0 ? script.length : end)
      open = true
      i = end < 0 ? script.length : end
    } else if (c === '"') {
      open = true
      for (i++; i < script.length && script[i] !== '"'; i++) {
        const d = script[i] as string
        const n = script[i + 1] ?? ''
        if (d === '\\' && n !== '' && '"\\$`\n'.includes(n)) {
          if (n !== '\n') text += n
          i++
        } else if (d === '$' && home && homeVar(script, i) > 0) {
          text += home
          i += homeVar(script, i) - 1
        } else {
          if (d === '$' || d === '`') opaque = true
          text += d
        }
      }
    } else if (c === '\\') {
      const n = script[i + 1]
      if (n !== undefined && n !== '\n') {
        text += n
        open = true
      }
      i++
    } else if (c === ' ' || c === '\t') {
      endWord()
    } else if (c === '(' || c === ')') {
      endCommand()
      out.push([{ text: c, opaque: false }])
    } else if (c === '\n' || c === ';' || c === '|' || c === '&') {
      endCommand()
    } else if (c === '#' && !open) {
      const end = script.indexOf('\n', i)
      i = end < 0 ? script.length : end - 1
    } else if (c === '~' && !open && /^(\/|\s|[;&|)]|$)/.test(script.slice(i + 1, i + 2))) {
      if (home) text += home
      else opaque = true
      open = true
    } else if (c === '$' && home && homeVar(script, i) > 0) {
      text += home
      open = true
      i += homeVar(script, i) - 1
    } else {
      if (c === '$' || c === '`' || c === '*' || c === '?') opaque = true
      text += c
      open = true
    }
  }
  endCommand()
  return out
}

/** Words a command may start with before its name: shell keywords, and `time` and its kin. */
const LEAD = new Set(['then', 'do', 'else', 'elif', 'if', 'while', 'until', '{', '!', 'time', 'command', 'builtin', 'exec'])
/** git's own options that take the next word as their value (`-C` is read, the rest skipped). */
const GIT_TAKES_VALUE = new Set(['-c', '--git-dir', '--work-tree', '--namespace', '--config-env', '--super-prefix'])

/**
 * The folder each `git` call in a Bash command runs in, in order and once each: the shell's
 * folder as `cd` and `pushd` move it from `cwd`, then git's own `-C`. A folder that can't be
 * worked out (a variable, `cd -`, a relative path with no `cwd`) is left out, and so is every
 * relative one after it until an absolute `cd`. Absolute, or relative to nothing known: this
 * never asks the file system, so a folder may not exist or be no repo.
 */
export function gitDirs(command: string, cwd: string | null, home: string | null): string[] {
  const out: string[] = []
  const stack: (string | null)[] = []
  const userHome = home ? normalize(home.replace(/[\\/]+$/, '') || '/') : null
  let dir = cwd ? normalize(cwd) : null
  for (const words of commandsOf(withoutHeredocs(command), userHome)) {
    if (words.length === 1 && words[0]?.text === '(') {
      stack.push(dir)
      continue
    }
    if (words.length === 1 && words[0]?.text === ')') {
      if (stack.length > 0) dir = stack.pop() ?? null
      continue
    }
    let i = 0
    while (i < words.length && (LEAD.has(words[i]?.text ?? '') || /^[A-Za-z_]\w*=/.test(words[i]?.text ?? ''))) i++
    const name = words[i]?.text
    if (name === 'cd' || name === 'pushd') {
      let j = i + 1
      while (j < words.length && /^-([LPe@]+|-)$/.test(words[j]?.text ?? '')) j++
      const to = words[j]
      if (!to) dir = name === 'cd' ? userHome : null
      else dir = to.opaque || to.text === '-' ? null : resolve(dir, to.text)
      continue
    }
    if (name === 'popd') {
      dir = null
      continue
    }
    if (name !== 'git') continue
    let at = dir
    for (let j = i + 1; j < words.length; j++) {
      const w = words[j] as Word
      if (!w.text.startsWith('-')) break
      if (w.text === '-C') {
        const to = words[++j]
        at = !to || to.opaque ? null : resolve(at, to.text)
      } else if (GIT_TAKES_VALUE.has(w.text)) j++
    }
    if (at && !out.includes(at)) out.push(at)
    if (out.length >= DIRS_PER_COMMAND) break
  }
  return out
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * The folders a seed or a look printed: a `"cwd":"..."` line is a folder a session ran in,
 * and a transcript entry that calls Bash with a commit gives the folders its git calls ran in
 * (`gitDirs`, from the entry's own `cwd`). Anything else on a line is passed over: a cut
 * entry, another tool, a Bash call that commits nothing.
 */
export function dirsFromLook(stdout: string, home: string | null): string[] {
  const out = new Set<string>()
  const add = (dir: unknown) => {
    if (typeof dir === 'string' && isAbsolute(dir) && out.size < DIRS_PER_LOOK) out.add(normalize(dir))
  }
  for (const line of stdout.split('\n')) {
    const cwd = /^"cwd":("[^"]*")$/.exec(line)
    if (cwd) {
      try {
        add(JSON.parse(cwd[1] as string))
      } catch {
        // Not a JSON string after all: no folder.
      }
      continue
    }
    if (!line.startsWith('{')) continue
    let entry: unknown
    try {
      entry = JSON.parse(line)
    } catch {
      continue
    }
    if (!isObject(entry) || !isObject(entry.message) || !Array.isArray(entry.message.content)) continue
    const from = typeof entry.cwd === 'string' ? entry.cwd : null
    for (const block of entry.message.content) {
      if (!isObject(block) || block.type !== 'tool_use' || block.name !== 'Bash' || !isObject(block.input)) continue
      const command = block.input.command
      if (typeof command !== 'string' || !isCommitCommand(command)) continue
      for (const dir of gitDirs(command, from, home)) add(dir)
    }
  }
  return [...out]
}

/**
 * A failure worth another try on this machine: the script ran and exited badly, or ran out of
 * time. The engine words its own timeout "$.process.run(sh) aborted: still running after
 * 120000ms" (Claude Code 2.1.296), with no "timeout" in it. Anything else `$.process.run`
 * rejects with means it couldn't start (no `sh` on PATH: "failed to start: ENOENT"; a host with
 * no processes) or the session is going away ("aborted" alone, the module unloading), and that
 * session stops looking at once.
 */
export function isTransientLookFailure(message: string) {
  return /^sh exited \d+$/.test(message) || /tim(e|ed) ?out|still running after/i.test(message)
}
