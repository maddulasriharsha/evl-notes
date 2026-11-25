'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from '@/components/link'

/**
 * The viewer's back arrow. If you came from another page on this site it goes straight back to it
 * (the exact list and scroll position you left); if you opened the file from a link or a bookmark,
 * it goes to the file's chapter instead.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  const router = useRouter()
  return (
    <Link
      href={href}
      aria-label={`Back to ${label}`}
      title={`Back to ${label}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        let same = false
        try {
          same = !!document.referrer && new URL(document.referrer).origin === location.origin && history.length > 1
        } catch {
          same = false
        }
        if (same) {
          e.preventDefault()
          router.back()
        }
      }}
      className="grid size-10 shrink-0 place-items-center rounded-xl border border-line hover:bg-surface-2"
    >
      <ArrowLeft className="size-4" />
    </Link>
  )
}
