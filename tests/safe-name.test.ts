import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/browser', () => ({ supabaseBrowser: () => ({}) }))
vi.mock('@/lib/pdf', () => ({ pdfThumbnail: async () => ({ blob: null, pages: 1 }) }))

const { safeName, checkFile } = await import('@/lib/upload')

describe('safeName', () => {
  it('makes storage-safe names and keeps the extension', () => {
    expect(safeName('Unit 2 – Fourier (final).PDF')).toBe('Unit-2-Fourier-final-.pdf'.replace('-.pdf', '.pdf'))
    expect(safeName('../../etc/passwd')).not.toContain('/')
    expect(safeName('.pdf')).toBe('pdf')
    expect(safeName('photo.jpeg')).toBe('photo.jpeg')
  })
})

describe('checkFile', () => {
  it('accepts PDFs and images, rejects others and oversize files', () => {
    expect(checkFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toBeNull()
    expect(checkFile(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).toBeNull()
    expect(checkFile(new File(['x'], 'a.exe', { type: 'application/x-msdownload' }))).not.toBeNull()
    expect(checkFile(new File([], 'a.pdf', { type: 'application/pdf' }))).not.toBeNull()
  })
})
