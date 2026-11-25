'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface Option<T extends string | number> {
  value: T
  label: string
  /** A quieter second line (for example the full branch name). */
  hint?: string
}

/**
 * A dropdown in the site's own look, replacing the browser's plain <select> list (which cannot be
 * styled). Keyboard: Enter/Space/arrows open it, arrows move, Enter picks, Esc closes, and typing
 * a letter jumps to the matching option. The list is a real listbox for screen readers.
 */
export function Select<T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Select…',
  label,
  className = '',
  align = 'left',
}: {
  value: T | ''
  onChange: (v: T) => void
  options: Option<T>[]
  placeholder?: string
  label: string
  className?: string
  align?: 'left' | 'right'
}) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const typed = useRef({ text: '', at: 0 })
  const id = useId()
  const selected = options.findIndex((o) => o.value === value)
  const current = selected >= 0 ? options[selected] : null

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  // Keep the highlighted option in view.
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  function show() {
    setActive(selected >= 0 ? selected : 0)
    setOpen(true)
  }
  function pick(i: number) {
    const o = options[i]
    if (o) onChange(o.value)
    setOpen(false)
    root.current?.querySelector('button')?.focus()
  }
  function key(e: React.KeyboardEvent) {
    if (!open) {
      if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
        e.preventDefault()
        show()
      }
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(options.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      setActive(e.key === 'Home' ? 0 : options.length - 1)
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick(active)
    } else if (e.key === 'Tab') {
      setOpen(false)
    } else if (e.key.length === 1) {
      const now = Date.now()
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : '') + e.key.toLowerCase(), at: now }
      const hit = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text))
      if (hit >= 0) setActive(hit)
    }
  }

  return (
    <div ref={root} className={`relative ${className}`} onKeyDown={key}>
      <button
        type="button"
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? setOpen(false) : show())}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-xl border bg-bg/70 px-3 text-left text-sm font-medium backdrop-blur transition hover:border-line-strong focus-visible:outline-2 focus-visible:outline-accent ${
          open ? 'border-accent shadow-[0_0_0_3px_rgb(139_92_246/0.15)]' : 'border-line'
        }`}
      >
        <span className={`truncate ${current ? 'font-semibold text-ink' : 'text-ink-2'}`}>{current ? current.label : placeholder}</span>
        <ChevronDown className={`size-4 shrink-0 text-ink-3 transition duration-200 ${open ? 'rotate-180 text-accent' : ''}`} />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          aria-label={label}
          className={`select-pop absolute top-full z-50 mt-2 max-h-72 w-max min-w-full max-w-[min(92vw,24rem)] overflow-y-auto rounded-xl border border-line-strong bg-surface p-1.5 shadow-[0_18px_48px_-12px_rgba(0,0,0,0.9),0_0_0_1px_rgb(139_92_246/0.18)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {options.map((o, i) => {
            const on = i === selected
            return (
              <li
                key={String(o.value)}
                role="option"
                aria-selected={on}
                onPointerEnter={() => setActive(i)}
                onClick={() => pick(i)}
                className={`flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-ink transition-colors ${
                  i === active ? 'bg-accent text-accent-ink' : on ? 'bg-accent-soft' : ''
                } ${on ? 'font-semibold' : ''}`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{o.label}</span>
                  {o.hint && <span className={`block truncate text-xs font-normal ${i === active ? 'opacity-80' : 'text-ink-2'}`}>{o.hint}</span>}
                </span>
                {on && <Check className={`size-4 shrink-0 ${i === active ? '' : 'text-accent'}`} />}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
