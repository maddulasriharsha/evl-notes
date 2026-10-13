'use client'

import { useEffect, useRef, useState } from 'react'

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN')

/** A number that counts up from zero the first time it scrolls into view. */
export function CountUp({ value, ms = 1100 }: { value: number; ms?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el || value <= 0 || matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return
    setShown(0)
    let frame = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / ms)
          // Ease out: fast at first, settling on the real number.
          setShown(value * (1 - (1 - t) ** 3))
          if (t < 1) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, ms])

  return (
    <span ref={ref} className="tabular-nums">
      {fmt(shown)}
    </span>
  )
}
