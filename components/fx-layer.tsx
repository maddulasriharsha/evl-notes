'use client'

import { useEffect, useRef } from 'react'

const GAP = 30
const REACH = 150
const SPOT = 380
const GLOW_REACH = 180

/**
 * The page's ambient effects, all driven from one place:
 *  - a fixed canvas behind everything: a faint dot grid whose dots swell and move away from the
 *    cursor, under a soft spotlight that trails it;
 *  - cards (`.fx-card`) whose border lights up on the side nearest the cursor, and that tilt
 *    towards it (`.fx-tilt`);
 *  - elements (`.fx-reveal`) that fade up as they scroll into view, one after another.
 * The cursor effects need a real mouse and are skipped for "reduce motion"; nothing here is needed
 * to use the site.
 */
export function FxLayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // ---- scroll reveals
  useEffect(() => {
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    const show = (el: Element) => el.classList.add('in')
    if (calm || !('IntersectionObserver' in window)) {
      document.querySelectorAll('.fx-reveal').forEach(show)
      return
    }
    const io = new IntersectionObserver(
      (entries) => {
        let n = 0
        for (const e of entries) {
          if (!e.isIntersecting) continue
          const el = e.target as HTMLElement
          el.style.transitionDelay = `${Math.min(n++, 8) * 55}ms`
          show(el)
          io.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 },
    )
    const scan = () => document.querySelectorAll('.fx-reveal:not(.in)').forEach((el) => io.observe(el))
    scan()
    // New pages and streamed-in content bring new elements.
    let queued = 0
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(queued)
      queued = requestAnimationFrame(scan)
    })
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      io.disconnect()
      mo.disconnect()
      cancelAnimationFrame(queued)
    }
  }, [])

  // ---- cursor: grid, spotlight, card glow and tilt
  useEffect(() => {
    const canvas = canvasRef.current
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!canvas || !fine || calm) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let w = 0
    let h = 0
    const mouse = { x: -9999, y: -9999, on: false }
    const spot = { x: 0, y: 0, p: 0 }
    let frame = 0
    let tilted: HTMLElement | null = null
    let cards: HTMLElement[] = []
    let cardsStale = true

    const size = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth
      h = window.innerHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      kick()
    }

    const draw = () => {
      frame = 0
      const light = document.documentElement.dataset.theme === 'light'
      const rgb = light ? '98 64 224' : '167 139 250'
      // The spotlight trails the cursor; its strength follows whether the cursor is on the page.
      spot.x += (mouse.x - spot.x) * 0.16
      spot.y += (mouse.y - spot.y) * 0.16
      spot.p += ((mouse.on ? 1 : 0) - spot.p) * 0.1

      ctx.clearRect(0, 0, w, h)
      if (spot.p > 0.01) {
        const g = ctx.createRadialGradient(spot.x, spot.y, 0, spot.x, spot.y, SPOT)
        g.addColorStop(0, `rgb(${rgb} / ${(light ? 0.1 : 0.13) * spot.p})`)
        g.addColorStop(1, `rgb(${rgb} / 0)`)
        ctx.fillStyle = g
        ctx.fillRect(spot.x - SPOT, spot.y - SPOT, SPOT * 2, SPOT * 2)
      }
      const base = light ? 0.11 : 0.085
      for (let y = GAP / 2; y < h; y += GAP) {
        for (let x = GAP / 2; x < w; x += GAP) {
          const dx = x - spot.x
          const dy = y - spot.y
          const d = Math.hypot(dx, dy)
          const f = d < REACH ? (1 - d / REACH) ** 2 * spot.p : 0
          const push = f * 9
          const px = d > 0.001 ? x + (dx / d) * push : x
          const py = d > 0.001 ? y + (dy / d) * push : y
          ctx.fillStyle = `rgb(${rgb} / ${base + f * 0.6})`
          ctx.beginPath()
          ctx.arc(px, py, 1 + f * 1.7, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      // Cards: light the border nearest the cursor.
      if (cardsStale) {
        cards = Array.from(document.querySelectorAll<HTMLElement>('.fx-card'))
        cardsStale = false
      }
      for (const el of cards) {
        const r = el.getBoundingClientRect()
        if (r.bottom < -GLOW_REACH || r.top > h + GLOW_REACH) continue
        const nx = Math.max(r.left, Math.min(mouse.x, r.right))
        const ny = Math.max(r.top, Math.min(mouse.y, r.bottom))
        const near = mouse.on ? Math.max(0, 1 - Math.hypot(mouse.x - nx, mouse.y - ny) / GLOW_REACH) : 0
        const was = el.dataset.glow === '1'
        if (near > 0) {
          el.style.setProperty('--mx', `${mouse.x - r.left}px`)
          el.style.setProperty('--my', `${mouse.y - r.top}px`)
          el.style.setProperty('--glow', near.toFixed(3))
          el.dataset.glow = '1'
        } else if (was) {
          el.style.setProperty('--glow', '0')
          delete el.dataset.glow
        }
      }

      const settled = Math.abs(mouse.x - spot.x) < 0.4 && Math.abs(mouse.y - spot.y) < 0.4 && Math.abs((mouse.on ? 1 : 0) - spot.p) < 0.01
      if (!settled) kick()
    }
    const kick = () => {
      if (!frame) frame = requestAnimationFrame(draw)
    }

    const untilt = () => {
      if (!tilted) return
      tilted.style.transform = ''
      delete tilted.dataset.tilt
      tilted = null
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType && e.pointerType !== 'mouse') return
      if (!mouse.on) {
        // First sight of the cursor: start the spotlight there instead of sweeping in from a corner.
        spot.x = e.clientX
        spot.y = e.clientY
      }
      mouse.x = e.clientX
      mouse.y = e.clientY
      mouse.on = true
      const el = (e.target as Element | null)?.closest?.<HTMLElement>('.fx-tilt') ?? null
      if (el !== tilted) untilt()
      if (el) {
        const r = el.getBoundingClientRect()
        const tx = (e.clientX - r.left) / r.width - 0.5
        const ty = (e.clientY - r.top) / r.height - 0.5
        el.style.transform = `perspective(900px) rotateX(${(-ty * 5).toFixed(2)}deg) rotateY(${(tx * 6).toFixed(2)}deg) translateY(-2px)`
        el.dataset.tilt = '1'
        tilted = el
      }
      kick()
    }
    const leave = () => {
      mouse.on = false
      untilt()
      kick()
    }
    const scroll = () => {
      // Cards move under a still cursor.
      if (mouse.on) kick()
    }
    const stale = new MutationObserver(() => {
      cardsStale = true
    })

    size()
    stale.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('resize', size)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', scroll, { passive: true })
    document.documentElement.addEventListener('pointerleave', leave)
    window.addEventListener('blur', leave)
    return () => {
      cancelAnimationFrame(frame)
      stale.disconnect()
      window.removeEventListener('resize', size)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', scroll)
      document.documentElement.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', leave)
      untilt()
    }
  }, [])

  return <canvas ref={canvasRef} aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 size-full print:hidden" />
}
