'use server'

import { revalidatePath } from 'next/cache'
import { findSubject, sectionHref, sectionsOf, subjectHref } from '@/lib/curriculum'
import { currentUser } from '@/lib/supabase/server'

/** Refreshes the cached public pages that show a chapter after someone changes it. */
export async function refreshChapter(subjectCode: string, unit: number) {
  if (!(await currentUser())) return
  const found = findSubject(subjectCode)
  if (!found || !sectionsOf(found.subject).includes(unit)) return
  revalidatePath(sectionHref(found.subject.code, unit))
  revalidatePath(subjectHref(found.subject.code))
  if (found.semester.sem) revalidatePath(`/sem/${found.semester.sem}`)
  revalidatePath('/')
  revalidatePath('/contributors')
}
