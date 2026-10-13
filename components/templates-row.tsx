import Link from 'next/link'
import { ArrowRight, FileText } from 'lucide-react'
import { templateHref, templates } from '@/lib/templates'

/** Record sheets and report templates, shown above the subjects of every semester. */
export function TemplatesRow() {
  if (templates.length === 0) return null
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-semibold tracking-widest text-ink-3 uppercase">Templates</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((t) => (
          <Link
            key={t.slug}
            href={templateHref(t.slug)}
            className="fx-card fx-reveal group flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-card transition hover:border-accent"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-line bg-bg text-ink-2">
              <FileText className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{t.title}</span>
              <span className="block truncate text-xs text-ink-3">{t.note}</span>
            </span>
            <span className="rounded-md bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-3">{t.format}</span>
            <ArrowRight className="size-4 shrink-0 text-ink-3 transition group-hover:translate-x-0.5 group-hover:text-ink" />
          </Link>
        ))}
      </div>
    </section>
  )
}
