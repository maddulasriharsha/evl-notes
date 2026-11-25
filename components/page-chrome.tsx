'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { ArrowUp } from 'lucide-react'
import Link from '@/components/link'

/**
 * Small page furniture driven by scrolling, written straight onto the document so scrolling never
 * re-renders React: a reading-progress line, the top bar firming up once the page moves under it
 * (html[data-scrolled]), and a back-to-top button after a couple of screens (html[data-deep]).
 */
export function PageChrome() {
  const line = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const max = root.scrollHeight - window.innerHeight
      root.toggleAttribute('data-scrolled', y > 12)
      root.toggleAttribute('data-deep', y > window.innerHeight * 1.5)
      // Short pages have nothing to measure, so the line stays away.
      if (line.current) line.current.style.transform = `scaleX(${max > 400 ? Math.min(1, y / max) : 0})`
    }
    const on = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [pathname])

  // The file viewer uses the whole screen.
  if (pathname.startsWith('/view/')) return null

  return (
    <>
      <div ref={line} data-chrome className="scroll-line" aria-hidden="true" />
      <button
        type="button"
        data-chrome
        onClick={() => window.scrollTo({ top: 0 })}
        aria-label="Back to top"
        className="to-top btn-ghost grid size-11 place-items-center rounded-full bg-surface/90 text-ink-2 backdrop-blur-xl hover:text-ink"
      >
        <ArrowUp className="size-4.5" />
      </button>
    </>
  )
}

const NAV = [
  { href: '/#branches', label: 'Branches', on: (p: string) => p.startsWith('/b/') || p.startsWith('/s/') || p.startsWith('/sem/') },
  { href: '/textbooks', label: 'Textbooks', on: (p: string) => p.startsWith('/textbooks') },
  { href: '/contributors', label: 'Contributors', on: (p: string) => p.startsWith('/contributors'), wide: 'hidden lg:inline-flex' },
  // The exam schedule is a main section: it gets its own highlighted pill (Requests moved to the account menu and footer).
  { href: '/exams', label: 'Exams', on: (p: string) => p.startsWith('/exams'), wide: 'nav-exam' },
]

/** The top bar's links, with a mark under the section you are in. */
export function NavLinks() {
  const pathname = usePathname()
  return (
    <nav aria-label="Main" className="ml-2 hidden items-center gap-0.5 text-sm text-ink-2 md:flex">
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} aria-current={n.on(pathname) ? 'page' : undefined} className={`nav-link ${'wide' in n ? n.wide : ''}`}>
          {n.label}
        </Link>
      ))}
    </nav>
  )
}

/**
 * Marks the reader's own branch (remembered when they last opened one) on the home grid, so it
 * comes first. It only sets an attribute; the look and the ordering are CSS.
 */
export function MarkMyBranch() {
  useEffect(() => {
    try {
      const mine = localStorage.getItem('vj-branch')
      if (mine) document.querySelector(`.branch-card[data-branch="${CSS.escape(mine)}"]`)?.setAttribute('data-mine', '')
    } catch {
      /* no storage: the grid keeps its usual order */
    }
  }, [])
  return null
}
