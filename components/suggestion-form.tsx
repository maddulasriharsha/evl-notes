'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Send } from 'lucide-react'
import { supabaseBrowser } from '@/lib/supabase/browser'

export const SUGGESTION_CATEGORIES: [string, string][] = [
  ['feature', 'A feature I want'],
  ['bug', 'Something is broken'],
  ['content', 'Notes or subjects missing'],
  ['other', 'Something else'],
]

/** Writes to the suggestion box. Only the site's staff can read what is written here. */
export function SuggestionForm({ userId }: { userId: string }) {
  const router = useRouter()
  const [category, setCategory] = useState('feature')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function send(e: React.FormEvent) {
    e.preventDefault()
    const text = body.trim()
    if (text.length < 5) return setError('Write at least a few words so we understand.')
    setBusy(true)
    setError(null)
    const { error } = await supabaseBrowser().from('suggestions').insert({ author_id: userId, category, body: text.slice(0, 1000) })
    setBusy(false)
    if (error) {
      return setError(/policy|row-level/i.test(error.message) ? 'You have sent a lot today. Please try again tomorrow.' : error.message)
    }
    setBody('')
    setSent(true)
    router.refresh()
  }

  return (
    <form onSubmit={send} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <fieldset className="grid gap-2 sm:grid-cols-2">
        {SUGGESTION_CATEGORIES.map(([id, label]) => (
          <label
            key={id}
            className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm ${category === id ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}
          >
            <input type="radio" name="category" value={id} checked={category === id} onChange={() => setCategory(id)} className="accent-[var(--accent)]" />
            {label}
          </label>
        ))}
      </fieldset>
      <textarea
        value={body}
        onChange={(e) => {
          setBody(e.target.value.slice(0, 1000))
          setSent(false)
        }}
        rows={5}
        placeholder="Tell us what would make the site better…"
        aria-label="Your suggestion"
        className="mt-3 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
      />
      <div className="mt-1 text-right text-xs text-ink-3">{body.length}/1000</div>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      {sent && (
        <p className="mt-2 flex items-center gap-2 rounded-xl bg-ok-soft px-3 py-2 text-sm text-ok">
          <Check className="size-4" /> Thank you! Your suggestion was sent.
        </p>
      )}
      <button disabled={busy || body.trim().length < 5} className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} Send suggestion
      </button>
    </form>
  )
}
