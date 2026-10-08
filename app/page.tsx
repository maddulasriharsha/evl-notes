import Link from 'next/link'
import {
  ArrowRight,
  BookOpen,
  Camera,
  CloudUpload,
  FileStack,
  FileText,
  FlaskConical,
  Library,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
} from 'lucide-react'
import { Thumb } from '@/components/thumb'
import { OwnerName } from '@/components/ui'
import { allSubjects, extras, findSubject, regularSemesters, sectionHref, sectionLabel, semesterLabel, subjectHref } from '@/lib/curriculum'
import { contributors, countsBySubject, recentlyUpdated, uploadTotals } from '@/lib/data'
import { DRIVE_LIBRARY } from '@/lib/drive-stats'
import { publicFileUrl } from '@/lib/env'
import { plural, timeAgo } from '@/lib/format'
import { driveCount } from '@/lib/library'

export const revalidate = 60

const n = (x: number) => x.toLocaleString('en-IN')

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="text-center text-[11px] font-semibold tracking-[0.25em] text-ink-3 uppercase">{children}</p>
}

function FloatingIcon({ icon: Icon, className, delay = '0s' }: { icon: typeof BookOpen; className: string; delay?: string }) {
  return (
    <span
      className={`float absolute hidden size-12 place-items-center rounded-2xl border border-white/[0.08] bg-[#111116] text-ink-2 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)] md:grid ${className}`}
      style={{ animationDelay: delay }}
      aria-hidden="true"
    >
      <Icon className="size-5" strokeWidth={1.6} />
    </span>
  )
}

