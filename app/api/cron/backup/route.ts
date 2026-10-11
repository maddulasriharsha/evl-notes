import { NextResponse } from 'next/server'
import { runBackup } from '@/lib/backup-job'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Called once a day by Vercel Cron, which sends `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json(await runBackup(50_000))
}
