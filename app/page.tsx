import Link from 'next/link'
import { ArrowRight, BookMarked, CloudUpload, Eye, ShieldCheck } from 'lucide-react'
import { Thumb } from '@/components/thumb'
import { Container, OwnerName, SectionHeading } from '@/components/ui'
import { allSubjects, findSubject, regularSemesters, sectionHref, sectionLabel, semesterLabel } from '@/lib/curriculum'
import { contributors, countsBySubject, recentlyUpdated, uploadTotals } from '@/lib/data'
import { DRIVE_LIBRARY } from '@/lib/drive-stats'
import { publicFileUrl } from '@/lib/env'
import { plural, timeAgo } from '@/lib/format'

export const revalidate = 60

const features = [
  { icon: Eye, title: 'Open to everyone', body: 'Read, preview and download every file. No account needed.' },
  { icon: CloudUpload, title: 'Upload in seconds', body: 'Snap the board or your notebook and add photos or PDFs to the right chapter.' },
  { icon: BookMarked, title: 'One shelf per person', body: 'Your notes for a chapter stay together under your name. Add more any time.' },
  { icon: ShieldCheck, title: 'Kept permanently', body: 'Files live in cloud storage, separate from the website, so updates never wipe them.' },
]

export default async function Home() {
  const [counts, recent, people, uploads] = await Promise.all([countsBySubject(), recentlyUpdated(6), contributors(), uploadTotals()])
  const totalMaterials = uploads.files + DRIVE_LIBRARY.files
  const totalPages = uploads.pages + DRIVE_LIBRARY.pages
  const n = (x: number) => x.toLocaleString('en-IN')
  const chapters = allSubjects().reduce((n, { subject }) => n + subject.units.length, 0)
  const total = (code: string) => counts[code] ?? 0

  const stats = [
    { label: 'Contributors', value: people.length },
    { label: 'Subjects', value: allSubjects().length },
    { label: 'Chapters', value: chapters },
  ]

  return (
    <>
      <section className="grain border-b border-line">
        <Container className="pt-16 pb-14 sm:pt-24 sm:pb-20">
          <p className="rise inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2">
            <span className="size-1.5 rounded-full bg-gold" /> B.Tech EVL · R25 · VNR VJIET
          </p>
          <h1 className="rise mt-6 max-w-3xl font-display text-4xl leading-[1.05] font-semibold tracking-tight text-balance sm:text-6xl">
            Every lecture, written down once, <span className="text-accent italic">for the whole class.</span>
          </h1>
          <p className="rise mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">
            Photos and PDFs of class notes, organised by semester, subject and chapter. Read or download anything
            without signing in. Sign in only to share your own.
          </p>
          <div className="rise mt-8 flex flex-wrap gap-3">
            <Link href="#semesters" className="inline-flex h-12 items-center gap-2 rounded-xl bg-ink px-5 font-medium text-bg shadow-card hover:opacity-90">
              Browse notes <ArrowRight className="size-4" />
            </Link>
            <Link href="/upload" className="inline-flex h-12 items-center gap-2 rounded-xl border border-line bg-surface px-5 font-medium hover:border-line-strong">
              <CloudUpload className="size-4" /> Upload today&rsquo;s notes
            </Link>
          </div>
          <dl className="rise mt-12 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
            <div className="col-span-3 grid grid-cols-2 gap-4 bg-accent-soft px-5 py-4 sm:col-span-1 sm:grid-cols-1 sm:gap-2">
              <div>
                <dt className="text-xs font-medium text-accent">Total materials</dt>
                <dd className="mt-1 font-display text-4xl font-semibold text-ink tabular-nums">{n(totalMaterials)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-accent">Total pages</dt>
                <dd className="mt-1 font-display text-2xl font-semibold text-ink tabular-nums sm:text-xl">{n(totalPages)}</dd>
              </div>
              <dd className="col-span-2 text-xs text-ink-3 sm:col-span-1">
                {n(uploads.files)} uploaded here + {n(DRIVE_LIBRARY.files)} in the Google Drive library
              </dd>
            </div>
            {stats.map((s) => (
              <div key={s.label} className="bg-surface px-5 py-4">
                <dt className="text-xs text-ink-3">{s.label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <Container className="mt-16">
        <section id="semesters" className="scroll-mt-24">
          <SectionHeading title="Semesters" hint="Pick a semester to see its subjects and chapters." />
          <div className="grid gap-4 sm:grid-cols-2">
            {regularSemesters.map((s) => {
              const files = s.subjects.reduce((n, sub) => n + total(sub.code), 0)
              return (
                <Link
                  key={s.sem}
                  href={`/sem/${s.sem}`}
                  className="group rounded-2xl border border-line bg-surface p-6 shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
                >
                  <div className="flex items-baseline justify-between">
                    <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Semester {s.sem}</p>
                    <p className="text-xs text-ink-3">{plural(files, 'file')}</p>
                  </div>
                  <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight">{semesterLabel(s)}</h3>
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {s.subjects.map((sub) => (
                      <span key={sub.code} className="rounded-lg bg-surface-2 px-2 py-1 text-xs font-medium text-ink-2">
                        {sub.short}
                      </span>
                    ))}
                  </div>
                  <p className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-accent">
                    Open {plural(s.subjects.length, 'subject')} <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
                  </p>
                </Link>
              )
            })}
          </div>
        </section>

        {recent.length > 0 && (
          <section className="mt-16">
            <SectionHeading
              title="Recently updated"
              hint="Fresh notes from classmates."
              action={<Link href="/contributors" className="text-sm font-medium text-accent">All contributors</Link>}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((c) => {
                const found = findSubject(c.subject_code)
                const cover = c.cover?.thumb_path
                  ? publicFileUrl(c.cover.thumb_path)
                  : c.cover && c.cover.mime !== 'application/pdf'
                    ? publicFileUrl(c.cover.storage_path)
                    : null
                return (
                  <Link
                    key={c.id}
                    href={`${sectionHref(c.subject_code, c.unit)}#c-${c.id}`}
                    className="group flex overflow-hidden rounded-2xl border border-line bg-surface shadow-card hover:border-line-strong"
                  >
                    <div className="w-28 shrink-0 border-r border-line">
                      <Thumb src={cover} icon={c.cover?.mime === 'application/pdf' ? 'pdf' : 'image'} label="notes" />
                    </div>
                    <div className="min-w-0 p-4">
                      <p className="truncate text-sm font-semibold">
                        {found?.subject.short ?? c.subject_code} · {sectionLabel(c.unit)}
                      </p>
                      <p className="mt-1 flex text-sm text-ink-2">by&nbsp;<OwnerName name={c.owner_name} admin={c.owner_is_admin} /></p>
                      <p className="mt-2 text-xs text-ink-3">
                        {plural(c.file_count, 'file')} · {timeAgo(c.updated_at)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        <section className="mt-16 grid gap-4 md:grid-cols-4">
          {features.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-5">
              <Icon className="size-5 text-accent" strokeWidth={1.8} />
              <p className="mt-3 font-semibold">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-ink-3">{body}</p>
            </div>
          ))}
        </section>
      </Container>
    </>
  )
}
