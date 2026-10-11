import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { supabaseUrl } from '@/lib/env'

/** True once SUPABASE_SERVICE_ROLE_KEY is set on the server. */
export function adminConfigured() {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY
}

/**
 * Full-access client that bypasses row-level security. Only for the backup job, which has to read
 * every file and delete originals. Never import this from code a visitor can trigger directly, and
 * never send what it returns to the browser without checking who is asking.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  return createClient(supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
