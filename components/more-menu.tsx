'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'

/**
 * A "More" button that opens the less-used actions in a small panel, so the bar above a note stays
 * one short row. The panel is fixed to the screen, so a scrolling bar cannot clip it.
 */
export function MoreMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState({ top: 0, right: 12 })
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  function toggle() {
    const r = button.current?.getBoundingClientRect()
    if (r) setAt({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    setOpen((o) => !o)
  }

  useEffect(() => {
    if (!open) return
    const away = (e: Event) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', () => setOpen(false), { once: true })
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', key)
    }
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="true"
        className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-2"
      >
        <MoreHorizontal className="size-4" />
        <span className="hidden sm:inline">More</span>
      </button>
      {open && (
        <div
          ref={panel}
          style={{ top: at.top, right: at.right }}
          className="fixed z-50 flex w-[min(92vw,20rem)] flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-3 shadow-pop"
        >
          {children}
        </div>
      )}
    </>
  )
}
