'use client'

import { useEffect, useState } from 'react'
import { GraduationCap, X } from 'lucide-react'
import { Select } from '@/components/select'

const SEMS = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * Asks a first-time visitor for their branch and semester once. The answer stays in this browser
 * (never sent anywhere) and is used to mark their branch on the home page and to limit Ctrl+K
 * results to their own subjects. Closing it means "ask me later" is never shown again.
 */
export function BranchPrompt({ branches }: { branches: { id: string; short: string; name: string }[] }) {
  const [open, setOpen] = useState(false)
  const [branch, setBranch] = useState('')
  const [sem, setSem] = useState(0)

  useEffect(() => {
    try {
      if (!localStorage.getItem('vj-branch') && !localStorage.getItem('vj-asked')) setOpen(true)
    } catch {
      /* no storage: do not nag */
    }
  }, [])

  function close() {
    try {
      localStorage.setItem('vj-asked', '1')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  function save() {
    try {
      localStorage.setItem('vj-branch', branch)
      if (sem) localStorage.setItem('vj-sem', String(sem))
      localStorage.removeItem('vj-all')
      localStorage.setItem('vj-asked', '1')
      document.querySelector(`.branch-card[data-branch="${CSS.escape(branch)}"]`)?.setAttribute('data-mine', '')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  if (!open) return null
  return (
    <section aria-label="Pick your branch" className="mt-8 rounded-2xl border border-accent/40 bg-accent-soft p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-bg text-accent">
          <GraduationCap className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Which branch and semester are you in?</p>
          <p className="mt-0.5 text-sm text-ink-2">We remember it on this device so search shows your subjects first. You can still browse everything.</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select
              value={branch}
              onChange={setBranch}
              label="Branch"
              placeholder="Branch…"
              className="w-full sm:w-72"
              options={branches.map((b) => ({ value: b.id, label: b.short, hint: b.name }))}
            />
            <Select
              value={sem || ''}
              onChange={setSem}
              label="Semester"
              placeholder="Semester…"
              className="w-40"
              options={SEMS.map((s) => ({ value: s, label: `Semester ${s}` }))}
            />
            <button type="button" disabled={!branch} onClick={save} className="btn-primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">
              Save
            </button>
          </div>
        </div>
        <button type="button" onClick={close} aria-label="Not now" title="Not now" className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-3 hover:text-ink">
          <X className="size-4" />
        </button>
      </div>
    </section>
  )
}
