'use client'

import { useEffect, useRef, useState } from 'react'
import Link from '@/components/link'
import { findSubject, sectionLabel } from '@/lib/curriculum'
import { timeAgo } from '@/lib/format'

export interface FollowingItem {
  id: string
  name: string
  subject_code: string
  unit: number
  created_at: string
  owner_name: string
}

const KEY = 'vj-following-seen'

/** Notes in followed subjects. "New" marks those added since this device last opened the page. */
export function FollowingList({ items }: { items: FollowingItem[] }) {
  const [since, setSince] = useState<number | null>(null)
  const stamped = useRef(false)

  useEffect(() => {
    let last = 0
    try {
      last = Number(localStorage.getItem(KEY) ?? 0)
    } catch {
      // Storage blocked: nothing is marked new.
    }
    setSince(last)
    if (stamped.current) return
    stamped.current = true
    // Remember the visit once the list has had a chance to render.
    const t = setTimeout(() => {
      try {
        localStorage.setItem(KEY, String(Date.now()))
      } catch {
        // ignore
      }
    }, 1500)
    return () => clearTimeout(t)
  }, [])

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {items.map((n) => {
        const isNew = since !== null && since > 0 && new Date(n.created_at).getTime() > since
        return (
          <Link key={n.id} href={`/view/u/${n.id}`} className="rounded-xl border border-line bg-surface px-4 py-3 hover:border-line-strong">
            <span className="flex items-center gap-2 text-xs text-ink-3">
              {findSubject(n.subject_code)?.subject.short ?? n.subject_code} · {sectionLabel(n.unit)} · {timeAgo(n.created_at)}
              {isNew && <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">New</span>}
            </span>
            <span className="block truncate font-medium">{n.name}</span>
            <span className="block truncate text-xs text-ink-3">by {n.owner_name}</span>
          </Link>
        )
      })}
    </div>
  )
}
