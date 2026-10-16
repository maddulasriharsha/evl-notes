import data from '@/data/drive-library.json'
import { sharedCodes } from '@/lib/curriculum'

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

export type Placement = { subject: string; unit: number }

/** A file as listed: moved files are placed exactly where they were put (and count as "forced"). */
type Entry = DriveFile & { forced?: boolean }

function buildIndex(moves?: ReadonlyMap<string, Placement>, titles?: ReadonlyMap<string, string>) {
  const bySubject = new Map<string, Entry[]>()
  const byId = new Map<string, DriveFile>()
  for (const original of driveFiles) {
    const retitled = titles?.get(original.id)
    const f = retitled ? { ...original, title: retitled } : original
    const move = moves?.get(f.id)
    if (move) {
      const moved: Entry = { ...f, subject: move.subject, unit: move.unit, forced: true }
      byId.set(f.id, moved)
      const list = bySubject.get(move.subject) ?? []
      list.push(moved)
      bySubject.set(move.subject, list)
      continue
    }
    byId.set(f.id, f)
    const placements = [{ subject: f.subject, unit: f.unit }, ...(f.also ?? [])]
    for (const p of placements) {
      const placed: DriveFile = p.subject === f.subject && p.unit === f.unit ? f : { ...f, subject: p.subject, unit: p.unit }
      const list = bySubject.get(p.subject) ?? []
      list.push(placed)
      bySubject.set(p.subject, list)
    }
  }
  return { bySubject, byId }
}

/** Previous question papers are the official exam papers imported from the college library. */
const PAPERS_SOURCE = 'Previous papers'
const isPaper = (f: Entry) => (f.forced ? f.unit === 6 : f.kind === 'questions' && f.source === PAPERS_SOURCE)
const isBank = (f: Entry) => (f.forced ? f.unit === 7 : f.kind === 'questions' && !isPaper(f))

const kindOrder: Record<DriveKind, number> = { notes: 0, slides: 1, lab: 2, questions: 3 }

function sortFiles(a: DriveFile, b: DriveFile) {
  return kindOrder[a.kind] - kindOrder[b.kind] || a.title.localeCompare(b.title, undefined, { numeric: true })
}

function filesIn(index: ReturnType<typeof buildIndex>, subject: string, unit?: number) {
  // The same subject taught to other branches shares one set of notes (each file once).
  const seen = new Set<string>()
  const list = sharedCodes(subject)
    .flatMap((code) => index.bySubject.get(code) ?? [])
    .filter((f) => !seen.has(f.id) && !!seen.add(f.id))
  // Section 6 is "Previous question papers" (the official exam papers); section 7 is the "Question
  // bank" (important questions, assignments, question sets). Moved files go where they were put.
  const filtered =
    unit === undefined
      ? list
      : unit === 6
        ? list.filter(isPaper)
        : unit === 7
          ? list.filter(isBank)
          : unit === 0
            ? // Question files without a chapter belong to the papers or the question bank, not to Complete notes.
              list.filter((f) => (f.forced ? f.unit === 0 : (f.unit ?? 0) === 0 && f.kind !== 'questions'))
            : list.filter((f) => (f.forced ? f.unit === unit : f.unit === unit))
  return [...filtered].sort(sortFiles)
}

const base = buildIndex()

export function driveFilesFor(subject: string, unit?: number) {
  return filesIn(base, subject, unit)
}

export function driveFile(id: string) {
  return base.byId.get(id)
}

/** Drive file counts per subject and per subject+unit, for the counters on listing pages. */
export function driveCount(subject: string, unit?: number) {
  return driveFilesFor(subject, unit).length
}

/** The same lookups with the admins' moves and new titles applied (see lib/library-live.ts). */
export function libraryWith(moves: ReadonlyMap<string, Placement>, titles?: ReadonlyMap<string, string>) {
  const index = buildIndex(moves, titles)
  return {
    files: driveFiles.map((f) => index.byId.get(f.id) ?? f),
    filesFor: (subject: string, unit?: number) => filesIn(index, subject, unit),
    count: (subject: string, unit?: number) => filesIn(index, subject, unit).length,
    file: (id: string) => index.byId.get(id),
  }
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
