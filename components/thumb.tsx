'use client'

import { useState } from 'react'
import { FileText, FileImage, Presentation, FileQuestion, FileCode2 } from 'lucide-react'

const icons = { pdf: FileText, image: FileImage, slides: Presentation, doc: FileQuestion, code: FileCode2 }

export type ThumbIcon = keyof typeof icons

/** A lazy thumbnail that falls back to a file-type icon if the image cannot load. */
export function Thumb({ src, icon, label }: { src?: string | null; icon: ThumbIcon; label: string }) {
  const [failed, setFailed] = useState(!src)
  const Icon = icons[icon]
  return (
    <div className="relative aspect-[4/3] overflow-hidden bg-surface-2">
      {!failed && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="size-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="grid size-full place-items-center">
          <div className="flex flex-col items-center gap-2 text-ink-3">
            <Icon className="size-8" strokeWidth={1.4} />
            <span className="text-[11px] font-semibold tracking-widest uppercase">{label}</span>
          </div>
        </div>
      )}
    </div>
  )
}
