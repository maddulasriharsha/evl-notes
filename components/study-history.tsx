'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowRight, History, X } from 'lucide-react'

const KEY = 'vj-history'
const MAX = 6
type Entry = { path: string; title: string }

function read(): Entry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((e): e is Entry => typeof e?.path === 'string' && typeof e?.title === 'string').slice(0, MAX)
  } catch {
    return []
  }
}

function write(list: Entry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* storage unavailable */
  }
}

/** Remembers the subject, chapter and file pages a student opens (in this browser only). */
export function HistoryTracker() {
  const pathname = usePathname()
  useEffect(() => {
    if (!/^\/(s|view)\//.test(pathname)) return
    // Wait for the page title to settle after navigation.
    const t = setTimeout(() => {
      const title = document.title.replace(/\s*·\s*VJNOTES\s*$/, '').trim()
      if (!title) return
      write([{ path: pathname, title }, ...read().filter((e) => e.path !== pathname)].slice(0, MAX))
    }, 700)
    return () => clearTimeout(t)
  }, [pathname])
  return null
}

/** "Continue studying" row for the home page; renders nothing for first-time visitors. */
export function ContinueStudying() {
  const [items, setItems] = useState<Entry[]>([])
  useEffect(() => setItems(read()), [])
  if (items.length === 0) return null

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold tracking-tight">
          <History className="size-5 text-ink-3" /> Continue studying
        </h2>
        <button
          type="button"
          onClick={() => {
            write([])
            setItems([])
          }}
          className="inline-flex items-center gap-1 text-xs text-ink-3 hover:text-ink"
        >
          <X className="size-3.5" /> Clear
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((e) => (
          <Link
            key={e.path}
            href={e.path}
            className="group flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 shadow-card transition hover:border-accent"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{e.title}</span>
            <ArrowRight className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </section>
  )
}
