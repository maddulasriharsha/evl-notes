/**
 * Google Drive links: recognised on the server (when added) and used by the viewer and cards.
 * A link is stored as { drive_id, mime } where mime is the matching Google Apps type.
 */
export type DriveLinkKind = 'file' | 'folder' | 'document' | 'spreadsheet' | 'presentation'

export const DRIVE_MIME: Record<DriveLinkKind, string> = {
  file: 'application/vnd.google-apps.file',
  folder: 'application/vnd.google-apps.folder',
  document: 'application/vnd.google-apps.document',
  spreadsheet: 'application/vnd.google-apps.spreadsheet',
  presentation: 'application/vnd.google-apps.presentation',
}

export const DRIVE_KIND_LABEL: Record<DriveLinkKind, string> = {
  file: 'Drive file',
  folder: 'Drive folder',
  document: 'Google Doc',
  spreadsheet: 'Google Sheet',
  presentation: 'Google Slides',
}

const ID = /^[A-Za-z0-9_-]{10,120}$/

export function isDriveMime(mime: string) {
  return mime.startsWith('application/vnd.google-apps.')
}

export function driveKindFromMime(mime: string): DriveLinkKind {
  const found = (Object.entries(DRIVE_MIME) as [DriveLinkKind, string][]).find(([, m]) => m === mime)
  return found?.[0] ?? 'file'
}

/** Understands the many shapes of Drive / Docs links people paste. Returns null if it is not one. */
export function parseDriveLink(input: string): { id: string; kind: DriveLinkKind } | null {
  let url: URL
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  const path = url.pathname
  const ok = (id: string | null | undefined, kind: DriveLinkKind) => (id && ID.test(id) ? { id, kind } : null)

  if (host === 'drive.google.com') {
    const folder = /\/folders\/([^/?#]+)/.exec(path)
    if (folder) return ok(folder[1], 'folder')
    const file = /\/file\/(?:u\/\d+\/)?d\/([^/?#]+)/.exec(path)
    if (file) return ok(file[1], 'file')
    if (path === '/open' || path === '/uc' || path === '/viewerng/viewer') return ok(url.searchParams.get('id'), 'file')
    if (path.startsWith('/drive/') && url.searchParams.get('id')) return ok(url.searchParams.get('id'), 'folder')
    return null
  }
  if (host === 'docs.google.com') {
    const m = /^\/(document|spreadsheets|presentation)\/(?:u\/\d+\/)?d\/([^/?#]+)/.exec(path)
    if (!m) return null
    const kind = m[1] === 'document' ? 'document' : m[1] === 'spreadsheets' ? 'spreadsheet' : 'presentation'
    return ok(m[2], kind)
  }
  return null
}

export function driveEmbedUrl(kind: DriveLinkKind, id: string) {
  const e = encodeURIComponent(id)
  switch (kind) {
    case 'folder':
      return `https://drive.google.com/embeddedfolderview?id=${e}#grid`
    case 'document':
      return `https://docs.google.com/document/d/${e}/preview`
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${e}/preview`
    case 'presentation':
      return `https://docs.google.com/presentation/d/${e}/embed`
    default:
      return `https://drive.google.com/file/d/${e}/preview`
  }
}

export function driveViewUrl(kind: DriveLinkKind, id: string) {
  const e = encodeURIComponent(id)
  switch (kind) {
    case 'folder':
      return `https://drive.google.com/drive/folders/${e}`
    case 'document':
      return `https://docs.google.com/document/d/${e}/edit`
    case 'spreadsheet':
      return `https://docs.google.com/spreadsheets/d/${e}/edit`
    case 'presentation':
      return `https://docs.google.com/presentation/d/${e}/edit`
    default:
      return `https://drive.google.com/file/d/${e}/view`
  }
}

/** Only plain Drive files can be downloaded directly; Docs, folders and so on are opened in Drive. */
export function driveDownloadLink(kind: DriveLinkKind, id: string) {
  return kind === 'file' ? `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}` : null
}

export function driveCardThumb(kind: DriveLinkKind, id: string, width = 480) {
  return kind === 'folder' ? null : `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${width}`
}
