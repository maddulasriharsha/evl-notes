'use client'

import { useEffect, useState } from 'react'
import { Flame } from 'lucide-react'
import { plural } from '@/lib/format'
import { checkIn, streakBoard, streakOptedOut, type StreakBoardData, type StreakMe } from '@/lib/streak'

/** The study streak ranking, with your own made-up name and place on top. */
export function StreakBoard() {
  const [me, setMe] = useState<StreakMe | null>(null)
  const [board, setBoard] = useState<StreakBoardData | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [optedOut, setOptedOut] = useState(false)

  useEffect(() => {
    let live = true
    setOptedOut(streakOptedOut())
    void (async () => {
      const mine = await checkIn()
      try {
        const data = await streakBoard()
        if (!live) return
        setMe(mine)
        setBoard(data)
        setState('ready')
      } catch {
        if (live) setState('error')
      }
    })()
    return () => {
      live = false
    }
  }, [])

  if (state === 'loading') return <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-ink-3">Loading the streaks…</p>
  if (state === 'error' || !board) {
    return <p className="rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-ink-3">The streak board is not available right now. Try again in a little while.</p>
  }

  return (
    <>
      {me ? (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold/40 bg-gold-soft px-5 py-4">
          <Flame className="size-8 shrink-0 text-gold" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-ink-3">{me.account ? 'Your streak' : 'On this browser you are'}</p>
            <p className="font-display text-xl font-semibold tracking-tight">{me.name}</p>
            <p className="mt-0.5 text-sm text-ink-2">
              {!me.today
                ? 'Read notes for 5 minutes to count today.'
                : board.my_place
                  ? `Today is counted. Place ${board.my_place} of ${board.total}.`
                  : 'Today is counted. Do it again tomorrow to join the board.'}
            </p>
          </div>
          <div className="text-right">
            <p className="font-display text-2xl font-bold text-gold tabular-nums">{plural(me.streak, 'day')}</p>
            <p className="text-xs text-ink-3">best: {me.best}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-2xl border border-line bg-surface px-5 py-4 text-sm text-ink-3">
          {optedOut
            ? 'Your browser sends “Do Not Track”, so no streak is kept for you.'
            : 'Your streak could not be counted just now. It needs the browser’s storage, which private windows may block.'}
        </p>
      )}

      {board.players.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-line bg-surface px-5 py-8 text-center text-sm text-ink-3">
          No running streaks yet. Read notes two days in a row to be the first name here.
        </p>
      ) : (
        <ol className="mt-4 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          {board.players.map((p) => (
            <li key={p.place} className={`flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 ${p.me ? 'bg-accent-soft' : ''}`}>
              <span className={`w-6 text-right font-display text-lg font-semibold tabular-nums ${p.place <= 3 ? 'text-gold' : 'text-ink-3'}`}>{p.place}</span>
              <span className="grid size-10 place-items-center rounded-full bg-accent-soft font-semibold text-accent">{p.name.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {p.name}
                  {p.me && <span className="ml-2 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-semibold text-accent-ink">You</span>}
                </p>
                <p className="text-xs text-ink-3">
                  best {plural(p.best, 'day')} · {plural(p.days, 'day')} studied
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums">
                <Flame className="size-3.5 text-gold" /> {p.streak}
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-4 text-xs leading-relaxed text-ink-3">
        A day counts after 5 minutes of reading notes; the time adds up across notes. No sign-in needed. Signed in, you appear under your own name and your streak follows you to
        any device. Signed out, you get a random name and the streak stays in this browser. Days change at midnight India time{board.total > 50 ? ', and the top 50 are shown' : ''}.
      </p>
    </>
  )
}
