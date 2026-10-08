'use client'

import { useState } from 'react'

export interface DailyPoint {
  day: string
  value: number
}

function niceMax(n: number) {
  if (n <= 4) return 4
  const step = 10 ** Math.floor(Math.log10(n))
  return Math.ceil(n / step) * step
}

function label(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** One-series column chart of a daily count, with a hover tooltip and a table view. */
export function DailyChart({ title, unit, points }: { title: string; unit: string; points: DailyPoint[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 600
  const H = 160
  const pad = { l: 28, r: 4, t: 8, b: 22 }
  const max = niceMax(Math.max(0, ...points.map((p) => p.value)))
  const slot = (W - pad.l - pad.r) / Math.max(points.length, 1)
  const bar = Math.min(16, slot - 2)
  const y = (v: number) => pad.t + (H - pad.t - pad.b) * (1 - v / max)
  const total = points.reduce((n, p) => n + p.value, 0)
  const ticks = [0, max / 2, max]
  const h = hover !== null ? points[hover] : null

  return (
    <figure className="rounded-2xl border border-line bg-surface p-4 shadow-card">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs text-ink-3">
          {total} in {points.length} days
        </span>
      </figcaption>
      <div className="relative mt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={`${title}: ${total} in the last ${points.length} days`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-3)">
                {Math.round(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) => {
            const cx = pad.l + slot * i + slot / 2
            const top = y(p.value)
            const base = y(0)
            const height = base - top
            const r = Math.min(4, height / 2, bar / 2)
            return (
              <g key={p.day} onMouseEnter={() => setHover(i)}>
                <rect x={pad.l + slot * i} y={pad.t} width={slot} height={H - pad.t - pad.b} fill={hover === i ? 'var(--surface-2)' : 'transparent'} />
                {p.value > 0 && (
                  <path
                    d={`M${cx - bar / 2},${base} V${top + r} Q${cx - bar / 2},${top} ${cx - bar / 2 + r},${top} H${cx + bar / 2 - r} Q${cx + bar / 2},${top} ${cx + bar / 2},${top + r} V${base} Z`}
                    fill="var(--chart)"
                  />
                )}
              </g>
            )
          })}
          {points.length > 0 &&
            [0, Math.floor((points.length - 1) / 2), points.length - 1].map((i) => (
              <text key={i} x={pad.l + slot * i + slot / 2} y={H - 6} textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'} fontSize={10} fill="var(--ink-3)">
                {label(points[i]!.day)}
              </text>
            ))}
        </svg>
        {h && hover !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs whitespace-nowrap shadow-pop"
            style={{ left: `${((pad.l + slot * hover + slot / 2) / W) * 100}%` }}
          >
            <span className="font-semibold">{h.value}</span> {unit} · <span className="text-ink-3">{label(h.day)}</span>
          </div>
        )}
      </div>
      <details className="mt-2 text-xs text-ink-3">
        <summary className="cursor-pointer select-none hover:text-ink">Show as table</summary>
        <table className="mt-2 w-full">
          <tbody>
            {[...points].reverse().map((p) => (
              <tr key={p.day} className="border-b border-line last:border-0">
                <td className="py-1">{label(p.day)}</td>
                <td className="py-1 text-right tabular-nums text-ink-2">{p.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
