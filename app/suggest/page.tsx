import type { Metadata } from 'next'
import Link from 'next/link'
import { SuggestionForm, SUGGESTION_CATEGORIES } from '@/components/suggestion-form'
import { Container, SectionHeading } from '@/components/ui'
import { timeAgo } from '@/lib/format'
import { currentUser, supabaseServer } from '@/lib/supabase/server'

export const metadata: Metadata = { title: 'Suggestion box' }
export const dynamic = 'force-dynamic'

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: 'Sent', cls: 'bg-surface-2 text-ink-3' },
  seen: { label: 'Seen', cls: 'bg-accent-soft text-accent' },
  done: { label: 'Done', cls: 'bg-ok-soft text-ok' },
}

export default async function SuggestPage() {
  const user = await currentUser()
  let mine: { id: string; category: string; body: string; status: string; created_at: string }[] = []
  if (user) {
    const supabase = await supabaseServer()
    const { data } = await supabase
      .from('suggestions')
      .select('id, category, body, status, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    mine = (data ?? []) as typeof mine
  }

  return (
    <Container className="max-w-2xl py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Help us improve</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Suggestion box</h1>
      <p className="mt-2 text-ink-2">
        Missing a subject? Found something broken? Have an idea? Tell us. The site&rsquo;s admin reads every suggestion.
      </p>

      <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink-2">
        VJNOTES is a self-funded, student-made and student-run website, so we work with a few restrictions (free hosting, a daily email
        limit, limited storage). If something is missing, slow or could be better, please tell us here. Every suggestion is read, and we
        will fix what we can.
      </p>

      <div className="mt-8">
        {user ? (
          <SuggestionForm userId={user.id} />
        ) : (
          <div className="rounded-2xl border border-line bg-surface p-6 text-center shadow-card">
            <p className="font-medium">Sign in to send a suggestion</p>
            <p className="mt-1 text-sm text-ink-3">It keeps the box free of spam.</p>
            <Link href="/login?next=/suggest" className="btn-primary mt-4 inline-flex h-11 items-center rounded-xl px-5 text-sm font-semibold">
              Sign in
            </Link>
          </div>
        )}
      </div>

      {mine.length > 0 && (
        <section className="mt-12">
          <SectionHeading title="Your suggestions" hint="Only you and the admin can see these" />
          <ul className="space-y-2">
            {mine.map((s) => (
              <li key={s.id} className="rounded-xl border border-line bg-surface px-4 py-3">
                <div className="flex items-center gap-2 text-xs text-ink-3">
                  <span>{SUGGESTION_CATEGORIES.find(([id]) => id === s.category)?.[1] ?? s.category}</span>
                  <span>· {timeAgo(s.created_at)}</span>
                  <span className={`ml-auto rounded-md px-1.5 py-0.5 font-semibold ${STATUS[s.status]?.cls ?? ''}`}>{STATUS[s.status]?.label ?? s.status}</span>
                </div>
                <p className="mt-1 text-sm break-words whitespace-pre-line">{s.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Container>
  )
}
