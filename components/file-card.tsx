import Link from 'next/link'
import { MessageCircle, ThumbsUp } from 'lucide-react'
import { FileTools } from '@/components/file-tools'
import { Thumb, type ThumbIcon } from '@/components/thumb'
import { Badge } from '@/components/ui'
import type { NoteFile } from '@/lib/data'
import { DRIVE_KIND_LABEL, driveKindFromMime, isDriveMime } from '@/lib/drive-link'
import { thumbFor } from '@/lib/file-thumb'
import { formatBytes, plural } from '@/lib/format'
import { driveThumbUrl, isImage, kindLabel, type DriveFile } from '@/lib/library'

export function UploadFileCard({ file, subject, unit }: { file: NoteFile; subject: string; unit: number }) {
  const isLink = isDriveMime(file.mime)
  const isPdf = file.mime === 'application/pdf'
  const thumb = thumbFor(file)
  return (
    <div className="group relative flex">
    <FileTools id={file.id} ownerId={file.owner_id} name={file.name} subject={subject} unit={unit} variant="card" />
    <Link
      href={`/view/u/${file.id}`}
      className="flex w-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
    >
      <Thumb
        src={thumb}
        icon={isLink ? (driveKindFromMime(file.mime) === 'presentation' ? 'slides' : 'doc') : isPdf ? 'pdf' : 'image'}
        label={isLink ? DRIVE_KIND_LABEL[driveKindFromMime(file.mime)].replace('Drive ', '') : isPdf ? 'pdf' : 'image'}
      />
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{file.name}</p>
        <p className="mt-auto flex items-center gap-1 text-xs text-ink-3">
          <span className="truncate">
            {isLink ? DRIVE_KIND_LABEL[driveKindFromMime(file.mime)] : isPdf ? 'PDF' : 'Image'}
            {file.page_count ? ` · ${plural(file.page_count, 'page')}` : ''}
            {file.size_bytes != null ? ` · ${formatBytes(file.size_bytes)}` : ''}
          </span>
          {(file.helpful_count > 0 || file.comment_count > 0) && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-2 font-medium text-ink-2">
              {file.helpful_count > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <ThumbsUp className="size-3.5" /> {file.helpful_count}
                </span>
              )}
              {file.comment_count > 0 && (
                <span className="inline-flex items-center gap-0.5">
                  <MessageCircle className="size-3.5" /> {file.comment_count}
                </span>
              )}
            </span>
          )}
        </p>
      </div>
    </Link>
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
export function DriveFileCard({ file }: { file: DriveFile }) {
  const tone = file.kind === 'questions' ? 'gold' : file.kind === 'lab' ? 'ok' : 'neutral'
  return (
    <Link
      href={`/view/d/${file.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
    >
      <Thumb src={driveThumbUrl(file.id)} icon={iconFor(file.ext)} label={file.ext} />
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{file.title}</p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5">
          {file.kind !== 'notes' && <Badge tone={tone}>{kindLabel[file.kind]}</Badge>}
          <span className="text-xs text-ink-3">
            {file.ext.toUpperCase()}
            {file.pages ? ` · ${plural(file.pages, 'page')}` : ''}
          </span>
        </div>
      </div>
    </Link>
  )
}
