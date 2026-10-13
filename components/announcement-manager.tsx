'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Megaphone } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { timeAgo } from '@/lib/format'

export interface AnnouncementRow {
  id: string
  message: string
  link: string | null
  active: boolean
  created_at: string
}

/** Post a one-line announcement and switch old ones off. Staff only (enforced by the database). */
export function AnnouncementManager({ userId, items }: { userId: string; items: AnnouncementRow[] }) {
  const router = useRouter()
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function post(e: React.FormEvent) {
    e.preventDefault()
    const text = message.trim()
    if (!text) return
    const target = link.trim()
    if (target && !/^(\/[^/]|https:\/\/\S+$)/.test(target)) {
      return setError('The link must start with / (a page on this site) or https://')
    }
    setBusy('post')
    setError(null)
    const { error } = await supabaseBrowser()
      .from('announcements')
      .insert({ message: text.slice(0, 200), link: target || null, created_by: userId })
    setBusy(null)
    if (error) return setError(error.message)
    setMessage('')
    setLink('')
    router.refresh()
  }

  async function toggle(row: AnnouncementRow) {
    setBusy(row.id)
    setError(null)
    const { error } = await supabaseBrowser().from('announcements').update({ active: !row.active }).eq('id', row.id)
    setBusy(null)
    if (error) return setError(error.message)
    router.refresh()
  }

  return (
    <div className="max-w-2xl">
      <form onSubmit={post} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="flex items-center gap-2 font-semibold">
          <Megaphone className="size-4 text-accent" /> New announcement
        </h2>
        <p className="mt-1 text-xs text-ink-3">Shown as a bar at the top of the site. Up to five active announcements take turns in the bar, newest first; switch one off below to stop showing it. Visitors can dismiss each one.</p>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 200))}
          placeholder="e.g. Mid-2 question papers are up for every subject"
          aria-label="Announcement"
          className="mt-3 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
        />
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="Link (optional), e.g. /requests"
          aria-label="Link"
          className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button disabled={busy === 'post' || !message.trim()} className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40">
          {busy === 'post' && <Loader2 className="size-4 animate-spin" />} Post announcement
        </button>
      </form>

      <ul className="mt-5 space-y-2">
        {items.map((a) => (
          <li key={a.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className={`break-words text-sm ${a.active ? '' : 'text-ink-3 line-through'}`}>{a.message}</p>
              <p className="text-xs text-ink-3">
                {timeAgo(a.created_at)}
                {a.link && ` · ${a.link}`}
              </p>
            </div>
            <button
              type="button"
              disabled={busy === a.id}
              onClick={() => toggle(a)}
              className="h-8 shrink-0 rounded-lg border border-line px-2.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50"
            >
              {a.active ? 'Turn off' : 'Turn on'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
