'use client'

import { classifyWithAI } from '@/app/upload/classify-actions'
import { classifyText } from '@/lib/classify'
import { resizedCopy } from '@/lib/images'
import { guessPlacement } from '@/lib/organise'
import { pdfPageImage, pdfText } from '@/lib/pdf'

export interface SortInput {
  key: string
  file: File
}

export interface SortResult {
  key: string
  /** Subject, and chapter when it could be worked out. */
  place?: { code: string; unit: number | null }
  by?: 'name' | 'text' | 'ai'
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function photoDataUrl(file: File) {
  const { blob } = await resizedCopy(file, 1100, 0.72)
  return blob ? toDataUrl(blob) : null
}

/**
 * Decides where each new file belongs, without the person choosing a chapter.
 *   1. The file name ("DMS unit 3.pdf", a course code, "question paper").
 *   2. For PDFs with text: the words inside, compared with the syllabus.
 *   3. Pictures (photos, scanned PDFs): read by the AI helper, when it is switched on.
 * Photos taken together are treated as one notebook and share one answer.
 */
export async function autoSort(
  inputs: SortInput[],
  opts: { prefer: ReadonlySet<string>; branchId: string; ai: boolean },
  onResult: (r: SortResult) => void,
): Promise<void> {
  const photos: SortInput[] = []
  const pdfs: SortInput[] = []
  for (const i of inputs) (i.file.type === 'application/pdf' ? pdfs : photos).push(i)

  const finished = new Set<string>()
  const done = (r: SortResult) => {
    finished.add(r.key)
    onResult(r)
  }

  // ---- PDFs: one at a time (each is read in the browser)
  for (const p of pdfs) {
    let place: SortResult['place']
    let by: SortResult['by']
    const named = guessPlacement(p.file.name, opts.prefer)
    if (named) {
      place = { code: named.code, unit: named.unit }
      by = 'name'
    }
    if (!place || place.unit === null) {
      try {
        const text = await pdfText(p.file)
        const c = classifyText(text, opts.prefer)
        if (c && (!place || place.code === c.code)) {
          place = { code: c.code, unit: c.unit ?? place?.unit ?? null }
          by = 'text'
        }
      } catch {
        // Unreadable PDF: fall through to the picture check.
      }
    }
    if ((!place || place.unit === null) && opts.ai) {
      try {
        const page = await pdfPageImage(p.file)
        const url = page ? await toDataUrl(page) : null
        if (url) {
          const r = await classifyWithAI([url], opts.branchId)
          if (r.ok && (!place || place.code === r.code)) {
            place = { code: r.code, unit: r.unit ?? place?.unit ?? null }
            by = 'ai'
          }
        }
      } catch {
        // Leave it for the person to choose.
      }
    }
    done({ key: p.key, place, by })
  }

  // ---- Photos: file names first, then one look at a few pages for the whole set
  const unnamed: SortInput[] = []
  for (const ph of photos) {
    const named = guessPlacement(ph.file.name, opts.prefer)
    if (named && named.unit !== null) done({ key: ph.key, place: { code: named.code, unit: named.unit }, by: 'name' })
    else unnamed.push(ph)
  }
  if (unnamed.length > 0) {
    let shared: SortResult['place']
    if (opts.ai) {
      try {
        // First, middle and last page give the best picture of a notebook.
        const picks = [unnamed[0], unnamed[Math.floor(unnamed.length / 2)], unnamed[unnamed.length - 1]]
        const unique = [...new Set(picks.filter((x): x is SortInput => !!x))]
        const urls = (await Promise.all(unique.map((u) => photoDataUrl(u.file)))).filter((u): u is string => !!u)
        if (urls.length) {
          const r = await classifyWithAI(urls, opts.branchId)
          if (r.ok) shared = { code: r.code, unit: r.unit }
        }
      } catch {
        // Leave it for the person to choose.
      }
    }
    for (const ph of unnamed) done({ key: ph.key, place: shared, by: shared ? 'ai' : undefined })
  }

  // Anything not reported yet (should not happen) is released so nothing stays "reading".
  for (const i of inputs) if (!finished.has(i.key)) onResult({ key: i.key })
}

