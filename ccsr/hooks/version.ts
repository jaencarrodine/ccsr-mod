// The mod's own version, sent to the server on every request (x-ccsr-mod).
// The mods API can't read the manifest's version (`$.plugin` has the name and
// folder only), so this copy has to match .claude-plugin/plugin.json:
// scripts/publish-mod.sh bumps both and refuses to publish when they differ.
// Pure: no `$` here, so register.tsx can import it.

export const VERSION = '0.2.0'

/** Updates an installed mod from the install repo; it loads once Claude Code restarts. */
export const UPDATE_ARGV = [
  ['claude', 'plugin', 'marketplace', 'update', 'ccsr'],
  ['claude', 'plugin', 'update', 'ccsr@ccsr'],
] as const

/** The same, as one line to paste into a terminal. */
export const UPDATE_COMMAND = UPDATE_ARGV.map(a => a.join(' ')).join(' && ')

/** `1.2.3` from a version string, ignoring anything after it (`2.1.288-dev`). */
export function parseVersion(v: string | null | undefined): [number, number, number] | null {
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec((v ?? '').trim())
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}

/** Negative when a is older than b, 0 when the same, positive when newer. Unparseable sorts as 0.0.0. */
export function cmpVersion(a: string, b: string) {
  const x = parseVersion(a) ?? [0, 0, 0]
  const y = parseVersion(b) ?? [0, 0, 0]
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2]
}

/** Where this mod stands against the server's release line. */
export function standing(release: { latest: string; min: string } | null): 'current' | 'behind' | 'required' {
  if (!release) return 'current'
  if (cmpVersion(VERSION, release.min) < 0) return 'required'
  return cmpVersion(VERSION, release.latest) < 0 ? 'behind' : 'current'
}
