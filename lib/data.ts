import 'server-only'

import { supabaseConfigured } from '@/lib/env'
import { allSubjects, sharedCodes } from '@/lib/curriculum'
import { supabasePublic } from '@/lib/supabase/server'

export interface NoteFile {
  id: string
  collection_id: string
  owner_id: string
  /** Where the bytes live in Storage; null for a Google Drive link. */
  storage_path: string | null
  /** Google Drive id when this note is a link instead of an upload. */
  drive_id: string | null
  thumb_path: string | null
  preview_path: string | null
  name: string
  mime: string
  size_bytes: number | null
  page_count: number | null
  width: number | null
  height: number | null
  position: number
  created_at: string
  comment_count: number
  /** How many people marked this note helpful. */
  helpful_count: number
  /** Average of the 1 to 5 star ratings, or null when nobody has rated it. */
  rating_avg: number | null
  rating_count: number
  /** A short "what is inside", written by the uploader or staff. */
  summary: string | null
  /** Google Drive copy kept as a backup of the upload. */
  backup_drive_id: string | null
  /** Set once the Storage original was removed; the note is then served from the Drive copy. */
  original_removed_at: string | null
  /** Staff tags; "questions" also lists the note in the subject's Question bank. */
  tags: string[]
}

export interface NoteCollection {
  id: string
  owner_id: string
  owner_name: string
  owner_is_admin: boolean
  owner_is_mod: boolean
  /** The uploader's branch slug, when known. */
  owner_branch: string | null
  subject_code: string
  unit: number
  description: string | null
  created_at: string
  updated_at: string
  /** Helpful votes across the shelf's notes. */
  helpful: number
  files: NoteFile[]
}

const BASE_COLUMNS =
  'id, collection_id, owner_id, storage_path, drive_id, thumb_path, preview_path, name, mime, size_bytes, page_count, width, height, position, created_at, comments(count)'

// Helpful votes and the Drive-backup columns arrive with later migrations. Until they exist, read
// without them so the site keeps working; a failed read switches the missing part off for the rest
// of the process.
const optional = { votes: true, backup: true, tags: true, branch: true, ratings: true, summary: true }
/** The owner columns read with a shelf; `branch` arrives with a migration. */
const ownerColumns = () => (optional.branch ? 'profiles(display_name, role, branch)' : 'profiles(display_name, role)')
const fileColumns = () =>
  [
    BASE_COLUMNS,
    optional.backup && 'backup_drive_id, original_removed_at',
    optional.tags && 'tags',
    optional.votes && 'file_votes(count)',
    optional.ratings && 'file_ratings(stars)',
    optional.summary && 'summary',
  ]
    .filter(Boolean)
    .join(', ')

/** Runs a read that selects file columns, retrying without any optional part that is missing. */
async function readWithVotes<T extends { error: { message: string } | null }>(run: (columns: string) => PromiseLike<T>): Promise<T> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await run(fileColumns())
    const message = res.error?.message ?? ''
    if (!res.error) return res
    if (optional.votes && /file_votes/.test(message)) optional.votes = false
    else if (optional.backup && /backup_drive_id|original_removed_at/.test(message)) optional.backup = false
    else if (optional.tags && /\btags\b/.test(message)) optional.tags = false
    else if (optional.branch && /branch/.test(message)) optional.branch = false
    else if (optional.ratings && /file_ratings/.test(message)) optional.ratings = false
    else if (optional.summary && /\bsummary\b/.test(message)) optional.summary = false
    else return res
  }
  return run(fileColumns())
}

type Owner = { display_name: string; role: string; branch?: string | null } | null
type FileRow = Omit<NoteFile, 'comment_count' | 'helpful_count' | 'rating_avg' | 'rating_count' | 'summary' | 'backup_drive_id' | 'original_removed_at' | 'tags'> & {
  tags?: string[] | null
  file_ratings?: { stars: number }[]
  summary?: string | null
  comments?: { count: number }[]
  file_votes?: { count: number }[]
  backup_drive_id?: string | null
  original_removed_at?: string | null
}

function shapeFile({ comments, file_votes, file_ratings, summary, backup_drive_id, original_removed_at, tags, ...f }: FileRow): NoteFile {
  const stars = file_ratings ?? []
  return {
    ...f,
    tags: tags ?? [],
    comment_count: comments?.[0]?.count ?? 0,
    helpful_count: file_votes?.[0]?.count ?? 0,
    rating_count: stars.length,
    rating_avg: stars.length ? stars.reduce((n, r) => n + r.stars, 0) / stars.length : null,
    summary: summary ?? null,
    backup_drive_id: backup_drive_id ?? null,
    original_removed_at: original_removed_at ?? null,
  }
}

