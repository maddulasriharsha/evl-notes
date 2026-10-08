import type { Metadata } from 'next'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { Container, Empty, OwnerName, SectionHeading } from '@/components/ui'
import { allSubjects, findSubject, sectionHref, sectionLabel, sectionsOf, sectionTitle, semesterLabel, subjectHref } from '@/lib/curriculum'
import { searchFiles } from '@/lib/data'
import { driveFiles, LIBRARY_OWNER } from '@/lib/library'
import { plural } from '@/lib/format'

export const metadata: Metadata = { title: 'Search' }

function norm(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function matches(text: string, terms: string[]) {
  const t = norm(text)
  return terms.every((term) => t.includes(term))
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams
  const q = (typeof sp.q === 'string' ? sp.q : '').slice(0, 80).trim()
  const terms = norm(q).split(' ').filter(Boolean)

  const subjects = terms.length
    ? allSubjects().filter(({ subject }) => matches(`${subject.name} ${subject.short} ${subject.code}`, terms))
    : []
  const chapters = terms.length
    ? allSubjects().flatMap(({ subject }) =>
        sectionsOf(subject)
          .filter((u) => u !== 0 && matches(`${sectionTitle(subject, u)} ${subject.short}`, terms))
          .map((u) => ({ subject, unit: u })),
      )
    : []
  const uploaded = terms.length ? await searchFiles(q) : []
  const fromDrive = terms.length
    ? driveFiles
        .filter((f) => matches(`${f.title} ${findSubject(f.subject)?.subject.short ?? ''}`, terms))
        .slice(0, 40)
        .map((f) => ({
          id: f.id,
          href: `/view/d/${f.id}`,
          name: f.title,
          subject_code: f.subject,
          unit: f.unit ?? 0,
          owner_name: LIBRARY_OWNER.name,
          owner_is_admin: LIBRARY_OWNER.admin,
        }))
    : []
  const uploads = [...uploaded.map((u) => ({ ...u, href: `/view/u/${u.id}` })), ...fromDrive]
  const nothing = terms.length > 0 && !subjects.length && !chapters.length && !uploads.length

  return (
    <Container className="py-10">
      <form action="/search" className="relative max-w-2xl">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" />
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder="Try “laplace”, “EDC”, “unit 2”"
          className="h-14 w-full rounded-2xl border border-line bg-surface pr-4 pl-12 text-lg shadow-card outline-none focus:border-accent"
        />
      </form>

      {!terms.length && <p className="mt-6 text-ink-3">Search across every subject, chapter and uploaded file.</p>}
      {nothing && (
        <div className="mt-10">
          <Empty title={`Nothing found for “${q}”`}>Try a shorter word, a subject short name like “DS”, or a topic from the syllabus.</Empty>
        </div>
      )}

      {subjects.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="Subjects" />
          <div className="grid gap-2 sm:grid-cols-2">
            {subjects.map(({ subject, semester }) => (
              <Link key={subject.code} href={subjectHref(subject.code)} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="block text-xs text-ink-3">{semesterLabel(semester)} · {subject.code}</span>
                <span className="block font-medium">{subject.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {chapters.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="Chapters" />
          <div className="grid gap-2 sm:grid-cols-2">
            {chapters.map(({ subject, unit }) => (
              <Link key={`${subject.code}-${unit}`} href={sectionHref(subject.code, unit)} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="block text-xs text-ink-3">{subject.short} · {sectionLabel(unit)}</span>
                <span className="block font-medium">{sectionTitle(subject, unit)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {uploads.length > 0 && (
        <section className="mt-10">
          <SectionHeading title="Files" hint={plural(uploads.length, 'match')} />
          <div className="grid gap-2 sm:grid-cols-2">
            {uploads.map((u) => (
              <Link key={u.id} href={u.href} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="flex text-xs text-ink-3">
                  {findSubject(u.subject_code)?.subject.short ?? u.subject_code} · {sectionLabel(u.unit)} · by&nbsp;
                  <OwnerName name={u.owner_name} admin={u.owner_is_admin} />
                </span>
                <span className="block truncate font-medium">{u.name}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

    </Container>
  )
}
