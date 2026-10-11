import 'server-only'

import { supabaseConfigured } from '@/lib/env'
import { supabasePublic } from '@/lib/supabase/server'

/** How many people are waiting for notes in this chapter. Zero if the table is not there yet. */
export async function openRequestCount(subject: string, unit: number): Promise<number> {
  if (!supabaseConfigured) return 0
  const { count, error } = await supabasePublic()
    .from('note_requests')
    .select('id', { count: 'exact', head: true })
    .eq('subject_code', subject)
    .eq('unit', unit)
    .is('closed_at', null)
  return error ? 0 : (count ?? 0)
}

export interface RequestedChapter {
  subject_code: string
  unit: number
  count: number
  latest: string
  messages: string[]
}

/**
 * Chapters people are still waiting for, most-requested first. A request counts as answered once
 * a live note has been uploaded to that chapter after it was made.
 */
export async function openRequests(): Promise<RequestedChapter[]> {
  if (!supabaseConfigured) return []
  const supabase = supabasePublic()
  const { data, error } = await supabase
    .from('note_requests')
    .select('subject_code, unit, message, created_at')
    .is('closed_at', null)
    .order('created_at', { ascending: false })
    .limit(500)
  if (error || !data) return []
  const rows = data as { subject_code: string; unit: number; message: string | null; created_at: string }[]
  if (rows.length === 0) return []

  const codes = [...new Set(rows.map((r) => r.subject_code))]
  const { data: shelves } = await supabase
    .from('collections')
    .select('subject_code, unit, files(created_at)')
    .in('subject_code', codes)
    .eq('hidden', false)
    .is('files.deleted_at', null)
  const newest = new Map<string, string>()
  for (const s of (shelves ?? []) as { subject_code: string; unit: number; files: { created_at: string }[] }[]) {
    for (const f of s.files) {
      const key = `${s.subject_code}:${s.unit}`
      if (f.created_at > (newest.get(key) ?? '')) newest.set(key, f.created_at)
    }
  }

  const groups = new Map<string, RequestedChapter>()
  for (const r of rows) {
    const key = `${r.subject_code}:${r.unit}`
    if ((newest.get(key) ?? '') > r.created_at) continue
    const g = groups.get(key) ?? { subject_code: r.subject_code, unit: r.unit, count: 0, latest: r.created_at, messages: [] }
    g.count += 1
    if (r.message && g.messages.length < 3) g.messages.push(r.message)
    groups.set(key, g)
  }
  return [...groups.values()].sort((a, b) => b.count - a.count || b.latest.localeCompare(a.latest))
}

export interface FollowedNote {
  id: string
  name: string
  subject_code: string
  unit: number
  created_at: string
  owner_name: string
}

/** The latest notes in the given subjects (for the "Following" page). */
export async function latestInSubjects(codes: string[], limit = 40): Promise<FollowedNote[]> {
  if (!supabaseConfigured || codes.length === 0) return []
  const { data, error } = await supabasePublic()
    .from('files')
    .select('id, name, created_at, collections!inner(subject_code, unit, hidden, profiles(display_name))')
    .in('collections.subject_code', codes)
    .eq('collections.hidden', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return (data as unknown as {
    id: string
    name: string
    created_at: string
    collections: { subject_code: string; unit: number; profiles: { display_name: string } | null }
  }[]).map((r) => ({
    id: r.id,
    name: r.name,
    created_at: r.created_at,
    subject_code: r.collections.subject_code,
    unit: r.collections.unit,
    owner_name: r.collections.profiles?.display_name ?? 'Unknown',
  }))
}
