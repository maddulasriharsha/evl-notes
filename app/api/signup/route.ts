import { NextResponse, type NextRequest } from 'next/server'
import { humanVerified, type HumanProof } from '@/lib/captcha'
import { codeIsValid, emailCodesConfigured } from '@/lib/signup-code'
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Creates an email + password account as already confirmed, without Supabase's own confirmation email.
 * If email codes are configured (lib/signup-code.ts) the caller must also send the code that was emailed
 * to them; otherwise no verification is possible and the address is taken as given.
 *
 * Why: Supabase's built-in email sender allows only a couple of emails per hour for the whole
 * project, so most students could not create an account. This route creates the account as already
 * confirmed; the browser then signs in with the same password. The email address is therefore not
 * verified, which is acceptable for a public class-notes site (accounts only unlock uploading and
 * commenting, and staff can block anyone).
 *
 * It only ever creates a user: it cannot read or change anyone else's data.
 */

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/
const MIN_PASSWORD = 8

// Light per-instance throttle against scripts. Generous, because a whole class shares one Wi-Fi address.
const WINDOW_MS = 10 * 60 * 1000
const MAX_PER_WINDOW = 40
const hits = new Map<string, number[]>()

function tooMany(ip: string) {
  const now = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS)
  recent.push(now)
  hits.set(ip, recent)
  if (hits.size > 5000) hits.clear()
  return recent.length > MAX_PER_WINDOW
}

export async function POST(request: NextRequest) {
  if (!adminConfigured()) return NextResponse.json({ ok: false, reason: 'unavailable' }, { status: 501 })

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (tooMany(ip)) return NextResponse.json({ ok: false, reason: 'busy' }, { status: 429 })

  let body: { email?: unknown; password?: unknown; website?: unknown; code?: unknown; token?: unknown; proof?: HumanProof }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })
  }
  // Hidden field that real people leave empty.
  if (typeof body.website === 'string' && body.website.length > 0) return NextResponse.json({ ok: true })

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!EMAIL.test(email)) return NextResponse.json({ ok: false, reason: 'email' }, { status: 400 })
  if (password.length < MIN_PASSWORD || password.length > 200) return NextResponse.json({ ok: false, reason: 'password' }, { status: 400 })

  // When email codes are set up, the person must prove they own the address first.
  if (emailCodesConfigured()) {
    const code = typeof body.code === 'string' ? body.code.trim() : ''
    const token = typeof body.token === 'string' ? body.token : ''
    if (!codeIsValid(email, code, token)) return NextResponse.json({ ok: false, reason: 'code' }, { status: 400 })
  } else if (!(await humanVerified(body.proof, ip))) {
    // No email step, so the "are you a person?" check is what stands between a script and an account.
    return NextResponse.json({ ok: false, reason: 'human' }, { status: 400 })
  }

  const { error } = await supabaseAdmin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) {
    if (/registered|exists|duplicate/i.test(error.message)) return NextResponse.json({ ok: false, reason: 'exists' }, { status: 409 })
    if (/password/i.test(error.message)) return NextResponse.json({ ok: false, reason: 'password' }, { status: 400 })
    return NextResponse.json({ ok: false, reason: 'failed' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
