import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { MaintenanceScene } from '@/components/maintenance-scene'
import { maintenanceState } from '@/lib/maintenance'

export const metadata: Metadata = { title: 'Under maintenance', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

/** What visitors see (with a 503 status) while maintenance mode is on. Admins can preview it with ?preview=1. */
export default async function MaintenancePage({ searchParams }: PageProps<'/maintenance'>) {
  const sp = await searchParams
  const state = await maintenanceState(true)
  if (!state.on && sp.preview !== '1') redirect('/')
  return <MaintenanceScene message={state.message} back={state.back} since={state.since ?? (sp.preview === '1' ? new Date(Date.now() - 754_000).toISOString() : undefined)} />
}
