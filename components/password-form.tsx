'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/browser'

const MIN = 8

/** Lets a signed-in person set or change their password, so next time they skip the email. */
export function PasswordForm() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < MIN) return setMsg({ ok: false, text: `Use at least ${MIN} characters.` })
    if (password !== confirm) return setMsg({ ok: false, text: 'The two passwords do not match.' })
    setBusy(true)
    setMsg(null)
    const { error } = await supabaseBrowser().auth.updateUser({ password })
    setBusy(false)
    if (error) return setMsg({ ok: false, text: error.message })
    setPassword('')
    setConfirm('')
    setMsg({ ok: true, text: 'Password saved. Next time, sign in with your email and this password.' })
  }

  const input = 'h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent'
  return (
    <form onSubmit={save} className="space-y-2">
      <p className="text-sm font-medium">Password</p>
      <p className="text-xs text-ink-3">Set one to sign in without opening your email each time.</p>
      <input type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="New password" className={input} />
      <input type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="Type it again" className={input} />
      <button type="submit" disabled={busy || !password} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-2 disabled:opacity-40">
        {busy && <Loader2 className="size-4 animate-spin" />} Save password
      </button>
      {msg && <p className={`text-sm ${msg.ok ? 'text-ok' : 'text-danger'}`}>{msg.text}</p>}
    </form>
  )
}
