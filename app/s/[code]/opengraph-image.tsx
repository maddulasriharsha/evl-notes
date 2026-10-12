import { findSubject } from '@/lib/curriculum'
import { SHARE_SIZE, shareCard } from '@/lib/share-card'

export const dynamic = 'force-dynamic'
export const alt = 'VJNOTES subject'
export const size = SHARE_SIZE
export const contentType = 'image/png'

export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const found = findSubject((await params).code)
  if (!found) return shareCard({ kicker: 'VJNOTES', title: 'Class notes for VNR VJIET' })
  return shareCard({
    kicker: found.subject.code,
    title: found.subject.name,
    subtitle: `${found.subject.short} · notes, question papers and question bank`,
  })
}
