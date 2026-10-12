import 'server-only'

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * "Are you a person?" check for account creation.
 *   - With TURNSTILE_SECRET_KEY + NEXT_PUBLIC_TURNSTILE_SITE_KEY set (free Cloudflare Turnstile) the
 *     visitor sees Cloudflare's widget and the token is verified with Cloudflare.
 *   - Otherwise a small arithmetic question is used. The answer is never stored: the question comes
 *     with a signed token, and the server recomputes the signature from the answer that is sent back.
 */

const TTL_MS = 10 * 60 * 1000

function secret() {
  const base = process.env.SIGNUP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET
  return base ? `vj-captcha:${base}` : ''
}

function mac(answer: string, exp: number) {
  return createHmac('sha256', secret()).update(`${answer}|${exp}`).digest('base64url')
}

export function turnstileConfigured() {
  return !!(process.env.TURNSTILE_SECRET_KEY && process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY)
}

export function newMathChallenge() {
  const a = randomInt(2, 10)
  const b = randomInt(2, 10)
  const exp = Date.now() + TTL_MS
  return { question: `What is ${a} + ${b}?`, token: `${exp}.${mac(String(a + b), exp)}` }
}

function mathIsRight(answer: string, token: string) {
  const [expRaw, tag] = token.split('.')
  const exp = Number(expRaw)
  if (!tag || !Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + TTL_MS + 60_000) return false
  const want = Buffer.from(mac(answer.trim(), exp))
  const got = Buffer.from(tag)
  return want.length === got.length && timingSafeEqual(want, got)
}

export interface HumanProof {
  answer?: unknown
  token?: unknown
  turnstile?: unknown
}

export async function humanVerified(proof: HumanProof | undefined, ip?: string): Promise<boolean> {
  if (turnstileConfigured()) {
    const response = typeof proof?.turnstile === 'string' ? proof.turnstile : ''
    if (!response) return false
    const form = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET_KEY!, response })
    if (ip && ip !== 'unknown') form.set('remoteip', ip)
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form }).catch(() => null)
    const json = res ? ((await res.json().catch(() => null)) as { success?: boolean } | null) : null
    return json?.success === true
  }
  // No signing secret on the server: the check cannot be made, so it does not block anyone.
  if (!secret()) return true
  const answer = typeof proof?.answer === 'string' ? proof.answer : ''
  const token = typeof proof?.token === 'string' ? proof.token : ''
  return answer.length > 0 && token.length > 0 && mathIsRight(answer, token)
}
