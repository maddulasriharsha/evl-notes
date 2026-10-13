import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BookOpenCheck, CloudUpload, FileQuestion, ScrollText } from 'lucide-react'
import { RequestNotesButton } from '@/components/community-buttons'
import { OtherBranchNotes } from '@/components/other-branch-notes'
import { PapersSections } from '@/components/papers-sections'
import { QrButton } from '@/components/qr-button'
import { ShelfCards } from '@/components/shelf-cards'
import { ButtonLink, Container, Crumbs } from '@/components/ui'
import { allSubjects, completeHref, findSubject, PAPERS_UNIT, QUESTION_BANK_UNIT, subjectCrumbs, subjectHref } from '@/lib/curriculum'
import { collectionsFor, taggedQuestionsFor, type NoteCollection } from '@/lib/data'
import { plural } from '@/lib/format'
import { liveLibrary } from '@/lib/library-live'

export const revalidate = 60

export function generateStaticParams() {
  return allSubjects().map(({ subject }) => ({ code: subject.code.toLowerCase() }))
}

export async function generateMetadata({ params }: PageProps<'/s/[code]/complete'>): Promise<Metadata> {
  const found = findSubject((await params).code)
  return { title: found ? `Complete notes & Question bank · ${found.subject.short}` : 'Complete notes' }
}

export default async function CompletePage({ params }: PageProps<'/s/[code]/complete'>) {
  const found = findSubject((await params).code)
  if (!found) notFound()
  const { subject } = found

  const lib = await liveLibrary()
  const driveFilesFor = lib.filesFor
  const [papers, notes, bankHere, tagged] = await Promise.all([
    collectionsFor(subject.code, PAPERS_UNIT),
    collectionsFor(subject.code, 0),
    collectionsFor(subject.code, QUESTION_BANK_UNIT),
    taggedQuestionsFor(subject.code),
  ])
  // Tagged notes from other chapters join the Question bank, without listing a note twice.
  const seen = new Set(bankHere.flatMap((c) => c.files.map((f) => f.id)))
  const extra: NoteCollection[] = tagged
    .map((c) => ({ ...c, files: c.files.filter((f) => !seen.has(f.id)) }))
    .filter((c) => c.files.length > 0)
  // A shelf can be in both lists (the same uploader has notes in the bank and tagged ones elsewhere): merge by uploader.
  const bank = [...bankHere]
  for (const c of extra) {
    const mine = bank.find((b) => b.owner_id === c.owner_id)
    if (mine) mine.files = [...mine.files, ...c.files]
    else bank.push(c)
  }

  const notesDrive = driveFilesFor(subject.code, 0)
  const bankDrive = driveFilesFor(subject.code, QUESTION_BANK_UNIT)
  const notesCount = notes.reduce((n, c) => n + c.files.length, 0) + notesDrive.length
  const bankCount = bank.reduce((n, c) => n + c.files.length, 0) + bankDrive.length
  const papersDrive = driveFilesFor(subject.code, PAPERS_UNIT)
  const papersCount = papers.reduce((n, c) => n + c.files.length, 0) + papersDrive.length
  return (
    <>
      <section className="grain border-b border-line">
        <Container className="pt-10 pb-10">
          <Crumbs items={[...subjectCrumbs(found), { href: subjectHref(subject.code), label: subject.short }, { label: 'Complete notes & Question bank' }]} />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">{subject.short} · Start here</p>
              <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                Complete notes &amp; Question bank
              </h1>
              <p className="mt-3 text-sm text-ink-3">
                {plural(notesCount, 'complete note')} · {plural(bankCount, 'question bank file')}
              </p>
            </div>
            <ButtonLink href={`/upload?subject=${subject.code}&unit=0`}>
              <CloudUpload className="size-4" /> Add your notes here
            </ButtonLink>
          </div>
          <div className="mt-6 flex flex-wrap items-start gap-3">
            <RequestNotesButton subject={subject.code} unit={0} />
            <QrButton path={completeHref(subject.code)} title="Complete notes & Question bank" subtitle={`${subject.short} · ${subject.name}`} />
          </div>
        </Container>
      </section>

      <Container className="mt-10 space-y-14">
        <section id="complete-notes" className="scroll-mt-24">
          <h2 className="mb-4 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <BookOpenCheck className="size-5 text-ink-3" /> Complete notes
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">{plural(notesCount, 'file')}</span>
          </h2>
          <ShelfCards
            collections={notes}
            drive={notesDrive}
            subjectCode={subject.code}
            subjectShort={subject.short}
            unit={0}
            label="Complete notes"
            uploadHref={`/upload?subject=${subject.code}&unit=0`}
            emptyTitle="No complete notes yet"
            emptyHint="Have the whole subject in one file?"
            anchor="n-"
          />
          <OtherBranchNotes code={subject.code} unit={0} anchor="on" />
        </section>

        <section id="question-bank" className="scroll-mt-24">
          <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <FileQuestion className="size-5 text-ink-3" /> Question bank
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">{plural(bankCount, 'file')}</span>
          </h2>
          <p className="mb-4 text-sm text-ink-3">Important questions, assignments and question sets. Moderators can add any note here with the &ldquo;Questions&rdquo; tag.</p>
          <ShelfCards
            collections={bank}
            drive={bankDrive}
            subjectCode={subject.code}
            subjectShort={subject.short}
            unit={QUESTION_BANK_UNIT}
            label="Question bank"
            uploadHref={`/upload?subject=${subject.code}&unit=${QUESTION_BANK_UNIT}`}
            emptyTitle="No question bank files yet"
            emptyHint="Have important questions or assignments?"
            anchor="q-"
          />
          <OtherBranchNotes code={subject.code} unit={QUESTION_BANK_UNIT} anchor="oq" />
        </section>

        <section id="previous-papers" className="scroll-mt-24">
          <h2 className="mb-1 flex items-center gap-2 font-display text-xl font-semibold tracking-tight">
            <ScrollText className="size-5 text-ink-3" /> Previous question papers
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">{plural(papersCount, 'file')}</span>
          </h2>
          <p className="mb-6 text-sm text-ink-3">Old exam papers for this subject, mid-term and semester-end.</p>
          <PapersSections subjectCode={subject.code} subjectShort={subject.short} papers={papers} drive={papersDrive} />
          <OtherBranchNotes code={subject.code} unit={PAPERS_UNIT} anchor="op" />
        </section>
      </Container>
    </>
  )
}
