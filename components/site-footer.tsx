import Link from '@/components/link'
import { InstallButton } from '@/components/install-button'
import { LogoMark } from '@/components/logo'
import { ThemeToggle } from '@/components/theme-toggle'

const GROUPS = [
  {
    title: 'Browse',
    links: [
      { href: '/#branches', label: 'Branches' },
      { href: '/search', label: 'Search' },
      { href: '/saved', label: 'Saved notes' },
    ],
  },
  {
    title: 'Contribute',
    links: [
      { href: '/upload', label: 'Upload notes' },
      { href: '/exams', label: 'Exam schedule' },
      { href: '/textbooks', label: 'Textbooks' },
      { href: '/requests', label: 'Requests' },
      { href: '/contributors', label: 'Contributors' },
      { href: '/suggest', label: 'Suggest an idea' },
    ],
  },
  {
    title: 'Site',
    links: [
      { href: '/share', label: 'Share VJNOTES' },
      { href: '/privacy', label: 'Privacy' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-white/[0.06]">
      <div className="mx-auto grid max-w-5xl gap-10 px-4 pt-12 pb-10 sm:px-6 md:grid-cols-[1.4fr_2fr]">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 rounded-lg" aria-label="VJNOTES home">
            <LogoMark className="size-7" />
            <span className="font-display text-lg font-bold tracking-tight">VJNOTES</span>
          </Link>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-3">
            Class notes for every B.Tech branch at VNR VJIET, sorted by semester, subject and chapter. Free to read, no
            sign-in needed.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <ThemeToggle withLabel className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-ink-2 hover:text-ink" />
            <InstallButton className="btn-ghost inline-flex h-9 items-center gap-1.5 rounded-lg px-3 font-medium text-ink-2 hover:text-ink" />
          </div>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {GROUPS.map((g) => (
            <div key={g.title}>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-3 uppercase">{g.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {g.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="rounded text-ink-2 transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 border-t border-white/[0.06] px-4 py-6 text-xs text-ink-3 sm:flex-row sm:px-6">
        <p>Made by students, for students · VNR VJIET</p>
        <p className="tracking-wide">Created by: Harsha (2nd Year)</p>
      </div>
    </footer>
  )
}
