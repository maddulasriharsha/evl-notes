import 'server-only'

import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'

/**
 * Email verification for new accounts, with no database: the server emails a 6-digit code and hands
 * the browser a signed token that commits to (email, expiry, code). To verify, the browser sends the
 * code back with the token and the server recomputes the signature. Only the person who received
 * the email knows the code, and the token alone reveals nothing usable.
 */

export const CODE_TTL_MS = 10 * 60 * 1000

function signingSecret() {
  const base = process.env.SIGNUP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.CRON_SECRET
  return base ? `vj-signup-code:${base}` : ''
}

/** True once an email provider is configured. Without it sign-up falls back to "no email needed". */
export function emailCodesConfigured() {
  return !!(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL && signingSecret())
}

function sign(email: string, exp: number, code: string) {
  return createHmac('sha256', signingSecret()).update(`${email}|${exp}|${code}`).digest('base64url')
}

export function newCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0')
}

/** A token the browser keeps while the person reads their email. */
export function tokenFor(email: string, code: string) {
  const exp = Date.now() + CODE_TTL_MS
  return `${exp}.${sign(email, exp, code)}`
}

export function codeIsValid(email: string, code: string, token: string) {
  const [expRaw, mac] = token.split('.')
  const exp = Number(expRaw)
  if (!mac || !Number.isFinite(exp) || exp < Date.now() || exp > Date.now() + CODE_TTL_MS + 60_000) return false
  if (!/^\d{6}$/.test(code)) return false
  const want = Buffer.from(sign(email, exp, code))
  const got = Buffer.from(mac)
  return want.length === got.length && timingSafeEqual(want, got)
}

/** 'ok', 'quota' (the free daily limit is used up) or 'failed'. */
export type SendResult = 'ok' | 'quota' | 'failed'

/** Sends the code through Brevo's HTTP API (free: 300 emails a day). */
export async function sendCodeEmail(to: string, code: string): Promise<SendResult> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': process.env.BREVO_API_KEY!, 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender: { name: 'VJNOTES', email: process.env.BREVO_SENDER_EMAIL },
      to: [{ email: to }],
      subject: `${code} is your VJNOTES code`,
      htmlContent: `<div style="font-family:Arial,sans-serif;max-width:420px">
        <h2 style="margin:0 0 8px">Verify your email</h2>
        <p>Enter this code on VJNOTES to finish creating your account:</p>
        <p style="font-size:32px;letter-spacing:6px;font-weight:700;margin:16px 0">${code}</p>
        <p style="color:#666;font-size:13px">It works for 10 minutes. If you did not ask for this, ignore this email.</p>
      </div>`,
    }),
  }).catch(() => null)
  if (!res) return 'failed'
  if (res.ok) return 'ok'
  const text = (await res.text().catch(() => '')).toLowerCase()
  const quota = res.status === 429 || res.status === 402 || /credit|quota|limit|daily|sending/.test(text)
  return quota ? 'quota' : 'failed'
}
