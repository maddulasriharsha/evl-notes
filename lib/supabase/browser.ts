'use client'

import { createBrowserClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

let client: SupabaseClient | undefined

export function supabaseBrowser(): SupabaseClient {
  client ??= createBrowserClient(supabaseUrl, supabaseAnonKey)
  return client
}
