'use client'

import { useEffect, useRef, useState } from 'react'
import { Download, Printer, QrCode, X } from 'lucide-react'

/**
 * "QR code" button for a subject or chapter page: opens a card with a scannable code that leads
 * straight to that page. Handy for posters in class and for sharing in groups.
 */
export function QrButton({ path, title, subtitle }: { path: string; title: string; subtitle?: string }) {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    let live = true
    const full = `${window.location.origin}${path}`
    setUrl(full)
    import('qrcode')
      .then((m) => m.default.toDataURL(full, { margin: 2, width: 720, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#ffffff' } }))
      .then((d) => live && setSrc(d))
      .catch(() => live && setSrc(null))
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => {
      live = false
      document.removeEventListener('keydown', onKey)
    }
  }, [open, path])

  const fileName = `vjnotes-${path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home'}.png`

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong"
      >
        <QrCode className="size-4" /> QR code
      </button>
      {open && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 print:static print:bg-white print:p-0" role="dialog" aria-modal="true" aria-label="QR code">
          <div className="w-full max-w-sm rounded-3xl border border-line bg-surface p-6 text-center shadow-pop print:max-w-none print:border-0 print:shadow-none">
            <div className="flex items-start justify-between gap-3 text-left">
              <div className="min-w-0">
                <p className="text-xs font-semibold tracking-widest text-ink-3 uppercase">Scan to open</p>
                <h2 className="mt-1 font-display text-lg leading-snug font-semibold text-balance">{title}</h2>
                {subtitle && <p className="mt-0.5 text-sm text-ink-3">{subtitle}</p>}
              </div>
              <button ref={closeRef} type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-surface-2 print:hidden">
                <X className="size-4" />
              </button>
            </div>
            <div className="mx-auto mt-5 grid aspect-square w-full max-w-64 place-items-center rounded-2xl bg-white p-2">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={`QR code for ${title}`} className="size-full" />
              ) : (
                <span className="text-sm text-neutral-500">Making code…</span>
              )}
            </div>
            <p className="mt-3 text-xs break-all text-ink-3">{url}</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2 print:hidden">
              {src && (
                <a href={src} download={fileName} className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90">
                  <Download className="size-4" /> Save image
                </a>
              )}
              <button type="button" onClick={() => window.print()} className="inline-flex h-10 items-center gap-2 rounded-xl border border-line px-4 text-sm font-medium hover:border-line-strong">
                <Printer className="size-4" /> Print
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
