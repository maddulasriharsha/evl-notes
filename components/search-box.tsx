'use client'

import Link from '@/components/link'
import { useEffect, useRef, useState } from 'react'
import { BookOpen, FileText, Layers, Loader2, Search } from 'lucide-react'
import type { Suggestion } from '@/app/api/suggest/route'

const ICON = { subject: BookOpen, chapter: Layers, file: FileText } as const

/**
 * The search field. Typing shows matching subjects, chapters and files straight away; Enter (or
 * "See all results") opens the full search page.
 */
export function SearchBox({ initial = '', autoFocus = false, compact = false }: { initial?: string; autoFocus?: boolean; compact?: boolean }) {
  const [q, setQ] = useState(initial)
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLFormElement>(null)

  useEffect(() => {
    const text = q.trim()
    if (text.length < 2 || text === initial.trim()) {
      setItems([])
      setBusy(false)
      return
    }
    setBusy(true)
    const stop = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(text)}`, { signal: stop.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Suggestion[] }) => {
          setItems(d.items ?? [])
          setBusy(false)
        })
        .catch(() => undefined)
    }, 220)
    return () => {
      clearTimeout(t)
      stop.abort()
    }
  }, [q, initial])

  useEffect(() => {
    const away = (e: MouseEvent) => {
      if (!box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  const show = open && q.trim().length >= 2 && q.trim() !== initial.trim()

  return (
    <form ref={box} action="/search" className="relative w-full" onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Search className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-3 ${compact ? 'left-3.5 size-4' : 'left-4 size-5'}`} />
      <input
        name="q"
        type="search"
        value={q}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder="Search a subject, chapter or file: “laplace”, “EDC”, “mid 1”"
        aria-label="Search notes"
        className={`w-full rounded-2xl border border-line bg-surface shadow-card outline-none focus:border-accent ${compact ? 'h-12 pr-10 pl-10 text-base' : 'h-14 pr-12 pl-12 text-lg'}`}
      />
      {busy && <Loader2 className="absolute top-1/2 right-4 size-4 -translate-y-1/2 animate-spin text-ink-3" />}
      {show && (
        <div className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-pop">
          {items.length === 0 ? (
            <p className="px-4 py-3 text-sm text-ink-3">{busy ? 'Searching…' : 'No quick matches. Press Enter to search everything.'}</p>
          ) : (
            <ul className="max-h-[60vh] overflow-y-auto py-1">
              {items.map((item) => {
                const Icon = ICON[item.kind]
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={() => setOpen(false)} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      <Icon className="size-4 shrink-0 text-ink-3" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{item.title}</span>
                        <span className="block truncate text-xs text-ink-3">{item.hint}</span>
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
          <button type="submit" className="block w-full border-t border-line px-4 py-2.5 text-left text-sm font-medium text-accent hover:bg-surface-2">
            See all results for &ldquo;{q.trim()}&rdquo;
          </button>
        </div>
      )}
    </form>
  )
}
