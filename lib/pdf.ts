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
  // Decoders and data pdf.js fetches only when a file needs them. Without wasmUrl, scanned PDFs
  // that store pages as JPEG 2000 or JBIG2 images render as blank white pages.
  const assets = {
    wasmUrl: '/pdfjs/wasm/',
    iccUrl: '/pdfjs/iccs/',
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }
  const task =
    typeof source === 'string'
      ? getDocument({ url: source, ...assets })
      : getDocument({ data: new Uint8Array(source), ...assets })
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

/** The text of the first pages of a PDF (empty for scans that are only pictures). */
export async function pdfText(file: File, maxPages = 3): Promise<string> {
  const doc = await openPdf(await file.arrayBuffer())
  try {
    let out = ''
    for (let i = 1; i <= Math.min(doc.numPages, maxPages); i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      out += ' ' + content.items.map((it) => ('str' in it ? it.str : '')).join(' ')
      if (out.length > 6000) break
    }
    return out
  } finally {
    void doc.loadingTask.destroy()
  }
}

/** One page of a PDF as a WebP picture, for reading scanned notes. */
export async function pdfPageImage(file: File, pageNumber = 1, width = 1100): Promise<Blob | null> {
  const doc = await openPdf(await file.arrayBuffer())
  try {
    const page = await doc.getPage(Math.min(pageNumber, doc.numPages))
    const base = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: width / base.width })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    await page.render({ canvas, viewport }).promise
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.7))
  } finally {
    void doc.loadingTask.destroy()
  }
}
