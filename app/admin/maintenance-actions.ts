'use server'

import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'
import { forgetMaintenance, maintenanceState } from '@/lib/maintenance'
import { currentProfile, currentUser, supabaseServer } from '@/lib/supabase/server'

export type MaintenanceResult = { ok: true } | { ok: false; error: string }

/** Wrong-password attempts per admin, remembered briefly by this server instance. */
const tries = new Map<string, { n: number; until: number }>()
const MAX_TRIES = 5
const WINDOW = 10 * 60_000

const MAX_AHEAD = 60 * 24 * 3600_000 // a schedule can start up to 60 days from now
const MAX_LENGTH = 14 * 24 * 3600_000 // and a lock can last up to 14 days

export interface MaintenanceInput {
  on: boolean
  message: string
  back: string
  /** ISO time to start at; empty or missing means now. */
  startsAt?: string | null
  /** ISO time it switches itself off; empty or missing means "until I switch it off". */
  endsAt?: string | null
  /** Needed to arm it; not needed to switch it off or to extend a lock that is already armed. */
  password?: string
  /** Push the current end time later by this many minutes (keeps everything else as it is). */
  extendMinutes?: number
}

/**
 * Turns maintenance mode on, schedules it, extends it, or switches it off. Admins only (checked here
 * and again by the database function). Arming it needs the admin's password, checked against
 * Supabase with a throwaway client so the admin's own session is untouched. The password is never
 * stored or logged. Times are stored as exact moments; the site works out "locked or not" from them,
 * so the end time takes effect by itself.
 */
export async function setMaintenance(input: MaintenanceInput): Promise<MaintenanceResult> {
  const me = await currentProfile()
  if (me?.profile?.role !== 'admin') return { ok: false, error: 'Admins only.' }
  const user = await currentUser()
  if (!user?.email) return { ok: false, error: 'Sign in again first.' }

  let message = String(input.message ?? '').slice(0, 300)
  let back = String(input.back ?? '').slice(0, 80)
  let starts: Date | null = null
  let ends: Date | null = null
  const now = Date.now()

  if (input.on) {
    const current = await maintenanceState(true)
    const extending = typeof input.extendMinutes === 'number' && current.armed

    if (extending) {
      const mins = Math.min(24 * 60, Math.max(5, Math.round(input.extendMinutes!)))
      const base = current.until ? Math.max(Date.parse(current.until), now) : now
      ends = new Date(base + mins * 60_000)
      starts = current.starts ? new Date(current.starts) : null
      message = current.message ?? message
      back = current.back ?? back
    } else {
      const password = String(input.password ?? '')
      if (!password) return { ok: false, error: 'Enter your password to confirm.' }
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
          error: 'That password did not match. If you only ever sign in with Google, set a password first (use “Forgot your password?” on the login page).',
        }
      }
      tries.delete(user.id)
      await probe.auth.signOut().catch(() => {})

      if (input.startsAt) {
        const t = new Date(input.startsAt)
        if (Number.isNaN(t.getTime())) return { ok: false, error: 'The start time is not valid.' }
        if (t.getTime() > now + MAX_AHEAD) return { ok: false, error: 'Schedule at most 60 days ahead.' }
        // A start in the past (or within a minute) just means "now".
        starts = t.getTime() > now + 60_000 ? t : null
      }
      if (input.endsAt) {
        const t = new Date(input.endsAt)
        if (Number.isNaN(t.getTime())) return { ok: false, error: 'The end time is not valid.' }
        if (t.getTime() <= (starts?.getTime() ?? now) + 60_000) return { ok: false, error: 'The end time must be after the start time.' }
        if (t.getTime() - (starts?.getTime() ?? now) > MAX_LENGTH) return { ok: false, error: 'A maintenance window can be at most 14 days long.' }
        ends = t
      }
    }
  }

  const supabase = await supabaseServer()
  const { error } = await supabase.rpc('admin_set_maintenance', {
    p_on: Boolean(input.on),
    p_message: message,
    p_back: back,
    p_starts: starts ? starts.toISOString() : null,
    p_ends: ends ? ends.toISOString() : null,
  })
  if (error) {
    return {
      ok: false,
      error: /does not exist|schema cache|could not find/i.test(error.message) ? 'Run run-this-maintenance-schedule.sql in Supabase first.' : error.message,
    }
  }
  forgetMaintenance()
  revalidatePath('/admin')
  revalidatePath('/maintenance')
  return { ok: true }
}
