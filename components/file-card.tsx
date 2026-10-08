import Link from 'next/link'
import { Thumb, type ThumbIcon } from '@/components/thumb'
import { Badge } from '@/components/ui'
import type { NoteFile } from '@/lib/data'
import { publicFileUrl } from '@/lib/env'
import { formatBytes } from '@/lib/format'
import { driveThumbUrl, isImage, kindLabel, type DriveFile } from '@/lib/library'

function iconFor(ext: string): ThumbIcon {
  if (ext === 'pdf') return 'pdf'
  if (isImage(ext)) return 'image'
  if (ext.startsWith('ppt')) return 'slides'
  if (ext === 'c' || ext === 'md') return 'code'
  return 'doc'
}

function Card({ href, children, thumb }: { href: string; children: React.ReactNode; thumb: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop"
    >
      {thumb}
      <div className="flex flex-1 flex-col gap-2 border-t border-line p-3">{children}</div>
    </Link>
  )
}

export function DriveFileCard({ file }: { file: DriveFile }) {
  const tone = file.kind === 'questions' ? 'gold' : file.kind === 'lab' ? 'ok' : 'neutral'
  return (
    <Card href={`/view/d/${file.id}`} thumb={<Thumb src={driveThumbUrl(file.id)} icon={iconFor(file.ext)} label={file.ext} />}>
      <p className="line-clamp-2 text-sm leading-snug font-medium">{file.title}</p>
      <div className="mt-auto flex flex-wrap items-center gap-1.5">
        <Badge tone={tone}>{kindLabel[file.kind]}</Badge>
        <span className="text-xs text-ink-3">
          {file.ext.toUpperCase()}
          {file.pages ? ` · ${file.pages} pages` : ''}
        </span>
      </div>
    </Card>
  )
}

export function UploadFileCard({ file }: { file: NoteFile }) {
  const isPdf = file.mime === 'application/pdf'
  const thumb = file.thumb_path ? publicFileUrl(file.thumb_path) : !isPdf ? publicFileUrl(file.storage_path) : null
  return (
    <Card href={`/view/u/${file.id}`} thumb={<Thumb src={thumb} icon={isPdf ? 'pdf' : 'image'} label={isPdf ? 'pdf' : 'image'} />}>
      <p className="line-clamp-2 text-sm leading-snug font-medium">{file.name}</p>
      <p className="mt-auto text-xs text-ink-3">
        {isPdf ? 'PDF' : 'Image'}
        {file.page_count ? ` · ${file.page_count} pages` : ''} · {formatBytes(file.size_bytes)}
      </p>
    </Card>
  )
}
