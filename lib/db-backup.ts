import 'server-only'

import { deleteBackup, driveBackupConfigured, listBackups, uploadBackup } from '@/lib/drive-backup'
import { adminConfigured, supabaseAdmin } from '@/lib/supabase/admin'

/** Tables worth keeping a copy of. Passwords are never in these (they live in Supabase's auth schema, hashed). */
const TABLES = [
  'profiles',
  'collections',
  'files',
  'comments',
  'reports',
  'bookmarks',
  'file_votes',
  'follows',
  'note_requests',
  'announcements',
  'suggestions',
  'login_events',
  'site_visits',
] as const

const KEEP = 7
const PREFIX = 'vjnotes-database-'

export interface DatabaseBackupReport {
  ok: boolean
  file?: string
  rows?: number
  skipped: string[]
  pruned: number
  error?: string
}

/**
 * Exports the main tables as one JSON file into the backup Drive (kept private, unlike the note
 * copies) and keeps the newest KEEP exports. Together with the file copies this means the whole site
 * can be rebuilt: who uploaded what, where, and when.
 */
export async function runDatabaseBackup(): Promise<DatabaseBackupReport> {
  if (!adminConfigured() || !driveBackupConfigured()) return { ok: false, skipped: [], pruned: 0, error: 'not configured' }
  const db = supabaseAdmin()
  const dump: Record<string, unknown[]> = {}
  const skipped: string[] = []
  let rows = 0
  for (const table of TABLES) {
    const all: unknown[] = []
    // Page through each table so a large one never hits the row limit of a single request.
    for (let from = 0; ; from += 1000) {
      const { data, error } = await db.from(table).select('*').range(from, from + 999)
      if (error) {
        skipped.push(`${table}: ${error.message.slice(0, 80)}`)
        break
      }
      all.push(...(data ?? []))
      if (!data || data.length < 1000) break
    }
    dump[table] = all
    rows += all.length
  }

  const stamp = new Date().toISOString().slice(0, 10)
  const name = `${PREFIX}${stamp}.json`
  const bytes = new TextEncoder().encode(JSON.stringify({ exported_at: new Date().toISOString(), tables: dump }))
  try {
    const existing = await listBackups(PREFIX)
    // One export per day: replace today's if the job runs twice.
    for (const f of existing.filter((f) => f.name === name)) await deleteBackup(f.id).catch(() => undefined)
    await uploadBackup({ name, mime: 'application/json', bytes, shared: false })
    const after = (await listBackups(PREFIX)).sort((a, b) => b.createdTime.localeCompare(a.createdTime))
    let pruned = 0
    for (const old of after.slice(KEEP)) {
      await deleteBackup(old.id).catch(() => undefined)
      pruned += 1
    }
    return { ok: true, file: name, rows, skipped, pruned }
  } catch (e) {
    return { ok: false, skipped, pruned: 0, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) }
  }
}
