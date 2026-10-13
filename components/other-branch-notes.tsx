import Link from '@/components/link'
import { Users } from 'lucide-react'
import { ShelfCards } from '@/components/shelf-cards'
import { sectionHref, sectionsOf, sectionTitle, siblingSubjects } from '@/lib/curriculum'
import { collectionsFor } from '@/lib/data'
import { liveLibrary } from '@/lib/library-live'

/**
 * The same subject is sometimes taught to other branches under a different code. Their notes for
 * this chapter are listed here, below the branch's own, so nobody misses a good set of notes.
 * Renders nothing when no other branch has anything.
 */
export async function OtherBranchNotes({ code, unit, anchor = 'o' }: { code: string; unit: number; anchor?: string }) {
  const siblings = siblingSubjects(code).filter((s) => sectionsOf(s.subject).includes(unit))
  if (siblings.length === 0) return null
  const lib = await liveLibrary()
  const found = (
    await Promise.all(
      siblings.map(async (s) => ({
        entry: s,
        collections: await collectionsFor(s.subject.code, unit),
        drive: lib.filesFor(s.subject.code, unit),
      })),
    )
  ).filter((s) => s.collections.length > 0 || s.drive.length > 0)
  if (found.length === 0) return null

  return (
    <div className="mt-10 rounded-2xl border border-line bg-surface/40 p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
        <Users className="size-5 text-ink-3" /> Notes from other branches
      </h3>
      <p className="mt-1 mb-5 text-sm text-ink-3">The same subject, taught to other branches. Different professors, same syllabus area.</p>
      <div className="space-y-8">
        {found.map(({ entry, collections, drive }) => {
          const who = [...new Set(entry.usedIn.map((u) => u.branch?.short).filter(Boolean))].join(', ')
          return (
            <div key={entry.subject.code}>
              <p className="mb-3 text-sm">
                <span className="font-semibold">{who || entry.subject.short}</span>
                <span className="text-ink-3"> · </span>
                <Link href={sectionHref(entry.subject.code, unit)} className="text-accent hover:underline">
                  {sectionTitle(entry.subject, unit)}
                </Link>
              </p>
              <ShelfCards
                collections={collections}
                drive={drive}
                subjectCode={entry.subject.code}
                subjectShort={entry.subject.short}
                unit={unit}
                label={`${entry.subject.short} (${who})`}
                uploadHref={`/upload?subject=${entry.subject.code}&unit=${unit}`}
                emptyTitle=""
                emptyHint=""
                anchor={`${anchor}${entry.subject.code.toLowerCase()}-`}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
