import { notFound, permanentRedirect } from 'next/navigation'
import { branches, semesterHref } from '@/lib/curriculum'

/** Old links (/sem/2) from before branches existed go to the first branch (EVL). */
export default async function LegacySemesterRedirect({ params }: PageProps<'/sem/[sem]'>) {
  const { sem } = await params
  const first = branches[0]
  if (!first || !first.semesters.some((s) => String(s.sem) === sem)) notFound()
  permanentRedirect(semesterHref(first.id, Number(sem)))
}
