'use client'

import { PDFDocument } from 'pdf-lib'
import { toJpeg } from '@/lib/photos-to-pdf'

export interface MergeSource {
  name: string
  mime: string
  url: string
}

/** A phone can merge a lot, but not without limit. Beyond this the shelf is better downloaded file by file. */
export const MERGE_MAX_BYTES = 150 * 1024 * 1024
const PAGE_WIDTH = 595

/**
 * Downloads a shelf's PDFs and photos and joins them into one PDF, in order, in the browser.
 * Originals are never touched. Files that cannot be read (damaged, protected) are skipped and listed.
 */
export async function mergeToPdf(
  sources: MergeSource[],
  title: string,
  onProgress?: (done: number, total: number) => void,
): Promise<{ file: File; pages: number; skipped: string[] }> {
  const out = await PDFDocument.create()
  out.setTitle(title)
  out.setProducer('VJNOTES')
  const skipped: string[] = []
  let bytesSeen = 0
  let pages = 0

  for (const [i, s] of sources.entries()) {
    onProgress?.(i, sources.length)
    try {
      const res = await fetch(s.url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      bytesSeen += blob.size
      if (bytesSeen > MERGE_MAX_BYTES) {
        throw new Error('too-big')
      }
      if (s.mime === 'application/pdf') {
        const src = await PDFDocument.load(await blob.arrayBuffer(), { ignoreEncryption: true })
        const copied = await out.copyPages(src, src.getPageIndices())
        for (const p of copied) out.addPage(p)
        pages += copied.length
      } else {
        const { bytes, width, height } = await toJpeg(blob)
        const image = await out.embedJpg(bytes)
        const h = (PAGE_WIDTH * height) / width
        out.addPage([PAGE_WIDTH, h]).drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: h })
        pages += 1
      }
    } catch (e) {
      if (e instanceof Error && e.message === 'too-big') {
        throw new Error('These files are too large to join in the browser. Download them one by one instead.')
      }
      skipped.push(s.name)
    }
  }
  onProgress?.(sources.length, sources.length)
  if (pages === 0) throw new Error('None of the files could be joined.')
  const bytes = await out.save()
  const safe = title.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'Notes'
  return { file: new File([bytes as BlobPart], `${safe}.pdf`, { type: 'application/pdf' }), pages, skipped }
}
