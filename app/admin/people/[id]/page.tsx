import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { CommentModButtons, FileModButtons, UserModButtons } from '@/components/admin-actions'
import { Container, OwnerName } from '@/components/ui'
import { findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
import { formatBytes, formatDate, plural, timeAgo } from '@/lib/format'
import { currentProfile, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Person · Admin' }
export const dynamic = 'force-dynamic'

interface Person {
  id: string
  display_name: string
  email: string
  role: string
  banned_at: string | null
  joined: string
  provider: string
  last_sign_in: string | null
  sign_ins: number
  files: number
  pages: number
  bytes: number
  chapters: number
  subjects: number
  comments: number
  last_upload: string | null
}

const where = (subject: string, unit: number) => `${findSubject(subject)?.subject.short ?? subject} · ${sectionLabel(unit)}`

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 font-semibold">{title}</h2>
      {children}
    </section>
  )
}

export default async function PersonPage({ params }: PageProps<'/admin/people/[id]'>) {
  const me = await currentProfile()
  if (!me) redirect('/login?next=/admin')
  if (me.profile?.role !== 'admin') notFound()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const supabase = await supabaseServer()
  const [people, files, comments, logins] = await Promise.all([
    supabase.rpc('admin_people'),
    supabase
      .from('files')
      .select('id, name, mime, size_bytes, page_count, created_at, deleted_at, collections(subject_code, unit)')
      .eq('owner_id', id)
      .order('created_at', { ascending: false }),
    supabase
      .from('comments')
      .select('id, body, created_at, deleted_at, file_id, files(name)')
      .eq('author_id', id)
      .order('created_at', { ascending: false })
      .limit(100),
    supabase.rpc('admin_user_logins', { p_user: id, p_limit: 50 }),
  ])
  const person = ((people.data ?? []) as Person[]).find((p) => p.id === id)
  if (!person) notFound()

  const fileRows = (files.data ?? []) as unknown as {
    id: string
    name: string
    mime: string
    size_bytes: number | null
    page_count: number | null
    created_at: string
    deleted_at: string | null
    collections: { subject_code: string; unit: number } | null
  }[]
  const commentRows = (comments.data ?? []) as unknown as {
    id: string
    body: string
    created_at: string
    deleted_at: string | null
    file_id: string
    files: { name: string } | null
  }[]
  const loginRows = (logins.data ?? []) as { method: string; device: string; at: string }[]

  const tiles = [
    { label: 'Files', value: person.files, sub: `${person.pages} pages · ${formatBytes(Number(person.bytes))}` },
    { label: 'Chapters', value: person.chapters, sub: plural(Number(person.subjects), 'subject') },
    { label: 'Comments', value: person.comments, sub: 'written' },
    { label: 'Sign-ins', value: person.sign_ins, sub: person.last_sign_in ? `last ${timeAgo(person.last_sign_in)}` : 'none recorded' },
  ]

  return (
    <Container className="py-10">
      <Link href="/admin?tab=people" className="inline-flex items-center gap-1.5 text-sm text-ink-3 hover:text-ink">
        <ArrowLeft className="size-4" /> All people
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-full bg-accent-soft text-xl font-semibold text-accent">
            {person.display_name.charAt(0).toUpperCase()}
          </span>
          <div>
            <h1 className="flex font-display text-3xl font-semibold tracking-tight">
              <OwnerName name={person.display_name} admin={person.role === 'admin'} />
            </h1>
            <p className="text-sm text-ink-2">{person.email}</p>
            <p className="text-xs text-ink-3">
              Joined {formatDate(person.joined)} · signs in with <span className="capitalize">{person.provider}</span>
              {person.banned_at && <span className="text-danger"> · blocked {timeAgo(person.banned_at)}</span>}
            </p>
          </div>
        </div>
        <UserModButtons id={person.id} banned={!!person.banned_at} role={person.role} self={person.id === me.user.id} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <p className="text-xs text-ink-3">{t.label}</p>
            <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value}</p>
            <p className="mt-1 text-xs text-ink-3">{t.sub}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 grid gap-8 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-8">
          <Section title={`Uploads (${fileRows.length})`}>
            {fileRows.length === 0 ? (
              <p className="text-sm text-ink-3">Nothing uploaded.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                {fileRows.map((f) => (
                  <li key={f.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${f.deleted_at ? 'bg-danger-soft/40' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <Link href={`/view/u/${f.id}`} className="block truncate text-sm font-medium hover:text-accent">{f.name}</Link>
                      <p className="text-xs text-ink-3">
                        {f.collections ? where(f.collections.subject_code, f.collections.unit) : '—'} ·{' '}
                        {f.page_count ? `${f.page_count} pages · ` : ''}
                        {f.size_bytes != null ? `${formatBytes(f.size_bytes)} · ` : 'Drive link · '}{timeAgo(f.created_at)}
                        {f.deleted_at && ' · hidden'}
                      </p>
                    </div>
                    {f.collections && (
                      <>
                        <Link href={sectionHref(f.collections.subject_code, f.collections.unit)} className="text-xs text-ink-3 hover:text-ink">
                          Chapter
                        </Link>
                        <FileModButtons id={f.id} hidden={!!f.deleted_at} subject={f.collections.subject_code} unit={f.collections.unit} />
                      </>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Comments (${commentRows.length})`}>
            {commentRows.length === 0 ? (
              <p className="text-sm text-ink-3">No comments.</p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
                {commentRows.map((c) => (
                  <li key={c.id} className={`flex items-start gap-3 px-4 py-3 ${c.deleted_at ? 'bg-danger-soft/40' : ''}`}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm break-words whitespace-pre-line">{c.body}</p>
                      <p className="mt-1 text-xs text-ink-3">
                        on <Link href={`/view/u/${c.file_id}`} className="hover:text-ink">{c.files?.name ?? 'a file'}</Link> · {timeAgo(c.created_at)}
                      </p>
                    </div>
                    <CommentModButtons id={c.id} deleted={!!c.deleted_at} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        <Section title="Sign-in history">
          {loginRows.length === 0 ? (
            <p className="text-sm text-ink-3">No sign-ins recorded yet.</p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface text-sm shadow-card">
              {loginRows.map((l, i) => (
                <li key={i} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <span className="capitalize">
                    {l.method} · {l.device}
                  </span>
                  <span className="text-xs text-ink-3" title={new Date(l.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}>
                    {new Date(l.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Container>
  )
}
