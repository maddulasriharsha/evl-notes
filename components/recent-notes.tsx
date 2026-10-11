'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { readRecent, type RecentNote } from '@/components/file-actions'
import { findSubject, sectionLabel } from '@/lib/curriculum'
import { timeAgo } from '@/lib/format'

/** The notes this browser opened most recently (kept on this device only). */
export function RecentNotes() {
  const [list, setList] = useState<RecentNote[] | null>(null)
  useEffect(() => setList(readRecent()), [])

  if (list === null) return null
  if (list.length === 0) return <p className="text-sm text-ink-3">Notes you open will show up here, on this device.</p>
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {list.map((n) => (
        <Link key={n.id} href={`/view/u/${n.id}`} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
          <span className="block text-xs text-ink-3">
            {findSubject(n.subject)?.subject.short ?? n.subject} · {sectionLabel(n.unit)} · {timeAgo(new Date(n.at).toISOString())}
          </span>
          <span className="block truncate font-medium">{n.name}</span>
        </Link>
      ))}
    </div>
  )
}
