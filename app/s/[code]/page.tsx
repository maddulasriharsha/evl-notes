import { ViewTransition } from 'react'
import type { Metadata } from 'next'
import Link from '@/components/link'
import { notFound } from 'next/navigation'
import { ArrowRight, BookOpenCheck, CloudUpload, GraduationCap, ScrollText } from 'lucide-react'
import { ChapterNav } from '@/components/chapter-nav'
import { CountUp } from '@/components/count-up'
import { FollowButton } from '@/components/community-buttons'
import { QrButton } from '@/components/qr-button'
import { SubjectCrumbs } from '@/components/subject-crumbs'
import { ButtonLink, Container, SectionHeading } from '@/components/ui'
import { allSubjects, completeHref, findSubject, PAPERS_UNIT, QUESTION_BANK_UNIT, sectionHref, sectionLabel, sectionMark, sectionsOf, sectionTitle, semesterHref, subjectCrumbs, subjectHref, subjectUses } from '@/lib/curriculum'
import { countsForSubject } from '@/lib/data'
import { liveLibrary } from '@/lib/library-live'
import { plural } from '@/lib/format'

// Rebuilt at once when notes change (see refreshChapter); this is only the fallback for votes, comments and the like.
export const revalidate = 600

export function generateStaticParams() {
  return allSubjects().map(({ subject }) => ({ code: subject.code.toLowerCase() }))
}

export async function generateMetadata({ params }: PageProps<'/s/[code]'>): Promise<Metadata> {
  const found = findSubject((await params).code)
  return { title: found ? `${found.subject.name} (${found.subject.short})` : 'Subject' }
}

