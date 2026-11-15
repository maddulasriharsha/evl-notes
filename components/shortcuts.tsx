'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Keyboard, X } from 'lucide-react'

/** True while the person is typing somewhere, so single-key shortcuts stay out of the way. */
function typing(e: KeyboardEvent) {
  const el = e.target as HTMLElement | null
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))
}

const plain = (e: KeyboardEvent) => !e.ctrlKey && !e.metaKey && !e.altKey && !typing(e)

/**
 * On a chapter page: the left and right arrow keys open the previous and next chapter, like turning
 * a page. The links themselves are ordinary links below; this only adds the keys.
 */
export function ChapterKeys({ prev, next }: { prev?: string; next?: string }) {
  const router = useRouter()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!plain(e) || e.shiftKey || e.defaultPrevented) return
      // A dialog (palette, QR, shortcuts) is open: its own keys come first.
      if (document.querySelector('[role="dialog"]')) return
      const to = e.key === 'ArrowLeft' ? prev : e.key === 'ArrowRight' ? next : undefined
      if (!to) return
      e.preventDefault()
      router.push(to)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, router])
  return null
}

const KEYS: { keys: string[]; what: string }[] = [
  { keys: ['Ctrl', 'K'], what: 'Jump to a subject, chapter or file' },
  { keys: ['/'], what: 'Search' },
  { keys: ['←', '→'], what: 'Previous or next chapter (on a chapter page)' },
  { keys: ['Esc'], what: 'Close a dialog or menu' },
  { keys: ['?'], what: 'Show these shortcuts' },
]

/** Press "?" anywhere to see the keyboard shortcuts. */
export function ShortcutSheet() {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return setOpen(false)
      if (e.key === '?' && plain(e)) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) box.current?.focus()
  }, [open])

  if (!open) return null
  return (
    <div className="palette-in fixed inset-0 z-[90] grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="palette-box w-full max-w-md rounded-2xl border border-line bg-surface p-5 shadow-pop outline-none"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="shortcuts-title" className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
            <Keyboard className="size-5 text-accent" /> Keyboard shortcuts
          </h2>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="btn-ghost grid size-8 place-items-center rounded-lg text-ink-2 hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <ul className="mt-4 divide-y divide-line">
          {KEYS.map((k) => (
            <li key={k.what} className="flex items-center justify-between gap-4 py-2.5 text-sm">
              <span className="text-ink-2">{k.what}</span>
              <span className="flex shrink-0 gap-1">
                {k.keys.map((key) => (
                  <kbd key={key} className="min-w-7 rounded-md border border-line-strong bg-surface-2 px-1.5 py-0.5 text-center font-mono text-xs text-ink">
                    {key}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
