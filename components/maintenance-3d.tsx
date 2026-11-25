'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A galaxy of notes drawn straight on a canvas (no 3D library): a few thousand stars in spiral arms
 * around a glowing core, turning at different speeds, with small note pages drifting among them.
 * Move your cursor or finger and the galaxy tilts in 3D; hover a page to read which subject it is;
 * a click sends a shockwave rippling out through the stars. It turns by itself when idle.
 * Reduced-motion visitors get one still frame; drawing pauses in a hidden tab.
 */

const F = 900 // eye distance: smaller means stronger perspective
const STARS = 4600
const ARMS = 3

const SUBJECTS = [
  'Matrices and Calculus',
  'Applied Physics',
  'Programming for Problem Solving',
  'Digital Logic Design',
  'Chemistry for Engineers',
  'Engineering Mechanics',
  'Discrete Mathematics',
  'Signals and Systems',
  'Operating Systems',
  'Computer Networks',
  'Database Management Systems',
  'Network Analysis',
  'English for Skill Enhancement',
  'Object Oriented Programming',
  'Probability and Statistics',
  'Fluid Mechanics',
]

type Star = { a: number; r: number; y: number; hue: number; s: number; tw: number }
type Page = { a: number; r: number; y: number; label: string; spin: number; flip: number }

