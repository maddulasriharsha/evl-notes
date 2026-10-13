'use client'

import Link from '@/components/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import {
  Bell,
  Bookmark,
  ChevronDown,
  CloudUpload,
  HandHelping,
  LayoutDashboard,
  Lightbulb,
  LogIn,
  LogOut,
  Menu,
  NotebookText,
  Search,
  Share2,
  ShieldCheck,
  Users,
  UserRound,
} from 'lucide-react'
import { InstallButton } from '@/components/install-button'
import { ThemeToggle } from '@/components/theme-toggle'
import { supabaseConfigured } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

interface Account {
  id: string
  email: string
  name: string
  role: 'member' | 'moderator' | 'admin'
}

/** Client-side so public pages stay cacheable; reads the session from the browser. */
export function AccountButton() {
  const router = useRouter()
  const [account, setAccount] = useState<Account | null | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabaseConfigured) return setAccount(null)
    const supabase = supabaseBrowser()
    let loadedFor: string | null = null
    const load = async (user: { id: string; email?: string; user_metadata?: Record<string, unknown> } | null) => {
      if (!user) {
        loadedFor = null
        return setAccount(null)
      }
      // The session is reported several times at start-up; fetch the profile only once per person.
      if (loadedFor === user.id) return
      loadedFor = user.id
      const { data } = await supabase.from('profiles').select('display_name, role').eq('id', user.id).maybeSingle()
      const p = data as { display_name: string; role: string } | null
      setAccount({
        id: user.id,
        email: user.email ?? '',
        name: p?.display_name ?? String(user.user_metadata?.full_name ?? user.email ?? 'You'),
        role: p?.role === 'admin' ? 'admin' : p?.role === 'moderator' ? 'moderator' : 'member',
      })
    }
    supabase.auth.getSession().then(({ data }) => load(data.session?.user ?? null))
    const { data } = supabase.auth.onAuthStateChange((_e, session) => void load(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !box.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  async function signOut() {
    setOpen(false)
    await supabaseBrowser().auth.signOut()
    await fetch('/auth/signout', { method: 'POST', redirect: 'manual' }).catch(() => undefined)
    router.push('/')
    router.refresh()
  }

  if (account === undefined) return <span className="size-10" aria-hidden="true" />

  const item = 'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-surface-2'

  /** Links everyone can use, signed in or not. */
  const shared = (
    <>
      <Link role="menuitem" href="/requests" onClick={() => setOpen(false)} className={item}>
        <HandHelping className="size-4 text-ink-3" /> Note requests
      </Link>
      <Link role="menuitem" href="/suggest" onClick={() => setOpen(false)} className={item}>
        <Lightbulb className="size-4 text-ink-3" /> Suggestion box
      </Link>
      <Link role="menuitem" href="/share" onClick={() => setOpen(false)} className={item}>
        <Share2 className="size-4 text-ink-3" /> Share VJNOTES
      </Link>
      <InstallButton className={`${item} w-full`} onDone={() => setOpen(false)} />
      <ThemeToggle withLabel className={`${item} w-full`} />
    </>
  )

  if (account === null) {
    return (
      <div ref={box} className="relative flex items-center gap-1.5">
        <Link
          href="/login"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-2.5 text-sm font-medium whitespace-nowrap hover:border-line-strong sm:px-3"
        >
          <LogIn className="hidden size-4 sm:block" />
          <span>Sign in</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label="Menu"
          className="grid size-10 place-items-center rounded-xl border border-line bg-surface hover:border-line-strong"
        >
          <Menu className="size-4" />
        </button>
        {open && (
          <div role="menu" className="absolute top-full right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-pop">
            <Link role="menuitem" href="/#branches" onClick={() => setOpen(false)} className={item}>
              <NotebookText className="size-4 text-ink-3" /> Browse branches
            </Link>
            <Link role="menuitem" href="/search" onClick={() => setOpen(false)} className={item}>
              <Search className="size-4 text-ink-3" /> Search
            </Link>
            <Link role="menuitem" href="/contributors" onClick={() => setOpen(false)} className={item}>
              <Users className="size-4 text-ink-3" /> Contributors
            </Link>
            <div className="my-1 h-px bg-line" />
            {shared}
            <div className="my-1 h-px bg-line" />
            <Link role="menuitem" href="/privacy" onClick={() => setOpen(false)} className={item}>
              <ShieldCheck className="size-4 text-ink-3" /> Privacy
            </Link>
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface pr-2 pl-1 hover:border-line-strong"
      >
        <span className="grid size-8 place-items-center rounded-lg bg-accent-soft text-sm font-semibold text-accent">
          {account.name.trim().charAt(0).toUpperCase() || <UserRound className="size-4" />}
        </span>
        <ChevronDown className={`size-4 text-ink-3 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 rounded-2xl border border-line bg-surface p-2 shadow-pop">
          <div className="px-3 py-2">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
              <span className="truncate">{account.name}</span>
              {account.role === 'admin' && (
                <span className="rounded-md bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-gold uppercase">Admin</span>
              )}
              {account.role === 'moderator' && (
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">Mod</span>
              )}
            </p>
            <p className="truncate text-xs text-ink-3">{account.email}</p>
          </div>
          <div className="my-1 h-px bg-line" />
          <Link role="menuitem" href="/me#profile" onClick={() => setOpen(false)} className={item}>
            <UserRound className="size-4 text-ink-3" /> Profile & password
          </Link>
          <Link role="menuitem" href="/me" onClick={() => setOpen(false)} className={item}>
            <NotebookText className="size-4 text-ink-3" /> My notes
          </Link>
          <Link role="menuitem" href="/following" onClick={() => setOpen(false)} className={item}>
            <Bell className="size-4 text-ink-3" /> Following
          </Link>
          <Link role="menuitem" href="/saved" onClick={() => setOpen(false)} className={item}>
            <Bookmark className="size-4 text-ink-3" /> Saved notes
          </Link>
          <Link role="menuitem" href="/upload" onClick={() => setOpen(false)} className={item}>
            <CloudUpload className="size-4 text-ink-3" /> Upload notes
          </Link>
          {account.role !== 'member' && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className={item}>
              <LayoutDashboard className="size-4 text-ink-3" /> {account.role === 'admin' ? 'Admin dashboard' : 'Moderation'}
            </Link>
          )}
          <div className="my-1 h-px bg-line" />
          {shared}
          <div className="my-1 h-px bg-line" />
          <button role="menuitem" type="button" onClick={signOut} className={`${item} text-danger`}>
            <LogOut className="size-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}
