import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, CloudUpload } from 'lucide-react'
import { ButtonLink, Container, Crumbs, SectionHeading } from '@/components/ui'
import { allSubjects, findSubject, sectionHref, sectionLabel, sectionsOf, sectionTitle, semesterHref, subjectCrumbs } from '@/lib/curriculum'
import { countsForSubject } from '@/lib/data'
import { driveCount } from '@/lib/library'
import { plural } from '@/lib/format'

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
  const sections = sectionsOf(subject)

  return (
    <>
      <section className="grain border-b border-line">
        <Container className="pt-10 pb-10">
          <Crumbs
            items={[...subjectCrumbs(found), { label: subject.short }]}
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
          {found.usedIn.length > 1 && (
            <p className="mt-5 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              Taught in:
              {found.usedIn.map((u) =>
                u.branch ? (
                  <Link
                    key={`${u.branch.id}-${u.semester.sem}`}
                    href={semesterHref(u.branch.id, u.semester.sem)}
                    className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-xs font-medium text-ink-2 hover:text-ink"
                  >
                    {u.branch.short} · Sem {u.semester.sem}
                  </Link>
                ) : null,
              )}
              <span className="text-xs">Notes are shared by all of them.</span>
            </p>
          )}
        </Container>
      </section>

      <Container className="mt-10">
        <SectionHeading title={subject.units.length ? 'Chapters' : 'Sections'} hint="Open a chapter to see everyone’s notes for it." />
        <ol className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {sections.map((unit) => {
            const mine = (counts[unit] ?? 0) + driveCount(subject.code, unit)
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
                  <span className={`hidden rounded-md px-2 py-0.5 text-xs font-medium sm:block ${mine ? 'bg-accent-soft text-accent' : 'bg-surface-2 text-ink-3'}`}>
                    {plural(mine, 'file')}
                  </span>
                  <ArrowRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
                </Link>
              </li>
            )
          })}
        </ol>

      </Container>
    </>
  )
}