export function Maintenance3D() {
  const box = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = box.current
    const cv = canvas.current
    const ctx = cv?.getContext('2d')
    if (!host || !cv || !ctx) return
    const screen = host.closest<HTMLElement>('.mt-screen')
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches

    let w = 0
    let h = 0
    let R = 200
    let raf = 0
    let alive = true
    let last = 0
    let spin = 0
    const aim = { x: 0, y: 0, tx: 0, ty: 0, on: false }
    const ptr = { x: -999, y: -999, on: false }
    const waves: number[] = []
    let hover = -1

    // Stars along spiral arms: denser and brighter near the core, with a little scatter.
    const stars: Star[] = Array.from({ length: STARS }, (_, i) => {
      const r = Math.pow(Math.random(), 0.62)
      const arm = i % ARMS
      const a = (arm / ARMS) * Math.PI * 2 + r * 5.2 + (Math.random() - 0.5) * (0.5 + (1 - r) * 0.9)
      return {
        a,
        r,
        y: (Math.random() - 0.5) * (0.07 + (1 - r) * 0.16),
        hue: 235 + r * 70 + Math.random() * 20,
        s: 0.6 + Math.random() * 1.3 + (1 - r) * 0.7,
        tw: Math.random() * 6.28,
      }
    })
    const pages: Page[] = SUBJECTS.map((label, i) => ({
      a: (i / SUBJECTS.length) * Math.PI * 2 + (i % 3) * 0.4,
      r: 0.32 + ((i * 37) % 60) / 100,
      y: (((i * 53) % 20) - 10) / 100,
      label,
      spin: 0.4 + (i % 5) * 0.18,
      flip: i * 1.7,
    }))

    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = host!.clientWidth
      h = host!.clientHeight
      cv!.width = Math.round(w * dpr)
      cv!.height = Math.round(h * dpr)
      cv!.style.width = `${w}px`
      cv!.style.height = `${h}px`
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      R = Math.min(w * 0.44, h * 0.62)
    }

    function frame(t: number) {
      if (!alive) return
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016)
      last = t
      spin += dt
      aim.x += ((aim.on ? aim.tx : Math.sin(t / 4200) * 0.4) - aim.x) * 0.05
      aim.y += ((aim.on ? aim.ty : Math.cos(t / 5200) * 0.25) - aim.y) * 0.05
      // The tilt of the disc toward the viewer, and a turn left or right.
      const tilt = 1.0 + aim.y * 0.5
      const yaw = aim.x * 0.6
      const [ct, st, cyw, syw] = [Math.cos(tilt), Math.sin(tilt), Math.cos(yaw), Math.sin(yaw)]
      const cx = w / 2
      const cy = h / 2

      for (let i = waves.length - 1; i >= 0; i--) if ((t - waves[i]!) / 1000 > 2.2) waves.splice(i, 1)
      const shock = (r: number) => {
        let push = 0
        for (const t0 of waves) {
          const front = ((t - t0) / 1000) * 0.55
          const d = Math.abs(r - front)
          if (d < 0.1) push += (1 - d / 0.1) * 0.05 * (1 - (t - t0) / 2200)
        }
        return push
      }
      // Disc coordinates (x, up, z) to the screen: tilt about X, turn about Y, then perspective.
      const view = (x: number, up: number, z: number): [number, number, number] => {
        const x1 = x * cyw + z * syw
        const z1 = -x * syw + z * cyw
        const y2 = up * ct - z1 * st
        const z2 = up * st + z1 * ct
        const k = F / (F + z2)
        return [cx + x1 * k, cy - y2 * k, k]
      }

      ctx!.clearRect(0, 0, w, h)
      ctx!.globalCompositeOperation = 'lighter'

      // Soft glow of the core and the disc.
      const core = view(0, 0, 0)
      const g = ctx!.createRadialGradient(core[0], core[1], 0, core[0], core[1], R * 0.75)
      g.addColorStop(0, 'rgba(255,244,255,0.9)')
      g.addColorStop(0.12, 'rgba(216,190,255,0.55)')
      g.addColorStop(0.45, 'rgba(124,80,230,0.2)')
      g.addColorStop(1, 'rgba(60,30,140,0)')
      ctx!.save()
      ctx!.translate(core[0], core[1])
      ctx!.scale(1, Math.max(0.25, Math.abs(ct) + 0.35))
      ctx!.translate(-core[0], -core[1])
      ctx!.fillStyle = g
      ctx!.fillRect(0, 0, w, h)
      ctx!.restore()

      // The stars. Inner ones circle faster than outer ones, so the arms slowly wind.
      for (const s of stars) {
        const ang = s.a + spin * (0.22 / (s.r * 0.9 + 0.22))
        const r = s.r + shock(s.r)
        const [sx, sy, k] = view(Math.cos(ang) * r * R, s.y * R, Math.sin(ang) * r * R)
        const tw = 0.55 + 0.45 * Math.sin(t / 700 + s.tw)
        const lit = 62 + (1 - s.r) * 28
        ctx!.fillStyle = `hsla(${s.hue}, 85%, ${lit}%, ${(0.45 + (1 - s.r) * 0.55) * tw})`
        const z = s.s * k
        ctx!.fillRect(sx - z / 2, sy - z / 2, z, z)
      }

      // Note pages drifting with the galaxy.
      type Quad = { pts: [number, number][]; cx: number; cy: number; z: number; i: number }
      const quads: Quad[] = []
      pages.forEach((p, i) => {
        const ang = p.a + spin * (0.22 / (p.r * 0.9 + 0.22))
        const r = p.r + shock(p.r)
        const px = Math.cos(ang) * r * R
        const pz = Math.sin(ang) * r * R
        const py = p.y * R + Math.sin(t / 1200 + p.flip) * R * 0.012
        // A small upright page that slowly turns about its own axis.
        const turn = spin * p.spin + p.flip
        const [ctn, stn] = [Math.cos(turn), Math.sin(turn)]
        const hw = R * 0.05
        const hh = R * 0.066
        const corners: [number, number][] = [[-hw, hh], [hw, hh], [hw, -hh], [-hw, -hh]]
        const pts = corners.map(([dx, dy]) => {
          const [sx, sy] = view(px + dx * ctn, py + dy, pz + dx * stn)
          return [sx, sy] as [number, number]
        })
        const c = view(px, py, pz)
        quads.push({ pts, cx: c[0], cy: c[1], z: c[2], i })
      })
      quads.sort((a, b) => a.z - b.z)

      hover = -1
      if (ptr.on) {
        let best = 34
        for (const q of quads) {
          const d = Math.hypot(q.cx - ptr.x, q.cy - ptr.y)
          if (d < best) {
            best = d
            hover = q.i
          }
        }
      }
      ctx!.globalCompositeOperation = 'source-over'
      for (const q of quads) {
        const on = q.i === hover
        ctx!.beginPath()
        q.pts.forEach(([x, y], n) => (n === 0 ? ctx!.moveTo(x, y) : ctx!.lineTo(x, y)))
        ctx!.closePath()
        ctx!.shadowColor = on ? 'rgba(196,181,253,1)' : 'rgba(167,139,250,0.55)'
        ctx!.shadowBlur = on ? 22 : 9
        ctx!.fillStyle = on ? 'rgba(255,255,255,0.97)' : 'rgba(236,230,255,0.82)'
        ctx!.fill()
        ctx!.shadowBlur = 0
        // Ruled lines on the page.
        ctx!.strokeStyle = 'rgba(109,76,214,0.55)'
        ctx!.lineWidth = Math.max(0.6, q.z * 0.9)
        const [a, b, , d] = q.pts as [[number, number], [number, number], [number, number], [number, number]]
        for (let n = 1; n <= 3; n++) {
          const f = n / 4
          ctx!.beginPath()
          ctx!.moveTo(a[0] + (d[0] - a[0]) * f + (b[0] - a[0]) * 0.18, a[1] + (d[1] - a[1]) * f + (b[1] - a[1]) * 0.18)
          ctx!.lineTo(a[0] + (d[0] - a[0]) * f + (b[0] - a[0]) * 0.82, a[1] + (d[1] - a[1]) * f + (b[1] - a[1]) * 0.82)
          ctx!.stroke()
        }
      }

      // The label of the page under the pointer.
      if (hover >= 0) {
        const q = quads.find((x) => x.i === hover)!
        const text = pages[hover]!.label
        ctx!.font = '600 13px system-ui, sans-serif'
        const tw = ctx!.measureText(text).width + 22
        const tx = Math.min(w - tw - 6, Math.max(6, q.cx - tw / 2))
        const ty = q.cy - 52
        ctx!.fillStyle = 'rgba(14,10,30,0.92)'
        ctx!.strokeStyle = 'rgba(167,139,250,0.7)'
        ctx!.lineWidth = 1
        ctx!.beginPath()
        ctx!.roundRect(tx, ty, tw, 26, 9)
        ctx!.fill()
        ctx!.stroke()
        ctx!.fillStyle = '#f1edff'
        ctx!.textBaseline = 'middle'
        ctx!.fillText(text, tx + 11, ty + 13.5)
      }
      cv!.style.cursor = hover >= 0 ? 'pointer' : 'crosshair'
      if (!still) raf = requestAnimationFrame(frame)
    }

    function windowMove(e: PointerEvent) {
      aim.tx = (e.clientX / window.innerWidth - 0.5) * 2
      aim.ty = (e.clientY / window.innerHeight - 0.5) * 2
      aim.on = true
      screen?.style.setProperty('--mx', aim.tx.toFixed(3))
      screen?.style.setProperty('--my', aim.ty.toFixed(3))
    }
    function windowLeave() {
      aim.on = false
      ptr.on = false
      screen?.style.setProperty('--mx', '0')
      screen?.style.setProperty('--my', '0')
    }
    function canvasMove(e: PointerEvent) {
      const r = cv!.getBoundingClientRect()
      ptr.x = e.clientX - r.left
      ptr.y = e.clientY - r.top
      ptr.on = true
    }
    function canvasDown(e: PointerEvent) {
      canvasMove(e)
      waves.push(performance.now())
      if (waves.length > 4) waves.shift()
    }
    function visibility() {
      cancelAnimationFrame(raf)
      if (!document.hidden && !still) raf = requestAnimationFrame(frame)
    }

    size()
    if (still) frame(0)
    else raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => {
      size()
      if (still) frame(0)
    })
    ro.observe(host)
    window.addEventListener('pointermove', windowMove)
    document.addEventListener('pointerleave', windowLeave)
    cv.addEventListener('pointermove', canvasMove)
    cv.addEventListener('pointerleave', () => (ptr.on = false))
    cv.addEventListener('pointerdown', canvasDown)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', windowMove)
      document.removeEventListener('pointerleave', windowLeave)
      cv.removeEventListener('pointermove', canvasMove)
      cv.removeEventListener('pointerdown', canvasDown)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [])

  return (
    <div ref={box} className="mt-sign">
      <canvas ref={canvas} role="img" aria-label="A spiral galaxy of stars with small note pages floating in it" className="touch-none" />
    </div>
  )
}

/** How long the site has been down. */
export function DownFor({ since }: { since?: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const start = since ? Date.parse(since) : NaN
  if (now === null || !Number.isFinite(start)) return <span>--:--:--</span>
  const s = Math.max(0, Math.floor((now - start) / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    <span className="tabular-nums">
      {pad(Math.floor(s / 3600))}:{pad(Math.floor((s % 3600) / 60))}:{pad(s % 60)}
    </span>
  )
}
