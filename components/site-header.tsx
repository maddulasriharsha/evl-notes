import Link from 'next/link'
import { Search, Upload } from 'lucide-react'
import { AccountButton } from '@/components/account-button'
import { LogoMark } from '@/components/logo'

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 sm:gap-3 sm:px-6">
        <Link href="/" className="flex min-w-0 shrink items-center gap-2.5 rounded-lg pr-1" aria-label="EVL Notes home">
          <LogoMark />
          <span className="font-display text-[1.15rem] font-semibold tracking-tight whitespace-nowrap">EVL Notes</span>
        </Link>
        <nav className="ml-4 hidden items-center gap-1 text-sm whitespace-nowrap text-ink-2 lg:flex">
          <Link href="/#semesters" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">Semesters</Link>
          <Link href="/contributors" className="rounded-lg px-3 py-2 hover:bg-surface-2 hover:text-ink">Contributors</Link>
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <form action="/search" className="relative hidden md:block">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
            <input
              name="q"
              type="search"
              placeholder="Search subjects, chapters, notes"
              className="h-10 w-56 rounded-xl border border-line bg-surface pr-3 pl-9 text-sm outline-none placeholder:text-ink-3 focus:border-accent xl:w-80"
            />
          </form>
          <Link href="/search" className="grid size-10 place-items-center rounded-xl border border-line bg-surface md:hidden" aria-label="Search">
            <Search className="size-4" />
          </Link>
          <Link
            href="/upload"
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-3.5 text-sm font-medium whitespace-nowrap text-bg shadow-card transition hover:opacity-90"
          >
            <Upload className="size-4" />
            <span className="hidden sm:inline">Upload notes</span>
          </Link>
          <AccountButton />
        </div>
      </div>
    </header>
  )
}
