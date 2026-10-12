import data from '@/data/drive-library.json'

/**
 * The owner's Google Drive notes, sorted into subjects and chapters (docs/DRIVE_IMPORT.md).
 * They appear inside each chapter as the owner's notes, merged with anything the owner uploads.
 * Nothing is copied: files are previewed straight from Google Drive, so they use no storage.
 */
export const LIBRARY_OWNER = { name: 'Sriharsha Reddy', admin: true } as const

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
  /** Other subjects and chapters that show the same file (for example BEEE notes also used by BEE and EEEE). */
  also?: { subject: string; unit: number | null }[]
}

export const driveFiles = data as DriveFile[]

const bySubject = new Map<string, DriveFile[]>()
const byId = new Map<string, DriveFile>()
for (const f of driveFiles) {
  byId.set(f.id, f)
  const placements = [{ subject: f.subject, unit: f.unit }, ...(f.also ?? [])]
  for (const p of placements) {
    const placed: DriveFile = p.subject === f.subject && p.unit === f.unit ? f : { ...f, subject: p.subject, unit: p.unit }
    const list = bySubject.get(p.subject) ?? []
    list.push(placed)
    bySubject.set(p.subject, list)
  }
}

/** Previous question papers are the official exam papers imported from the college library. */
const PAPERS_SOURCE = 'Previous papers'
const isPaper = (f: DriveFile) => f.kind === 'questions' && f.source === PAPERS_SOURCE

const kindOrder: Record<DriveKind, number> = { notes: 0, slides: 1, lab: 2, questions: 3 }

function sortFiles(a: DriveFile, b: DriveFile) {
  return kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title, undefined, { numeric: true })
}

export function driveFilesFor(subject: string, unit?: number) {
  const list = bySubject.get(subject) ?? []
  // Section 6 is "Previous question papers" (the official exam papers); section 7 is the "Question
  // bank" (important questions, assignments, question sets). Both draw on the owner's question files.
  const filtered =
    unit === undefined
      ? list
      : unit === 6
        ? list.filter(isPaper)
        : unit === 7
          ? list.filter((f) => f.kind === 'questions' && !isPaper(f))
          : list.filter((f) => (f.unit ?? 0) === unit)
  return [...filtered].sort(sortFiles)
}

export function driveFile(id: string) {
  return byId.get(id)
}

/** Drive file counts per subject and per subject+unit, for the counters on listing pages. */
export function driveCount(subject: string, unit?: number) {
  return driveFilesFor(subject, unit).length
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
