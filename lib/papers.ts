/** How a question paper is read from its title: mid or semester-end, its table column and a short label. */

/** A mid-term paper says so in its title ("Mid 1", "Mid-2", "MID II"); everything else is a semester-end paper. */
export function isMidPaper(title: string) {
  return /(^|[^a-z])mid([^a-z]|$)/i.test(title)
}

export type PaperSlot = 'mid1' | 'mid2' | 'sem' | 'combined'

/** Which column of the at-a-glance table a paper belongs to, read from its title. */
export function paperSlot(title: string): PaperSlot {
  if (/all subjects|collection|mid\s*&|mid papers|mid 1,\s*mid 2/i.test(title)) return 'combined'
  if (/mid\W*(?:2|ii)(?![a-z0-9])/i.test(title)) return 'mid2'
  if (/mid\W*(?:1|i)(?![a-z0-9])/i.test(title)) return 'mid1'
  return isMidPaper(title) ? 'combined' : 'sem'
}

/** A short name for a paper inside its table cell: regulation, then what tells it apart from its neighbours. */
export function paperChip(title: string): string {
  const parts = [
    /\bR\d\d\b/.exec(title)?.[0],
    /page (\d+)/i.exec(title) ? `p${/page (\d+)/i.exec(title)![1]}` : undefined,
    /set (\d+)/i.exec(title) ? `set ${/set (\d+)/i.exec(title)![1]}` : undefined,
    /supplementary/i.test(title) ? 'Supply' : undefined,
    /all subjects/i.test(title) ? 'all subjects' : undefined,
  ].filter(Boolean)
  return parts.join(' · ') || 'Open'
}

export type ExamKind = 'mid1' | 'mid2' | 'sem'
export const EXAM_LABEL: Record<ExamKind, string> = { mid1: 'Mid 1', mid2: 'Mid 2', sem: 'Sem' }

/** The exam a paper is currently filed as, or null when its title does not say (combined papers). */
export function examOf(title: string): ExamKind | null {
  const s = paperSlot(title)
  return s === 'combined' ? null : s
}

/** The year in a paper's title, if there is one. */
export function paperYear(title: string): number | undefined {
  const y = /\b(20\d\d)\b/.exec(title)?.[1]
  return y ? Number(y) : undefined
}

/**
 * The title with its exam and year replaced ("EDC · Mid 1 2025" → "EDC · Sem 2025"). The site files a
 * paper under Mid or Sem PYQs, and in its year, by reading the title, so retitling is how it is moved.
 */
export function retitlePaper(title: string, exam: ExamKind, year: number): string {
  const rest = title
    .replace(/\bmid\W*(?:term\W*)?(?:2|ii|1|i)?(?![a-z0-9])/gi, ' ')
    .replace(/\b(?:end\W*)?sem(?:ester)?(?![a-z0-9])(?:\W*(?:end|exam))?/gi, ' ')
    .replace(/\b20\d\d\b/g, ' ')
    .replace(/\s*[·|,–-]\s*(?=[·|,–-]|$)/g, ' ')
    .replace(/(?:\s*[·|,–-])+\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
  const head = `${EXAM_LABEL[exam]} ${year}`
  return (rest ? `${rest} · ${head}` : head).slice(0, 200)
}
