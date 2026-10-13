/** What can be uploaded, shared by the browser (to explain) and the server (to enforce). */

const MB = 1024 * 1024

/** Stored on the site first, then moved to Google Drive by the backup job. */
export const SITE_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const
/** The site's own storage takes at most this much per file. */
export const SITE_MAX_BYTES = 50 * MB

/** Word and PowerPoint files go straight to Google Drive, which can preview them. */
export const OFFICE_MIMES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
] as const

export const DIRECT_MIMES: readonly string[] = [...SITE_MIMES, ...OFFICE_MIMES]
/** Largest file accepted at all (bigger PDFs and photos skip the site's storage and go straight to Drive). */
export const MAX_BYTES = 120 * MB

const BY_EXT: Record<string, string> = {
  doc: OFFICE_MIMES[0],
  docx: OFFICE_MIMES[1],
  ppt: OFFICE_MIMES[2],
  pptx: OFFICE_MIMES[3],
}

/** The file's type; Windows sometimes reports none for Office files, so fall back to the extension. */
export function mimeOf(file: { name: string; type: string }): string {
  if (file.type) return file.type
  return BY_EXT[file.name.split('.').pop()?.toLowerCase() ?? ''] ?? ''
}

export const isOffice = (mime: string) => (OFFICE_MIMES as readonly string[]).includes(mime)

/** Must this file skip the site's storage and go straight to Google Drive? */
export function goesToDrive(mime: string, size: number) {
  return isOffice(mime) || size > SITE_MAX_BYTES
}

export function uploadProblem(file: { name: string; type: string; size: number }): string | null {
  const mime = mimeOf(file)
  if (!DIRECT_MIMES.includes(mime)) return 'Only PDF, images (JPG, PNG, WebP, GIF), Word or PowerPoint files'
  if (file.size === 0) return 'Empty file'
  if (file.size > MAX_BYTES) return 'Larger than 120 MB'
  return null
}
