import { NextResponse, type NextRequest } from 'next/server'
import { deviceFromUserAgent } from '@/lib/device'
import { safeNext } from '@/lib/safe-next'
import { supabaseServer } from '@/lib/supabase/server'

/** Finishes Google and email-link sign-in, then returns to where the person was going. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = safeNext(url.searchParams.get('next'))
  if (code) {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      const provider = data.user?.app_metadata?.provider === 'google' ? 'google' : 'email'
      await supabase.rpc('record_login', { p_method: provider, p_device: deviceFromUserAgent(request.headers.get('user-agent')) })
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }
  return NextResponse.redirect(new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, url.origin))
}
