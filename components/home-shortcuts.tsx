'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, BookOpen, Flame, History } from 'lucide-react'
import Link from '@/components/link'

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

const DAYS = 'vj-days'

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

/** Study days kept in this browser: today is added on every visit. */
function days(): string[] {
  try {
    const raw = JSON.parse(read(DAYS) ?? '[]')
    return Array.isArray(raw) ? raw.filter((d): d is string => typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) : []
  } catch {
    return []
  }
}

/** Counts back from today (or yesterday) through consecutive days. */
export function streakOf(list: string[], today = todayKey()) {
  const set = new Set(list)
  const day = (iso: string, back: number) => new Date(Date.parse(iso + 'T00:00:00Z') - back * 86_400_000).toISOString().slice(0, 10)
  let start = set.has(today) ? 0 : set.has(day(today, 1)) ? 1 : -1
  if (start < 0) return 0
  let n = 0
  while (set.has(day(today, start + n))) n++
  return n
}

/** Quietly records that you studied today and shows your streak once it reaches two days. */
export function StudyStreak({ className = '' }: { className?: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    const t = todayKey()
    const list = days()
    if (!list.includes(t)) {
      list.push(t)
      try {
        localStorage.setItem(DAYS, JSON.stringify(list.sort().slice(-120)))
      } catch {
        /* storage unavailable */
      }
    }
    setN(streakOf(list, t))
  }, [])
  if (n < 2) return null
  return (
    <p className={`inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold-soft px-3.5 py-1.5 text-sm font-medium text-gold ${className}`}>
      <Flame className="size-4" /> {n}-day study streak
    </p>
  )
}
