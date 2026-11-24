'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus, X } from 'lucide-react'
import { refreshTextbooks } from '@/app/upload/actions'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

const isStaff = (role?: string) => role === 'moderator' || role === 'admin'

/** Staff only: remove a book. The database checks the role again. */
export function TextbookRemove({ id, subject, title }: { id: string; subject: string; title: string }) {
  const viewer = useViewer()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  if (!isStaff(viewer?.role)) return null
  async function remove() {
    if (!confirm(`Remove "${title}" from the list?`)) return
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('staff_remove_textbook', { p_id: id })
    if (error) {
      setBusy(false)
      return alert(error.message)
    }
    await refreshTextbooks(subject).catch(() => undefined)
    router.refresh()
  }
  return (
    <button
      type="button"
      aria-label={`Remove ${title}`}
      title="Remove"
      disabled={busy}
      onClick={remove}
      className="absolute top-2 right-2 grid size-7 place-items-center rounded-lg bg-bg/90 text-danger shadow-card hover:bg-danger-soft"
    >
      {busy ? <Loader2 className="size-3.5 animate-spin" /> : <X className="size-3.5" />}
    </button>
  )
}

/** Staff only: a small form to add a book to this subject. */
export function TextbookAdmin({ subject }: { subject: string }) {
  const viewer = useViewer()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!isStaff(viewer?.role)) return null

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const link = String(f.get('link') ?? '').trim()
    if (link && !/^https:\/\/\S+$/.test(link)) return alert('The link must start with https://')
    setBusy(true)
    const { error } = await supabaseBrowser().rpc('staff_add_textbook', {
      p_subject: subject,
      p_title: String(f.get('title') ?? ''),
      p_authors: String(f.get('authors') ?? ''),
      p_edition: String(f.get('edition') ?? ''),
      p_kind: String(f.get('kind') ?? 'textbook'),
      p_link: link,
    })
    if (error) {
      setBusy(false)
      return alert(error.message)
    }
    await refreshTextbooks(subject).catch(() => undefined)
    setBusy(false)
    setOpen(false)
    router.refresh()
  }

  const input = 'h-10 w-full rounded-xl border border-line bg-bg px-3 text-sm'
  return (
    <div className="mt-4">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-3 text-sm font-medium hover:bg-surface-2">
          <Plus className="size-4" /> Add a book
        </button>
      ) : (
        <form onSubmit={submit} className="grid gap-2 rounded-2xl border border-accent/40 bg-surface p-4 sm:grid-cols-2">
          <input name="title" required minLength={3} maxLength={200} placeholder="Title" aria-label="Title" className={`${input} sm:col-span-2`} />
          <input name="authors" maxLength={200} placeholder="Authors" aria-label="Authors" className={input} />
          <input name="edition" maxLength={60} placeholder="Edition (optional)" aria-label="Edition" className={input} />
          <input name="link" type="url" maxLength={500} placeholder="Link, https://... (publisher or library page, optional)" aria-label="Link" className={`${input} sm:col-span-2`} />
          <select name="kind" aria-label="Type" className={input} defaultValue="textbook">
            <option value="textbook">Textbook</option>
            <option value="reference">Reference book</option>
          </select>
          <div className="flex gap-2">
            <button disabled={busy} className="btn-primary h-10 rounded-xl px-4 text-sm font-semibold disabled:opacity-50">
              {busy ? 'Adding…' : 'Add'}
            </button>
            <button type="button" onClick={() => setOpen(false)} className="h-10 rounded-xl border border-line px-4 text-sm font-medium">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
