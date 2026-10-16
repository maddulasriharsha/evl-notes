'use client'

import { useEffect, useRef, useState } from 'react'
import { CalendarCheck, Loader2 } from 'lucide-react'
import { EXAM_LABEL, examOf, paperYear, retitlePaper, type ExamKind } from '@/lib/papers'

/**
 * "Mid 1 / Mid 2 / Sem" for a question paper. The site files a paper under Mid or Sem PYQs, and in
 * its year, by reading its title, so choosing here retitles it. `save` stores the new title.
 */
export function ExamTagButton({
  title,
  save,
  variant,
  className,
}: {
  title: string
  save: (next: string) => Promise<void>
  variant: 'card' | 'bar'
  className?: string
}) {
  const current = examOf(title)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [year, setYear] = useState(paperYear(title) ?? new Date().getFullYear())
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])

  async function choose(kind: ExamKind) {
    setBusy(true)
    try {
      await save(retitlePaper(title, kind, year))
      setOpen(false)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save')
    }
    setBusy(false)
  }

  const trigger =
    className ??
    (variant === 'card'
      ? `grid size-8 place-items-center rounded-lg shadow-card backdrop-blur ${current ? 'bg-accent text-accent-ink' : 'bg-bg/90 text-ink-2 hover:text-ink'}`
      : `inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium ${current ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-surface-2'}`)

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        aria-label="Set the exam (Mid 1, Mid 2 or Sem)"
        title={current ? `${EXAM_LABEL[current]} paper (click to change)` : 'Set the exam: Mid 1, Mid 2 or Sem'}
        aria-expanded={open}
        disabled={busy}
        onClick={() => setOpen((o) => !o)}
        className={trigger}
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}
        {variant === 'bar' && <span className="hidden md:inline">{current ? EXAM_LABEL[current] : 'Tag: Mid/Sem'}</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-line bg-surface p-3 text-left shadow-pop">
          <p className="text-xs font-semibold text-ink-2">Which exam is this paper from?</p>
          <div className="mt-2 flex gap-1.5">
            {(Object.keys(EXAM_LABEL) as ExamKind[]).map((k) => (
              <button
                key={k}
                type="button"
                disabled={busy}
                onClick={() => void choose(k)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${current === k ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}
              >
                {EXAM_LABEL[k]}
              </button>
            ))}
          </div>
          <label className="mt-3 flex items-center justify-between text-xs text-ink-3">
            Year
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-8 rounded-lg border border-line bg-bg px-2 text-sm text-ink"
            >
              {Array.from({ length: 8 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}
