import data from '@/data/curriculum.json'

export type SubjectKind = 'theory' | 'lab' | 'extra'

export interface Subject {
  code: string
  name: string
  short: string
  credits: number
  kind: SubjectKind
  /** Chapter (unit) titles, in order. Empty for labs without units. */
  units: string[]
}

export interface Semester {
  year: number
  /** 1–4 for regular semesters, 0 for the Extras shelf. */
  sem: number
  label?: string
  subjects: Subject[]
}

export const semesters = data as Semester[]

/** Regular semesters only (Extras excluded), in order. */
export const regularSemesters = semesters.filter((s) => s.sem > 0)
export const extras = semesters.find((s) => s.sem === 0)

const byCode = new Map<string, { subject: Subject; semester: Semester }>()
for (const semester of semesters) {
  for (const subject of semester.subjects) byCode.set(subject.code, { subject, semester })
}

export function findSubject(code: string) {
  return byCode.get(code.toUpperCase())
}

export function allSubjects() {
  return [...byCode.values()]
}

export function semesterLabel(s: Pick<Semester, 'year' | 'sem' | 'label'>) {
  if (s.sem === 0) return s.label ?? 'Extras'
  const roman = ['I', 'II'][s.year - 1]
  return `${roman} Year · Sem ${s.sem % 2 === 1 ? 'I' : 'II'}`
}

export function semesterSlug(sem: number) {
  return sem === 0 ? 'extras' : String(sem)
}

/** URL slug for a section of a subject: 1–5 are chapters, 0 is "general". */
export function sectionSlug(unit: number) {
  return unit === 0 ? 'general' : `unit-${unit}`
}

export function parseSectionSlug(slug: string): number | null {
  if (slug === 'general') return 0
  const m = /^unit-([1-5])$/.exec(slug)
  return m ? Number(m[1]) : null
}

export function sectionTitle(subject: Subject, unit: number) {
  if (unit === 0) return subject.kind === 'lab' ? 'Lab work & records' : 'Complete notes & general'
  return subject.units[unit - 1] ?? `Unit ${unit}`
}

export function sectionLabel(unit: number) {
  return unit === 0 ? 'General' : `Unit ${['I', 'II', 'III', 'IV', 'V'][unit - 1]}`
}

/** Sections a subject offers, in display order: its chapters, then General. */
export function sectionsOf(subject: Subject) {
  return [...subject.units.map((_, i) => i + 1), 0]
}

export function subjectHref(code: string) {
  return `/s/${code.toLowerCase()}`
}

export function sectionHref(code: string, unit: number) {
  return `${subjectHref(code)}/${sectionSlug(unit)}`
}
