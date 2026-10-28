import type { Metadata } from 'next'
import Link from '@/components/link'
import { notFound, redirect } from 'next/navigation'
import { CommentModButtons, FileModButtons, ReportActions, SuggestionStatusButtons, UserModButtons } from '@/components/admin-actions'
import { AdminHideToggle } from '@/components/admin-hide-toggle'
import { AnnouncementManager, type AnnouncementRow } from '@/components/announcement-manager'
import { BackupPanel } from '@/components/backup-panel'
import { DailyChart } from '@/components/daily-chart'
import { SuggestionThread, type ThreadReply } from '@/components/suggestion-thread'
import { Container, OwnerName } from '@/components/ui'
import { ShelfBranchPicker } from '@/components/shelf-branch-picker'
import { branches, findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
import { formatBytes, formatDate, plural, timeAgo } from '@/lib/format'
import { backupStatus } from '@/lib/backup-job'
import { driveBackupConfigured } from '@/lib/drive-backup'
import { adminConfigured } from '@/lib/supabase/admin'
import { currentIsOwner, currentProfile, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Admin' }
export const dynamic = 'force-dynamic'

const allTabs = [
  { id: 'overview', label: 'Dashboard', adminOnly: true },
  { id: 'reports', label: 'Reports', adminOnly: false },
  { id: 'suggestions', label: 'Suggestions', adminOnly: false },
  { id: 'files', label: 'Files', adminOnly: false },
  { id: 'comments', label: 'Comments', adminOnly: false },
  { id: 'people', label: 'People', adminOnly: false },
  { id: 'shelves', label: 'Shelves', adminOnly: false },
  { id: 'announcements', label: 'Announcements', adminOnly: false },
  { id: 'backup', label: 'Backup', adminOnly: true, ownerOnly: true },
] as const
type Tab = (typeof allTabs)[number]['id']

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

const branchOptions = branches.map((b) => ({ id: b.id, short: b.short }))

/** Each member's branch, read apart from the people lists (the column arrives with a migration). */
async function branchMap(supabase: Awaited<ReturnType<typeof supabaseServer>>) {
  const { data } = await supabase.from('profiles').select('id, branch')
  return new Map(((data ?? []) as { id: string; branch: string | null }[]).map((r) => [r.id, r.branch]))
}
const n = (x: number) => x.toLocaleString('en-IN')

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
  const role = me.profile?.role
  if (role !== 'admin' && role !== 'moderator') notFound()
  const isAdmin = role === 'admin'
  const isOwner = isAdmin && (await currentIsOwner())
  const tabs = allTabs.filter((t) => (isAdmin || !t.adminOnly) && (isOwner || !('ownerOnly' in t && t.ownerOnly)))
  const sp = await searchParams
  const tab: Tab = tabs.some((t) => t.id === sp.tab) ? (sp.tab as Tab) : isAdmin ? 'overview' : 'files'
  const supabase = await supabaseServer()

  let body: React.ReactNode = null
  const REASON_LABEL: Record<string, string> = {
    broken: 'Broken or not opening',
    wrong_place: 'Wrong subject or chapter',
    low_quality: 'Unreadable or low quality',
    duplicate: 'Duplicate',
    inappropriate: 'Inappropriate',
    copyright: 'Copyrighted material',
    spam: 'Spam',
    other: 'Other',
  }
  const { count: openReports } = await supabase.from('reports').select('id', { count: 'exact', head: true }).is('resolved_at', null)
  const { count: newSuggestions } = await supabase.from('suggestions').select('id', { count: 'exact', head: true }).eq('status', 'new')

  if (tab === 'overview') {
    const [overview, daily, logins, people, visitsRes] = await Promise.all([
      supabase.rpc('admin_overview'),
      supabase.rpc('admin_daily', { p_days: 30 }),
      supabase.rpc('admin_recent_logins', { p_limit: 25 }),
      supabase.rpc('admin_people'),
      supabase.rpc('admin_visits', { p_days: 30 }),
    ])
    // Null until the visits SQL has been run; the dashboard works without it.
    const visits = visitsRes.error
      ? null
      : (visitsRes.data as { today: number; week: number; month: number; all_time: number; views_all: number; daily: { day: string; visitors: number; views: number }[] })
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

          {visits && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {[
                  { label: 'Visitors today', value: visits.today, sub: 'unique browsers' },
                  { label: 'Last 7 days', value: visits.week, sub: 'unique visitors' },
                  { label: 'Last 30 days', value: visits.month, sub: 'unique visitors' },
                  { label: 'All time', value: visits.all_time, sub: `${n(Number(visits.views_all))} visits` },
                ].map((t) => (
                  <div key={t.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
                    <p className="text-xs text-ink-3">{t.label}</p>
                    <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{n(Number(t.value))}</p>
                    <p className="mt-1 text-xs text-ink-3">{t.sub}</p>
                  </div>
                ))}
              </div>
              <DailyChart title="Visitors per day" unit="visitors" points={visits.daily.map((d) => ({ day: String(d.day).slice(0, 10), value: Number(d.visitors) }))} />
              <p className="text-xs text-ink-3">Counted once per browser session, by a random id. Visitors who block storage or send Do Not Track are not counted.</p>
            </div>
          )}

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

  if (tab === 'reports') {
    const { data, error } = await supabase
      .from('reports')
      .select(
        'id, reason, details, created_at, file_id, comment_id, reporter:profiles!reports_reporter_id_fkey(display_name), files(name, deleted_at, collections(subject_code, unit)), comments(body, deleted_at, file_id)',
      )
      .is('resolved_at', null)
      .order('created_at', { ascending: false })
      .limit(300)
    type R = {
      id: string
      reason: string
      details: string | null
      created_at: string
      file_id: string | null
      comment_id: string | null
      reporter: { display_name: string } | null
      files: { name: string; deleted_at: string | null; collections: { subject_code: string; unit: number } | null } | null
      comments: { body: string; deleted_at: string | null; file_id: string } | null
    }
    // One row per reported note or comment, with every reason given for it.
    const groups = new Map<string, { target: R; items: R[] }>()
    for (const r of (data ?? []) as unknown as R[]) {
      const key = r.file_id ?? r.comment_id ?? r.id
      const g = groups.get(key) ?? { target: r, items: [] }
      g.items.push(r)
      groups.set(key, g)
    }
    body = error ? (
      <p className="text-danger">{error.message}. Has the community-features SQL been run?</p>
    ) : groups.size === 0 ? (
      <p className="text-ink-3">No open reports. Nice and quiet.</p>
    ) : (
      <Table head={['Reported', 'Why', 'By', 'When', '']}>
        {[...groups.values()].map(({ target: t, items }) => {
          const col = t.files?.collections
          return (
            <tr key={t.id} className={rowCls(false)}>
              <td className={`${td} max-w-xs`}>
                {t.file_id ? (
                  <>
                    <Link href={`/view/u/${t.file_id}`} className="font-medium hover:text-accent">{t.files?.name ?? 'Note'}</Link>
                    <p className="text-xs text-ink-3">
                      {col ? where(col.subject_code, col.unit) : ''}
                      {t.files?.deleted_at && ' · already hidden'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="line-clamp-2 break-words whitespace-pre-line">{t.comments?.body ?? 'Comment'}</p>
                    {t.comments && (
                      <Link href={`/view/u/${t.comments.file_id}`} className="text-xs text-ink-3 hover:text-accent">Open the note</Link>
                    )}
                  </>
                )}
              </td>
              <td className={td}>
                <ul className="space-y-1 text-xs">
                  {items.map((i) => (
                    <li key={i.id}>
                      <span className="font-medium">{REASON_LABEL[i.reason] ?? i.reason}</span>
                      {i.details && <span className="text-ink-3"> — {i.details}</span>}
                    </li>
                  ))}
                </ul>
              </td>
              <td className={`${td} text-xs text-ink-3`}>{[...new Set(items.map((i) => i.reporter?.display_name ?? 'Someone'))].join(', ')}</td>
              <td className={`${td} whitespace-nowrap text-ink-3`}>{timeAgo(items[0]!.created_at)}</td>
              <td className={td}>
                <ReportActions
                  fileId={t.file_id ?? undefined}
                  commentId={t.comment_id ?? undefined}
                  subject={col?.subject_code}
                  unit={col?.unit}
                />
              </td>
            </tr>
          )
        })}
      </Table>
    )
  }

  if (tab === 'suggestions') {
    const { data, error } = await supabase
      .from('suggestions')
      .select('id, category, body, status, created_at, author:profiles!suggestions_author_id_fkey(display_name, role)')
      .order('created_at', { ascending: false })
      .limit(200)
    const rows = (data ?? []) as unknown as {
      id: string
      category: string
      body: string
      status: string
      created_at: string
      author: { display_name: string; role: string } | null
    }[]
    const label: Record<string, string> = { feature: 'Feature', bug: 'Broken', content: 'Missing notes', other: 'Other' }
    // The private chats, read in one go (the table arrives with a migration).
    const { data: chat } = await supabase.from('suggestion_replies').select('id, suggestion_id, from_staff, body, created_at').order('created_at')
    const threads = new Map<string, ThreadReply[]>()
    for (const r of (chat ?? []) as (ThreadReply & { suggestion_id: string })[]) threads.set(r.suggestion_id, [...(threads.get(r.suggestion_id) ?? []), r])
    body = error ? (
      <p className="text-danger">{error.message}. Has the question-bank / suggestions SQL been run?</p>
    ) : rows.length === 0 ? (
      <p className="text-ink-3">No suggestions yet. The link is in the site footer.</p>
    ) : (
      <Table head={['Suggestion', 'Type', 'From', 'When', 'Status', '']}>
        {rows.map((r) => (
          <tr key={r.id} className={rowCls(false)}>
            <td className={`${td} max-w-lg`}>
              <p className="break-words whitespace-pre-line">{r.body}</p>
              <SuggestionThread suggestionId={r.id} userId={me.user.id} viewerIsStaff replies={threads.get(r.id) ?? []} />
            </td>
            <td className={`${td} whitespace-nowrap text-ink-2`}>{label[r.category] ?? r.category}</td>
            <td className={td}>
              <OwnerName name={r.author?.display_name ?? 'Unknown'} admin={r.author?.role === 'admin'} moderator={r.author?.role === 'moderator'} />
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{timeAgo(r.created_at)}</td>
            <td className={`${td} capitalize ${r.status === 'new' ? 'font-semibold text-accent' : 'text-ink-3'}`}>{r.status}</td>
            <td className={td}>
              <SuggestionStatusButtons id={r.id} status={r.status} />
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  if (tab === 'files') {
    const { data, error: filesError } = await supabase
      .from('files')
      .select('id, name, mime, size_bytes, created_at, deleted_at, profiles!owner_id(display_name, role), collections(subject_code, unit)')
      .order('created_at', { ascending: false })
      .limit(200)
    const rows = (data ?? []) as unknown as {
      id: string
      name: string
      mime: string
      size_bytes: number | null
      created_at: string
      deleted_at: string | null
      profiles: { display_name: string; role: string } | null
      collections: { subject_code: string; unit: number } | null
    }[]
    body = filesError ? (
      <p className="rounded-xl bg-danger-soft px-4 py-3 text-danger">Could not load files: {filesError.message}</p>
    ) : (
      <Table head={['File', 'By', 'Where', 'Added', '']}>
        {rows.map((f) => (
          <tr key={f.id} className={rowCls(!!f.deleted_at)}>
            <td className={td}>
              <Link href={`/view/u/${f.id}`} className="font-medium hover:text-accent">{f.name}</Link>
              <p className="text-xs text-ink-3">
                {f.mime.startsWith('application/vnd.google-apps.') ? 'Drive link' : f.mime === 'application/pdf' ? 'PDF' : 'Image'}
                {f.size_bytes != null && ` · ${formatBytes(f.size_bytes)}`}
                {f.deleted_at && ' · hidden'}
              </p>
            </td>
            <td className={td}>
              <OwnerName name={f.profiles?.display_name ?? 'Unknown'} admin={f.profiles?.role === 'admin'} moderator={f.profiles?.role === 'moderator'} />
            </td>
            <td className={`${td} whitespace-nowrap`}>{f.collections ? where(f.collections.subject_code, f.collections.unit) : '—'}</td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{timeAgo(f.created_at)}</td>
            <td className={td}>
              {f.collections && (
                <FileModButtons id={f.id} name={f.name} hidden={!!f.deleted_at} subject={f.collections.subject_code} unit={f.collections.unit} canPurge={isOwner} />
              )}
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  if (tab === 'comments') {
    const { data } = await supabase
      .from('comments')
      .select('id, body, created_at, deleted_at, file_id, profiles!author_id(display_name, role), files(name)')
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
              <OwnerName name={c.profiles?.display_name ?? 'Unknown'} admin={c.profiles?.role === 'admin'} moderator={c.profiles?.role === 'moderator'} />
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

  if (tab === 'people' && isAdmin) {
    const { data, error } = await supabase.rpc('admin_people')
    const rows = (data ?? []) as PersonRow[]
    const branchOf = await branchMap(supabase)
    body = error ? (
      <p className="text-danger">{error.message}</p>
    ) : (
      <Table head={['Person', 'Email', 'Branch', 'Contribution', 'Last sign-in', 'Joined', '']}>
        {rows.map((u) => (
          <tr key={u.id} className={rowCls(!!u.banned_at)}>
            <td className={td}>
              <Link href={`/admin/people/${u.id}`} className="hover:text-accent">
                <OwnerName name={u.display_name} admin={u.role === 'admin'} moderator={u.role === 'moderator'} className="font-medium" />
              </Link>
              {u.banned_at && <p className="text-xs text-danger">Blocked {timeAgo(u.banned_at)}</p>}
            </td>
            <td className={`${td} text-ink-2`}>
              {u.email}
              <p className="text-xs text-ink-3 capitalize">{u.provider}</p>
            </td>
            <td className={td}>
              <ShelfBranchPicker userId={u.id} branch={branchOf.get(u.id) ?? null} options={branchOptions} />
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>
              {plural(Number(u.files), 'file')} · {plural(Number(u.comments), 'comment')}
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>
              {u.last_sign_in ? timeAgo(u.last_sign_in) : '\u2014'}
              <p className="text-xs">{plural(Number(u.sign_ins), 'sign-in')}</p>
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{formatDate(u.joined)}</td>
            <td className={td}>
              <UserModButtons id={u.id} banned={!!u.banned_at} role={u.role} self={u.id === me.user.id} viewerIsOwner={isOwner} />
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  if (tab === 'people' && !isAdmin) {
    // Moderators see names and activity only: no emails and no sign-in history.
    const { data, error } = await supabase.rpc('staff_people')
    const rows = (data ?? []) as { id: string; display_name: string; role: string; banned_at: string | null; joined: string; files: number; comments: number }[]
    const branchOf = await branchMap(supabase)
    body = error ? (
      <p className="text-danger">{error.message}</p>
    ) : (
      <Table head={['Person', 'Branch', 'Contribution', 'Joined', '']}>
        {rows.map((u) => (
          <tr key={u.id} className={rowCls(!!u.banned_at)}>
            <td className={td}>
              <OwnerName name={u.display_name} admin={u.role === 'admin'} moderator={u.role === 'moderator'} className="font-medium" />
              {u.banned_at && <p className="text-xs text-danger">Blocked {timeAgo(u.banned_at)}</p>}
            </td>
            <td className={td}>
              <ShelfBranchPicker userId={u.id} branch={branchOf.get(u.id) ?? null} options={branchOptions} />
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>
              {plural(Number(u.files), 'file')} · {plural(Number(u.comments), 'comment')}
            </td>
            <td className={`${td} whitespace-nowrap text-ink-3`}>{formatDate(u.joined)}</td>
            <td className={td}>
              <UserModButtons id={u.id} banned={!!u.banned_at} role={u.role} self={u.id === me.user.id} viewerIsAdmin={false} />
            </td>
          </tr>
        ))}
      </Table>
    )
  }

  if (tab === 'backup' && isOwner) {
    // Do the new columns exist yet? Selecting one is the cheapest way to find out.
    const probe = await supabase.from('files').select('backup_drive_id').limit(1)
    body = (
      <BackupPanel
        service={adminConfigured()}
        drive={driveBackupConfigured()}
        cron={!!process.env.CRON_SECRET}
        columns={!probe.error}
        status={await backupStatus()}
      />
    )
  }

  if (tab === 'announcements') {
    const { data, error } = await supabase
      .from('announcements')
      .select('id, message, link, active, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
    body = error ? (
      <p className="text-danger">{error.message}. Has the requests / announcements SQL been run?</p>
    ) : (
      <AnnouncementManager userId={me.user.id} items={(data ?? []) as AnnouncementRow[]} />
    )
  }

  if (tab === 'shelves') {
    const { data } = await supabase
      .from('collections')
      .select('id, subject_code, unit, hidden, updated_at, profiles!owner_id(display_name, role), files(id, deleted_at)')
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
              <OwnerName name={r.profiles?.display_name ?? 'Unknown'} admin={r.profiles?.role === 'admin'} moderator={r.profiles?.role === 'moderator'} />
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
      <h1 className="font-display text-4xl font-semibold tracking-tight">{isAdmin ? 'Admin' : 'Moderation'}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        {isAdmin ? (
          <>
            Hide anything that shouldn&rsquo;t be here, block people who misuse the site, and clean up junk. Hidden files and
            comments can be restored; &ldquo;Delete forever&rdquo; cannot be undone.
          </>
        ) : (
          <>
            Hide notes and comments that don&rsquo;t belong, and block members who misuse the site. Everything you hide can be
            restored. Only the admin can delete things permanently or change roles.
          </>
        )}
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
            {t.id === 'suggestions' && !!newSuggestions && (
              <span className={`ml-1.5 rounded-full px-1.5 text-xs font-semibold ${tab === t.id ? 'bg-bg text-ink' : 'bg-accent text-accent-ink'}`}>{newSuggestions}</span>
            )}
            {t.id === 'reports' && !!openReports && (
              <span className={`ml-1.5 rounded-full px-1.5 text-xs font-semibold ${tab === t.id ? 'bg-bg text-ink' : 'bg-danger text-white'}`}>{openReports}</span>
            )}
          </Link>
        ))}
      </nav>
      {body}
    </Container>
  )
}
