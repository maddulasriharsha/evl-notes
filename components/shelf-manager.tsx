'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { refreshChapter } from '@/app/upload/actions'
import { DRIVE_KIND_LABEL, driveKindFromMime, isDriveMime } from '@/lib/drive-link'
import { thumbFor } from '@/lib/file-thumb'
import { formatBytes, formatDate } from '@/lib/format'
import { supabaseBrowser } from '@/lib/supabase/browser'

export interface ShelfFile {
  id: string
  name: string
  mime: string
  size_bytes: number | null
  thumb_path: string | null
  storage_path: string | null
  drive_id: string | null
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
  const sorted = [...files].sort((a, b) => Number(!!a.deleted_at) - Number(!!b.deleted_at) || a.position - b.position || a.created_at.localeCompare(b.created_at))
  const liveIds = files.filter((f) => !f.deleted_at).map((f) => f.id)

  async function run(key: string, op: () => PromiseLike<{ error: { message: string } | null }>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
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
          const thumb = thumbFor(f)
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
                  {removed
                    ? 'Deleted · not shown on the site'
                    : `${isDriveMime(f.mime) ? DRIVE_KIND_LABEL[driveKindFromMime(f.mime)] : formatBytes(f.size_bytes ?? 0)} · ${formatDate(f.created_at)}`}
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
                  {removed ? (
                    <button
                      type="button"
                      onClick={() => run(f.id, () => db().from('files').update({ deleted_at: null }).eq('id', f.id))}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-ink-2 hover:bg-surface-2"
                    >
                      <RotateCcw className="size-3.5" /> Restore
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        run(
                          f.id,
                          () => db().from('files').update({ deleted_at: new Date().toISOString() }).eq('id', f.id),
                          `Delete “${f.name}”? It will be removed from the site. You can restore it here if you change your mind.`,
                        )
                      }
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-danger hover:bg-danger-soft"
                    >
                      <Trash2 className="size-3.5" /> Delete
                    </button>
                  )}
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
      {liveIds.length > 1 && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() =>
            run(
              'all',
              () => db().from('files').update({ deleted_at: new Date().toISOString() }).in('id', liveIds),
              `Delete all ${liveIds.length} files in this chapter? You can restore them here later.`,
            )
          }
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:underline disabled:opacity-50"
        >
          <Trash2 className="size-3.5" /> Delete all files in this chapter
        </button>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
