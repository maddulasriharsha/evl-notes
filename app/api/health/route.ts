import { NextResponse } from 'next/server'
import { supabasePublic } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * For an uptime monitor (UptimeRobot, Better Stack, ...): answers 200 only when the site is up AND
 * the database answers. Reveals nothing about the data.
 */
export async function GET() {
  const started = Date.now()
  let database = false
  try {
    const { error } = await supabasePublic().from('announcements').select('id', { head: true, count: 'exact' }).limit(1)
    database = !error
  } catch {
    database = false
  }
  return NextResponse.json(
    { ok: database, database, ms: Date.now() - started },
    { status: database ? 200 : 503, headers: { 'Cache-Control': 'no-store' } },
  )
}
