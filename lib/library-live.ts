import 'server-only'

import { unstable_cache } from 'next/cache'
import { supabaseConfigured } from '@/lib/env'
import { libraryWith, type Placement } from '@/lib/library'
import { supabasePublic } from '@/lib/supabase/server'

const loadMoves = unstable_cache(
  async (): Promise<[string, Placement][]> => {
    if (!supabaseConfigured) return []
    const { data, error } = await supabasePublic().from('drive_placements').select('file_id, subject_code, unit')
    if (error) return [] // the table arrives with a migration; until then nothing is moved
    return ((data ?? []) as { file_id: string; subject_code: string; unit: number }[]).map((r) => [r.file_id, { subject: r.subject_code, unit: r.unit }])
  },
  ['drive-placements'],
  { revalidate: 30, tags: ['drive-placements'] },
)

/** The Drive library with the admins' moves applied. Use this on pages; the plain exports ignore moves. */
export async function liveLibrary() {
  return libraryWith(new Map(await loadMoves()))
}
