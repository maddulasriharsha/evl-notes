'use client'

import type { PDFDocumentProxy } from 'pdfjs-dist'

let lib: Promise<typeof import('pdfjs-dist')> | undefined

/** Loads pdf.js on demand (it is large) with its worker served from /public. */
export function pdfjs() {
  lib ??= import('pdfjs-dist').then((m) => {
    m.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
    return m
  })
  return lib
}

export async function openPdf(source: string | ArrayBuffer): Promise<PDFDocumentProxy> {
  const { getDocument } = await pdfjs()
  const task = typeof source === 'string' ? getDocument({ url: source }) : getDocument({ data: new Uint8Array(source) })
  return task.promise
}

/** Renders page 1 of a PDF to a WebP thumbnail (the original file is left untouched). */
export async function pdfThumbnail(file: File, width = 480): Promise<{ blob: Blob | null; pages: number }> {
  const doc = await openPdf(await file.arrayBuffer())
  try {
    const page = await doc.getPage(1)
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: width / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.82))
    return { blob, pages: doc.numPages }
  } finally {
    void doc.loadingTask.destroy()
  }
}
