'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { removeBackupCopy } from '@/app/admin/backup-actions'
import { refreshChapter } from '@/app/upload/actions'
import { STORAGE_BUCKET } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

type Result = { error: { message: string } | null }

function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function run(key: string, op: () => PromiseLike<Result>, after?: () => Promise<void>, confirmText?: string) {
    if (confirmText && !confirm(confirmText)) return
    setBusy(key)
    const { error } = await op()
    if (!error && after) await after()
    setBusy(null)
    if (error) return alert(error.message)
    router.refresh()
  }
  return { busy, run }
}

function Btn({ onClick, busy, danger, dark, children }: { onClick: () => void; busy?: boolean; danger?: boolean; dark?: boolean; children: React.ReactNode }) {
  const tone = danger ? 'border border-danger/40 text-danger hover:bg-danger-soft' : dark ? 'bg-ink text-bg' : 'border border-line hover:bg-surface-2'
  return (
    <button type="button" onClick={onClick} disabled={busy} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium whitespace-nowrap disabled:opacity-50 ${tone}`}>
      {busy && <Loader2 className="size-3.5 animate-spin" />} {children}
    </button>
  )
}

export function FileModButtons({
  id,
  name,
  hidden,
  subject,
  unit,
  canPurge = true,
}: {
  id: string
  name?: string
  hidden: boolean
  subject: string
  unit: number
  /** Permanent deletion is for admins only. */
  canPurge?: boolean
}) {
  const { busy, run } = useAction()
  const db = () => supabaseBrowser()
  const refresh = () => refreshChapter(subject, unit)
  return (
    <div className="flex justify-end gap-1.5">
      {name !== undefined && !hidden && (
        <Btn
          busy={busy === 'rename'}
          onClick={() => {
            const next = prompt('Rename this file', name)?.trim().replace(/\s+/g, ' ').slice(0, 200)
            if (!next || next === name) return
            void run('rename', () => db().from('files').update({ name: next }).eq('id', id), refresh)
          }}
        >
          Rename
        </Btn>
      )}
      <Btn
        busy={busy === 'hide'}
        dark={hidden}
        onClick={() => run('hide', () => db().from('files').update({ deleted_at: hidden ? null : new Date().toISOString() }).eq('id', id), refresh)}
      >
        {hidden ? 'Restore' : 'Hide'}
      </Btn>
      {hidden && canPurge && (
        <Btn
          danger
          busy={busy === 'purge'}
          onClick={() =>
            run(
              'purge',
              async () => {
                // Read the Drive copy's id first: once the row is gone it cannot be looked up.
                const backup = await db().from('files').select('backup_drive_id').eq('id', id).maybeSingle()
                const driveCopy = (backup.data as { backup_drive_id: string | null } | null)?.backup_drive_id ?? null
                const { data, error } = await db().rpc('admin_purge_file', { p_file: id })
                if (error) return { error }
                if (driveCopy) await removeBackupCopy(driveCopy).catch(() => undefined)
                const paths = (data as string[] | null) ?? []
                const removed = paths.length ? await db().storage.from(STORAGE_BUCKET).remove(paths) : { error: null }
                return { error: removed.error ? { message: `Removed from the site, but storage cleanup failed: ${removed.error.message}` } : null }
              },
              refresh,
              'Delete this file forever? It cannot be restored, and its comments are deleted too.',
            )
          }
        >
          Delete forever
        </Btn>
      )}
    </div>
  )
}

export function CommentModButtons({ id, deleted }: { id: string; deleted: boolean }) {
  const { busy, run } = useAction()
  return (
    <Btn
      busy={busy === 'c'}
      dark={deleted}
      danger={!deleted}
      onClick={() => run('c', () => supabaseBrowser().from('comments').update({ deleted_at: deleted ? null : new Date().toISOString() }).eq('id', id))}
    >
      {deleted ? 'Restore' : 'Delete'}
    </Btn>
  )
}

export function UserModButtons({
  id,
  banned,
  role,
  self,
  viewerIsAdmin = true,
}: {
  id: string
  banned: boolean
  role: string
  self: boolean
  viewerIsAdmin?: boolean
}) {
  const { busy, run } = useAction()
  if (self) return <span className="text-xs text-ink-3">You</span>
  const db = () => supabaseBrowser()
  // Moderators can only act on ordinary members.
  const canBlock = viewerIsAdmin || role === 'member'
  return (
    <div className="flex items-center justify-end gap-1.5">
      {canBlock ? (
        <Btn
          busy={busy === 'ban'}
          danger={!banned}
          dark={banned}
          onClick={() =>
            run(
              'ban',
              () => db().rpc('set_user_banned', { p_user: id, p_banned: !banned }),
              undefined,
              banned ? undefined : 'Block this person from uploading and commenting? They can still read the site.',
            )
          }
        >
          {banned ? 'Unblock' : 'Block'}
        </Btn>
      ) : (
        <span className="text-xs text-ink-3">Staff</span>
      )}
      {viewerIsAdmin && (
        <label className="relative inline-flex">
          <span className="sr-only">Role</span>
          <select
            value={role}
            disabled={busy === 'role'}
            onChange={(e) => {
              const next = e.target.value
              if (next === role) return
              void run(
                'role',
                () => db().rpc('set_user_role', { p_user: id, p_role: next }),
                undefined,
                next === 'admin'
                  ? 'Give this person full admin powers?'
                  : next === 'moderator'
                    ? 'Make this person a moderator? They can hide notes and comments and block members.'
                    : 'Make this person an ordinary member?',
              )
            }}
            className="h-8 rounded-lg border border-line bg-surface px-2 text-xs font-medium"
          >
            <option value="member">Member</option>
            <option value="moderator">Moderator</option>
            <option value="admin">Admin</option>
          </select>
        </label>
      )}
    </div>
  )
}

/**
 * One open report: hide the reported note (or comment) and close its reports, or just dismiss them.
 * Nothing is deleted; hidden items can be restored from the Files / Comments tabs.
 */
export function ReportActions({
  fileId,
  commentId,
  subject,
  unit,
}: {
  fileId?: string
  commentId?: string
  subject?: string
  unit?: number
}) {
  const { busy, run } = useAction()
  const db = () => supabaseBrowser()
  const resolve = () => db().rpc('resolve_reports', { p_file: fileId ?? null, p_comment: commentId ?? null })
  return (
    <div className="flex justify-end gap-1.5">
      <Btn busy={busy === 'dismiss'} onClick={() => run('dismiss', resolve)}>
        Dismiss
      </Btn>
      <Btn
        danger
        busy={busy === 'hide'}
        onClick={() =>
          run(
            'hide',
            async () => {
              const hidden = fileId
                ? await db().from('files').update({ deleted_at: new Date().toISOString() }).eq('id', fileId)
                : await db().from('comments').update({ deleted_at: new Date().toISOString() }).eq('id', commentId!)
              if (hidden.error) return hidden
              return resolve()
            },
            subject && unit !== undefined ? () => refreshChapter(subject, unit) : undefined,
            fileId ? 'Hide this note from the site?' : 'Delete this comment?',
          )
        }
      >
        {fileId ? 'Hide note' : 'Delete comment'}
      </Btn>
    </div>
  )
}

/** Mark a suggestion as seen or done (staff only; the database enforces it). */
export function SuggestionStatusButtons({ id, status }: { id: string; status: string }) {
  const { busy, run } = useAction()
  const set = (next: string) => run(next, () => supabaseBrowser().from('suggestions').update({ status: next }).eq('id', id))
  return (
    <div className="flex justify-end gap-1.5">
      {status !== 'seen' && status !== 'done' && (
        <Btn busy={busy === 'seen'} onClick={() => set('seen')}>
          Mark seen
        </Btn>
      )}
      {status !== 'done' ? (
        <Btn dark busy={busy === 'done'} onClick={() => set('done')}>
          Done
        </Btn>
      ) : (
        <Btn busy={busy === 'new'} onClick={() => set('new')}>
          Reopen
        </Btn>
      )}
    </div>
  )
}

/** Shown on a file's page to admins and moderators only: hide it from the site right away. */
export function AdminFileQuickHide({ id, subject, unit }: { id: string; subject: string; unit: number }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const { busy, run } = useAction()
  const router = useRouter()

  useEffect(() => {
    const supabase = supabaseBrowser()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setIsAdmin(false)
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      const r = (p as { role: string } | null)?.role
      setIsAdmin(r === 'admin' || r === 'moderator')
    })
  }, [])

  if (!isAdmin) return null
  return (
    <Btn
      danger
      busy={busy === 'q'}
      onClick={() =>
        run(
          'q',
          () => supabaseBrowser().from('files').update({ deleted_at: new Date().toISOString() }).eq('id', id),
          async () => {
            await refreshChapter(subject, unit)
            router.push('/admin?tab=files')
          },
          'Hide this file from the site? You can restore it or delete it forever from the Admin page.',
        )
      }
    >
      Hide (admin)
    </Btn>
  )
}
