import Link from '@/components/link'
import { Download, MessageCircle, ThumbsUp } from 'lucide-react'
import { DriveMove } from '@/components/drive-move'
import { FileTools } from '@/components/file-tools'
import { Thumb, type ThumbIcon } from '@/components/thumb'
import { Badge } from '@/components/ui'
import type { NoteFile } from '@/lib/data'
import { DRIVE_KIND_LABEL, driveDownloadLink, driveKindFromMime, isDriveMime } from '@/lib/drive-link'
import { publicFileUrl } from '@/lib/env'
import { thumbFor } from '@/lib/file-thumb'
import { formatBytes, plural } from '@/lib/format'
import { driveDownloadUrl, driveThumbUrl, isImage, kindLabel, type DriveFile } from '@/lib/library'

const CARD =
  'fx-card fx-tilt flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card hover:border-line-strong hover:shadow-pop'

/** One-tap download, sitting on the card's corner (outside the card link, so it is its own target). */
function DownloadCorner({ href, name }: { href: string; name: string }) {
  return (
    <a
      href={href}
      aria-label={`Download ${name}`}
      title="Download"
      className="absolute right-2.5 bottom-2.5 z-10 grid size-9 place-items-center rounded-xl border border-line bg-bg text-ink-2 shadow-card transition hover:border-accent hover:text-accent"
    >
      <Download className="size-4" />
    </a>
  )
}

export function UploadFileCard({ file, subject, unit }: { file: NoteFile; subject: string; unit: number }) {
  const isLink = isDriveMime(file.mime)
  const isPdf = file.mime === 'application/pdf'
  const thumb = thumbFor(file)
  const kind = isLink ? driveKindFromMime(file.mime) : null
  // Same rule as the viewer: an original moved to Drive is downloaded from its Drive copy.
  const backedUp = !!file.original_removed_at && !!file.backup_drive_id
  const download = backedUp
    ? driveDownloadLink('file', file.backup_drive_id!)
    : kind && file.drive_id
      ? driveDownloadLink(kind, file.drive_id)
      : file.storage_path
        ? publicFileUrl(file.storage_path, file.name)
        : null
  const type = kind ? DRIVE_KIND_LABEL[kind].replace('Drive ', '').replace('Google ', '') : isPdf ? 'PDF' : 'Image'
  return (
    <div className="fx-reveal group relative flex">
      <FileTools id={file.id} ownerId={file.owner_id} name={file.name} subject={subject} unit={unit} variant="card" tagged={file.tags?.includes('questions')} />
      <Link href={`/view/u/${file.id}`} className={CARD}>
        <Thumb src={thumb} icon={kind ? (kind === 'presentation' ? 'slides' : 'doc') : isPdf ? 'pdf' : 'image'} label={type} badge={type} />
        <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
          <p className="line-clamp-3 text-sm leading-snug font-medium">{file.name}</p>
          <p className={`mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3 ${download ? 'pr-11' : ''}`}>
            <span>
              {file.page_count ? plural(file.page_count, 'page') : type}
              {file.size_bytes != null ? ` · ${formatBytes(file.size_bytes)}` : ''}
            </span>
            {file.helpful_count > 0 && (
              <span className="inline-flex items-center gap-0.5 font-medium text-ink-2">
                <ThumbsUp className="size-3.5" /> {file.helpful_count}
              </span>
            )}
            {file.comment_count > 0 && (
              <span className="inline-flex items-center gap-0.5 font-medium text-ink-2">
                <MessageCircle className="size-3.5" /> {file.comment_count}
              </span>
            )}
          </p>
        </div>
      </Link>
      {download && <DownloadCorner href={download} name={file.name} />}
    </div>
  )
}

function iconFor(ext: string): ThumbIcon {
  if (ext === 'pdf') return 'pdf'
  if (isImage(ext)) return 'image'
  if (ext.startsWith('ppt')) return 'slides'
  if (ext === 'c' || ext === 'md') return 'code'
  return 'doc'
}

/** A file from the owner's Google Drive notes, previewed from Drive. */
export function DriveFileCard({ file, placeUnit }: { file: DriveFile; placeUnit?: number }) {
  const tone = file.kind === 'questions' ? 'gold' : file.kind === 'lab' ? 'ok' : 'neutral'
  const type = isImage(file.ext) ? 'Image' : file.ext.toUpperCase()
  return (
    <div className="fx-reveal group relative flex">
      <DriveMove id={file.id} name={file.title} subject={file.subject} unit={placeUnit ?? file.unit ?? 0} />
      <Link href={`/view/d/${file.id}`} className={CARD}>
        <Thumb src={driveThumbUrl(file.id)} icon={iconFor(file.ext)} label={file.ext} badge={type} />
        <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
          <p className="line-clamp-3 text-sm leading-snug font-medium">{file.title}</p>
          <div className="mt-auto flex flex-wrap items-center gap-1.5 pr-11">
            {file.kind !== 'notes' && <Badge tone={tone}>{kindLabel[file.kind]}</Badge>}
            {file.pages ? <span className="text-xs text-ink-3">{plural(file.pages, 'page')}</span> : null}
          </div>
        </div>
      </Link>
      <DownloadCorner href={driveDownloadUrl(file.id)} name={file.title} />
    </div>
  )
}
