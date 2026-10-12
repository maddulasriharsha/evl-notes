'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FolderInput, Loader2, X } from 'lucide-react'
import { refreshChapter } from '@/app/upload/actions'
import { allSubjects, findSubject, sectionLabel, sectionsOf, sectionTitle } from '@/lib/curriculum'
import { supabaseBrowser } from '@/lib/supabase/browser'

/**
 * Staff-only: move a note to another subject or chapter. The database re-checks the role (and only
 * lets moderators move ordinary members' notes), so hiding this button is convenience, not security.
 */
export function MoveFileButton({
  id,
  name,
  subject,
  unit,
  className,
  compact,
}: {
  id: string
  name: string
  subject: string
  unit: number
  className?: string
  /** Icon only (used on cards). */
  compact?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState(subject)
  const [target, setTarget] = useState(unit)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const subjects = useMemo(() => {
    const seen = new Map<string, { code: string; label: string }>()
    for (const { subject: s } of allSubjects()) {
      if (!seen.has(s.code)) seen.set(s.code, { code: s.code, label: `${s.short} · ${s.name}` })
    }
    return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label))
  }, [])

  const found = findSubject(code)
  const sections = found ? sectionsOf(found.subject) : []

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function chooseSubject(next: string) {
    setCode(next)
    const f = findSubject(next)
    const list = f ? sectionsOf(f.subject) : []
    setTarget(list.includes(target) ? target : (list.find((u) => u > 0) ?? list[0] ?? 0))
  }

  async function move() {
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().rpc('staff_move_file', { p_file: id, p_subject: code, p_unit: target })
    if (error) {
      setBusy(false)
      return setError(error.message)
    }
    await Promise.all([refreshChapter(subject, unit), refreshChapter(code, target)]).catch(() => undefined)
    setBusy(false)
    setOpen(false)
    router.refresh()
  }

  const same = code === subject && target === unit
  const field = 'mt-1.5 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent'

  return (
    <>
      <button
        type="button"
        aria-label="Move"
        title="Move to another subject or chapter"
        onClick={() => setOpen(true)}
        className={
          className ??
          (compact
            ? 'grid size-8 place-items-center rounded-lg bg-bg/90 text-ink-2 shadow-card backdrop-blur hover:text-ink'
            : 'inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-medium whitespace-nowrap hover:bg-surface-2')
        }
      >
        <FolderInput className="size-4" />
        {!compact && <span>Move</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label="Move note">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 shadow-pop">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold">Move this note</h2>
                <p className="mt-0.5 truncate text-sm text-ink-3">{name}</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>

            <label className="mt-5 block text-sm font-medium">
              Subject
              <select value={code} onChange={(e) => chooseSubject(e.target.value)} className={field}>
                {subjects.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block text-sm font-medium">
              Chapter or section
              <select value={target} onChange={(e) => setTarget(Number(e.target.value))} className={field}>
                {found &&
                  sections.map((u) => (
                    <option key={u} value={u}>
                      {sectionLabel(u)} · {sectionTitle(found.subject, u)}
                    </option>
                  ))}
              </select>
            </label>

            <p className="mt-3 text-xs text-ink-3">
              The note stays with the same uploader and keeps its comments, helpful votes and saves. Only where it appears changes.
            </p>
            {error && <p className="mt-3 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-line px-4 text-sm font-medium hover:border-line-strong">
                Cancel
              </button>
              <button
                type="button"
                onClick={move}
                disabled={busy || same}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50"
              >
                {busy && <Loader2 className="size-4 animate-spin" />} Move here
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
