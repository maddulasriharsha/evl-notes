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
})
