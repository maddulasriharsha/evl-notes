'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bookmark, BookOpen, CornerDownLeft, FileText, GraduationCap, Home, Layers, Search, Upload, Users } from 'lucide-react'
import type { Suggestion } from '@/app/api/suggest/route'

export const OPEN_PALETTE = 'vj:open-palette'

interface Row {
  href: string
  title: string
  hint: string
  icon: typeof Home
}

const ICON = { subject: BookOpen, chapter: Layers, file: FileText } as const

/**
 * Ctrl+K (or ⌘K, or "/") from anywhere: a floating box that jumps to any subject, chapter or
 * file, and to the main pages. Arrow keys move, Enter opens, Esc closes.
 */
export function CommandPalette() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [found, setFound] = useState<Row[]>([])
  const [busy, setBusy] = useState(false)
  const [at, setAt] = useState(0)
  const [branch, setBranch] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      const typing = !!t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((v) => !v)
      } else if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setOpen(true)
      }
    }
    const onOpen = () => setOpen(true)
    window.addEventListener('keydown', onKey)
    window.addEventListener(OPEN_PALETTE, onOpen)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener(OPEN_PALETTE, onOpen)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setQ('')
    setFound([])
    setAt(0)
    try {
      setBranch(localStorage.getItem('vj-branch'))
    } catch {
      setBranch(null)
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => input.current?.focus(), 20)
    return () => {
      document.body.style.overflow = prev
      clearTimeout(t)
    }
  }, [open])

  useEffect(() => {
    const text = q.trim()
    if (!open || text.length < 2) {
      setFound([])
      setBusy(false)
      return
    }
    setBusy(true)
    const stop = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/suggest?q=${encodeURIComponent(text)}`, { signal: stop.signal })
        .then((r) => (r.ok ? r.json() : { items: [] }))
        .then((d: { items: Suggestion[] }) => {
          setFound((d.items ?? []).map((s) => ({ href: s.href, title: s.title, hint: s.hint, icon: ICON[s.kind] })))
          setAt(0)
          setBusy(false)
        })
        .catch(() => undefined)
    }, 180)
    return () => {
      clearTimeout(t)
      stop.abort()
    }
  }, [q, open])

  if (!open) return null

  const text = q.trim()
  const pages: Row[] = [
    { href: '/', title: 'Home', hint: 'Start page', icon: Home },
    { href: branch ? `/b/${branch}` : '/#branches', title: 'My branch', hint: branch ? 'The branch you last opened' : 'Pick your branch', icon: GraduationCap },
    { href: '/upload', title: 'Upload notes', hint: 'Share yours with the class', icon: Upload },
    { href: '/saved', title: 'Saved notes', hint: 'Files you bookmarked', icon: Bookmark },
    { href: '/contributors', title: 'Contributors', hint: 'Who shared the most', icon: Users },
  ]
  const rows: Row[] =
    text.length < 2
      ? pages
      : [
          ...found,
          ...pages.filter((p) => p.title.toLowerCase().includes(text.toLowerCase())),
          { href: `/search?q=${encodeURIComponent(text)}`, title: `Search everything for “${text}”`, hint: 'Includes notes uploaded by classmates', icon: Search },
        ]
  const pick = Math.min(at, rows.length - 1)

  function go(row: Row | undefined) {
    if (!row) return
    setOpen(false)
    router.push(row.href)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') setOpen(false)
    else if (e.key === 'Enter') {
      e.preventDefault()
      go(rows[pick])
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const next = (pick + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length
      setAt(next)
      list.current?.children[next]?.scrollIntoView({ block: 'nearest' })
    }
  }

  return (
    <div
      className="palette-in fixed inset-0 z-[70] flex items-start justify-center bg-black/55 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && setOpen(false)}
    >
      <div role="dialog" aria-modal="true" aria-label="Jump to" onKeyDown={onKeyDown} className="palette-box w-full max-w-xl overflow-hidden rounded-2xl border border-line-strong bg-surface shadow-pop">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Search className="size-5 shrink-0 text-ink-3" />
          <input
            ref={input}
            value={q}
            onChange={(e) => setQ(e.target.value.slice(0, 60))}
            placeholder="Jump to a subject, chapter or file…"
            aria-label="Jump to"
            autoComplete="off"
            // The box itself shows it is active; the site-wide focus ring would double it.
            style={{ outline: 'none' }}
            className="h-14 w-full bg-transparent text-base placeholder:text-ink-3"
          />
          <kbd className="hidden shrink-0 rounded-md border border-line px-1.5 py-0.5 text-[11px] text-ink-3 sm:block">Esc</kbd>
        </div>
        <ul ref={list} className="max-h-[52vh] overflow-y-auto p-2">
          {rows.map((row, i) => {
            const Icon = row.icon
            const on = i === pick
            return (
              <li key={`${row.href}-${i}`}>
                <button
                  type="button"
                  onMouseEnter={() => setAt(i)}
                  onClick={() => go(row)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${on ? 'bg-accent-soft' : ''}`}
                >
                  <span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${on ? 'border-accent text-accent' : 'border-line text-ink-3'}`}>
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{row.title}</span>
                    <span className="block truncate text-xs text-ink-3">{row.hint}</span>
                  </span>
                  {on && <CornerDownLeft className="size-4 shrink-0 text-accent" />}
                </button>
              </li>
            )
          })}
        </ul>
        <p className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-ink-3">
          <span>↑ ↓ to move</span>
          <span>Enter to open</span>
          <span className="ml-auto">{busy ? 'Searching…' : 'Ctrl K to open this anywhere'}</span>
        </p>
      </div>
    </div>
  )
}

/** The header's hint button: shows the shortcut and opens the palette for mouse users. */
export function PaletteButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE))}
      aria-label="Jump to a subject, chapter or file"
      className="btn-ghost hidden h-10 items-center gap-2 rounded-xl px-3 text-sm text-ink-2 lg:inline-flex"
    >
      <Search className="size-4" />
      <span>Jump to…</span>
      <kbd className="rounded-md border border-line px-1.5 py-0.5 text-[10px] text-ink-3">Ctrl K</kbd>
    </button>
  )
}
