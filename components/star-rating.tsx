'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Star } from 'lucide-react'
import { refreshFile } from '@/app/upload/actions'
import { useViewer } from '@/components/file-tools'
import { supabaseBrowser } from '@/lib/supabase/browser'

/** The average on a card: one star, the number and how many people rated. Nothing when nobody has. */
export function StarBadge({ avg, count }: { avg: number | null; count: number }) {
  if (!count || avg == null) return null
  return (
    <span className="inline-flex items-center gap-0.5 font-medium text-ink-2" title={`${avg.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'rating' : 'ratings'}`}>
      <Star className="size-3.5 fill-amber-400 text-amber-400" /> {avg.toFixed(1)}
      <span className="font-normal text-ink-3">({count})</span>
    </span>
  )
}

/**
 * Five stars in the viewer. Everyone sees the average; a signed-in person can rate someone else's note
 * (tap a star to rate, tap the same star again to take the rating back). Not on your own note.
 */
export function StarRating({ fileId, ownerId, subject, unit, avg, count }: { fileId: string; ownerId: string; subject: string; unit: number; avg: number | null; count: number }) {
  const viewer = useViewer()
  const router = useRouter()
  const [mine, setMine] = useState(0)
  const [hover, setHover] = useState(0)
  const [stats, setStats] = useState({ sum: (avg ?? 0) * count, count })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!viewer) return
    let live = true
    void supabaseBrowser()
      .from('file_ratings')
      .select('stars')
      .eq('file_id', fileId)
      .eq('user_id', viewer.id)
      .maybeSingle()
      .then(({ data }) => live && setMine((data?.stars as number | undefined) ?? 0))
    return () => {
      live = false
    }
  }, [viewer, fileId])

  const own = viewer?.id === ownerId

  async function rate(stars: number) {
    if (!viewer) return router.push(`/login?next=${encodeURIComponent(`/view/u/${fileId}`)}`)
    if (own || busy) return
    setBusy(true)
    setError(null)
    const db = supabaseBrowser().from('file_ratings')
    const next = stars === mine ? 0 : stars
    const { error: err } = !next
      ? await db.delete().eq('file_id', fileId).eq('user_id', viewer.id)
      : mine
        ? await db.update({ stars: next, updated_at: new Date().toISOString() }).eq('file_id', fileId).eq('user_id', viewer.id)
        : await db.insert({ file_id: fileId, user_id: viewer.id, stars: next })
    setBusy(false)
    if (err) return setError(err.message)
    setStats((s) => ({ sum: s.sum - mine + next, count: s.count + (mine ? 0 : 1) - (next ? 0 : 1) }))
    setMine(next)
    void refreshFile(fileId, subject, unit).catch(() => undefined)
  }

  const shown = hover || mine || Math.round(stats.count ? stats.sum / stats.count : 0)
  const average = stats.count ? stats.sum / stats.count : null

  return (
    <div
      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line px-2.5"
      title={own ? 'You cannot rate your own note' : mine ? `You rated this ${mine} out of 5` : 'Rate this note'}
      onMouseLeave={() => setHover(0)}
    >
      <div role="radiogroup" aria-label="Rate this note" className="flex">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={mine === n}
            aria-label={`${n} ${n === 1 ? 'star' : 'stars'}`}
            disabled={busy || own}
            onMouseEnter={() => !own && setHover(n)}
            onClick={() => void rate(n)}
            className="grid size-6 place-items-center disabled:cursor-not-allowed"
          >
            <Star className={`size-4 ${n <= shown ? 'fill-amber-400 text-amber-400' : 'text-ink-3'}`} />
          </button>
        ))}
      </div>
      <span className="text-xs text-ink-2 tabular-nums">{average != null ? `${average.toFixed(1)} (${stats.count})` : 'Rate'}</span>
      {error && <span className="sr-only">{error}</span>}
    </div>
  )
}
