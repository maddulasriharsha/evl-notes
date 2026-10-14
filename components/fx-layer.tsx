'use client'

import { useEffect } from 'react'

const GLOW_REACH = 180

/**
 * The page's ambient effects, all driven from one place:
 *  - cards (`.fx-card`) whose border lights up on the side nearest the cursor, and that tilt
 *    towards it (`.fx-tilt`);
 *  - elements (`.fx-reveal`) that fade up as they scroll into view, one after another.
 * The cursor effects need a real mouse and are skipped for "reduce motion"; nothing here is needed
 * to use the site.
 */
export function FxLayer() {
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

  // ---- cursor: card glow and tilt
  useEffect(() => {
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
    const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!fine || calm) return

    let h = 0
    const mouse = { x: -9999, y: -9999, on: false }
    const spot = { x: 0, y: 0, p: 0 }
    let frame = 0
    let tilted: HTMLElement | null = null
    let cards: HTMLElement[] = []
    let cardsStale = true

    const size = () => {
      h = window.innerHeight
      kick()
    }

    const draw = () => {
      frame = 0
      // The glow trails the cursor; its strength follows whether the cursor is on the page.
      spot.x += (mouse.x - spot.x) * 0.16
      spot.y += (mouse.y - spot.y) * 0.16
      spot.p += ((mouse.on ? 1 : 0) - spot.p) * 0.1

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
        // First sight of the cursor: start the trail there instead of sweeping in from a corner.
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

  return null
}
