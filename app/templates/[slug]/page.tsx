import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Download, ExternalLink } from 'lucide-react'
import { Container, Crumbs } from '@/components/ui'
import { driveEmbedUrl, driveViewUrl } from '@/lib/drive-link'
import { findTemplate, templateDownload, templates } from '@/lib/templates'

export function generateStaticParams() {
  return templates.map((t) => ({ slug: t.slug }))
}

export async function generateMetadata({ params }: PageProps<'/templates/[slug]'>): Promise<Metadata> {
  const t = findTemplate((await params).slug)
  return { title: t ? `${t.title} · Templates` : 'Template' }
}

export default async function TemplatePage({ params }: PageProps<'/templates/[slug]'>) {
  const t = findTemplate((await params).slug)
  if (!t) notFound()

  return (
    <Container className="pt-10">
      <Crumbs items={[{ href: '/', label: 'Home' }, { label: 'Templates' }, { label: t.title }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Template · {t.format}</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight sm:text-4xl">{t.title}</h1>
          <p className="mt-2 text-sm text-ink-3">{t.note}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={templateDownload(t)}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90"
          >
            <Download className="size-4" /> Download
          </a>
          <a
            href={driveViewUrl(t.kind, t.driveId)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong"
          >
            <ExternalLink className="size-4" /> Open in Google Drive
          </a>
        </div>
      </div>
      <div className="mt-6 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <iframe src={driveEmbedUrl(t.kind, t.driveId)} title={t.title} className="h-[80vh] w-full" allow="autoplay" />
      </div>
    </Container>
  )
}
