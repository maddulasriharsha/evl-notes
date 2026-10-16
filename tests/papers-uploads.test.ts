import { describe, expect, it } from 'vitest'
import { siblingSubjects } from '@/lib/curriculum'
import { driveFilesFor } from '@/lib/library'
import { examOf, isMidPaper, paperSlot, retitlePaper } from '@/lib/papers'
import { goesToDrive, mimeOf, uploadProblem } from '@/lib/upload-rules'

const isMid = (t: string) => /(^|[^a-z])mid([^a-z]|$)/i.test(t)

describe('mid and semester papers', () => {
  it('tells a mid paper from a semester paper by its title', () => {
    expect(isMid('PYQ · Mid 1 · Oct 2025 · R25 · Matrices and Calculus')).toBe(true)
    expect(isMid('DLD MID-2 paper')).toBe(true)
    expect(isMid('PYQ · Jan 2026 · R25 · Chemistry for Engineers (Regular)')).toBe(false)
    expect(isMid('Pyramid notes')).toBe(false)
  })

  it('keeps question papers out of Complete notes', () => {
    const general = driveFilesFor('25BS1MT101', 0)
    expect(general.every((f) => f.kind !== 'questions')).toBe(true)
    expect(driveFilesFor('25BS1MT101', 6).some((f) => isMid(f.title))).toBe(true)
  })
})

describe('the same subject in other branches', () => {
  it('finds the other code of a subject taught under two codes, and nothing for a unique one', () => {
    expect(siblingSubjects('25PC1IT204').map((s) => s.subject.code)).toEqual(['25PC1CB206'])
    expect(siblingSubjects('25PC1EC204')).toEqual([])
    expect(siblingSubjects('nope')).toEqual([])
  })
})

describe('upload rules', () => {
  const MB = 1024 * 1024
  it('accepts PDFs, photos, Word and PowerPoint up to 120 MB', () => {
    expect(uploadProblem({ name: 'a.pdf', type: 'application/pdf', size: 119 * MB })).toBeNull()
    expect(uploadProblem({ name: 'a.pdf', type: 'application/pdf', size: 121 * MB })).toMatch(/120 MB/)
    expect(uploadProblem({ name: 'a.docx', type: '', size: MB })).toBeNull()
    expect(uploadProblem({ name: 'a.exe', type: 'application/x-msdownload', size: MB })).toMatch(/Only/)
    expect(uploadProblem({ name: 'a.pdf', type: 'application/pdf', size: 0 })).toMatch(/Empty/)
  })

  it('sends Office files and anything over 50 MB straight to Drive', () => {
    expect(goesToDrive('application/pdf', 10 * MB)).toBe(false)
    expect(goesToDrive('application/pdf', 60 * MB)).toBe(true)
    expect(goesToDrive(mimeOf({ name: 'x.pptx', type: '' }), MB)).toBe(true)
  })
})

describe('papers table', () => {
  it('puts each paper in its column and gives it a short label', async () => {
    const { paperSlot, paperChip } = await import('@/lib/papers')
    expect(paperSlot('PYQ · Mid 1 · Oct 2025 · R25 · Matrices and Calculus')).toBe('mid1')
    expect(paperSlot('PYQ · Mid 2 · Dec 2025 · R25 · Matrices and Calculus · set 2')).toBe('mid2')
    expect(paperSlot('DLD MID-II paper')).toBe('mid2')
    expect(paperSlot('PYQ · Jan 2026 · R25 · Chemistry for Engineers (Regular)')).toBe('sem')
    expect(paperSlot('PYQ · Mid 2 · Jan 2024 · R22 · I Year Sem 1, all subjects in one PDF')).toBe('combined')
    expect(paperSlot('PYQ · Mid & Sem collection · 2023 · R22 · Signals and Systems')).toBe('combined')
    expect(paperChip('PYQ · Mid 1 · Nov 2023 · R22 · Matrices and Calculus · page 2')).toBe('R22 · p2')
    expect(paperChip('PYQ · Mid 2 · Dec 2025 · R25 · Matrices and Calculus · set 2')).toBe('R25 · set 2')
    expect(paperChip('old paper')).toBe('Open')
  })
})

describe('names the uploader gives papers', () => {
  it('are read back as the exam they were picked for', () => {
    expect(paperSlot('EDC · Mid 1 2026')).toBe('mid1')
    expect(paperSlot('EDC · Mid 2 2026 · Set 2')).toBe('mid2')
    expect(paperSlot('EDC · Sem 2026')).toBe('sem')
    expect(isMidPaper('EDC · Mid 2 2025')).toBe(true)
    expect(isMidPaper('EDC · Sem 2025')).toBe(false)
  })
})

describe('retitling a paper', () => {
  it('swaps the exam and year and keeps the rest', () => {
    expect(retitlePaper('EDC · Mid 1 2025', 'sem', 2025)).toBe('EDC · Sem 2025')
    expect(retitlePaper('R25 Basic Electrical Engineering Sem 2024 page 2', 'mid2', 2026)).toBe('R25 Basic Electrical Engineering page 2 · Mid 2 2026')
    expect(retitlePaper('Physics', 'mid1', 2026)).toBe('Physics · Mid 1 2026')
    expect(paperSlot(retitlePaper('EDC · Sem 2025', 'mid2', 2025))).toBe('mid2')
    expect(examOf('EDC Mid I 2024')).toBe('mid1')
    expect(examOf('Mid papers collection')).toBeNull()
  })
})
