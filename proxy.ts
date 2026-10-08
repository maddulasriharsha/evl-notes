import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAnonKey, supabaseConfigured, supabaseUrl } from '@/lib/env'

/** Keeps the Supabase session cookie fresh. Authorization itself is enforced by RLS. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })
  if (!supabaseConfigured) return response

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
  // Only routes that need a session; public browsing pages stay cacheable.
  matcher: ['/upload/:path*', '/me/:path*', '/admin/:path*', '/login', '/auth/:path*'],
}
