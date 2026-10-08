import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SubjectCard } from '@/components/subject-card'
import { Container, Crumbs } from '@/components/ui'
import { regularSemesters, semesterLabel } from '@/lib/curriculum'
import { countsBySubject } from '@/lib/data'
import { driveCount } from '@/lib/library'

export const revalidate = 60

export function generateStaticParams() {
  return regularSemesters.map((s) => ({ sem: String(s.sem) }))
}

function find(sem: string) {
  return regularSemesters.find((s) => String(s.sem) === sem)
}

export async function generateMetadata({ params }: PageProps<'/sem/[sem]'>): Promise<Metadata> {
  const s = find((await params).sem)
  return { title: s ? semesterLabel(s) : 'Semester' }
}

export default async function SemesterPage({ params }: PageProps<'/sem/[sem]'>) {
  const semester = find((await params).sem)
  if (!semester) notFound()
  const counts = await countsBySubject()
  const theory = semester.subjects.filter((s) => s.kind !== 'lab')
  const labs = semester.subjects.filter((s) => s.kind === 'lab')
  const count = (code: string) => (counts[code] ?? 0) + driveCount(code)
  const others = regularSemesters.filter((s) => s.sem !== semester.sem)

  return (
    <Container className="pt-10">
      <Crumbs items={[{ href: '/', label: 'Home' }, { label: `Semester ${semester.sem}` }]} />
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Semester {semester.sem}</p>
          <h1 className="mt-1 font-display text-4xl font-semibold tracking-tight">{semesterLabel(semester)}</h1>
        </div>
        <div className="flex gap-1 rounded-xl border border-line bg-surface p-1 text-sm">
          {regularSemesters.map((s) => (
            <a
              key={s.sem}
              href={`/sem/${s.sem}`}
              aria-current={s.sem === semester.sem ? 'page' : undefined}
              className={`rounded-lg px-3 py-1.5 font-medium ${s.sem === semester.sem ? 'bg-ink text-bg' : 'text-ink-2 hover:bg-surface-2'}`}
            >
              Sem {s.sem}
            </a>
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
      <p className="mt-12 text-sm text-ink-3">
        Other semesters:{' '}
        {others.map((s, i) => (
          <span key={s.sem}>
            {i > 0 && ' · '}
            <a href={`/sem/${s.sem}`} className="font-medium text-ink-2 hover:text-ink">
              {semesterLabel(s)}
            </a>
          </span>
        ))}
      </p>
    </Container>
  )
}
