import Link from '@/components/link'
import { completeHref, PAPERS_UNIT, sectionHref, sectionLabel, subjectHref, type Subject } from '@/lib/curriculum'

export type ChapterNavActive = 'overview' | 'complete' | 'papers' | 'exam' | number

/**
 * A slim bar that stays under the header while a subject page scrolls: every chapter, the papers,
 * the question bank and exam prep, one tap apart.
 */
export function ChapterNav({ subject, active }: { subject: Subject; active: ChapterNavActive }) {
  const items: { key: ChapterNavActive | 'bank'; href: string; label: string }[] = [
    { key: 'overview', href: subjectHref(subject.code), label: subject.short },
    ...subject.units.map((_, i) => ({ key: i + 1, href: sectionHref(subject.code, i + 1), label: sectionLabel(i + 1) })),
    { key: 'complete', href: completeHref(subject.code), label: 'Complete notes' },
    { key: 'bank', href: `${completeHref(subject.code)}#question-bank`, label: 'Q-Bank' },
    { key: 'papers', href: sectionHref(subject.code, PAPERS_UNIT), label: 'PYQs' },
    { key: 'exam', href: `${subjectHref(subject.code)}/exam`, label: 'Exam prep' },
  ]
  return (
    <nav aria-label={`${subject.short} sections`} className="sticky top-[4.6rem] z-30 border-b border-line bg-bg/85 backdrop-blur-xl sm:top-[5.1rem]">
      <div className="no-scrollbar mx-auto flex max-w-6xl gap-1.5 overflow-x-auto px-4 py-2.5 sm:px-6">
        {items.map((item) => {
          const on = item.key === active
          return (
            <Link
              key={String(item.key)}
              href={item.href}
              aria-current={on ? 'page' : undefined}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                on ? 'border-accent bg-accent-soft text-accent' : 'border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink'
              }`}
            >
              {item.label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
