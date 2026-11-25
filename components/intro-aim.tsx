'use client'

import { useLayoutEffect } from 'react'

/**
 * Tells the intro's dash where to land: the distance from its place between "VJ" and "NOTES" to
 * the centre of the mark above. The CSS has a sensible guess; this replaces it with the measured
 * value (letter widths differ between the display font and its fallback).
 */
export function IntroAim() {
  useLayoutEffect(() => {
    if (!document.documentElement.classList.contains('intro')) return
    const aim = () => {
      const dash = document.querySelector<HTMLElement>('.intro-dash')
      const gap = document.querySelector('.intro-gap')?.getBoundingClientRect()
      const mark = document.querySelector('.intro-mark')?.getBoundingClientRect()
      if (!dash || !gap || !mark || !gap.width) return
      dash.style.setProperty('--dx', `${(mark.left + mark.width / 2 - (gap.left + gap.width / 2)).toFixed(1)}px`)
      dash.style.setProperty('--dy', `${(mark.top + mark.height / 2 - (gap.top + gap.height / 2)).toFixed(1)}px`)
      // Where the finished mark settles: on top of the logo in the header.
      const home = document.querySelector('header a[aria-label="VJNOTES home"] svg')?.getBoundingClientRect()
      const box = document.querySelector<HTMLElement>('.intro-mark')
      if (home && box && home.width && mark.width) {
        box.style.setProperty('--fx', `${(home.left + home.width / 2 - (mark.left + mark.width / 2)).toFixed(1)}px`)
        box.style.setProperty('--fy', `${(home.top + home.height / 2 - (mark.top + mark.height / 2)).toFixed(1)}px`)
        box.style.setProperty('--fs', (home.width / mark.width).toFixed(3))
      }
    }
    aim()
    // The display font may arrive a moment later and change the widths; and once the words have
    // settled (just before the dash takes off) the measurement is exact.
    void document.fonts?.ready.then(aim)
    const t = setTimeout(aim, 1000)
    // Tap, click or Escape ends the intro at once.
    const root = document.documentElement
    const skip = () => root.classList.add('intro-done')
    const key = (e: KeyboardEvent) => e.key === 'Escape' && skip()
    const screen = document.querySelector('.intro-screen')
    screen?.addEventListener('pointerdown', skip)
    window.addEventListener('keydown', key)
    return () => {
      clearTimeout(t)
      screen?.removeEventListener('pointerdown', skip)
      window.removeEventListener('keydown', key)
    }
  }, [])
  return null
}
