import type { Metadata } from 'next'
import Link from '@/components/link'
import { SearchBox } from '@/components/search-box'
import { Container, Empty, OwnerName, SectionHeading } from '@/components/ui'
import { allSubjects, findSubject, PAPERS_UNIT, QUESTION_BANK_UNIT, sectionHref, sectionLabel, sectionsOf, sectionTitle, semesterLabel, subjectHref } from '@/lib/curriculum'
import { searchFiles } from '@/lib/data'
import { LIBRARY_OWNER } from '@/lib/library'
import { liveLibrary } from '@/lib/library-live'
import { plural } from '@/lib/format'

export const metadata: Metadata = { title: 'Search' }

function norm(s: string) {
  return s.toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

function matches(text: string, terms: string[]) {
  const t = norm(text)
  return terms.every((term) => t.includes(term))
}

/** Looser match used when nothing matches every word: any word, 3+ letters. */
function matchesAny(text: string, terms: string[]) {
  const t = norm(text)
  return terms.some((term) => term.length >= 3 && t.includes(term))
}

const KINDS = [
  ['all', 'Everything'],
  ['notes', 'Chapter notes'],
  ['papers', 'Question papers'],
  ['bank', 'Question bank'],
] as const
type Kind = (typeof KINDS)[number][0]

const kindOfUnit = (unit: number): Exclude<Kind, 'all'> => (unit === PAPERS_UNIT ? 'papers' : unit === QUESTION_BANK_UNIT ? 'bank' : 'notes')

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const sp = await searchParams
  const q = (typeof sp.q === 'string' ? sp.q : '').slice(0, 80).trim()
  const terms = norm(q).split(' ').filter(Boolean)
  const kind: Kind = KINDS.some(([k]) => k === sp.kind) ? (sp.kind as Kind) : 'all'
  const semParam = typeof sp.sem === 'string' ? Number(sp.sem) : NaN
  const sem = Number.isInteger(semParam) && semParam >= 1 && semParam <= 8 ? semParam : null
  const semOk = (code: string) => sem === null || findSubject(code)?.semester.sem === sem
  const kindOk = (unit: number) => kind === 'all' || kindOfUnit(unit) === kind

  const run = async (match: (text: string, terms: string[]) => boolean, fileQuery: string) => {
    const subjects = terms.length
      ? allSubjects().filter(({ subject }) => semOk(subject.code) && kind !== 'papers' && kind !== 'bank' && match(`${subject.name} ${subject.short} ${subject.code}`, terms))
      : []
    const chapters = terms.length
      ? allSubjects().flatMap(({ subject }) =>
          sectionsOf(subject)
            .filter(
              (u) =>
                u !== 0 && u !== PAPERS_UNIT && u !== QUESTION_BANK_UNIT && semOk(subject.code) && kindOk(u) && match(`${sectionTitle(subject, u)} ${subject.short}`, terms),
            )
            .map((u) => ({ subject, unit: u })),
        )
      : []
    const uploaded = terms.length ? (await searchFiles(fileQuery)).filter((f) => semOk(f.subject_code) && kindOk(f.unit)) : []
    return { subjects, chapters, uploaded }
  }

  let { subjects, chapters, uploaded } = await run(matches, q)
  let relaxed = false
  if (terms.length > 1 && !subjects.length && !chapters.length && !uploaded.length) {
    // Nothing matched every word: show the closest matches (any word) instead of an empty page.
    const longest = [...terms].sort((a, b) => b.length - a.length)[0] ?? ''
    const second = await run(matchesAny, longest)
    if (second.subjects.length || second.chapters.length || second.uploaded.length) {
      ;({ subjects, chapters, uploaded } = second)
      relaxed = true
    }
  }
  const matcher = relaxed ? matchesAny : matches
  const fromDrive = terms.length
    ? (await liveLibrary()).files
        .filter((f) => semOk(f.subject) && kindOk(f.unit ?? 0) && matcher(`${f.title} ${findSubject(f.subject)?.subject.short ?? ''}`, terms))
        .slice(0, 40)
        .map((f) => ({
          id: f.id,
          href: `/view/d/${f.id}`,
          name: f.title,
          subject_code: f.subject,
          unit: f.unit ?? 0,
          owner_name: LIBRARY_OWNER.name,
          owner_is_admin: LIBRARY_OWNER.admin,
          owner_is_mod: false,
        }))
    : []
  const uploads = [...uploaded.map((u) => ({ ...u, href: `/view/u/${u.id}` })), ...fromDrive]
  const nothing = terms.length > 0 && !subjects.length && !chapters.length && !uploads.length

  return (
    <Container className="py-10">
      <div className="max-w-2xl">
        <SearchBox key={q} initial={q} autoFocus={!q} />
      </div>

      {terms.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          {KINDS.map(([k, label]) => (
            <Link
              key={k}
              href={`/search?q=${encodeURIComponent(q)}${k === 'all' ? '' : `&kind=${k}`}${sem ? `&sem=${sem}` : ''}`}
              className={`rounded-full border px-3 py-1.5 font-medium ${kind === k ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:border-line-strong'}`}
            >
              {label}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-line" />
          {[null, 1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
            <Link
              key={s ?? 'all'}
              href={`/search?q=${encodeURIComponent(q)}${kind === 'all' ? '' : `&kind=${kind}`}${s ? `&sem=${s}` : ''}`}
              className={`rounded-full border px-3 py-1.5 font-medium ${sem === s ? 'border-accent bg-accent-soft text-accent' : 'border-line text-ink-2 hover:border-line-strong'}`}
            >
              {s ? `Sem ${s}` : 'All semesters'}
            </Link>
          ))}
        </div>
      )}
      {relaxed && <p className="mt-4 text-sm text-ink-3">No exact match for &ldquo;{q}&rdquo;. Showing the closest results instead.</p>}

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
            {subjects.map(({ subject, semester, branch }) => (
              <Link key={subject.code} href={subjectHref(subject.code)} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
                <span className="block text-xs text-ink-3">{branch ? `${branch.short} · ` : ''}{semesterLabel(semester)} · {subject.code}</span>
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
                  <OwnerName name={u.owner_name} admin={u.owner_is_admin} moderator={u.owner_is_mod} />
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
