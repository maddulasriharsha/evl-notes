'use client'

import { useState } from 'react'
import { FileDown, Loader2 } from 'lucide-react'
import type { MergeSource } from '@/lib/merge-pdf'

/** Joins every PDF and photo of a shelf (or a whole chapter) into one PDF, made in the browser. */
export function DownloadShelfButton({ sources, title, label = 'Download all as one PDF' }: { sources: MergeSource[]; title: string; label?: string }) {
  const [progress, setProgress] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  async function run() {
    setNote(null)
    setProgress('Starting…')
    try {
      // Loaded on demand: the PDF library is large and most visitors never press this.
      const { mergeToPdf } = await import('@/lib/merge-pdf')
      const { file, pages, skipped } = await mergeToPdf(sources, title, (done, total) => setProgress(`Joining file ${Math.min(done + 1, total)} of ${total}…`))
      const url = URL.createObjectURL(file)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
      setNote(skipped.length ? `Downloaded ${pages} pages. Skipped: ${skipped.join(', ')}.` : `Downloaded ${pages} pages.`)
    } catch (e) {
      setNote(e instanceof Error ? e.message : 'Could not make the PDF.')
    } finally {
      setProgress(null)
    }
  }

  if (sources.length === 0) return null
  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={run}
        disabled={progress !== null}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-60"
      >
        {progress ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />}
        {progress ?? label}
      </button>
      {note && <p className="text-xs text-ink-3">{note}</p>}
    </div>
  )
}
