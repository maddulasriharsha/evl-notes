'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from '@/components/link'
import { Loader2, MessageCircle, Send, Trash2, X } from 'lucide-react'
import { ReportButton } from '@/components/file-actions'
import { OwnerName } from '@/components/ui'
import { supabaseConfigured } from '@/lib/env'
import { timeAgo } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/browser'

interface Comment {
  id: string
  author_id: string
  body: string
  created_at: string
  profiles: { display_name: string; role: string } | null
}

interface Me {
  id: string
  hasProfile: boolean
  isStaff: boolean
  banned: boolean
}

const MAX = 1000

/** Comments for one uploaded file. Everyone can read; signed-in people can post. */
function CommentsPanel({ fileId, ownerId, onCount }: { fileId: string; ownerId: string; onCount: (n: number) => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [me, setMe] = useState<Me | null | undefined>(undefined)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser()
      .from('comments')
      .select('id, author_id, body, created_at, profiles!author_id(display_name, role)')
      .eq('file_id', fileId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) return setError('Comments could not be loaded.')
    const list = (data ?? []) as unknown as Comment[]
    setComments(list)
    onCount(list.length)
  }, [fileId, onCount])

  useEffect(() => {
    if (!supabaseConfigured) return
    void load()
    const supabase = supabaseBrowser()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setMe(null)
      const { data: p } = await supabase.from('profiles').select('role, banned_at').eq('id', data.user.id).maybeSingle()
      const prof = p as { role: string; banned_at: string | null } | null
      setMe({ id: data.user.id, hasProfile: !!prof, isStaff: prof?.role === 'admin' || prof?.role === 'moderator', banned: !!prof?.banned_at })
    })
  }, [load])

  async function post(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (!me || !text) return
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().from('comments').insert({ file_id: fileId, author_id: me.id, body: text.slice(0, MAX) })
    setBusy(false)
    if (error) return setError(error.message)
    setBody('')
    await load()
  }

  async function remove(id: string) {
    if (!confirm('Delete this comment?')) return
    const { error } = await supabaseBrowser().from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) return setError(error.message)
    await load()
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {comments === null && !error ? (
          <div className="grid place-items-center py-10 text-ink-3">
            <Loader2 className="size-5 animate-spin" />
          </div>
        ) : comments && comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-3">No comments yet. Ask a doubt or say thanks.</p>
        ) : (
          comments?.map((c) => {
            const name = c.profiles?.display_name ?? 'Unknown'
            const canDelete = me && (me.id === c.author_id || me.isStaff)
            return (
              <div key={c.id} className="group flex gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-xs">
                    <OwnerName name={name} admin={c.profiles?.role === 'admin'} moderator={c.profiles?.role === 'moderator'} className="font-semibold text-ink" />
                    {c.author_id === ownerId && <span className="shrink-0 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold text-ink-2 uppercase">Uploader</span>}
                    <span className="shrink-0 text-ink-3">{timeAgo(c.created_at)}</span>
                    <span className="ml-auto flex items-center gap-3">
                      {me && me.id !== c.author_id && <ReportButton commentId={c.id} fileFor={fileId} compact />}
                      {canDelete && (
                        <button type="button" onClick={() => remove(c.id)} aria-label="Delete comment" className="text-ink-3 opacity-60 hover:text-danger hover:opacity-100">
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-line text-ink-2">{c.body}</p>
                </div>
              </div>
            )
          })
        )}
      </div>

      <div className="border-t border-line p-3">
        {me === undefined ? null : me === null ? (
          <p className="text-center text-sm text-ink-3">
            <Link href={`/login?next=${encodeURIComponent(`/view/u/${fileId}`)}`} className="font-medium text-accent">Sign in</Link> to comment.
          </p>
        ) : me.banned ? (
          <p className="text-center text-sm text-ink-3">Commenting is blocked for your account.</p>
        ) : !me.hasProfile ? (
          <p className="text-center text-sm text-ink-3">
            <Link href="/upload" className="font-medium text-accent">Choose your display name</Link> to comment.
          </p>
        ) : (
          <form onSubmit={post} className="flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  e.currentTarget.form?.requestSubmit()
                }
              }}
              rows={2}
              placeholder="Write a comment…"
              aria-label="Comment"
              className="min-h-11 flex-1 resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button type="submit" disabled={busy || !body.trim()} aria-label="Post comment" className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-bg hover:opacity-90 disabled:opacity-40">
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        )}
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </div>
    </div>
  )
}

const HIDE_KEY = 'vj-comments-hidden'

/**
 * Places the comments beside the file on wide screens and in a pull-up sheet on phones. On wide
 * screens the side panel can be closed to give the file the whole width; the choice is remembered
 * on this device, and a button brings the comments back.
 */
export function ViewerWithComments({ fileId, ownerId, initialCount, children }: { fileId: string; ownerId: string; initialCount: number; children: React.ReactNode }) {
  const [count, setCount] = useState(initialCount)
  const [open, setOpen] = useState(false)
  const [wide, setWide] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const apply = () => setWide(mq.matches)
    apply()
    try {
      setHidden(localStorage.getItem(HIDE_KEY) === '1')
    } catch {
      // Storage blocked: the panel simply starts open.
    }
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])

  function hide(next: boolean) {
    setHidden(next)
    try {
      if (next) localStorage.setItem(HIDE_KEY, '1')
      else localStorage.removeItem(HIDE_KEY)
    } catch {
      // ignore
    }
  }

  const heading = (
    <div className="flex items-center gap-2 border-b border-line px-4 py-3">
      <MessageCircle className="size-4 text-ink-3" />
      <p className="text-sm font-semibold">Comments</p>
      <span className="text-xs text-ink-3">{count}</span>
      <button
        type="button"
        onClick={() => (wide ? hide(true) : setOpen(false))}
        aria-label="Close comments"
        title={wide ? 'Close comments (more room for the file)' : 'Close comments'}
        className="ml-auto grid size-8 place-items-center rounded-lg hover:bg-surface-2"
      >
        <X className="size-4" />
      </button>
    </div>
  )
  const label = count > 0 ? `${count} comment${count === 1 ? '' : 's'}` : wide ? 'Comments' : 'Comment'

  return (
    <div className="absolute inset-0 flex">
      <div className="relative min-w-0 flex-1">{children}</div>
      {wide && !hidden ? (
        <aside className="flex w-96 shrink-0 flex-col border-l border-line bg-surface">
          {heading}
          <CommentsPanel fileId={fileId} ownerId={ownerId} onCount={setCount} />
        </aside>
      ) : (
        <>
          <button
            type="button"
            onClick={() => (wide ? hide(false) : setOpen(true))}
            className="absolute right-4 bottom-20 z-10 inline-flex h-11 items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-bg shadow-pop"
          >
            <MessageCircle className="size-4" /> {label}
          </button>
          {!wide && open && (
            <div className="fixed inset-0 z-50 flex flex-col justify-end bg-ink/40" onClick={() => setOpen(false)}>
              <div className="flex h-[75dvh] flex-col rounded-t-3xl bg-surface shadow-pop" onClick={(e) => e.stopPropagation()}>
                {heading}
                <CommentsPanel fileId={fileId} ownerId={ownerId} onCount={setCount} />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
