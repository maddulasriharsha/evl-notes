import { describe, expect, it } from 'vitest'
import { backupFileName, copyIsSafe, isDueForRemoval, removalCutoff } from '@/lib/backup-rules'

const now = new Date('2026-10-20T12:00:00Z')

describe('isDueForRemoval', () => {
  it('waits three full days', () => {
    expect(isDueForRemoval('2026-10-17T12:00:00Z', now)).toBe(true)
    expect(isDueForRemoval('2026-10-17T12:00:01Z', now)).toBe(false)
    expect(isDueForRemoval('2026-10-19T12:00:00Z', now)).toBe(false)
  })
  it('never removes on a bad date', () => {
    expect(isDueForRemoval('not a date', now)).toBe(false)
  })
  it('gives the database the same cutoff', () => {
    expect(removalCutoff(now)).toBe('2026-10-17T12:00:00.000Z')
  })
})

describe('copyIsSafe', () => {
  it('needs the same size, not in the bin, and shared', () => {
    expect(copyIsSafe({ size: 1000, trashed: false, public: true }, 1000)).toBe(true)
    expect(copyIsSafe({ size: 999, trashed: false, public: true }, 1000)).toBe(false)
    expect(copyIsSafe({ size: 1000, trashed: true, public: true }, 1000)).toBe(false)
    expect(copyIsSafe({ size: 1000, trashed: false, public: false }, 1000)).toBe(false)
    expect(copyIsSafe({ size: null, trashed: false, public: true }, 1000)).toBe(false)
    expect(copyIsSafe({ size: 1000, trashed: false, public: true }, null)).toBe(false)
  })
})

describe('backupFileName', () => {
  it('keeps the id so every copy is unique', () => {
    expect(backupFileName('abc', 'u1/c1/abc/Unit-2-notes.pdf')).toBe('abc-Unit-2-notes.pdf')
  })
})
