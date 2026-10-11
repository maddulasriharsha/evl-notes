import { NextResponse } from 'next/server'
import { runBackup } from '@/lib/backup-job'
import { currentProfile } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** "Run backup now" on the admin page. Admins only; the session is checked here, not just in the UI. */
export async function POST() {
  const me = await currentProfile()
  if (me?.profile?.role !== 'admin') return NextResponse.json({ error: 'Admins only' }, { status: 403 })
  return NextResponse.json(await runBackup(50_000))
}
