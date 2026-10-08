import Link from 'next/link'
import { ArrowUpRight, FlaskConical, BookOpen } from 'lucide-react'
import { subjectHref, type Subject } from '@/lib/curriculum'
import { plural } from '@/lib/format'

export function SubjectCard({ subject, count }: { subject: Subject; count: number }) {
  const Icon = subject.kind === 'lab' ? FlaskConical : BookOpen
  return (
    <Link
      href={subjectHref(subject.code)}
      className="group relative flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-ink-2">
          <Icon className="size-5" strokeWidth={1.6} />
        </span>
        <ArrowUpRight className="size-4 text-ink-3 transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
      </div>
      <p className="mt-4 text-xs font-semibold tracking-widest text-ink-3 uppercase">{subject.short}</p>
      <h3 className="mt-1 leading-snug font-semibold text-balance">{subject.name}</h3>
      <div className="mt-auto flex items-center gap-2 pt-4 text-xs text-ink-3">
        <span className="font-mono">{subject.code}</span>
        <span>·</span>
        <span>{subject.units.length ? plural(subject.units.length, 'chapter') : 'Lab'}</span>
        <span className="ml-auto rounded-md bg-surface-2 px-1.5 py-0.5 font-medium text-ink-2">{plural(count, 'file')}</span>
      </div>
    </Link>
  )
}
