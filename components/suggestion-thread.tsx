'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, MessageSquareLock, Send } from 'lucide-react'
import { timeAgo } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/browser'

export interface ThreadReply {
  id: string
  from_staff: boolean
  body: string
  created_at: string
}

/**
 * A private chat on one suggestion, between whoever made it and the staff. Others can neither see
 * it nor join it (the database enforces that). The author can answer once staff have written.
 */
export function SuggestionThread({
  suggestionId,
  userId,
  viewerIsStaff,
  replies,
  unread = false,
}: {
  suggestionId: string
  userId: string
  viewerIsStaff: boolean
  replies: ThreadReply[]
  /** The author has not opened the staff's latest reply yet. */
  unread?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const staffWrote = replies.some((r) => r.from_staff)
  const canWrite = viewerIsStaff || staffWrote

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && unread && !viewerIsStaff) {
      await supabaseBrowser().rpc('mark_suggestion_read', { p_id: suggestionId })
      router.refresh()
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const body = text.trim()
    if (!body) return
    setBusy(true)
    setError(null)
    const { error: err } = await supabaseBrowser().from('suggestion_replies').insert({ suggestion_id: suggestionId, author_id: userId, body })
    setBusy(false)
    if (err) return setError(err.message)
    setText('')
    router.refresh()
  }

  const label = viewerIsStaff
    ? replies.length
      ? `Private chat (${replies.length})`
      : 'Reply privately'
    : replies.length
      ? `Replies from the team (${replies.length})`
      : null

  if (!label) return null

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => void toggle()}
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 text-xs font-medium text-ink-2 hover:border-line-strong hover:text-ink"
      >
        <MessageSquareLock className="size-3.5" />
        {label}
        {unread && !viewerIsStaff && <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-ink">New</span>}
      </button>
      {open && (
        <div className="mt-2 rounded-xl border border-line bg-bg p-3">
          <p className="mb-2 text-[11px] text-ink-3">
            {viewerIsStaff
              ? 'Private: only the admins and moderators and the person who suggested this can see this chat.'
              : 'Private: only you and the VJNOTES team can see this.'}
          </p>
          {replies.length > 0 && (
            <ul className="mb-3 space-y-2">
              {replies.map((r) => {
                const mine = viewerIsStaff ? r.from_staff : !r.from_staff
                return (
                  <li key={r.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-accent-soft' : 'bg-surface-2'}`}>
                      <p className="mb-0.5 text-[10px] font-semibold tracking-wider text-ink-3 uppercase">
                        {r.from_staff ? 'VJNOTES team' : viewerIsStaff ? 'Student' : 'You'} · {timeAgo(r.created_at)}
                      </p>
                      <p className="break-words whitespace-pre-line">{r.body}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {canWrite && (
            <form onSubmit={send} className="flex items-end gap-2">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, 1000))}
                rows={2}
                placeholder={viewerIsStaff ? 'Write a private reply…' : 'Write back…'}
                aria-label="Reply"
                className="min-h-10 flex-1 resize-y rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                disabled={busy || !text.trim()}
                className="btn-primary inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}
