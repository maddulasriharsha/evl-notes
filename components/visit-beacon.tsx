'use client'

import { useEffect } from 'react'
import { supabaseConfigured } from '@/lib/env'
import { supabaseBrowser } from '@/lib/supabase/browser'

const ID_KEY = 'vj-visitor'
const SESSION_KEY = 'vj-visit-counted'

/**
 * Counts a visit once per browser session, using a random id kept in this browser. No cookies, no
 * IP address, no page names, no link to any account. Skipped when the browser asks not to be tracked.
 */
export function VisitBeacon() {
  useEffect(() => {
    if (!supabaseConfigured || navigator.doNotTrack === '1') return
    try {
      if (sessionStorage.getItem(SESSION_KEY)) return
      let id = localStorage.getItem(ID_KEY)
      if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
        id = crypto.randomUUID()
        localStorage.setItem(ID_KEY, id)
      }
      sessionStorage.setItem(SESSION_KEY, '1')
      // The query builder only sends its request once something awaits it, so .then() is required.
      supabaseBrowser()
        .rpc('record_visit', { p_visitor: id })
        .then(
          ({ error }) => {
            if (error) sessionStorage.removeItem(SESSION_KEY)
          },
          () => sessionStorage.removeItem(SESSION_KEY),
        )
    } catch {
      // Storage blocked (private mode): the visit simply is not counted.
    }
  }, [])
  return null
}
