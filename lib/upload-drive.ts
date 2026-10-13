'use client'

import { finishDriveUpload, startDriveUpload } from '@/app/upload/drive-actions'
import { addDriveLink, type Stage } from '@/lib/upload'
import { mimeOf } from '@/lib/upload-rules'

/**
 * Sends a file straight from the browser to the site's Google Drive (Word and PowerPoint files, and
 * PDFs or photos too big for the site's own storage), then saves it as a Drive note.
 */
export async function uploadToDrive(
  file: File,
  opts: { userId: string; collectionId: string; position: number; name: string },
  onStage: (s: Stage) => void,
) {
  const mime = mimeOf(file)
  onStage('preparing')
  const started = await startDriveUpload({ name: file.name, mime, size: file.size })
  if (!started.ok) throw new Error(started.message)
  onStage('uploading')
  const res = await fetch(started.url, { method: 'PUT', headers: { 'Content-Type': mime }, body: file })
  const made = (await res.json().catch(() => null)) as { id?: string } | null
  if (!res.ok || !made?.id) throw new Error('Google Drive did not accept the file. Try again.')
  const done = await finishDriveUpload(made.id)
  if (!done.ok) throw new Error(done.message)
  onStage('saving')
  await addDriveLink({ ...opts, driveId: made.id, kind: 'file' })
  onStage('done')
}
