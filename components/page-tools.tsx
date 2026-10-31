'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookmarkCheck, Check, Flag, Loader2, Trash2, X } from 'lucide-react'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

export interface PageMark {
  id: string
  user_id: string
  page: number
  kind: 'bookmark' | 'flag'
  note: string | null
}

/** Where a person stopped reading a note. Kept in this browser; signed-in people also get it on other devices. */
export const progressKey = (fileId: string) => `evl:read:${fileId}`

export interface Progress {
  page: number
  pages: number
}

export function readProgress(fileId: string): Progress | null {
  try {
    const v = JSON.parse(localStorage.getItem(progressKey(fileId)) ?? 'null') as Progress | null
    return v && v.page >= 1 && v.pages >= 1 ? v : null
  } catch {
    return null
  }
}

export function writeProgress(fileId: string, p: Progress) {
  try {
    localStorage.setItem(progressKey(fileId), JSON.stringify(p))
  } catch {
    /* private window: the place just is not remembered here */
  }
}

/** The bookmarks (private) and flags (public) on one note, with add and remove. */
export function usePageMarks(fileId?: string) {
  const viewer = useViewer()
  const router = useRouter()
  const [marks, setMarks] = useState<PageMark[]>([])

  useEffect(() => {
    if (!fileId) return
    let live = true
    void supabaseBrowser()
      .from('page_marks')
      .select('id, user_id, page, kind, note, resolved_at')
      .eq('file_id', fileId)
      .order('page')
      .then(({ data }) => {
        if (live) setMarks(((data ?? []) as (PageMark & { resolved_at: string | null })[]).filter((m) => !m.resolved_at))
      })
    return () => {
      live = false
    }
  }, [fileId, viewer?.id])

  async function add(page: number, kind: PageMark['kind'], note?: string): Promise<string | null> {
    if (!fileId) return null
    if (!viewer) {
      router.push(`/login?next=${encodeURIComponent(`/view/u/${fileId}`)}`)
      return null
    }
    const { data, error } = await supabaseBrowser()
      .from('page_marks')
      .insert({
        file_id: fileId,
        user_id: viewer.id,
        page,
        kind,
        note: note?.trim() || null,
      })
      .select('id, user_id, page, kind, note')
      .single()
    if (error) return error.code === '23505' ? null : error.message
    setMarks((m) => [...m, data as PageMark].sort((a, b) => a.page - b.page))
    return null
  }

  async function remove(id: string) {
    const { error } = await supabaseBrowser().from('page_marks').delete().eq('id', id)
    if (!error) setMarks((m) => m.filter((x) => x.id !== id))
    return error?.message ?? null
  }

  async function resolve(id: string) {
    const { error } = await supabaseBrowser().rpc('staff_resolve_page_flag', {
      p_id: id,
    })
    if (!error) setMarks((m) => m.filter((x) => x.id !== id))
    return error?.message ?? null
  }

  const isStaff = viewer?.role === 'moderator' || viewer?.role === 'admin'
  return { marks, viewer, isStaff, add, remove, resolve }
}

export type PageMarks = ReturnType<typeof usePageMarks>

const chip = 'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium hover:bg-surface-2 disabled:opacity-50'