export default async function Home() {
  const [counts, recent, people, uploads] = await Promise.all([countsBySubject(), recentlyUpdated(6), contributors(), uploadTotals()])
  const totalMaterials = uploads.files + DRIVE_LIBRARY.files
  const totalPages = uploads.pages + DRIVE_LIBRARY.pages
  const chapters = allSubjects().reduce((sum, { subject }) => sum + subject.units.length, 0)
  const total = (code: string) => (counts[code] ?? 0) + driveCount(code)
  const strip = allSubjects().filter(({ subject }) => subject.kind !== 'extra')

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative -mt-[4.25rem] overflow-hidden pt-[4.25rem] sm:-mt-[4.5rem] sm:pt-[4.5rem]">
        <div className="horizon" aria-hidden="true" />
        <div className="horizon-haze" aria-hidden="true" />
        <div className="relative mx-auto flex min-h-[660px] max-w-5xl flex-col items-center px-4 pt-16 text-center sm:min-h-[700px] sm:pt-24">
          <Link
            href="/#semesters"
            className="rise inline-flex items-center gap-2 rounded-full border border-white/[0.1] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-ink-2 backdrop-blur hover:text-ink"
          >
            <Star className="size-3.5 fill-gold text-gold" />
            {n(totalMaterials)} materials · {n(totalPages)} pages
          </Link>
          <h1 className="rise rise-1 mt-8 font-display text-[2.6rem] leading-[1.02] font-bold tracking-tight sm:text-7xl">
            <span className="text-glow">Class notes.</span>{' '}
            <span className="block text-white/40 sm:inline">For everyone.</span>
          </h1>
          <p className="rise rise-2 mx-auto mt-6 max-w-xl text-base leading-relaxed text-ink-2 sm:text-lg">
            Every lecture of B.Tech EVL, written down once and shared with the whole class. Organised by semester,
            subject and chapter. Free to read, no sign-in needed.
          </p>
          <div className="rise rise-3 mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="#semesters" className="btn-primary inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
              <BookOpen className="size-4" /> Browse notes
            </Link>
            <Link href="/upload" className="btn-ghost inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
              <CloudUpload className="size-4" /> Upload yours
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Subject marquee ---------- */}
      <section className="relative mt-4 sm:-mt-8">
        <Eyebrow>Every subject · every chapter · Sem 1 to 4</Eyebrow>
        <div className="marquee-wrap marquee-mask mt-6 overflow-hidden">
          <div className="marquee gap-3 pr-3">
            {[...strip, ...strip].map(({ subject, semester }, i) => (
              <Link
                key={`${subject.code}-${i}`}
                href={subjectHref(subject.code)}
                aria-hidden={i >= strip.length}
                tabIndex={i >= strip.length ? -1 : undefined}
                className="w-64 shrink-0 rounded-2xl border border-white/[0.07] bg-[#0c0c10] p-4 transition hover:border-accent/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="grid size-8 place-items-center rounded-lg bg-white/[0.05] text-ink-2">
                    {subject.kind === 'lab' ? <FlaskConical className="size-4" /> : <BookOpen className="size-4" />}
                  </span>
                  <span className="text-[11px] text-ink-3">Sem {semester.sem}</span>
                </div>
                <p className="mt-3 text-xs font-semibold tracking-widest text-accent uppercase">{subject.short}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink">{subject.name}</p>
                <p className="mt-2 text-xs text-ink-3">{plural(total(subject.code), 'file')}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        {/* ---------- App preview ---------- */}
        <section className="relative mt-28">
          <h2 className="text-center font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Open any chapter. <span className="text-white/40">It&rsquo;s all there.</span>
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-ink-2">
            Everyone&rsquo;s notes for a chapter, side by side. PDFs open right in the page, even on your phone.
          </p>
          <div className="relative mt-12">
            <FloatingIcon icon={Camera} className="top-6 -left-6" />
            <FloatingIcon icon={FileText} className="top-1/3 -right-6" delay="1.5s" />
            <FloatingIcon icon={MessageCircle} className="bottom-10 -left-4" delay="3s" />
            <FloatingIcon icon={FileStack} className="-top-6 right-24" delay="2.2s" />
            <div className="bezel shadow-[0_40px_120px_-30px_rgba(139,92,246,0.35)]">
              <div className="overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#09090c]">
                <div className="flex items-center gap-2 border-b border-white/[0.06] px-4 py-3">
                  <span className="size-2.5 rounded-full bg-[#ff5f57]" />
                  <span className="size-2.5 rounded-full bg-[#febc2e]" />
                  <span className="size-2.5 rounded-full bg-[#28c840]" />
                  <span className="ml-3 truncate rounded-md bg-white/[0.04] px-3 py-1 text-[11px] text-ink-3">evl-notes.vercel.app/s/25es1it102/unit-2</span>
                </div>
                <div className="grid sm:grid-cols-[200px_1fr]">
                  <aside className="hidden border-r border-white/[0.06] p-3 text-xs sm:block">
                    <p className="px-2 pb-2 text-[10px] font-semibold tracking-widest text-ink-3 uppercase">DS · Chapters</p>
                    {['Stacks & Searching', 'Queues & Linked Lists', 'Doubly Linked Lists', 'Trees & B-Trees', 'Hashing & Graphs', 'General'].map((t, i) => (
                      <p key={t} className={`truncate rounded-md px-2 py-1.5 ${i === 1 ? 'bg-accent/15 text-ink' : 'text-ink-3'}`}>
                        {i < 5 ? `Unit ${['I', 'II', 'III', 'IV', 'V'][i]} · ` : ''}
                        {t}
                      </p>
                    ))}
                  </aside>
                  <div className="p-4 sm:p-5">
                    <p className="text-[10px] font-semibold tracking-widest text-ink-3 uppercase">DS · Unit II</p>
                    <p className="mt-1 font-display text-lg font-bold">Queues and Linked Lists</p>
                    {['Sriharsha Reddy', 'Arjun', 'Meghana'].map((who, row) => (
                      <div key={who} className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                        <p className="flex items-center gap-2 text-xs font-semibold">
                          <span className="grid size-6 place-items-center rounded-full bg-accent/20 text-[10px] text-accent">{who[0]}</span>
                          {who}&rsquo;s notes
                          {row === 0 && <span className="rounded bg-gold-soft px-1 py-0.5 text-[9px] text-gold">ADMIN</span>}
                        </p>
                        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
                          {Array.from({ length: row === 0 ? 5 : 3 }, (_, i) => (
                            <div
                              key={i}
                              className={`aspect-[4/3] rounded-lg border border-white/[0.05] ${i > 2 ? 'hidden sm:block' : ''}`}
                              style={{
                                background: `linear-gradient(${140 + i * 25}deg, rgba(167,139,250,${0.06 + ((i + row) % 3) * 0.05}), rgba(255,255,255,0.02))`,
                              }}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Numbers ---------- */}
        <section className="mt-28 grid grid-cols-2 gap-px overflow-hidden rounded-3xl border border-white/[0.07] bg-white/[0.07] sm:grid-cols-4">
          {[
            { label: 'Total materials', value: n(totalMaterials), hint: `${n(uploads.files)} uploaded + ${n(DRIVE_LIBRARY.files)} from Drive` },
            { label: 'Total pages', value: n(totalPages), hint: 'PDF pages, slides and photos' },
            { label: 'Contributors', value: n(people.length), hint: 'classmates sharing notes' },
            { label: 'Chapters', value: n(chapters), hint: `across ${allSubjects().length} subjects` },
          ].map((s, i) => (
            <div key={s.label} className={`bg-[#08080b] px-5 py-6 ${i === 0 ? 'bg-gradient-to-b from-accent/10 to-transparent' : ''}`}>
              <p className="text-xs text-ink-3">{s.label}</p>
              <p className="mt-2 font-display text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs text-ink-3">{s.hint}</p>
            </div>
          ))}
        </section>

        {/* ---------- Semesters ---------- */}
        <section id="semesters" className="mt-28 scroll-mt-28">
          <Eyebrow>Browse</Eyebrow>
          <h2 className="mt-3 text-center font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Pick your semester. <span className="text-white/40">Start reading.</span>
          </h2>
          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            {regularSemesters.map((s) => {
              const files = s.subjects.reduce((sum, sub) => sum + total(sub.code), 0)
              return (
                <Link
                  key={s.sem}
                  href={`/sem/${s.sem}`}
                  className="group relative overflow-hidden rounded-3xl border border-white/[0.07] bg-[#0b0b0f] p-6 transition duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-[0_30px_80px_-30px_rgba(139,92,246,0.45)]"
                >
                  <div className="pointer-events-none absolute -top-24 -right-24 size-56 rounded-full bg-accent/10 blur-3xl transition group-hover:bg-accent/25" />
                  <div className="relative flex items-baseline justify-between">
                    <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-3 uppercase">Semester {s.sem}</p>
                    <p className="text-xs text-ink-3">{plural(files, 'file')}</p>
                  </div>
                  <h3 className="relative mt-3 font-display text-3xl font-bold tracking-tight">{semesterLabel(s)}</h3>
                  <div className="relative mt-5 flex flex-wrap gap-1.5">
                    {s.subjects.map((sub) => (
                      <span key={sub.code} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-xs font-medium text-ink-2">
                        {sub.short}
                      </span>
                    ))}
                  </div>
                  <p className="relative mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
                    Open {plural(s.subjects.length, 'subject')} <ArrowRight className="size-4 transition group-hover:translate-x-1" />
                  </p>
                </Link>
              )
            })}
          </div>
          {extras && (
            <p className="mt-5 text-center text-sm text-ink-3">
              Also available:{' '}
              {extras.subjects.map((x) => (
                <Link key={x.code} href={subjectHref(x.code)} className="font-medium text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
                  {x.name}
                </Link>
              ))}
            </p>
          )}
        </section>

        {/* ---------- Recently updated ---------- */}
        {recent.length > 0 && (
          <section className="mt-28">
            <Eyebrow>Fresh from class</Eyebrow>
            <h2 className="mt-3 text-center font-display text-3xl font-bold tracking-tight sm:text-4xl">Recently updated</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recent.map((c) => {
                const found = findSubject(c.subject_code)
                const cover = c.cover?.thumb_path
                  ? publicFileUrl(c.cover.thumb_path)
                  : c.cover && c.cover.mime !== 'application/pdf'
                    ? publicFileUrl(c.cover.storage_path)
                    : null
                return (
                  <Link
                    key={c.id}
                    href={`${sectionHref(c.subject_code, c.unit)}#c-${c.id}`}
                    className="group flex overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b0b0f] transition hover:border-accent/40"
                  >
                    <div className="w-28 shrink-0 border-r border-white/[0.06]">
                      <Thumb src={cover} icon={c.cover?.mime === 'application/pdf' ? 'pdf' : 'image'} label="notes" />
                    </div>
                    <div className="min-w-0 p-4">
                      <p className="truncate text-sm font-semibold">
                        {found?.subject.short ?? c.subject_code} · {sectionLabel(c.unit)}
                      </p>
                      <p className="mt-1 flex text-sm text-ink-2">
                        by&nbsp;<OwnerName name={c.owner_name} admin={c.owner_is_admin} />
                      </p>
                      <p className="mt-2 text-xs text-ink-3">
                        {plural(c.file_count, 'file')} · {timeAgo(c.updated_at)}
                      </p>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ---------- Why ---------- */}
        <section className="mt-28 grid items-center gap-12 md:grid-cols-2">
          <div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Built for the whole class.
            </h2>
            <p className="mt-5 leading-relaxed text-ink-2">
              Two people write notes, sixty people need them. Snap your notebook after class and it lands in the right
              chapter under your name. Photos become one clean PDF, and nothing ever gets wiped when the site updates.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['No sign-in to read', 'Photos → one PDF', 'Multi-page camera', 'Comments on every file', 'Kept permanently'].map((t) => (
                <span key={t} className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 text-xs text-ink-2">
                  {t}
                </span>
              ))}
            </div>
          </div>
          <div className="relative mx-auto grid aspect-square w-full max-w-sm place-items-center" aria-hidden="true">
            {[100, 72, 44].map((size, i) => (
              <span
                key={size}
                className="absolute rounded-full border border-white/[0.07]"
                style={{ width: `${size}%`, height: `${size}%`, boxShadow: i === 2 ? '0 0 60px rgba(139,92,246,0.25) inset' : undefined }}
              />
            ))}
            {[
              { icon: Camera, x: '50%', y: '0%' },
              { icon: Search, x: '100%', y: '50%' },
              { icon: MessageCircle, x: '50%', y: '100%' },
              { icon: Library, x: '0%', y: '50%' },
              { icon: ShieldCheck, x: '85%', y: '15%' },
              { icon: Sparkles, x: '15%', y: '85%' },
            ].map(({ icon: Icon, x, y }, i) => (
              <span
                key={i}
                className="float absolute grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-xl border border-white/[0.08] bg-[#111116] text-ink-2"
                style={{ left: x, top: y, animationDelay: `${i * 0.7}s` }}
              >
                <Icon className="size-4.5" strokeWidth={1.6} />
              </span>
            ))}
            <span className="relative grid size-20 place-items-center rounded-3xl border border-white/[0.1] bg-[#0f0f14] shadow-[0_0_80px_rgba(139,92,246,0.45)]">
              <svg viewBox="0 0 32 32" className="size-10">
                <path d="M10 9.5h9.5M10 16h7.5M10 22.5h9.5M10 9.5v13" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
                <circle cx="23" cy="16" r="2.4" fill="#a78bfa" />
              </svg>
            </span>
          </div>
        </section>

        {/* ---------- CTA ---------- */}
        <section className="mt-28">
          <div className="bezel">
            <div className="relative overflow-hidden rounded-[22px] border border-white/[0.06] bg-gradient-to-br from-[#121218] to-[#09090c] px-6 py-12 sm:px-12 sm:py-16">
              <div className="dots absolute inset-y-0 right-0 w-full sm:w-2/3" aria-hidden="true" />
              <div className="relative max-w-lg">
                <h2 className="font-display text-3xl leading-tight font-bold tracking-tight sm:text-4xl">Took notes today? Share them in a minute.</h2>
                <p className="mt-4 text-ink-2">Sign in, pick the chapter, snap the pages. Your classmates will thank you before the exam.</p>
              </div>
              <div className="relative mt-8 flex flex-wrap gap-3 sm:justify-end">
                <Link href="/upload" className="btn-primary inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
                  <CloudUpload className="size-4" /> Upload notes
                </Link>
                <Link href="/contributors" className="btn-ghost inline-flex h-12 items-center gap-2 rounded-xl px-5 text-sm font-semibold">
                  See contributors <ArrowRight className="size-4" />
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
