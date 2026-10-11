import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Bookmark } from 'lucide-react'
import { RecentNotes } from '@/components/recent-notes'
import { Container, Empty, OwnerName, SectionHeading } from '@/components/ui'
import { findSubject, sectionLabel } from '@/lib/curriculum'
import { plural } from '@/lib/format'
import { currentUser, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Saved notes' }
export const dynamic = 'force-dynamic'

interface Row {
  file_id: string
  created_at: string
  files: {
    id: string
    name: string
    collections: { subject_code: string; unit: number; profiles: { display_name: string; role: string } | null } | null
  } | null
}

export default async function SavedPage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=/saved')
  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('bookmarks')
    .select('file_id, created_at, files(id, name, collections(subject_code, unit, profiles(display_name, role)))')
    .order('created_at', { ascending: false })
    .limit(200)
  // A note that has been hidden since it was saved simply drops out of the list.
  const rows = ((data ?? []) as unknown as Row[]).filter((r) => r.files && r.files.collections)

  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Only you can see this</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Saved notes</h1>
      <p className="mt-2 text-ink-2">{plural(rows.length, 'saved note')}. Tap Save on any note to keep it here.</p>

      <div className="mt-8">
        {rows.length === 0 ? (
          <Empty title="Nothing saved yet">
            Open a note and press <Bookmark className="inline size-4" /> Save. <Link href="/#branches" className="font-medium text-accent">Browse notes</Link>
          </Empty>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {rows.map((r) => {
              const f = r.files!
              const c = f.collections!
              return (
                <Link key={r.file_id} href={`/view/u/${f.id}`} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                  <span className="flex text-xs text-ink-3">
                    {findSubject(c.subject_code)?.subject.short ?? c.subject_code} · {sectionLabel(c.unit)} · by&nbsp;
                    <OwnerName name={c.profiles?.display_name ?? 'Unknown'} admin={c.profiles?.role === 'admin'} moderator={c.profiles?.role === 'moderator'} />
                  </span>
                  <span className="block truncate font-medium">{f.name}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>

      <section className="mt-12">
        <SectionHeading title="Recently opened" hint="On this device only" />
        <RecentNotes />
      </section>
    </Container>
  )
}