/** Bookmark and flag buttons for the page being read. */
export function PageMarkButtons({ page, tools }: { page: number; tools: PageMarks }) {
  const [flagging, setFlagging] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const mine = tools.marks.find((m) => m.kind === 'bookmark' && m.page === page && m.user_id === tools.viewer?.id)

  async function toggleBookmark() {
    setBusy(true)
    setError(null)
    const err = mine ? await tools.remove(mine.id) : await tools.add(page, 'bookmark')
    setBusy(false)
    if (err) setError(err)
  }

  async function sendFlag(e: React.FormEvent) {
    e.preventDefault()
    if (!note.trim()) return
    setBusy(true)
    setError(null)
    const err = await tools.add(page, 'flag', note)
    setBusy(false)
    if (err) return setError(err)
    setNote('')
    setFlagging(false)
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void toggleBookmark()}
        disabled={busy}
        aria-pressed={!!mine}
        title={mine ? 'Remove the bookmark on this page' : 'Bookmark this page'}
        className={`${chip} ${mine ? 'text-accent' : ''}`}
      >
        {mine ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />}
        <span className="hidden sm:inline">{mine ? 'Bookmarked' : 'Bookmark'}</span>
      </button>
      <button type="button" onClick={() => setFlagging((f) => !f)} aria-expanded={flagging} title="Warn others about something on this page" className={chip}>
        <Flag className="size-4" />
        <span className="hidden sm:inline">Flag</span>
      </button>
      {(flagging || error) && (
        <div className="absolute right-0 bottom-12 left-0 mx-auto w-[min(92vw,22rem)] rounded-2xl border border-line bg-surface p-3 text-left shadow-pop">
          {flagging && (
            <form onSubmit={sendFlag}>
              <p className="mb-1.5 text-xs font-semibold">What is wrong on page {page}?</p>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, 200))}
                rows={2}
                autoFocus
                placeholder="e.g. This formula is outdated: see the syllabus"
                className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-ink-3">Everyone reading this note will see it.</span>
                <button disabled={busy || !note.trim()} className="btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold disabled:opacity-50">
                  {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />} Post
                </button>
              </div>
            </form>
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>
      )}
    </>
  )
}

/** Everything marked in this note: your bookmarks and the flags others raised, each jumping to its page. */
export function MarksPanel({ tools, onGo, onClose }: { tools: PageMarks; onGo: (page: number) => void; onClose: () => void }) {
  const mine = tools.marks.filter((m) => m.kind === 'bookmark' && m.user_id === tools.viewer?.id)
  const flags = tools.marks.filter((m) => m.kind === 'flag')
  return (
    <div
      className="absolute right-3 bottom-16 z-20 max-h-[60%] w-[min(92vw,22rem)] overflow-y-auto rounded-2xl border border-line bg-surface p-3 shadow-pop"
      role="dialog"
      aria-label="Bookmarks and flags"
    >
      <div className="mb-2 flex items-center">
        <p className="flex-1 text-sm font-semibold">Bookmarks and flags</p>
        <button type="button" onClick={onClose} aria-label="Close" className="grid size-7 place-items-center rounded-lg hover:bg-surface-2">
          <X className="size-4" />
        </button>
      </div>
      <p className="mb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Your bookmarks</p>
      {mine.length === 0 ? (
        <p className="mb-3 text-xs text-ink-3">{tools.viewer ? 'None yet. Bookmark a page while you read.' : 'Sign in to bookmark pages.'}</p>
      ) : (
        <ul className="mb-3 space-y-1">
          {mine.map((m) => (
            <li key={m.id} className="flex items-center gap-1">
              <button type="button" onClick={() => onGo(m.page)} className="flex-1 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-2">
                Page {m.page}
              </button>
              <button
                type="button"
                onClick={() => void tools.remove(m.id)}
                aria-label={`Remove bookmark on page ${m.page}`}
                className="grid size-7 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-danger"
              >
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mb-1 text-[11px] font-semibold tracking-wider text-ink-3 uppercase">Flags from readers</p>
      {flags.length === 0 ? (
        <p className="text-xs text-ink-3">Nobody has flagged anything in this note.</p>
      ) : (
        <ul className="space-y-1">
          {flags.map((m) => {
            const byStaff = tools.isStaff && m.user_id !== tools.viewer?.id
            return (
              <li key={m.id} className="flex items-start gap-1 rounded-lg px-1 hover:bg-surface-2">
                <button type="button" onClick={() => onGo(m.page)} className="flex-1 py-1.5 text-left text-sm">
                  <span className="font-medium">Page {m.page}</span>
                  <span className="block break-words text-ink-2">{m.note}</span>
                </button>
                {(m.user_id === tools.viewer?.id || tools.isStaff) && (
                  <button
                    type="button"
                    onClick={() => void (byStaff ? tools.resolve(m.id) : tools.remove(m.id))}
                    aria-label={byStaff ? 'Mark as fixed' : 'Remove this flag'}
                    title={byStaff ? 'Mark as fixed' : 'Remove'}
                    className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg text-ink-3 hover:text-danger"
                  >
                    {byStaff ? <Check className="size-3.5" /> : <Trash2 className="size-3.5" />}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
