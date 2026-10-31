'use client'

import { useEffect, useState } from 'react'
import { readProgress, type Progress } from '@/components/page-tools'

/** A thin bar along the bottom of a card showing how far this browser has read the note. */
export function ReadProgress({ fileId }: { fileId: string }) {
  const [p, setP] = useState<Progress | null>(null)
  useEffect(() => setP(readProgress(fileId)), [fileId])
  if (!p || p.page <= 1) return null
  const done = p.page >= p.pages
  return (
    <div className="mt-1" title={done ? 'You reached the last page' : `You stopped on page ${p.page} of ${p.pages}`}>
      <div className="h-1 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round((p.page / p.pages) * 100)}%` }} />
      </div>
      <p className="mt-0.5 text-[10px] text-ink-3">{done ? 'Finished' : `Page ${p.page} of ${p.pages}`}</p>
    </div>
  )
}
