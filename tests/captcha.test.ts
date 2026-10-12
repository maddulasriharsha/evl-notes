import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { humanVerified, newMathChallenge } from '@/lib/captcha'

const OLD = { ...process.env }

beforeEach(() => {
  delete process.env.TURNSTILE_SECRET_KEY
  delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  process.env.SIGNUP_SECRET = 'test-secret'
})
afterEach(() => {
  process.env = { ...OLD }
})

function answerOf(question: string) {
  const m = /(\d+) \+ (\d+)/.exec(question)!
  return String(Number(m[1]) + Number(m[2]))
}

describe('human check (arithmetic)', () => {
  it('accepts the right answer', async () => {
    const c = newMathChallenge()
    expect(await humanVerified({ answer: answerOf(c.question), token: c.token })).toBe(true)
  })

  it('rejects a wrong or missing answer, or a made-up token', async () => {
    const c = newMathChallenge()
    expect(await humanVerified({ answer: '999', token: c.token })).toBe(false)
    expect(await humanVerified({ token: c.token })).toBe(false)
    expect(await humanVerified({ answer: answerOf(c.question), token: 'abc.def' })).toBe(false)
    expect(await humanVerified(undefined)).toBe(false)
  })
})
