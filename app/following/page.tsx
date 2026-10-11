import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { BellRing } from 'lucide-react'
import { FollowingList } from '@/components/following-list'
import { Container, Empty, SectionHeading } from '@/components/ui'
import { findSubject, subjectHref } from '@/lib/curriculum'
import { latestInSubjects } from '@/lib/community'
import { currentUser, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Following' }
export const dynamic = 'force-dynamic'

export default async function FollowingPage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=/following')
  const supabase = await supabaseServer()
  const { data } = await supabase.from('follows').select('subject_code').order('created_at', { ascending: false })
  const codes = ((data ?? []) as { subject_code: string }[]).map((r) => r.subject_code)
  const items = await latestInSubjects(codes)

  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Only you can see this</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Following</h1>
      <p className="mt-2 max-w-2xl text-ink-2">The newest notes in the subjects you follow. Press Follow on any subject page to add it.</p>

      {codes.length === 0 ? (
        <div className="mt-8">
          <Empty title="You are not following any subject yet">
            Open a subject and press <BellRing className="inline size-4" /> Follow. <Link href="/#branches" className="font-medium text-accent">Browse subjects</Link>
          </Empty>
        </div>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {codes.map((c) => (
              <Link key={c} href={subjectHref(c)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium hover:border-line-strong">
                {findSubject(c)?.subject.short ?? c}
              </Link>
            ))}
          </div>
          <section className="mt-10">
            <SectionHeading title="New notes" />
            {items.length === 0 ? (
              <p className="text-sm text-ink-3">No notes in these subjects yet.</p>
            ) : (
              <FollowingList items={items} />
            )}
          </section>
        </>
      )}
    </Container>
  )
}
