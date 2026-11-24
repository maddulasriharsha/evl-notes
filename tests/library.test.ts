import { describe, expect, it } from 'vitest'
import { driveFiles, libraryWith } from '@/lib/library'

describe('Drive library', () => {
  it('leaves a hidden file out of every list, count and lookup', () => {
    const f = driveFiles[0]!
    const shown = libraryWith(new Map())
    const hidden = libraryWith(new Map(), new Map(), new Set([f.id]))
    expect(shown.file(f.id)).toBeDefined()
    expect(hidden.file(f.id)).toBeUndefined()
    expect(hidden.isHidden(f.id)).toBe(true)
    expect(hidden.files.some((x) => x.id === f.id)).toBe(false)
    expect(hidden.files).toHaveLength(shown.files.length - 1)
    expect(hidden.filesFor(f.subject).some((x) => x.id === f.id)).toBe(false)
  })

  it('also lists a tagged file in the Question bank, and keeps it where it was', () => {
    // A chapter note, so it is not in the bank until tagged.
    const f = driveFiles.find((x) => x.kind === 'notes' && x.unit && x.unit >= 1 && x.unit <= 5)!
    const plain = libraryWith(new Map())
    const tagged = libraryWith(new Map(), new Map(), new Set(), new Set([f.id]))
    expect(plain.filesFor(f.subject, 7).some((x) => x.id === f.id)).toBe(false)
    expect(tagged.filesFor(f.subject, 7).some((x) => x.id === f.id && x.tagged)).toBe(true)
    expect(tagged.filesFor(f.subject, f.unit!).some((x) => x.id === f.id)).toBe(true)
  })

  it('carries the typed/handwritten and R25/old labels onto the file', () => {
    const f = driveFiles[0]!
    const lib = libraryWith(new Map(), new Map(), new Set(), new Set(), new Map([[f.id, { style: 'handwritten', edition: 'old' }]]))
    expect(lib.file(f.id)).toMatchObject({ style: 'handwritten', edition: 'old' })
    expect(libraryWith(new Map()).file(f.id)?.style).toBeUndefined()
  })
})
