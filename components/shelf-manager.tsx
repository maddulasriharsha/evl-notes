'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, FileText, Loader2, Pencil } from 'lucide-react'
import { refreshChapter } from '@/app/upload/actions'
import { publicFileUrl } from '@/lib/env'
import { formatBytes, formatDate } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/browser'

export interface ShelfFile {
  id: string
  name: string
  mime: string
  size_bytes: number
  thumb_path: string | null
  storage_path: string
  position: number
  created_at: string
  deleted_at: string | null
}

/** Rename, hide (soft delete) and restore files on your own shelf, and edit its note. */
export function ShelfManager({
  collectionId,
  subject,
  unit,
  description,
  files,
}: {
  collectionId: string
  subject: string
  unit: number
  description: string | null
  files: ShelfFile[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState(description ?? '')
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const sorted = [...files].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))

  async function run(key: string, op: () => PromiseLike<{ error: { message: string } | null }>) {
    setBusy(key)
    setError(null)
    const { error } = await op()
    setBusy(null)
    if (error) return setError(error.message)
    await refreshChapter(subject, unit)
    router.refresh()
  }

  const db = () => supabaseBrowser()

  return (
    <div className="mt-4">
      <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
        {sorted.map((f) => {
          const removed = !!f.deleted_at
          const thumb = f.thumb_path ? publicFileUrl(f.thumb_path) : f.mime !== 'application/pdf' ? publicFileUrl(f.storage_path) : null
          return (
            <li key={f.id} className={`flex items-center gap-3 bg-bg px-3 py-2 ${removed ? 'opacity-55' : ''}`}>
              <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2">
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumb} alt="" loading="lazy" className="size-full object-cover" />
                ) : (
                  <FileText className="size-5 text-ink-3" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {editing === f.id ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault()
                      const name = draft.trim().slice(0, 200)
                      setEditing(null)
                      if (name && name !== f.name) void run(f.id, () => db().from('files').update({ name }).eq('id', f.id))
                    }}
                  >
                    <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={() => setEditing(null)} className="w-full rounded-md border border-accent bg-surface px-2 py-1 text-sm outline-none" />
                  </form>
                ) : (
                  <a href={`/view/u/${f.id}`} className="block truncate text-sm font-medium hover:text-accent">{f.name}</a>
                )}
                <p className="text-xs text-ink-3">
                  {removed ? 'Hidden from site' : `${formatBytes(f.size_bytes)} · ${formatDate(f.created_at)}`}
                </p>
              </div>
              {busy === f.id ? (
                <Loader2 className="size-4 animate-spin text-ink-3" />
              ) : (
                <div className="flex items-center gap-1">
                  {!removed && (
                    <button type="button" aria-label="Rename" onClick={() => (setEditing(f.id), setDraft(f.name))} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink">
                      <Pencil className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      run(f.id, () => db().from('files').update({ deleted_at: removed ? null : new Date().toISOString() }).eq('id', f.id))
                    }
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-2 hover:bg-surface-2"
                  >
                    {removed ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                    {removed ? 'Restore' : 'Hide'}
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run('note', () => db().from('collections').update({ description: note.trim() || null }).eq('id', collectionId))
        }}
      >
        <input
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 500))}
          placeholder="Add a note for classmates (optional)"
          className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
        />
        <button disabled={busy === 'note' || note === (description ?? '')} className="h-10 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-40">
          {busy === 'note' ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
        </button>
      </form>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
