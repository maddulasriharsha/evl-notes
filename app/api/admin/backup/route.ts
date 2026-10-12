import { NextResponse } from 'next/server'
import { runBackup } from '@/lib/backup-job'
import { runDatabaseBackup } from '@/lib/db-backup'
import { currentIsOwner, currentProfile } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** "Run backup now" on the admin page. Admins only; the session is checked here, not just in the UI. */
export async function POST(request: Request) {
  const me = await currentProfile()
  if (me?.profile?.role !== 'admin' || !(await currentIsOwner())) return NextResponse.json({ error: 'Only the owner can run backups' }, { status: 403 })
  const what = new URL(request.url).searchParams.get('what')
  if (what === 'database') return NextResponse.json({ database: await runDatabaseBackup() })
  return NextResponse.json(await runBackup(50_000))
}
