import { Clock, Wrench } from 'lucide-react'

/**
 * The page everyone but admins sees while maintenance mode is on: three meshed gears (their speeds
 * follow the tooth counts, so they really do turn together), sparks where the teeth meet, a wrench
 * that keeps tightening, and a status line that cycles. All CSS, no scripts; reduced-motion visitors
 * get the still picture.
 */

/** A gear outline centred on (0,0): n teeth, tooth tip radius ro, root radius rr, with a hub and four holes. */
function gearPath(n: number, ro: number, rr: number) {
  const step = (Math.PI * 2) / n
  const hr = step * 0.27 // half-width of a tooth at the root
  const ht = step * 0.15 // half-width at the tip
  const p = (r: number, a: number) => `${(r * Math.cos(a)).toFixed(2)} ${(r * Math.sin(a)).toFixed(2)}`
  let d = `M ${p(rr, -hr)}`
  for (let i = 0; i < n; i++) {
    const a = i * step
    d += ` L ${p(ro, a - ht)} L ${p(ro, a + ht)} L ${p(rr, a + hr)}`
    d += ` A ${rr} ${rr} 0 0 1 ${p(rr, a + step - hr)}`
  }
  d += ' Z'
  const hub = rr * 0.34
  d += ` M ${hub} 0 A ${hub} ${hub} 0 1 0 ${-hub} 0 A ${hub} ${hub} 0 1 0 ${hub} 0 Z`
  const hole = rr * 0.13
  for (let k = 0; k < 4; k++) {
    const a = (k * Math.PI) / 2 + Math.PI / 4
    const cx = rr * 0.66 * Math.cos(a)
    const cy = rr * 0.66 * Math.sin(a)
    d += ` M ${(cx + hole).toFixed(2)} ${cy.toFixed(2)} A ${hole} ${hole} 0 1 0 ${(cx - hole).toFixed(2)} ${cy.toFixed(2)} A ${hole} ${hole} 0 1 0 ${(cx + hole).toFixed(2)} ${cy.toFixed(2)} Z`
  }
  return d
}

const SECONDS_A = 16 // the 12-tooth gear; the others follow from tooth counts
const phase = (theta: number, n: number, ang: number) => (((((ang - theta) / (360 / n)) % 1) + 1) % 1)

// Layout (SVG units). Pitch radius is 5 per tooth; centres of meshing gears are the sum of their radii apart.
const A = { n: 12, x: 200, y: 150, dir: 1 }
const B = { n: 8, x: 300, y: 150, dir: -1 }
const D = { n: 6, x: 110, y: 150, dir: -1 }
const dirBC = { x: 0.6, y: 0.8 }
const C = { n: 16, x: B.x + dirBC.x * 120, y: B.y + dirBC.y * 120, dir: 1 }
// Starting angles so that a tooth always meets a gap where two gears touch.
const startB = 360 / B.n / 2
const startD = 360 / D.n / 2
const angBC = (Math.atan2(dirBC.y, dirBC.x) * 180) / Math.PI
const startC = (() => {
  const want = (((0.5 - phase(startB, B.n, angBC)) % 1) + 1) % 1
  return angBC + 180 - want * (360 / C.n)
})()

const gears = [
  { ...A, ro: 65, rr: 55, from: 0, big: false },
  { ...B, ro: 45, rr: 35, from: startB, big: false },
  { ...D, ro: 35, rr: 25, from: startD, big: false },
  { ...C, ro: 85, rr: 75, from: startC, big: true },
].map((g) => ({ ...g, seconds: (SECONDS_A * A.n) / g.n, d: gearPath(g.n, g.ro, g.rr) }))

const SPARKS = [
  { x: 250, y: 150, delay: 0 },
  { x: 250, y: 150, delay: 0.7 },
  { x: 250, y: 150, delay: 1.3 },
  { x: 155, y: 150, delay: 0.35 },
  { x: 155, y: 150, delay: 1.0 },
  { x: 332, y: 205, delay: 0.5 },
]

const TICKS = ['Oiling the gears…', 'Sorting question papers…', 'Sharpening the pencils…', 'Syncing the notes…']

export function MaintenanceScene({ message, back }: { message?: string; back?: string }) {
  return (
    <div className="mt-screen" role="status" aria-live="polite">
      <div className="mt-grid" aria-hidden="true" />
      <div className="mt-glow" aria-hidden="true" />
      <main className="mt-main">
        <div className="mt-machine" aria-hidden="true">
          <svg viewBox="0 0 470 330" className="mt-svg">
            <defs>
              <linearGradient id="mt-gear" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#c4b5fd" />
                <stop offset="0.55" stopColor="#8b5cf6" />
                <stop offset="1" stopColor="#4c1d95" />
              </linearGradient>
              <radialGradient id="mt-spark">
                <stop offset="0" stopColor="#fff" />
                <stop offset="0.4" stopColor="#ddd6fe" />
                <stop offset="1" stopColor="#8b5cf6" stopOpacity="0" />
              </radialGradient>
            </defs>
            {gears.map((g) => (
              <g key={g.n} transform={`translate(${g.x} ${g.y})`}>
                <g
                  className="mt-gear"
                  style={{ ['--from' as string]: `${g.from}deg`, ['--dir' as string]: g.dir, ['--t' as string]: `${g.seconds}s`, opacity: g.big ? 0.55 : 1 }}
                >
                  <path d={g.d} fill="url(#mt-gear)" fillRule="evenodd" stroke="#ddd6fe" strokeOpacity="0.55" strokeWidth="1.5" />
                </g>
              </g>
            ))}
            {SPARKS.map((s, i) => (
              <circle key={i} className="mt-spark" cx={s.x} cy={s.y} r="5" fill="url(#mt-spark)" style={{ animationDelay: `${s.delay}s` }} />
            ))}
          </svg>
          <Wrench className="mt-wrench" strokeWidth={1.6} />
        </div>

        <p className="mt-badge">
          <span className="mt-dot" /> 503 · Under maintenance
        </p>
        <h1 className="mt-title">We&apos;re tuning the machine room</h1>
        <p className="mt-copy">{message?.trim() || 'VJNOTES is getting some care. Your notes are safe and everything will be back shortly.'}</p>

        {back?.trim() && (
          <p className="mt-eta">
            <Clock className="size-4" /> Expected back {back.trim()}
          </p>
        )}

        <div className="mt-bar" aria-hidden="true">
          <span />
        </div>
        <p className="mt-ticker" aria-hidden="true">
          {TICKS.map((t, i) => (
            <span key={t} style={{ animationDelay: `${i * 3}s` }}>
              {t}
            </span>
          ))}
        </p>
      </main>
      <p className="mt-credit">Created by: Sriharsha Reddy (EVL)</p>
    </div>
  )
}
