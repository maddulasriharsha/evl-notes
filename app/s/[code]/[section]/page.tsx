import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowRight, CloudUpload } from 'lucide-react'
import { DriveFileCard, UploadFileCard } from '@/components/file-card'
import { ButtonLink, Container, Crumbs, Empty, OwnerName } from '@/components/ui'
import {
  findSubject,
  parseSectionSlug,
  sectionHref,
  sectionLabel,
  sectionsOf,
  sectionTitle,
  subjectCrumbs,
  subjectHref,
  allSubjects,
  sectionSlug,
} from '@/lib/curriculum'
import { collectionsFor, type NoteCollection } from '@/lib/data'
import { driveFilesFor, LIBRARY_OWNER, type DriveFile } from '@/lib/library'
import { formatDate, plural, timeAgo } from '@/lib/format'

export const revalidate = 60

export function generateStaticParams() {
  return allSubjects().flatMap(({ subject }) =>
    sectionsOf(subject).map((u) => ({ code: subject.code.toLowerCase(), section: sectionSlug(u) })),
  )
}

async function resolve(params: PageProps<'/s/[code]/[section]'>['params']) {
  const { code, section } = await params
  const found = findSubject(code)
  const unit = parseSectionSlug(section)
  if (!found || unit === null || !sectionsOf(found.subject).includes(unit)) return null
  return { ...found, unit }
}

export async function generateMetadata({ params }: PageProps<'/s/[code]/[section]'>): Promise<Metadata> {
  const r = await resolve(params)
  if (!r) return { title: 'Chapter' }
  return { title: `${sectionTitle(r.subject, r.unit)} · ${r.subject.short}` }
}

export default async function SectionPage({ params }: PageProps<'/s/[code]/[section]'>) {
  const r = await resolve(params)
  if (!r) notFound()
  const { subject, semester, unit } = r
  const collections = await collectionsFor(subject.code, unit)
  const order = sectionsOf(subject)
  const idx = order.indexOf(unit)
  const prev = idx > 0 ? order[idx - 1] : undefined
  const next = idx < order.length - 1 ? order[idx + 1] : undefined
  // The owner's Drive notes join the owner's own shelf (if any) as one card, shown first.
  const drive = driveFilesFor(subject.code, unit)
  const isOwner = (c: NoteCollection) => c.owner_is_admin && c.owner_name === LIBRARY_OWNER.name
  const ownerShelf = collections.find(isOwner)
  const cards: { key: string; collection?: NoteCollection; drive: DriveFile[] }[] = [
    ...(ownerShelf || drive.length ? [{ key: ownerShelf?.id ?? 'owner', collection: ownerShelf, drive }] : []),
    ...collections.filter((c) => c !== ownerShelf).map((c) => ({ key: c.id, collection: c, drive: [] as DriveFile[] })),
  ]
  const totalFiles = collections.reduce((n, c) => n + c.files.length, 0) + drive.length
  const uploadHref = `/upload?subject=${subject.code}&unit=${unit}`

  return (
    <>
      <section className="grain border-b border-line">
        <Container className="pt-10 pb-10">
          <Crumbs
            items={[
              ...subjectCrumbs(r),
              { href: subjectHref(subject.code), label: subject.short },
              { label: sectionLabel(unit) },
            ]}
          />
          <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">
                {subject.short} · {sectionLabel(unit)}
              </p>
              <h1 className="mt-2 font-display text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
                {sectionTitle(subject, unit)}
              </h1>
              <p className="mt-3 text-sm text-ink-3">
                {plural(cards.length, 'contributor')} · {plural(totalFiles, 'file')}
              </p>
            </div>
            <ButtonLink href={uploadHref}>
              <CloudUpload className="size-4" /> Add your notes here
            </ButtonLink>
          </div>
        </Container>
      </section>

      <Container className="mt-10 space-y-14">
        <section>
          <h2 className="mb-4 font-display text-xl font-semibold tracking-tight">Notes</h2>
          {cards.length === 0 ? (
            <Empty title="No notes for this chapter yet">
              Took notes in class? <Link href={uploadHref} className="font-medium text-accent">Upload them</Link> and they will appear here under your name.
            </Empty>
          ) : (
            <div className="space-y-6">
              {cards.map(({ key, collection: c, drive: driveList }) => {
                const name = c?.owner_name ?? LIBRARY_OWNER.name
                const admin = c ? c.owner_is_admin : LIBRARY_OWNER.admin
                const mod = c ? c.owner_is_mod : false
                const count = (c?.files.length ?? 0) + driveList.length
                return (
                  <article
                    key={key}
                    id={c && !driveList.length ? `c-${c.id}` : 'owner-notes'}
                    className="scroll-mt-24 rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5"
                  >
                    {c && driveList.length > 0 && <span id={`c-${c.id}`} className="block scroll-mt-24" />}
                    <header className="mb-4 flex flex-wrap items-center gap-3">
                      <span className="grid size-10 place-items-center rounded-full bg-accent-soft font-semibold text-accent">
                        {name.charAt(0).toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center font-semibold">
                          <OwnerName name={`${name}’s notes`} admin={admin} moderator={mod} />
                        </p>
                        <p className="text-xs text-ink-3">
                          {plural(count, 'file')}
                          {c && ` · started ${formatDate(c.created_at)} · updated ${timeAgo(c.updated_at)}`}
                        </p>
                      </div>
                    </header>
                    {c?.description && <p className="mb-4 text-sm whitespace-pre-line text-ink-2">{c.description}</p>}
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {c?.files.map((f) => <UploadFileCard key={f.id} file={f} subject={subject.code} unit={unit} />)}
                      {driveList.map((f) => (
                        <DriveFileCard key={f.id} file={f} />
                      ))}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </section>


        <nav className="flex items-stretch justify-between gap-3 border-t border-line pt-6">
          {prev !== undefined ? (
            <Link href={sectionHref(subject.code, prev)} className="group flex max-w-[48%] items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
              <ArrowLeft className="size-4 shrink-0 text-ink-3" />
              <span className="min-w-0">
                <span className="block text-xs text-ink-3">{sectionLabel(prev)}</span>
                <span className="block truncate text-sm font-medium">{sectionTitle(subject, prev)}</span>
              </span>
            </Link>
          ) : (
            <span />
          )}
          {next !== undefined && (
            <Link href={sectionHref(subject.code, next)} className="group flex max-w-[48%] items-center gap-3 rounded-xl p-2 text-right hover:bg-surface-2">
              <span className="min-w-0">
                <span className="block text-xs text-ink-3">{sectionLabel(next)}</span>
                <span className="block truncate text-sm font-medium">{sectionTitle(subject, next)}</span>
              </span>
              <ArrowRight className="size-4 shrink-0 text-ink-3" />
            </Link>
          )}
        </nav>
      </Container>
    </>
  )
}
