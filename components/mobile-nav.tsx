'use client'

import Link from '@/components/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bookmark, GraduationCap, Home, Search, Upload } from 'lucide-react'

/** Phone-only bar fixed to the bottom: the five places a student goes most. */
export function MobileNav() {
  const pathname = usePathname()
  const [branch, setBranch] = useState<string | null>(null)
  useEffect(() => {
    try {
      setBranch(localStorage.getItem('vj-branch'))
    } catch {
      /* storage unavailable: the tab opens the branch list */
    }
  }, [pathname])

  // The file viewer uses the whole screen.
  if (pathname.startsWith('/view/')) return null

  const items = [
    { href: '/', label: 'Home', icon: Home, on: pathname === '/' },
    { href: '/search', label: 'Search', icon: Search, on: pathname.startsWith('/search') },
    { href: branch ? `/b/${branch}` : '/#branches', label: 'My branch', icon: GraduationCap, on: pathname.startsWith('/b/') },
    { href: '/saved', label: 'Saved', icon: Bookmark, on: pathname.startsWith('/saved') },
    { href: '/upload', label: 'Upload', icon: Upload, on: pathname.startsWith('/upload') },
  ]

  return (
    <nav
      aria-label="Main"
      data-chrome
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden print:hidden"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {items.map(({ href, label, icon: Icon, on }) => (
          <li key={label}>
            <Link
              href={href}
              aria-current={on ? 'page' : undefined}
              className={`flex h-14 flex-col items-center justify-center gap-0.5 text-[10.5px] font-medium ${on ? 'text-accent' : 'text-ink-3'}`}
            >
              <Icon className="size-5" strokeWidth={on ? 2.2 : 1.7} />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
