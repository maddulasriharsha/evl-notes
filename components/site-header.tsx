import Link from '@/components/link'
import { Upload } from 'lucide-react'
import { AccountButton } from '@/components/account-button'
import { PaletteButton } from '@/components/command-palette'
import { NavLinks } from '@/components/page-chrome'
import { LogoMark } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

/** Floating glass pill, centred at the top like a cinematic app bar. */
export function SiteHeader() {
  return (
    <header data-chrome className="pointer-events-none sticky top-0 z-40 px-3 pt-3 sm:px-4 sm:pt-4">
      <div className="glass-bar pointer-events-auto mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-2xl border border-white/[0.08] bg-surface/70 pr-2 pl-3 shadow-[0_8px_32px_-12px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-xl sm:gap-3">
        <Link href="/" className="group flex min-w-0 shrink items-center gap-2.5 rounded-lg pr-1" aria-label="VJNOTES home">
          <LogoMark className="size-7 shrink-0 transition duration-500 group-hover:-rotate-12 group-hover:scale-110" />
          <span className="font-display text-[1.05rem] font-bold tracking-tight whitespace-nowrap">VJNOTES</span>
        </Link>
        <NavLinks />
        <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
          <PaletteButton />
          <ThemeToggle className="btn-ghost grid size-10 place-items-center rounded-xl" />
          <Link href="/upload" className="btn-primary hidden h-10 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold whitespace-nowrap md:inline-flex">
            <Upload className="size-4" />
            <span>Upload</span>
          </Link>
          <AccountButton />
        </div>
      </div>
    </header>
  )
}
