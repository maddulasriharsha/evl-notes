'use client'

import { useEffect, useState } from 'react'
import { Crumbs } from '@/components/ui'

type Crumb = { href?: string; label: string }
export interface SubjectUse {
  branchId: string
  branchShort: string
  sem: number
}

const KEY = 'vj-trail'

/** Remembers which branch (and semester) the student is browsing, for the breadcrumbs of the subjects they open next. */
export function RememberTrail({ branchId, sem }: { branchId: string; sem?: number }) {
  useEffect(() => {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ b: branchId, s: sem ?? null }))
    } catch {
      /* the trail is just not remembered */
    }
  }, [branchId, sem])
  return null
}

/**
 * Breadcrumbs for a subject page. A subject taught to several branches has no single home, so the
 * server can only offer "Home"; here the branch and semester the student came through (remembered by
 * RememberTrail) are put back in front of it, so "back" leads where they were.
 */
export function SubjectCrumbs({ fallback, uses, rest }: { fallback: Crumb[]; uses: SubjectUse[]; rest: Crumb[] }) {
  const [prefix, setPrefix] = useState<Crumb[]>(fallback)

  useEffect(() => {
    if (fallback.length > 1) return
    try {
      // Arriving from a branch or semester page says it outright; otherwise use what was remembered.
      const from = /^\/b\/([^/]+)(?:\/sem\/(\d+))?\/?$/.exec(new URL(document.referrer || location.href, location.href).pathname)
      if (from && document.referrer && new URL(document.referrer).origin === location.origin) {
        sessionStorage.setItem(KEY, JSON.stringify({ b: from[1], s: from[2] ? Number(from[2]) : null }))
      }
      const t = JSON.parse(sessionStorage.getItem(KEY) ?? 'null') as { b: string; s: number | null } | null
      if (!t) return
      const use = uses.find((u) => u.branchId === t.b && (t.s == null || u.sem === t.s)) ?? uses.find((u) => u.branchId === t.b)
      if (!use) return
      setPrefix([
        { href: '/', label: 'Home' },
        { href: `/b/${use.branchId}`, label: use.branchShort },
        { href: `/b/${use.branchId}/sem/${use.sem}`, label: `Sem ${use.sem}` },
      ])
    } catch {
      /* keep Home */
    }
  }, [fallback, uses])

  return <Crumbs items={[...prefix, ...rest]} />
}
