import Link from 'next/link'
import { LogoMark } from '@/components/logo'

export function SiteFooter() {
  return (
    <footer className="mt-28">
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
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </div>
      </div>
      <p className="pb-8 text-center text-xs tracking-wide text-ink-3">Created by: Sriharsha Reddy (EVL)</p>
    </footer>
  )
}
