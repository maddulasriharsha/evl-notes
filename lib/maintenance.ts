import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from '@/lib/env'

export type Phase = 'off' | 'scheduled' | 'live' | 'ended'

export interface Maintenance {
  /** True only while the site is really locked: armed, started, and not yet past its end time. */
  on: boolean
  /** The admin switched it on (it may not have started yet, or may already have ended). */
  armed: boolean
  phase: Phase
  message?: string
  back?: string
  /** ISO times. `since` is when the lock began (or will begin); `starts` is set only when it was scheduled. */
  since?: string
  starts?: string
  until?: string
}

interface Raw {
  armed: boolean
  message?: string
  back?: string
  since?: string
  starts?: string
  until?: string
}

/** A few seconds of memory per server instance, so the proxy does not ask the database on every request. */
let cache: { at: number; raw: Raw } | null = null
const TTL = 8_000

/** Works out the phase from the saved settings and the current time (nothing has to run when a time passes). */
export function phaseOf(raw: Raw, now = Date.now()): Phase {
  if (!raw.armed) return 'off'
  const starts = raw.starts ? Date.parse(raw.starts) : NaN
  const until = raw.until ? Date.parse(raw.until) : NaN
  if (Number.isFinite(starts) && now < starts) return 'scheduled'
  if (Number.isFinite(until) && now >= until) return 'ended'
  return 'live'
}

function view(raw: Raw): Maintenance {
  const phase = phaseOf(raw)
  return { ...raw, phase, on: phase === 'live' }
}

const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

/**
 * Is the site in maintenance mode? Read with the public key (the flag is public by design).
 * If the database cannot be reached the site stays open: a broken check must never lock everyone out.
 */
export async function maintenanceState(fresh = false): Promise<Maintenance> {
  if (!supabaseConfigured) return view({ armed: false })
  if (!fresh && cache && Date.now() - cache.at < TTL) return view(cache.raw)
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
      const raw: Raw = {
        armed: v.on === true,
        message: str(v.message),
        back: str(v.back),
        since: str(v.since),
        starts: str(v.starts),
        until: str(v.until),
      }
      cache = { at: Date.now(), raw }
      return view(raw)
    }
  } catch {
    /* fall through: keep the last known answer, or stay open */
  }
  // Remember the failure for a moment too, so an outage does not add a timeout to every request.
  const raw = cache?.raw ?? { armed: false }
  cache = { at: Date.now(), raw }
  return view(raw)
}

/** Forget the remembered answer (after an admin changes it, in the same instance). */
export function forgetMaintenance() {
  cache = null
}
