'use client'

import { Maximize, Minus, Plus } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const MIN = 1
const MAX = 6

/**
 * Shows the fast preview, whole, then lets the reader zoom as far as they like: the − / + buttons,
 * the slider, Ctrl + scroll, or a click on the picture. Past 100% it swaps to the full original.
 */
export function ImageViewer({ preview, original, alt }: { preview: string; original: string; alt: string }) {
  const [zoom, setZoom] = useState(1)
  const [fit, setFit] = useState<{ w: number; h: number } | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)

  const set = (z: number) => setZoom(Math.min(MAX, Math.max(MIN, Math.round(z * 100) / 100)))

  // Size of the picture when it just fits the stage; zoom multiplies this.
  const measure = () => {
    const b = box.current
    const i = img.current
    if (!b || !i || !i.naturalWidth) return
    const cw = b.clientWidth - 32
    const ch = b.clientHeight - 32
    const s = Math.min(cw / i.naturalWidth, ch / i.naturalHeight)
    setFit({ w: i.naturalWidth * s, h: i.naturalHeight * s })
  }

  useEffect(() => {
    const b = box.current
    if (!b) return
    const ro = new ResizeObserver(measure)
    ro.observe(b)
    const wheel = (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      setZoom((z) => Math.min(MAX, Math.max(MIN, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))))
    }
    b.addEventListener('wheel', wheel, { passive: false })
    return () => {
      ro.disconnect()
      b.removeEventListener('wheel', wheel)
    }
  }, [])

  const btn =
    'grid size-8 place-items-center rounded-lg text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-40'

  return (
    <div className="absolute inset-0">
      <div ref={box} className="absolute inset-0 overflow-auto">
        <div className="grid min-h-full min-w-full w-max place-items-center p-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={img}
            src={zoom > 1 ? original : preview}
            alt={alt}
            onLoad={measure}
            onClick={() => set(zoom > 1 ? 1 : 2)}
            draggable={false}
            style={fit ? { width: fit.w * zoom, height: fit.h * zoom, maxWidth: 'none' } : undefined}
            className={`${fit ? '' : 'max-h-full max-w-full'} ${zoom > 1 ? 'cursor-zoom-out' : 'cursor-zoom-in'} select-none object-contain`}
          />
        </div>
      </div>

      <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-line bg-bg/90 p-1 shadow-card backdrop-blur">
        <button type="button" className={btn} onClick={() => set(zoom / 1.25)} disabled={zoom <= MIN} aria-label="Zoom out" title="Zoom out">
          <Minus className="size-4" />
        </button>
        <input
          type="range"
          min={MIN}
          max={MAX}
          step={0.05}
          value={zoom}
          onChange={(e) => set(Number(e.target.value))}
          aria-label="Zoom"
          className="h-1 w-28 cursor-pointer accent-[var(--accent)] sm:w-44"
        />
        <button type="button" className={btn} onClick={() => set(zoom * 1.25)} disabled={zoom >= MAX} aria-label="Zoom in" title="Zoom in">
          <Plus className="size-4" />
        </button>
        <span className="w-11 text-center text-xs tabular-nums text-ink-3">{Math.round(zoom * 100)}%</span>
        <button type="button" className={btn} onClick={() => set(1)} disabled={zoom === 1} aria-label="Fit to screen" title="Fit to screen">
          <Maximize className="size-4" />
        </button>
      </div>
    </div>
  )
}
