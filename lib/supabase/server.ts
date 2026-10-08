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

export async function currentUser() {
  if (!supabaseConfigured) return null
  const supabase = await supabaseServer()
  const { data } = await supabase.auth.getUser()
  return data.user ?? null
}

export interface Profile {
  id: string
  display_name: string
  role: 'member' | 'admin'
  banned_at: string | null
}

export async function currentProfile(): Promise<{ user: { id: string; email?: string }; profile: Profile | null } | null> {
  const user = await currentUser()
  if (!user) return null
  const supabase = await supabaseServer()
  const { data } = await supabase.from('profiles').select('id, display_name, role, banned_at').eq('id', user.id).maybeSingle()
  return { user: { id: user.id, email: user.email }, profile: (data as Profile | null) ?? null }
}
