import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'
import { runBackup } from '@/lib/backup-job'
import { runDatabaseBackup } from '@/lib/db-backup'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Called once a day by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  // Files first (time-boxed), then the database export, which is quick.
  const files = await runBackup(38_000)
  // Moved originals change the links on every page that lists them.
  if (files.removed > 0) revalidatePath('/', 'layout')
  const database = await runDatabaseBackup()
  return NextResponse.json({ ...files, database })
}
