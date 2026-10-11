'use server'

import { revalidatePath } from 'next/cache'
import { findSubject, sectionHref, sectionsOf, semesterHref, subjectHref } from '@/lib/curriculum'
import { parseDriveLink, type DriveLinkKind } from '@/lib/drive-link'
import { currentUser } from '@/lib/supabase/server'

/** Refreshes the cached public pages that show a chapter after someone changes it. */
export async function refreshChapter(subjectCode: string, unit: number) {
  if (!(await currentUser())) return
  const found = findSubject(subjectCode)
  if (!found || !sectionsOf(found.subject).includes(unit)) return
  revalidatePath(sectionHref(found.subject.code, unit))
  revalidatePath(subjectHref(found.subject.code))
  for (const use of found.usedIn) {
    if (use.branch) revalidatePath(semesterHref(use.branch.id, use.semester.sem))
  }
  revalidatePath('/')
  revalidatePath('/contributors')
}

/** Same as refreshChapter, plus the note's own page (after a rename or delete). */
export async function refreshFile(fileId: string, subjectCode: string, unit: number) {
  if (!(await currentUser())) return
  if (/^[0-9a-f-]{36}$/i.test(fileId)) revalidatePath(`/view/u/${fileId}`)
  await refreshChapter(subjectCode, unit)
}

export type DriveCheck =
  | { ok: true; id: string; kind: DriveLinkKind; title: string | null }
  | { ok: false; message: string }

const PROBE: Record<DriveLinkKind, (id: string) => string> = {
  file: (id) => `https://drive.google.com/file/d/${id}/view`,
  folder: (id) => `https://drive.google.com/embeddedfolderview?id=${id}`,
  document: (id) => `https://docs.google.com/document/d/${id}/preview`,
  spreadsheet: (id) => `https://docs.google.com/spreadsheets/d/${id}/preview`,
  presentation: (id) => `https://docs.google.com/presentation/d/${id}/embed`,
}

const SHARE_HELP = 'In Google Drive open Share → General access → “Anyone with the link” (Viewer), then copy the link again.'

function decode(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
}

/**
 * Checks, as an anonymous visitor would, that a pasted Google Drive link opens, and reads its
 * name. Only ever requests a fixed Google URL built from a validated id and never follows
 * redirects, so it cannot be steered elsewhere.
 */
export async function inspectDriveLink(input: string): Promise<DriveCheck> {
  if (!(await currentUser())) return { ok: false, message: 'Sign in first.' }
  const parsed = parseDriveLink(String(input).slice(0, 2000))
  if (!parsed) {
    return { ok: false, message: 'That does not look like a Google Drive link. In Drive use Share → Copy link.' }
  }
  const { id, kind } = parsed
  try {
    const res = await fetch(PROBE[kind](encodeURIComponent(id)), {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; EVLNotes/1.0)', 'Accept-Language': 'en' },
    })
    if (res.status >= 300 && res.status < 400) {
      const to = res.headers.get('location') ?? ''
      if (/accounts\.google\.com|ServiceLogin/i.test(to)) {
        return { ok: false, message: `This link is private. ${SHARE_HELP}` }
      }
    }
    if (res.status === 404 || res.status === 403 || res.status === 401) {
      return { ok: false, message: `Drive says this link does not exist or is private. ${SHARE_HELP}` }
    }
    if (res.status === 200) {
      const html = (await res.text()).slice(0, 200_000)
      const raw = /<title>([^<]*)<\/title>/i.exec(html)?.[1]
      const title = raw ? decode(raw).trim() : ''
      if (/^(sign in|google accounts|error|page not found|meet google drive)/i.test(title)) {
        return { ok: false, message: `This link is private. ${SHARE_HELP}` }
      }
      const name = title
        .replace(/\s+-\s+Google (Drive|Docs|Sheets|Slides)\s*$/i, '')
        .replace(/\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|webp|gif|txt|md)$/i, '')
        .trim()
        .slice(0, 150)
      return { ok: true, id, kind, title: name || null }
    }
  } catch {
    // Google unreachable or slow: do not block the upload, the name can be typed in.
  }
  return { ok: true, id, kind, title: null }
}
