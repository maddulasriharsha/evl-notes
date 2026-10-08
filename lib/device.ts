/** Rough device type from a user-agent string, for the admin sign-in log. */
export function deviceFromUserAgent(ua: string | null | undefined): 'mobile' | 'tablet' | 'desktop' {
  const s = ua ?? ''
  if (/iPad|Tablet|PlayBook|Silk|Android(?!.*Mobile)/i.test(s)) return 'tablet'
  if (/Mobi|iPhone|iPod|Android|Windows Phone/i.test(s)) return 'mobile'
  return 'desktop'
}
