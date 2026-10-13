import type { Metadata } from 'next'
import Link from '@/components/link'
import { CloudUpload, HandHelping } from 'lucide-react'
import { Container, Empty } from '@/components/ui'
import { findSubject, sectionHref, sectionLabel, sectionTitle } from '@/lib/curriculum'
import { openRequests } from '@/lib/community'
import { plural, timeAgo } from '@/lib/format'

export const metadata: Metadata = { title: 'Note requests' }
// Rebuilt at once when notes change (see refreshChapter); this is only the fallback for votes, comments and the like.
export const revalidate = 300

export default async function RequestsPage() {
  const list = await openRequests()
  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Classmates are waiting</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Note requests</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Chapters people asked for that have no notes yet. If you have them, upload and your name goes on the shelf. To ask for a
        chapter, open it and press <strong className="text-ink">Request notes</strong>.
      </p>

      <div className="mt-8">
        {list.length === 0 ? (
          <Empty title="No open requests">Every chapter anyone asked for has notes now. Nice.</Empty>
        ) : (
          <div className="space-y-2">
            {list.map((r) => {
              const found = findSubject(r.subject_code)
              return (
                <div key={`${r.subject_code}-${r.unit}`} className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface px-5 py-4 shadow-card">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-bg text-ink-2">
                    <HandHelping className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
                      {found?.subject.short ?? r.subject_code} · {sectionLabel(r.unit)}
                    </p>
                    <Link href={sectionHref(r.subject_code, r.unit)} className="block truncate font-medium hover:text-accent">
                      {found ? sectionTitle(found.subject, r.unit) : r.subject_code}
                    </Link>
                    <p className="text-xs text-ink-3">
                      {plural(r.count, 'person')} waiting · latest {timeAgo(r.latest)}
                    </p>
                    {r.messages.length > 0 && (
                      <p className="mt-1 line-clamp-1 text-xs text-ink-2">“{r.messages[0]}”</p>
                    )}
                  </div>
                  <Link
                    href={`/upload?subject=${r.subject_code}&unit=${r.unit}`}
                    className="btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold"
                  >
                    <CloudUpload className="size-4" /> I have these
                  </Link>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </Container>
  )
}
