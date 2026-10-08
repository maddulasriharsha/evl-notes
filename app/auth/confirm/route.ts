import type { EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { deviceFromUserAgent } from '@/lib/device'
import { safeNext } from '@/lib/safe-next'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Email sign-in link target. Unlike /auth/callback it does not need the browser that asked
 * for the email, so the link also works when opened from the Gmail app or another device.
 * The Supabase "Magic Link" email template must point here (see README).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const tokenHash = url.searchParams.get('token_hash')
  const type = (url.searchParams.get('type') ?? 'email') as EmailOtpType
  const next = safeNext(url.searchParams.get('next'))
  if (tokenHash) {
    const supabase = await supabaseServer()
    const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
    if (!error) {
      const provider = data.user?.app_metadata?.provider === 'google' ? 'google' : 'email'
      await supabase.rpc('record_login', { p_method: provider, p_device: deviceFromUserAgent(request.headers.get('user-agent')) })
      return NextResponse.redirect(new URL(next, url.origin))
    }
  }
  return NextResponse.redirect(new URL(`/login?error=auth&next=${encodeURIComponent(next)}`, url.origin))
}
