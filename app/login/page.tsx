import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/login-form'
import { LogoMark } from '@/components/logo'
import { Container } from '@/components/ui'
import { supabaseConfigured } from '@/lib/env'
import { currentUser } from '@/lib/supabase/server'
import { safeNext } from '@/lib/safe-next'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const sp = await searchParams
  const next = safeNext(typeof sp.next === 'string' ? sp.next : undefined)
  if (await currentUser()) redirect(next)
  const failed = sp.error === 'auth'

  return (
    <Container className="grid min-h-[70dvh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-pop">
        <LogoMark className="size-10" />
        <h1 className="mt-6 font-display text-3xl font-semibold tracking-tight">Sign in to upload</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-3">
          Use your college email or any personal email. Reading and downloading never needs an account.
        </p>
        {failed && (
          <p className="mt-4 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">That sign-in link has expired or was already used. Try again.</p>
        )}
        {supabaseConfigured ? (
          <LoginForm next={next} />
        ) : (
          <p className="mt-6 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold">
            Sign-in is not switched on yet. The site owner still needs to connect Supabase (see README).
          </p>
        )}
      </div>
    </Container>
  )
}
