import Link from 'next/link'
import { ShelfCards } from '@/components/shelf-cards'
import { PAPERS_UNIT } from '@/lib/curriculum'
import type { NoteCollection } from '@/lib/data'
import { plural } from '@/lib/format'
import type { DriveFile } from '@/lib/library'
import { isMidPaper, paperChip, paperSlot, type PaperSlot } from '@/lib/papers'

const yearIn = (text: string, fallback: string) => text.match(/(20\d\d)/)?.[1] ?? (/^\d{4}/.test(fallback) ? fallback.slice(0, 4) : 'Other')
const byNewest = (a: string, b: string) => (a === 'Other' ? 1 : b === 'Other' ? -1 : b.localeCompare(a))

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
    .sort((a, b) => byNewest(a[0], b[0]))
    .map(([year, v]) => ({ year, ...v, count: v.drive.length + v.collections.reduce((n, c) => n + c.files.length, 0) }))
}

/** Only the files of one kind (mid or semester-end), dropping shelves left empty. */
function pick(collections: NoteCollection[], mid: boolean) {
  return collections.map((c) => ({ ...c, files: c.files.filter((f) => isMidPaper(f.name) === mid) })).filter((c) => c.files.length > 0)
}

const COLUMNS: { slot: PaperSlot; label: string }[] = [
  { slot: 'mid1', label: 'Mid 1' },
  { slot: 'mid2', label: 'Mid 2' },
  { slot: 'sem', label: 'Sem end' },
  { slot: 'combined', label: 'Combined' },
]

/** Year by exam: one glance shows which papers exist, and each one opens from its cell. */
function PapersTable({ papers, drive }: { papers: NoteCollection[]; drive: DriveFile[] }) {
  const cells = new Map<string, { href: string; title: string }[]>()
  const put = (title: string, fallback: string, href: string) => {
    const key = `${yearIn(title, fallback)}|${paperSlot(title)}`
    cells.set(key, [...(cells.get(key) ?? []), { href, title }])
  }
  for (const f of drive) put(f.title, 'Other', `/view/d/${f.id}`)
  for (const c of papers) for (const f of c.files) put(f.name, f.created_at ?? 'Other', `/view/u/${f.id}`)
  const years = [...new Set([...cells.keys()].map((k) => k.split('|')[0]!))].sort(byNewest)
  const columns = COLUMNS.filter((c) => c.slot !== 'combined' || years.some((y) => cells.has(`${y}|combined`)))
  if (years.length === 0) return null

  return (
    <div className="mb-12 overflow-x-auto rounded-2xl border border-line bg-surface shadow-card">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <caption className="sr-only">Question papers by year and exam</caption>
        <thead>
          <tr className="border-b border-line text-xs tracking-widest text-ink-3 uppercase">
            <th scope="col" className="px-4 py-3 font-semibold">
              Year
            </th>
            {columns.map((c) => (
              <th key={c.slot} scope="col" className="px-3 py-3 font-semibold">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {years.map((year) => (
            <tr key={year} className="border-b border-line align-top last:border-0">
              <th scope="row" className="px-4 py-3 font-display text-base font-semibold whitespace-nowrap">
                {year}
              </th>
              {columns.map((c) => {
                const list = cells.get(`${year}|${c.slot}`) ?? []
                return (
                  <td key={c.slot} className="px-3 py-2.5">
                    {list.length === 0 ? (
                      <span className="text-ink-3/60" aria-label="none">
                        –
                      </span>
                    ) : (
                      <span className="flex flex-wrap gap-1.5">
                        {list.map((p) => (
                          <Link
                            key={p.href}
                            href={p.href}
                            title={p.title}
                            className="rounded-lg border border-line bg-bg px-2 py-1 text-xs font-medium whitespace-nowrap text-ink-2 hover:border-accent hover:text-accent"
                          >
                            {paperChip(p.title)}
                          </Link>
                        ))}
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * Previous question papers: an at-a-glance table (year by exam), then the papers themselves in two
 * parts, "Mid PYQs" and "Sem PYQs", each split by exam year (newest first). A paper's kind and
 * year are read from its title.
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
    <>
      <PapersTable papers={papers} drive={drive} />
      <div className="space-y-12">
        {parts.map((part) => {
          const total = part.groups.reduce((n, g) => n + g.count, 0)
          return (
            <div key={part.id} id={part.id} className="scroll-mt-36">
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
                    <div key={g.year} id={`${part.id}-${g.year}`} className="scroll-mt-36">
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
    </>
  )
}
