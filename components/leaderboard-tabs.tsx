'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Flame, Upload } from 'lucide-react'
import { StreakBoard } from '@/components/streak-board'

type Tab = 'contributions' | 'streak'

const TABS = [
  ['contributions', 'Contributions', Upload],
  ['streak', 'Study streak', Flame],
] as const

/** Contributions first; the study streak beside it, also reachable at /leaderboard?tab=streak. */
export function LeaderboardTabs({ children }: { children: React.ReactNode }) {
  const asked: Tab = useSearchParams().get('tab') === 'streak' ? 'streak' : 'contributions'
  const [tab, setTab] = useState<Tab>(asked)
  useEffect(() => setTab(asked), [asked])

  function pick(next: Tab) {
    setTab(next)
    window.history.replaceState(null, '', next === 'streak' ? '/leaderboard?tab=streak' : '/leaderboard')
  }

  return (
    <>
      <div role="tablist" aria-label="Leaderboard" className="grid max-w-sm grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm font-medium">
        {TABS.map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls="leaderboard-panel"
            onClick={() => pick(id)}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg ${tab === id ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'}`}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id="leaderboard-panel" aria-labelledby={`tab-${tab}`} className="mt-6">
        {tab === 'streak' ? <StreakBoard /> : children}
      </div>
    </>
  )
}
