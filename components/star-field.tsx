'use client'

import { useEffect, useRef } from 'react'

/** Stars inside this distance (px) of the cursor get pushed away from it. */
const REACH = 120

/**
 * The site's night sky, on every page: many small white dots behind everything (the file viewer's
 * stage is opaque, so none show over a PDF). Each star drifts on its own
 * slow course (near ones a little faster than far ones) and twinkles; stars the cursor comes close
 * to are nudged away, then glide back to their own pace. Paused in a background tab; a single
 * still frame for "reduce motion".
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
    const mouse = { x: -9999, y: -9999 }
    // vx/vy: the star's own course; kx/ky: the push from the cursor, which fades away.
    let stars: { x: number; y: number; vx: number; vy: number; kx: number; ky: number; r: number; a: number; t: number; s: number }[] = []

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(650, Math.max(160, (w * h) / 2600)))
      stars = Array.from({ length: count }, () => {
        // Most stars are far and faint; a few are near, bigger, brighter and quicker.
        const z = Math.random() ** 2.2
        const speed = 0.04 + z * 0.22
        const dir = Math.random() * Math.PI * 2
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed,
          kx: 0,
          ky: 0,
          r: 0.35 + z * 1.15,
          a: 0.25 + z * 0.65,
          t: Math.random() * Math.PI * 2,
          s: 0.6 + Math.random() * 1.8,
        }
      })
    }

    // One round dot, drawn once per colour and stamped for every bigger star: far cheaper than a
    // fresh arc path per star per frame.
    const dot = document.createElement('canvas')
    let dotColour = ''
    const dotFor = (colour: string) => {
      if (colour === dotColour) return dot
      dot.width = dot.height = 16
      const d = dot.getContext('2d')!
      d.clearRect(0, 0, 16, 16)
      d.fillStyle = colour
      d.beginPath()
      d.arc(8, 8, 8, 0, Math.PI * 2)
      d.fill()
      dotColour = colour
      return dot
    }

    // The stars drift slowly, so 30 frames a second looks the same as 60 and halves the work.
    const STEP = 1000 / 30
    let last = 0
    const draw = (time: number) => {
      frame = 0
      if (!calm && !document.hidden && last && time - last < STEP - 2) {
        frame = requestAnimationFrame(draw)
        return
      }
      // Movement is per 60 Hz frame, scaled by the time that really passed (capped after a pause).
      const k = last ? Math.min((time - last) / (1000 / 60), 4) : 1
      last = time
      const light = document.documentElement.dataset.theme === 'light'
      const colour = light ? 'rgb(76 60 140)' : 'rgb(255 255 255)'
      const dim = light ? 0.6 : 1
      const sprite = dotFor(colour)
      const sec = time / 1000
      const decay = 0.94 ** k
      ctx.clearRect(0, 0, w, h)
      ctx.fillStyle = colour
      for (const s of stars) {
        if (!calm) {
          const dx = s.x - mouse.x
          const dy = s.y - mouse.y
          const d2 = dx * dx + dy * dy
          if (d2 < REACH * REACH && d2 > 0.000001) {
            const d = Math.sqrt(d2)
            const f = (1 - d / REACH) * 0.35 * k
            s.kx += (dx / d) * f
            s.ky += (dy / d) * f
          }
          s.kx *= decay
          s.ky *= decay
          s.x += (s.vx + s.kx) * k
          s.y += (s.vy + s.ky) * k
          if (s.x < -4) s.x = w + 4
          else if (s.x > w + 4) s.x = -4
          if (s.y < -4) s.y = h + 4
          else if (s.y > h + 4) s.y = -4
        }
        const glow = calm ? 1 : 0.75 + 0.25 * Math.sin(sec * s.s + s.t)
        ctx.globalAlpha = s.a * glow * dim
        if (s.r < 0.9) ctx.fillRect(s.x, s.y, s.r * 1.6, s.r * 1.6)
        else ctx.drawImage(sprite, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2)
      }
      ctx.globalAlpha = 1
      if (!calm && !document.hidden) frame = requestAnimationFrame(draw)
      else last = 0
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      mouse.x = e.clientX
      mouse.y = e.clientY
    }
    const away = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    const onResize = () => {
      size()
      kick()
    }

    size()
    kick()
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', away)
    document.addEventListener('visibilitychange', kick)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', away)
      document.removeEventListener('visibilitychange', kick)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 size-full print:hidden" />
}
