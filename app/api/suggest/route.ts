import { NextResponse } from 'next/server'
import { allSubjects, findBranch, findSubject, PAPERS_UNIT, QUESTION_BANK_UNIT, sectionHref, sectionLabel, sectionsOf, sectionTitle, subjectHref } from '@/lib/curriculum'
import { driveFiles } from '@/lib/library'

export interface Suggestion {
  href: string
  title: string
  hint: string
  kind: 'subject' | 'chapter' | 'file'
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/**
 * Quick matches for the search box while someone types: subjects, chapters and the library's files.
 * Reads only the data shipped with the site (no database), and the answer for a query can be cached.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams
  const q = (params.get('q') ?? '').slice(0, 60)
  // "Mine only": keep subjects taught to this branch (and semester), plus the shared extras.
  const mineBranch = findBranch((params.get('branch') ?? '').slice(0, 40))?.id
  const mineSem = Number(params.get('sem')) || 0
  const mine = (e: ReturnType<typeof allSubjects>[number]) =>
    !mineBranch || e.usedIn.some((u) => !u.branch || (u.branch.id === mineBranch && (!mineSem || u.semester.sem === mineSem)))
  const terms = norm(q).split(' ').filter(Boolean)
  if (terms.join('').length < 2) return NextResponse.json({ items: [] })
  const hit = (text: string) => {
    const t = norm(text)
    return terms.every((term) => t.includes(term))
  }

  const subjects: Suggestion[] = []
  const chapters: Suggestion[] = []
  for (const entry of allSubjects()) {
    const { subject, branch, semester } = entry
    if (!mine(entry)) continue
    if (subjects.length < 5 && hit(`${subject.name} ${subject.short} ${subject.code}`)) {
      subjects.push({ kind: 'subject', href: subjectHref(subject.code), title: subject.name, hint: `${subject.short}${branch ? ` · ${branch.short}` : ''} · Sem ${semester.sem}` })
    }
    if (chapters.length < 4) {
      for (const u of sectionsOf(subject)) {
        if (u === 0 || u === PAPERS_UNIT || u === QUESTION_BANK_UNIT || chapters.length >= 4) continue
        if (hit(`${sectionTitle(subject, u)} ${subject.short}`)) {
          chapters.push({ kind: 'chapter', href: sectionHref(subject.code, u), title: sectionTitle(subject, u), hint: `${subject.short} · ${sectionLabel(u)}` })
        }
      }
    }
  }
  const files: Suggestion[] = []
  for (const f of driveFiles) {
    if (files.length >= 5) break
    const owner = findSubject(f.subject)
    if (owner && !mine(owner)) continue
    const short = owner?.subject.short ?? ''
    if (hit(`${f.title} ${short}`)) files.push({ kind: 'file', href: `/view/d/${f.id}`, title: f.title, hint: `${short} · ${f.ext.toUpperCase()}` })
  }

  return NextResponse.json(
    { items: [...subjects, ...chapters, ...files] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
