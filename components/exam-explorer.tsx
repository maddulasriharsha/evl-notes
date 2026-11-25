'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowUpRight, CalendarClock, ChevronDown, Clock, Info, LayoutGrid, ListChecks } from 'lucide-react'
import Link from '@/components/link'
import { Select } from '@/components/select'
import {
  KINDS,
  KIND_LABEL,
  YEARS,
  YEAR_LABEL,
  dayParts,
  daysUntil,
  todayIST,
  whenLabel,
  type ExamKind,
  type Year,
} from '@/lib/exam-dates'

export interface PaperView {
  code: string
  name: string
  /** The subject's page on the site, when it has one. */
  href: string | null
  /** An "Open Elective" placeholder that opens the elective list. */
  oe?: boolean
}
export interface ExamView {
  year: Year
  kind: ExamKind
  title: string
  regulation: string
  days: { date: string; time: string }[]
  branches: { id: string; short: string }[]
  rows: Record<string, PaperView[][]>
  notes: string[]
  electives?: { label: string; papers: string[] }
}

const chip =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-3.5 text-sm font-medium whitespace-nowrap transition active:scale-[0.97]'
const chipOff = 'border-line bg-surface/60 text-ink-2 hover:border-line-strong hover:text-ink'
const chipOn = 'border-accent bg-accent-soft text-accent shadow-[0_0_0_3px_rgb(139_92_246/0.12)]'

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function Paper({ p, compact }: { p: PaperView; compact?: boolean }) {
  const text = (
    <>
      <span className={`block leading-snug ${compact ? 'text-[13px]' : 'text-[15px]'} font-medium`}>{p.name}</span>
      {p.oe ? null : <span className="mt-0.5 block text-[11px] tracking-wide text-ink-3">{p.code}</span>}
    </>
  )
  if (p.href) {
    return (
      <Link
        href={p.href}
        className="group/p flex items-start justify-between gap-2 rounded-lg px-2 py-1.5 transition hover:bg-accent-soft"
        aria-label={`${p.name}, open the notes`}
      >
        <span className="min-w-0">{text}</span>
        <ArrowUpRight className="mt-0.5 size-4 shrink-0 text-ink-3 transition group-hover/p:translate-x-0.5 group-hover/p:-translate-y-0.5 group-hover/p:text-accent" />
      </Link>
    )
  }
  return <div className="px-2 py-1.5">{text}</div>
}

