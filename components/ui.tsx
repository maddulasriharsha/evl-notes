import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function Container({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto max-w-6xl px-4 sm:px-6 ${className}`}>{children}</div>
}

export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-ink-3">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3.5 opacity-60" />}
          {item.href ? (
            <Link href={item.href} className="rounded hover:text-ink">{item.label}</Link>
          ) : (
            <span className="text-ink-2">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}

const tones = {
  neutral: 'bg-surface-2 text-ink-2',
  accent: 'bg-accent-soft text-accent',
  gold: 'bg-gold-soft text-gold',
  ok: 'bg-ok-soft text-ok',
} as const

export function Badge({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: keyof typeof tones }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium tracking-wide uppercase ${tones[tone]}`}>
      {children}
    </span>
  )
}

export function SectionHeading({ title, hint, action }: { title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
        {hint && <p className="mt-1 text-sm text-ink-3">{hint}</p>}
      </div>
      {action}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong bg-surface/60 px-6 py-10 text-center">
      <p className="font-medium">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-ink-3">{children}</div>}
    </div>
  )
}

export function ButtonLink({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'ghost' }) {
  const cls = variant === 'primary' ? 'btn-primary' : 'btn-ghost'
  return (
    <Link href={href} className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${cls}`}>
      {children}
    </Link>
  )
}

/** A person's display name, with an Admin badge for the site owner. */
export function OwnerName({
  name,
  admin,
  moderator,
  className = '',
}: {
  name: string
  admin?: boolean
  moderator?: boolean
  className?: string
}) {
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className}`}>
      <span className="truncate">{name}</span>
      {admin ? (
        <span className="shrink-0 rounded-md bg-gold-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-gold uppercase">Admin</span>
      ) : moderator ? (
        <span className="shrink-0 rounded-md bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-accent uppercase">Mod</span>
      ) : null}
    </span>
  )
}
