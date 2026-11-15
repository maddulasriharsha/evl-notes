'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { HelpCircle, Loader2, Pencil, Trash2 } from 'lucide-react'
import { refreshChapter, refreshDriveFile } from '@/app/upload/actions'
import { ExamTagButton } from '@/components/exam-tag'
import { MoveFileButton } from '@/components/move-file'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { PAPERS_UNIT } from '@/lib/curriculum'

/** Admin › Files: put a removed Drive library file back on the site. */
export function DriveRestore({ id, subject, unit }: { id: string; subject: string; unit: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function restore() {
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('staff_hide_drive_file', { p_file: id, p_hidden: false })
    if (error) {
      setBusy(false)
      return alert(error.message)
    }
    await refreshDriveFile(id, subject, unit).catch(() => undefined)
    router.refresh()
  }
  return (
    <button type="button" onClick={restore} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50">
      {busy && <Loader2 className="size-3.5 animate-spin" />} Restore
    </button>
  )
}

/** Admin-only Questions tag, Rename, Move and Delete for a Google Drive library file. The database re-checks the role. */
export function DriveMove({ id, name, subject, unit, tagged = false }: { id: string; name: string; subject: string; unit: number; tagged?: boolean }) {
  const viewer = useViewer()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(name)
  const [busy, setBusy] = useState<'rename' | 'delete' | 'tag' | null>(null)
  const [isTagged, setIsTagged] = useState(tagged)
  if (viewer?.role !== 'admin') return null

  async function toggleTag() {
    setBusy('tag')
    const next = !isTagged
    const { error } = await supabaseBrowser().rpc('staff_tag_drive_file', { p_file: id, p_on: next })
    if (error) {
      setBusy(null)
      return alert(error.message)
    }
    setIsTagged(next)
    // The Question bank sits on the Complete notes and Exam prep pages, which refreshChapter covers.
    await refreshDriveFile(id, subject, unit).catch(() => undefined)
    setBusy(null)
    router.refresh()
  }

  async function remove() {
    if (!confirm(`Remove “${name}” from the site? You can put it back from Admin › Files.`)) return
    setBusy('delete')
    const { error } = await supabaseBrowser().rpc('staff_hide_drive_file', { p_file: id, p_hidden: true })
    if (error) {
      setBusy(null)
      return alert(error.message)
    }
    await refreshDriveFile(id, subject, unit).catch(() => undefined)
    setBusy(null)
    router.refresh()
  }

  async function setTitle(next: string) {
    const { error } = await supabaseBrowser().rpc('staff_rename_drive_file', { p_file: id, p_title: next })
    if (error) throw new Error(error.message)
    await refreshChapter(subject, unit).catch(() => undefined)
    router.refresh()
  }

  async function rename() {
    const next = draft.trim().replace(/\s+/g, ' ').slice(0, 200)
    setEditing(false)
    if (!next || next === name) return setDraft(name)
    setBusy('rename')
    try {
      await setTitle(next)
    } catch (e) {
      setDraft(name)
      alert((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
        {unit === PAPERS_UNIT && <ExamTagButton title={name} save={setTitle} variant="card" />}
        <button
          type="button"
          aria-label={isTagged ? 'Remove the Questions tag' : 'Tag as Questions'}
          aria-pressed={isTagged}
          title={isTagged ? 'Tagged Questions: listed in the Question bank (click to remove)' : 'Tag as Questions: also list in the Question bank'}
          disabled={busy !== null}
          onClick={toggleTag}
          className={`grid size-8 place-items-center rounded-lg shadow-card backdrop-blur ${isTagged ? 'bg-accent text-accent-ink' : 'bg-bg/90 text-ink-2 hover:text-ink'}`}
        >
          {busy === 'tag' ? <Loader2 className="size-4 animate-spin" /> : <HelpCircle className="size-4" />}
        </button>
        <MoveFileButton id={id} name={name} subject={subject} unit={unit} compact drive />
        <button
          type="button"
          aria-label="Rename"
          title="Rename"
          disabled={busy !== null}
          onClick={() => (setDraft(name), setEditing(true))}
          className="grid size-8 place-items-center rounded-lg bg-bg/90 text-ink-2 shadow-card backdrop-blur hover:text-ink"
        >
          {busy === 'rename' ? <Loader2 className="size-4 animate-spin" /> : <Pencil className="size-4" />}
        </button>
        <button
          type="button"
          aria-label="Delete"
          title="Remove from the site"
          disabled={busy !== null}
          onClick={remove}
          className="grid size-8 place-items-center rounded-lg bg-bg/90 text-danger shadow-card backdrop-blur hover:bg-danger-soft"
        >
          {busy === 'delete' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        </button>
      </div>
      {editing && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void rename()
          }}
          className="absolute inset-x-2 bottom-2 z-10 flex gap-1.5 rounded-xl border border-accent bg-surface p-1.5 shadow-pop"
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
      )}
    </>
  )
}
