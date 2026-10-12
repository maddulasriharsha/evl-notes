import { notFound } from 'next/navigation'
import { currentIsOwner } from '@/lib/supabase/server'
import { PaperImporter } from './importer'

export const dynamic = 'force-dynamic'

/** One-off owner tool: sends paper PDFs to Drive and reports their ids. Remove once the papers are imported. */
export default async function Page() {
  if (!(await currentIsOwner())) notFound()
  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="font-display text-2xl font-semibold">Import question papers</h1>
      <PaperImporter />
    </main>
  )
}
