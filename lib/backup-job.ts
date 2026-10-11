import 'server-only'

import { copyIsSafe, backupFileName, removalCutoff } from '@/lib/backup-rules'
import { deleteBackup, driveBackupConfigured, inspectBackup, md5, uploadBackup } from '@/lib/drive-backup'
import { publicFileUrl, STORAGE_BUCKET } from '@/lib/env'
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin'

export interface BackupReport {
  configured: boolean
  backedUp: number
  removed: number
  failed: number
  stoppedEarly: boolean
  errors: string[]
}

type PendingRow = { id: string; storage_path: string; mime: string; size_bytes: number }
type DueRow = { id: string; storage_path: string; size_bytes: number; backup_drive_id: string }

const short = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300)

export function backupReady() {
  return adminConfigured() && driveBackupConfigured()
}

/**
 * One pass of the job:
 *   1. Originals whose Drive copy is 3 days old and still intact are removed from Storage.
 *   2. New uploads are copied to Drive, checked (size and checksum) and recorded.
 * It stops when the time budget is used up; the next run picks up where this one left off.
 * An original is only ever removed after the Drive copy has been looked at again just beforehand.
 */
export async function runBackup(budgetMs = 45_000): Promise<BackupReport> {
  const report: BackupReport = { configured: backupReady(), backedUp: 0, removed: 0, failed: 0, stoppedEarly: false, errors: [] }
  if (!report.configured) return report
  const deadline = Date.now() + budgetMs
  const db = supabaseAdmin()
  const now = new Date().toISOString()

  // ---- 1. remove originals that have a verified, week-old copy
  const { data: due } = await db
    .from('files')
    .select('id, storage_path, size_bytes, backup_drive_id')
    .not('backup_drive_id', 'is', null)
    .is('original_removed_at', null)
    .not('storage_path', 'is', null)
    .lte('backed_up_at', removalCutoff())
    .limit(100)
  for (const f of (due ?? []) as DueRow[]) {
    if (Date.now() > deadline) {
      report.stoppedEarly = true
      break
    }
    try {
      const copy = await inspectBackup(f.backup_drive_id)
      if (!copy.exists || !copyIsSafe(copy, f.size_bytes)) {
        report.failed += 1
        await db.from('files').update({ backup_error: 'Drive copy is missing, in the bin, private or a different size; original kept' }).eq('id', f.id)
        continue
      }
      const removed = await db.storage.from(STORAGE_BUCKET).remove([f.storage_path])
      if (removed.error) throw new Error(removed.error.message)
      await db.from('files').update({ original_removed_at: new Date().toISOString(), backup_error: null }).eq('id', f.id)
      report.removed += 1
    } catch (e) {
      report.failed += 1
      report.errors.push(`remove ${f.id}: ${short(e)}`)
    }
  }

  // ---- 2. copy new uploads to Drive
  if (!report.stoppedEarly) {
    const { data: pending } = await db
      .from('files')
      .select('id, storage_path, mime, size_bytes')
      .is('backup_drive_id', null)
      .is('drive_id', null)
      .not('storage_path', 'is', null)
      .order('created_at', { ascending: true })
      .limit(200)
    for (const f of (pending ?? []) as PendingRow[]) {
      if (Date.now() > deadline) {
        report.stoppedEarly = true
        break
      }
      let uploaded: string | null = null
      try {
        const res = await fetch(publicFileUrl(f.storage_path))
        if (!res.ok) throw new Error(`download failed (${res.status})`)
        const bytes = new Uint8Array(await res.arrayBuffer())
        if (bytes.length !== f.size_bytes) throw new Error(`size mismatch: stored ${bytes.length}, expected ${f.size_bytes}`)
        const copy = await uploadBackup({ name: backupFileName(f.id, f.storage_path), mime: f.mime, bytes })
        uploaded = copy.id
        if (copy.size !== bytes.length || copy.md5 !== md5(bytes)) throw new Error('Drive copy does not match the original')
        const { data: written } = await db
          .from('files')
          .update({ backup_drive_id: copy.id, backed_up_at: now, backup_error: null })
          .eq('id', f.id)
          .is('backup_drive_id', null)
          .select('id')
        if (!written || written.length === 0) {
          // Another run got there first: drop our duplicate.
          await deleteBackup(copy.id).catch(() => undefined)
        } else {
          report.backedUp += 1
        }
      } catch (e) {
        report.failed += 1
        report.errors.push(`backup ${f.id}: ${short(e)}`)
        if (uploaded) await deleteBackup(uploaded).catch(() => undefined)
        await db.from('files').update({ backup_error: short(e) }).eq('id', f.id)
      }
    }
  }
  report.errors = report.errors.slice(0, 5)
  return report
}

export interface BackupStatus {
  uploaded: number
  backedUp: number
  waiting: number
  removed: number
  errors: number
}

/** Counts for the admin page. */
export async function backupStatus(): Promise<BackupStatus | null> {
  if (!adminConfigured()) return null
  const db = supabaseAdmin()
  const head = () => db.from('files').select('id', { count: 'exact', head: true }).is('drive_id', null).not('storage_path', 'is', null)
  const [uploaded, backedUp, removed, errors] = await Promise.all([
    head(),
    head().not('backup_drive_id', 'is', null),
    head().not('original_removed_at', 'is', null),
    head().not('backup_error', 'is', null).is('original_removed_at', null),
  ])
  if (uploaded.error) return null
  const n = (r: { count: number | null }) => r.count ?? 0
  return { uploaded: n(uploaded), backedUp: n(backedUp), waiting: n(uploaded) - n(backedUp), removed: n(removed), errors: n(errors) }
}
