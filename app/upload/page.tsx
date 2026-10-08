import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ProfileForm } from '@/components/profile-form'
import { Uploader } from '@/components/uploader'
import { Container } from '@/components/ui'
import { findSubject } from '@/lib/curriculum'
import { supabaseConfigured } from '@/lib/env'
import { currentProfile, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Upload notes' }
export const dynamic = 'force-dynamic'

export default async function UploadPage({ searchParams }: PageProps<'/upload'>) {
  const sp = await searchParams
  const subject = typeof sp.subject === 'string' ? findSubject(sp.subject)?.subject.code : undefined
  const unitRaw = typeof sp.unit === 'string' ? Number(sp.unit) : NaN
  const unit = Number.isInteger(unitRaw) && unitRaw >= 0 && unitRaw <= 5 ? unitRaw : undefined
  const here = `/upload${subject ? `?subject=${subject}${unit !== undefined ? `&unit=${unit}` : ''}` : ''}`

  if (!supabaseConfigured) {
    return (
      <Container className="py-16">
        <h1 className="font-display text-3xl font-semibold">Uploads are not switched on yet</h1>
        <p className="mt-3 max-w-xl text-ink-2">The site owner still needs to connect Supabase. Browsing already works.</p>
      </Container>
    )
  }

  const me = await currentProfile()
  if (!me) redirect(`/login?next=${encodeURIComponent(here)}`)

  if (!me.profile) {
    const supabase = await supabaseServer()
    const { data } = await supabase.auth.getUser()
    const suggested = String(data.user?.user_metadata?.full_name ?? data.user?.user_metadata?.name ?? '')
    return (
      <Container className="grid min-h-[60dvh] place-items-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-8 shadow-pop">
          <h1 className="font-display text-3xl font-semibold tracking-tight">One last thing</h1>
          <p className="mt-2 mb-6 text-sm text-ink-3">Pick the name your classmates will see on your notes.</p>
          <ProfileForm userId={me.user.id} initialName={suggested} existing={false} />
        </div>
      </Container>
    )
  }

  const supabase = await supabaseServer()
  const { data: mine } = await supabase
    .from('collections')
    .select('id, subject_code, unit, files(id)')
    .eq('owner_id', me.user.id)
    .is('files.deleted_at', null)
  const existing = ((mine ?? []) as { id: string; subject_code: string; unit: number; files: { id: string }[] }[]).map((c) => ({
    id: c.id,
    subject: c.subject_code,
    unit: c.unit,
    files: c.files.length,
  }))

  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Upload as {me.profile.display_name}</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Share your notes</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Choose the chapter, add photos or PDFs, and they join your shelf for that chapter. Uploading again later adds
        to the same shelf, so everything stays together under your name.
      </p>
      <Uploader userId={me.user.id} initialSubject={subject} initialUnit={unit} existing={existing} />
    </Container>
  )
}