type CollectionRow = Omit<NoteCollection, 'owner_name' | 'owner_is_admin' | 'owner_is_mod' | 'owner_branch' | 'helpful' | 'files'> & {
  profiles: Owner
  files: FileRow[]
}

function shape(rows: CollectionRow[]): NoteCollection[] {
  return rows
    .map(({ profiles, files, ...c }) => {
      const shaped = files.map(shapeFile).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
      return {
        ...c,
        owner_name: profiles?.display_name ?? 'Unknown',
        owner_is_admin: profiles?.role === 'admin',
        owner_is_mod: profiles?.role === 'moderator',
        owner_branch: profiles?.branch ?? null,
        helpful: shaped.reduce((n, f) => n + f.helpful_count, 0),
        files: shaped,
      }
    })
    .filter((c) => c.files.length > 0)
}

/** Community collections (non-hidden, with at least one live file) for one chapter. */
export async function collectionsFor(subject: string, unit: number): Promise<NoteCollection[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await readWithVotes((cols) =>
    supabasePublic()
      .from('collections')
      .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, ${ownerColumns()}, files(${cols})`)
      .in('subject_code', sharedCodes(subject))
      .eq('unit', unit)
      .is('files.deleted_at', null)
      .order('updated_at', { ascending: false }),
  )
  if (error) {
    console.error('collectionsFor', error.message)
    return []
  }
  // Most helpful shelf first; Array.sort is stable, so ties keep "recently updated" order.
  return shape((data ?? []) as unknown as CollectionRow[]).sort((a, b) => b.helpful - a.helpful)
}

/**
 * Notes that staff tagged "questions", from any chapter of the subject, shelved by uploader.
 * They are listed in the Question bank next to the notes uploaded there.
 */
export async function taggedQuestionsFor(subject: string): Promise<NoteCollection[]> {
  if (!supabaseConfigured || !optional.tags) return []
  const { data, error } = await readWithVotes((cols) =>
    supabasePublic()
      .from('collections')
      .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, ${ownerColumns()}, files(${cols})`)
      .in('subject_code', sharedCodes(subject))
      .is('files.deleted_at', null)
      .contains('files.tags', ['questions'])
      .order('updated_at', { ascending: false }),
  )
  if (error) {
    if (/\btags\b/.test(error.message)) optional.tags = false
    return []
  }
  return shape((data ?? []) as unknown as CollectionRow[])
}

/** Live file counts per unit for a subject: { [unit]: count }. */
export async function countsForSubject(subject: string): Promise<Record<number, number>> {
  if (!supabaseConfigured) return {}
  const { data, error } = await supabasePublic()
    .from('collections')
    .select('unit, files(id)')
    .in('subject_code', sharedCodes(subject))
    .is('files.deleted_at', null)
  if (error) return {}
  const out: Record<number, number> = {}
  for (const row of (data ?? []) as { unit: number; files: { id: string }[] }[]) {
    out[row.unit] = (out[row.unit] ?? 0) + row.files.length
  }
  return out
}

/** Live file counts per subject: { [code]: count }. */
export async function countsBySubject(): Promise<Record<string, number>> {
  if (!supabaseConfigured) return {}
  const { data, error } = await supabasePublic()
    .from('collections')
    .select('subject_code, files(id)')
    .is('files.deleted_at', null)
  if (error) return {}
  const out: Record<string, number> = {}
  for (const row of (data ?? []) as { subject_code: string; files: { id: string }[] }[]) {
    out[row.subject_code] = (out[row.subject_code] ?? 0) + row.files.length
  }
  // A subject taught to several branches is one shared shelf: every code shows the combined count.
  const combined: Record<string, number> = { ...out }
  for (const { subject } of allSubjects()) {
    const codes = sharedCodes(subject.code)
    if (codes.length > 1) combined[subject.code] = codes.reduce((n, c) => n + (out[c] ?? 0), 0)
  }
  return combined
}

/** Live uploaded files and their pages (a photo counts as one page). */
export async function uploadTotals(): Promise<{ files: number; pages: number }> {
  if (!supabaseConfigured) return { files: 0, pages: 0 }
  const supabase = supabasePublic()
  let files = 0
  let pages = 0
  // Supabase returns at most 1,000 rows per request, so read in pages.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('files')
      .select('page_count, collections!inner(hidden)')
      .is('deleted_at', null)
      .range(from, from + 999)
    if (error || !data) break
    for (const f of data as { page_count: number | null }[]) {
      files += 1
      pages += f.page_count ?? 1
    }
    if (data.length < 1000) break
  }
  return { files, pages }
}

export interface RecentCollection {
  id: string
  subject_code: string
  unit: number
  owner_name: string
  owner_is_admin: boolean
  owner_is_mod: boolean
  updated_at: string
  file_count: number
  cover: NoteFile | null
}

