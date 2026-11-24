import { BookMarked, ExternalLink } from 'lucide-react'
import { TextbookAdmin, TextbookRemove } from '@/components/textbook-admin'
import { findBookUrl, type Textbook } from '@/lib/textbooks'

/** The books for one subject, as cards. Moderators and admins also see Add and Remove. */
export function TextbookList({ subject, books, admin = true }: { subject: string; books: Textbook[]; admin?: boolean }) {
  return (
    <div>
      {books.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-5 py-6 text-sm text-ink-3">
          No books listed for this subject yet. Know the prescribed textbook? Ask a moderator to add it.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <li key={b.id} className="fx-card group relative flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-card">
              <span className="flex items-center gap-2 text-[11px] font-semibold tracking-widest text-ink-3 uppercase">
                <BookMarked className="size-3.5" /> {b.kind === 'textbook' ? 'Textbook' : 'Reference'}
              </span>
              <p className="mt-2 line-clamp-3 pr-6 leading-snug font-medium">{b.title}</p>
              {(b.authors || b.edition) && (
                <p className="mt-1 text-sm text-ink-3">
                  {b.authors}
                  {b.authors && b.edition ? ' · ' : ''}
                  {b.edition}
                </p>
              )}
              <a
                href={findBookUrl(b)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex items-center gap-1.5 pt-3 text-sm font-medium text-accent hover:underline"
              >
                {b.link ? 'Open' : 'Find this book'} <ExternalLink className="size-3.5" />
              </a>
              {admin && <TextbookRemove id={b.id} subject={b.subject_code} title={b.title} />}
            </li>
          ))}
        </ul>
      )}
      {admin && <TextbookAdmin subject={subject} />}
      <p className="mt-3 text-xs text-ink-3">We list books only and do not host them. Borrow from the college library or buy a copy.</p>
    </div>
  )
}
