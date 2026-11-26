'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Flame, History } from 'lucide-react'
import Link from '@/components/link'
import { cachedStreak, STREAK_EVENT } from '@/lib/streak'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

/** The hero's main button: "Pick your branch" for a new visitor, "Open <branch> notes" once they have one. */
export function BranchCta({ branches }: { branches: { id: string; short: string }[] }) {
  const [mine, setMine] = useState<{ id: string; short: string } | null>(null)
  useEffect(() => {
    const id = read('vj-branch')
    setMine(branches.find((b) => b.id === id) ?? null)
  }, [branches])
  return mine ? (
    <Link href={`/b/${mine.id}`} className="btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
      <BookOpen className="size-4" /> Open {mine.short} notes
    </Link>
  ) : (
    <Link href="#branches" className="btn-primary inline-flex h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
      <BookOpen className="size-4" /> Pick your branch
    </Link>
  )
}

/** "Continue: <the page you were on>", right in the hero, for people who have been here before. */
export function ContinueChip() {
  const [last, setLast] = useState<{ path: string; title: string } | null>(null)
  useEffect(() => {
    try {
      const list = JSON.parse(read('vj-history') ?? '[]') as { path?: unknown; title?: unknown }[]
      const e = list[0]
      if (e && typeof e.path === 'string' && typeof e.title === 'string') setLast({ path: e.path, title: e.title })
    } catch {
      /* nothing remembered */
    }
  }, [])
  if (!last) return null
  return (
    <Link
      href={last.path}
      className="rise mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-accent/40 bg-accent-soft px-4 py-2 text-sm font-medium text-accent transition hover:border-accent"
    >
      <History className="size-4 shrink-0" />
      <span className="truncate">Continue: {last.title}</span>
      <ArrowRight className="size-4 shrink-0" />
    </Link>
  )
}

/** Your streak, once it reaches two days, linking to the leaderboard. */
export function StudyStreak({ className = '' }: { className?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const show = () => setN(cachedStreak()?.streak ?? 0)
    show()
    window.addEventListener(STREAK_EVENT, show)
    return () => window.removeEventListener(STREAK_EVENT, show)
  }, [])
  if (n < 2) return null
  return (
    <Link href="/leaderboard?tab=streak" className={`inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3.5 py-1.5 text-sm font-medium text-gold ${className}`}>
      <Flame className="size-4" /> {n}-day study streak <ArrowRight className="size-3.5" />
    </Link>
  )
}
