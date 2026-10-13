'use client'

import { useEffect, useRef } from 'react'

const LINK = 120
const SHY = 140

/**
 * The home hero's sky: slow particles that join with thin lines when they pass close, and that
 * step aside from the cursor (which also draws lines to the ones near it). Paused when off screen
 * or in a background tab; a single still frame for "reduce motion".
 */
export function HeroStars() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let frame = 0
    let seen = true
    const mouse = { x: -9999, y: -9999 }
    let stars: { x: number; y: number; vx: number; vy: number; r: number }[] = []

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const box = canvas.getBoundingClientRect()
      w = box.width
      h = box.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(90, Math.max(28, (w * h) / 13000)))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        r: 0.7 + Math.random() * 1.1,
      }))
    }

    const draw = () => {
      frame = 0
      const light = document.documentElement.dataset.theme === 'light'
      const rgb = light ? '98 64 224' : '196 181 253'
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        s.x += s.vx
        s.y += s.vy
        const dx = s.x - mouse.x
        const dy = s.y - mouse.y
        const d = Math.hypot(dx, dy)
        if (d < SHY && d > 0.001) {
          const f = (1 - d / SHY) * 1.4
          s.x += (dx / d) * f
          s.y += (dy / d) * f
        }
        if (s.x < -10) s.x = w + 10
        else if (s.x > w + 10) s.x = -10
        if (s.y < -10) s.y = h + 10
        else if (s.y > h + 10) s.y = -10
      }
      ctx.lineWidth = 1
      for (let i = 0; i < stars.length; i++) {
        const a = stars[i]!
        for (let j = i + 1; j < stars.length; j++) {
          const b = stars[j]!
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d > LINK) continue
          ctx.strokeStyle = `rgb(${rgb} / ${(1 - d / LINK) * (light ? 0.28 : 0.2)})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(b.x, b.y)
          ctx.stroke()
        }
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y)
        if (dm < LINK * 1.5) {
          ctx.strokeStyle = `rgb(${rgb} / ${(1 - dm / (LINK * 1.5)) * 0.45})`
          ctx.beginPath()
          ctx.moveTo(a.x, a.y)
          ctx.lineTo(mouse.x, mouse.y)
          ctx.stroke()
        }
        ctx.fillStyle = `rgb(${rgb} / ${light ? 0.75 : 0.7})`
        ctx.beginPath()
        ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (!calm && seen && !document.hidden) frame = requestAnimationFrame(draw)
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    const move = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      const box = canvas.getBoundingClientRect()
      mouse.x = e.clientX - box.left
      mouse.y = e.clientY - box.top
    }
    const away = () => {
      mouse.x = -9999
      mouse.y = -9999
    }
    const io = new IntersectionObserver(([entry]) => {
      seen = !!entry?.isIntersecting
      if (seen) kick()
    })
    const onResize = () => {
      size()
      kick()
    }

    size()
    kick()
    io.observe(canvas)
    window.addEventListener('resize', onResize)
    window.addEventListener('pointermove', move, { passive: true })
    document.documentElement.addEventListener('pointerleave', away)
    document.addEventListener('visibilitychange', kick)
    return () => {
      cancelAnimationFrame(frame)
      io.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', move)
      document.documentElement.removeEventListener('pointerleave', away)
      document.removeEventListener('visibilitychange', kick)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 size-full" />
}
