import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight } from 'lucide-react'
import { Container, Crumbs } from '@/components/ui'
import { branches, findBranch, semesterHref, semesterLabel } from '@/lib/curriculum'
import { countsBySubject } from '@/lib/data'
import { plural } from '@/lib/format'
import { liveLibrary } from '@/lib/library-live'

export const revalidate = 60

export function generateStaticParams() {
  return branches.map((b) => ({ branch: b.id }))
}

export async function generateMetadata({ params }: PageProps<'/b/[branch]'>): Promise<Metadata> {
  const branch = findBranch((await params).branch)
  return { title: branch ? `${branch.short} · ${branch.name}` : 'Branch' }
}

export default async function BranchPage({ params }: PageProps<'/b/[branch]'>) {
  const branch = findBranch((await params).branch)
  if (!branch) notFound()
  const [counts, lib] = await Promise.all([countsBySubject(), liveLibrary()])
  const total = (code: string) => (counts[code] ?? 0) + lib.count(code)

  return (
    <Container className="pt-10">
      <Crumbs items={[{ href: '/', label: 'Home' }, { label: branch.short }]} />
      <p className="mt-6 text-xs font-semibold tracking-widest text-ink-3 uppercase">
        B.Tech{branch.regulation ? ` · ${branch.regulation}` : ''}
      </p>
      <h1 className="mt-1 max-w-3xl font-display text-3xl font-bold tracking-tight text-balance sm:text-5xl">{branch.name}</h1>
      <p className="mt-3 text-ink-2">Pick a semester to see its subjects and chapters.</p>

      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {branch.semesters.map((s) => {
          const files = s.subjects.reduce((sum, sub) => sum + total(sub.code), 0)
          return (
            <Link
              key={s.sem}
              href={semesterHref(branch.id, s.sem)}
              className="group relative overflow-hidden rounded-3xl border border-line bg-surface p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_30px_80px_-30px_rgba(139,92,246,0.45)]"
            >
              <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/25" />
              <div className="relative flex items-baseline justify-between">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-3 uppercase">Semester {s.sem}</p>
                <p className="text-xs text-ink-3">{plural(files, 'file')}</p>
              </div>
              <h2 className="relative mt-3 font-display text-3xl font-bold tracking-tight">{semesterLabel(s)}</h2>
              <div className="relative mt-5 flex flex-wrap gap-1.5">
                {s.subjects.map((sub) => (
                  <span key={sub.code} className="rounded-lg border border-line bg-white/[0.03] px-2 py-1 text-xs font-medium text-ink-2">
                    {sub.short}
                  </span>
                ))}
              </div>
              <p className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                Open {plural(s.subjects.length, 'subject')} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </p>
            </Link>
          )
        })}
      </div>
    </Container>
  )
}
