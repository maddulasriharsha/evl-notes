import 'server-only'

import { createHash } from 'node:crypto'

/**
 * A small Google Drive client for the backup job, written against the REST API so it needs no
 * extra packages. It signs in with a long-lived refresh token for the dedicated backup account and
 * only asks for the `drive.file` scope: it can see and manage files this app created, nothing else.
 */

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3'
const FOLDER_NAME = 'VJNOTES backup'

function cfg() {
  return {
    clientId: process.env.GOOGLE_DRIVE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    refreshToken: process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  }
}

export function driveBackupConfigured() {
  const c = cfg()
  return !!(c.clientId && c.clientSecret && c.refreshToken)
}

let cached: { token: string; expires: number } | null = null
let folderCache: string | null = null

async function accessToken(): Promise<string> {
  if (cached && cached.expires > Date.now() + 30_000) return cached.token
  const c = cfg()
  if (!c.clientId || !c.clientSecret || !c.refreshToken) throw new Error('Google Drive backup is not configured')
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: c.clientId,
      client_secret: c.clientSecret,
      refresh_token: c.refreshToken,
      grant_type: 'refresh_token',
    }),
  })
  const json = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error?: string; error_description?: string }
  if (!res.ok || !json.access_token) {
    throw new Error(`Google sign-in failed: ${json.error_description ?? json.error ?? res.status}`)
  }
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3000) * 1000 }
  return cached.token
}

async function call(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${await accessToken()}` } })
  return res
}

async function ok(res: Response, what: string) {
  if (res.ok) return res
  const text = (await res.text().catch(() => '')).slice(0, 300)
  throw new Error(`Google Drive ${what} failed (${res.status}): ${text}`)
}

/** The folder everything is stored in: GOOGLE_DRIVE_FOLDER_ID if given, else "VJNOTES backup", created on first use. */
export async function ensureFolder(): Promise<string> {
  const fixed = cfg().folderId
  if (fixed) return fixed
  if (folderCache) return folderCache
  const q = encodeURIComponent(`name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)
  const list = await ok(await call(`${API}/files?q=${q}&fields=files(id)&pageSize=1`), 'folder lookup')
  const found = ((await list.json()) as { files?: { id: string }[] }).files?.[0]?.id
  if (found) return (folderCache = found)
  const made = await ok(
    await call(`${API}/files?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' }),
    }),
    'folder creation',
  )
  return (folderCache = ((await made.json()) as { id: string }).id)
}

export function md5(bytes: Uint8Array) {
  return createHash('md5').update(bytes).digest('hex')
}

/** Uploads the bytes and makes the copy readable by anyone with the link. Returns Drive's id, size and checksum. */
export async function uploadBackup(opts: {
  name: string
  mime: string
  bytes: Uint8Array
  /** false keeps the copy private to the backup account (used for the database export). */
  shared?: boolean
}): Promise<{ id: string; size: number; md5: string }> {
  const folder = await ensureFolder()
  const boundary = `vj${crypto.randomUUID()}`
  const meta = JSON.stringify({ name: opts.name, parents: [folder] })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: ${opts.mime}\r\n\r\n`),
    Buffer.from(opts.bytes),
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const up = await ok(
    await call(`${UPLOAD}/files?uploadType=multipart&fields=id,size,md5Checksum`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    }),
    'upload',
  )
  const file = (await up.json()) as { id: string; size?: string; md5Checksum?: string }
  if (opts.shared === false) return { id: file.id, size: Number(file.size ?? -1), md5: file.md5Checksum ?? '' }
  try {
    await ok(
      await call(`${API}/files/${file.id}/permissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'reader', type: 'anyone' }),
      }),
      'sharing',
    )
  } catch (e) {
    // A copy nobody can open is no backup: remove it so the next run starts clean.
    await deleteBackup(file.id).catch(() => undefined)
    throw e
  }
  return { id: file.id, size: Number(file.size ?? -1), md5: file.md5Checksum ?? '' }
}

export interface CopyState {
  exists: boolean
  size: number | null
  trashed: boolean
  public: boolean
}

/** Looks at a copy as it is right now: is it there, how big, in the bin, readable by anyone? */
export async function inspectBackup(id: string): Promise<CopyState> {
  const res = await call(`${API}/files/${encodeURIComponent(id)}?fields=id,size,trashed`)
  if (res.status === 404) return { exists: false, size: null, trashed: false, public: false }
  const file = (await (await ok(res, 'lookup')).json()) as { size?: string; trashed?: boolean }
  const perms = await ok(await call(`${API}/files/${encodeURIComponent(id)}/permissions?fields=permissions(type,role)`), 'permission lookup')
  const list = ((await perms.json()) as { permissions?: { type: string; role: string }[] }).permissions ?? []
  return {
    exists: true,
    size: file.size === undefined ? null : Number(file.size),
    trashed: !!file.trashed,
    public: list.some((p) => p.type === 'anyone'),
  }
}

export async function deleteBackup(id: string): Promise<void> {
  const res = await call(`${API}/files/${encodeURIComponent(id)}`, { method: 'DELETE' })
  if (res.status !== 404) await ok(res, 'delete')
}

/** Files this app created whose name starts with the prefix, newest first. */
export async function listBackups(prefix: string): Promise<{ id: string; name: string; createdTime: string }[]> {
  const folder = await ensureFolder()
  const safe = prefix.replace(/['\\]/g, '')
  const q = encodeURIComponent(`'${folder}' in parents and name contains '${safe}' and trashed=false`)
  const res = await ok(await call(`${API}/files?q=${q}&fields=files(id,name,createdTime)&orderBy=createdTime desc&pageSize=100`), 'list')
  return ((await res.json()) as { files?: { id: string; name: string; createdTime: string }[] }).files ?? []
}

/**
 * Starts a resumable upload straight from a visitor's browser into the backup folder, so big files
 * never pass through the site. Google fixes the size and type for the session, and the returned URL
 * only accepts that one upload.
 */
export async function startResumableUpload(opts: { name: string; mime: string; size: number; origin: string }): Promise<string> {
  const folder = await ensureFolder()
  const res = await ok(
    await call(`${UPLOAD}/files?uploadType=resumable&fields=id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': opts.mime,
        'X-Upload-Content-Length': String(opts.size),
        Origin: opts.origin,
      },
      body: JSON.stringify({ name: opts.name, parents: [folder] }),
    }),
    'upload start',
  )
  const url = res.headers.get('location')
  if (!url) throw new Error('Google Drive did not return an upload address')
  return url
}

/** After a browser upload: checks the file is ours and as expected, then makes it readable by link. */
export async function publishUpload(id: string, limits: { maxBytes: number; mimes: readonly string[] }): Promise<{ size: number; mime: string }> {
  const folder = await ensureFolder()
  const res = await ok(await call(`${API}/files/${encodeURIComponent(id)}?fields=id,size,mimeType,parents,trashed`), 'lookup')
  const file = (await res.json()) as { size?: string; mimeType?: string; parents?: string[]; trashed?: boolean }
  const size = Number(file.size ?? -1)
  const bad = file.trashed || !file.parents?.includes(folder) || size <= 0 || size > limits.maxBytes || !limits.mimes.includes(file.mimeType ?? '')
  if (bad) {
    await deleteBackup(id).catch(() => undefined)
    throw new Error('That upload was not accepted')
  }
  await ok(
    await call(`${API}/files/${encodeURIComponent(id)}/permissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'reader', type: 'anyone' }),
    }),
    'sharing',
  )
  return { size, mime: file.mimeType ?? '' }
}
