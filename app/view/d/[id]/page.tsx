import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Download, ExternalLink } from 'lucide-react'
import { OwnerName } from '@/components/ui'
import { ActionLink, ViewerShell } from '@/components/viewer-shell'
import { findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
import { LIBRARY_OWNER, driveDownloadUrl, driveFile, driveFiles, driveFilesFor, driveOpenUrl, drivePreviewUrl, kindLabel } from '@/lib/library'

export const dynamicParams = false

export function generateStaticParams() {
  return driveFiles.map((f) => ({ id: f.id }))
}

export async function generateMetadata({ params }: PageProps<'/view/d/[id]'>): Promise<Metadata> {
  const f = driveFile((await params).id)
  return { title: f?.title ?? 'File' }
}

export default async function DriveViewer({ params }: PageProps<'/view/d/[id]'>) {
  const file = driveFile((await params).id)
  if (!file) notFound()
  const found = findSubject(file.subject)
  const unit = file.unit ?? 0
  const siblings = driveFilesFor(file.subject, unit)
  const i = siblings.findIndex((f) => f.id === file.id)
  const prev = siblings[i - 1]
  const next = siblings[i + 1]

  return (
    <ViewerShell
      nav={{
        back: { href: `${sectionHref(file.subject, unit)}#owner-notes`, label: 'chapter' },
        title: file.title,
        meta: (
          <>
            <OwnerName name={LIBRARY_OWNER.name} admin={LIBRARY_OWNER.admin} />
            <span className="truncate">
              &nbsp;· {found?.subject.short ?? file.subject} · {sectionLabel(unit)} · {kindLabel[file.kind]}
              {file.pages ? ` · ${file.pages} pages` : ''}
            </span>
          </>
        ),
        prev: prev && `/view/d/${prev.id}`,
        next: next && `/view/d/${next.id}`,
        position: `${i + 1}/${siblings.length}`,
        actions: (
          <>
            <ActionLink href={driveOpenUrl(file.id)} newTab>
              <ExternalLink className="size-4" />
              <span className="hidden md:inline">Open in Drive</span>
            </ActionLink>
            <ActionLink href={driveDownloadUrl(file.id)} primary>
              <Download className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </ActionLink>
          </>
        ),
      }}
    >
      <iframe
        src={drivePreviewUrl(file.id)}
        title={file.title}
        className="absolute inset-0 size-full border-0"
        allow="autoplay; fullscreen"
      />
    </ViewerShell>
  )
}
