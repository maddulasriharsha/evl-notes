'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HelpCircle, Loader2, Pencil, Trash2 } from 'lucide-react'
import { refreshFile } from '@/app/upload/actions'
import { MoveFileButton } from '@/components/move-file'
import { supabaseBrowser } from '@/lib/supabase/browser'

type Viewer = { id: string; role: string } | null

// One lookup per page load, shared by every card.
let viewerPromise: Promise<Viewer> | null = null
function loadViewer(): Promise<Viewer> {
  if (!viewerPromise) {
    const supabase = supabaseBrowser()
    viewerPromise = supabase.auth
      .getUser()
      .then(async ({ data }) => {
        if (!data.user) return null
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
        return { id: data.user.id, role: (p as { role: string } | null)?.role ?? 'member' }
      })
      .catch(() => null)
  }
  return viewerPromise
}

export function useViewer() {
  const [viewer, setViewer] = useState<Viewer>(null)
  useEffect(() => {
    let live = true
    void loadViewer().then((v) => live && setViewer(v))
    return () => {
      live = false
    }
  }, [])
  return viewer
}

/**
 * Rename and delete for one note. Shown only to the person who uploaded it and to staff
 * (moderators and admins). The database enforces the same rule, so this is convenience only.
 * Deleting hides the note from the site; it can be restored from My notes or the Moderation page.
 */
export function FileTools({
  id,
  ownerId,
  name,
  subject,
  unit,
  variant,
  after,
  tagged = false,
}: {
  id: string
  ownerId: string
  name: string
  subject: string
  unit: number
  variant: 'card' | 'bar'
  /** Where to go once the note is deleted (used on the file's own page). */
  after?: string
  /** Already tagged "questions" (it is listed in the Question bank). */
  tagged?: boolean
}) {
  const viewer = useViewer()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [busy, setBusy] = useState<'rename' | 'delete' | 'tag' | null>(null)
  const [isTagged, setIsTagged] = useState(tagged)

  const isStaff = viewer?.role === 'moderator' || viewer?.role === 'admin'
  if (!viewer || (viewer.id !== ownerId && !isStaff)) return null
  const byStaff = viewer.id !== ownerId

  async function rename() {
    const next = draft.trim().replace(/\s+/g, ' ').slice(0, 200)
    setEditing(false)
    if (!next || next === name) return setDraft(name)
    setBusy('rename')
    const { error } = await supabaseBrowser().from('files').update({ name: next }).eq('id', id)
    if (error) {
      setBusy(null)
      setDraft(name)
      return alert(error.message)
    }
    await refreshFile(id, subject, unit)
    setBusy(null)
    router.refresh()
  }

  async function toggleQuestionsTag() {
    setBusy('tag')
    const next = !isTagged
    const { error } = await supabaseBrowser().rpc('staff_set_file_tag', { p_file: id, p_tag: 'questions', p_on: next })
    setBusy(null)
    if (error) return alert(error.message)
    setIsTagged(next)
    await refreshFile(id, subject, unit).catch(() => undefined)
    router.refresh()
  }

  async function remove() {
    const who = byStaff ? ' It is someone else’s note; the owner can restore it from My notes.' : ''
    if (!confirm(`Delete “${name}”? It will disappear from the site.${who}`)) return
    setBusy('delete')
    const { error } = await supabaseBrowser().from('files').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    if (error) {
      setBusy(null)
      return alert(error.message)
    }
    await refreshFile(id, subject, unit)
    setBusy(null)
    if (after) router.push(after)
    else router.refresh()
  }

  const buttons = (
    <>
      {isStaff && (
        <button
          type="button"
          aria-label={isTagged ? 'Remove the Questions tag' : 'Tag as Questions'}
          aria-pressed={isTagged}
          title={isTagged ? 'Tagged Questions: listed in the Question bank (click to remove)' : 'Tag as Questions: also list in the Question bank'}
          disabled={busy !== null}
          onClick={toggleQuestionsTag}
          className={
            variant === 'card'
              ? `grid size-8 place-items-center rounded-lg shadow-card backdrop-blur ${isTagged ? 'bg-accent text-accent-ink' : 'bg-bg/90 text-ink-2 hover:text-ink'}`
              : `inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium ${isTagged ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-surface-2'}`
          }
        >
          {busy === 'tag' ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />}
          {variant === 'bar' && <span className="hidden md:inline">{isTagged ? 'Questions ✓' : 'Tag: Questions'}</span>}
        </button>
      )}
      {isStaff && <MoveFileButton id={id} name={name} subject={subject} unit={unit} compact={variant === 'card'} className={variant === 'bar' ? 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm font-medium hover:bg-surface-2' : undefined} />}
      <button
        type="button"
        aria-label="Rename"
        title="Rename"
        disabled={busy !== null}
        onClick={() => (setDraft(name), setEditing(true))}
        className={
          variant === 'card'
            ? 'grid size-8 place-items-center rounded-lg bg-bg/90 text-ink-2 shadow-card backdrop-blur hover:text-ink'
            : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-2.5 text-sm font-medium hover:bg-surface-2'
        }
      >
        {busy === 'rename' ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
        {variant === 'bar' && <span className="hidden md:inline">Rename</span>}
      </button>
      <button
        type="button"
        aria-label="Delete"
        title="Delete"
        disabled={busy !== null}
        onClick={remove}
        className={
          variant === 'card'
            ? 'grid size-8 place-items-center rounded-lg bg-bg/90 text-danger shadow-card backdrop-blur hover:bg-danger-soft'
            : 'inline-flex h-9 items-center gap-1.5 rounded-lg border border-danger/40 px-2.5 text-sm font-medium text-danger hover:bg-danger-soft'
        }
      >
        {busy === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {variant === 'bar' && <span className="hidden md:inline">Delete</span>}
      </button>
    </>
  )

  const form = editing && (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void rename()
      }}
      className={
        variant === 'card'
          ? 'absolute inset-x-2 bottom-2 z-10 flex gap-1.5 rounded-xl border border-accent bg-surface p-1.5 shadow-pop'
          : 'fixed inset-x-4 top-20 z-50 mx-auto flex max-w-md gap-2 rounded-xl border border-accent bg-surface p-2 shadow-pop'
      }
    >
      <input
        autoFocus
        value={draft}
        maxLength={200}
        aria-label="New name"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
        className="h-8 min-w-0 flex-1 rounded-lg bg-bg px-2 text-sm outline-none"
      />
      <button className="h-8 rounded-lg bg-ink px-2.5 text-xs font-medium text-bg">Save</button>
      <button type="button" onClick={() => setEditing(false)} className="h-8 rounded-lg border border-line px-2 text-xs font-medium">
        Cancel
      </button>
    </form>
  )

  if (variant === 'card') {
    return (
      <>
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {buttons}
        </div>
        {form}
      </>
    )
  }
  return (
    <>
      {buttons}
      {form}
    </>
  )
}
