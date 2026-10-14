'use client'

import { useEffect, useRef } from 'react'

/** How far (px) the nearest stars drift when the cursor is at the edge of the screen. */
const PULL = 38

/**
 * The home page's night sky: many small white dots at different depths behind everything. They
 * twinkle softly, and as the cursor moves the whole sky turns a little after it, near stars more
 * than far ones, so it feels deep. Scrolling moves them slightly too. Paused in a background tab;
 * a single still frame for "reduce motion".
 */
export function StarField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let frame = 0
    // Where the sky is aiming (target) and where it is now (eased toward the target).
    const aim = { x: 0, y: 0 }
    const now = { x: 0, y: 0 }
    let stars: { x: number; y: number; z: number; r: number; a: number; t: number; s: number }[] = []

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(650, Math.max(160, (w * h) / 2600)))
      stars = Array.from({ length: count }, () => {
        // Most stars are far and faint; a few are near, bigger and brighter.
        const z = Math.random() ** 2.2
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          z,
          r: 0.35 + z * 1.15,
          a: 0.25 + z * 0.65,
          t: Math.random() * Math.PI * 2,
          s: 0.6 + Math.random() * 1.8,
        }
      })
    }

    const wrap = (v: number, max: number) => ((v % max) + max) % max

    const draw = (time: number) => {
      frame = 0
      now.x += (aim.x - now.x) * 0.06
      now.y += (aim.y - now.y) * 0.06
      const light = document.documentElement.dataset.theme === 'light'
      const rgb = light ? '76 60 140' : '255 255 255'
      const scroll = window.scrollY
      const sec = time / 1000
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        const depth = 0.15 + s.z
        const x = wrap(s.x - now.x * PULL * depth, w)
        const y = wrap(s.y - now.y * PULL * depth - scroll * 0.06 * depth, h)
        const glow = calm ? 1 : 0.75 + 0.25 * Math.sin(sec * s.s + s.t)
        ctx.fillStyle = `rgb(${rgb} / ${(s.a * glow * (light ? 0.6 : 1)).toFixed(3)})`
        if (s.r < 0.9) {
          ctx.fillRect(x, y, s.r * 1.6, s.r * 1.6)
        } else {
          ctx.beginPath()
          ctx.arc(x, y, s.r, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (!calm && !document.hidden) frame = requestAnimationFrame(draw)
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      // -1 … 1 from the centre of the screen.
      aim.x = (e.clientX / w) * 2 - 1
      aim.y = (e.clientY / h) * 2 - 1
    }
    const onResize = () => {
      size()
      kick()
    }
    const onScroll = () => {
      if (calm) kick()
    }

    size()
    kick()
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', kick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', kick)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 size-full" />
}
