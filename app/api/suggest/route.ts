import { NextResponse } from 'next/server'
import { allSubjects, findSubject, PAPERS_UNIT, QUESTION_BANK_UNIT, sectionHref, sectionLabel, sectionsOf, sectionTitle, subjectHref } from '@/lib/curriculum'
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
  const q = (new URL(request.url).searchParams.get('q') ?? '').slice(0, 60)
  const terms = norm(q).split(' ').filter(Boolean)
  if (terms.join('').length < 2) return NextResponse.json({ items: [] })
  const hit = (text: string) => {
    const t = norm(text)
    return terms.every((term) => t.includes(term))
  }

  const subjects: Suggestion[] = []
  const chapters: Suggestion[] = []
  for (const { subject, branch, semester } of allSubjects()) {
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
    const short = findSubject(f.subject)?.subject.short ?? ''
    if (hit(`${f.title} ${short}`)) files.push({ kind: 'file', href: `/view/d/${f.id}`, title: f.title, hint: `${short} · ${f.ext.toUpperCase()}` })
  }

  return NextResponse.json(
    { items: [...subjects, ...chapters, ...files] },
    { headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' } },
  )
}