export function ExamExplorer({ exams }: { exams: ExamView[] }) {
  const [year, setYear] = useState<Year>(1)
  const [kind, setKind] = useState<ExamKind>('sem')
  const [branch, setBranch] = useState<string>('')
  const [view, setView] = useState<'mine' | 'all'>('mine')
  const [today, setToday] = useState<string | null>(null)
  const [showOE, setShowOE] = useState(false)

  const find = (y: Year, k: ExamKind) => exams.find((e) => e.year === y && e.kind === k)

  // First visit: the reader's own year (from their saved semester), then the shared link if any.
  useEffect(() => {
    const t = todayIST()
    setToday(t)
    const q = new URLSearchParams(location.search)
    const sem = Number(read('vj-sem'))
    let y = (Number(q.get('y')) || (sem ? Math.ceil(sem / 2) : 1)) as Year
    if (!YEARS.includes(y)) y = 1
    // Pick the exam that is next up (or the latest one) for that year.
    const mine = exams.filter((e) => e.year === y)
    const upcoming = mine.filter((e) => daysUntil(e.days.at(-1)?.date ?? '', t) >= 0).sort((a, b) => (a.days[0]?.date ?? '').localeCompare(b.days[0]?.date ?? ''))
    const k = (KINDS.includes(q.get('k') as ExamKind) ? q.get('k') : (upcoming[0] ?? mine[mine.length - 1])?.kind ?? 'sem') as ExamKind
    setYear(y)
    setKind(k)
    setBranch(q.get('b') || read('vj-branch') || '')
  }, [exams])

  const exam = find(year, kind)
  const activeBranch = exam ? (exam.branches.some((b) => b.id === branch) ? branch : (exam.branches[0]?.id ?? '')) : ''

  // Keep the address shareable.
  useEffect(() => {
    if (!today) return
    const q = new URLSearchParams({ y: String(year), k: kind })
    if (activeBranch) q.set('b', activeBranch)
    history.replaceState(null, '', `?${q}`)
  }, [year, kind, activeBranch, today])

  const next = useMemo(() => {
    if (!exam || !activeBranch || !today) return null
    const row = exam.rows[activeBranch] ?? []
    for (let i = 0; i < exam.days.length; i++) {
      const day = exam.days[i]
      const papers = row[i]
      if (!day || !papers?.length) continue
      const n = daysUntil(day.date, today)
      if (n >= 0) return { n, day, papers }
    }
    return null
  }, [exam, activeBranch, today])

  return (
    <div className="mt-8">
      {/* Year */}
      <div role="tablist" aria-label="Year" className="flex gap-2 overflow-x-auto pb-1">
        {YEARS.map((y) => (
          <button
            key={y}
            role="tab"
            aria-selected={y === year}
            onClick={() => {
              setYear(y)
              const mine = exams.filter((e) => e.year === y)
              if (!mine.some((e) => e.kind === kind) && mine[0]) setKind(mine[0].kind)
            }}
            className={`${chip} ${y === year ? chipOn : chipOff}`}
          >
            {YEAR_LABEL[y]}
          </button>
        ))}
      </div>

      {/* Exam type */}
      <div role="tablist" aria-label="Examination" className="mt-3 grid grid-cols-3 gap-2 sm:flex">
        {KINDS.map((k) => {
          const has = Boolean(find(year, k))
          return (
            <button
              key={k}
              role="tab"
              aria-selected={k === kind}
              onClick={() => setKind(k)}
              className={`${chip} ${k === kind ? chipOn : chipOff}`}
            >
              {KIND_LABEL[k]}
              <span className={`size-1.5 rounded-full ${has ? 'bg-ok' : 'bg-line-strong'}`} aria-label={has ? 'published' : 'not published yet'} />
            </button>
          )
        })}
      </div>

      {!exam ? (
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-surface/40 p-10 text-center">
          <CalendarClock className="mx-auto size-9 text-ink-3" />
          <p className="mt-3 font-display text-lg font-semibold">
            {YEAR_LABEL[year]} · {KIND_LABEL[kind]} is not published yet
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">
            It will appear here as soon as the Controller of Examinations releases the timetable. Green dots above mark the ones that are already out.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{exam.title}</h2>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                <span className="rounded-md bg-accent-soft px-1.5 py-0.5 text-xs font-semibold text-accent">{exam.regulation}</span>
                <span>
                  {span(exam.days)}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock className="size-3.5" /> {exam.days[0]?.time}
                </span>
              </p>
            </div>
            <div className="inline-flex rounded-xl border border-line bg-surface/60 p-1" role="group" aria-label="View: list for one branch, or grid of all branches">
              <button
                onClick={() => setView('mine')}
                aria-pressed={view === 'mine'}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${view === 'mine' ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                <ListChecks className="size-4" /> List
              </button>
              <button
                onClick={() => setView('all')}
                aria-pressed={view === 'all'}
                className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${view === 'all' ? 'bg-accent text-accent-ink' : 'text-ink-2 hover:text-ink'}`}
              >
                <LayoutGrid className="size-4" /> Grid
              </button>
            </div>
          </div>

          {view === 'mine' ? (
            <>
              <label className="mt-5 flex items-center gap-3 text-sm text-ink-2">
                Branch
                <Select
                  value={activeBranch}
                  label="Branch"
                  className="w-44"
                  options={exam.branches.map((b) => ({ value: b.id, label: b.short }))}
                  onChange={(v) => {
                    setBranch(v)
                    try {
                      localStorage.setItem('vj-branch', v)
                    } catch {
                      /* no storage */
                    }
                  }}
                />
              </label>

              {next && (
                <div className="mt-5 rounded-2xl border border-accent/40 bg-gradient-to-br from-accent-soft to-transparent p-4 sm:p-5">
                  <p className="text-xs font-semibold tracking-widest text-accent uppercase">
                    Next paper · {whenLabel(next.n)}
                  </p>
                  <p className="mt-1 font-display text-lg font-semibold">{next.papers.map((p) => p.name).join(' · ')}</p>
                  <p className="text-sm text-ink-2">
                    {dayParts(next.day.date).weekday}, {dayParts(next.day.date).day} {dayParts(next.day.date).month} · {next.day.time}
                  </p>
                </div>
              )}

              <ol className="mt-5 space-y-3">
                {exam.days.map((d, i) => {
                  const papers = exam.rows[activeBranch]?.[i] ?? []
                  const p = dayParts(d.date)
                  const n = today ? daysUntil(d.date, today) : null
                  const past = n !== null && n < 0
                  return (
                    <li
                      key={d.date}
                      className={`flex gap-4 rounded-2xl border p-3 transition sm:p-4 ${
                        n === 0 ? 'border-accent bg-accent-soft/60' : 'border-line bg-surface/60'
                      } ${past ? 'opacity-60' : ''}`}
                    >
                      <div className={`grid w-16 shrink-0 place-items-center rounded-xl border py-2 text-center ${n === 0 ? 'border-accent text-accent' : 'border-line text-ink'}`}>
                        <span className="text-[11px] font-semibold tracking-widest text-ink-3 uppercase">{p.month}</span>
                        <span className="font-display text-2xl leading-none font-bold">{p.day}</span>
                        <span className="text-[11px] text-ink-2">{p.weekday}</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-3">
                          <Clock className="size-3.5" /> {d.time}
                          {n !== null && !past && (
                            <span className="rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">{whenLabel(n)}</span>
                          )}
                          {past && <span className="rounded-full bg-surface-2 px-2 py-0.5 font-medium">Done</span>}
                        </div>
                        {papers.length === 0 ? (
                          <p className="mt-1 px-2 py-1.5 text-sm text-ink-3">No paper for your branch</p>
                        ) : (
                          <div className="mt-1 space-y-0.5">
                            {papers.map((pp) =>
                              pp.oe ? (
                                <button
                                  key={pp.code}
                                  onClick={() => setShowOE((v) => !v)}
                                  aria-expanded={showOE}
                                  className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-accent-soft"
                                >
                                  <Paper p={pp} />
                                  <ChevronDown className={`size-4 shrink-0 text-ink-3 transition ${showOE ? 'rotate-180' : ''}`} />
                                </button>
                              ) : (
                                <Paper key={pp.code} p={pp} />
                              ),
                            )}
                            {papers.some((pp) => pp.oe) && showOE && exam.electives && <Electives data={exam.electives} />}
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ol>
            </>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-line bg-surface/60">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="bg-surface-2/70">
                    <th className="sticky left-0 z-10 border border-line bg-surface-2 px-3 py-3 text-xs font-semibold tracking-widest text-ink-2 uppercase">Branch</th>
                    {exam.days.map((d) => {
                      const p = dayParts(d.date)
                      const n = today ? daysUntil(d.date, today) : null
                      return (
                        <th key={d.date} className={`border border-line px-2 py-2.5 text-center text-xs font-medium ${n === 0 ? 'bg-accent-soft text-accent' : 'text-ink-2'}`}>
                          <span className="block font-display text-base font-semibold text-ink">
                            {p.day} {p.month}
                          </span>
                          {p.weekday}
                          <span className="mt-0.5 block text-[10px] font-normal text-ink-3">{d.time}</span>
                          {n !== null && n >= 0 && n <= 3 && <span className="block text-accent">{whenLabel(n)}</span>}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {exam.branches.map((b) => (
                    <tr key={b.id} className={`align-top ${b.id === activeBranch ? 'bg-accent-soft/40' : ''}`}>
                      <th className="sticky left-0 z-10 border border-line bg-surface px-3 py-2 text-sm font-bold whitespace-nowrap">
                        <button onClick={() => { setBranch(b.id); setView('mine') }} className="hover:text-accent" title="Show only this branch">
                          {b.short}
                        </button>
                      </th>
                      {exam.days.map((d, i) => {
                        const papers = exam.rows[b.id]?.[i] ?? []
                        return (
                          <td key={d.date} className="min-w-[150px] border border-line px-0.5 py-1">
                            {papers.length === 0 ? (
                              <span className="block px-2 text-center text-ink-3">—</span>
                            ) : (
                              papers.map((pp) => (pp.oe ? <Paper key={pp.code} p={pp} compact /> : <Paper key={pp.code} p={pp} compact />))
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {view === 'all' && exam.electives && (
            <div className="mt-4">
              <button
                onClick={() => setShowOE((v) => !v)}
                aria-expanded={showOE}
                className="inline-flex items-center gap-2 text-sm font-medium text-accent"
              >
                <ChevronDown className={`size-4 transition ${showOE ? 'rotate-180' : ''}`} />
                {exam.electives.label} · see the papers
              </button>
              {showOE && <Electives data={exam.electives} />}
            </div>
          )}

          {exam.notes.length > 0 && (
            <ul className="mt-5 space-y-2 text-sm text-ink-2">
              {exam.notes.map((n) => (
                <li key={n} className="flex gap-2">
                  <Info className="mt-0.5 size-4 shrink-0 text-gold" /> {n}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <p className="mt-8 text-xs leading-relaxed text-ink-3">
        Typed in from the Controller of Examinations&apos; notices. Omissions or clashes should be reported to the examination branch, and exams go ahead on the
        scheduled date even if a holiday is declared. Always confirm with the official notice.
      </p>
    </div>
  )
}

function Electives({ data }: { data: { label: string; papers: string[] } }) {
  return (
    <div className="mt-2 rounded-xl border border-line bg-surface-2/60 p-3">
      <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">{data.label}</p>
      <ul className="mt-2 grid gap-x-6 gap-y-1 text-[13px] text-ink-2 sm:grid-cols-2">
        {data.papers.map((p) => (
          <li key={p}>{p}</li>
        ))}
      </ul>
    </div>
  )
}

function span(days: { date: string }[]) {
  const a = days[0]
  const b = days.at(-1)
  if (!a || !b) return ''
  const x = dayParts(a.date)
  const y = dayParts(b.date)
  return `${x.day} ${x.month} – ${y.day} ${y.month} ${y.year}`
}
