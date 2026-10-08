import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AdminHideToggle } from '@/components/admin-hide-toggle'
import { Container } from '@/components/ui'
import { findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
import { plural, timeAgo } from '@/lib/format'
import { currentProfile, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const me = await currentProfile()
  if (!me) redirect('/login?next=/admin')
  if (me.profile?.role !== 'admin') notFound()

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('collections')
    .select('id, subject_code, unit, hidden, updated_at, profiles(display_name), files(id, deleted_at)')
    .order('updated_at', { ascending: false })
    .limit(200)
  const rows = (data ?? []) as unknown as {
    id: string
    subject_code: string
    unit: number
    hidden: boolean
    updated_at: string
    profiles: { display_name: string } | null
    files: { id: string; deleted_at: string | null }[]
  }[]

  return (
    <Container className="py-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Moderation</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Hide a shelf that is spam or in the wrong place. Hiding never deletes anything; you can show it again at any time.
      </p>
      <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
        <table className="w-full text-sm">
          <thead className="border-b border-line text-left text-xs tracking-wide text-ink-3 uppercase">
            <tr>
              <th className="px-4 py-3 font-medium">Shelf</th>
              <th className="px-4 py-3 font-medium">By</th>
              <th className="px-4 py-3 font-medium">Files</th>
              <th className="px-4 py-3 font-medium">Updated</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-b border-line last:border-0 ${r.hidden ? 'bg-danger-soft/40' : ''}`}>
                <td className="px-4 py-3">
                  <Link href={`${sectionHref(r.subject_code, r.unit)}#c-${r.id}`} className="font-medium hover:text-accent">
                    {findSubject(r.subject_code)?.subject.short ?? r.subject_code} · {sectionLabel(r.unit)}
                  </Link>
                </td>
                <td className="px-4 py-3">{r.profiles?.display_name ?? 'Unknown'}</td>
                <td className="px-4 py-3 tabular-nums">{plural(r.files.filter((f) => !f.deleted_at).length, 'file')}</td>
                <td className="px-4 py-3 text-ink-3">{timeAgo(r.updated_at)}</td>
                <td className="px-4 py-3 text-right">
                  <AdminHideToggle id={r.id} hidden={r.hidden} subject={r.subject_code} unit={r.unit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Container>
  )
}
