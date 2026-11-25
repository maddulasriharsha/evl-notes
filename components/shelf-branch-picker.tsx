'use client'

import { useState } from 'react'
import { useViewer } from '@/components/file-tools'
import { Select } from '@/components/select'
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
    <Select
      label="Branch of this member"
      value={value}
      placeholder="Branch: not set"
      className={`w-44 ${busy ? 'pointer-events-none opacity-60' : ''}`}
      options={[{ value: '', label: 'Branch: not set' }, ...options.map((o) => ({ value: o.id, label: o.short }))]}
      onChange={(v) => void change(v)}
    />
  )
}
