import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { Thumb } from '@/components/thumb'
import type { NoteFile } from '@/lib/data'
import { publicFileUrl } from '@/lib/env'
import { formatBytes } from '@/lib/format'

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
            {file.page_count ? ` · ${file.page_count} pages` : ''} · {formatBytes(file.size_bytes)}
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
