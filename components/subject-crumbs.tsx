'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
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

const noop = () => () => {}
const readTrail = () => {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

/**
 * Breadcrumbs for a subject page. A subject taught to several branches has no single home, so the
 * server can only offer "Home"; here the branch and semester the student came through (remembered by
 * RememberTrail, or read from the page they came from) are put back in front of it, so "back" leads
 * where they were.
 */
export function SubjectCrumbs({ fallback, uses, rest }: { fallback: Crumb[]; uses: SubjectUse[]; rest: Crumb[] }) {
  // The server renders the fallback; once in the browser the remembered trail is read from storage.
  const stored = useSyncExternalStore(noop, readTrail, () => null)
  const [fromPage, setFromPage] = useState<string | null>(null)

  useEffect(() => {
    // Arriving from a branch or semester page says it outright, and is remembered for the next pages.
    try {
      if (!document.referrer || new URL(document.referrer).origin !== location.origin) return
      const from = /^\/b\/([^/]+)(?:\/sem\/(\d+))?\/?$/.exec(new URL(document.referrer).pathname)
      if (!from) return
      const value = JSON.stringify({ b: from[1], s: from[2] ? Number(from[2]) : null })
      sessionStorage.setItem(KEY, value)
      setFromPage(value)
    } catch {
      /* keep what was remembered */
    }
  }, [])

  let prefix = fallback
  const raw = fromPage ?? stored
  if (fallback.length <= 1 && raw) {
    try {
      const t = JSON.parse(raw) as { b: string; s: number | null }
      const use = uses.find((u) => u.branchId === t.b && (t.s == null || u.sem === t.s)) ?? uses.find((u) => u.branchId === t.b)
      if (use) {
        prefix = [
          { href: '/', label: 'Home' },
          { href: `/b/${use.branchId}`, label: use.branchShort },
          { href: `/b/${use.branchId}/sem/${use.sem}`, label: `Sem ${use.sem}` },
        ]
      }
    } catch {
      /* keep Home */
    }
  }

  return <Crumbs items={[...prefix, ...rest]} />
}
