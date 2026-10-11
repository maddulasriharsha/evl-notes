import { allSubjects, PAPERS_UNIT, sectionLabel, type Subject } from '@/lib/curriculum'

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5 }

/** Lower-cased words of a file name, without the extension or separators. */
function words(name: string) {
  return name
    .replace(/\.[a-z0-9]{1,5}$/i, '')
    .toLowerCase()
    .replace(/[_\-.()[\]+]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const UNIT = /\b(?:unit|module|chapter|chap|ch|u)\s*[-:]?\s*(iii|ii|iv|i|v|[1-5])\b/

const PAPERS = /\b(?:question\s*papers?|qp|previous\s*(?:year|years)?(?:\s*question)?\s*papers?|pyqs?|model\s*papers?|mid\s*(?:term|exam|\d)|end\s*sem|semester\s*(?:exam|paper)s?|sem\s*exam|exam\s*papers?|supply|supplementary)\b/

function unitFrom(text: string, max: number): number | null {
  if (PAPERS.test(text)) return PAPERS_UNIT
  const m = UNIT.exec(text)
  if (!m) return null
  const raw = m[1]!
  const n = ROMAN[raw] ?? Number(raw)
  return n >= 1 && n <= max ? n : null
}

/** Names a phone or scanner gives a file: they say nothing about the content. */
export function isGenericName(name: string): boolean {
  const w = words(name)
    .replace(/\b(img|image|dsc|dscn|pxl|scan|scanned|camscanner|screenshot|screen|shot|photo|pic|picture|whatsapp|document|doc|file|new|untitled|copy|vid|mvimg|pdf|jpeg|jpg|png|at|am|pm)\b/g, ' ')
    .replace(/[0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return w.length < 3
}

export interface Placement {
  code: string
  /** Chapter number found in the name, or null if the name only identified the subject. */
  unit: number | null
}

let index: { subject: Subject; code: string; short: string; name: string }[] | null = null
function subjectIndex() {
  index ??= allSubjects().map(({ subject }) => ({
    subject,
    code: subject.code.toLowerCase(),
    short: words(subject.short),
    name: words(subject.name),
  }))
  return index
}

const hasWord = (text: string, term: string) => term.length > 0 && ` ${text} `.includes(` ${term} `)

/**
 * Works out which subject (and chapter) a file belongs to from its name, e.g. "25PC1CS201 unit 3.pdf"
 * or "DMS Unit-2 notes.pdf". Returns null when the name does not say, or is ambiguous.
 * `prefer` lists subject codes (usually the signed-in person's branch) that win ties.
 */
export function guessPlacement(filename: string, prefer?: ReadonlySet<string>): Placement | null {
  const text = words(filename)
  if (!text) return null
  const compact = text.replace(/ /g, '')
  let best = 0
  let winners: Subject[] = []
  for (const e of subjectIndex()) {
    let score = 0
    if (compact.includes(e.code)) score = 100
    else if (e.name.length >= 8 && hasWord(text, e.name)) score = 90
    else if (e.short.length >= 3 && hasWord(text, e.short)) score = 60
    if (score === 0) continue
    if (score > best) {
      best = score
      winners = [e.subject]
    } else if (score === best) winners.push(e.subject)
  }
  if (winners.length > 1 && prefer) {
    const mine = winners.filter((s) => prefer.has(s.code))
    if (mine.length) winners = mine
  }
  const unique = [...new Map(winners.map((s) => [s.code, s])).values()]
  if (unique.length !== 1) return null
  const subject = unique[0]!
  return { code: subject.code, unit: unitFrom(text, subject.units.length) }
}

/**
 * The name a file gets on the site: "DMS · Unit II · Notes 3", or, when the original name says
 * something useful, "DMS · Unit II · Hand written".
 */
export function autoFileName(opts: { short: string; unit: number; n: number; original: string }): string {
  const head = `${opts.short} · ${sectionLabel(opts.unit)}`
  if (!isGenericName(opts.original)) {
    const short = words(opts.short)
    const left = words(opts.original)
      .replace(UNIT, ' ')
      .split(' ')
      .filter((w) => w && w !== short && !/^(final|copy|new|pdf)$/.test(w))
      .join(' ')
      .trim()
    // Only the subject and chapter were in the name: that adds nothing.
    if (left && !/^(notes?|note)$/.test(left)) {
      const nice = left.charAt(0).toUpperCase() + left.slice(1)
      return `${head} · ${nice}`.slice(0, 120)
    }
  }
  return `${head} · Notes ${opts.n}`
}
