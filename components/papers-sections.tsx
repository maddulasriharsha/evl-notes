import { ShelfCards } from '@/components/shelf-cards'
import { PAPERS_UNIT } from '@/lib/curriculum'
import type { NoteCollection } from '@/lib/data'
import { plural } from '@/lib/format'
import type { DriveFile } from '@/lib/library'

/** A mid-term paper says so in its title ("Mid 1", "Mid-2", "MID II"); everything else is a semester-end paper. */
export function isMidPaper(title: string) {
  return /(^|[^a-z])mid([^a-z]|$)/i.test(title)
}

const yearIn = (text: string, fallback: string) => text.match(/(20\d\d)/)?.[1] ?? (/^\d{4}/.test(fallback) ? fallback.slice(0, 4) : 'Other')

interface YearGroup {
  year: string
  drive: DriveFile[]
  collections: NoteCollection[]
  count: number
}

function byYear(drive: DriveFile[], collections: NoteCollection[]): YearGroup[] {
  const years = new Map<string, { drive: DriveFile[]; collections: NoteCollection[] }>()
  const slot = (y: string) => {
    if (!years.has(y)) years.set(y, { drive: [], collections: [] })
    return years.get(y)!
  }
  for (const f of drive) slot(yearIn(f.title, 'Other')).drive.push(f)
  for (const c of collections) {
    const mine = new Map<string, typeof c.files>()
    for (const f of c.files) {
      const y = yearIn(f.name, f.created_at ?? 'Other')
      mine.set(y, [...(mine.get(y) ?? []), f])
    }
    for (const [y, files] of mine) slot(y).collections.push({ ...c, files })
  }
  return [...years.entries()]
    .sort((a, b) => (a[0] === 'Other' ? 1 : b[0] === 'Other' ? -1 : b[0].localeCompare(a[0])))
    .map(([year, v]) => ({ year, ...v, count: v.drive.length + v.collections.reduce((n, c) => n + c.files.length, 0) }))
}

/** Only the files of one kind (mid or semester-end), dropping shelves left empty. */
function pick(collections: NoteCollection[], mid: boolean) {
  return collections.map((c) => ({ ...c, files: c.files.filter((f) => isMidPaper(f.name) === mid) })).filter((c) => c.files.length > 0)
}

/**
 * Previous question papers in two parts, "Mid PYQs" and "Sem PYQs", each split by exam year
 * (newest first). A paper's kind and year are read from its title.
 */
export function PapersSections({
  subjectCode,
  subjectShort,
  papers,
  drive,
}: {
  subjectCode: string
  subjectShort: string
  papers: NoteCollection[]
  drive: DriveFile[]
}) {
  const uploadHref = `/upload?subject=${subjectCode}&unit=${PAPERS_UNIT}`
  const parts = [
    { id: 'mid-pyqs', key: 'm', title: 'Mid PYQs', hint: 'Mid-term (Mid I and Mid II) papers.', groups: byYear(drive.filter((f) => isMidPaper(f.title)), pick(papers, true)) },
    { id: 'sem-pyqs', key: 's', title: 'Sem PYQs', hint: 'Semester-end exam papers.', groups: byYear(drive.filter((f) => !isMidPaper(f.title)), pick(papers, false)) },
  ]

  return (
    <div className="space-y-12">
      {parts.map((part) => {
        const total = part.groups.reduce((n, g) => n + g.count, 0)
        return (
          <div key={part.id} id={part.id} className="scroll-mt-24">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
              {part.title}
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">{plural(total, 'paper')}</span>
            </h3>
            <p className="mb-4 text-sm text-ink-3">{part.hint}</p>
            {part.groups.length === 0 ? (
              <ShelfCards
                collections={[]}
                drive={[]}
                subjectCode={subjectCode}
                subjectShort={subjectShort}
                unit={PAPERS_UNIT}
                label={part.title}
                uploadHref={uploadHref}
                emptyTitle={`No ${part.title} yet`}
                emptyHint={part.key === 'm' ? 'Have a mid paper? Put “Mid” in its name.' : 'Have an old exam paper?'}
                anchor={`${part.key}-`}
              />
            ) : (
              <div className="space-y-8">
                {part.groups.map((g) => (
                  <div key={g.year} id={`${part.id}-${g.year}`} className="scroll-mt-24">
                    <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold tracking-widest text-ink-3 uppercase">
                      {g.year}
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium tracking-normal normal-case">{plural(g.count, 'paper')}</span>
                    </h4>
                    <ShelfCards
                      collections={g.collections}
                      drive={g.drive}
                      subjectCode={subjectCode}
                      subjectShort={subjectShort}
                      unit={PAPERS_UNIT}
                      label={`${part.title} ${g.year}`}
                      uploadHref={uploadHref}
                      emptyTitle=""
                      emptyHint=""
                      anchor={`${part.key}${g.year}-`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
