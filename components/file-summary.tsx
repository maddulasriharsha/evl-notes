'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Pencil, Sparkles } from 'lucide-react'
import { refreshFile } from '@/app/upload/actions'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

/** A first draft from the opening text of a PDF: tidy, cut at a word, for the writer to correct. */
function draftFrom(text: string): string {
  const clean = text.replace(/\s+/g, ' ').replace(/[^\p{L}\p{N}\s.,;:()'’%/&+\-]/gu, '').trim()
  if (clean.length < 20) return ''
  if (clean.length <= 240) return clean
  const cut = clean.slice(0, 240)
  return `${cut.slice(0, cut.lastIndexOf(' '))}…`
}

/**
 * The short "what is inside" line under a note. Everyone reads it; the person who uploaded the note
 * and staff can write or change it (the database enforces who). For a PDF they can ask for a draft
 * taken from its first pages.
 */
export function FileSummary({ fileId, ownerId, summary, pdfUrl, subject, unit }: { fileId: string; ownerId: string; summary: string | null; pdfUrl?: string; subject: string; unit: number }) {
  const viewer = useViewer()
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(summary ?? '')
  const [saved, setSaved] = useState(summary)
  const [busy, setBusy] = useState<'save' | 'draft' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canEdit = !!viewer && (viewer.id === ownerId || viewer.role === 'moderator' || viewer.role === 'admin')
  if (!saved && !canEdit) return null

  async function save() {
    setBusy('save')
    setError(null)
    const next = text.trim().replace(/\s+/g, ' ') || null
    const { error: err } = await supabaseBrowser().from('files').update({ summary: next }).eq('id', fileId)
    setBusy(null)
    if (err) return setError(err.message)
    setSaved(next)
    setEditing(false)
    void refreshFile(fileId, subject, unit).catch(() => undefined)
    router.refresh()
  }

  async function draft() {
    if (!pdfUrl) return
    setBusy('draft')
    setError(null)
    try {
      const [{ pdfText }, blob] = await Promise.all([import('@/lib/pdf'), fetch(pdfUrl).then((r) => r.blob())])
      const d = draftFrom(await pdfText(new File([blob], 'note.pdf', { type: 'application/pdf' })))
      if (d) setText(d)
      else setError('This PDF has no readable text (it is probably scanned pictures). Write a line yourself.')
    } catch {
      setError('Could not read the PDF here. Write a line yourself.')
    } finally {
      setBusy(null)
    }
  }

  // Nothing written yet: only a small button over the corner of the file, so the file keeps its room.
  if (!saved && !editing) {
    return (
      <div className="relative z-20 h-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="absolute top-2 right-3 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-bg/85 px-2.5 text-xs font-medium text-ink-2 shadow-card backdrop-blur hover:text-ink"
        >
          <Pencil className="size-3.5" /> Add summary
        </button>
      </div>
    )
  }

  return (
    <div className="border-b border-line bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-1 sm:px-6">
        {editing ? (
          <div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, 300))}
              rows={2}
              autoFocus
              aria-label="What is in this note"
              placeholder="What is in this note? e.g. Unit 2 with solved examples on Laplace transforms. Handwritten, clear."
              className="w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="text-xs text-ink-3">{text.length}/300</span>
              {pdfUrl && (
                <button type="button" onClick={() => void draft()} disabled={!!busy} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium hover:bg-surface-2 disabled:opacity-50">
                  {busy === 'draft' ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />} Draft from the PDF
                </button>
              )}
              <span className="flex-1" />
              <button type="button" onClick={() => { setEditing(false); setText(saved ?? ''); setError(null) }} disabled={!!busy} className="h-8 rounded-lg px-3 text-xs font-medium hover:bg-surface-2">
                Cancel
              </button>
              <button type="button" onClick={() => void save()} disabled={!!busy} className="btn-primary inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold disabled:opacity-50">
                {busy === 'save' && <Loader2 className="size-3.5 animate-spin" />} Save
              </button>
            </div>
            {error && <p className="mt-1 text-xs text-danger">{error}</p>}
          </div>
        ) : (
          <div className="flex items-start justify-end gap-2 text-sm">
            <p className={`min-w-0 flex-1 break-words ${saved ? 'line-clamp-2 py-1 text-ink-2' : 'sr-only'}`}>{saved ?? 'No summary yet.'}</p>
            {canEdit && (
              <button type="button" onClick={() => setEditing(true)} className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-ink-3 hover:bg-surface-2 hover:text-ink">
                <Pencil className="size-3.5" /> {saved ? 'Edit' : 'Add summary'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
