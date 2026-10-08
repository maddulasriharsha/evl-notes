import Link from 'next/link'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-ink-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <span className="font-medium text-ink-2">EVL Notes</span>
          <Link href="/" className="hover:text-ink">Semesters</Link>
          <Link href="/contributors" className="hover:text-ink">Contributors</Link>
          <Link href="/search" className="hover:text-ink">Search</Link>
          <Link href="/upload" className="hover:text-ink">Upload</Link>
        </div>
        <p className="text-xs tracking-wide">Created by: Sriharsha Reddy (EVL)</p>
      </div>
    </footer>
  )
}
