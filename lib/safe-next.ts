/** Only allow redirects to paths on this site ("/upload"), never "//evil.com" or "https://…". */
export function safeNext(next: string | null | undefined, fallback = '/upload') {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback
  return next
}
