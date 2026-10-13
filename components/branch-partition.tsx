'use client'

import { useEffect, useState } from 'react'
import { ChevronDown, Users } from 'lucide-react'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

export const MY_BRANCH_KEY = 'vj-branch'

export interface BranchShelf {
  key: string
  /** The uploader's branch slug; null for the admin's notes and for members who have not set one. */
  branch: string | null
  node: React.ReactNode
}

function readMyBranch(): string | null {
  try {
    return localStorage.getItem(MY_BRANCH_KEY)
  } catch {
    return null
  }
}

/**
 * Shelves of a subject that several branches share. A student sees their own branch's notes (and
 * the admin's) straight away; notes uploaded by students of other branches wait behind a
 * "Notes from other branches" partition until asked for. The student's branch is the last branch
 * page they opened (kept in this browser), so someone arriving by a direct link sees everything.
 */
export function BranchPartition({
  shelves,
  taughtIn,
  names,
}: {
  shelves: BranchShelf[]
  /** Branch slugs that teach this subject. */
  taughtIn: string[]
  /** Slug → short name, for the labels. */
  names: Record<string, string>
}) {
  const [mine, setMine] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    setMine(readMyBranch())
    setReady(true)
  }, [])

  const tagged = shelves.filter((s) => s.branch)
  const always = shelves.filter((s) => !s.branch)
  // Until the browser has told us the branch, hold back the shelves that might be partitioned.
  if (!ready) return <div className="space-y-6">{always.map((s) => <div key={s.key}>{s.node}</div>)}</div>

  const split = mine !== null && taughtIn.includes(mine)
  const own = split ? shelves.filter((s) => !s.branch || s.branch === mine) : shelves
  const others = split ? tagged.filter((s) => s.branch !== mine) : []
  const otherNames = [...new Set(others.map((s) => names[s.branch!] ?? s.branch!))]

  return (
    <div className="space-y-6">
      {own.map((s) => (
        <div key={s.key}>{s.node}</div>
      ))}
      {split && own.length === 0 && (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface/40 px-5 py-6 text-center text-sm text-ink-3">
          No notes from {names[mine!] ?? 'your branch'} students here yet.
        </p>
      )}
      {others.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface/40">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex w-full items-center gap-3 px-4 py-4 text-left sm:px-5"
          >
            <Users className="size-5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Notes from other branches</span>
              <span className="block text-sm text-ink-3">
                {otherNames.join(', ')} · {others.length} {others.length === 1 ? 'set of notes' : 'sets of notes'} for this same subject
              </span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm font-medium">
              {open ? 'Hide' : 'Show'} <ChevronDown className={`size-4 transition ${open ? 'rotate-180' : ''}`} />
            </span>
          </button>
          {open && (
            <div className="space-y-6 border-t border-line p-4 sm:p-5">
              {others.map((s) => (
                <div key={s.key}>{s.node}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Staff-only picker in a shelf's header: which branch this member's notes belong to. */
export function ShelfBranchPicker({ userId, branch, options }: { userId: string; branch: string | null; options: { id: string; short: string }[] }) {
  const viewer = useViewer()
  const [value, setValue] = useState(branch ?? '')
  const [busy, setBusy] = useState(false)
  if (viewer?.role !== 'admin' && viewer?.role !== 'moderator') return null

  async function change(next: string) {
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('staff_set_user_branch', { p_user: userId, p_branch: next || null })
    setBusy(false)
    if (error) return alert(error.message)
    setValue(next)
  }

  return (
    <select
      aria-label="Branch of this member"
      title="Branch of this member (staff only). Takes effect within a minute."
      value={value}
      disabled={busy}
      onChange={(e) => void change(e.target.value)}
      className="h-8 rounded-lg border border-line bg-bg px-2 text-xs text-ink-2"
    >
      <option value="">Branch: not set</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.short}
        </option>
      ))}
    </select>
  )
}
