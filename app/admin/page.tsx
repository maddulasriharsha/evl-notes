import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { CommentModButtons, FileModButtons, UserModButtons } from '@/components/admin-actions'
import { AdminHideToggle } from '@/components/admin-hide-toggle'
import { DailyChart } from '@/components/daily-chart'
import { Container, OwnerName } from '@/components/ui'
import { findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
import { formatBytes, formatDate, plural, timeAgo } from '@/lib/format'
import { currentProfile, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

const tabs = [
  { id: 'overview', label: 'Dashboard' },
  { id: 'files', label: 'Files' },
  { id: 'comments', label: 'Comments' },
  { id: 'people', label: 'People' },
  { id: 'shelves', label: 'Shelves' },
] as const
type Tab = (typeof tabs)[number]['id']

const where = (subject: string, unit: number) => `${findSubject(subject)?.subject.short ?? subject} · ${sectionLabel(unit)}`

function Table({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full text-sm">
        <thead className="border-b border-line text-left text-xs tracking-wide text-ink-3 uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 font-medium whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

const td = 'px-4 py-3 align-middle'

interface PersonRow {
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

const rowCls = (off: boolean) => `border-b border-line last:border-0 ${off ? 'bg-danger-soft/40' : ''}`

export default async function AdminPage({ searchParams }: PageProps<'/admin'>) {
  const me = await currentProfile()
  if (!me) redirect('/login?next=/admin')
  if (me.profile?.role !== 'admin') notFound()
  const sp = await searchParams
  const tab: Tab = tabs.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : 'overview'
  const supabase = await supabaseServer()

  let body: React.ReactNode = null

  if (tab === 'overview') {
    const [overview, daily, logins, people] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.rpc('admin_daily', { p_days: 30 }),
      supabase.rpc('admin_recent_logins', { p_limit: 25 }),
      supabase.rpc('admin_people'),
    ])
    if (overview.error) {
      body = <p className="text-danger">{overview.error.message}. Has the dashboard SQL migration been run?</p>
    } else {
      const o = overview.data as Record<string, number>
      const days = (daily.data ?? []) as { day: string; uploads: number; signins: number; comments: number }[]
      const recent = (logins.data ?? []) as {
        user_id: string
        display_name: string | null
        email: string
        method: string
        device: string
        at: string
      }[]
      const top = ((people.data ?? []) as PersonRow[]).filter((p) => Number(p.files) > 0).slice(0, 10)
      const used = Number(o.storage_bytes)
      const limit = 1024 ** 3
      const share = used / limit
      const tiles = [
        { label: 'Members', value: o.members, sub: `+${o.members_7d} this week` },
        { label: 'Active this week', value: o.active_7d, sub: plural(Number(o.signins_7d), 'sign-in') },
        { label: 'Files', value: o.files, sub: `+${o.files_7d} this week · ${o.pages} pages` },
        { label: 'Contributors', value: o.contributors, sub: `${o.chapters_covered} chapters covered` },
        { label: 'Comments', value: o.comments, sub: `+${o.comments_7d} this week` },
        { label: 'Blocked', value: o.blocked, sub: `${o.hidden_files} hidden files` },
      ]
      body = (
        <div className="space-y-8">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {tiles.map((t) => (
              <div key={t.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                <p className="text-xs text-ink-3">{t.label}</p>
                <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value}</p>
                <p className="mt-1 text-xs text-ink-3">{t.sub}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-line bg-surface p-4 shadow-card">
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-semibold">Storage used</span>
              <span className="tabular-nums text-ink-2">
                {formatBytes(used)} of 1 GB (free plan) · {Math.round(share * 100)}%
              </span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className={`h-full rounded-full ${share > 0.85 ? 'bg-danger' : 'bg-chart'}`} style={{ width: `${Math.min(100, share * 100)}%` }} />
            </div>
            <p className="mt-2 text-xs text-ink-3">Includes hidden files. Use &ldquo;Delete forever&rdquo; on the Files tab to free space.</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DailyChart title="Files uploaded per day" unit="files" points={days.map((d) => ({ day: d.day, value: Number(d.uploads) }))} />
            <DailyChart title="Sign-ins per day" unit="sign-ins" points={days.map((d) => ({ day: d.day, value: Number(d.signins) }))} />
          </div>

          <div className="grid gap-6 xl:grid-cols-2">
            <section>
              <h2 className="mb-3 font-semibold">Top contributors</h2>
              {top.length === 0 ? (
                <p className="text-sm text-ink-3">No uploads yet.</p>
              ) : (
                <Table head={['Person', 'Files', 'Pages', 'Chapters', 'Last upload']}>
                  {top.map((p) => (
                    <tr key={p.id} className={rowCls(!!p.banned_at)}>
                      <td className={td}>
                        <Link href={`/admin/people/${p.id}`} className="hover:text-accent">
                          <OwnerName name={p.display_name} admin={p.role === 'admin'} className="font-medium" />
                        </Link>
                      </td>
                      <td className={`${td} tabular-nums`}>{p.files}</td>
                      <td className={`${td} tabular-nums`}>{p.pages}</td>
                      <td className={`${td} tabular-nums`}>{p.chapters}</td>
                      <td className={`${td} whitespace-nowrap text-ink-3`}>{p.last_upload ? timeAgo(p.last_upload) : '—'}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>
            <section>
              <h2 className="mb-3 font-semibold">Recent sign-ins</h2>
              {recent.length === 0 ? (
                <p className="text-sm text-ink-3">No sign-ins recorded yet. They appear here from the next sign-in on.</p>
              ) : (
                <Table head={['Person', 'How', 'Device', 'When']}>
                  {recent.map((l, i) => (
                    <tr key={i} className="border-b border-line last:border-0">
                      <td className={td}>
                        <Link href={`/admin/people/${l.user_id}`} className="font-medium hover:text-accent">
                          {l.display_name ?? l.email}
                        </Link>
                        <p className="text-xs text-ink-3">{l.email}</p>
                      </td>
                      <td className={`${td} capitalize`}>{l.method}</td>
                      <td className={`${td} capitalize`}>{l.device}</td>
                      <td className={`${td} whitespace-nowrap text-ink-3`}>{timeAgo(l.at)}</td>
                    </tr>
                  ))}
                </Table>
              )}
            </section>
          </div>
        </div>
      )
    }
  }

  if (tab === 'files') {
    const { data } = await supabase
      .from('files')
      .select('id, name, mime, size_bytes, created_at, deleted_at, profiles(display_name, role), collections(subject_code, unit)')
      .order('created_at', { ascending: false })
      .limit(200)
    const rows = (data ?? []) as unknown as {
      id: string
      name: string
      mime: string
      size_bytes: number
      created_at: string
      deleted_at: string | null
      profiles: { display_name: string; role: string } | null
      collections: { subject_code: string; unit: number } | null
    }[]
    body = (
      <Table head={['File', 'By', 'Where', 'Added', '']}>
        {rows.map((f) => (
          <tr key={f.id} className={rowCls(!!f.deleted_at)}>
            <td className={td}>
              <Link href={`/view/u/${f.id}`} className="font-medium hover:text-accent">{f.name}</Link>
              <p className="text-xs text-ink-3">
                {f.mime === 'application/pdf' ? 'PDF' : 'Image'} · {formatBytes(f.size_bytes)}
                {f.deleted_at && ' · hidden'}
              </p>
            </td>
            <td className={td}>
              <OwnerName name={f.profiles?.display_name ?? 'Unknown'} admin={f.profiles?.role === 'admin'} />
            </td>
            <td className={`${td} whitespace-nowrap`}>{f.collections ? where(f.collections.subject_code, f.collections.unit) : '—'}</td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{timeAgo(f.created_at)}</td>
            <td className={td}>
              {f.collections && <FileModButtons id={f.id} hidden={!!f.deleted_at} subject={f.collections.subject_code} unit={f.collections.unit} />}
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  if (tab === 'comments') {
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, deleted_at, file_id, profiles(display_name, role), files(name)')
      .order('created_at', { ascending: false })
      .limit(200)
    const rows = (data ?? []) as unknown as {
      id: string
      body: string
      created_at: string
      deleted_at: string | null
      file_id: string
      profiles: { display_name: string; role: string } | null
      files: { name: string } | null
    }[]
    body = rows.length ? (
      <Table head={['Comment', 'By', 'On', 'When', '']}>
        {rows.map((c) => (
          <tr key={c.id} className={rowCls(!!c.deleted_at)}>
            <td className={`${td} max-w-md`}>
              <p className="line-clamp-3 break-words whitespace-pre-line">{c.body}</p>
            </td>
            <td className={td}>
              <OwnerName name={c.profiles?.display_name ?? 'Unknown'} admin={c.profiles?.role === 'admin'} />
            </td>
            <td className={td}>
              <Link href={`/view/u/${c.file_id}`} className="hover:text-accent">{c.files?.name ?? 'File'}</Link>
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{timeAgo(c.created_at)}</td>
            <td className={`${td} text-right`}>
              <CommentModButtons id={c.id} deleted={!!c.deleted_at} />
            </td>
          </tr>
        ))}
      </Table>
    ) : (
      <p className="text-ink-3">No comments yet.</p>
    )
  }

  if (tab === 'people') {
    const { data, error } = await supabase.rpc('admin_people')
    const rows = (data ?? []) as PersonRow[]
    body = error ? (
      <p className="text-danger">{error.message}</p>
    ) : (
      <Table head={['Person', 'Email', 'Contribution', 'Last sign-in', 'Joined', '']}>
        {rows.map((u) => (
          <tr key={u.id} className={rowCls(!!u.banned_at)}>
            <td className={td}>
              <Link href={`/admin/people/${u.id}`} className="hover:text-accent">
                <OwnerName name={u.display_name} admin={u.role === 'admin'} className="font-medium" />
              </Link>
              {u.banned_at && <p className="text-xs text-danger">Blocked {timeAgo(u.banned_at)}</p>}
            </td>
            <td className={`${td} text-ink-2`}>
              {u.email}
              <p className="text-xs text-ink-3 capitalize">{u.provider}</p>
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>
              {plural(Number(u.files), 'file')} · {plural(Number(u.comments), 'comment')}
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>
              {u.last_sign_in ? timeAgo(u.last_sign_in) : '—'}
              <p className="text-xs">{plural(Number(u.sign_ins), 'sign-in')}</p>
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{formatDate(u.joined)}</td>
            <td className={td}>
              <UserModButtons id={u.id} banned={!!u.banned_at} role={u.role} self={u.id === me.user.id} />
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  if (tab === 'shelves') {
    const { data } = await supabase
      .from('collections')
      .select('id, subject_code, unit, hidden, updated_at, profiles(display_name, role), files(id, deleted_at)')
      .order('updated_at', { ascending: false })
      .limit(200)
    const rows = (data ?? []) as unknown as {
      id: string
      subject_code: string
      unit: number
      hidden: boolean
      updated_at: string
      profiles: { display_name: string; role: string } | null
      files: { id: string; deleted_at: string | null }[]
    }[]
    body = (
      <Table head={['Shelf', 'By', 'Files', 'Updated', '']}>
        {rows.map((r) => (
          <tr key={r.id} className={rowCls(r.hidden)}>
            <td className={td}>
              <Link href={`${sectionHref(r.subject_code, r.unit)}#c-${r.id}`} className="font-medium hover:text-accent">
                {where(r.subject_code, r.unit)}
              </Link>
            </td>
            <td className={td}>
              <OwnerName name={r.profiles?.display_name ?? 'Unknown'} admin={r.profiles?.role === 'admin'} />
            </td>
            <td className={`${td} tabular-nums`}>{plural(r.files.filter((f) => !f.deleted_at).length, 'file')}</td>
            <td className={`${td} text-ink-3`}>{timeAgo(r.updated_at)}</td>
            <td className={`${td} text-right`}>
              <AdminHideToggle id={r.id} hidden={r.hidden} subject={r.subject_code} unit={r.unit} />
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  return (
    <Container className="py-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Hide anything that shouldn&rsquo;t be here, block people who misuse the site, and clean up junk. Hidden files and
        comments can be restored; &ldquo;Delete forever&rdquo; cannot be undone.
      </p>
      <nav className="mt-6 mb-5 flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 text-sm sm:w-fit">
        {tabs.map((t) => (
          <Link
            key={t.id}
            href={`/admin?tab=${t.id}`}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`rounded-lg px-4 py-1.5 font-medium ${tab === t.id ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {body}
    </Container>
  )
}
