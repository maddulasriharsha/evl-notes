import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { codeIsValid, emailCodesConfigured, newCode, tokenFor } from '@/lib/signup-code'

const OLD = { ...process.env }

beforeEach(() => {
  process.env.BREVO_API_KEY = 'k'
  process.env.BREVO_SENDER_EMAIL = 'noreply@example.com'
  process.env.SIGNUP_SECRET = 'test-secret'
})
afterEach(() => {
  process.env = { ...OLD }
  vi.useRealTimers()
})

describe('signup email codes', () => {
  it('is off until the email provider is configured', () => {
    delete process.env.BREVO_API_KEY
    expect(emailCodesConfigured()).toBe(false)
  })

  it('makes six-digit codes', () => {
    for (let i = 0; i < 50; i++) expect(newCode()).toMatch(/^\d{6}$/)
  })

  it('accepts the right code for the right email', () => {
    const token = tokenFor('a@b.co', '123456')
    expect(codeIsValid('a@b.co', '123456', token)).toBe(true)
  })

  it('rejects a wrong code, another email, or a garbled token', () => {
    const token = tokenFor('a@b.co', '123456')
    expect(codeIsValid('a@b.co', '654321', token)).toBe(false)
    expect(codeIsValid('x@y.co', '123456', token)).toBe(false)
    expect(codeIsValid('a@b.co', '123456', 'nonsense')).toBe(false)
    expect(codeIsValid('a@b.co', '12345', token)).toBe(false)
  })

  it('expires after ten minutes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-12T10:00:00Z'))
    const token = tokenFor('a@b.co', '123456')
    vi.setSystemTime(new Date('2026-10-12T10:09:00Z'))
    expect(codeIsValid('a@b.co', '123456', token)).toBe(true)
    vi.setSystemTime(new Date('2026-10-12T10:11:00Z'))
    expect(codeIsValid('a@b.co', '123456', token)).toBe(false)
  })
})
