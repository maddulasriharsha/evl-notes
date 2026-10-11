'use server'

import { deleteBackup, driveBackupConfigured } from '@/lib/drive-backup'
import { currentProfile } from '@/lib/supabase/server'

/** After an admin deletes a note forever, its Drive backup goes too. Admins only. */
export async function removeBackupCopy(driveId: string) {
  const me = await currentProfile()
  if (me?.profile?.role !== 'admin') throw new Error('Admins only')
  if (!/^[A-Za-z0-9_-]{10,120}$/.test(driveId) || !driveBackupConfigured()) return
  await deleteBackup(driveId)
}
