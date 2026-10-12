'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Eye, EyeOff, KeyRound, Loader2, Mail } from 'lucide-react'
import { deviceFromUserAgent } from '@/lib/device'
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

type Mode = 'signin' | 'signup' | 'link' | 'code'

const MIN_PASSWORD = 8

/** Turns the raw sign-up error into something a student can act on. */
function authMessage(raw: string): string {
  if (/registered|exists/i.test(raw)) return 'That email already has an account. Sign in instead.'
  if (/rate limit|too many|seconds/i.test(raw)) {
    return 'Too many people are signing up right now, so the email could not be sent. Please use “Continue with Google”, or try again in a few minutes.'
  }
  if (/invalid.*email|unable to validate/i.test(raw)) return 'That email address does not look right. Check it and try again.'
  if (/password/i.test(raw)) return `Choose a stronger password (at least ${MIN_PASSWORD} characters).`
  return raw
}

export function LoginForm({ next }: { next: string }) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const callback = () => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`
  const done = async (method: 'password' | 'email') => {
    await supabaseBrowser()
      .rpc('record_login', { p_method: method, p_device: deviceFromUserAgent(navigator.userAgent) })
      .then(() => undefined, () => undefined)
    router.replace(next)
    router.refresh()
  }
  const switchTo = (m: Mode) => {
    setMode(m)
    setError(null)
    setInfo(null)
  }

  async function google() {
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.signInWithOAuth({ provider: 'google', options: { redirectTo: callback() } })
    if (error) {
      setError(/not enabled/i.test(error.message) ? 'Google sign-in is not switched on yet. Use email and password for now.' : error.message)
      setBusy(false)
    }
  }

  async function withPassword(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    if (mode === 'signup' && password.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`)
    setBusy(true)
    const supabase = supabaseBrowser()
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setBusy(false)
      if (!error) return done('password')
      if (/confirm/i.test(error.message)) return setError('Confirm your email first: open the link we sent when you created the account.')
      return setError('Wrong email or password. If you used to sign in with an email link, use that once and set a password on “My notes”.')
    }
    // Create the account on the server without an email, then sign in with the same password.
    const res = await fetch('/api/signup', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password, website: '' }),
    }).catch(() => null)
    if (res && res.ok) {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      setBusy(false)
      if (error) {
        setMode('signin')
        return setInfo('Account created. Now sign in with your email and password.')
      }
      return done('password')
    }
    if (res && res.status !== 501) {
      const reason = ((await res.json().catch(() => ({}))) as { reason?: string }).reason
      setBusy(false)
      if (reason === 'exists') return setError('That email already has an account. Sign in instead.')
      if (reason === 'email') return setError('That email address does not look right. Check it and try again.')
      if (reason === 'password') return setError(`Choose a stronger password (at least ${MIN_PASSWORD} characters).`)
      if (reason === 'busy') return setError('Too many sign-ups from this network right now. Wait a few minutes and try again.')
      return setError('Could not create the account. Please try again.')
    }
    // The server route is not available: fall back to the normal email-confirmation sign-up.
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: callback() } })
    setBusy(false)
    if (error) return setError(authMessage(error.message))
    if (data.session) return done('password')
    setInfo('Account created. Open the confirmation link we just emailed you (only needed once), then sign in with your password.')
    setMode('signin')
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callback(), shouldCreateUser: true },
    })
    setBusy(false)
    if (error) return setError(authMessage(error.message))
    setMode('code')
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
    setBusy(false)
    if (error) return setError('That code did not work. Check it, or use the link in the email.')
    await done('email')
  }

  const emailField = (
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
  )

  const primary = 'flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-ink font-medium text-bg hover:opacity-90 disabled:opacity-60'

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

      {(mode === 'signin' || mode === 'signup') && (
        <>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm font-medium">
            {(['signin', 'signup'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => switchTo(m)}
                className={`h-9 rounded-lg ${mode === m ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'}`}
              >
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          <form onSubmit={withPassword} className="space-y-3">
            {emailField}
            <label className="block">
              <span className="text-sm font-medium">Password</span>
              <div className="relative mt-1.5">
                <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  type={show ? 'text' : 'password'}
                  required
                  minLength={mode === 'signup' ? MIN_PASSWORD : undefined}
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
                  className="h-12 w-full rounded-xl border border-line bg-bg pr-11 pl-10 outline-none focus:border-accent"
                />
                <button
                  type="button"
                  onClick={() => setShow((s) => !s)}
                  aria-label={show ? 'Hide password' : 'Show password'}
                  className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-lg text-ink-3 hover:text-ink"
                >
                  {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </label>
            <button type="submit" disabled={busy} className={primary}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <>{mode === 'signin' ? 'Sign in' : 'Create account'} <ArrowRight className="size-4" /></>}
            </button>
          </form>
          <button type="button" onClick={() => switchTo('link')} className="w-full text-sm text-ink-3 hover:text-ink">
            Forgot password, or no password yet? Email me a sign-in link
          </button>
        </>
      )}

      {mode === 'link' && (
        <form onSubmit={sendLink} className="space-y-3">
          {emailField}
          <button type="submit" disabled={busy} className={primary}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <>Email me a sign-in link <ArrowRight className="size-4" /></>}
          </button>
          <p className="text-xs text-ink-3">After signing in you can set a new password on &ldquo;My notes&rdquo;.</p>
          <button type="button" onClick={() => switchTo('signin')} className="w-full text-sm text-ink-3 hover:text-ink">
            Back to password sign-in
          </button>
        </form>
      )}

      {mode === 'code' && (
        <form onSubmit={verify} className="space-y-3">
          <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
            Sent to <strong>{email}</strong>. Open the link in that email on this device, or type the code from it here.
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))}
            placeholder="Code from the email"
            className="h-12 w-full rounded-xl border border-line bg-bg px-4 text-center font-mono text-lg tracking-[0.3em] outline-none focus:border-accent"
          />
          <button type="submit" disabled={busy || code.length < 6} className={primary}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : 'Verify code'}
          </button>
          <button type="button" onClick={() => switchTo('signin')} className="w-full text-sm text-ink-3 hover:text-ink">
            Back to password sign-in
          </button>
        </form>
      )}

      {info && <p className="rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">{info}</p>}
      {error && <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
    </div>
  )
}
