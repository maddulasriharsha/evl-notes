'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck } from 'lucide-react'

export interface HumanProof {
  answer?: string
  token?: string
  turnstile?: string
}

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, o: { sitekey: string; callback: (t: string) => void; 'expired-callback': () => void; theme?: string }) => string
      reset: (id?: string) => void
    }
  }
}

type Setup = { mode: 'math'; question: string; token: string } | { mode: 'turnstile'; siteKey: string } | null

/**
 * "I am not a robot" box for account creation. Cloudflare Turnstile when the site is configured for
 * it, otherwise a one-line sum. `resetKey` changes after a failed attempt to get a fresh challenge.
 */
export function HumanCheck({ onChange, resetKey }: { onChange: (p: HumanProof) => void; resetKey: number }) {
  const [setup, setSetup] = useState<Setup>(null)
  const [answer, setAnswer] = useState('')
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    setAnswer('')
    onChange({})
    fetch('/api/captcha', { cache: 'no-store' })
      .then((r) => r.json())
      .then((s: Setup) => live && setSetup(s))
      .catch(() => live && setSetup(null))
    return () => {
      live = false
    }
    // onChange is a state setter from the parent; resetKey is the only trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  useEffect(() => {
    if (!setup || setup.mode !== 'turnstile' || !box.current) return
    const el = box.current
    let cancelled = false
    const draw = () => {
      if (cancelled || !window.turnstile) return
      el.innerHTML = ''
      window.turnstile.render(el, {
        sitekey: setup.siteKey,
        theme: 'auto',
        callback: (t) => onChange({ turnstile: t }),
        'expired-callback': () => onChange({}),
      })
    }
    if (window.turnstile) draw()
    else {
      const s = document.createElement('script')
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      s.async = true
      s.onload = draw
      document.head.appendChild(s)
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setup])

  if (!setup) return null

  if (setup.mode === 'turnstile') return <div ref={box} className="flex justify-center" />

  return (
    <label className="block rounded-xl border border-line bg-surface-2 p-3">
      <span className="flex items-center gap-2 text-sm font-medium">
        <ShieldCheck className="size-4 text-ink-3" /> Quick check you are a person: {setup.question}
      </span>
      <input
        inputMode="numeric"
        autoComplete="off"
        value={answer}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '').slice(0, 3)
          setAnswer(v)
          onChange(v ? { answer: v, token: setup.token } : {})
        }}
        placeholder="Your answer"
        aria-label="Answer to the check question"
        className="mt-2 h-11 w-full rounded-lg border border-line bg-bg px-3 text-sm outline-none focus:border-accent"
      />
    </label>
  )
}
