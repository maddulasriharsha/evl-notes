import Link from '@/components/link'
import {
  ArrowRight,
  BookOpen,
  Camera,
  Check,
  CloudUpload,
  FlaskConical,
  FolderTree,
  Star,
  Users,
} from 'lucide-react'
import { CountUp } from '@/components/count-up'
import { HeroStars } from '@/components/hero-stars'
import { MarkMyBranch } from '@/components/page-chrome'
import { SearchBox } from '@/components/search-box'
import { ContinueStudying } from '@/components/study-history'
import { Thumb } from '@/components/thumb'
import { OwnerName } from '@/components/ui'
import { allSubjects, branches, branchHref, branchSubjects, findSubject, sectionHref, sectionLabel, subjectHref } from '@/lib/curriculum'
import { contributors, countsBySubject, recentlyUpdated, uploadTotals } from '@/lib/data'
import { DRIVE_LIBRARY } from '@/lib/drive-stats'
import { thumbFor } from '@/lib/file-thumb'
import { plural, timeAgo } from '@/lib/format'
import { liveLibrary } from '@/lib/library-live'

// Rebuilt at once when notes change (see refreshChapter); this is only the fallback for votes, comments and the like.
export const revalidate = 600

const n = (x: number) => x.toLocaleString('en-IN')

const STEPS = [
  { icon: Camera, title: 'Snap your notes', text: 'Photograph your notebook after class. The photos become one clean PDF.' },
  { icon: FolderTree, title: 'It sorts itself', text: 'Pick the chapter once and it lands in the right branch, semester and subject, under your name.' },
  { icon: Users, title: 'Everyone reads', text: 'Classmates open it without signing in, bookmark it, rate it and comment on it.' },
]

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[11px] font-semibold tracking-[0.25em] text-ink-3 uppercase">{children}</p>
}

