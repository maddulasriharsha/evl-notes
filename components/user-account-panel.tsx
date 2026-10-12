'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, KeyRound, Loader2, Mail, UserRound } from 'lucide-react'

type Action = 'set_password' | 'set_name' | 'set_email'

/** Admin-only account tools for one person: new password, display name, email address. */
export function UserAccountPanel({ userId, name, email, isAdminAccount }: { userId: string; name: string; email: string; isAdminAccount: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Action | null>(null)
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [newName, setNewName] = useState(name)
  const [newEmail, setNewEmail] = useState(email)
  const [password, setPassword] = useState('')
  const [issued, setIssued] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  async function call(action: Action, extra: Record<string, string>) {
    setBusy(action)
    setMessage(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, action, ...extra }),
    }).catch(() => null)
    const json = res ? ((await res.json().catch(() => null)) as { ok?: boolean; error?: string; password?: string } | null) : null
    setBusy(null)
    if (!json?.ok) {
      setMessage({ ok: false, text: json?.error ?? 'Could not reach the server.' })
      return null
    }
    router.refresh()
    return json
  }

  async function setPassword_(generate: boolean) {
    const json = await call('set_password', generate ? {} : { password })
    if (!json) return
    setIssued(json.password ?? null)
    setPassword('')
    setCopied(false)
    setMessage({ ok: true, text: 'Password changed. Pass the new password to the student; they can change it again on “My notes”.' })
  }

  const field = 'h-10 min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent'
  const btn = 'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50'
  const ghost = 'inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:border-line-strong disabled:opacity-50'

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <h2 className="font-semibold">Account tools</h2>
      <p className="mt-1 text-sm text-ink-3">
        Passwords are stored as one-way hashes, so nobody (not even you or the database owner) can read one. If a student forgets theirs,
        set a new one here and send it to them.
      </p>

      <div className="mt-4 space-y-4">
        <div>
          <label className="text-sm font-medium" htmlFor="acct-name">
            Display name
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input id="acct-name" value={newName} onChange={(e) => setNewName(e.target.value.slice(0, 60))} className={field} />
            <button type="button" disabled={busy !== null || newName.trim() === name || newName.trim().length < 2} onClick={() => call('set_name', { name: newName })} className={ghost}>
              {busy === 'set_name' ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />} Save name
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="acct-email">
            Email address
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input id="acct-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className={field} />
            <button
              type="button"
              disabled={busy !== null || newEmail.trim().toLowerCase() === email.toLowerCase()}
              onClick={() => confirm('Change this person’s sign-in email? They will use the new address from now on.') && call('set_email', { email: newEmail })}
              className={ghost}
            >
              {busy === 'set_email' ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />} Save email
            </button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="acct-pass">
            New password
          </label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <input
              id="acct-pass"
              type="text"
              autoComplete="off"
              value={password}
              onChange={(e) => setPassword(e.target.value.slice(0, 100))}
              placeholder="Type one (8+ characters) or generate"
              className={field}
            />
            <button type="button" disabled={busy !== null || password.length < 8} onClick={() => setPassword_(false)} className={btn}>
              {busy === 'set_password' ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />} Set password
            </button>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => confirm('Generate a new random password for this person? Their old password will stop working.') && setPassword_(true)}
              className={ghost}
            >
              Generate one
            </button>
          </div>
          {isAdminAccount && <p className="mt-1.5 text-xs text-ink-3">This is an admin account; only that admin can change it.</p>}
        </div>

        {issued && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3">
            <span className="text-sm">New password:</span>
            <code className="rounded-lg bg-bg px-3 py-1.5 font-mono text-base font-semibold tracking-wider">{issued}</code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(issued)
                  setCopied(true)
                } catch {
                  window.prompt('Copy the password', issued)
                }
              }}
              className={ghost}
            >
              {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy'}
            </button>
            <span className="w-full text-xs text-ink-3">Shown only now. It is not saved anywhere on the site.</span>
          </div>
        )}

        {message && (
          <p className={`rounded-xl px-3 py-2 text-sm ${message.ok ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger'}`}>{message.text}</p>
        )}
      </div>
    </section>
  )
}
