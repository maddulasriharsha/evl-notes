import data from '@/data/drive-library.json'

/**
 * The owner's Google Drive material, sorted into subjects and chapters (docs/DRIVE_IMPORT.md)
 * and shown under the name ADMIN. Nothing is copied: files are previewed straight from
 * Google Drive, so they cost this site no storage.
 */
export type DriveKind = 'notes' | 'questions' | 'lab' | 'slides'

export interface DriveFile {
  id: string
  title: string
  ext: string
  subject: string
  /** 1–5 chapter, null = general / whole subject. */
  unit: number | null
  kind: DriveKind
  pages: number | null
  source: string
}

export const driveFiles = data as DriveFile[]

export const ADMIN_NAME = 'ADMIN'

const bySubject = new Map<string, DriveFile[]>()
const byId = new Map<string, DriveFile>()
for (const f of driveFiles) {
  const list = bySubject.get(f.subject) ?? []
  list.push(f)
  bySubject.set(f.subject, list)
  byId.set(f.id, f)
}

const kindOrder: Record<DriveKind, number> = { notes: 0, slides: 1, lab: 2, questions: 3 }

function sortFiles(a: DriveFile, b: DriveFile) {
  return kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title, undefined, { numeric: true })
}

export function driveFilesFor(subject: string, unit?: number) {
  const list = bySubject.get(subject) ?? []
  const filtered = unit === undefined ? list : list.filter((f) => (f.unit ?? 0) === unit)
  return [...filtered].sort(sortFiles)
}

export function driveFile(id: string) {
  return byId.get(id)
}

export function isImage(ext: string) {
  return ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext)
}

export function drivePreviewUrl(id: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`
}

export function driveThumbUrl(id: string, width = 480) {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`
}

export function driveOpenUrl(id: string) {
  return `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`
}

export function driveDownloadUrl(id: string) {
  return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`
}

export const kindLabel: Record<DriveKind, string> = {
  notes: 'Notes',
  slides: 'Slides',
  lab: 'Lab',
  questions: 'Questions',
}
