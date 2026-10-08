import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Thumb, type ThumbIcon } from '@/components/thumb'
import { Badge } from '@/components/ui'
import type { NoteFile } from '@/lib/data'
import { publicFileUrl } from '@/lib/env'
import { formatBytes, plural } from '@/lib/format'
import { driveThumbUrl, isImage, kindLabel, type DriveFile } from '@/lib/library'

export function UploadFileCard({ file }: { file: NoteFile }) {
  const isPdf = file.mime === 'application/pdf'
  const thumb = file.thumb_path ? publicFileUrl(file.thumb_path) : !isPdf ? publicFileUrl(file.storage_path) : null
  return (
    <Link
      href={`/view/u/${file.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
    >
      <Thumb src={thumb} icon={isPdf ? 'pdf' : 'image'} label={isPdf ? 'pdf' : 'image'} />
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">
        <p className="line-clamp-2 text-sm leading-snug font-medium">{file.name}</p>
        <p className="mt-auto flex items-center gap-1 text-xs text-ink-3">
          <span className="truncate">
            {isPdf ? 'PDF' : 'Image'}
            {file.page_count ? ` · ${plural(file.page_count, 'page')}` : ''} · {formatBytes(file.size_bytes)}
          </span>
          {file.comment_count > 0 && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-medium text-ink-2">
              <MessageCircle className="size-3.5" /> {file.comment_count}
            </span>
          )}
        </p>
      </div>
    </Link>
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
