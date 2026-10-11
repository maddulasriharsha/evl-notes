'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, CircleDashed, HardDriveUpload, Loader2 } from 'lucide-react'

export interface BackupPanelProps {
  service: boolean
  drive: boolean
  cron: boolean
  columns: boolean
  status: { uploaded: number; backedUp: number; waiting: number; removed: number; errors: number } | null
}

interface Report {
  configured: boolean
  backedUp: number
  removed: number
  failed: number
  stoppedEarly: boolean
  errors: string[]
}

function Row({ done, label, hint }: { done: boolean; label: string; hint: string }) {
  return (
    <li className="flex items-start gap-3 py-2">
      {done ? <Check className="mt-0.5 size-4 shrink-0 text-ok" /> : <CircleDashed className="mt-0.5 size-4 shrink-0 text-ink-3" />}
      <div>
        <p className="text-sm font-medium">{label}</p>
        {!done && <p className="text-xs text-ink-3">{hint}</p>}
      </div>
    </li>
  )
}

/** Setup checklist, counts and a "run now" button for the Drive backup. */
export function BackupPanel({ service, drive, cron, columns, status }: BackupPanelProps) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ready = service && drive && columns

  async function run() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/backup', { method: 'POST' })
      const json = (await res.json()) as Report & { error?: string }
      if (!res.ok) throw new Error(json.error ?? `Failed (${res.status})`)
      setReport(json)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Backup failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-semibold">Setup</h2>
        <ul className="mt-2 divide-y divide-line">
          <Row done={columns} label="Database columns" hint="Run supabase/migrations/20261018000000_drive_backup.sql in the Supabase SQL Editor." />
          <Row done={service} label="Supabase service key" hint="Add SUPABASE_SERVICE_ROLE_KEY in Vercel → Settings → Environment Variables, then redeploy." />
          <Row done={drive} label="Google Drive account" hint="Add GOOGLE_DRIVE_CLIENT_ID, GOOGLE_DRIVE_CLIENT_SECRET and GOOGLE_DRIVE_REFRESH_TOKEN. See docs/DRIVE_BACKUP.md." />
          <Row done={cron} label="Daily schedule" hint="Add CRON_SECRET (any long random text) so the daily job is allowed to run." />
        </ul>
      </section>

      {status && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Uploaded files', value: status.uploaded },
            { label: 'Copied to Drive', value: status.backedUp },
            { label: 'Original removed', value: status.removed },
            { label: 'Waiting', value: status.waiting },
          ].map((t) => (
            <div key={t.label} className="rounded-2xl border border-line bg-surface p-4 shadow-card">
              <p className="text-xs text-ink-3">{t.label}</p>
              <p className="mt-1 font-display text-3xl font-semibold tabular-nums">{t.value}</p>
            </div>
          ))}
        </section>
      )}
      {status && status.errors > 0 && (
        <p className="rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold">
          {status.errors} file{status.errors === 1 ? '' : 's'} could not be backed up or verified yet. Their originals are untouched. Run the backup again; if
          it keeps failing, check the Drive account.
        </p>
      )}

      <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
        <h2 className="font-semibold">How it works</h2>
        <p className="mt-1 text-sm text-ink-2">
          New uploads are copied to the &ldquo;VJNOTES backup&rdquo; folder in the backup Drive and checked. Seven days later, if the copy is
          still there, still shared and the same size, the original is removed from Supabase to save space and the note is shown from Drive.
          Thumbnails stay in Supabase. Runs by itself once a day.
        </p>
        <button
          type="button"
          onClick={run}
          disabled={!ready || busy}
          className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <HardDriveUpload className="size-4" />}
          {busy ? 'Working (up to a minute)…' : 'Run backup now'}
        </button>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        {report && (
          <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2 text-sm">
            <p>
              Copied {report.backedUp}, removed {report.removed} original{report.removed === 1 ? '' : 's'}, {report.failed} failed.
              {report.stoppedEarly && ' More are waiting, so run it again.'}
            </p>
            {report.errors.map((e, i) => (
              <p key={i} className="mt-1 text-xs break-words text-danger">{e}</p>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
