'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, FileStack, Loader2, X } from 'lucide-react'
import { refreshChapter } from '@/app/upload/actions'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

export interface CombinablePhoto {
  id: string
  name: string
  /** Small picture for the list. */
  thumb: string | null
  /** The full photo, read when the PDF is made. */
  url: string
  mime: string
  position: number
}

/**
 * For the person who owns a shelf: turns its separate photos into one PDF. They choose which
 * photos and in what order; the PDF is saved into the same shelf, and the photos it replaces are
 * put in the trash (My notes → Deleted brings them back). Nothing is ever overwritten.
 */
export function CombinePhotosButton({
  collectionId,
  ownerId,
  subject,
  unit,
  title,
  photos,
}: {
  collectionId: string
  ownerId: string
  subject: string
  unit: number
  /** Suggested name of the new PDF. */
  title: string
  photos: CombinablePhoto[]
}) {
  const viewer = useViewer()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [order, setOrder] = useState<CombinablePhoto[]>(photos)
  const [skip, setSkip] = useState<Set<string>>(new Set())
  const [name, setName] = useState(title)
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!viewer || viewer.id !== ownerId || photos.length < 2) return null

  const chosen = order.filter((p) => !skip.has(p.id))
  const busy = status !== null

  const move = (i: number, d: -1 | 1) =>
    setOrder((list) => {
      const j = i + d
      if (j < 0 || j >= list.length) return list
      const next = [...list]
      ;[next[i], next[j]] = [next[j]!, next[i]!]
      return next
    })

  async function run() {
    setError(null)
    try {
      const [{ mergeToPdf }, { uploadOne }] = await Promise.all([import('@/lib/merge-pdf'), import('@/lib/upload')])
      setStatus('Reading photos…')
      const { file, skipped } = await mergeToPdf(
        chosen.map((p) => ({ name: p.name, mime: p.mime, url: p.url })),
        name.trim() || title,
        (done, total) => setStatus(`Joining photo ${Math.min(done + 1, total)} of ${total}…`),
      )
      if (skipped.length) throw new Error(`These photos could not be read, so nothing was changed: ${skipped.join(', ')}`)
      const position = Math.min(...chosen.map((p) => p.position))
      await uploadOne(file, { userId: ownerId, collectionId, position, name: name.trim() || title }, (s) => setStatus(s === 'uploading' ? 'Uploading the PDF…' : 'Saving…'))
      // Only now are the photos moved to the trash, so a failure above loses nothing.
      setStatus('Tidying up…')
      const { error: trashError } = await supabaseBrowser()
        .from('files')
        .update({ deleted_at: new Date().toISOString() })
        .in('id', chosen.map((p) => p.id))
      if (trashError) throw new Error(`The PDF was saved, but the photos could not be removed: ${trashError.message}`)
      await refreshChapter(subject, unit).catch(() => undefined)
      setOpen(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setStatus(null)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2"
      >
        <FileStack className="size-4" /> Combine {photos.length} photos into one PDF
      </button>
      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Combine photos into one PDF">
          <div className="flex max-h-[90dvh] w-full max-w-lg flex-col rounded-2xl border border-line bg-surface shadow-pop">
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <h2 className="flex-1 font-display text-lg font-semibold">Combine photos into one PDF</h2>
              <button type="button" onClick={() => !busy && setOpen(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <label className="block text-xs font-semibold text-ink-3">
                Name of the PDF
                <input
                  value={name}
                  disabled={busy}
                  onChange={(e) => setName(e.target.value.slice(0, 120))}
                  className="mt-1 h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm font-normal text-ink outline-none focus:border-accent"
                />
              </label>
              <p className="mt-4 mb-2 text-xs text-ink-3">Page order, first to last. Untick a photo to leave it out. Use the arrows to move one.</p>
              <ol className="space-y-1.5">
                {order.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-xl border border-line bg-bg p-1.5">
                    <input
                      type="checkbox"
                      checked={!skip.has(p.id)}
                      disabled={busy}
                      onChange={(e) => setSkip((s) => (e.target.checked ? (s.delete(p.id), new Set(s)) : new Set(s).add(p.id)))}
                      aria-label={`Include ${p.name}`}
                      className="size-4 accent-[var(--accent)]"
                    />
                    <span className="w-5 text-center text-xs text-ink-3 tabular-nums">{i + 1}</span>
                    <div className="size-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {p.thumb && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.thumb} alt="" className="size-full object-cover" />
                      )}
                    </div>
                    <span className={`min-w-0 flex-1 truncate text-sm ${skip.has(p.id) ? 'text-ink-3 line-through' : ''}`}>{p.name}</span>
                    <button type="button" disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-30">
                      <ArrowUp className="size-4" />
                    </button>
                    <button type="button" disabled={busy || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2 disabled:opacity-30">
                      <ArrowDown className="size-4" />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <div className="border-t border-line px-4 py-3">
              <p className="mb-2 text-xs text-ink-3">The PDF is saved in this shelf. The {chosen.length} photos it replaces go to your trash (My notes) and can be restored.</p>
              {error && <p className="mb-2 text-sm text-danger">{error}</p>}
              <div className="flex justify-end gap-2">
                <button type="button" disabled={busy} onClick={() => setOpen(false)} className="h-10 rounded-xl border border-line px-4 text-sm font-medium disabled:opacity-50">
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={busy || chosen.length < 2 || !name.trim()}
                  onClick={() => void run()}
                  className="btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <FileStack className="size-4" />}
                  {status ?? `Make the PDF (${chosen.length} pages)`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
