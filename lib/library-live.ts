import 'server-only'

import { unstable_cache } from 'next/cache'
import { supabaseConfigured } from '@/lib/env'
import { libraryWith, type Placement } from '@/lib/library'
import { supabasePublic } from '@/lib/supabase/server'

type Edits = { moves: [string, Placement][]; titles: [string, string][]; hidden: string[]; tagged: string[] }

const loadEdits = unstable_cache(
  async (): Promise<Edits> => {
    if (!supabaseConfigured) return { moves: [], titles: [], hidden: [], tagged: [] }
    const db = supabasePublic()
    const [placed, named, gone, marked] = await Promise.all([
      db.from('drive_placements').select('file_id, subject_code, unit'),
      db.from('drive_titles').select('file_id, title'),
      db.from('drive_hidden').select('file_id'),
      db.from('drive_question_tags').select('file_id'),
    ])
    // The tables arrive with migrations; until then nothing is moved, retitled, hidden or tagged.
    return {
      moves: placed.error
        ? []
        : ((placed.data ?? []) as { file_id: string; subject_code: string; unit: number }[]).map((r) => [r.file_id, { subject: r.subject_code, unit: r.unit }]),
      titles: named.error ? [] : ((named.data ?? []) as { file_id: string; title: string }[]).map((r) => [r.file_id, r.title]),
      hidden: gone.error ? [] : ((gone.data ?? []) as { file_id: string }[]).map((r) => r.file_id),
      tagged: marked.error ? [] : ((marked.data ?? []) as { file_id: string }[]).map((r) => r.file_id),
    }
  },
  ['drive-placements'],
  // Moves, renames and hides refresh this at once (updateTag in refreshChapter); the hour is only a fallback.
  { revalidate: 3600, tags: ['drive-placements'] },
)

/** The Drive library with the admins' moves, new titles and hidden files applied. Use this on pages; the plain exports ignore them. */
export async function liveLibrary() {
  const { moves, titles, hidden, tagged } = await loadEdits()
  return libraryWith(new Map(moves), new Map(titles), new Set(hidden), new Set(tagged))
}
