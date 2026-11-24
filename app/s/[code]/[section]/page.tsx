import type { Metadata } from 'next'
import Link from '@/components/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, ArrowRight, CloudUpload, ThumbsUp } from 'lucide-react'
import { ChapterNav } from '@/components/chapter-nav'
import { ChapterKeys } from '@/components/shortcuts'
import { RequestNotesButton } from '@/components/community-buttons'
import { DownloadShelfButton } from '@/components/download-shelf'
import { PapersSections } from '@/components/papers-sections'
import { QrButton } from '@/components/qr-button'
import { ShelfCards } from '@/components/shelf-cards'
import { SubjectCrumbs } from '@/components/subject-crumbs'
import { ButtonLink, Container, Empty, OwnerName } from '@/components/ui'
import {
  findSubject,
  parseSectionSlug,
  sectionHref,
  sectionLabel,
  sectionsOf,
  sectionTitle,
  subjectCrumbs,
  subjectUses,
  subjectHref,
  allSubjects,
  sectionSlug,
  completeHref,
  QUESTION_BANK_UNIT,
  PAPERS_UNIT,
} from '@/lib/curriculum'
import { openRequestCount } from '@/lib/community'
import { collectionsFor, type NoteCollection } from '@/lib/data'
import { publicFileUrl } from '@/lib/env'
import { LIBRARY_OWNER, type DriveFile } from '@/lib/library'
import { liveLibrary } from '@/lib/library-live'
import { formatDate, plural, timeAgo } from '@/lib/format'

// Rebuilt at once when notes change (see refreshChapter); this is only the fallback for votes, comments and the like.
export const revalidate = 86400

export function generateStaticParams() {
  return allSubjects().flatMap(({ subject }) =>
    sectionsOf(subject).map((u) => ({ code: subject.code.toLowerCase(), section: sectionSlug(u) })),
  )
}

async function resolve(params: PageProps<'/s/[code]/[section]'>['params']) {
  const { code, section } = await params
  const found = findSubject(code)
  const unit = parseSectionSlug(section)
  if (!found || unit === null || !sectionsOf(found.subject).includes(unit)) return null
  return { ...found, unit }
}

export async function generateMetadata({ params }: PageProps<'/s/[code]/[section]'>): Promise<Metadata> {
  const r = await resolve(params)
  if (!r) return { title: 'Chapter' }
  return { title: `${sectionTitle(r.subject, r.unit)} · ${r.subject.short}` }
}

