'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, Loader2, Lock, ShieldAlert, Wrench } from 'lucide-react'
import { setMaintenance } from '@/app/admin/maintenance-actions'
import { timeAgo } from '@/lib/format'

/** Admin tab: put the whole site into maintenance mode (everyone but admins sees only the maintenance page). */
export function MaintenancePanel({ initial, ready }: { initial: { on: boolean; message?: string; back?: string; since?: string }; ready: boolean }) {
  const router = useRouter()
  const [message, setMessage] = useState(initial.message ?? '')
  const [back, setBack] = useState(initial.back ?? '')
  const [password, setPassword] = useState('')
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const on = initial.on

  function run(next: boolean) {
    setError(null)
    start(async () => {
      const res = await setMaintenance({ on: next, message, back, password: next ? password : undefined })
      if (!res.ok) return setError(res.error)
      setPassword('')
      setArmed(false)
      router.refresh()
    })
  }

  return (
    <div className="max-w-2xl space-y-5">
      <div className={`rounded-2xl border p-5 shadow-card ${on ? 'border-danger bg-danger-soft/40' : 'border-line bg-surface'}`}>
        <div className="flex items-center gap-3">
          <span className={`grid size-11 place-items-center rounded-xl ${on ? 'bg-danger text-white' : 'bg-accent-soft text-accent'}`}>
            <Wrench className={`size-5 ${on ? 'animate-pulse' : ''}`} />
          </span>
          <div>
            <h2 className="font-semibold">Maintenance mode is {on ? 'ON' : 'off'}</h2>
            <p className="text-sm text-ink-2">
              {on
                ? `Visitors only see the maintenance page${initial.since ? ` (since ${timeAgo(initial.since)})` : ''}. You still have full access as an admin.`
                : 'The site is open to everyone.'}
            </p>
          </div>
        </div>
      </div>

      {!ready && (
        <p className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-2">
          Run <code className="rounded bg-bg px-1">run-this-site-settings.sql</code> in the Supabase SQL editor once, then reload this page.
        </p>
      )}

      <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <label className="block text-sm font-medium" htmlFor="mt-msg">
          What visitors will read
        </label>
        <textarea
          id="mt-msg"
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, 300))}
          rows={3}
          placeholder="We are tuning the machine room. Notes will be back shortly."
          className="mt-1.5 w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <label className="mt-3 block text-sm font-medium" htmlFor="mt-back">
          Expected back <span className="font-normal text-ink-3">(optional)</span>
        </label>
        <input
          id="mt-back"
          value={back}
          onChange={(e) => setBack(e.target.value.slice(0, 80))}
          placeholder="e.g. around 6 PM today"
          className="mt-1.5 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
        />

        {!on && armed && (
          <div className="mt-4 rounded-xl border border-gold/50 bg-gold-soft p-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldAlert className="size-4 text-gold" /> Confirm with your password
            </p>
            <p className="mt-1 text-xs text-ink-2">Everyone except admins will be locked out of the whole site until you switch this off.</p>
            <div className="relative mt-3">
              <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && password && !pending && run(true)}
                placeholder="Your admin password"
                aria-label="Your password"
                autoFocus
                className="h-11 w-full rounded-xl border border-line bg-bg pr-3 pl-9 text-sm outline-none focus:border-accent"
              />
            </div>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {on ? (
            <button
              onClick={() => run(false)}
              disabled={pending}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ok px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending && <Loader2 className="size-4 animate-spin" />} Switch maintenance off
            </button>
          ) : armed ? (
            <>
              <button
                onClick={() => run(true)}
                disabled={pending || !password}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
              >
                {pending && <Loader2 className="size-4 animate-spin" />} Confirm and lock the site
              </button>
              <button onClick={() => { setArmed(false); setPassword(''); setError(null) }} className="h-11 rounded-xl px-3 text-sm text-ink-2 hover:text-ink">
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setArmed(true)}
              disabled={!ready}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40"
            >
              <Wrench className="size-4" /> Turn on maintenance mode…
            </button>
          )}
          <a href="/maintenance?preview=1" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink-2 hover:text-ink">
            <Eye className="size-4" /> Preview the page
          </a>
        </div>
        <p className="mt-3 text-xs text-ink-3">
          Takes effect within a few seconds. Sign-in, this admin area, health checks and the daily backup keep working. Admins browse the site normally; everyone else, including moderators, only sees the maintenance page.
        </p>
      </div>
    </div>
  )
}
