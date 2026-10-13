import 'server-only'

import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from '@/lib/env'

/** Signed-in user's client (reads cookies). Row-level security applies as that user. */
export async function supabaseServer() {
  const cookieStore = await cookies()
  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options)
        } catch {
          // Called from a Server Component: the proxy refreshes the session instead.
        }
      },
    },
  })
}

/** Anonymous client for public pages, so they can be cached. Sees only public rows. */
export function supabasePublic() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/**
 * The signed-in person, from their verified session token. getClaims() checks the token's
 * signature locally (no round trip to Supabase), which keeps signed-in pages fast.
 */
export async function currentUser(): Promise<{ id: string; email?: string } | null> {
  if (!supabaseConfigured) return null
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null
  return { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined }
}

export interface Profile {
  id: string
  display_name: string
  role: 'member' | 'moderator' | 'admin'
  banned_at: string | null
  /** Branch slug (as in /b/{branch}); null until the member picks one. */
  branch: string | null
}

export async function currentProfile(): Promise<{ user: { id: string; email?: string }; profile: Profile | null } | null> {
  const user = await currentUser()
  if (!user) return null
  const supabase = await supabaseServer()
  const { data } = await supabase.from('profiles').select('id, display_name, role, banned_at, branch').eq('id', user.id).maybeSingle()
  return { user, profile: (data as Profile | null) ?? null }
}

/** True only for the site owner (an admin whose sign-in email is listed in site_owners). */
export async function currentIsOwner(): Promise<boolean> {
  const user = await currentUser()
  if (!user) return false
  const supabase = await supabaseServer()
  const { data } = await supabase.rpc('is_owner')
  return data === true
}
