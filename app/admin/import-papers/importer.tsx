'use client'

import { useState } from 'react'
import titles from './titles.json'

const TITLES = titles as Record<string, string>

export function PaperImporter() {
  const [log, setLog] = useState('')
  const [busy, setBusy] = useState(false)

  async function run(files: FileList | null) {
    if (!files?.length) return
    setBusy(true)
    const w = window as unknown as { __papers?: Record<string, { id: string; title: string }> }
    w.__papers = w.__papers ?? {}
    let ok = 0
    let bad = 0
    for (const f of Array.from(files)) {
      const hash = f.name.replace(/\.pdf$/i, '')
      const title = TITLES[hash]
      if (!title || w.__papers[hash]) continue
      const body = new FormData()
      body.set('file', f)
      body.set('name', title)
      try {
        const res = await fetch('/api/admin/papers', { method: 'POST', body })
        const json = (await res.json()) as { id?: string; error?: string }
        if (res.ok && json.id) {
          w.__papers[hash] = { id: json.id, title }
          ok += 1
        } else bad += 1
      } catch {
        bad += 1
      }
      setLog(`${ok} uploaded, ${bad} failed`)
    }
    setBusy(false)
  }

  return (
    <div className="mt-4 space-y-3">
      <input id="papers" type="file" multiple accept="application/pdf" disabled={busy} onChange={(e) => void run(e.target.files)} />
      <p id="papers-log" className="text-sm">{log}</p>
    </div>
  )
}
