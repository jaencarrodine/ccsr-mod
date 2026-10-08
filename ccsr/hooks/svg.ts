// The backtest bars, the one drawing not yet redrawn in olympia.ts. Every
// other surface draws from olympia.ts (ported from mod-lab/hooks/svg.ts).

const BONE = '#E6DED1'
const BONE2 = '#D9CFBF'
const INK = '#141312'
const INK2 = '#26231F'
const ORANGE = '#FF6A2A'
const STONE = '#9A9286'
const STONE2 = '#6A635A'
const MONO = `'Chivo Mono','JetBrains Mono',ui-monospace,Menlo,monospace`
const SANS = `'Schibsted Grotesk',ui-sans-serif,-apple-system,Helvetica,sans-serif`

export function esc(s: string) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string)
}

const GRAIN = `<filter id="g"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 0.08  0 0 0 0 0.07  0 0 0 0 0.07  0 0 0 .5 0"/></filter>`

function frame(w: number, h: number, body: string, bg = BONE) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${GRAIN}</defs><rect width="${w}" height="${h}" rx="6" fill="${bg}"/><rect width="${w}" height="${h}" rx="6" filter="url(#g)" opacity=".18"/>${body}</svg>`
}


/** Past sessions as bars: what each would have scored. */
export function sessionBars(rows: { label: string; points: number; pending: boolean }[]) {
  const w = 720
  const rowH = 22
  const h = 40 + rows.length * rowH + 10
  const max = Math.max(1, ...rows.map(r => r.points))
  let out = ''
  rows.forEach((r, i) => {
    const y = 40 + i * rowH
    const bw = Math.round((w - 330) * (r.points / max))
    out += `<text x="24" y="${y + 13}" font-family="${SANS}" font-size="12" fill="${INK}">${esc(r.label.slice(0, 38))}</text>`
    out += `<rect x="290" y="${y + 3}" width="${w - 330}" height="12" fill="none" stroke="${STONE}" stroke-dasharray="2 3"/>`
    if (!r.pending) out += `<rect x="290" y="${y + 3}" width="${bw}" height="12" fill="${i === 0 ? ORANGE : INK2}"/>`
    out += `<text x="${w - 24}" y="${y + 13}" text-anchor="end" font-family="${MONO}" font-size="12" font-weight="700" fill="${INK}">${r.pending ? '...' : r.points}</text>`
  })
  return frame(w, h, `<text x="24" y="26" font-family="${MONO}" font-size="11" fill="${STONE2}" letter-spacing="2">IF THESE HAD BEEN MATCHES</text>${out}`)
}