export default async function Home() {
  const [counts, recent, people, uploads, lib] = await Promise.all([countsBySubject(), recentlyUpdated(6), contributors(), uploadTotals(), liveLibrary()])
  const totalMaterials = uploads.files + DRIVE_LIBRARY.files
  const totalPages = uploads.pages + DRIVE_LIBRARY.pages
  const chapters = allSubjects().reduce((sum, { subject }) => sum + subject.units.length, 0)
  const total = (code: string) => (counts[code] ?? 0) + lib.count(code)
  // The strip shows the courses with the most notes (every course is reachable from its branch).
  const strip = allSubjects()
    .filter(({ subject }) => subject.kind !== 'extra')
    .sort((x, y) => total(y.subject.code) - total(x.subject.code) || x.subject.name.localeCompare(y.subject.name))
    .slice(0, 16)

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section
        className="relative z-10 -mt-[4.25rem] pt-[4.25rem] sm:-mt-[4.5rem] sm:pt-[4.5rem]"
        style={{ '--horizon-y': '610px', '--horizon-y-sm': '600px' } as React.CSSProperties}
      >
        <div className="hero-sky pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="horizon" />
          <div className="horizon-haze" />
          <HeroStars />
        </div>
        <div className="relative mx-auto flex min-h-[610px] max-w-5xl flex-col items-center px-4 pt-12 pb-10 text-center sm:min-h-[630px] sm:pt-20">
          <Link
            href="/#branches"
            className="rise inline-flex items-center gap-2 rounded-full border border-line bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-2 backdrop-blur hover:text-ink"
          >
            <Star className="size-3.5 fill-gold text-gold" />
            <span className="tnum">
              {n(totalMaterials)} materials · {n(totalPages)} pages
            </span>
            <ArrowRight className="size-3 opacity-60" />
          </Link>
          <h1 className="rise rise-1 mt-8 font-display text-[2.6rem] leading-[1.02] font-bold tracking-tight sm:text-7xl">
            <span className="text-glow">Class notes.</span>{' '}
            <span className="block text-ink-3 sm:inline">For everyone.</span>
          </h1>
          <p className="rise rise-2 mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
            Notes, question papers and question banks for every branch, sorted by semester, subject and chapter.
            Free to read, no sign-in needed.
          </p>
          <div className="rise rise-3 relative z-20 mt-8 w-full max-w-xl">
            <SearchBox compact />
          </div>
          <div className="rise rise-4 mt-5 flex flex-wrap items-center justify-center gap-3">
            <Link href="#branches" className="btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
              <BookOpen className="size-4" /> Pick your branch
            </Link>
            <Link href="/upload" className="btn-ghost inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
              <CloudUpload className="size-4" /> Upload yours
            </Link>
          </div>
          <div className="rise rise-4 mt-6 flex max-w-xl flex-wrap items-center justify-center gap-x-1.5 gap-y-2 text-xs text-ink-3">
            <span className="mr-1">Popular</span>
            {strip.slice(0, 4).map(({ subject }) => (
              <Link
                key={subject.code}
                href={subjectHref(subject.code)}
                className="rounded-full border border-line bg-white/[0.03] px-2.5 py-1 font-medium text-ink-2 backdrop-blur transition hover:border-accent/40 hover:text-ink"
              >
                {subject.short}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <ContinueStudying />

        {/* ---------- Branches ---------- */}
        <section id="branches" className="mt-14 scroll-mt-28">
          <Eyebrow>Browse</Eyebrow>
          <h2 className="mt-3 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Pick your branch. <span className="text-ink-3">Start reading.</span>
          </h2>
          <MarkMyBranch />
          <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {branches.map((b) => {
              const subjects = branchSubjects(b)
              const files = subjects.reduce((sum, { subject }) => sum + total(subject.code), 0)
              return (
                <Link
                  key={b.id}
                  href={branchHref(b.id)}
                  data-branch={b.id}
                  className="branch-card fx-card fx-tilt fx-reveal group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:p-5 hover:border-accent/40 hover:shadow-[0_30px_80px_-30px_rgba(139,92,246,0.45)]"
                >
                  <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/25" />
                  <span className="mine-tag">Your branch</span>
                  <p className="tnum relative text-[11px] text-ink-3">{plural(files, 'file')}</p>
                  <h3 className="relative mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">{b.short}</h3>
                  <p className="relative mt-1 line-clamp-2 text-xs text-ink-2 sm:text-sm">{b.name}</p>
                  <p className="relative mt-auto inline-flex items-center gap-1.5 pt-4 text-xs font-semibold text-accent sm:text-sm">
                    {plural(subjects.length, 'subject')}{' '}
                    <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </p>
                </Link>
              )
            })}
          </div>
        </section>

        {/* ---------- Recently updated ---------- */}
        {recent.length > 0 && (
          <section className="mt-16">
            <Eyebrow>Fresh from class</Eyebrow>
            <h2 className="mt-3 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">Recently updated</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((c) => {
                const found = findSubject(c.subject_code)
                const cover = c.cover ? thumbFor(c.cover) : null
                return (
                  <Link
                    key={c.id}
                    href={`${sectionHref(c.subject_code, c.unit)}#c-${c.id}`}
                    className="fx-card fx-reveal group flex overflow-hidden rounded-2xl border border-line bg-surface transition hover:border-accent/40"
                  >
                    <div className="w-28 shrink-0 border-r border-line">
                      <Thumb src={cover} icon={c.cover?.mime === 'application/pdf' ? 'pdf' : 'image'} label="notes" />
                    </div>
                    <div className="min-w-0 p-4">
                      <p className="truncate text-sm font-semibold">
                        {found?.subject.short ?? c.subject_code} · {sectionLabel(c.unit)}
                      </p>
                      <p className="mt-1 flex text-sm text-ink-2">
                        by&nbsp;<OwnerName name={c.owner_name} admin={c.owner_is_admin} moderator={c.owner_is_mod} />
                      </p>
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

        {/* ---------- Numbers ---------- */}
        <section className="fx-reveal mt-16 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-line bg-white/[0.07] sm:grid-cols-4">
          {[
            { label: 'Total materials', value: totalMaterials, hint: `${n(uploads.files)} uploaded + ${n(DRIVE_LIBRARY.files)} from Drive` },
            { label: 'Total pages', value: totalPages, hint: 'PDF pages, slides and photos' },
            { label: 'Contributors', value: people.length, hint: 'classmates sharing notes' },
            { label: 'Chapters', value: chapters, hint: `across ${allSubjects().length} subjects` },
          ].map((s, i) => (
            <div key={s.label} className={`bg-bg px-5 py-6 ${i === 0 ? 'bg-gradient-to-b from-accent/10 to-transparent' : ''}`}>
              <p className="text-xs text-ink-3">{s.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight sm:text-4xl">
                <CountUp value={s.value} />
              </p>
              <p className="mt-1 text-xs text-ink-3">{s.hint}</p>
            </div>
          ))}
        </section>

      </div>

      {/* ---------- Subject marquee ---------- */}
      <section className="relative mt-16">
        <Eyebrow>Every subject · every chapter</Eyebrow>
        <div className="marquee-wrap marquee-mask mt-6 overflow-hidden">
          <div className="marquee gap-3 pr-3">
            {[...strip, ...strip].map(({ subject, semester, branch }, i) => (
              <Link
                key={`${subject.code}-${i}`}
                href={subjectHref(subject.code)}
                aria-hidden={i >= strip.length}
                tabIndex={i >= strip.length ? -1 : undefined}
                className="w-64 shrink-0 rounded-2xl border border-line bg-surface p-4 transition hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-ink-2">
                    {subject.kind === 'lab' ? <FlaskConical className="size-4" /> : <BookOpen className="size-4" />}
                  </span>
                  <span className="text-[11px] text-ink-3">
                    {branch ? `${branch.short} · ` : ''}Sem {semester.sem}
                  </span>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-widest text-accent uppercase">{subject.short}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink">{subject.name}</p>
                <p className="mt-2 text-xs text-ink-3">{plural(total(subject.code), 'file')}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ---------- How it works ---------- */}
        <section className="mt-24">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-3 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Built for the whole class. <span className="text-ink-3">Three steps.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center leading-relaxed text-ink-2">
            Two people write notes, sixty people need them. Share yours once and the whole class has them before the exam.
          </p>
          <ol className="steps mt-12 grid gap-10 md:grid-cols-3 md:gap-6">
            {STEPS.map(({ icon: Icon, title, text }, i) => (
              <li key={title} className="fx-reveal relative flex flex-col items-center text-center">
                <span className="step-num relative grid size-12 place-items-center rounded-2xl text-accent">
                  <Icon className="size-5" strokeWidth={1.7} />
                </span>
                <p className="tnum mt-5 text-[11px] font-semibold tracking-[0.25em] text-ink-3 uppercase">Step {i + 1}</p>
                <h3 className="mt-1.5 font-display text-xl font-bold tracking-tight">{title}</h3>
                <p className="mt-2 max-w-[17rem] text-sm leading-relaxed text-ink-2">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap justify-center gap-2">
            {['No sign-in to read', 'Photos become one PDF', 'Multi-page camera', 'Comments on every file', 'Kept permanently'].map((t) => (
              <span key={t} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-white/[0.03] px-3 py-1 text-xs text-ink-2">
                <Check className="size-3 text-accent" strokeWidth={2.5} />
                {t}
              </span>
            ))}
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="fx-reveal mt-20">
          <div className="bezel">
            <div className="relative overflow-hidden rounded-[22px] border border-line bg-gradient-to-br from-surface to-bg px-6 py-12 sm:px-12 sm:py-16">
              <div className="dots absolute inset-y-0 right-0 w-full sm:w-2/3" aria-hidden="true" />
              <div className="relative max-w-lg">
                <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Took notes today? Share them in a minute.</h2>
                <p className="mt-4 text-ink-2">Sign in, pick the chapter, snap the pages. Your classmates will thank you before the exam.</p>
              </div>
              <div className="relative mt-8 flex flex-wrap gap-3 sm:justify-end">
                <Link href="/upload" className="btn-primary inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
                  <CloudUpload className="size-4" /> Upload notes
                </Link>
                <Link href="/contributors" className="btn-ghost inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
                  See contributors <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
