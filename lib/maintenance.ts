import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from '@/lib/env'

export interface Maintenance {
  on: boolean
  message?: string
  back?: string
  since?: string
}

/** A few seconds of memory per server instance, so the proxy does not ask the database on every request. */
let cache: { at: number; value: Maintenance } | null = null
const TTL = 8_000

/**
 * Is the site in maintenance mode? Read with the public key (the flag is public by design).
 * If the database cannot be reached the site stays open: a broken check must never lock everyone out.
 */
export async function maintenanceState(fresh = false): Promise<Maintenance> {
  if (!supabaseConfigured) return { on: false }
  if (!fresh && cache && Date.now() - cache.at < TTL) return cache.value
  try {
    const headers: Record<string, string> = { apikey: supabaseAnonKey }
    // Legacy anon keys are JWTs and also go in the Authorization header; publishable keys must not.
    if (supabaseAnonKey.startsWith('eyJ')) headers.Authorization = `Bearer ${supabaseAnonKey}`
    const res = await fetch(`${supabaseUrl}/rest/v1/site_settings?key=eq.maintenance&select=value`, {
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const rows = (await res.json()) as { value?: Record<string, unknown> }[]
      const v = rows[0]?.value ?? {}
      const value: Maintenance = {
        on: v.on === true,
        message: typeof v.message === 'string' ? v.message : undefined,
        back: typeof v.back === 'string' ? v.back : undefined,
        since: typeof v.since === 'string' ? v.since : undefined,
      }
      cache = { at: Date.now(), value }
      return value
    }
  } catch {
    /* fall through: keep the last known answer, or stay open */
  }
  // Remember the failure for a moment too, so an outage does not add a timeout to every request.
  const value = cache?.value ?? { on: false }
  cache = { at: Date.now(), value }
  return value
}

/** Forget the remembered answer (after an admin changes it, in the same instance). */
export function forgetMaintenance() {
  cache = null
}
