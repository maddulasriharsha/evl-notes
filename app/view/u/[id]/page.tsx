import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Download, ExternalLink } from 'lucide-react'
import { ImageViewer } from '@/components/image-viewer'
import { PdfViewer } from '@/components/pdf-viewer'
import { ActionLink, ViewerShell } from '@/components/viewer-shell'
import { findSubject, sectionHref, sectionLabel } from '@/lib/curriculum'
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
  const original = publicFileUrl(file.storage_path)
  const download = publicFileUrl(file.storage_path, file.name)
  const isPdf = file.mime === 'application/pdf'

  return (
    <ViewerShell
      nav={{
        back: { href: `${sectionHref(file.subject_code, file.unit)}#c-${file.collection_id}`, label: 'chapter' },
        title: file.name,
        meta: `${file.owner_name} · ${found?.subject.short ?? file.subject_code} · ${sectionLabel(file.unit)} · ${formatBytes(file.size_bytes)} · added ${formatDate(file.created_at)}`,
        prev: prev && `/view/u/${prev.id}`,
        next: next && `/view/u/${next.id}`,
        position: `${i + 1}/${file.siblings.length}`,
        actions: (
          <>
            <ActionLink href={original} newTab>
              <ExternalLink className="size-4" />
              <span className="hidden md:inline">Open original</span>
            </ActionLink>
            <ActionLink href={download} primary>
              <Download className="size-4" />
              <span className="hidden sm:inline">Download</span>
            </ActionLink>
          </>
        ),
      }}
    >
      {isPdf ? (
        <PdfViewer url={original} downloadHref={download} />
      ) : (
        <ImageViewer preview={file.preview_path ? publicFileUrl(file.preview_path) : original} original={original} alt={file.name} />
      )}
    </ViewerShell>
  )
}
