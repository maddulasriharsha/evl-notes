import { findSubject, parseSectionSlug, sectionLabel, sectionTitle } from '@/lib/curriculum'
import { SHARE_SIZE, shareCard } from '@/lib/share-card'

export const dynamic = 'force-dynamic'
export const alt = 'VJNOTES chapter'
export const size = SHARE_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ code: string; section: string }> }) {
  const { code, section } = await params
  const found = findSubject(code)
  const unit = parseSectionSlug(section)
  if (!found || unit === null) return shareCard({ kicker: 'VJNOTES', title: 'Class notes for VNR VJIET' })
  return shareCard({
    kicker: `${found.subject.short} · ${sectionLabel(unit)}`,
    title: sectionTitle(found.subject, unit),
    subtitle: found.subject.name,
  })
}
