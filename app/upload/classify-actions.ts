'use server'

import { branches, findSubject, PAPERS_UNIT, sectionsOf } from '@/lib/curriculum'
import { currentUser } from '@/lib/supabase/server'

/** Is the picture-reading helper switched on (an Anthropic API key is set on the server)? */
export async function aiSortAvailable(): Promise<boolean> {
  return !!process.env.ANTHROPIC_API_KEY && !!(await currentUser())
}

export type AiPlacement = { ok: true; code: string; unit: number | null; confidence: number } | { ok: false; reason: string }

const MODEL = 'claude-haiku-5-5'
const MAX_IMAGES = 3
const MAX_IMAGE_CHARS = 900_000 // about 650 KB of image per picture
const hits = new Map<string, number[]>()

/** Simple per-person limit so one account cannot run up the bill. Resets as the instance recycles. */
function allowed(userId: string) {
  const now = Date.now()
  const recent = (hits.get(userId) ?? []).filter((t) => now - t < 3_600_000)
  if (recent.length >= 40) return false
  recent.push(now)
  hits.set(userId, recent)
  return true
}

function catalogue(branchId: string) {
  const branch = branches.find((b) => b.id === branchId) ?? branches[0]
  const seen = new Set<string>()
  const lines: string[] = []
  for (const sem of branch?.semesters ?? []) {
    for (const s of sem.subjects) {
      if (seen.has(s.code)) continue
      seen.add(s.code)
      const units = s.units.map((t, i) => `${i + 1}=${t}`).join('; ')
      lines.push(`${s.code} | ${s.name}${units ? ` | chapters: ${units}` : ''}`)
    }
  }
  return { lines, codes: seen }
}

/**
 * Looks at up to three pictures of someone's notes and says which subject and chapter they are for.
 * The answer is checked against the real syllabus before it is returned, so it can never name a
 * subject or chapter that does not exist.
 */
export async function classifyWithAI(images: string[], branchId: string): Promise<AiPlacement> {
  const user = await currentUser()
  if (!user) return { ok: false, reason: 'Sign in first.' }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return { ok: false, reason: 'Automatic sorting is not switched on.' }
  if (!allowed(user.id)) return { ok: false, reason: 'Too many sorting requests this hour. Choose the chapter yourself.' }

  const pics = images.slice(0, MAX_IMAGES).filter((d) => /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(d) && d.length <= MAX_IMAGE_CHARS)
  if (pics.length === 0) return { ok: false, reason: 'No readable picture.' }

  const { lines, codes } = catalogue(branchId)
  const prompt =
    `These are pages of a student's class notes (handwritten or printed). Decide which course they belong to and which chapter.\n\n` +
    `Courses (code | name | chapters):\n${lines.join('\n')}\n\n` +
    `Rules: choose only a code from the list. "unit" is the chapter number from the list; use 0 if the notes cover the whole course or no single chapter; ` +
    `use ${PAPERS_UNIT} if the pages are an exam or question paper. If you cannot tell, use null for code.\n` +
    `Reply with only JSON: {"code": "<code or null>", "unit": <number or null>, "confidence": <0 to 1>}`

  let text = ''
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 120,
        messages: [
          {
            role: 'user',
            content: [
              ...pics.map((d) => {
                const m = /^data:(image\/[a-z]+);base64,(.+)$/.exec(d)!
                return { type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } }
              }),
              { type: 'text', text: prompt },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(25_000),
    })
    if (!res.ok) return { ok: false, reason: `The sorting service said ${res.status}.` }
    const json = (await res.json()) as { content?: { type: string; text?: string }[] }
    text = json.content?.find((c) => c.type === 'text')?.text ?? ''
  } catch {
    return { ok: false, reason: 'The sorting service did not answer.' }
  }

  const match = /\{[\s\S]*\}/.exec(text)
  if (!match) return { ok: false, reason: 'Could not tell.' }
  try {
    const out = JSON.parse(match[0]) as { code?: string | null; unit?: number | null; confidence?: number }
    const code = typeof out.code === 'string' ? out.code.toUpperCase() : null
    if (!code || !codes.has(code)) return { ok: false, reason: 'Could not tell.' }
    const found = findSubject(code)
    let unit: number | null = null
    if (found && typeof out.unit === 'number' && sectionsOf(found.subject).includes(out.unit)) unit = out.unit
    const confidence = typeof out.confidence === 'number' ? Math.max(0, Math.min(1, out.confidence)) : 0.5
    return { ok: true, code, unit, confidence }
  } catch {
    return { ok: false, reason: 'Could not tell.' }
  }
}
