'use client'

import { MoveFileButton } from '@/components/move-file'
import { useViewer } from '@/components/file-tools'

/** Admin-only "Move" for a Google Drive library file. The database re-checks the role. */
export function DriveMove({ id, name, subject, unit }: { id: string; name: string; subject: string; unit: number }) {
  const viewer = useViewer()
  if (viewer?.role !== 'admin') return null
  return (
    <div className="absolute top-2 right-2 z-10">
      <MoveFileButton id={id} name={name} subject={subject} unit={unit} compact drive />
    </div>
  )
}
