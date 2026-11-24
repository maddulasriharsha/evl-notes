import 'server-only'

import { supabaseConfigured } from '@/lib/env'
import { sharedCodes } from '@/lib/curriculum'
import { supabasePublic } from '@/lib/supabase/server'

export interface Textbook {
  id: string
  subject_code: string
  title: string
  authors: string | null
  edition: string | null
  kind: 'textbook' | 'reference'
  link: string | null
}

const COLUMNS = 'id, subject_code, title, authors, edition, kind, link'

/** The books for a subject (and the same subject under other branches' codes). Empty until the table exists. */
export async function textbooksFor(code: string): Promise<Textbook[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabasePublic()
    .from('textbooks')
    .select(COLUMNS)
    .in('subject_code', sharedCodes(code))
    .order('kind', { ascending: true })
    .order('created_at', { ascending: true })
  return error ? [] : ((data ?? []) as Textbook[])
}

/** Every listed book, for the Textbooks page. */
export async function allTextbooks(): Promise<Textbook[]> {
  if (!supabaseConfigured) return []
  const { data, error } = await supabasePublic().from('textbooks').select(COLUMNS).order('created_at', { ascending: true }).limit(2000)
  return error ? [] : ((data ?? []) as Textbook[])
}

/** Where to look for a book: the link a moderator gave, or a book search for its title. */
export function findBookUrl(b: Pick<Textbook, 'title' | 'authors' | 'link'>) {
  return b.link ?? `https://www.google.com/search?tbm=bks&q=${encodeURIComponent(`${b.title} ${b.authors ?? ''}`.trim())}`
}
