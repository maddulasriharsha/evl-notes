'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react'

/**
 * The area a file is shown in: side arrows to the previous and next file (also the ← → keys),
 * and a full-screen button.
 */
export function ViewerStage({ prev, next, children }: { prev?: string; next?: string; children: React.ReactNode }) {
  const stage = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const [full, setFull] = useState(false)
  const [canFull, setCanFull] = useState(false)

  useEffect(() => {
    setCanFull(typeof document !== 'undefined' && !!document.fullscreenEnabled)
    const onChange = () => setFull(document.fullscreenElement === stage.current)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (e.altKey || e.ctrlKey || e.metaKey || (t && /^(input|textarea|select)$/i.test(t.tagName)) || t?.isContentEditable) return
      if (e.key === 'ArrowLeft' && prev) router.push(prev)
      if (e.key === 'ArrowRight' && next) router.push(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, router])

  function toggle() {
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined)
    else void stage.current?.requestFullscreen().catch(() => undefined)
  }

  const side = 'absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full border border-line bg-bg/85 text-ink-2 shadow-card backdrop-blur transition hover:border-accent hover:text-accent md:grid'

  return (
    <div ref={stage} className="relative min-h-0 flex-1 bg-surface-2">
      {children}
      {prev && !full && (
        <Link href={prev} aria-label="Previous file" title="Previous file (←)" className={`${side} left-3`}>
          <ChevronLeft className="size-5" />
        </Link>
      )}
      {next && !full && (
        <Link href={next} aria-label="Next file" title="Next file (→)" className={`${side} right-3`}>
          <ChevronRight className="size-5" />
        </Link>
      )}
      {canFull && (
        <button
          type="button"
          onClick={toggle}
          aria-label={full ? 'Leave full screen' : 'Full screen'}
          title={full ? 'Leave full screen (Esc)' : 'Full screen'}
          className="absolute bottom-3 left-3 z-10 grid size-10 place-items-center rounded-xl border border-line bg-bg/85 text-ink-2 shadow-card backdrop-blur transition hover:border-accent hover:text-accent"
        >
          {full ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
      )}
    </div>
  )
}
