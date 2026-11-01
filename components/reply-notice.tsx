'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from '@/components/link'
import { MessageSquareReply, X } from 'lucide-react'
import { supabaseConfigured } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

const KEY = 'vj-reply-notice-dismissed'

/**
 * A bar across the top, on any page, when the team has replied to one of your suggestions and you
 * have not opened the reply yet. It checks again on every page you move to, and the dismissal lasts
 * until a newer reply arrives.
 */
export function ReplyNotice() {
  const pathname = usePathname()
  const [latest, setLatest] = useState<{ count: number; at: string } | null>(null)
  const [hidden, setHidden] = useState<string | null>(null)

  useEffect(() => {
    try {
      setHidden(sessionStorage.getItem(KEY))
    } catch {
      /* no storage: the bar just comes back on the next page */
    }
  }, [])

  useEffect(() => {
    if (!supabaseConfigured || pathname === '/suggest') return setLatest(null)
    let live = true
    void (async () => {
      const supabase = supabaseBrowser()
      const { data: auth } = await supabase.auth.getUser()
      if (!auth.user || !live) return setLatest(null)
      const { data: mine } = await supabase.from('suggestions').select('id, author_seen_at').eq('author_id', auth.user.id)
      const rows = (mine ?? []) as { id: string; author_seen_at: string | null }[]
      if (!rows.length || !live) return setLatest(null)
      const { data: replies } = await supabase
        .from('suggestion_replies')
        .select('suggestion_id, created_at')
        .eq('from_staff', true)
        .in('suggestion_id', rows.map((r) => r.id))
      if (!live) return
      const seen = new Map(rows.map((r) => [r.id, r.author_seen_at]))
      const fresh = ((replies ?? []) as { suggestion_id: string; created_at: string }[]).filter((r) => {
        const s = seen.get(r.suggestion_id)
        return !s || r.created_at > s
      })
      if (!fresh.length) return setLatest(null)
      setLatest({ count: new Set(fresh.map((r) => r.suggestion_id)).size, at: fresh.map((r) => r.created_at).sort().at(-1)! })
    })().catch(() => live && setLatest(null))
    return () => {
      live = false
    }
  }, [pathname])

  if (!latest || hidden === latest.at) return null

  return (
    <div role="status" className="relative z-30 border-b border-accent/30 bg-accent-soft">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        <MessageSquareReply className="size-4 shrink-0 text-accent" />
        <Link href="/suggest" className="min-w-0 flex-1 truncate font-medium hover:underline">
          {latest.count === 1 ? 'The VJNOTES team replied to your suggestion.' : `The VJNOTES team replied to ${latest.count} of your suggestions.`} <span className="text-accent">Read it →</span>
        </Link>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={() => {
            setHidden(latest.at)
            try {
              sessionStorage.setItem(KEY, latest.at)
            } catch {
              /* ignore */
            }
          }}
          className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-surface/60"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  )
}
