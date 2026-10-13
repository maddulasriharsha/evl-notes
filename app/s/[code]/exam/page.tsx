import type { Metadata } from 'next'
import Link from '@/components/link'
import { notFound } from 'next/navigation'
import { ArrowRight, BookOpenCheck, FileQuestion, ListChecks, ScrollText } from 'lucide-react'
import { ChapterNav } from '@/components/chapter-nav'
import { ExamChecklist } from '@/components/exam-checklist'
import { ShelfCards } from '@/components/shelf-cards'
import { Container, Crumbs } from '@/components/ui'
import {
  completeHref,
  findSubject,
  PAPERS_UNIT,
  QUESTION_BANK_UNIT,
  sectionHref,
  sectionLabel,
  sectionsOf,
  sectionTitle,
  subjectCrumbs,
  subjectHref,
} from '@/lib/curriculum'
import { collectionsFor } from '@/lib/data'
import { plural } from '@/lib/format'
import { liveLibrary } from '@/lib/library-live'

// Rebuilt at once when notes change (see refreshChapter); this is only the fallback for votes, comments and the like.
export const revalidate = 600

export async function generateMetadata({ params }: PageProps<'/s/[code]/exam'>): Promise<Metadata> {
  const found = findSubject((await params).code)
  return { title: found ? `Exam prep · ${found.subject.short}` : 'Exam prep' }
}

const yearOf = (t: string) => t.match(/(20\d\d)/)?.[1] ?? ''

export default async function ExamPrepPage({ params }: PageProps<'/s/[code]/exam'>) {
  const found = findSubject((await params).code)
  if (!found) notFound()
  const { subject } = found
  const lib = await liveLibrary()

  const [papers, bank] = await Promise.all([collectionsFor(subject.code, PAPERS_UNIT), collectionsFor(subject.code, QUESTION_BANK_UNIT)])
  const papersDrive = lib.filesFor(subject.code, PAPERS_UNIT)
  const bankDrive = lib.filesFor(subject.code, QUESTION_BANK_UNIT)

  // Only the newest exam year here; the full list is one tap away.
  const latestYear = papersDrive.map((f) => yearOf(f.title)).filter(Boolean).sort().at(-1) ?? ''
  const latest = latestYear ? papersDrive.filter((f) => yearOf(f.title) === latestYear) : papersDrive
  const papersCount = papers.reduce((n, c) => n + c.files.length, 0) + papersDrive.length
  const shown = latest.length + (latestYear ? 0 : papers.reduce((n, c) => n + c.files.length, 0))

  const chapters = sectionsOf(subject).filter((u) => u !== 0 && u !== QUESTION_BANK_UNIT && u !== PAPERS_UNIT)
  const counts = await Promise.all(
    chapters.map(async (u) => (await collectionsFor(subject.code, u)).reduce((n, c) => n + c.files.length, 0) + lib.count(subject.code, u)),
  )
  const items = chapters.map((u, i) => ({
    unit: u,
    label: sectionLabel(u),
    title: sectionTitle(subject, u),
    href: sectionHref(subject.code, u),
    count: counts[i] ?? 0,
  }))

  return (
    <>
      <section className="grain">
        <Container className="pt-10 pb-10">
          <Crumbs items={[...subjectCrumbs(found), { href: subjectHref(subject.code), label: subject.short }, { label: 'Exam prep' }]} />
          <p className="mt-6 text-xs font-semibold tracking-widest text-ink-3 uppercase">{subject.short} · Exam prep</p>
          <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
            Exam prep: {subject.name}
          </h1>
          <p className="mt-3 text-sm text-ink-3">
            Everything for the exam in one place: the latest papers, the question bank, complete notes and a chapter checklist.
          </p>
        </Container>
      </section>

      <ChapterNav subject={subject} active="exam" />

      <Container className="mt-10 space-y-14">
        <section>
          <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <ScrollText className="size-5 text-ink-3" /> {latestYear ? `${latestYear} papers` : 'Latest papers'}
          </h2>
          <p className="mb-4 text-sm text-ink-3">
            {papersCount > shown ? (
              <>
                Showing the newest.{' '}
                <Link href={`${completeHref(subject.code)}#previous-papers`} className="font-medium text-accent">
                  See all {plural(papersCount, 'paper')} by year
                </Link>
              </>
            ) : (
              'The newest exam papers for this subject.'
            )}
          </p>
          <ShelfCards
            collections={latestYear ? [] : papers}
            drive={latest}
            subjectCode={subject.code}
            subjectShort={subject.short}
            unit={PAPERS_UNIT}
            label="Question papers"
            uploadHref={`/upload?subject=${subject.code}&unit=${PAPERS_UNIT}`}
            emptyTitle="No question papers yet"
            emptyHint="Have an old exam paper?"
            anchor="ep-"
          />
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <FileQuestion className="size-5 text-ink-3" /> Question bank
          </h2>
          <ShelfCards
            collections={bank}
            drive={bankDrive}
            subjectCode={subject.code}
            subjectShort={subject.short}
            unit={QUESTION_BANK_UNIT}
            label="Question bank"
            uploadHref={`/upload?subject=${subject.code}&unit=${QUESTION_BANK_UNIT}`}
            emptyTitle="No question bank files yet"
            emptyHint="Have important questions?"
            anchor="eq-"
          />
        </section>

        <section>
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <ListChecks className="size-5 text-ink-3" /> Chapter checklist
          </h2>
          {items.length ? (
            <ExamChecklist subjectCode={subject.code} items={items} />
          ) : (
            <p className="text-sm text-ink-3">This subject has no chapters listed.</p>
          )}
        </section>

        <Link
          href={completeHref(subject.code)}
          className="group flex items-center gap-4 rounded-2xl border border-accent bg-accent-soft px-5 py-4 shadow-card transition hover:opacity-90"
        >
          <BookOpenCheck className="size-6 text-accent" />
          <span className="min-w-0 flex-1 font-medium">Complete notes for {subject.short}</span>
          <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5" />
        </Link>
      </Container>
    </>
  )
}
