import { NextResponse, type NextRequest } from 'next/server'
import { humanVerified, type HumanProof } from '@/lib/captcha'
import { emailCodesConfigured, newCode, sendCodeEmail, tokenFor } from '@/lib/signup-code'
import { adminConfigured } from '@/lib/supabase/admin'

/** Step 1 of sign-up: email a verification code. Answers { required: false } when codes are not set up. */

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

  const code = newCode()
  const sent = await sendCodeEmail(email, code)
  if (sent === 'quota') return NextResponse.json({ ok: false, reason: 'quota' }, { status: 503 })
  if (sent !== 'ok') return NextResponse.json({ ok: false, reason: 'send' }, { status: 502 })
  return NextResponse.json({ ok: true, required: true, token: tokenFor(email, code) })
}
