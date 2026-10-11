'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'

type Theme = 'dark' | 'light'

/** Switches between the dark (default) and light look. The choice is remembered on this device. */
export function ThemeToggle({ className = '', withLabel = false }: { className?: string; withLabel?: boolean }) {
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
  }, [])

  function flip() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      localStorage.setItem('vj-theme', next)
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
  }

  return (
    <button type="button" onClick={flip} aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'} title="Light / dark" className={className}>
      {theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}
      {withLabel && <span>{theme === 'dark' ? 'Light theme' : 'Dark theme'}</span>}
    </button>
  )
}
