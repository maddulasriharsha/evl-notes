'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Flame, X } from 'lucide-react'
import { checkIn, READ_SECONDS, readingTime, saveReadingTime, startReading, streakOptedOut, type StreakMe } from '@/lib/streak'

/** Gets this visitor's streak name on whichever page a visit starts, and times reading on note pages. */
export function StreakCheckIn() {
  const pathname = usePathname()
  useEffect(() => {
    const go = () => {
      if (document.visibilityState === 'visible') void checkIn()
    }
    go()
    document.addEventListener('visibilitychange', go)
    return () => document.removeEventListener('visibilitychange', go)
  }, [pathname])
  return pathname.startsWith('/view/') ? <ReadingTimer /> : null
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

/**
 * Counts the seconds a note is on screen (not while the tab is in the background). The total adds up
 * over the day, across notes. At five minutes the server counts the day.
 */
function ReadingTimer() {
  const [left, setLeft] = useState<number | null>(null)
  const [counted, setCounted] = useState<StreakMe | null>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (streakOptedOut()) return
    let live = true
    let timer = 0
    let toast = 0
    void checkIn().then((me) => {
      if (!live || !me || me.today) return
      let last = Date.now()
      let busy = false
      /** Not before this time: spaces out retries when the server is not ready to count yet. */
      let wait = 0
      timer = window.setInterval(async () => {
        const now = Date.now()
        // A sleeping laptop or a frozen tab must not add its time in one go.
        const gap = Math.min(2000, now - last)
        last = now
        if (document.visibilityState !== 'visible') return
        const r = readingTime()
        r.seconds = Math.min(READ_SECONDS, r.seconds + Math.round(gap / 1000))
        saveReadingTime(r)
        setLeft(READ_SECONDS - r.seconds)
        if (busy || now < wait) return
        if (!r.started) {
          busy = true
          const ok = await startReading()
          if (ok) saveReadingTime({ ...readingTime(), started: true })
          else wait = Date.now() + 30_000
          busy = false
        } else if (r.seconds >= READ_SECONDS) {
          busy = true
          const after = await checkIn(true)
          if (live && after?.today) {
            window.clearInterval(timer)
            setCounted(after)
            setHidden(false)
            toast = window.setTimeout(() => setHidden(true), 8000)
          }
          wait = Date.now() + 30_000
          busy = false
        }
      }, 1000)
    })
    return () => {
      live = false
      window.clearInterval(timer)
      window.clearTimeout(toast)
    }
  }, [])

  if (hidden || (!counted && left === null)) return null
  return (
    // Not marked data-chrome: an open note hides those, and this is where the timer belongs.
    <div
      data-streak-timer
      className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-30 flex items-center gap-2 rounded-full border border-gold/40 bg-surface/95 py-1.5 pr-1.5 pl-3 text-xs font-medium text-ink-2 shadow-pop backdrop-blur-xl sm:bottom-4 print:hidden"
    >
      <Flame className="size-3.5 text-gold" />
      <span role={counted ? 'status' : undefined} className="tabular-nums">
        {counted ? `Streak counted: ${counted.streak} ${counted.streak === 1 ? 'day' : 'days'}` : left! > 0 ? `${clock(left!)} to count today` : 'Counting today…'}
      </span>
      <button type="button" onClick={() => setHidden(true)} aria-label="Hide the streak timer" className="grid size-6 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
        <X className="size-3.5" />
      </button>
    </div>
  )
}
