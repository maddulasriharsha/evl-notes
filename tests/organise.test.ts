import { describe, expect, it } from 'vitest'
import { allSubjects } from '@/lib/curriculum'
import { autoFileName, guessPlacement, isGenericName } from '@/lib/organise'

const theory = allSubjects().find(({ subject }) => subject.units.length >= 3)!.subject

describe('guessPlacement', () => {
  it('finds the subject and chapter from a course code', () => {
    expect(guessPlacement(`${theory.code} unit 3 notes.pdf`)).toEqual({ code: theory.code, unit: 3 })
    expect(guessPlacement(`${theory.code.toLowerCase()}_U-2.jpg`)).toEqual({ code: theory.code, unit: 2 })
  })

  it('reads roman numerals and the words module / chapter', () => {
    expect(guessPlacement(`${theory.code} Module IV.pdf`)?.unit).toBe(4)
    expect(guessPlacement(`${theory.code} chapter II handwritten.pdf`)?.unit).toBe(2)
  })

  it('returns the subject alone when no chapter is named', () => {
    expect(guessPlacement(`${theory.code} complete notes.pdf`)).toEqual({ code: theory.code, unit: null })
  })

  it('ignores a chapter number the subject does not have', () => {
    expect(guessPlacement(`${theory.code} unit 9.pdf`)?.unit).toBeNull()
  })

  it('recognises question papers', () => {
    expect(guessPlacement(`${theory.code} previous question papers.pdf`)?.unit).toBe(6)
    expect(guessPlacement(`${theory.code} mid 1 paper.pdf`)?.unit).toBe(6)
    expect(guessPlacement(`${theory.code} PYQ 2024.pdf`)?.unit).toBe(6)
  })

  it('knows nothing from a phone-camera name', () => {
    expect(guessPlacement('IMG_20260912_104455.jpg')).toBeNull()
    expect(guessPlacement('WhatsApp Image 2026-09-12 at 10.44.55 AM.jpeg')).toBeNull()
  })
})

describe('isGenericName', () => {
  it('flags names that say nothing about the content', () => {
    for (const n of ['IMG_2043.jpg', 'Scan 12.pdf', 'WhatsApp Image 2026-09-12 at 10.44.55.jpeg', 'Screenshot (4).png', '20260912_1044.pdf']) {
      expect(isGenericName(n), n).toBe(true)
    }
  })
  it('keeps names that describe the content', () => {
    expect(isGenericName('Laplace transforms solved problems.pdf')).toBe(false)
  })
})

describe('autoFileName', () => {
  it('numbers generic names after the notes already on the shelf', () => {
    expect(autoFileName({ short: 'DMS', unit: 2, n: 4, original: 'IMG_2043.jpg' })).toBe('DMS · Unit II · Notes 4')
  })
  it('keeps a useful part of the original name', () => {
    expect(autoFileName({ short: 'DMS', unit: 2, n: 1, original: 'dms unit 2 solved problems.pdf' })).toBe('DMS · Unit II · Solved problems')
  })
  it('does not repeat only the subject and chapter', () => {
    expect(autoFileName({ short: 'DMS', unit: 2, n: 3, original: 'DMS unit 2 notes.pdf' })).toBe('DMS · Unit II · Notes 3')
  })
  it('labels the general shelf', () => {
    expect(autoFileName({ short: 'DMS', unit: 0, n: 1, original: 'scan.pdf' })).toBe('DMS · General · Notes 1')
  })
})
