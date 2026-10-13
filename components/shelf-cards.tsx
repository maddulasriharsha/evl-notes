import { ThumbsUp } from 'lucide-react'
import { BranchPartition, ShelfBranchPicker, type BranchShelf } from '@/components/branch-partition'
import { DownloadShelfButton } from '@/components/download-shelf'
import { DriveFileCard, UploadFileCard } from '@/components/file-card'
import { Empty, OwnerName } from '@/components/ui'
import type { NoteCollection } from '@/lib/data'
import { publicFileUrl } from '@/lib/env'
import { formatDate, plural, timeAgo } from '@/lib/format'
import { branches, findSubject } from '@/lib/curriculum'
import { LIBRARY_OWNER, type DriveFile } from '@/lib/library'

const isLibraryOwner = (c: NoteCollection) => c.owner_is_admin && c.owner_name === LIBRARY_OWNER.name

/**
 * The people's shelves for one place (a chapter, or one half of the Complete notes & Question bank
 * page): one card per uploader, with the owner's Drive notes merged into the owner's own card.
 */
export function ShelfCards({
  collections,
  drive,
  subjectCode,
  subjectShort,
  unit,
  label,
  uploadHref,
  emptyTitle,
  emptyHint,
  anchor = '',
}: {
  collections: NoteCollection[]
  drive: DriveFile[]
  subjectCode: string
  subjectShort: string
  /** The chapter these shelves belong to (used for names and for refreshing the right page). */
  unit: number
  /** Shown in "Download as one PDF" titles, e.g. "Unit II". */
  label: string
  uploadHref: string
  emptyTitle: string
  emptyHint: string
  /** Prefix that keeps element ids unique when two lists share one page. */
  anchor?: string
}) {
  const ownerShelf = collections.find(isLibraryOwner)
  const cards: { key: string; collection?: NoteCollection; drive: DriveFile[] }[] = [
    ...(ownerShelf || drive.length ? [{ key: ownerShelf?.id ?? 'owner', collection: ownerShelf, drive }] : []),
    ...collections.filter((c) => c !== ownerShelf).map((c) => ({ key: c.id, collection: c, drive: [] as DriveFile[] })),
  ]
  // PDFs and photos that can be joined into one downloadable PDF (Drive links cannot).
  const sourcesOf = (c: NoteCollection) =>
    c.files
      .filter((f) => f.storage_path && !f.original_removed_at && (f.mime === 'application/pdf' || f.mime.startsWith('image/')))
      .map((f) => ({ name: f.name, mime: f.mime, url: publicFileUrl(f.storage_path!) }))
  const topHelpful = collections.reduce((m, c) => Math.max(m, c.helpful), 0)

  if (cards.length === 0) {
    return (
      <Empty title={emptyTitle} action={{ href: uploadHref, label: 'Upload the first notes' }}>
        {emptyHint} They appear here under your name, for the whole class.
      </Empty>
    )
  }

  const names = Object.fromEntries(branches.map((b) => [b.id, b.short]))
  const options = branches.map((b) => ({ id: b.id, short: b.short }))
  const taughtIn = [...new Set((findSubject(subjectCode)?.usedIn ?? []).map((u) => u.branch?.id).filter((x): x is string => !!x))]

  const shelves: BranchShelf[] = cards.map(({ key, collection: c, drive: driveList }) => {
        const name = c?.owner_name ?? LIBRARY_OWNER.name
        const admin = c ? c.owner_is_admin : LIBRARY_OWNER.admin
        const mod = c ? c.owner_is_mod : false
        const count = (c?.files.length ?? 0) + driveList.length
        // The admin's notes are for everyone; a member's notes belong to that member's branch.
        const branch = c && !admin && !driveList.length ? c.owner_branch : null
        const node = (
          <article
            id={c && !driveList.length ? `${anchor}c-${c.id}` : `${anchor}owner-notes`}
            className="fx-reveal scroll-mt-36 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
          >
            {c && driveList.length > 0 && <span id={`${anchor}c-${c.id}`} className="block scroll-mt-36" />}
            <header className="mb-4 flex flex-wrap items-center gap-3">
              <span className="grid size-10 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center font-semibold">
                  <OwnerName name={`${name}’s notes`} admin={admin} moderator={mod} />
                  {branch && (
                    <span className="ml-2 rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-ink-3 uppercase">
                      {names[branch] ?? branch}
                    </span>
                  )}
                  {c && topHelpful > 0 && c.helpful === topHelpful && (
                    <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-ok-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-ok uppercase">
                      <ThumbsUp className="size-3" /> Most helpful
                    </span>
                  )}
                </p>
                <p className="text-xs text-ink-3">
                  {plural(count, 'file')}
                  {c && c.helpful > 0 && ` · ${plural(c.helpful, 'helpful vote')}`}
                  {c && ` · started ${formatDate(c.created_at)} · updated ${timeAgo(c.updated_at)}`}
                </p>
              </div>
              {c && !admin && taughtIn.length > 1 && <ShelfBranchPicker userId={c.owner_id} branch={c.owner_branch} options={options} />}
              {c && sourcesOf(c).length > 1 && (
                <DownloadShelfButton sources={sourcesOf(c)} title={`${name} - ${subjectShort} ${label}`} label="Download as one PDF" />
              )}
            </header>
            {c?.description && <p className="mb-4 text-sm whitespace-pre-line text-ink-2">{c.description}</p>}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {c?.files.map((f) => <UploadFileCard key={f.id} file={f} subject={subjectCode} unit={c.unit ?? unit} />)}
              {driveList.map((f) => (
                <DriveFileCard key={f.id} file={f} placeUnit={unit} />
              ))}
            </div>
          </article>
        )
        return { key, branch, node }
  })

  // Only a subject that several branches share needs the partition.
  if (taughtIn.length < 2 || shelves.every((x) => !x.branch)) {
    return (
      <div className="space-y-6">
        {shelves.map((x) => (
          <div key={x.key}>{x.node}</div>
        ))}
      </div>
    )
  }
  return <BranchPartition shelves={shelves} taughtIn={taughtIn} names={names} />
}
