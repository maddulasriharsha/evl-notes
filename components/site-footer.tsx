import Link from 'next/link'
import { InstallButton } from '@/components/install-button'
import { LogoMark } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

export function SiteFooter() {
  return (
    <footer className="mt-20">
      <div className="mx-auto flex max-w-5xl flex-col gap-4 border-t border-white/[0.06] px-4 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-5" />
          <span>VJNOTES · VNR VJIET class notes</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/#branches" className="hover:text-ink">Branches</Link>
          <Link href="/contributors" className="hover:text-ink">Contributors</Link>
          <Link href="/search" className="hover:text-ink">Search</Link>
          <Link href="/upload" className="hover:text-ink">Upload</Link>
          <Link href="/requests" className="hover:text-ink">Requests</Link>
          <Link href="/suggest" className="hover:text-ink">Suggest</Link>
          <Link href="/share" className="hover:text-ink">Share</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
          <ThemeToggle withLabel className="inline-flex items-center gap-1.5 hover:text-ink" />
          <InstallButton className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink" />
        </div>
      </div>
      <p className="pb-8 text-center text-xs tracking-wide text-ink-3">Created by: Harsha (2nd Year)</p>
    </footer>
  )
}
