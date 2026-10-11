import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SubjectCard } from '@/components/subject-card'
import { Container, Crumbs } from '@/components/ui'
import { branches, branchHref, findBranch, semesterHref, semesterLabel } from '@/lib/curriculum'
import { countsBySubject } from '@/lib/data'
import { driveCount } from '@/lib/library'

export const revalidate = 60

export function generateStaticParams() {
  return branches.flatMap((b) => b.semesters.map((s) => ({ branch: b.id, sem: String(s.sem) })))
}

function find(branchId: string, sem: string) {
  const branch = findBranch(branchId)
  const semester = branch?.semesters.find((s) => String(s.sem) === sem)
  return branch && semester ? { branch, semester } : null
}

export async function generateMetadata({ params }: PageProps<'/b/[branch]/sem/[sem]'>): Promise<Metadata> {
  const { branch, sem } = await params
  const found = find(branch, sem)
  return { title: found ? `${found.branch.short} · ${semesterLabel(found.semester)}` : 'Semester' }
}

export default async function SemesterPage({ params }: PageProps<'/b/[branch]/sem/[sem]'>) {
  const { branch: branchId, sem } = await params
  const found = find(branchId, sem)
  if (!found) notFound()
  const { branch, semester } = found
  const counts = await countsBySubject()
  const theory = semester.subjects.filter((s) => s.kind !== 'lab')
  const labs = semester.subjects.filter((s) => s.kind === 'lab')
  const count = (code: string) => (counts[code] ?? 0) + driveCount(code)

  return (
    <Container className="pt-10">
      <Crumbs
        items={[
          { href: '/', label: 'Home' },
          { href: branchHref(branch.id), label: branch.short },
          { label: `Semester ${semester.sem}` },
        ]}
      />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
            {branch.short} · Semester {semester.sem}
          </p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{semesterLabel(semester)}</h1>
        </div>
        <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {branch.semesters.map((s) => (
            <Link
              key={s.sem}
              href={semesterHref(branch.id, s.sem)}
              aria-current={s.sem === semester.sem ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium ${s.sem === semester.sem ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2'}`}
            >
              Sem {s.sem}
            </Link>
          ))}
        </div>
      </div>

      <h2 className="mt-10 mb-4 text-sm font-semibold tracking-widest text-ink-3 uppercase">Theory</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {theory.map((s) => (
          <SubjectCard key={s.code} subject={s} count={count(s.code)} />
        ))}
      </div>
      {labs.length > 0 && (
        <>
          <h2 className="mt-12 mb-4 text-sm font-semibold tracking-widest text-ink-3 uppercase">Labs & skill courses</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {labs.map((s) => (
              <SubjectCard key={s.code} subject={s} count={count(s.code)} />
            ))}
          </div>
        </>
      )}
    </Container>
  )
}
