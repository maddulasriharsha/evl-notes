/**
 * Public configuration. Both values are safe to expose to the browser: the anon/publishable
 * key only grants what row-level security allows.
 */
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
export const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

/** False until the owner adds the Supabase keys. Browsing still works; uploads are disabled. */
export const supabaseConfigured = /^https:\/\//.test(supabaseUrl) && supabaseAnonKey.length > 20

export const STORAGE_BUCKET = 'notes'

export function publicFileUrl(path: string, download?: string) {
  const base = `${supabaseUrl}/storage/v1/object/public/${STORAGE_BUCKET}/${path.split('/').map(encodeURIComponent).join('/')}`
  return download === undefined ? base : `${base}?download=${encodeURIComponent(download)}`
}
