'use client'

import { useState } from 'react'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

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
