import { describe, expect, it } from 'vitest'
import { allSubjects, regularSemesters, parseSectionSlug, sectionSlug } from '@/lib/curriculum'
import { safeNext } from '@/lib/safe-next'

describe('curriculum', () => {
  it('has the four R25 semesters', () => {
    expect(regularSemesters.map((s) => [s.year, s.sem])).toEqual([[1, 1], [1, 2], [2, 3], [2, 4]])
  })

  it('has unique, well-formed subject codes', () => {
    const codes = allSubjects().map(({ subject }) => subject.code)
    expect(new Set(codes).size).toBe(codes.length)
    for (const c of codes) expect(c).toMatch(/^[0-9A-Z-]{4,12}$/)
  })

  it('gives every theory subject five named chapters', () => {
    for (const { subject } of allSubjects()) {
      if (subject.kind === 'theory') expect(subject.units, subject.code).toHaveLength(5)
      for (const t of subject.units) expect(t.trim().length).toBeGreaterThan(2)
    }
  })

  it('round-trips section slugs', () => {
    for (const u of [0, 1, 2, 3, 4, 5]) expect(parseSectionSlug(sectionSlug(u))).toBe(u)
    expect(parseSectionSlug('unit-6')).toBeNull()
    expect(parseSectionSlug('../x')).toBeNull()
  })
})

describe('safeNext', () => {
  it('keeps same-site paths and rejects everything else', () => {
    expect(safeNext('/me')).toBe('/me')
    expect(safeNext('/upload?subject=X')).toBe('/upload?subject=X')
    expect(safeNext('//evil.com')).toBe('/upload')
    expect(safeNext('/\\evil.com')).toBe('/upload')
    expect(safeNext('https://evil.com')).toBe('/upload')
    expect(safeNext(null)).toBe('/upload')
  })
})
