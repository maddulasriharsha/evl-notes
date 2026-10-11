import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Download, ExternalLink } from 'lucide-react'
import { AdminFileQuickHide } from '@/components/admin-actions'
import { ViewerWithComments } from '@/components/comments'
import { ImageViewer } from '@/components/image-viewer'
import { PdfViewer } from '@/components/pdf-viewer'
import { OwnerName } from '@/components/ui'
import { ActionLink, ViewerShell } from '@/components/viewer-shell'
import { findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
import {
  DRIVE_KIND_LABEL,
  driveDownloadLink,
  driveEmbedUrl,
  driveKindFromMime,
  driveViewUrl,
  isDriveMime,
} from '@/lib/drive-link'
import { fileById } from '@/lib/data'
import { publicFileUrl } from '@/lib/env'
import { formatBytes, formatDate } from '@/lib/format'

export const revalidate = 300

export async function generateMetadata({ params }: PageProps<'/view/u/[id]'>): Promise<Metadata> {
  const f = await fileById((await params).id)
  return { title: f ? `${f.name} by ${f.owner_name}` : 'File' }
}

export default async function UploadViewer({ params }: PageProps<'/view/u/[id]'>) {
  const file = await fileById((await params).id)
  if (!file) notFound()
  const found = findSubject(file.subject_code)
  const i = file.siblings.findIndex((f) => f.id === file.id)
  const prev = file.siblings[i - 1]
  const next = file.siblings[i + 1]
  // A note is either an uploaded file in our storage or a link to Google Drive.
  const link = file.drive_id && isDriveMime(file.mime) ? { id: file.drive_id, kind: driveKindFromMime(file.mime) } : null
  const original = file.storage_path ? publicFileUrl(file.storage_path) : ''
  const download = file.storage_path ? publicFileUrl(file.storage_path, file.name) : ''
  const isPdf = file.mime === 'application/pdf'
  const detail = link
    ? DRIVE_KIND_LABEL[link.kind]
    : file.size_bytes != null
      ? formatBytes(file.size_bytes)
      : 'File'
  const openHref = link ? driveViewUrl(link.kind, link.id) : original
  const downloadHref = link ? driveDownloadLink(link.kind, link.id) : download

  return (
    <ViewerShell
      nav={{
        back: { href: `${sectionHref(file.subject_code, file.unit)}#c-${file.collection_id}`, label: 'chapter' },
        title: file.name,
        meta: (
          <>
            <OwnerName name={file.owner_name} admin={file.owner_is_admin} />
            <span className="truncate">
              &nbsp;· {found?.subject.short ?? file.subject_code} · {sectionLabel(file.unit)} · {detail} · added {formatDate(file.created_at)}
            </span>
          </>
        ),
        prev: prev && `/view/u/${prev.id}`,
        next: next && `/view/u/${next.id}`,
        position: `${i + 1}/${file.siblings.length}`,
        actions: (
          <>
            <AdminFileQuickHide id={file.id} subject={file.subject_code} unit={file.unit} />
            <ActionLink href={openHref} newTab>
              <ExternalLink className="size-4" />
              <span className="hidden md:inline">{link ? 'Open in Drive' : 'Open original'}</span>
            </ActionLink>
            {downloadHref && (
              <ActionLink href={downloadHref} primary>
                <Download className="size-4" />
                <span className="hidden sm:inline">Download</span>
              </ActionLink>
            )}
          </>
        ),
      }}
    >
      <ViewerWithComments fileId={file.id} ownerId={file.owner_id} initialCount={file.comment_count}>
        {link ? (
          <iframe
            src={driveEmbedUrl(link.kind, link.id)}
            title={file.name}
            className="absolute inset-0 size-full border-0 bg-white"
            allow="autoplay; fullscreen"
          />
        ) : isPdf ? (
          <PdfViewer url={original} downloadHref={download} />
        ) : (
          <ImageViewer preview={file.preview_path ? publicFileUrl(file.preview_path) : original} original={original} alt={file.name} />
        )}
      </ViewerWithComments>
    </ViewerShell>
  )
}
