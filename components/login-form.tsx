'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Mail } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/browser'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9z" />
    </svg>
  )
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`

  async function google() {
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })
    if (error) {
      setError(error.message)
      setBusy(false)
    }
  }

  async function sendEmail(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback(), shouldCreateUser: true },
    })
    setBusy(false)
    if (error) return setError(error.message)
    setStep('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) return setError('That code did not work. Check it, or use the link in the email.')
    router.replace(next)
    router.refresh()
  }

  return (
    <div className="mt-8 space-y-5">
      <button
        type="button"
        onClick={google}
        disabled={busy}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-line-strong bg-surface font-medium transition hover:bg-surface-2 disabled:opacity-60"
      >
        <GoogleIcon /> Continue with Google
      </button>

      <div className="flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" /> or use any email <span className="h-px flex-1 bg-line" />
      </div>

      {step === 'email' ? (
        <form onSubmit={sendEmail} className="space-y-3">
          <label className="block">
            <span className="text-sm font-medium">Email</span>
            <div className="relative mt-1.5">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@vnrvjiet.in"
                className="h-12 w-full rounded-xl border border-line bg-bg pr-3 pl-10 outline-none focus:border-accent"
              />
            </div>
          </label>
          <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-medium text-bg hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <>Email me a sign-in link <ArrowRight className="size-4" /></>}
          </button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-3">
          <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
            Sent to <strong>{email}</strong>. Open the link in that email, or type the code from it here.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Code from the email"
            className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || code.length < 6} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-medium text-bg hover:opacity-90 disabled:opacity-60">
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Verify code'}
          </button>
          <button type="button" onClick={() => setStep('email')} className="w-full text-sm text-ink-3 hover:text-ink">
            Use a different email
          </button>
        </form>
      )}

      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
