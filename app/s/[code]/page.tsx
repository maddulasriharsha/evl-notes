import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CloudUpload } from 'lucide-react'
import { DriveFileCard } from '@/components/file-card'
import { ButtonLink, Container, Crumbs, SectionHeading } from '@/components/ui'
import { allSubjects, sectionHref, sectionLabel, sectionsOf, sectionTitle, semesterLabel, findSubject } from '@/lib/curriculum'
import { countsForSubject } from '@/lib/data'
import { plural } from '@/lib/format'
import { driveFilesFor } from '@/lib/library'

export const revalidate = 60

export function generateStaticParams() {
  return allSubjects().map(({ subject }) => ({ code: subject.code.toLowerCase() }))
}

export async function generateMetadata({ params }: PageProps<'/s/[code]'>): Promise<Metadata> {
  const found = findSubject((await params).code)
  return { title: found ? `${found.subject.name} (${found.subject.short})` : 'Subject' }
}

export default async function SubjectPage({ params }: PageProps<'/s/[code]'>) {
  const found = findSubject((await params).code)
  if (!found) notFound()
  const { subject, semester } = found
  const counts = await countsForSubject(subject.code)
  const library = driveFilesFor(subject.code)
  const questions = library.filter((f) => f.kind === 'questions')
  const sections = sectionsOf(subject)

  return (
    <>
      <section className="grain border-b border-line">
        <Container className="pt-10 pb-10">
          <Crumbs
            items={[
              { href: '/', label: 'Home' },
              semester.sem ? { href: `/sem/${semester.sem}`, label: semesterLabel(semester) } : { label: semesterLabel(semester) },
              { label: subject.short },
            ]}
          />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="font-mono text-sm text-ink-3">
                {subject.code}
                {subject.credits > 0 && ` · ${plural(subject.credits, 'credit')}`}
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">{subject.name}</h1>
            </div>
            <ButtonLink href={`/upload?subject=${subject.code}`}>
              <CloudUpload className="size-4" /> Upload notes
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="mt-10">
        <SectionHeading title={subject.units.length ? 'Chapters' : 'Sections'} hint="Open a chapter to see everyone’s notes for it." />
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {sections.map((unit) => {
            const lib = library.filter((f) => (f.unit ?? 0) === unit).length
            const mine = counts[unit] ?? 0
            return (
              <li key={unit} className="border-b border-line last:border-0">
                <Link href={sectionHref(subject.code, unit)} className="group flex items-center gap-4 px-5 py-4 transition hover:bg-surface-2/60">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-bg font-display text-lg font-semibold text-ink-2">
                    {unit === 0 ? '∗' : ['I', 'II', 'III', 'IV', 'V'][unit - 1]}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold tracking-widest text-ink-3 uppercase">{sectionLabel(unit)}</span>
                    <span className="block truncate font-medium">{sectionTitle(subject, unit)}</span>
                  </span>
                  <span className="hidden text-right text-xs text-ink-3 sm:block">
                    <span className="block">{plural(mine, 'student file')}</span>
                    <span className="block">{plural(lib, 'library file')}</span>
                  </span>
                  <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            )
          })}
        </ol>

        {questions.length > 0 && (
          <section className="mt-14">
            <SectionHeading title="Question papers & banks" hint={`${plural(questions.length, 'file')} from the ADMIN library, across all chapters.`} />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {questions.map((f) => (
                <DriveFileCard key={f.id} file={f} />
              ))}
            </div>
          </section>
        )}
      </Container>
    </>
  )
}
