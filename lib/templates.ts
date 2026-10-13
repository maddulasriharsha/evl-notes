import data from '@/data/templates.json'
import type { DriveLinkKind } from '@/lib/drive-link'

/** A ready-made document every student needs (record sheets, report templates), kept on Google Drive. */
export interface Template {
  slug: string
  title: string
  note: string
  /** Shown on the card: PDF, DOCX… */
  format: string
  driveId: string
  kind: DriveLinkKind
}

export const templates = data as Template[]

export function findTemplate(slug: string) {
  return templates.find((t) => t.slug === slug)
}

export function templateHref(slug: string) {
  return `/templates/${slug}`
}

/** A link that downloads an editable copy: the file itself, or a Google Doc exported as Word. */
export function templateDownload(t: Template) {
  const id = encodeURIComponent(t.driveId)
  if (t.kind === 'document') return `https://docs.google.com/document/d/${id}/export?format=docx`
  return `https://drive.google.com/uc?export=download&id=${id}`
}
