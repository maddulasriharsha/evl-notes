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
  /** 1–8 for regular semesters, 0 for the Extras shelf. */
  sem: number
  label?: string
  subjects: Subject[]
}

export interface Branch {
  /** URL slug, e.g. "evl" → /b/evl */
  id: string
  short: string
  name: string
  regulation?: string
  semesters: Semester[]
}

const raw = data as unknown as { branches: Branch[]; extras?: Semester }

export const branches: Branch[] = raw.branches
/** Material shared across branches (for example BEEE and lab records). */
export const extras: Semester | undefined = raw.extras

export function findBranch(id: string) {
  return branches.find((b) => b.id === id.toLowerCase())
}

export function branchHref(id: string) {
  return `/b/${id}`
}

export function semesterHref(branchId: string, sem: number) {
  return `/b/${branchId}/sem/${sem}`
}

export interface SubjectUse {
  branch: Branch | null
  semester: Semester
}

interface SubjectEntry {
  subject: Subject
  /** First place the subject appears (its home for breadcrumbs). */
  branch: Branch | null
  semester: Semester
  /** Every branch and semester that teaches it. Notes are shared across all of them. */
  usedIn: SubjectUse[]
}

// A subject code identifies the course, so a course taught to several branches is one set of notes.
const byCode = new Map<string, SubjectEntry>()
function register(subject: Subject, semester: Semester, branch: Branch | null) {
  const key = subject.code.toUpperCase()
  const entry = byCode.get(key)
  if (entry) entry.usedIn.push({ branch, semester })
  else byCode.set(key, { subject, branch, semester, usedIn: [{ branch, semester }] })
}
for (const branch of branches) {
  for (const semester of branch.semesters) for (const subject of semester.subjects) register(subject, semester, branch)
}
if (extras) for (const subject of extras.subjects) register(subject, extras, null)

export function findSubject(code: string) {
  return byCode.get(code.toUpperCase())
}

const sameName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

/** The same subject taught to other branches under a different code (matched by its full name). */
export function siblingSubjects(code: string) {
  const me = findSubject(code)
  if (!me) return []
  const key = sameName(me.subject.name)
  return [...byCode.values()].filter((e) => e.subject.code !== me.subject.code && e.subject.kind === me.subject.kind && sameName(e.subject.name) === key)
}

/** A subject's own code followed by the codes of the same subject taught to other branches. Their notes are shared. */
export function sharedCodes(code: string): string[] {
  return [code, ...siblingSubjects(code).map((s) => s.subject.code)]
}

/** Every distinct subject across all branches. */
export function allSubjects() {
  return [...byCode.values()]
}

/** The distinct subjects of one branch, in semester order. */
export function branchSubjects(branch: Branch) {
  const seen = new Set<string>()
  const out: { subject: Subject; semester: Semester }[] = []
  for (const semester of branch.semesters) {
    for (const subject of semester.subjects) {
      if (seen.has(subject.code)) continue
      seen.add(subject.code)
      out.push({ subject, semester })
    }
  }
  return out
}

export function semesterLabel(s: Pick<Semester, 'year' | 'sem' | 'label'>) {
  if (s.sem === 0) return s.label ?? 'Extras'
  const roman = ['I', 'II', 'III', 'IV'][s.year - 1] ?? String(s.year)
  return `${roman} Year · Sem ${s.sem % 2 === 1 ? 'I' : 'II'}`
}

/** Breadcrumb prefix for a subject: its branch and semester when only one branch teaches it. */
export function subjectCrumbs(entry: SubjectEntry): { href?: string; label: string }[] {
  const home = { href: '/', label: 'Home' }
  if (entry.semester.sem === 0) return [home, { label: semesterLabel(entry.semester) }]
  const only = entry.usedIn.length === 1 ? entry.usedIn[0] : undefined
  if (only?.branch) {
    return [
      home,
      { href: branchHref(only.branch.id), label: only.branch.short },
      { href: semesterHref(only.branch.id, only.semester.sem), label: `Sem ${only.semester.sem}` },
    ]
  }
  return [home]
}

/** Section number of the "Previous question papers" shelf every subject has. */
export const PAPERS_UNIT = 6

/** Section number of the "Question bank" shelf (important questions, assignments, question sets). */
export const QUESTION_BANK_UNIT = 7

/** URL slug for a section of a subject: 1-5 are chapters, 0 is "general", 6 is question papers. */
export function sectionSlug(unit: number) {
  if (unit === 0) return 'general'
  if (unit === PAPERS_UNIT) return 'question-papers'
  if (unit === QUESTION_BANK_UNIT) return 'question-bank'
  return `unit-${unit}`
}

export function parseSectionSlug(slug: string): number | null {
  if (slug === 'general') return 0
  if (slug === 'question-papers') return PAPERS_UNIT
  if (slug === 'question-bank') return QUESTION_BANK_UNIT
  const m = /^unit-([1-5])$/.exec(slug)
  return m ? Number(m[1]) : null
}

export function sectionTitle(subject: Subject, unit: number) {
  if (unit === 0) return subject.kind === 'lab' ? 'Lab work & records' : 'Complete notes & general'
  if (unit === PAPERS_UNIT) return 'Previous question papers'
  if (unit === QUESTION_BANK_UNIT) return 'Question bank'
  return subject.units[unit - 1] ?? `Unit ${unit}`
}

export function sectionLabel(unit: number) {
  if (unit === 0) return 'General'
  if (unit === PAPERS_UNIT) return 'Papers'
  if (unit === QUESTION_BANK_UNIT) return 'Q-Bank'
  return `Unit ${['I', 'II', 'III', 'IV', 'V'][unit - 1]}`
}

/** The mark shown in a section's tile: roman numeral, star for General, P for papers. */
export function sectionMark(unit: number) {
  if (unit === 0) return '∗'
  if (unit === PAPERS_UNIT) return 'P'
  if (unit === QUESTION_BANK_UNIT) return 'Q'
  return ['I', 'II', 'III', 'IV', 'V'][unit - 1] ?? String(unit)
}

/** Sections a subject offers, in display order: its chapters, General, then question papers. */
export function sectionsOf(subject: Subject) {
  return [...subject.units.map((_, i) => i + 1), 0, PAPERS_UNIT, QUESTION_BANK_UNIT]
}

export function subjectHref(code: string) {
  return `/s/${code.toLowerCase()}`
}

/** Complete notes (General) and the Question bank share one page: /s/{code}/complete. */
export const COMPLETE_SLUG = 'complete'

export function completeHref(code: string) {
  return `${subjectHref(code)}/${COMPLETE_SLUG}`
}

export function sectionHref(code: string, unit: number) {
  if (unit === 0 || unit === QUESTION_BANK_UNIT) return completeHref(code)
  return `${subjectHref(code)}/${sectionSlug(unit)}`
}
