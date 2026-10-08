import Link from 'next/link'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'

export interface ViewerNav {
  back: { href: string; label: string }
  title: string
  meta: string
  prev?: string
  next?: string
  position?: string
  actions: React.ReactNode
}

/** Full-height frame shared by every viewer: back link, title, prev / next, actions. */
export function ViewerShell({ nav, children }: { nav: ViewerNav; children: React.ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-4rem)] flex-col">
      <div className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href={nav.back.href} className="grid size-10 shrink-0 place-items-center rounded-xl border border-line hover:bg-surface-2" aria-label={`Back to ${nav.back.label}`}>
            <ArrowLeft className="size-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold sm:text-base">{nav.title}</p>
            <p className="truncate text-xs text-ink-3">{nav.meta}</p>
          </div>
          <div className="flex items-center gap-2">
            {(nav.prev || nav.next) && (
              <div className="flex items-center rounded-xl border border-line">
                <NavLink href={nav.prev} label="Previous file">
                  <ChevronLeft className="size-4" />
                </NavLink>
                {nav.position && <span className="px-1 text-xs tabular-nums text-ink-3">{nav.position}</span>}
                <NavLink href={nav.next} label="Next file">
                  <ChevronRight className="size-4" />
                </NavLink>
              </div>
            )}
            {nav.actions}
          </div>
        </div>
      </div>
      <div className="relative min-h-0 flex-1 bg-surface-2">{children}</div>
    </div>
  )
}

function NavLink({ href, label, children }: { href?: string; label: string; children: React.ReactNode }) {
  if (!href) return <span className="grid size-9 place-items-center text-ink-3/50">{children}</span>
  return (
    <Link href={href} aria-label={label} className="grid size-9 place-items-center rounded-xl hover:bg-surface-2">
      {children}
    </Link>
  )
}

export function ActionLink({ href, children, primary, newTab }: { href: string; children: React.ReactNode; primary?: boolean; newTab?: boolean }) {
  return (
    <a
      href={href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
      className={`inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium ${primary ? 'bg-ink text-bg hover:opacity-90' : 'border border-line hover:bg-surface-2'}`}
    >
      {children}
    </a>
  )
}
