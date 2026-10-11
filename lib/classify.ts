import { allSubjects, PAPERS_UNIT, QUESTION_BANK_UNIT, type Subject } from '@/lib/curriculum'

/**
 * Works out which subject and chapter some text belongs to, by comparing it with the course names
 * and chapter titles of the syllabus. Used on the text of a PDF. Pure and fast; no network.
 */

const STOP = new Set(
  (
    'about above after again against also among and any are because been before being below between both but can could did does doing down during each ' +
    'few for from further had has have having her here hers him his how into its itself just more most must not now off once only other our out over own ' +
    'same she should some such than that the their them then there these they this those through too under until upon very was were what when where ' +
    'which while who whom why will with would you your unit units chapter introduction basic basics concepts concept fundamentals study notes ' +
    'applications application using use used based types type'
  ).split(' '),
)

export function tokens(text: string): Set<string> {
  const out = new Set<string>()
  for (const w of text.toLowerCase().normalize('NFKD').split(/[^a-z0-9]+/)) {
    if (w.length >= 4 && !STOP.has(w)) out.add(w)
  }
  return out
}

interface Entry {
  subject: Subject
  code: string
  name: string
  nameTokens: Set<string>
  units: { unit: number; tokens: Set<string> }[]
}

let index: Entry[] | null = null
function entries(): Entry[] {
  index ??= allSubjects().map(({ subject }) => ({
    subject,
    code: subject.code.toLowerCase(),
    name: subject.name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
    nameTokens: tokens(subject.name),
    units: subject.units.map((t, i) => ({ unit: i + 1, tokens: tokens(t) })),
  }))
  return index
}

const overlap = (need: Set<string>, have: Set<string>) => {
  if (need.size === 0) return 0
  let hit = 0
  for (const t of need) if (have.has(t)) hit++
  return hit / need.size
}

export interface Classification {
  code: string
  /** The chapter, or null when the text identified the subject but not the chapter. */
  unit: number | null
  /** 0 to 1. */
  confidence: number
}

const BANK_WORDS = /\b(question\s*bank|important\s*questions|imp\s*questions|short\s*answer\s*questions|long\s*answer\s*questions)\b/i
const PAPER_WORDS = /\b(question\s*paper|previous\s*year|mid[\s-]*(term|exam|\d)|end\s*sem|semester\s*exam|model\s*paper|time\s*:\s*\d|max(imum)?\s*marks)\b/i

/**
 * `prefer` lists subject codes (usually the person's branch) that win close calls.
 * Returns null unless the text clearly points at one subject.
 */
export function classifyText(text: string, prefer?: ReadonlySet<string>): Classification | null {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length < 40) return null
  const lower = clean.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  const compact = lower.replace(/ /g, '')
  const have = tokens(clean)
  if (have.size < 6) return null

  const scored = entries().map((e) => {
    let score = 0
    if (compact.includes(e.code)) score += 100
    if (e.name.length >= 8 && ` ${lower} `.includes(` ${e.name} `)) score += 55
    score += overlap(e.nameTokens, have) * 30
    // Each chapter title is matched on its own. Words that are already in the subject's name do not
    // tell chapters apart, so they are ignored; a chapter whose title is only those words is skipped.
    const ranked: { unit: number; ov: number; hit: number }[] = []
    for (const u of e.units) {
      const own = new Set([...u.tokens].filter((t) => !e.nameTokens.has(t)))
      if (own.size === 0 || (own.size < 2 && ![...own].some((t) => t.length >= 7))) continue
      let hit = 0
      for (const t of own) if (have.has(t)) hit++
      ranked.push({ unit: u.unit, ov: hit / own.size, hit })
    }
    ranked.sort((a, b) => b.ov - a.ov || b.hit - a.hit)
    const best = ranked[0] ?? { unit: 0, ov: 0, hit: 0 }
    const next = ranked[1]
    // Two chapters matching equally well means the text does not single one out.
    const clear = !next || best.ov - next.ov >= 0.15 || best.hit > next.hit
    score += best.ov * 45
    if (prefer?.has(e.subject.code)) score += 6
    return { e, score, unit: best.ov >= 0.6 && clear ? best.unit : null, unitOv: best.ov }
  })
  scored.sort((a, b) => b.score - a.score)
  const top = scored[0]
  const second = scored[1]
  if (!top || top.score < 40) return null
  if (second && top.score - second.score < 12) return null

  let unit: number | null = top.unit
  if (BANK_WORDS.test(clean) && top.unitOv < 0.9) unit = QUESTION_BANK_UNIT
  else if (PAPER_WORDS.test(clean) && top.unitOv < 0.9) unit = PAPERS_UNIT
  return { code: top.e.subject.code, unit, confidence: Math.min(1, top.score / 110) }
}
