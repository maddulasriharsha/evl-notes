import 'server-only'

import { unstable_cache } from 'next/cache'
import { supabaseConfigured } from '@/lib/env'
import { libraryWith, type Placement } from '@/lib/library'
import { supabasePublic } from '@/lib/supabase/server'

type Edits = { moves: [string, Placement][]; titles: [string, string][] }

const loadEdits = unstable_cache(
  async (): Promise<Edits> => {
    if (!supabaseConfigured) return { moves: [], titles: [] }
    const db = supabasePublic()
    const [placed, named] = await Promise.all([
      db.from('drive_placements').select('file_id, subject_code, unit'),
      db.from('drive_titles').select('file_id, title'),
    ])
    // The tables arrive with migrations; until then nothing is moved or retitled.
    return {
      moves: placed.error
        ? []
        : ((placed.data ?? []) as { file_id: string; subject_code: string; unit: number }[]).map((r) => [r.file_id, { subject: r.subject_code, unit: r.unit }]),
      titles: named.error ? [] : ((named.data ?? []) as { file_id: string; title: string }[]).map((r) => [r.file_id, r.title]),
    }
  },
  ['drive-placements'],
  // Moves refresh this at once (updateTag in refreshChapter); the hour is only a fallback.
  { revalidate: 3600, tags: ['drive-placements'] },
)

/** The Drive library with the admins' moves and new titles applied. Use this on pages; the plain exports ignore moves. */
export async function liveLibrary() {
  const { moves, titles } = await loadEdits()
  return libraryWith(new Map(moves), new Map(titles))
}
