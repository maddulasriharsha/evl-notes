import { Clock, Hourglass, MousePointerClick } from 'lucide-react'
import { DownFor, Maintenance3D } from '@/components/maintenance-3d'

/**
 * What everyone but admins sees while maintenance mode is on: a galaxy of notes (tilts with your cursor, hover the pages, click for a shockwave), a boot log that types itself out, and a live "down for" timer.
 */

const LOG: { tag: 'ok' | 'wait'; text: string }[] = [
  { tag: 'ok', text: 'every note safe in the galaxy' },
  { tag: 'ok', text: 'question papers catalogued' },
  { tag: 'wait', text: 'reindexing the stars' },
  { tag: 'wait', text: 'bringing the site back' },
]

export function MaintenanceScene({ message, back, since }: { message?: string; back?: string; since?: string }) {
  return (
    <div className="mt-screen" role="status" aria-live="polite">
      <div className="mt-grid" aria-hidden="true" />
      <div className="mt-glow" aria-hidden="true" />
      <main className="mt-main">
        <p className="mt-badge">
          <span className="mt-dot" /> 503 · Under maintenance
        </p>

        <Maintenance3D />
        <p className="mt-hint">
          <MousePointerClick className="size-3.5" /> Move your cursor to tilt the galaxy. Hover the floating pages. Click to send a shockwave.
        </p>

        <h1 className="mt-title">We&apos;re upgrading VJNOTES</h1>
        <p className="mt-copy">{message?.trim() || 'Your notes are safe. We are making the site better and will be right back.'}</p>

        <div className="mt-term" aria-hidden="true">
          <p className="mt-line" style={{ ['--n' as string]: 18, ['--d' as string]: '0.2s' }}>
            <b>$</b> galaxy --status
          </p>
          {LOG.map((l, i) => (
            <p key={l.text} className="mt-line" style={{ ['--n' as string]: l.text.length + 8, ['--d' as string]: `${0.9 + i * 1.1}s` }}>
              <span className={l.tag === 'ok' ? 'mt-ok' : 'mt-wait'}>[{l.tag === 'ok' ? ' ok ' : ' .. '}]</span> {l.text}
              {i === LOG.length - 1 && <i className="mt-caret" />}
            </p>
          ))}
        </div>

        <div className="mt-stats">
          {since && (
            <p>
              <Hourglass className="size-4" /> Down for <DownFor since={since} />
            </p>
          )}
          {back?.trim() && (
            <p>
              <Clock className="size-4" /> Expected back {back.trim()}
            </p>
          )}
        </div>
      </main>
      <p className="mt-credit">Created by: Sriharsha Reddy (EVL)</p>
    </div>
  )
}
