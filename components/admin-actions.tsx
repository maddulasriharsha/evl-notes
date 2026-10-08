'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
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

export function FileModButtons({ id, hidden, subject, unit }: { id: string; hidden: boolean; subject: string; unit: number }) {
  const { busy, run } = useAction()
  const db = () => supabaseBrowser()
  const refresh = () => refreshChapter(subject, unit)
  return (
    <div className="flex justify-end gap-1.5">
      <Btn
        busy={busy === 'hide'}
        dark={hidden}
        onClick={() => run('hide', () => db().from('files').update({ deleted_at: hidden ? null : new Date().toISOString() }).eq('id', id), refresh)}
      >
        {hidden ? 'Restore' : 'Hide'}
      </Btn>
      {hidden && (
        <Btn
          danger
          busy={busy === 'purge'}
          onClick={() =>
            run(
              'purge',
              async () => {
                const { data, error } = await db().rpc('admin_purge_file', { p_file: id })
                if (error) return { error }
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

export function UserModButtons({ id, banned, role, self }: { id: string; banned: boolean; role: string; self: boolean }) {
  const { busy, run } = useAction()
  if (self) return <span className="text-xs text-ink-3">You</span>
  const db = () => supabaseBrowser()
  return (
    <div className="flex justify-end gap-1.5">
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
      <Btn
        busy={busy === 'role'}
        onClick={() =>
          run(
            'role',
            () => db().rpc('set_user_role', { p_user: id, p_role: role === 'admin' ? 'member' : 'admin' }),
            undefined,
            role === 'admin' ? 'Remove admin powers from this person?' : 'Give this person full admin powers?',
          )
        }
      >
        {role === 'admin' ? 'Remove admin' : 'Make admin'}
      </Btn>
    </div>
  )
}

/** Shown on a file's page to admins only: hide it from the site right away. */
export function AdminFileQuickHide({ id, subject, unit }: { id: string; subject: string; unit: number }) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null)
  const { busy, run } = useAction()
  const router = useRouter()

  useEffect(() => {
    const supabase = supabaseBrowser()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setIsAdmin(false)
      const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
      setIsAdmin((p as { role: string } | null)?.role === 'admin')
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