export async function recentlyUpdated(limit = 8): Promise<RecentCollection[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await readWithVotes((cols) =>
    supabasePublic()
      .from('collections')
      .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, ${ownerColumns()}, files(${cols})`)
      .is('files.deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(limit * 2),
  )
  if (error) return []
  return shape((data ?? []) as unknown as CollectionRow[])
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      subject_code: c.subject_code,
      unit: c.unit,
      owner_name: c.owner_name,
      owner_is_admin: c.owner_is_admin,
      owner_is_mod: c.owner_is_mod,
      updated_at: c.updated_at,
      file_count: c.files.length,
      cover: c.files.find((f) => f.thumb_path) ?? c.files[0] ?? null,
    }))
}

export interface Contributor {
  id: string
  name: string
  is_admin: boolean
  is_mod: boolean
  files: number
  chapters: number
  subjects: number
  last: string
}

export async function contributors(): Promise<Contributor[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabasePublic()
    .from('collections')
    .select('owner_id, subject_code, updated_at, profiles(display_name, role), files(id)')
    .is('files.deleted_at', null)
  if (error) return []
  const map = new Map<string, Contributor & { subjectSet: Set<string> }>()
  for (const row of (data ?? []) as unknown as {
    owner_id: string
    subject_code: string
    updated_at: string
    profiles: Owner
    files: { id: string }[]
  }[]) {
    if (row.files.length === 0) continue
    const c = map.get(row.owner_id) ?? {
      id: row.owner_id,
      name: row.profiles?.display_name ?? 'Unknown',
      is_admin: row.profiles?.role === 'admin',
      is_mod: row.profiles?.role === 'moderator',
      files: 0,
      chapters: 0,
      subjects: 0,
      last: row.updated_at,
      subjectSet: new Set<string>(),
    }
    c.files += row.files.length
    c.chapters += 1
    c.subjectSet.add(row.subject_code)
    c.subjects = c.subjectSet.size
    if (row.updated_at > c.last) c.last = row.updated_at
    map.set(row.owner_id, c)
  }
  return [...map.values()]
    .map(({ subjectSet: _, ...c }) => c)
    .sort((a, b) => b.files - a.files)
}

export interface FileWithContext extends NoteFile {
  owner_name: string
  owner_is_admin: boolean
  owner_is_mod: boolean
  subject_code: string
  unit: number
  siblings: NoteFile[]
}

export async function fileById(id: string): Promise<FileWithContext | null> {
  if (!supabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return null
  // One round trip: the file, its shelf, the owner and the shelf's other files.
  const { data: file } = await readWithVotes((cols) =>
    supabasePublic()
      .from('files')
      .select(`${cols}, collections(subject_code, unit, profiles(display_name, role), files(${cols}))`)
      .eq('id', id)
      .is('deleted_at', null)
      .is('collections.files.deleted_at', null)
      .maybeSingle(),
  )
  if (!file) return null
  const { collections: col, ...own } = file as unknown as FileRow & {
    collections: { subject_code: string; unit: number; profiles: Owner; files: FileRow[] } | null
  }
  if (!col) return null
  const c = col
  return {
    ...shapeFile(own),
    owner_name: c.profiles?.display_name ?? 'Unknown',
    owner_is_admin: c.profiles?.role === 'admin',
    owner_is_mod: c.profiles?.role === 'moderator',
    subject_code: c.subject_code,
    unit: c.unit,
    siblings: c.files.map(shapeFile).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)),
  }
}

export interface FileHit {
  id: string
  name: string
  mime: string
  subject_code: string
  unit: number
  owner_name: string
  owner_is_admin: boolean
  owner_is_mod: boolean
}

export async function searchFiles(q: string): Promise<FileHit[]> {
  const terms = q.split(/\s+/).filter((t) => t.length > 0).slice(0, 5)
  if (!supabaseConfigured || q.length < 2 || terms.length === 0) return []
  let query = supabasePublic()
    .from('files')
    .select('id, name, mime, collections!inner(subject_code, unit, hidden, profiles(display_name, role))')
    .is('deleted_at', null)
  // Every word must appear in the file name, in any order: "laplace unit 2" finds "Unit 2 Laplace".
  for (const t of terms) query = query.ilike('name', `%${t.replace(/[%_\\]/g, (m) => `\\${m}`)}%`)
  const { data, error } = await query.limit(40)
  if (error) return []
  return ((data ?? []) as unknown as {
    id: string
    name: string
    mime: string
    collections: { subject_code: string; unit: number; profiles: Owner }
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    mime: r.mime,
    subject_code: r.collections.subject_code,
    unit: r.collections.unit,
    owner_name: r.collections.profiles?.display_name ?? 'Unknown',
    owner_is_admin: r.collections.profiles?.role === 'admin',
    owner_is_mod: r.collections.profiles?.role === 'moderator',
  }))
}
