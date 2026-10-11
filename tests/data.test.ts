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

describe('Google Drive notes', () => {
  it('places every file in a real subject and section, with unique ids', async () => {
    const { driveFiles } = await import('@/lib/library')
    const { findSubject, sectionsOf } = await import('@/lib/curriculum')
    expect(driveFiles.length).toBe(546)
    expect(new Set(driveFiles.map((f) => f.id)).size).toBe(driveFiles.length)
    for (const f of driveFiles) {
      const found = findSubject(f.subject)
      expect(found, f.title).toBeDefined()
      expect(sectionsOf(found!.subject), `${f.subject} ${f.title}`).toContain(f.unit ?? 0)
    }
  })
})

describe('parseDriveLink', () => {
  const ID = '1kZqdo_2yHP24dDkfNLxCk-CqCj2yAYMy'

  it('recognises the usual Drive file links', async () => {
    const { parseDriveLink } = await import('@/lib/drive-link')
    const files = [
      `https://drive.google.com/file/d/${ID}/view?usp=sharing`,
      `https://drive.google.com/file/d/${ID}/view?usp=drive_link`,
      `https://drive.google.com/file/u/1/d/${ID}/view`,
      `https://drive.google.com/open?id=${ID}`,
      `https://drive.google.com/uc?export=download&id=${ID}`,
      `  https://drive.google.com/file/d/${ID}/preview  `,
    ]
    for (const url of files) expect(parseDriveLink(url), url).toEqual({ id: ID, kind: 'file' })
  })

  it('recognises folders and Google Docs, Sheets and Slides', async () => {
    const { parseDriveLink } = await import('@/lib/drive-link')
    expect(parseDriveLink(`https://drive.google.com/drive/folders/${ID}?usp=sharing`)).toEqual({ id: ID, kind: 'folder' })
    expect(parseDriveLink(`https://drive.google.com/drive/u/0/folders/${ID}`)).toEqual({ id: ID, kind: 'folder' })
    expect(parseDriveLink(`https://docs.google.com/document/d/${ID}/edit`)).toEqual({ id: ID, kind: 'document' })
    expect(parseDriveLink(`https://docs.google.com/spreadsheets/d/${ID}/edit#gid=0`)).toEqual({ id: ID, kind: 'spreadsheet' })
    expect(parseDriveLink(`https://docs.google.com/presentation/d/${ID}/edit`)).toEqual({ id: ID, kind: 'presentation' })
  })

  it('rejects everything else', async () => {
    const { parseDriveLink } = await import('@/lib/drive-link')
    for (const bad of [
      '',
      'hello',
      'javascript:alert(1)',
      'https://example.com/file/d/' + ID,
      'https://drive.google.com.evil.com/file/d/' + ID,
      'https://evil.com/?u=https://drive.google.com/file/d/' + ID,
      'https://drive.google.com/file/d/short/view',
      'https://drive.google.com/',
      'https://docs.google.com/forms/d/' + ID,
    ]) {
      expect(parseDriveLink(bad), bad).toBeNull()
    }
  })

  it('builds the right preview, open and download links', async () => {
    const { driveDownloadLink, driveEmbedUrl, driveViewUrl } = await import('@/lib/drive-link')
    expect(driveEmbedUrl('file', ID)).toBe(`https://drive.google.com/file/d/${ID}/preview`)
    expect(driveEmbedUrl('folder', ID)).toContain('embeddedfolderview')
    expect(driveViewUrl('document', ID)).toBe(`https://docs.google.com/document/d/${ID}/edit`)
    expect(driveDownloadLink('file', ID)).toContain(`id=${ID}`)
    expect(driveDownloadLink('folder', ID)).toBeNull()
  })
})
