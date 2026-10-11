'use client'

import { useEffect } from 'react'

/** Registers the service worker (production only) so the site can be installed like an app. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  }, [])
  return null
}
