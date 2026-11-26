'use client'

import { supabaseConfigured } from '@/lib/env'
import { todayIST } from '@/lib/exam-dates'
import { hasSession, publicRest, supabaseBrowser } from '@/lib/supabase/browser'

/*
 * The study streak. A day counts after five minutes of reading notes. Signed out, this browser keeps
 * a secret random key and the server gives it a made-up name ("Cosmic Otter"). Signed in, the streak
 * belongs to the account and shows its display name. The server does the counting.
 */

const KEY = 'vj-streak-key'
const CACHE = 'vj-streak'
const READING = 'vj-read-time'
/** Reading time a day needs, in seconds. The database asks for the same (less a little clock slack). */
export const READ_SECONDS = 5 * 60
/** Fired on window when the streak has a new answer from the server. */
export const STREAK_EVENT = 'vj-streak'

export interface StreakMe {
  name: string
  /** True when the name is the signed-in member's own. */
  account: boolean
  streak: number
  best: number
  days: number
  /** Today has been counted. */
  today: boolean
}

export interface StreakBoardData {
  players: { place: number; name: string; member: boolean; streak: number; best: number; days: number; me: boolean }[]
  total: number
  my_place: number | null
}

export interface ReadingTime {
  seconds: number
  /** The server has been told that reading began. */
  started: boolean
}

/** Browsers that ask not to be tracked are never given a key. */
export function streakOptedOut() {
  return typeof navigator !== 'undefined' && navigator.doNotTrack === '1'
}

/** This browser's key, made on the first visit. Null when storage is blocked. */
function browserKey(): string | null {
  try {
    let key = localStorage.getItem(KEY)
    if (!key || !/^[0-9a-f-]{36}$/i.test(key)) {
      key = crypto.randomUUID()
      localStorage.setItem(KEY, key)
    }
    return key
  } catch {
    return null
  }
}

function load<T>(key: string): (T & { day?: string }) | null {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null') as (T & { day?: string }) | null
    return v && v.day === todayIST() ? v : null
  } catch {
    return null
  }
}

function save(key: string, value: object) {
  try {
    localStorage.setItem(key, JSON.stringify({ ...value, day: todayIST() }))
  } catch {
    /* storage unavailable */
  }
}

/** The last answer from today, if it is still about the same person. */
export function cachedStreak(): StreakMe | null {
  const c = load<StreakMe & { signed?: boolean }>(CACHE)
  if (!c || typeof c.name !== 'string' || typeof c.streak !== 'number') return null
  // Signing in or out changes whose streak this is, so ask again. So does a sign-in that had no
  // display name yet, until it gets one.
  const signed = hasSession()
  return c.signed === signed && (!signed || c.account) ? c : null
}

/** A call that carries the sign-in when there is one, and stays small (no client script) when not. */
async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  if (!hasSession()) return publicRest<T>(`rpc/${name}`, { method: 'POST', body: args })
  const { data, error } = await supabaseBrowser().rpc(name, args)
  if (error) throw new Error(error.message)
  return data as T
}

let inFlight: Promise<StreakMe | null> | null = null

/**
 * This visitor's name and streak; the server counts today in the same call once enough has been read.
 * Asks once a day (and after signing in or out) unless `fresh` is set. Null if it cannot be done.
 */
export function checkIn(fresh = false): Promise<StreakMe | null> {
  if (!supabaseConfigured || streakOptedOut()) return Promise.resolve(null)
  if (!fresh) {
    const done = cachedStreak()
    if (done) return Promise.resolve(done)
    if (inFlight) return inFlight
  }
  inFlight = (async () => {
    // Without storage the key would be new on every page, so nothing is counted.
    const key = browserKey()
    if (!key) return null
    const signed = hasSession()
    const me = await rpc<StreakMe | null>('streak_checkin', { p_key: key })
    if (!me) return null
    save(CACHE, { ...me, signed })
    window.dispatchEvent(new Event(STREAK_EVENT))
    return me
  })()
    .catch(() => null)
    .finally(() => (inFlight = null))
  return inFlight
}

export function readingTime(): ReadingTime {
  const r = load<ReadingTime>(READING)
  return { seconds: typeof r?.seconds === 'number' ? r.seconds : 0, started: r?.started === true }
}

export function saveReadingTime(r: ReadingTime) {
  save(READING, r)
}

/** Tells the server that reading has begun today. True once it knows. */
export async function startReading(): Promise<boolean> {
  const key = browserKey()
  if (!key || !supabaseConfigured) return false
  try {
    await rpc('streak_start', { p_key: key })
    return true
  } catch {
    return false
  }
}

export async function streakBoard(): Promise<StreakBoardData> {
  const key = streakOptedOut() || !cachedStreak() ? null : browserKey()
  return rpc<StreakBoardData>('streak_board', { p_key: key })
}
