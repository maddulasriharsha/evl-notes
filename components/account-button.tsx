'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { UserRound } from 'lucide-react'
import { supabaseConfigured } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

/** Client-side so public pages stay cacheable; reads the session from the browser. */
export function AccountButton() {
  const [state, setState] = useState<'unknown' | 'in' | 'out'>('unknown')
  const [initial, setInitial] = useState<string>('')

  useEffect(() => {
    if (!supabaseConfigured) {
      setState('out')
      return
    }
    const supabase = supabaseBrowser()
    const apply = (session: { user: { email?: string; user_metadata?: Record<string, unknown> } } | null) => {
      if (!session) return setState('out')
      const name = String(session.user.user_metadata?.full_name ?? session.user.email ?? '?')
      setInitial(name.trim().charAt(0).toUpperCase())
      setState('in')
    }
    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => apply(session))
    return () => data.subscription.unsubscribe()
  }, [])

  if (state === 'in') {
    return (
      <Link href="/me" className="grid size-10 place-items-center rounded-xl bg-accent-soft font-semibold text-accent" aria-label="My notes">
        {initial || <UserRound className="size-4" />}
      </Link>
    )
  }
  return (
    <Link
      href="/login"
      className={`hidden h-10 items-center rounded-xl border border-line bg-surface px-3.5 text-sm font-medium whitespace-nowrap hover:border-line-strong sm:inline-flex ${state === 'unknown' ? 'invisible' : ''}`}
    >
      Sign in
    </Link>
  )
}
