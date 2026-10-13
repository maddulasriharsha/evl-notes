'use client'

import { useEffect, useRef, useState } from 'react'
import { FileText, FileImage, Presentation, FileQuestion, FileCode2 } from 'lucide-react'

const icons = { pdf: FileText, image: FileImage, slides: Presentation, doc: FileQuestion, code: FileCode2 }

export type ThumbIcon = keyof typeof icons

/** A lazy thumbnail that falls back to a file-type icon if the image cannot load. */
export function Thumb({ src, icon, label, badge }: { src?: string | null; icon: ThumbIcon; label: string; /** File type shown on the corner (PDF, DOCX…). */ badge?: string }) {
  const [failed, setFailed] = useState(!src)
  const [loaded, setLoaded] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  // An image that finished loading before the page became interactive never fires onLoad.
  useEffect(() => {
    const el = img.current
    if (!el?.complete) return
    if (el.naturalWidth > 0) setLoaded(true)
    else setFailed(true)
  }, [])
  const Icon = icons[icon]
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
      {!failed && src ? (
        <>
          {!loaded && <div className="skeleton absolute inset-0" aria-hidden="true" />}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={img}
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
            className={`size-full object-cover object-top transition duration-300 group-hover:scale-[1.03] ${loaded ? 'opacity-100' : 'opacity-0'}`}
          />
        </>
      ) : (
        <div className="grid size-full place-items-center">
          <div className="flex flex-col items-center gap-2 text-ink-3">
            <Icon className="size-8" strokeWidth={1.4} />
            <span className="text-[11px] font-semibold tracking-widest uppercase">{label}</span>
          </div>
        </div>
      )}
      {badge && (
        <span className="absolute top-2 left-2 rounded-md border border-line bg-bg/90 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-ink-2 uppercase backdrop-blur">
          {badge}
        </span>
      )}
    </div>
  )
}
