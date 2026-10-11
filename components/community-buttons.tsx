'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellPlus, BellRing, HandHelping, Loader2 } from 'lucide-react'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

const btn = 'inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong disabled:opacity-50'

/** "I need notes for this chapter": adds one open request per person per chapter. */
export function RequestNotesButton({ subject, unit }: { subject: string; unit: number }) {
  const viewer = useViewer()
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!viewer) return
    let live = true
    supabaseBrowser()
      .from('note_requests')
      .select('id')
      .eq('requester_id', viewer.id)
      .eq('subject_code', subject)
      .eq('unit', unit)
      .is('closed_at', null)
      .maybeSingle()
      .then(({ data }) => live && data && setState('done'))
    return () => {
      live = false
    }
  }, [viewer, subject, unit])

  async function request() {
    if (!viewer) return router.push(`/login?next=${encodeURIComponent(`/s/${subject.toLowerCase()}`)}`)
    setState('busy')
    const { error } = await supabaseBrowser().from('note_requests').insert({ requester_id: viewer.id, subject_code: subject, unit })
    if (error && error.code !== '23505') {
      setState('idle')
      return setMessage(error.message)
    }
    setState('done')
    router.refresh()
  }

  return (
    <div>
      <button type="button" onClick={request} disabled={state !== 'idle'} className={btn}>
        {state === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <HandHelping className="size-4" />}
        {state === 'done' ? 'Requested. Thanks!' : 'Request notes for this chapter'}
      </button>
      {message && <p className="mt-2 text-sm text-danger">{message}</p>}
    </div>
  )
}

/** Follow a subject to see its newest notes on the Following page. */
export function FollowButton({ subject }: { subject: string }) {
  const viewer = useViewer()
  const router = useRouter()
  const [following, setFollowing] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!viewer) return
    let live = true
    supabaseBrowser()
      .from('follows')
      .select('subject_code')
      .eq('user_id', viewer.id)
      .eq('subject_code', subject)
      .maybeSingle()
      .then(({ data }) => live && setFollowing(!!data))
    return () => {
      live = false
    }
  }, [viewer, subject])

  async function toggle() {
    if (!viewer) return router.push(`/login?next=${encodeURIComponent(`/s/${subject.toLowerCase()}`)}`)
    setBusy(true)
    const db = supabaseBrowser().from('follows')
    const { error } = following
      ? await db.delete().eq('user_id', viewer.id).eq('subject_code', subject)
      : await db.insert({ user_id: viewer.id, subject_code: subject })
    setBusy(false)
    if (error) return alert(error.message)
    setFollowing(!following)
  }

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={following} className={`${btn} ${following ? 'border-accent bg-accent-soft text-accent' : ''}`}>
      {busy ? <Loader2 className="size-4 animate-spin" /> : following ? <BellRing className="size-4" /> : <BellPlus className="size-4" />}
      {following ? 'Following' : 'Follow subject'}
    </button>
  )
}
