'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Clock, Lightbulb, RefreshCw, Smile } from 'lucide-react'
import { FACTS } from '@/lib/maintenance-facts'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

/**
 * The live countdown to the end time (when the admin set one), and the watcher that sends visitors
 * back to the site by themselves the moment it reopens. In preview mode it never redirects.
 */
export function MaintenanceWatch({ until, preview }: { until?: string; preview?: boolean }) {
  const [now, setNow] = useState<number | null>(null)
  const end = until ? Date.parse(until) : NaN
  const hasEnd = Number.isFinite(end)

  useEffect(() => {
    setNow(Date.now())
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  // Ask the server whether the site is open again: every 20 s, and every 4 s once the timer has run out.
  const over = now !== null && hasEnd && now >= end
  useEffect(() => {
    if (preview) return
    let stop = false
    async function check() {
      try {
        const res = await fetch('/api/maintenance', { cache: 'no-store' })
        const s = (await res.json()) as { on?: boolean; phase?: string }
        if (!stop && s.on === false && s.phase !== 'scheduled') location.replace('/')
      } catch {
        /* offline for a moment: try again next time */
      }
    }
    const id = setInterval(check, over ? 4000 : 20000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [over, preview])

  if (!hasEnd) return null
  const ms = now === null ? null : Math.max(0, end - now)
  const s = ms === null ? 0 : Math.floor(ms / 1000)
  const around = new Date(end).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const sameDay = new Date(end).toDateString() === new Date().toDateString()
  const day = sameDay ? '' : `${new Date(end).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, `
  return (
    <>
      <p>
        <Clock className="size-4" />
        {over ? (
          'Reopening any moment…'
        ) : (
          <>
            Back in{' '}
            <span className="tabular-nums">
              {ms === null ? '--:--:--' : `${Math.floor(s / 86400) ? `${Math.floor(s / 86400)}d ` : ''}${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}
            </span>
          </>
        )}
      </p>
      {now !== null && (
        <p>
          Expected around {day}
          {around}
        </p>
      )}
    </>
  )
}

function shuffled<T>(list: T[]) {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
  }
  return a
}

/** A fun fact or joke that changes every 10 to 20 seconds. Pauses while the tab is hidden. */
export function MaintenanceFacts() {
  const order = useMemo(() => shuffled(FACTS), [])
  const [i, setI] = useState(0)
  const [wait, setWait] = useState(15)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function schedule() {
    if (timer.current) clearTimeout(timer.current)
    const seconds = 10 + Math.floor(Math.random() * 11) // 10 to 20
    setWait(seconds)
    timer.current = setTimeout(() => {
      if (document.hidden) return schedule()
      setI((n) => (n + 1) % order.length)
      schedule()
    }, seconds * 1000)
  }

  useEffect(() => {
    schedule()
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
    // schedule only reads refs and the stable order list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const f = order[i]!
  const joke = f.kind === 'joke'
  return (
    <section className="mt-facts" aria-label="Fun fact">
      <div className="mt-facts-head">
        <span className={joke ? 'mt-tag mt-tag-joke' : 'mt-tag'}>
          {joke ? <Smile className="size-3.5" /> : <Lightbulb className="size-3.5" />} {joke ? 'Joke' : 'Fun fact'} · {f.subject}
        </span>
        <button
          type="button"
          onClick={() => {
            setI((n) => (n + 1) % order.length)
            schedule()
          }}
          className="mt-next"
          aria-label="Show another"
        >
          <RefreshCw className="size-3.5" /> Another
        </button>
      </div>
      <p key={i} className="mt-fact-text">
        {f.text}
      </p>
      <div className="mt-fact-bar" aria-hidden="true">
        <span key={`${i}-${wait}`} style={{ animationDuration: `${wait}s` }} />
      </div>
    </section>
  )
}
