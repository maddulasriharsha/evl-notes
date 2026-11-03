'use client'

import { useEffect } from 'react'

/**
 * While a note is open, marks the page as "reading": the announcement and reply bars and the phone's
 * bottom bar step aside (see globals.css) so the file gets the screen. Removed again on leaving.
 */
export function ReaderMode() {
  useEffect(() => {
    const root = document.documentElement
    root.classList.add('reading')
    return () => root.classList.remove('reading')
  }, [])
  return null
}
