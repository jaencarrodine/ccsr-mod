// Steady buttons (2026-10-13). A press that lands on the last draw still runs.
//
// The engine names a Button's handler by a handle it hands out when the element is made, so every
// redraw gives every button a new one, and it holds the old ones only for the drawing's life. A
// press carries the handle of the drawing the surface is showing. If the pane was drawn again in
// between (a poll, a tick, a scan's note, the boot's writes after a reload), that handle is gone
// and the press is dropped: the desktop app logs "ui_press not handled" and nothing happens. On a
// busy machine the surface is always a draw behind, and the pane redraws often. 155 presses were
// dropped that way on one Mac in one evening, four in five of them on the tab row. (Read from
// Claude Code 2.1.295: `heldPress` looks a press up by handle alone. `ui.input` and `ui.select`
// fall back to the element's key; `ui.press` does not.)
//
// The engine keeps a handle across a redraw when the same element comes back in the new tree. So
// a Button whose props did not change is given back as the very element drawn before, handle and
// all, and its press runs whatever closure the newest draw gave that key. A Button whose props did
// change (the tab that just lit) is a new element with a new handle, as before; each look a key
// has had is kept, so a tab that goes back to how it was gets the element it had then.
//
// THE RULE THIS MAKES: a key names what its press acts on. A press runs the newest closure its key
// and look have, so a Button that acts on one particular thing (a challenge, a match, a row) carries
// that thing's id in its key. Keyed without it, a press that lands a draw late acts on whatever
// replaced it. (Before this, that press was dropped.)
//
// Nothing here touches the engine: it is a walk over the tree a render hook is about to return.
// Elements are read as the engine makes them ({ type, props, children?, press, onPress }) and left
// alone when they are not that shape, so an engine that draws them otherwise loses nothing.

/** What the walk needs of an element: enough to tell a Button and to reach its children. */
type Node = { type?: unknown; props?: unknown; children?: unknown; press?: unknown; onPress?: unknown }

type Held = {
  /** The element given back while this key keeps this look. */
  el: object
  /** The newest draw's closure for it: what a press runs. */
  fn: (press: unknown) => unknown
  /** The site's draw count when it was last in a tree: its 300-draw rule counts from here. */
  seen: number
  /** The count of every draw of every site when it was last in a tree: the cap's order, which per-site counts can't give. */
  at: number
  /** The drawing it belongs to: while it was in that drawing's latest tree it is on screen, and is never let go. */
  site: string
}

/** A site's kept buttons are dropped once this many of its draws went by without them. */
export const STEADY_KEEP_DRAWS = 300
/** All kept buttons, across sites: past this the longest unseen go first. */
export const STEADY_MAX = 4000

export type Steady = {
  /** The tree with each unchanged keyed Button replaced by the element drawn before. `site` names the drawing (component, instance, surface). */
  hold: <T>(tree: T, site: string) => T
  /** How many buttons are kept (for tests). */
  size: () => number
  /** Forget everything (for tests). */
  clear: () => void
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)

/** A Button the engine made and nothing has stamped yet: a key, a closure, and the handle it was made with. */
function pressable(n: Node): n is Node & { props: { key: string }; onPress: (press: unknown) => unknown; press: { plugin: ''; handle: number } } {
  return (
    n.type === 'Button' &&
    typeof n.onPress === 'function' &&
    isObject(n.props) &&
    typeof n.props.key === 'string' &&
    n.props.key !== '' &&
    isObject(n.press) &&
    n.press.plugin === '' &&
    typeof n.press.handle === 'number'
  )
}

/**
 * How a Button looks, as one string: everything the engine made it with but its handle and its
 * closure (its props, what it holds, a top-level `hover`, whatever a later engine adds). Functions
 * never count: JSON leaves them out.
 */
function lookOf(n: Node): string | null {
  try {
    const { press: _press, onPress: _onPress, ...look } = n as Record<string, unknown>
    return JSON.stringify(look)
  } catch {
    // Something in it can't be written down (a cycle): never held, so always the new element.
    return null
  }
}

/** One walk: which drawing, its draw count, the count of all draws, and the buttons this walk has already placed. */
type Walk = { site: string; draw: number; at: number; taken: Set<string> }

export function steady(): Steady {
  const held = new Map<string, Held>()
  const draws = new Map<string, number>()
  let all = 0

  function prune(w: Walk) {
    const prefix = `${w.site}\x00`
    for (const [k, h] of held) if (k.startsWith(prefix) && w.draw - h.seen > STEADY_KEEP_DRAWS) held.delete(k)
    if (held.size <= STEADY_MAX) return
    // Over the cap: the ones longest out of any tree go, by the one count every site shares. Never one that was in its own
    // drawing's latest tree: that one is on screen, however long ago that drawing last drew, and its press must still run.
    const gone = [...held].filter(([, h]) => h.seen !== draws.get(h.site)).sort((x, y) => x[1].at - y[1].at)
    for (const [k] of gone.slice(0, held.size - STEADY_MAX)) held.delete(k)
  }

  function button(n: Node & { props: { key: string }; onPress: (press: unknown) => unknown }, w: Walk): object {
    const look = lookOf(n)
    if (look === null) return n
    const id = `${w.site}\x00${n.props.key}\x00${look}`
    // The same key and look twice in one tree: one element can't be both, and one closure can't serve both. The second is left
    // as the engine made it, with its own handle and its own closure.
    if (w.taken.has(id)) return n
    w.taken.add(id)
    const was = held.get(id)
    // Given back only while it is still as the engine made it: an engine that marks an element it has drawn gets a new one each time.
    if (was !== undefined && pressable(was.el as Node)) {
      was.fn = n.onPress
      was.seen = w.draw
      was.at = w.at
      return was.el
    }
    const el = Object.freeze({ ...n, onPress: (press: unknown) => held.get(id)?.fn(press) })
    held.set(id, { el, fn: n.onPress, seen: w.draw, at: w.at, site: w.site })
    return el
  }

  function walk(x: unknown, w: Walk): unknown {
    if (Array.isArray(x)) {
      let changed = false
      const out = x.map(y => {
        const z = walk(y, w)
        if (z !== y) changed = true
        return z
      })
      return changed ? out : x
    }
    if (!isObject(x)) return x
    const n = x as Node
    if (pressable(n)) return button(n, w)
    if (n.children === undefined) return x
    const kids = walk(n.children, w)
    return kids === n.children ? x : Object.freeze({ ...x, children: kids })
  }

  return {
    hold(tree, site) {
      const draw = (draws.get(site) ?? 0) + 1
      draws.set(site, draw)
      const w: Walk = { site, draw, at: ++all, taken: new Set() }
      let out: unknown
      try {
        out = walk(tree, w)
      } catch {
        // Never between a tree and the engine: whatever went wrong, the tree goes as it was.
        return tree
      }
      if (draw % 50 === 0 || held.size > STEADY_MAX) prune(w)
      return out as typeof tree
    },
    size: () => held.size,
    clear() {
      held.clear()
      draws.clear()
      all = 0
    },
  }
}
