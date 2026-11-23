'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAnonKey, supabaseUrl } from '@/lib/env'

/*
 * The Supabase client is the biggest script on the site, and most visitors only read notes, which
 * needs no client at all. So it is downloaded the first time something really sends a request, never
 * with the page.
 *
 * supabaseBrowser() still hands back a client at once: a stand-in that writes down the calls
 * (`.from('files').update(…).eq('id', id)`) and, when the result is awaited, loads the real client
 * and replays them on it. Everything that only awaits results works unchanged. Code that needs an
 * answer without awaiting (a listener such as auth.onAuthStateChange) uses loadSupabase() instead.
 */

let real: Promise<SupabaseClient> | undefined

/** The real client, downloaded on first use and shared after that. */
export function loadSupabase(): Promise<SupabaseClient> {
  real ??= import('@supabase/ssr').then(({ createBrowserClient }) => createBrowserClient(supabaseUrl, supabaseAnonKey))
  return real
}

type Step = { get: PropertyKey } | { call: unknown[] }

function replay(client: SupabaseClient, steps: Step[]): unknown {
  let value: unknown = client
  let owner: unknown = undefined
  for (const step of steps) {
    if ('get' in step) {
      owner = value
      value = (value as Record<PropertyKey, unknown>)[step.get]
    } else {
      value = (value as (...args: unknown[]) => unknown).apply(owner, step.call)
      owner = undefined
    }
  }
  return value
}

function deferred(steps: Step[]): unknown {
  const settle = () => loadSupabase().then((client) => replay(client, steps))
  // A function target, so the stand-in can be called as well as read.
  return new Proxy(function stand() {}, {
    get(_target, prop) {
      if (prop === 'then') return (ok?: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => settle().then(ok, bad)
      if (prop === 'catch') return (bad?: (e: unknown) => unknown) => settle().catch(bad)
      if (prop === 'finally') return (done?: () => void) => settle().finally(done)
      return deferred([...steps, { get: prop }])
    },
    apply(_target, _this, args: unknown[]) {
      return deferred([...steps, { call: args }])
    },
  })
}

/** The browser client. Requests made through it load the real client first (see above). */
export function supabaseBrowser(): SupabaseClient {
  return deferred([]) as SupabaseClient
}

/**
 * Whether this browser holds a sign-in. Supabase keeps the session in a cookie named after the
 * project ("sb-<project>-auth-token", split into ".0", ".1" when long), so no request or script is
 * needed to know that someone is signed out.
 */
export function hasSession(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const project = new URL(supabaseUrl).hostname.split('.')[0]
    return document.cookie.split(';').some((c) => c.trim().startsWith(`sb-${project}-auth-token`))
  } catch {
    return false
  }
}

/**
 * A request to the database's public API without the client, for anonymous reads and calls
 * (announcements, the visit counter). Row-level security applies exactly as it does to the client.
 */
export async function publicRest<T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }): Promise<T> {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: init?.method ?? 'GET',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      ...(init?.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}
