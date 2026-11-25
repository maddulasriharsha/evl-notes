'use client'

import { useEffect, useState } from 'react'
import { Zap } from 'lucide-react'

/**
 * Lite mode: no star field, glow or blur effects, no intro, and animations switched off. It turns on
 * by itself on phones with Data Saver on (the layout script reads that), and here anyone can switch it
 * on or off for themselves. The choice stays on this device only.
 */
export function LiteToggle({ className }: { className?: string }) {
  const [lite, setLite] = useState(false)
  useEffect(() => setLite(document.documentElement.classList.contains('lite')), [])

  function toggle() {
    const next = !lite
    setLite(next)
    document.documentElement.classList.toggle('lite', next)
    try {
      localStorage.setItem('vj-lite', next ? '1' : '0')
    } catch {
      /* storage unavailable: it still applies until the page reloads */
    }
  }

  return (
    <button type="button" onClick={toggle} aria-pressed={lite} title="Fewer effects: faster on slow phones and saves data" className={className}>
      <Zap className="size-4" /> Lite mode: {lite ? 'on' : 'off'}
    </button>
  )
}
