'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Tags } from 'lucide-react'
import { EDITION_LABEL, STYLE_LABEL, type Edition, type Style } from '@/components/label-badges'

/**
 * The "Labels" button on a note: Typed or Handwritten (the uploader and staff), and R25 or Old
 * syllabus (staff only). `save` stores the new pair; the database checks who may change what.
 */
export function LabelMenu({
  style,
  edition,
  canEdition,
  save,
  variant,
}: {
  style?: Style | null
  edition?: Edition | null
  canEdition: boolean
  save: (style: Style | null, edition: Edition | null) => Promise<void>
  variant: 'card' | 'bar'
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState<{ style: Style | null; edition: Edition | null }>({ style: style ?? null, edition: edition ?? null })
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const off = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', off)
    return () => document.removeEventListener('pointerdown', off)
  }, [open])

  async function change(next: { style: Style | null; edition: Edition | null }) {
    setBusy(true)
    try {
      await save(next.style, next.edition)
      setNow(next)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not save')
    }
    setBusy(false)
  }

  const set = !!(now.style || now.edition)
  const trigger =
    variant === 'card'
      ? `grid size-8 place-items-center rounded-lg shadow-card backdrop-blur ${set ? 'bg-accent text-accent-ink' : 'bg-bg/90 text-ink-2 hover:text-ink'}`
      : `inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium ${set ? 'border-accent bg-accent-soft text-accent' : 'border-line hover:bg-surface-2'}`

  const pill = (on: boolean) => `flex-1 rounded-lg border px-2 py-1.5 text-sm font-medium ${on ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`

  return (
    <div ref={box} className="relative">
      <button type="button" aria-label="Labels: typed or handwritten, R25 or old" title="Labels" aria-expanded={open} disabled={busy} onClick={() => setOpen((o) => !o)} className={trigger}>
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Tags className="size-4" />}
        {variant === 'bar' && <span className="hidden md:inline">Labels</span>}
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-60 rounded-xl border border-line bg-surface p-3 text-left shadow-pop">
          <p className="text-xs font-semibold text-ink-2">How were these notes made?</p>
          <div className="mt-2 flex gap-1.5">
            {(Object.keys(STYLE_LABEL) as Style[]).map((k) => (
              <button key={k} type="button" disabled={busy} onClick={() => void change({ ...now, style: now.style === k ? null : k })} className={pill(now.style === k)}>
                {STYLE_LABEL[k]}
              </button>
            ))}
          </div>
          {canEdition && (
            <>
              <p className="mt-3 text-xs font-semibold text-ink-2">Which syllabus?</p>
              <div className="mt-2 flex gap-1.5">
                {(Object.keys(EDITION_LABEL) as Edition[]).map((k) => (
                  <button key={k} type="button" disabled={busy} onClick={() => void change({ ...now, edition: now.edition === k ? null : k })} className={pill(now.edition === k)}>
                    {EDITION_LABEL[k]}
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="mt-2 text-[11px] text-ink-3">Tap a choice again to clear it.</p>
        </div>
      )}
    </div>
  )
}
