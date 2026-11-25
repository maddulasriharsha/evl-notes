import { NextResponse } from 'next/server'
import { maintenanceState } from '@/lib/maintenance'

/** Public status the maintenance page checks every few seconds, so it can send visitors back the moment the site reopens. */
export async function GET() {
  const m = await maintenanceState()
  return NextResponse.json({ on: m.on, phase: m.phase, until: m.until ?? null }, { headers: { 'Cache-Control': 'no-store' } })
}
