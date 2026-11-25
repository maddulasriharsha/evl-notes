import { NextResponse, type NextRequest } from 'next/server'
import { humanVerified, type HumanProof } from '@/lib/captcha'
import { emailCodesConfigured, sendCodeEmail } from '@/lib/signup-code'
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Step 1 of "Forgot password": email a one-time code through Brevo. Supabase makes the code (a
 * recovery one-time password, valid once); we only deliver it, so Supabase's own 2-emails-an-hour
 * mail limit never applies. Step 2 happens in the browser: verifyOtp(type: 'recovery') signs the
 * person in, then they choose a new password.
 *
 * The answer never says whether an account exists for the address (no one can probe for members).
 * Answers { required: false } when Brevo is not set up, so the form can fall back to "write to us".
 */

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const WINDOW_MS = 10 * 60 * 1000
const hits = new Map<string, number[]>()

function throttled(key: string, max: number) {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(key, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > max
}

export async function POST(request: NextRequest) {
  if (!adminConfigured() || !emailCodesConfigured()) return NextResponse.json({ ok: true, required: false })

  let body: { email?: unknown; proof?: HumanProof }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })
  }
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, reason: 'email' }, { status: 400 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!(await humanVerified(body.proof, ip))) return NextResponse.json({ ok: false, reason: 'human' }, { status: 400 })
  // Few codes per address (stops mail-bombing someone), generous per network (a class shares one Wi-Fi).
  if (throttled(`e:${email}`, 3) || throttled(`i:${ip}`, 60)) return NextResponse.json({ ok: false, reason: 'busy' }, { status: 429 })

  // Asks Supabase for a recovery code without letting it send any email. Unknown address: error, and we say nothing.
  const { data, error } = await supabaseAdmin().auth.admin.generateLink({ type: 'recovery', email })
  const otp = data?.properties?.email_otp
  if (!error && otp) {
    const sent = await sendCodeEmail(email, otp, 'reset')
    if (sent === 'quota') return NextResponse.json({ ok: false, reason: 'quota' }, { status: 503 })
    if (sent !== 'ok') return NextResponse.json({ ok: false, reason: 'send' }, { status: 502 })
  }
  return NextResponse.json({ ok: true, required: true })
}
