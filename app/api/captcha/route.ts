import { NextResponse } from 'next/server'
import { newMathChallenge, turnstileConfigured } from '@/lib/captcha'

export const dynamic = 'force-dynamic'

/** Hands the sign-up form what it needs for its "are you a person?" check. */
export async function GET() {
  if (turnstileConfigured()) {
    return NextResponse.json({ mode: 'turnstile', siteKey: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY })
  }
  return NextResponse.json({ mode: 'math', ...newMathChallenge() })
}
