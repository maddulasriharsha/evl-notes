import Link from 'next/link'
import { Search, Upload } from 'lucide-react'
import { AccountButton } from '@/components/account-button'
import { LogoMark } from '@/components/logo'

/** Floating glass pill, centred at the top like a cinematic app bar. */
export function SiteHeader() {
  return (
    <header className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="pointer-events-auto mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-2xl border border-white/[0.08] bg-[#0b0b0f]/70 pr-2 pl-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:gap-3">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2.5 rounded-lg pr-1" aria-label="EVL Notes home">
          <LogoMark className="size-7" />
          <span className="font-display text-[1.05rem] font-bold tracking-tight whitespace-nowrap">EVL Notes</span>
        </Link>
        <span className="hidden items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-[11px] font-medium text-ink-2 lg:inline-flex">
          <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" /> R25 · VNR VJIET
        </span>
        <nav className="ml-2 hidden items-center gap-0.5 text-sm text-ink-2 md:flex">
          <Link href="/#semesters" className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] hover:text-ink">Semesters</Link>
          <Link href="/contributors" className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] hover:text-ink">Contributors</Link>
          <Link href="/search" className="rounded-lg px-3 py-1.5 hover:bg-white/[0.06] hover:text-ink">Search</Link>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <Link href="/search" className="btn-ghost grid size-10 place-items-center rounded-xl md:hidden" aria-label="Search">
            <Search className="size-4" />
          </Link>
          <Link href="/upload" className="btn-primary inline-flex h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap">
            <Upload className="size-4" />
            <span className="hidden sm:inline">Upload</span>
          </Link>
          <AccountButton />
        </div>
      </div>
    </header>
  )
}
