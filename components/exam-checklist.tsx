'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

export type ChecklistItem = { unit: number; label: string; title: string; href: string; count: number }

/** Chapter-by-chapter revision tracker. Ticks stay in this browser only (nothing is sent anywhere). */
export function ExamChecklist({ subjectCode, items }: { subjectCode: string; items: ChecklistItem[] }) {
  const key = `vj-revised:${subjectCode}`
  const [done, setDone] = useState<number[]>([])

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(key) ?? '[]')
      if (Array.isArray(raw)) setDone(raw.filter((n): n is number => typeof n === 'number'))
    } catch {
      /* storage unavailable: start empty */
    }
  }, [key])

  function toggle(unit: number) {
    const next = done.includes(unit) ? done.filter((u) => u !== unit) : [...done, unit]
    setDone(next)
    try {
      localStorage.setItem(key, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const total = items.length
  const n = items.filter((i) => done.includes(i.unit)).length
  const pct = total ? Math.round((n / total) * 100) : 0

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-sm font-medium text-ink-2">
          {n}/{total} revised
        </span>
      </div>
      <ol className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {items.map((i) => {
          const on = done.includes(i.unit)
          return (
            <li key={i.unit} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
              <button
                type="button"
                aria-pressed={on}
                aria-label={on ? `Mark ${i.label} as not revised` : `Mark ${i.label} as revised`}
                onClick={() => toggle(i.unit)}
                className={`grid size-7 shrink-0 place-items-center rounded-lg border ${on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-bg text-transparent hover:text-ink-3'}`}
              >
                <Check className="size-4" />
              </button>
              <Link href={i.href} className="min-w-0 flex-1 hover:text-accent">
                <span className="block text-xs font-semibold tracking-widest text-ink-3 uppercase">{i.label}</span>
                <span className={`block truncate font-medium ${on ? 'text-ink-3 line-through' : ''}`}>{i.title}</span>
              </Link>
              <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">
                {i.count} {i.count === 1 ? 'file' : 'files'}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
