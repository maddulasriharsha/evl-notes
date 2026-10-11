import 'server-only'

import { supabaseConfigured } from '@/lib/env'
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
}

export interface NoteCollection {
  id: string
  owner_id: string
  owner_name: string
  owner_is_admin: boolean
  owner_is_mod: boolean
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

// Helpful votes live in a table added by a later migration. Until it exists, read without it so
// the site keeps working; the first failed read flips this off for the rest of the process.
let votesReady = true
const fileColumns = () => (votesReady ? `${BASE_COLUMNS}, file_votes(count)` : BASE_COLUMNS)

/** Runs a read that selects file columns, retrying once without votes if that table is missing. */
async function readWithVotes<T extends { error: { message: string } | null }>(run: (columns: string) => PromiseLike<T>): Promise<T> {
  const first = await run(fileColumns())
  if (first.error && votesReady && /file_votes/.test(first.error.message)) {
    votesReady = false
    return run(fileColumns())
  }
  return first
}

type Owner = { display_name: string; role: string } | null
type FileRow = Omit<NoteFile, 'comment_count' | 'helpful_count'> & { comments?: { count: number }[]; file_votes?: { count: number }[] }

function shapeFile({ comments, file_votes, ...f }: FileRow): NoteFile {
  return { ...f, comment_count: comments?.[0]?.count ?? 0, helpful_count: file_votes?.[0]?.count ?? 0 }
}

type CollectionRow = Omit<NoteCollection, 'owner_name' | 'owner_is_admin' | 'owner_is_mod' | 'helpful' | 'files'> & {
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
      .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, profiles(display_name, role), files(${cols})`)
      .eq('subject_code', subject)
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

/** Live file counts per unit for a subject: { [unit]: count }. */
export async function countsForSubject(subject: string): Promise<Record<number, number>> {
  if (!supabaseConfigured) return {}
  const { data, error } = await supabasePublic()
    .from('collections')
    .select('unit, files(id)')
    .eq('subject_code', subject)
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
  return out
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
      .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, profiles(display_name, role), files(${cols})`)
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
