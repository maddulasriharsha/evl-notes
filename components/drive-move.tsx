'use client'

import { useRouter } from 'next/navigation'
import { refreshChapter } from '@/app/upload/actions'
import { ExamTagButton } from '@/components/exam-tag'
import { MoveFileButton } from '@/components/move-file'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { PAPERS_UNIT } from '@/lib/curriculum'

/** Admin-only "Move" for a Google Drive library file. The database re-checks the role. */
export function DriveMove({ id, name, subject, unit }: { id: string; name: string; subject: string; unit: number }) {
  const viewer = useViewer()
  const router = useRouter()
  if (viewer?.role !== 'admin') return null

  async function setTitle(next: string) {
    const { error } = await supabaseBrowser().rpc('staff_rename_drive_file', { p_file: id, p_title: next })
    if (error) throw new Error(error.message)
    await refreshChapter(subject, unit).catch(() => undefined)
    router.refresh()
  }

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1">
      {unit === PAPERS_UNIT && <ExamTagButton title={name} save={setTitle} variant="card" />}
      <MoveFileButton id={id} name={name} subject={subject} unit={unit} compact drive />
    </div>
  )
}
