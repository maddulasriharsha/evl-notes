import type { Metadata } from 'next'
import { Container, Empty, OwnerName } from '@/components/ui'
import { contributors } from '@/lib/data'
import { plural, timeAgo } from '@/lib/format'

export const metadata: Metadata = { title: 'Contributors' }
export const revalidate = 120

function badgesFor(p: { files: number; chapters: number; subjects: number }) {
  const out: { label: string; cls: string }[] = []
  if (p.files >= 25) out.push({ label: 'Legend', cls: 'bg-gold-soft text-gold' })
  else if (p.files >= 10) out.push({ label: 'Star', cls: 'bg-gold-soft text-gold' })
  else if (p.files >= 3) out.push({ label: 'Regular', cls: 'bg-accent-soft text-accent' })
  else out.push({ label: 'New', cls: 'bg-surface-2 text-ink-3' })
  if (p.subjects >= 4) out.push({ label: 'All-rounder', cls: 'bg-ok-soft text-ok' })
  if (p.chapters >= 8) out.push({ label: 'Wide coverage', cls: 'bg-ok-soft text-ok' })
  return out
}

export default async function ContributorsPage() {
  const people = await contributors()
  return (
    <Container className="py-10">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Thank you</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">Contributors</h1>
      <p className="mt-2 max-w-xl text-ink-2">The classmates who write things down so everyone else can catch up.</p>
      <div className="mt-8">
        {people.length === 0 ? (
          <Empty title="No uploads yet">Be the first: your name goes here.</Empty>
        ) : (
          <ol className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            {people.map((p, i) => (
              <li key={p.id} className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0">
                <span className={`w-6 text-right font-display text-lg font-semibold tabular-nums ${i < 3 ? 'text-gold' : 'text-ink-3'}`}>{i + 1}</span>
                <span className="grid size-10 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{p.name.charAt(0).toUpperCase()}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex font-medium"><OwnerName name={p.name} admin={p.is_admin} moderator={p.is_mod} /></p>
                  <p className="text-xs text-ink-3">
                    {plural(p.chapters, 'chapter')} · {plural(p.subjects, 'subject')} · last upload {timeAgo(p.last)}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {badgesFor(p).map((b) => (
                      <span key={b.label} className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${b.cls}`}>
                        {b.label}
                      </span>
                    ))}
                  </p>
                </div>
                <span className="rounded-lg bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums">{plural(p.files, 'file')}</span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Container>
  )
}
