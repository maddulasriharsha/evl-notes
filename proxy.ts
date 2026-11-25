import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from '@/lib/env'
import { maintenanceState } from '@/lib/maintenance'

/** Routes that need the Supabase session kept fresh. Public pages skip this and stay cacheable. */
const SESSION = /^\/(upload|me|saved|api\/admin|admin|login|auth)(\/|$)/

/**
 * Still reachable during maintenance, so an admin can sign in and switch it off again, and so
 * health checks, the daily backup job and the app shell keep working.
 */
const OPEN = /^\/(maintenance|login|auth|admin|api\/(health|cron|admin|password|maintenance)|_next|_vercel|sw\.js|manifest|pwa|icon|favicon|robots|sitemap|apple-icon)/

/** True for a signed-in admin (read-only check of the session; nothing is written to cookies). */
async function isAdmin(request: NextRequest) {
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, { cookies: { getAll: () => request.cookies.getAll(), setAll: () => {} } })
  const { data } = await supabase.auth.getClaims()
  const id = data?.claims?.sub
  if (!id) return false
  const { data: row } = await supabase.from('profiles').select('role').eq('id', id).maybeSingle()
  return row?.role === 'admin'
}

const HEADERS = { 'Retry-After': '900', 'Cache-Control': 'no-store' }

export async function proxy(request: NextRequest) {
  if (!supabaseConfigured) return NextResponse.next({ request })
  const { pathname } = request.nextUrl

  // Maintenance mode: everyone except admins sees only the maintenance page.
  if (!OPEN.test(pathname)) {
    const maint = await maintenanceState()
    if (maint.on && !(await isAdmin(request))) {
      const page = (request.method === 'GET' || request.method === 'HEAD') && !pathname.startsWith('/api/')
      if (page) return NextResponse.rewrite(new URL('/maintenance', request.url), { status: 503, headers: HEADERS })
      return NextResponse.json({ error: 'The site is under maintenance. Please try again soon.' }, { status: 503, headers: HEADERS })
    }
  }

  let response = NextResponse.next({ request })
  if (!SESSION.test(pathname)) return response

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        response = NextResponse.next({ request })
        for (const { name, value, options } of list) response.cookies.set(name, value, options)
      },
    },
  })
  // Refreshes an expired session; verifies the token locally where possible.
  await supabase.auth.getClaims()
  return response
}

export const config = {
  // Every page and API route (the maintenance check needs them all), but not static files.
  matcher: ['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|js|css|woff2?|txt|xml|webmanifest|map)$).*)'],
}
