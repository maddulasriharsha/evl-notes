'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, Flag, Loader2, ThumbsUp, X } from 'lucide-react'
import { refreshFile } from '@/app/upload/actions'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

const btn = 'inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-50'

function useLogin() {
  const router = useRouter()
  return (fileId: string) => router.push(`/login?next=${encodeURIComponent(`/view/u/${fileId}`)}`)
}

/** One tap to say a note was useful. Not on your own notes; one vote per person. */
export function HelpfulButton({
  fileId,
  ownerId,
  subject,
  unit,
  initialCount,
}: {
  fileId: string
  ownerId: string
  subject: string
  unit: number
  initialCount: number
}) {
  const viewer = useViewer()
  const login = useLogin()
  const [count, setCount] = useState(initialCount)
  const [mine, setMine] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!viewer) return
    let live = true
    supabaseBrowser()
      .from('file_votes')
      .select('file_id')
      .eq('file_id', fileId)
      .eq('user_id', viewer.id)
      .maybeSingle()
      .then(({ data }) => live && setMine(!!data))
    return () => {
      live = false
    }
  }, [viewer, fileId])

  const own = viewer?.id === ownerId

  async function toggle() {
    if (!viewer) return login(fileId)
    if (own || busy) return
    setBusy(true)
    const db = supabaseBrowser().from('file_votes')
    const { error } = mine
      ? await db.delete().eq('file_id', fileId).eq('user_id', viewer.id)
      : await db.insert({ file_id: fileId, user_id: viewer.id })
    setBusy(false)
    if (error) return alert(error.message)
    setMine(!mine)
    setCount((c) => Math.max(0, c + (mine ? -1 : 1)))
    void refreshFile(fileId, subject, unit)
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={mine}
      title={own ? 'You cannot vote on your own note' : mine ? 'Remove your vote' : 'This note helped me'}
      className={`${btn} ${mine ? 'border-accent bg-accent-soft text-accent' : ''} ${own ? 'cursor-not-allowed opacity-60' : ''}`}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <ThumbsUp className="size-4" />}
      <span className="tabular-nums">{count}</span>
      <span className="hidden md:inline">Helpful</span>
    </button>
  )
}

/** Saves a note to the signed-in person's private "Saved" list. */
export function SaveButton({ fileId }: { fileId: string }) {
  const viewer = useViewer()
  const login = useLogin()
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!viewer) return
    let live = true
    supabaseBrowser()
      .from('bookmarks')
      .select('file_id')
      .eq('file_id', fileId)
      .eq('user_id', viewer.id)
      .maybeSingle()
      .then(({ data }) => live && setSaved(!!data))
    return () => {
      live = false
    }
  }, [viewer, fileId])

  async function toggle() {
    if (!viewer) return login(fileId)
    setBusy(true)
    const db = supabaseBrowser().from('bookmarks')
    const { error } = saved
      ? await db.delete().eq('file_id', fileId).eq('user_id', viewer.id)
      : await db.insert({ file_id: fileId, user_id: viewer.id })
    setBusy(false)
    if (error) return alert(error.message)
    setSaved(!saved)
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved} title={saved ? 'Remove from Saved' : 'Save for later'} className={`${btn} ${saved ? 'border-accent bg-accent-soft text-accent' : ''}`}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : saved ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
      <span className="hidden md:inline">{saved ? 'Saved' : 'Save'}</span>
    </button>
  )
}

const REASONS: [string, string][] = [
  ['broken', 'Broken: does not open or pages are missing'],
  ['wrong_place', 'Wrong subject or chapter'],
  ['low_quality', 'Unreadable or low quality'],
  ['duplicate', 'Duplicate of another note'],
  ['inappropriate', 'Inappropriate content'],
  ['copyright', 'Copyrighted material'],
  ['spam', 'Spam or advertising'],
  ['other', 'Something else'],
]

/** "Report" for a note or a comment. Reports go to the moderators; the reporter stays private. */
export function ReportButton({
  fileId,
  commentId,
  compact,
  fileFor,
}: {
  fileId?: string
  commentId?: string
  compact?: boolean
  /** The note to return to after signing in (used for comments). */
  fileFor?: string
}) {
  const viewer = useViewer()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('broken')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    if (!viewer) return
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser()
      .from('reports')
      .insert({
        reporter_id: viewer.id,
        file_id: fileId ?? null,
        comment_id: commentId ?? null,
        reason,
        details: details.trim() || null,
      })
    setBusy(false)
    if (error) {
      return setError(error.code === '23505' ? 'You have already reported this. The moderators will look at it.' : error.message)
    }
    setDone('Thanks. The moderators will take a look.')
    setDetails('')
  }

  function start() {
    if (!viewer) return router.push(`/login?next=${encodeURIComponent(`/view/u/${fileId ?? fileFor ?? ''}`)}`)
    setDone(null)
    setError(null)
    setOpen(true)
  }

  return (
    <>
      <button
        type="button"
        onClick={start}
        title="Report a problem"
        aria-label="Report"
        className={compact ? 'text-ink-3 opacity-60 hover:text-danger hover:opacity-100' : btn}
      >
        <Flag className={compact ? 'size-3.5' : 'size-4'} />
        {!compact && <span className="hidden lg:inline">Report</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <form onSubmit={send} onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Report {commentId ? 'comment' : 'note'}</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>
            {done ? (
              <p className="mt-4 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{done}</p>
            ) : (
              <>
                <fieldset className="mt-4 space-y-1.5">
                  {REASONS.map(([id, label]) => (
                    <label key={id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${reason === id ? 'border-accent bg-accent-soft' : 'border-line'}`}>
                      <input type="radio" name="reason" value={id} checked={reason === id} onChange={() => setReason(id)} className="accent-[var(--accent)]" />
                      {label}
                    </label>
                  ))}
                </fieldset>
                <textarea
                  value={details}
                  onChange={(e) => setDetails(e.target.value.slice(0, 500))}
                  rows={2}
                  placeholder="Anything we should know? (optional)"
                  className="mt-3 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
                />
                {error && <p className="mt-2 text-sm text-danger">{error}</p>}
                <button disabled={busy} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-ink text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">
                  {busy && <Loader2 className="size-4 animate-spin" />} Send report
                </button>
              </>
            )}
          </form>
        </div>
      )}
    </>
  )
}

const RECENT_KEY = 'vj-recent'
export interface RecentNote {
  id: string
  name: string
  subject: string
  unit: number
  at: number
}

/** Remembers, in this browser only, the last notes opened so they can be found again quickly. */
export function RecordView({ id, name, subject, unit }: { id: string; name: string; subject: string; unit: number }) {
  useEffect(() => {
    try {
      const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentNote[]
      const next = [{ id, name, subject, unit, at: Date.now() }, ...list.filter((n) => n.id !== id)].slice(0, 20)
      localStorage.setItem(RECENT_KEY, JSON.stringify(next))
    } catch {
      // Private mode or blocked storage: simply not remembered.
    }
  }, [id, name, subject, unit])
  return null
}

export function readRecent(): RecentNote[] {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
    return Array.isArray(list) ? (list as RecentNote[]) : []
  } catch {
    return []
  }
}
