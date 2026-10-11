'use client'

import { PDFDocument } from 'pdf-lib'

/** Longest side of each page image. 2000 px keeps handwriting sharp when zoomed. */
const MAX_SIDE = 2000
const JPEG_QUALITY = 0.82
/** A4 width in PDF points; each page keeps its photo's own shape. */
const PAGE_WIDTH = 595

async function toJpeg(file: File) {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot process images')
    ctx.fillStyle = '#ffffff' // transparent PNGs become white, not black
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
    if (!blob) throw new Error('Could not convert a photo')
    return { bytes: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height }
  } finally {
    bitmap.close()
  }
}

/**
 * Turns photos into one PDF in the browser, one photo per page, in the given order.
 * Photos are resized to 2000 px and saved as JPEG, so a page is usually 300–600 KB
 * instead of a 3–5 MB original.
 */
export async function photosToPdf(photos: File[], title: string, onProgress?: (done: number) => void) {
  const pdf = await PDFDocument.create()
  pdf.setTitle(title)
  pdf.setProducer('VJNOTES')
  for (const [i, photo] of photos.entries()) {
    const { bytes, width, height } = await toJpeg(photo)
    const image = await pdf.embedJpg(bytes)
    const pageHeight = (PAGE_WIDTH * height) / width
    pdf.addPage([PAGE_WIDTH, pageHeight]).drawImage(image, { x: 0, y: 0, width: PAGE_WIDTH, height: pageHeight })
    onProgress?.(i + 1)
  }
  const bytes = await pdf.save()
  const safe = title.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 120) || 'Notes'
  return new File([bytes as BlobPart], `${safe}.pdf`, { type: 'application/pdf' })
}
