import type { Metadata } from 'next'
import Link from '@/components/link'
import { BookMarked } from 'lucide-react'
import { TextbookList } from '@/components/textbook-list'
import { Container, Empty } from '@/components/ui'
import { findSubject, subjectHref } from '@/lib/curriculum'
import { plural } from '@/lib/format'
import { allTextbooks, type Textbook } from '@/lib/textbooks'

export const metadata: Metadata = { title: 'Textbooks' }
// Refreshed at once when staff add or remove a book (refreshTextbooks); this is only the fallback.
export const revalidate = 3600

export default async function TextbooksPage() {
  const books = await allTextbooks()
  const bySubject = new Map<string, Textbook[]>()
  for (const b of books) bySubject.set(b.subject_code, [...(bySubject.get(b.subject_code) ?? []), b])
  const groups = [...bySubject.entries()]
    .map(([code, list]) => ({ code, list, subject: findSubject(code)?.subject }))
    .sort((a, b) => (a.subject?.name ?? a.code).localeCompare(b.subject?.name ?? b.code))

  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Reference</p>
      <h1 className="mt-1 flex items-center gap-3 font-display text-4xl font-semibold tracking-tight">
        <BookMarked className="size-8 text-ink-3" /> Textbooks
      </h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        The prescribed textbooks and reference books for each subject, with where to find them. We list books only and do not host them.
        Each subject page has its own list too.
      </p>

      <div className="mt-8 space-y-10">
        {groups.length === 0 ? (
          <Empty title="No books listed yet">Moderators add them on each subject page. Check back soon.</Empty>
        ) : (
          groups.map(({ code, list, subject }) => (
            <section key={code}>
              <h2 className="mb-3 flex flex-wrap items-baseline gap-x-3 font-display text-xl font-semibold tracking-tight">
                <Link href={subjectHref(code)} className="hover:text-accent">
                  {subject?.name ?? code}
                </Link>
                <span className="text-sm font-normal text-ink-3">{plural(list.length, 'book')}</span>
              </h2>
              <TextbookList subject={code} books={list} admin={false} />
            </section>
          ))
        )}
      </div>
    </Container>
  )
}
