'use client'

import { useState } from 'react'
import { Check, Copy, MessageCircle, Printer, Share2 } from 'lucide-react'

const btn = 'inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong'

export function ShareActions({ url, message }: { url: string; message: string }) {
  const [copied, setCopied] = useState(false)
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copy this link', url)
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={copy} className={btn}>
        {copied ? <Check className="size-4 text-ok" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy link'}
      </button>
      <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" className={btn}>
        <MessageCircle className="size-4" /> WhatsApp
      </a>
      {canShare && (
        <button type="button" onClick={() => navigator.share({ title: 'VJNOTES', text: message, url }).catch(() => undefined)} className={btn}>
          <Share2 className="size-4" /> Share…
        </button>
      )}
      <button type="button" onClick={() => window.print()} className={btn}>
        <Printer className="size-4" /> Print poster
      </button>
    </div>
  )
}
