import 'server-only'

import { supabaseConfigured } from '@/lib/env'
import { supabasePublic } from '@/lib/supabase/server'

export interface NoteFile {
  id: string
  collection_id: string
  owner_id: string
  storage_path: string
  thumb_path: string | null
  preview_path: string | null
  name: string
  mime: string
  size_bytes: number
  page_count: number | null
  width: number | null
  height: number | null
  position: number
  created_at: string
  comment_count: number
}

export interface NoteCollection {
  id: string
  owner_id: string
  owner_name: string
  owner_is_admin: boolean
  subject_code: string
  unit: number
  description: string | null
  created_at: string
  updated_at: string
  files: NoteFile[]
}

const FILE_COLUMNS =
  'id, collection_id, owner_id, storage_path, thumb_path, preview_path, name, mime, size_bytes, page_count, width, height, position, created_at, comments(count)'

type Owner = { display_name: string; role: string } | null
type FileRow = Omit<NoteFile, 'comment_count'> & { comments?: { count: number }[] }

function shapeFile({ comments, ...f }: FileRow): NoteFile {
  return { ...f, comment_count: comments?.[0]?.count ?? 0 }
}

type CollectionRow = Omit<NoteCollection, 'owner_name' | 'owner_is_admin' | 'files'> & {
  profiles: Owner
  files: FileRow[]
}

function shape(rows: CollectionRow[]): NoteCollection[] {
  return rows
    .map(({ profiles, files, ...c }) => ({
      ...c,
      owner_name: profiles?.display_name ?? 'Unknown',
      owner_is_admin: profiles?.role === 'admin',
      files: files.map(shapeFile).sort(
        (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at),
      ),
    }))
    .filter((c) => c.files.length > 0)
}

/** Community collections (non-hidden, with at least one live file) for one chapter. */
export async function collectionsFor(subject: string, unit: number): Promise<NoteCollection[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabasePublic()
    .from('collections')
    .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, profiles(display_name, role), files(${FILE_COLUMNS})`)
    .eq('subject_code', subject)
    .eq('unit', unit)
    .is('files.deleted_at', null)
    .order('updated_at', { ascending: false })
  if (error) {
    console.error('collectionsFor', error.message)
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
  updated_at: string
  file_count: number
  cover: NoteFile | null
}

export async function recentlyUpdated(limit = 8): Promise<RecentCollection[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabasePublic()
    .from('collections')
    .select(`id, owner_id, subject_code, unit, description, created_at, updated_at, profiles(display_name, role), files(${FILE_COLUMNS})`)
    .is('files.deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(limit * 2)
  if (error) return []
  return shape((data ?? []) as unknown as CollectionRow[])
    .slice(0, limit)
    .map((c) => ({
      id: c.id,
      subject_code: c.subject_code,
      unit: c.unit,
      owner_name: c.owner_name,
      owner_is_admin: c.owner_is_admin,
      updated_at: c.updated_at,
      file_count: c.files.length,
      cover: c.files.find((f) => f.thumb_path) ?? c.files[0] ?? null,
    }))
}

export interface Contributor {
  id: string
  name: string
  is_admin: boolean
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
  subject_code: string
  unit: number
  siblings: NoteFile[]
}

export async function fileById(id: string): Promise<FileWithContext | null> {
  if (!supabaseConfigured || !/^[0-9a-f-]{36}$/i.test(id)) return null
  // One round trip: the file, its shelf, the owner and the shelf's other files.
  const { data: file } = await supabasePublic()
    .from('files')
    .select(`${FILE_COLUMNS}, collections(subject_code, unit, profiles(display_name, role), files(${FILE_COLUMNS}))`)
    .eq('id', id)
    .is('deleted_at', null)
    .is('collections.files.deleted_at', null)
    .maybeSingle()
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
}

export async function searchFiles(q: string): Promise<FileHit[]> {
  if (!supabaseConfigured || q.length < 2) return []
  const pattern = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`
  const { data, error } = await supabasePublic()
    .from('files')
    .select('id, name, mime, collections!inner(subject_code, unit, hidden, profiles(display_name, role))')
    .is('deleted_at', null)
    .ilike('name', pattern)
    .limit(30)
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
  }))
}
