'use client'

import { useEffect, useRef, useState } from 'react'
import { preloadModule } from 'react-dom'
import { Flag, ListChecks, Loader2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { MarksPanel, PageMarkButtons, readProgress, usePageMarks, writeProgress } from '@/components/page-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { openPdf } from '@/lib/pdf'

/**
 * Renders a PDF page by page in the browser (works on phones, where PDFs inside an iframe
 * usually force a download). Pages render only when scrolled near.
 */
export function PdfViewer({ url, downloadHref, fileId }: { url: string; downloadHref: string; fileId?: string }) {
  // Start fetching the worker while the page hydrates instead of after pdf.js loads.
  preloadModule('/pdf.worker.min.mjs', { as: 'worker' })
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(1)
  const [panel, setPanel] = useState(false)
  const [resumed, setResumed] = useState<number | null>(null)
  const restored = useRef(false)
  const tools = usePageMarks(fileId)
  const userId = tools.viewer?.id

  const goTo = (n: number, smooth = true) => {
    const c = box.current
    const el = c?.querySelector<HTMLElement>(`[data-pdf-page="${n}"]`)
    if (c && el) c.scrollTo({ top: el.offsetTop - 16, behavior: smooth ? 'smooth' : 'instant' })
  }

  // Back to where the person stopped: this browser's memory first, then the one saved to their account.
  useEffect(() => {
    if (!doc || !width || !fileId || restored.current) return
    restored.current = true
    void (async () => {
      let saved = readProgress(fileId)?.page ?? 0
      if (!saved && userId) {
        const { data } = await supabaseBrowser().from('reading_progress').select('page').eq('file_id', fileId).eq('user_id', userId).maybeSingle()
        saved = (data?.page as number | undefined) ?? 0
      }
      if (saved > 1 && saved <= doc.numPages) {
        setResumed(saved)
        // Pages above have only placeholder heights until they render, so settle twice.
        requestAnimationFrame(() => goTo(saved, false))
        setTimeout(() => goTo(saved, false), 500)
      }
    })()
  }, [doc, width, fileId, userId])

  // Which page is at the top of the view.
  const onScroll = () => {
    const c = box.current
    if (!c || !doc) return
    const top = c.scrollTop + 80
    let current = 1
    for (const el of c.querySelectorAll<HTMLElement>('[data-pdf-page]')) {
      if (el.offsetTop + el.offsetHeight > top) {
        current = Number(el.dataset.pdfPage)
        break
      }
    }
    setPage(current)
  }

  // Remember the page: here at once, and on the account (once reading settles) so another device can resume.
  useEffect(() => {
    if (!doc || !fileId || !restored.current) return
    writeProgress(fileId, { page, pages: doc.numPages })
    if (!userId) return
    const t = setTimeout(() => {
      void supabaseBrowser()
        .from('reading_progress')
        .upsert({ user_id: userId, file_id: fileId, page, pages: doc.numPages, updated_at: new Date().toISOString() })
    }, 2500)
    return () => clearTimeout(t)
  }, [page, doc, fileId, userId])

  useEffect(() => {
    let cancelled = false
    let loaded: PDFDocumentProxy | null = null
    openPdf(url)
      .then((d) => {
        if (cancelled) return void d.loadingTask.destroy()
        loaded = d
        setDoc(d)
      })
      .catch(() => !cancelled && setError(true))
    return () => {
      cancelled = true
      void loaded?.loadingTask.destroy()
    }
  }, [url])

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pageWidth = Math.max(240, Math.min(width - 32, 1000) * zoom)

  return (
    <div ref={box} onScroll={onScroll} className="absolute inset-0 overflow-auto overscroll-contain">
      {error ? (
        <div className="grid h-full place-items-center p-6 text-center text-sm text-ink-2">
          <div>
            <p className="font-medium">This PDF could not be displayed here.</p>
            <a href={downloadHref} className="mt-3 inline-block font-medium text-accent">Download it instead</a>
          </div>
        </div>
      ) : !doc || !width ? (
        <div className="grid h-full place-items-center text-ink-3">
          <Loader2 className="size-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-col items-center gap-4 px-4 py-6">
            {Array.from({ length: doc.numPages }, (_, i) => (
              <PdfPage key={i} doc={doc} index={i + 1} width={pageWidth} flags={tools.marks.filter((m) => m.kind === 'flag' && m.page === i + 1)} onFlags={() => setPanel(true)} />
            ))}
          </div>
          <div className="sticky bottom-4 flex justify-center">
            {resumed && (
              <div className="absolute bottom-14 flex items-center gap-2 rounded-full border border-line bg-surface/95 py-1 pr-1 pl-4 text-xs shadow-pop backdrop-blur">
                Continued from page {resumed}
                <button type="button" onClick={() => { goTo(1); setResumed(null) }} className="rounded-full px-3 py-1.5 font-semibold text-accent hover:bg-surface-2">
                  Start over
                </button>
                <button type="button" onClick={() => setResumed(null)} aria-label="Dismiss" className="grid size-7 place-items-center rounded-full hover:bg-surface-2">
                  ×
                </button>
              </div>
            )}
            {panel && <MarksPanel tools={tools} onGo={(n) => goTo(n)} onClose={() => setPanel(false)} />}
            <div className="relative flex items-center gap-1 rounded-full border border-line bg-surface/95 p-1 shadow-pop backdrop-blur">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Zoom out">
                <Minus className="size-4" />
              </button>
              <button type="button" onClick={() => setZoom(1)} className="min-w-14 rounded-full px-2 text-xs font-medium tabular-nums hover:bg-surface-2">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Zoom in">
                <Plus className="size-4" />
              </button>
              <label className="flex items-center gap-1 pl-2 text-xs text-ink-3">
                <span className="sr-only">Page</span>
                <input
                  key={page}
                  defaultValue={page}
                  inputMode="numeric"
                  aria-label="Go to page"
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter') return
                    goTo(Math.min(doc.numPages, Math.max(1, Number(e.currentTarget.value) || 1)))
                  }}
                  onBlur={(e) => (e.currentTarget.value = String(page))}
                  className="h-8 w-10 rounded-lg border border-line bg-bg text-center text-xs text-ink tabular-nums"
                />
                / {doc.numPages}
              </label>
              {fileId && (
                <>
                  <span className="mx-1 h-5 w-px bg-line" />
                  <PageMarkButtons page={page} tools={tools} />
                  <button type="button" onClick={() => setPanel((p) => !p)} aria-expanded={panel} title="All bookmarks and flags" className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-xs font-medium hover:bg-surface-2">
                    <ListChecks className="size-4" />
                    <span className="tabular-nums">{tools.marks.filter((m) => m.kind === 'flag' || m.user_id === userId).length}</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PdfPage({
  doc,
  index,
  width,
  flags,
  onFlags,
}: {
  doc: PDFDocumentProxy
  index: number
  width: number
  flags: { id: string; note: string | null }[]
  onFlags: () => void
}) {
  const holder = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [visible, setVisible] = useState(index <= 2)
  const [ratio, setRatio] = useState(1.414)

  useEffect(() => {
    const el = holder.current
    if (!el || visible) return
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && setVisible(true), { rootMargin: '800px 0px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible) return
    let task: { cancel: () => void; promise: Promise<void> } | undefined
    let cancelled = false
    doc.getPage(index).then((page) => {
      if (cancelled || !canvas.current) return
      const base = page.getViewport({ scale: 1 })
      setRatio(base.height / base.width)
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const viewport = page.getViewport({ scale: (width / base.width) * dpr })
      const c = canvas.current
      c.width = Math.round(viewport.width)
      c.height = Math.round(viewport.height)
      task = page.render({ canvas: c, viewport })
      task.promise.catch(() => {})
    })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, index, visible, width])

  return (
    <div ref={holder} data-pdf-page={index} className="relative overflow-hidden rounded-md bg-white shadow-card" style={{ width, height: width * ratio }}>
      <canvas ref={canvas} className="block size-full" aria-label={`Page ${index}`} />
      {flags.length > 0 && (
        <button
          type="button"
          onClick={onFlags}
          title={flags.map((f) => f.note).join('\n')}
          className="absolute top-2 right-2 inline-flex max-w-[80%] items-center gap-1 rounded-full border border-amber-500/40 bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 shadow-card"
        >
          <Flag className="size-3.5 shrink-0" />
          <span className="truncate">{flags.length === 1 ? flags[0]!.note : `${flags.length} flags on this page`}</span>
        </button>
      )}
    </div>
  )
}
