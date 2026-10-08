'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/browser'

/** First-time setup (and later renames): the name shown on your notes. */
export function ProfileForm({ userId, initialName, existing }: { userId: string; initialName: string; existing: boolean }) {
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    const display_name = name.trim().replace(/\s+/g, ' ')
    if (display_name.length < 2 || display_name.length > 40) return setError('Use 2 to 40 characters.')
    setBusy(true)
    setError(null)
    const supabase = supabaseBrowser()
    const { error } = existing
      ? await supabase.from('profiles').update({ display_name }).eq('id', userId)
      : await supabase.from('profiles').insert({ id: userId, display_name })
    setBusy(false)
    if (error) return setError(error.message)
    setSaved(true)
    router.refresh()
  }

  return (
    <form onSubmit={save} className="space-y-3">
      <label className="block">
        <span className="text-sm font-medium">Your name on the site</span>
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setSaved(false)
          }}
          maxLength={40}
          required
          placeholder="e.g. Arjun K"
          className="mt-1.5 h-12 w-full rounded-xl border border-line bg-bg px-4 outline-none focus:border-accent"
        />
        <span className="mt-1.5 block text-xs text-ink-3">Shown as &ldquo;{name.trim() || 'Your name'}&rsquo;s notes&rdquo;. Your email is never shown.</span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={busy} className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-60">
          {busy && <Loader2 className="size-4 animate-spin" />} {existing ? 'Save name' : 'Continue'}
        </button>
        {saved && <span className="text-sm text-ok">Saved</span>}
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}
    </form>
  )
}
