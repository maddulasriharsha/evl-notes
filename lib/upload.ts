'use client'

import { STORAGE_BUCKET } from '@/lib/env'
import { resizedCopy } from '@/lib/images'
import { pdfThumbnail } from '@/lib/pdf'
import { supabaseBrowser } from '@/lib/supabase/browser'

export const ACCEPTED = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
export const MAX_BYTES = 50 * 1024 * 1024
export const MAX_FILES = 40

export function checkFile(file: File): string | null {
  if (!(ACCEPTED as readonly string[]).includes(file.type)) return 'Only PDF, JPG, PNG, WebP or GIF files'
  if (file.size > MAX_BYTES) return 'Larger than 50 MB'
  if (file.size === 0) return 'Empty file'
  return null
}

/** Storage-safe version of a file name; the real name is kept in the database. */
export function safeName(name: string) {
  const dot = name.lastIndexOf('.')
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
  const base = (dot > 0 ? name.slice(0, dot) : name)
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|-+$/g, '')
    .slice(0, 80)
  return `${base || 'file'}${ext ? `.${ext}` : ''}`
}

/** Next free position in a shelf, so new files sort after the ones already there. */
export async function nextPosition(collectionId: string) {
  const { data } = await supabaseBrowser()
    .from('files')
    .select('position')
    .eq('collection_id', collectionId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle()
  return ((data as { position: number } | null)?.position ?? -1) + 1
}

/** Finds this person's shelf for a chapter, creating it the first time. */
export async function ensureCollection(userId: string, subject: string, unit: number, description?: string) {
  const supabase = supabaseBrowser()
  const find = () =>
    supabase.from('collections').select('id').eq('owner_id', userId).eq('subject_code', subject).eq('unit', unit).maybeSingle()
  const found = await find()
  if (found.data) return found.data.id as string
  const created = await supabase
    .from('collections')
    .insert({ owner_id: userId, subject_code: subject, unit, description: description?.trim() || null })
    .select('id')
    .single()
  if (created.data) return created.data.id as string
  // Two tabs racing: the unique constraint fired, so the shelf now exists.
  const again = await find()
  if (again.data) return again.data.id as string
  throw new Error(created.error?.message ?? 'Could not create your shelf for this chapter')
}

export type Stage = 'queued' | 'preparing' | 'uploading' | 'saving' | 'done' | 'error'

/**
 * Uploads one file: the untouched original, plus a small thumbnail (and a screen-sized
 * preview for images) so pages load fast. Storage paths are unique and never reused.
 */
export async function uploadOne(
  file: File,
  opts: { userId: string; collectionId: string; position: number; name: string },
  onStage: (s: Stage) => void,
) {
  const supabase = supabaseBrowser()
  const id = crypto.randomUUID()
  const dir = `${opts.userId}/${opts.collectionId}/${id}`
  const storagePath = `${dir}/${safeName(file.name)}`
  const isPdf = file.type === 'application/pdf'

  onStage('preparing')
  let thumb: Blob | null = null
  let preview: Blob | null = null
  let pages: number | null = null
  let width: number | null = null
  let height: number | null = null
  try {
    if (isPdf) {
      const r = await pdfThumbnail(file)
      thumb = r.blob
      pages = r.pages
    } else {
      const t = await resizedCopy(file, 640, 0.8)
      thumb = t.blob
      width = t.width
      height = t.height
      if (Math.max(width, height) > 1800) preview = (await resizedCopy(file, 1800, 0.86)).blob
    }
  } catch {
    // A thumbnail is a nice-to-have; the original still uploads.
  }

  onStage('uploading')
  const put = (path: string, body: Blob, type: string) =>
    supabase.storage.from(STORAGE_BUCKET).upload(path, body, { contentType: type, cacheControl: '31536000', upsert: false })
  const main = await put(storagePath, file, file.type)
  if (main.error) throw new Error(main.error.message)
  const thumbPath = thumb && !(await put(`${dir}/thumb.webp`, thumb, 'image/webp')).error ? `${dir}/thumb.webp` : null
  const previewPath = preview && !(await put(`${dir}/preview.webp`, preview, 'image/webp')).error ? `${dir}/preview.webp` : null

  onStage('saving')
  const { error } = await supabase.from('files').insert({
    id,
    collection_id: opts.collectionId,
    owner_id: opts.userId,
    storage_path: storagePath,
    thumb_path: thumbPath,
    preview_path: previewPath,
    name: opts.name.trim().slice(0, 200) || file.name.slice(0, 200),
    mime: file.type,
    size_bytes: file.size,
    page_count: pages,
    width,
    height,
    position: opts.position,
  })
  if (error) throw new Error(error.message)
  onStage('done')
  return id
}
