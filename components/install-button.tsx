'use client'

import { useEffect, useState } from 'react'
import { Download, X } from 'lucide-react'

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * "Install app" for the footer or the account menu. Uses the browser's own install prompt where it
 * exists; otherwise shows the two-step instructions for that browser. Hidden once installed.
 */
export function InstallButton({ className = '', onDone }: { className?: string; onDone?: () => void }) {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [help, setHelp] = useState(false)
  const [ios, setIos] = useState(false)

  useEffect(() => {
    setInstalled(window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
    setIos(/iphone|ipad|ipod/i.test(navigator.userAgent))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setEvent(e as InstallPromptEvent)
    }
    const onInstalled = () => setInstalled(true)
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  if (installed) return null

  async function install() {
    if (event) {
      await event.prompt()
      const choice = await event.userChoice
      setEvent(null)
      if (choice.outcome === 'accepted') setInstalled(true)
      onDone?.()
      return
    }
    setHelp(true)
  }

  return (
    <>
      <button type="button" onClick={install} className={className}>
        <Download className="size-4" /> Install app
      </button>
      {help && (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" onClick={() => setHelp(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-2xl border border-line bg-surface p-5 shadow-pop">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Install VJNOTES</h2>
              <button type="button" onClick={() => setHelp(false)} aria-label="Close" className="grid size-8 place-items-center rounded-lg hover:bg-surface-2">
                <X className="size-4" />
              </button>
            </div>
            {ios ? (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
                <li>Open this site in <strong className="text-ink">Safari</strong>.</li>
                <li>Tap the <strong className="text-ink">Share</strong> button (the square with an arrow).</li>
                <li>Choose <strong className="text-ink">Add to Home Screen</strong>.</li>
              </ol>
            ) : (
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
                <li>Open your browser&rsquo;s menu (the <strong className="text-ink">⋮</strong> or <strong className="text-ink">⋯</strong> at the top or bottom of the browser, not on this page).</li>
                <li>Choose <strong className="text-ink">Install app</strong> or <strong className="text-ink">Add to Home screen</strong>.</li>
              </ol>
            )}
            <p className="mt-3 text-xs text-ink-3">
              Already installed, or the option is missing? Some browsers (and in-app browsers such as Instagram or WhatsApp) don&rsquo;t offer
              it. Open the site in Chrome or Safari.
            </p>
          </div>
        </div>
      )}
    </>
  )
}
