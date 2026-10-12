import { NextResponse } from 'next/server'
import { md5, uploadBackup } from '@/lib/drive-backup'
import { currentIsOwner, currentProfile } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Puts one previous-question-paper PDF into the shared Drive folder and returns its Drive id, so the
 * paper can be listed in the library without using the site's storage. Owner only; checked here.
 */
export async function POST(request: Request) {
  const me = await currentProfile()
  if (me?.profile?.role !== 'admin' || !(await currentIsOwner())) {
    return NextResponse.json({ error: 'Only the owner can add papers' }, { status: 403 })
  }
  const form = await request.formData().catch(() => null)
  const file = form?.get('file')
  const name = String(form?.get('name') ?? '').replace(/[^\w .()\-·&,]/g, '').slice(0, 150)
  if (!(file instanceof Blob) || file.size === 0 || file.size > 8 * 1024 * 1024 || !name) {
    return NextResponse.json({ error: 'A PDF file (under 8 MB) and a name are required' }, { status: 400 })
  }
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (String.fromCharCode(...bytes.slice(0, 4)) !== '%PDF') return NextResponse.json({ error: 'Not a PDF' }, { status: 400 })
  try {
    const copy = await uploadBackup({ name: `PYQ_${name}.pdf`, mime: 'application/pdf', bytes })
    if (copy.size !== bytes.length || copy.md5 !== md5(bytes)) return NextResponse.json({ error: 'Drive copy does not match' }, { status: 502 })
    return NextResponse.json({ id: copy.id, size: copy.size })
  } catch (e) {
    return NextResponse.json({ error: String(e instanceof Error ? e.message : e).slice(0, 200) }, { status: 502 })
  }
}