/** A small ring that fills with how many files a chapter has, compared with the fullest chapter. */
function Ring({ value, max, mark }: { value: number; max: number; mark: string }) {
  const r = 19
  const around = 2 * Math.PI * r
  const part = max > 0 ? Math.min(1, value / max) : 0
  return (
    <span className="relative grid size-12 shrink-0 place-items-center">
      <svg viewBox="0 0 48 48" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="24" cy="24" r={r} fill="none" stroke="var(--line-strong)" strokeWidth="3" />
        {part > 0 && (
          <circle cx="24" cy="24" r={r} fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${around * part} ${around}`} />
        )}
      </svg>
      <span className="font-display text-sm font-semibold text-ink-2">{mark}</span>
    </span>
  )
}

export default async function SubjectPage({ params }: PageProps<'/s/[code]'>) {
  const found = findSubject((await params).code)
  if (!found) notFound()
  const { subject } = found
  const [counts, lib] = await Promise.all([countsForSubject(subject.code), liveLibrary()])
  const at = (unit: number) => (counts[unit] ?? 0) + lib.count(subject.code, unit)
  const chapters = sectionsOf(subject).filter((u) => u !== 0 && u !== QUESTION_BANK_UNIT && u !== PAPERS_UNIT)
  const chapterFiles = chapters.reduce((n, u) => n + at(u), 0)
  const complete = at(0)
  const bank = at(QUESTION_BANK_UNIT)
  const papers = at(PAPERS_UNIT)
  const fullest = Math.max(0, ...chapters.map(at))

  const stats = [
    { label: 'Notes', value: chapterFiles + complete },
    { label: 'Question papers', value: papers },
    { label: 'Question bank', value: bank },
    { label: subject.units.length ? 'Chapters' : 'Sections', value: chapters.length },
  ]
  const tiles = [
    {
      href: completeHref(subject.code),
      icon: BookOpenCheck,
      eyebrow: 'Start here',
      title: 'Complete notes & Question bank',
      hint: `${plural(complete, 'complete note')} · ${plural(bank, 'question file')}`,
      lead: true,
    },
    {
      href: sectionHref(subject.code, PAPERS_UNIT),
      icon: ScrollText,
      eyebrow: 'Old exams',
      title: 'Previous question papers',
      hint: papers ? `${plural(papers, 'paper')}, Mid and Sem` : 'No papers yet',
      lead: false,
    },
    {
      href: `${subjectHref(subject.code)}/exam`,
      icon: GraduationCap,
      eyebrow: 'Exam coming up?',
      title: 'Exam prep',
      hint: 'Latest papers, question bank and a revision checklist',
      lead: false,
    },
  ]

  return (
    <>
      <section className="grain">
        <Container className="pt-10 pb-8">
          <SubjectCrumbs fallback={subjectCrumbs(found)} uses={subjectUses(found)} rest={[{ label: subject.short }]} />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="font-mono text-sm text-ink-3">
                {subject.code}
                {subject.credits > 0 && ` · ${plural(subject.credits, 'credit')}`}
              </p>
              <ViewTransition name={`subject-${subject.code.toLowerCase()}`}>
                <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{subject.name}</h1>
              </ViewTransition>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <FollowButton subject={subject.code} />
              <QrButton path={subjectHref(subject.code)} title={subject.name} subtitle={subject.short} />
              <ButtonLink href={`/upload?subject=${subject.code}`}>
                <CloudUpload className="size-4" /> Upload notes
              </ButtonLink>
            </div>
          </div>
          {found.usedIn.length > 1 && (
            <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              Taught in:
              {found.usedIn.map((u) =>
                u.branch ? (
                  <Link
                    key={`${u.branch.id}-${u.semester.sem}`}
                    href={semesterHref(u.branch.id, u.semester.sem)}
                    className="rounded-lg border border-line bg-surface px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink"
                  >
                    {u.branch.short} · Sem {u.semester.sem}
                  </Link>
                ) : null,
              )}
            </p>
          )}
          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.label} className="bg-surface px-4 py-4">
                <dt className="text-xs text-ink-3">{s.label}</dt>
                <dd className="mt-1 font-display text-2xl font-semibold">
                  <CountUp value={s.value} ms={800} />
                </dd>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      <ChapterNav subject={subject} active="overview" />

      <Container className="mt-8">
        <div className="grid gap-3 md:grid-cols-3">
          {tiles.map(({ href, icon: Icon, eyebrow, title, hint, lead }) => (
            <Link
              key={href}
              href={href}
              className={`fx-card fx-tilt fx-reveal group flex flex-col rounded-2xl border p-5 shadow-card hover:shadow-pop ${
                lead ? 'border-accent bg-accent-soft' : 'border-line bg-surface hover:border-line-strong'
              }`}
            >
              <span className={`grid size-11 place-items-center rounded-xl ${lead ? 'bg-accent text-accent-ink' : 'border border-line bg-bg text-ink-2'}`}>
                <Icon className="size-5" />
              </span>
              <span className={`mt-4 text-xs font-semibold tracking-widest uppercase ${lead ? 'text-accent' : 'text-ink-3'}`}>{eyebrow}</span>
              <span className="mt-1 font-display text-lg leading-snug font-semibold">{title}</span>
              <span className="mt-1 text-sm text-ink-3">{hint}</span>
              <span className="mt-auto flex items-center gap-1 pt-4 text-sm font-medium text-ink-2 group-hover:text-ink">
                Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          ))}
        </div>

        {chapters.length > 0 && (
          <section className="mt-12">
            <SectionHeading title={subject.units.length ? 'Chapters' : 'Sections'} hint="Open a chapter to see everyone’s notes for it. The ring shows how much each one has." />
            <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {chapters.map((unit) => {
                const mine = at(unit)
                return (
                  <li key={unit}>
                    <Link
                      href={sectionHref(subject.code, unit)}
                      className="fx-card fx-reveal group flex h-full items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card transition hover:border-line-strong hover:shadow-pop"
                    >
                      <Ring value={mine} max={fullest} mark={sectionMark(unit)} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-semibold tracking-widest text-ink-3 uppercase">{sectionLabel(unit)}</span>
                        <span className="line-clamp-2 leading-snug font-medium">{sectionTitle(subject, unit)}</span>
                        <span className={`mt-1 block text-xs ${mine ? 'text-accent' : 'text-ink-3'}`}>{mine ? plural(mine, 'file') : 'No notes yet'}</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </Link>
                  </li>
                )
              })}
            </ol>
          </section>
        )}
      </Container>
    </>
  )
}
