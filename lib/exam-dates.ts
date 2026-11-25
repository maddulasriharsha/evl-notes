/** Small, client-safe pieces for the exam pages (no curriculum import, so the browser bundle stays light). */
export type ExamKind = 'sess1' | 'sess2' | 'sem'
export type Year = 1 | 2 | 3 | 4

export const KINDS: ExamKind[] = ['sess1', 'sess2', 'sem']
export const YEARS: Year[] = [1, 2, 3, 4]

export const KIND_LABEL: Record<ExamKind, string> = {
  sess1: 'Sessional I',
  sess2: 'Sessional II',
  sem: 'Semester exam',
}
export const YEAR_LABEL: Record<Year, string> = { 1: '1st year', 2: '2nd year', 3: '3rd year', 4: '4th year' }

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function dayParts(iso: string) {
  const [y = 1970, m = 1, dd = 1] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, dd))
  return { day: dd, month: MONTHS[m - 1] ?? '', weekday: WEEKDAYS[dt.getUTCDay()] ?? '', year: y }
}

/** Whole days from `today` (an ISO date) to `iso`: 0 is today, negative is past. */
export function daysUntil(iso: string, today: string) {
  const a = Date.parse(iso + 'T00:00:00Z')
  const b = Date.parse(today + 'T00:00:00Z')
  return Math.round((a - b) / 86_400_000)
}

/** Today's date in India (the college's time), as an ISO date. */
export function todayIST() {
  return new Date(Date.now() + 5.5 * 3_600_000).toISOString().slice(0, 10)
}

export function whenLabel(n: number) {
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n > 1) return `In ${n} days`
  return n === -1 ? 'Yesterday' : 'Done'
}
