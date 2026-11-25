'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarClock, Eye, Loader2, Lock, Plus, ShieldAlert, Timer, Wrench, X } from 'lucide-react'
import { setMaintenance } from '@/app/admin/maintenance-actions'
import type { Phase } from '@/lib/maintenance'

interface Initial {
  phase: Phase
  armed: boolean
  message?: string
  back?: string
  since?: string
  starts?: string
  until?: string
}

const DURATIONS = [
  { min: 15, label: '15 min' },
  { min: 30, label: '30 min' },
  { min: 60, label: '1 hour' },
  { min: 120, label: '2 hours' },
  { min: 240, label: '4 hours' },
  { min: 480, label: '8 hours' },
  { min: 1440, label: '1 day' },
]

const chip = 'inline-flex h-9 items-center rounded-lg border px-3 text-sm font-medium transition'
const on = 'border-accent bg-accent-soft text-accent'
const off = 'border-line text-ink-2 hover:text-ink'
const field = 'h-11 rounded-xl border border-line bg-bg px-3 text-sm outline-none focus:border-accent'

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

function left(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const pad = (n: number) => String(n).padStart(2, '0')
  const d = Math.floor(s / 86400)
  return `${d ? `${d}d ` : ''}${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/** A value for <input type="datetime-local">, in the browser's own time zone. */
function localValue(ms: number) {
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000)
  return d.toISOString().slice(0, 16)
}

/** Admin tab: lock the site for everyone but admins, now or on a schedule, with an automatic end. */
export function MaintenancePanel({ initial, ready }: { initial: Initial; ready: boolean }) {
  const router = useRouter()
  const [message, setMessage] = useState(initial.message ?? '')
  const [back, setBack] = useState(initial.back ?? '')
  const [startMode, setStartMode] = useState<'now' | 'later'>('now')
  const [startAt, setStartAt] = useState('')
  const [endMode, setEndMode] = useState<'manual' | 'duration' | 'at'>('duration')
  const [minutes, setMinutes] = useState(60)
  const [custom, setCustom] = useState('')
  const [endAt, setEndAt] = useState('')
  const [password, setPassword] = useState('')
  const [armed, setArmed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  // The page re-reads the state itself when a scheduled time passes.
  useEffect(() => {
    if (now === null) return
    const next = [initial.starts, initial.until].map((x) => (x ? Date.parse(x) : NaN)).filter((t) => Number.isFinite(t) && t > now - 2000 && t < now + 1500)
    if (next.length) router.refresh()
  }, [now, initial.starts, initial.until, router])

  const phase = initial.phase
  const minutesUsed = custom ? Math.max(1, Math.round(Number(custom) || 0)) : minutes

  /** The exact times this form would send. */
  function times() {
    const base = startMode === 'later' && startAt ? new Date(startAt).getTime() : Date.now()
    let end: number | null = null
    if (endMode === 'duration') end = base + minutesUsed * 60_000
    if (endMode === 'at' && endAt) end = new Date(endAt).getTime()
    return { starts: startMode === 'later' && startAt ? base : null, ends: end }
  }

  function run(payload: Parameters<typeof setMaintenance>[0]) {
    setError(null)
    start(async () => {
      const res = await setMaintenance(payload)
      if (!res.ok) return setError(res.error)
      setPassword('')
      setArmed(false)
      router.refresh()
    })
  }

  function arm() {
    const t = times()
    if (startMode === 'later' && !startAt) return setError('Pick the start date and time.')
    if (endMode === 'at' && !endAt) return setError('Pick the end date and time.')
    run({
      on: true,
      message,
      back,
      password,
      startsAt: t.starts ? new Date(t.starts).toISOString() : null,
      endsAt: t.ends ? new Date(t.ends).toISOString() : null,
    })
  }

  const t = times()
  const summary =
    startMode === 'later' && startAt
      ? `Locks ${fmt(new Date(startAt).toISOString())}`
      : 'Locks the moment you confirm'
  const tail = t.ends ? `, opens again by itself ${fmt(new Date(t.ends).toISOString())}` : ', stays locked until you switch it off'

  const live = phase === 'live'
  const scheduled = phase === 'scheduled'
  const ended = phase === 'ended'

  return (
    <div className="max-w-2xl space-y-5">
      {/* Status */}
      <div className={`rounded-2xl border p-5 shadow-card ${live ? 'border-danger bg-danger-soft/40' : scheduled ? 'border-gold/60 bg-gold-soft' : 'border-line bg-surface'}`}>
        <div className="flex items-start gap-3">
          <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${live ? 'bg-danger text-white' : scheduled ? 'bg-gold text-white' : 'bg-accent-soft text-accent'}`}>
            {scheduled ? <CalendarClock className="size-5" /> : <Wrench className={`size-5 ${live ? 'animate-pulse' : ''}`} />}
          </span>
          <div className="min-w-0">
            <h2 className="font-semibold">
              {live ? 'Maintenance is LIVE' : scheduled ? 'Maintenance is scheduled' : ended ? 'Maintenance has ended' : 'Maintenance mode is off'}
            </h2>
            <p className="text-sm text-ink-2">
              {live &&
                (initial.until
                  ? `Visitors only see the maintenance page. It opens by itself ${fmt(initial.until)}${now ? ` (in ${left(Date.parse(initial.until) - now)})` : ''}.`
                  : 'Visitors only see the maintenance page. It stays locked until you switch it off.')}
              {scheduled &&
                initial.starts &&
                `Locks ${fmt(initial.starts)}${now ? ` (in ${left(Date.parse(initial.starts) - now)})` : ''}${initial.until ? ` and opens again ${fmt(initial.until)}` : ''}. Until then the site is open.`}
              {ended && 'It reached its end time and the site reopened by itself. Clear it below, or set a new one.'}
              {phase === 'off' && 'The site is open to everyone.'}
              {(live || scheduled) && ' You keep full access as an admin.'}
            </p>
          </div>
        </div>

        {(live || scheduled || ended) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {live && initial.until &&
              [30, 60].map((m) => (
                <button key={m} onClick={() => run({ on: true, message, back, extendMinutes: m })} disabled={pending} className={`${chip} ${off} gap-1`}>
                  <Plus className="size-3.5" /> {m === 60 ? '1 hour' : `${m} min`}
                </button>
              ))}
            <button
              onClick={() => run({ on: false, message, back })}
              disabled={pending}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-ok px-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
            >
              {pending ? <Loader2 className="size-4 animate-spin" /> : <X className="size-4" />} {live ? 'Switch off now' : scheduled ? 'Cancel the schedule' : 'Clear'}
            </button>
          </div>
        )}
      </div>

      {!ready && (
        <p className="rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-2">
          Run <code className="rounded bg-bg px-1">run-this-maintenance-schedule.sql</code> in the Supabase SQL editor once, then reload this page.
        </p>
      )}

      {/* Settings, shown while nothing is armed */}
      {(phase === 'off' || ended) && (
        <div className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-card">
          <div>
            <label className="block text-sm font-medium" htmlFor="mt-msg">
              What visitors will read
            </label>
            <textarea
              id="mt-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 300))}
              rows={3}
              placeholder="We are upgrading VJNOTES. Your notes are safe and we will be right back."
              className="mt-1.5 w-full resize-none rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <label className="mt-3 block text-sm font-medium" htmlFor="mt-back">
              A note about the time <span className="font-normal text-ink-3">(optional; with a timer below, visitors also see a live countdown)</span>
            </label>
            <input id="mt-back" value={back} onChange={(e) => setBack(e.target.value.slice(0, 80))} placeholder="e.g. around 6 PM today" className={`mt-1.5 w-full ${field}`} />
          </div>

          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-medium">
              <CalendarClock className="size-4 text-accent" /> When does it start?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setStartMode('now')} className={`${chip} ${startMode === 'now' ? on : off}`}>
                Right now
              </button>
              <button
                type="button"
                onClick={() => {
                  setStartMode('later')
                  if (!startAt) setStartAt(localValue(Date.now() + 3600_000))
                }}
                className={`${chip} ${startMode === 'later' ? on : off}`}
              >
                Schedule for later
              </button>
            </div>
            {startMode === 'later' && <input type="datetime-local" value={startAt} min={localValue(Date.now())} onChange={(e) => setStartAt(e.target.value)} className={`mt-2 ${field}`} aria-label="Start date and time" />}
          </fieldset>

          <fieldset>
            <legend className="flex items-center gap-2 text-sm font-medium">
              <Timer className="size-4 text-accent" /> When does it end?
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => setEndMode('duration')} className={`${chip} ${endMode === 'duration' ? on : off}`}>
                After a set time
              </button>
              <button
                type="button"
                onClick={() => {
                  setEndMode('at')
                  if (!endAt) setEndAt(localValue((startMode === 'later' && startAt ? new Date(startAt).getTime() : Date.now()) + 2 * 3600_000))
                }}
                className={`${chip} ${endMode === 'at' ? on : off}`}
              >
                At a date and time
              </button>
              <button type="button" onClick={() => setEndMode('manual')} className={`${chip} ${endMode === 'manual' ? on : off}`}>
                I&apos;ll switch it off
              </button>
            </div>
            {endMode === 'duration' && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.min}
                    type="button"
                    onClick={() => {
                      setMinutes(d.min)
                      setCustom('')
                    }}
                    className={`${chip} ${!custom && minutes === d.min ? on : off}`}
                  >
                    {d.label}
                  </button>
                ))}
                <span className="flex items-center gap-1.5 text-sm text-ink-2">
                  or
                  <input
                    inputMode="numeric"
                    value={custom}
                    onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 5))}
                    placeholder="45"
                    aria-label="Custom minutes"
                    className="h-9 w-16 rounded-lg border border-line bg-bg px-2 text-center text-sm outline-none focus:border-accent"
                  />
                  minutes
                </span>
              </div>
            )}
            {endMode === 'at' && <input type="datetime-local" value={endAt} min={localValue(Date.now())} onChange={(e) => setEndAt(e.target.value)} className={`mt-2 ${field}`} aria-label="End date and time" />}
            <p className="mt-2 text-xs text-ink-3">The site reopens by itself at the end time, even if you forget, and visitors on the maintenance page are sent back automatically.</p>
          </fieldset>

          <p className="rounded-xl bg-surface-2 px-3 py-2 text-sm text-ink-2">
            {summary}
            {tail}.
          </p>

          {armed && (
            <div className="rounded-xl border border-gold/50 bg-gold-soft p-4">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <ShieldAlert className="size-4 text-gold" /> Confirm with your password
              </p>
              <p className="mt-1 text-xs text-ink-2">Everyone except admins will be locked out of the whole site {startMode === 'later' ? 'from the start time' : 'right away'}.</p>
              <div className="relative mt-3">
                <Lock className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3" />
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && password && !pending && arm()}
                  placeholder="Your admin password"
                  aria-label="Your password"
                  autoFocus
                  className="h-11 w-full rounded-xl border border-line bg-bg pr-3 pl-9 text-sm outline-none focus:border-accent"
                />
              </div>
            </div>
          )}

          {error && <p className="text-sm text-danger">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            {armed ? (
              <>
                <button
                  onClick={arm}
                  disabled={pending || !password}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-danger px-4 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                >
                  {pending && <Loader2 className="size-4 animate-spin" />} {startMode === 'later' ? 'Confirm and schedule' : 'Confirm and lock the site'}
                </button>
                <button
                  onClick={() => {
                    setArmed(false)
                    setPassword('')
                    setError(null)
                  }}
                  className="h-11 rounded-xl px-3 text-sm text-ink-2 hover:text-ink"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setArmed(true)}
                disabled={!ready}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-semibold text-bg hover:opacity-90 disabled:opacity-40"
              >
                <Wrench className="size-4" /> {startMode === 'later' ? 'Schedule maintenance…' : 'Turn on maintenance mode…'}
              </button>
            )}
            <a href="/maintenance?preview=1" target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-xl border border-line px-3 text-sm text-ink-2 hover:text-ink">
              <Eye className="size-4" /> Preview the page
            </a>
          </div>
        </div>
      )}

      {(live || scheduled) && error && <p className="text-sm text-danger">{error}</p>}
      {(live || scheduled) && (
        <a href="/maintenance?preview=1" target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 text-sm text-ink-2 hover:text-ink">
          <Eye className="size-4" /> Preview the page
        </a>
      )}
      <p className="text-xs text-ink-3">
        Takes effect within a few seconds. Sign-in, this admin area, health checks and the daily backup keep working. Admins browse the site normally; everyone else,
        including moderators, only sees the maintenance page. Times use your own device&apos;s time zone.
      </p>
    </div>
  )
}