export default async function SectionPage({ params }: PageProps<'/s/[code]/[section]'>) {
  const r = await resolve(params)
  if (!r) notFound()
  const { subject, semester, unit } = r
  // Complete notes (General) and the Question bank live together on one page.
  if (unit === 0 || unit === QUESTION_BANK_UNIT) redirect(completeHref(subject.code))
  const [collections, waiting] = await Promise.all([collectionsFor(subject.code, unit), openRequestCount(subject.code, unit)])
  const order = sectionsOf(subject)
  const idx = order.indexOf(unit)
  const prev = idx > 0 ? order[idx - 1] : undefined
  const next = idx < order.length - 1 ? order[idx + 1] : undefined
  const prevHref = prev !== undefined ? sectionHref(subject.code, prev) : undefined
  const nextHref = next !== undefined ? sectionHref(subject.code, next) : undefined
  const drive = (await liveLibrary()).filesFor(subject.code, unit)
  // PDFs and photos that can be joined into one downloadable PDF (Drive links cannot).
  const sourcesOf = (c: NoteCollection) =>
    c.files
      .filter((f) => f.storage_path && !f.original_removed_at && (f.mime === 'application/pdf' || f.mime.startsWith('image/')))
      .map((f) => ({ name: f.name, mime: f.mime, url: publicFileUrl(f.storage_path!) }))
  const allSources = collections.flatMap(sourcesOf)
  const totalFiles = collections.reduce((n, c) => n + c.files.length, 0) + drive.length
  const uploadHref = `/upload?subject=${subject.code}&unit=${unit}`

  return (
    <>
      <section className="grain">
        <Container className="pt-10 pb-10">
          <SubjectCrumbs
            fallback={subjectCrumbs(r)}
            uses={subjectUses(r)}
            rest={[{ href: subjectHref(subject.code), label: subject.short }, { label: sectionLabel(unit) }]}
          />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
                {subject.short} · {sectionLabel(unit)}
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                {sectionTitle(subject, unit)}
              </h1>
              <p className="mt-3 text-sm text-ink-3">
                {plural(collections.length + (drive.length ? 1 : 0), 'contributor')} · {plural(totalFiles, 'file')}
              </p>
            </div>
            <ButtonLink href={uploadHref}>
              <CloudUpload className="size-4" /> Add your notes here
            </ButtonLink>
          </div>
          <div className="mt-6 flex flex-wrap items-start gap-3">
            <RequestNotesButton subject={subject.code} unit={unit} />
            <QrButton path={sectionHref(subject.code, unit)} title={sectionTitle(subject, unit)} subtitle={`${subject.short} · ${sectionLabel(unit)}`} />
            {allSources.length > 1 && (
              <DownloadShelfButton
                sources={allSources}
                title={`${subject.short} ${sectionLabel(unit)} notes`}
                label={`Download all ${allSources.length} as one PDF`}
              />
            )}
          </div>
          {waiting > 0 && (
            <p className="mt-3 text-sm text-ink-3">
              {plural(waiting, 'classmate')} asked for notes in this chapter. <Link href="/requests" className="font-medium text-accent">See all requests</Link>
            </p>
          )}
        </Container>
      </section>

      <ChapterNav subject={subject} active={unit === PAPERS_UNIT ? 'papers' : unit} />

      <Container className="mt-10 space-y-14">
        <section>
          {unit === PAPERS_UNIT ? (
            <PapersSections subjectCode={subject.code} subjectShort={subject.short} papers={collections} drive={drive} />
          ) : (
            <>
              <h2 className="mb-4 font-display text-xl font-semibold tracking-tight">Notes</h2>
              <ShelfCards
                collections={collections}
                drive={drive}
                subjectCode={subject.code}
                subjectShort={subject.short}
                unit={unit}
                label={sectionLabel(unit)}
                uploadHref={uploadHref}
                emptyTitle="No notes for this chapter yet"
                emptyHint="Took notes in class?"
                merged
              />
            </>
          )}
        </section>

        <nav aria-label="Other chapters" className="grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
          <ChapterKeys prev={prevHref} next={nextHref} />
          {prev !== undefined && prevHref ? (
            <Link
              href={prevHref}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 transition hover:border-line-strong hover:bg-surface-2"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-bg text-ink-3 transition group-hover:-translate-x-0.5 group-hover:text-ink">
                <ArrowLeft className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-xs text-ink-3">
                  Previous · {sectionLabel(prev)}
                  <kbd className="hidden rounded border border-line px-1 font-mono text-[10px] md:inline">←</kbd>
                </span>
                <span className="mt-0.5 block truncate font-medium">{sectionTitle(subject, prev)}</span>
              </span>
            </Link>
          ) : (
            <span className="hidden sm:block" />
          )}
          {next !== undefined && nextHref && (
            <Link
              href={nextHref}
              className="group flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 text-right transition hover:border-accent/40 hover:bg-surface-2"
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-end gap-2 text-xs text-ink-3">
                  <kbd className="hidden rounded border border-line px-1 font-mono text-[10px] md:inline">→</kbd>
                  Next · {sectionLabel(next)}
                </span>
                <span className="mt-0.5 block truncate font-medium">{sectionTitle(subject, next)}</span>
              </span>
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent transition group-hover:translate-x-0.5">
                <ArrowRight className="size-4" />
              </span>
            </Link>
          )}
        </nav>
      </Container>
    </>
  )
}
