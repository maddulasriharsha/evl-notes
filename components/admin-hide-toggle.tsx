'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { refreshChapter } from '@/app/upload/actions'
import { supabaseBrowser } from '@/lib/supabase/browser'

export function AdminHideToggle({ id, hidden, subject, unit }: { id: string; hidden: boolean; subject: string; unit: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function toggle() {
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('set_collection_hidden', { p_collection: id, p_hidden: !hidden })
    if (!error) await refreshChapter(subject, unit)
    setBusy(false)
    if (error) return alert(error.message)
    router.refresh()
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium ${hidden ? 'bg-ink text-bg' : 'border border-line hover:bg-surface-2'}`}>
      {busy && <Loader2 className="size-3.5 animate-spin" />} {hidden ? 'Show again' : 'Hide'}
    </button>
  )
}
