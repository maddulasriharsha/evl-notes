'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Megaphone, X } from 'lucide-react'
import { supabaseConfigured } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

interface Announcement {
  id: string
  message: string
  link: string | null
}

const KEY = 'vj-announcement-dismissed'

/** The newest active announcement, set by the admin or a moderator. Dismissed per device. */
export function AnnouncementBar() {
  const [item, setItem] = useState<Announcement | null>(null)

  useEffect(() => {
    if (!supabaseConfigured) return
    let live = true
    supabaseBrowser()
      .from('announcements')
      .select('id, message, link')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!live || error || !data) return
        const a = data as Announcement
        try {
          if (localStorage.getItem(KEY) === a.id) return
        } catch {
          // Storage blocked: show it every time.
        }
        setItem(a)
      })
    return () => {
      live = false
    }
  }, [])

  if (!item) return null

  const text = item.message
  const body = item.link ? (
    item.link.startsWith('/') ? (
      <Link href={item.link} className="underline underline-offset-4">{text}</Link>
    ) : (
      <a href={item.link} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{text}</a>
    )
  ) : (
    <span>{text}</span>
  )

  return (
    <div role="status" className="flex items-center justify-center gap-3 border-b border-line bg-accent-soft px-4 py-2 text-center text-sm text-ink">
      <Megaphone className="size-4 shrink-0 text-accent" />
      <p className="min-w-0 break-words">{body}</p>
      <button
        type="button"
        aria-label="Dismiss announcement"
        onClick={() => {
          try {
            localStorage.setItem(KEY, item.id)
          } catch {
            // ignore
          }
          setItem(null)
        }}
        className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-surface-2"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
