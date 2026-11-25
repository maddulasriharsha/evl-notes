import type { Metadata } from 'next'
import { CalendarClock } from 'lucide-react'
import { ExamExplorer, type ExamView } from '@/components/exam-explorer'
import { Container } from '@/components/ui'
import { findBranch, subjectHref } from '@/lib/curriculum'
import { EXAMS, paperOf } from '@/lib/exams'

export const metadata: Metadata = {
  title: 'Exam schedule',
  description: 'Branch-wise sessional and semester exam timetables for every year, with each subject linked to its notes.',
}

/** Resolves every paper to its name and (when the subject is on the site) its page, once, on the server. */
function build(): ExamView[] {
  return EXAMS.map((e) => ({
    year: e.year,
    kind: e.kind,
    title: e.title,
    regulation: e.regulation,
    days: e.days,
    notes: e.notes ?? [],
    electives: e.openElectives,
    branches: Object.keys(e.rows).map((id) => ({ id, short: findBranch(id)?.short ?? id.toUpperCase() })),
    rows: Object.fromEntries(
      Object.entries(e.rows).map(([id, days]) => [
        id,
        days.map((codes) =>
          codes.map((code) => {
            const p = paperOf(code)
            return { code: p.code, name: p.name, href: p.onSite ? subjectHref(p.code) : null, oe: code === 'OE' || undefined }
          }),
        ),
      ]),
    ),
  }))
}

export default function ExamsPage() {
  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-accent uppercase">Exams</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
        <CalendarClock className="size-8 text-accent" /> Exam schedule
      </h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Pick your year and exam, then your branch. Tap a subject to jump straight to its notes and question papers.
      </p>
      <ExamExplorer exams={build()} />
    </Container>
  )
}
