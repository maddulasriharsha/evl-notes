'use client'

import { useEffect, useState } from 'react'
import Link from '@/components/link'
import { ChevronLeft, ChevronRight, Megaphone, X } from 'lucide-react'
import { supabaseConfigured } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

interface Announcement {
  id: string
  message: string
  link: string | null
}

// A new key from the single-announcement days, so an old dismissal does not hide today's rotation.
const KEY = 'vj-announcements-dismissed'
const MAX = 5
const EVERY_MS = 5000

/** Ids dismissed on this device. */
function dismissed(): string[] {
  try {
    const list: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

/**
 * The active announcements (newest first, up to five), set by the admin or a moderator. With more
 * than one, the bar moves to the next every few seconds and has arrows; each can be dismissed on
 * its own, per device.
 */
export function AnnouncementBar() {
  const [items, setItems] = useState<Announcement[]>([])
  const [at, setAt] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!supabaseConfigured) return
    let live = true
    supabaseBrowser()
      .from('announcements')
      .select('id, message, link')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(MAX)
      .then(({ data, error }) => {
        if (!live || error || !data) return
        const gone = new Set(dismissed())
        setItems((data as Announcement[]).filter((a) => !gone.has(a.id)))
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (items.length < 2 || paused) return
    const t = setInterval(() => setAt((i) => (i + 1) % items.length), EVERY_MS)
    return () => clearInterval(t)
  }, [items.length, paused])

  if (items.length === 0) return null
  const item = items[at % items.length]!
  const many = items.length > 1
  const step = (by: number) => setAt((i) => (i + by + items.length) % items.length)

  function dismiss() {
    try {
      // Keep the list short: only ids that could still be shown matter.
      localStorage.setItem(KEY, JSON.stringify([...dismissed(), item.id].slice(-30)))
    } catch {
      // Storage blocked: it comes back on the next visit.
    }
    setItems((cur) => cur.filter((a) => a.id !== item.id))
    setAt(0)
  }

  const body = item.link ? (
    item.link.startsWith('/') ? (
      <Link href={item.link} className="underline underline-offset-4">
        {item.message}
      </Link>
    ) : (
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">
        {item.message}
      </a>
    )
  ) : (
    <span>{item.message}</span>
  )
  const arrow = 'grid size-7 shrink-0 place-items-center rounded-lg hover:bg-surface-2'

  return (
    <div
      role="status"
      // Pause only under a real mouse: a tap on a phone "enters" and never leaves.
      onPointerEnter={(e) => e.pointerType === 'mouse' && setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      className="flex items-center justify-center gap-2 border-b border-line bg-accent-soft px-3 py-2 text-center text-sm text-ink"
    >
      {many && (
        <button type="button" aria-label="Previous announcement" onClick={() => step(-1)} className={arrow}>
          <ChevronLeft className="size-4" />
        </button>
      )}
      <Megaphone className="size-4 shrink-0 text-accent" />
      <p key={item.id} className="page-in min-w-0 break-words">
        {body}
      </p>
      {many && (
        <>
          <span className="shrink-0 text-xs text-ink-3 tabular-nums">
            {(at % items.length) + 1}/{items.length}
          </span>
          <button type="button" aria-label="Next announcement" onClick={() => step(1)} className={arrow}>
            <ChevronRight className="size-4" />
          </button>
        </>
      )}
      <button type="button" aria-label="Dismiss announcement" onClick={dismiss} className={arrow}>
        <X className="size-4" />
      </button>
    </div>
  )
}
