import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { CloudUpload, LogOut, ShieldCheck } from 'lucide-react'
import { PasswordForm } from '@/components/password-form'
import { ProfileForm } from '@/components/profile-form'
import { ShelfManager, type ShelfFile } from '@/components/shelf-manager'
import { Container, Empty } from '@/components/ui'
import { findSubject, sectionHref, sectionLabel, sectionTitle } from '@/lib/curriculum'
import { plural } from '@/lib/format'
import { currentProfile, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'My notes' }
export const dynamic = 'force-dynamic'

export default async function MePage() {
  const me = await currentProfile()
  if (!me) redirect('/login?next=/me')
  if (!me.profile) redirect('/upload')

  const supabase = await supabaseServer()
  const { data } = await supabase
    .from('collections')
    .select('id, subject_code, unit, description, hidden, updated_at, files(id, name, mime, size_bytes, thumb_path, storage_path, drive_id, position, created_at, deleted_at)')
    .eq('owner_id', me.user.id)
    .order('updated_at', { ascending: false })
  const shelves = (data ?? []) as {
    id: string
    subject_code: string
    unit: number
    description: string | null
    hidden: boolean
    updated_at: string
    files: ShelfFile[]
  }[]
  const live = shelves.reduce((n, s) => n + s.files.filter((f) => !f.deleted_at).length, 0)

  return (
    <Container className="py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Signed in as {me.user.email}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">My notes</h1>
          <p className="mt-2 text-ink-2">
            {plural(live, 'file')} across {plural(shelves.length, 'chapter')}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {me.profile.role === 'admin' && (
            <Link href="/admin" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong">
              <ShieldCheck className="size-4" /> Admin
            </Link>
          )}
          <Link href="/upload" className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90">
            <CloudUpload className="size-4" /> Upload more
          </Link>
          <form action="/auth/signout" method="post">
            <button className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong">
              <LogOut className="size-4" /> Sign out
            </button>
          </form>
        </div>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          {shelves.length === 0 ? (
            <Empty title="You haven’t uploaded anything yet">
              <Link href="/upload" className="font-medium text-accent">Upload your first notes</Link>
            </Empty>
          ) : (
            shelves.map((s) => {
              const found = findSubject(s.subject_code)
              return (
                <section key={s.id} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
                        {found?.subject.short ?? s.subject_code} · {sectionLabel(s.unit)}
                      </p>
                      <h2 className="font-semibold">{found ? sectionTitle(found.subject, s.unit) : s.subject_code}</h2>
                      {s.hidden && <p className="mt-1 text-xs text-danger">Hidden by an admin. Only you can see it.</p>}
                    </div>
                    <div className="flex gap-2 text-sm">
                      <Link href={sectionHref(s.subject_code, s.unit)} className="rounded-lg px-2.5 py-1.5 font-medium text-ink-2 hover:bg-surface-2">View</Link>
                      <Link href={`/upload?subject=${s.subject_code}&unit=${s.unit}`} className="rounded-lg bg-surface-2 px-2.5 py-1.5 font-medium hover:text-ink">Add files</Link>
                    </div>
                  </div>
                  <ShelfManager collectionId={s.id} subject={s.subject_code} unit={s.unit} description={s.description} files={s.files} />
                </section>
              )
            })
          )}
        </div>
        <aside id="profile" className="h-fit scroll-mt-24 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <ProfileForm userId={me.user.id} initialName={me.profile.display_name} existing />
          <div className="mt-5 border-t border-line pt-5">
            <PasswordForm />
          </div>
          <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-ink-3">
            Deleted files disappear from the site straight away and stay at the bottom of each chapter here, so you can restore them if you deleted something by mistake.
          </p>
        </aside>
      </div>
    </Container>
  )
}
