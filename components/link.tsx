'use client'

import NextLink from 'next/link'
import { useRouter } from 'next/navigation'
import { useRef } from 'react'

type Props = React.ComponentProps<typeof NextLink>

/**
 * The site's link. Next's own link fetches a page as soon as its link scrolls into view; on a
 * page of forty cards that is forty fetches nobody asked for, and they count against the host's
 * monthly allowance. This one waits for intent: it fetches when the pointer comes over the link or
 * a finger touches it, which is still ahead of the click.
 */
export default function Link({ href, onPointerEnter, onTouchStart, onFocus, ...rest }: Props) {
  const router = useRouter()
  const done = useRef(false)

  const warm = () => {
    if (done.current || typeof href !== 'string' || !href.startsWith('/') || href.startsWith('/#')) return
    done.current = true
    router.prefetch(href)
  }

  return (
    <NextLink
      href={href}
      prefetch={false}
      onPointerEnter={(e) => {
        warm()
        onPointerEnter?.(e)
      }}
      onTouchStart={(e) => {
        warm()
        onTouchStart?.(e)
      }}
      onFocus={(e) => {
        warm()
        onFocus?.(e)
      }}
      {...rest}
    />
  )
}
