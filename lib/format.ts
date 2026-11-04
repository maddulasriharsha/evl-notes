export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.round((new Date(iso).getTime() - now) / 1000)
  const abs = Math.abs(s)
  if (abs < 60) return 'just now'
  if (abs < 3600) return rtf.format(Math.round(s / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(s / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(s / 86400), 'day')
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
}

export function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

const MIME_EXT: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/gif': 'gif',
}

/**
 * The name a downloaded file is saved under: the note's title, made safe for a file system, and ending
 * in the file's real extension (taken from where it is stored, else from its type) so the computer
 * knows what program opens it. A title like "DLD · General · Dld1" would otherwise save with no ending.
 */
export function downloadName(title: string, mime: string, storagePath?: string | null): string {
  const fromPath = /\.([a-z0-9]{2,5})$/i.exec(storagePath ?? '')?.[1]?.toLowerCase()
  const ext = fromPath ?? MIME_EXT[mime] ?? ''
  const base =
    title
      .replace(/\.[a-z0-9]{2,5}$/i, (m) => (m.slice(1).toLowerCase() === ext ? '' : m))
      .replace(/[\/:*?"<>|\u0000-\u001f]/g, ' ')
      .replace(/\s*[·•]\s*/g, ' - ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 120) || 'note'
  return ext ? `${base}.${ext}` : base
}
