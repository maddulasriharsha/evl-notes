'use server'

import { headers } from 'next/headers'
import { driveBackupConfigured, publishUpload, startResumableUpload } from '@/lib/drive-backup'
import { parseDriveLink, type DriveLinkKind } from '@/lib/drive-link'
import { currentUser } from '@/lib/supabase/server'
import { DIRECT_MIMES, MAX_BYTES, uploadProblem } from '@/lib/upload-rules'

export type DriveUploadStart = { ok: true; url: string } | { ok: false; message: string }

/** Opens a one-file upload address in the site's Google Drive for a signed-in member. */
export async function startDriveUpload(input: { name: string; mime: string; size: number }): Promise<DriveUploadStart> {
  const user = await currentUser()
  if (!user) return { ok: false, message: 'Sign in first.' }
  if (!driveBackupConfigured()) return { ok: false, message: 'Large and Office files are not available right now. Use a Google Drive link instead.' }
  const name =
    String(input.name)
      .replace(/[\\/]/g, ' ')
      .replace(/\p{Cc}/gu, ' ')
      .trim()
      .slice(0, 150) || 'file'
  const mime = String(input.mime)
  const size = Number(input.size)
  const problem = uploadProblem({ name, type: mime, size })
  if (problem || !Number.isInteger(size)) return { ok: false, message: problem ?? 'Bad file size' }
  const h = await headers()
  const origin = h.get('origin') ?? `https://${h.get('host')}`
  try {
    return { ok: true, url: await startResumableUpload({ name: `${user.id.slice(0, 8)}-${name}`, mime, size, origin }) }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not start the upload' }
  }
}

/** Confirms a finished browser upload and makes it readable, so it can be saved as a note. */
export async function finishDriveUpload(id: string): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!(await currentUser())) return { ok: false, message: 'Sign in first.' }
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(String(id))) return { ok: false, message: 'Bad upload' }
  try {
    await publishUpload(id, { maxBytes: MAX_BYTES, mimes: DIRECT_MIMES })
    return { ok: true }
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : 'Could not finish the upload' }
  }
}

export type FolderFile = { id: string; kind: DriveLinkKind; title: string }
export type FolderResult = { ok: true; files: FolderFile[]; truncated: boolean } | { ok: false; message: string }

const MAX_FOLDER_FILES = 100
const MAX_FOLDERS = 20

function decode(text: string) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
}

/**
 * Lists the files inside a shared Google Drive folder (and its sub-folders), as an anonymous
 * visitor sees them. Only fixed Google URLs built from validated ids are requested.
 */
export async function expandDriveFolder(input: string): Promise<FolderResult> {
  if (!(await currentUser())) return { ok: false, message: 'Sign in first.' }
  const parsed = parseDriveLink(String(input).slice(0, 2000))
  if (!parsed || parsed.kind !== 'folder') return { ok: false, message: 'That is not a Google Drive folder link.' }
  const files: FolderFile[] = []
  const seen = new Set<string>()
  const queue = [parsed.id]
  let fetched = 0
  let truncated = false
  while (queue.length > 0) {
    if (fetched >= MAX_FOLDERS || files.length >= MAX_FOLDER_FILES) {
      truncated = true
      break
    }
    const folder = queue.shift()!
    if (seen.has(folder)) continue
    seen.add(folder)
    fetched++
    let html = ''
    try {
      const res = await fetch(`https://drive.google.com/embeddedfolderview?id=${encodeURIComponent(folder)}`, {
        redirect: 'manual',
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VJNOTES/1.0)', 'Accept-Language': 'en' },
      })
      if (res.status !== 200) {
        if (fetched === 1) return { ok: false, message: 'This folder is private. In Drive open Share → “Anyone with the link” (Viewer).' }
        continue
      }
      html = (await res.text()).slice(0, 2_000_000)
    } catch {
      if (fetched === 1) return { ok: false, message: 'Google Drive did not answer. Try again in a moment.' }
      continue
    }
    for (const entry of html.split('<div class="flip-entry" id="entry-').slice(1)) {
      const href = /<a href="([^"]+)"/.exec(entry)?.[1]
      const title = /flip-entry-title">([^<]*)<\/div>/.exec(entry)?.[1]
      if (!href || title === undefined) continue
      const item = parseDriveLink(decode(href))
      if (!item) continue
      if (item.kind === 'folder') {
        queue.push(item.id)
        continue
      }
      if (files.some((f) => f.id === item.id)) continue
      if (files.length >= MAX_FOLDER_FILES) {
        truncated = true
        break
      }
      const name = decode(title)
        .replace(/\.(pdf|docx?|pptx?|xlsx?|jpe?g|png|webp|gif|txt)$/i, '')
        .trim()
        .slice(0, 150)
      files.push({ id: item.id, kind: item.kind, title: name || 'Drive file' })
    }
  }
  if (files.length === 0) return { ok: false, message: 'No files were found in that folder (is it shared with “Anyone with the link”?).' }
  return { ok: true, files, truncated }
}
