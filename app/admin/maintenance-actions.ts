'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'
import { forgetMaintenance } from '@/lib/maintenance'
import { currentProfile, currentUser, supabaseServer } from '@/lib/supabase/server'

export type MaintenanceResult = { ok: true } | { ok: false; error: string }

/** Wrong-password attempts per admin, remembered briefly by this server instance. */
const tries = new Map<string, { n: number; until: number }>()
const MAX_TRIES = 5
const WINDOW = 10 * 60_000

/**
 * Turns maintenance mode on or off. Admins only (checked here and again by the database function).
 * Switching it ON also needs the admin's password, checked against Supabase with a throwaway
 * client so the admin's own session cookies are untouched. The password is never stored or logged.
 */
export async function setMaintenance(input: { on: boolean; message: string; back: string; password?: string }): Promise<MaintenanceResult> {
  const me = await currentProfile()
  if (me?.profile?.role !== 'admin') return { ok: false, error: 'Admins only.' }
  const user = await currentUser()
  if (!user?.email) return { ok: false, error: 'Sign in again first.' }

  if (input.on) {
    const password = String(input.password ?? '')
    if (!password) return { ok: false, error: 'Enter your password to confirm.' }
    const now = Date.now()
    const seen = tries.get(user.id)
    if (seen && seen.until > now && seen.n >= MAX_TRIES) {
      return { ok: false, error: 'Too many wrong passwords. Wait a few minutes and try again.' }
    }
    const probe = createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } })
    const { error } = await probe.auth.signInWithPassword({ email: user.email, password })
    if (error) {
      const n = seen && seen.until > now ? seen.n + 1 : 1
      tries.set(user.id, { n, until: seen && seen.until > now ? seen.until : now + WINDOW })
      return {
        ok: false,
        error: 'That password did not match. If you only ever sign in with Google, set a password first (use “Forgot password” on the login page).',
      }
    }
    tries.delete(user.id)
    await probe.auth.signOut().catch(() => {})
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('admin_set_maintenance', {
    p_on: Boolean(input.on),
    p_message: String(input.message ?? '').slice(0, 300),
    p_back: String(input.back ?? '').slice(0, 80),
  })
  if (error) return { ok: false, error: error.message.includes('does not exist') ? 'Run run-this-site-settings.sql in Supabase first.' : error.message }
  forgetMaintenance()
  revalidatePath('/admin')
  revalidatePath('/maintenance')
  return { ok: true }
}
