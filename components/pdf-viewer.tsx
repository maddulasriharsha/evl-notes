'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Minus, Plus } from 'lucide-react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { openPdf } from '@/lib/pdf'

/**
 * Renders a PDF page by page in the browser (works on phones, where PDFs inside an iframe
 * usually force a download). Pages render only when scrolled near.
 */
export function PdfViewer({ url, downloadHref }: { url: string; downloadHref: string }) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [error, setError] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(0)
  const box = useRef<HTMLDivElement>(null)

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
    <div ref={box} className="absolute inset-0 overflow-auto">
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
              <PdfPage key={i} doc={doc} index={i + 1} width={pageWidth} />
            ))}
          </div>
          <div className="sticky bottom-4 flex justify-center">
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface/95 p-1 shadow-pop backdrop-blur">
              <button type="button" onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Zoom out">
                <Minus className="size-4" />
              </button>
              <button type="button" onClick={() => setZoom(1)} className="min-w-14 rounded-full px-2 text-xs font-medium tabular-nums hover:bg-surface-2">
                {Math.round(zoom * 100)}%
              </button>
              <button type="button" onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="grid size-9 place-items-center rounded-full hover:bg-surface-2" aria-label="Zoom in">
                <Plus className="size-4" />
              </button>
              <span className="px-3 text-xs text-ink-3">{doc.numPages} pages</span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function PdfPage({ doc, index, width }: { doc: PDFDocumentProxy; index: number; width: number }) {
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
      const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
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
    <div ref={holder} className="overflow-hidden rounded-md bg-white shadow-card" style={{ width, height: width * ratio }}>
      <canvas ref={canvas} className="block size-full" aria-label={`Page ${index}`} />
    </div>
  )
}
