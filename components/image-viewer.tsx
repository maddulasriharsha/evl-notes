'use client'

import { useState } from 'react'

/** Shows the fast preview first, swaps to the full original when zoomed. */
export function ImageViewer({ preview, original, alt }: { preview: string; original: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false)
  return (
    <div className={`absolute inset-0 ${zoomed ? 'overflow-auto' : 'overflow-hidden p-4'}`}>
      {/* A definite height and width (not max-height: 100%) so a tall photo is always shown whole. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={zoomed ? original : preview}
        alt={alt}
        onClick={() => setZoomed((z) => !z)}
        className={zoomed ? 'max-w-none cursor-zoom-out' : 'size-full cursor-zoom-in object-contain'}
      />
      {!zoomed && (
        <p className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ink/80 px-3 py-1 text-xs text-bg">
          Tap to zoom to full resolution
        </p>
      )}
    </div>
  )
}
