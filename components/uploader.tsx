'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Camera, Check, CloudUpload, FileStack, FileText, Link2, Loader2, TriangleAlert, X } from 'lucide-react'
import { inspectDriveLink, refreshChapter } from '@/app/upload/actions'
import { branches, extras, PAPERS_UNIT, sectionHref, sectionLabel, sectionsOf, sectionTitle, findSubject, type Semester } from '@/lib/curriculum'
import { combineHashes, fileHash } from '@/lib/hash'
import { autoFileName, guessPlacement } from '@/lib/organise'
import { formatBytes, plural } from '@/lib/format'
import { CameraCapture, cameraSupported } from '@/components/camera-capture'
import { DRIVE_KIND_LABEL, parseDriveLink, type DriveLinkKind } from '@/lib/drive-link'
import { photosToPdf } from '@/lib/photos-to-pdf'
import { addDriveLink, checkFile, ensureCollection, findDriveDuplicate, findDuplicates, MAX_FILES, nextPosition, uploadOne, type DuplicateOf, type Stage } from '@/lib/upload'

interface Item {
  key: string
  file: File
  name: string
  url: string | null
  stage: Stage
  error?: string
  /** SHA-256 of the file, used to spot duplicates. */
  hash?: string
  /** The person typed this name themselves, so automatic naming leaves it alone. */
  edited?: boolean
  /** Already on the site, or twice in this list. Skipped unless `keep` is set. */
  dup?: DuplicateOf | 'list'
  keep?: boolean
}

interface LinkItem {
  key: string
  id: string
  kind: DriveLinkKind
  name: string
  stage: Stage
  error?: string
}

const MAX_LINKS = 30

const stageLabel: Record<Stage, string> = {
  queued: 'Ready',
  preparing: 'Preparing preview…',
  uploading: 'Uploading…',
  saving: 'Saving…',
  done: 'Uploaded',
  error: 'Failed',
}

export function Uploader({
  userId,
  initialSubject,
  initialUnit,
  existing,
}: {
  userId: string
  initialSubject?: string
  initialUnit?: number
  existing: { id: string; subject: string; unit: number; files: number }[]
}) {
  const initial = initialSubject ? findSubject(initialSubject) : undefined
  const [branchId, setBranchId] = useState<string>(initial?.branch?.id ?? branches[0]?.id ?? '')
  const [sem, setSem] = useState<number>(initial?.semester.sem ?? branches[0]?.semesters[0]?.sem ?? 1)
  const [subject, setSubject] = useState<string | undefined>(initial?.subject.code)
  const [unit, setUnit] = useState<number | undefined>(
    initial && initialUnit !== undefined && sectionsOf(initial.subject).includes(initialUnit) ? initialUnit : undefined,
  )
  const [items, setItems] = useState<Item[]>([])
  const [mode, setMode] = useState<'files' | 'drive'>('files')
  const [links, setLinks] = useState<LinkItem[]>([])
  const [linkText, setLinkText] = useState('')
  const [linkBusy, setLinkBusy] = useState(false)
  const [linkErrors, setLinkErrors] = useState<string[]>([])
  const [description, setDescription] = useState('')
  const [combine, setCombine] = useState(true)
  const [autoName, setAutoName] = useState(true)
  const [pdfName, setPdfName] = useState('')
  const [converting, setConverting] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [rejected, setRejected] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const router = useRouter()
  const picker = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const branch = branches.find((b) => b.id === branchId) ?? branches[0]
  const allSemesters: Semester[] = [...(branch?.semesters ?? []), ...(extras ? [extras] : [])]
  const semester = allSemesters.find((s) => s.sem === sem) ?? allSemesters[0]!
  const chosen = subject ? findSubject(subject) : undefined
  const shelf = existing.find((c) => c.subject === subject && c.unit === unit)

  useEffect(() => () => items.forEach((i) => i.url && URL.revokeObjectURL(i.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  function add(list: FileList | File[] | null) {
    if (!list) return
    const bad: string[] = []
    const next: Item[] = []
    for (const file of Array.from(list)) {
      const problem = checkFile(file)
      if (problem) {
        bad.push(`${file.name}: ${problem}`)
        continue
      }
      next.push({
        key: crypto.randomUUID(),
        file,
        name: file.name.replace(/\.[^.]+$/, ''),
        url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
        stage: 'queued',
      })
    }
    setFinished(false)
    setRejected(bad)
    setItems((cur) => [...cur.filter((i) => i.stage !== 'done'), ...next].slice(0, MAX_FILES))
    void checkDuplicates(next.slice(0, MAX_FILES))
  }

  /** Fingerprints new files, then flags those already on the site or repeated in this list. */
  async function checkDuplicates(batch: Item[]) {
    if (batch.length === 0) return
    const hashes = new Map<string, string>()
    await Promise.all(
      batch.map(async (i) => {
        try {
          hashes.set(i.key, await fileHash(i.file))
        } catch {
          // Without a fingerprint the file is simply not checked.
        }
      }),
    )
    const onSite = await findDuplicates([...new Set(hashes.values())], userId)
    setItems((cur) => {
      const seen = new Set<string>()
      return cur.map((it) => {
        const fresh = hashes.has(it.key) && it.hash === undefined
        const hash = it.hash ?? hashes.get(it.key)
        if (!hash) return it
        const repeat = seen.has(hash)
        seen.add(hash)
        if (!fresh) return it
        return { ...it, hash, dup: onSite.get(hash) ?? (repeat ? ('list' as const) : undefined) }
      })
    })
  }

  function move(key: string, dir: -1 | 1) {
    setItems((cur) => {
      const i = cur.findIndex((x) => x.key === key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= cur.length) return cur
      const copy = [...cur]
      ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
      return copy
    })
  }

  function patch(key: string, p: Partial<Item>) {
    setItems((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)))
  }

  function patchLink(key: string, p: Partial<LinkItem>) {
    setLinks((cur) => cur.map((x) => (x.key === key ? { ...x, ...p } : x)))
  }

  /** Reads every link in the box, checks each opens for visitors, and queues the good ones. */
  async function addLinks() {
    const parts = linkText.split(/[\s,]+/).filter(Boolean)
    if (parts.length === 0) return
    setLinkBusy(true)
    setLinkErrors([])
    setFinished(false)
    const errors: string[] = []
    const added: LinkItem[] = []
    const seen = new Set(links.filter((l) => l.stage !== 'done').map((l) => l.id))
    for (const part of parts.slice(0, MAX_LINKS)) {
      if (!parseDriveLink(part)) {
        errors.push(`“${part.slice(0, 60)}” is not a Google Drive link.`)
        continue
      }
      const res = await inspectDriveLink(part)
      if (!res.ok) {
        errors.push(res.message)
        continue
      }
      if (seen.has(res.id)) continue
      seen.add(res.id)
      const dup = await findDriveDuplicate(res.id, userId)
      if (dup) {
        errors.push(`“${res.title ?? 'This link'}” is already on the site (${dup.subject} · ${sectionLabel(dup.unit)}, by ${dup.owner}). Skipped.`)
        continue
      }
      added.push({ key: crypto.randomUUID(), id: res.id, kind: res.kind, name: res.title ?? DRIVE_KIND_LABEL[res.kind], stage: 'queued' })
    }
    setLinks((cur) => [...cur.filter((l) => l.stage !== 'done'), ...added].slice(0, MAX_LINKS))
    setLinkErrors(errors)
    if (errors.length === 0) setLinkText('')
    setLinkBusy(false)
  }

  const pending = useMemo(() => items.filter((i) => (i.stage === 'queued' || i.stage === 'error') && !(i.dup && !i.keep)), [items])
  const duplicateCount = items.filter((i) => i.dup && !i.keep && i.stage !== 'done').length
  const pendingPhotos = pending.filter((i) => i.file.type.startsWith('image/'))
  const merging = combine && pendingPhotos.length > 0
  const totalBytes = pending.reduce((n, i) => n + i.file.size, 0)
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const shelfCount = shelf?.files ?? 0
  const defaultPdfName =
    autoName && chosen && unit !== undefined
      ? `${chosen.subject.short} · ${sectionLabel(unit)} · Notes ${shelfCount + 1}`
      : `${chosen?.subject.short ?? 'Notes'}${unit !== undefined ? ` ${sectionLabel(unit)}` : ''} notes ${today}`
  // Files that become their own note (everything except photos going into the combined PDF).
  const separate = pending.filter((i) => !(merging && i.file.type.startsWith('image/')))
  /** The name a file will get: what the person typed, else a chapter-based name, else its file name. */
  function nameFor(item: Item) {
    if (item.edited || !autoName || !chosen || unit === undefined) return item.name
    const at = separate.indexOf(item)
    if (at < 0) return item.name
    return autoFileName({ short: chosen.subject.short, unit, n: shelfCount + (merging ? 1 : 0) + at + 1, original: item.file.name })
  }

  // Where does the first recognisable file name say these notes belong?
  const preferred = useMemo(() => new Set((branch?.semesters ?? []).flatMap((s) => s.subjects.map((x) => x.code))), [branch])
  const guess = useMemo(() => {
    for (const i of items) {
      const g = guessPlacement(i.file.name, preferred)
      if (g) return { ...g, file: i.file.name }
    }
    return null
  }, [items, preferred])

  function moveTo(code: string, guessedUnit: number | null) {
    const found = findSubject(code)
    if (!found) return
    const inBranch = (b: (typeof branches)[number]) => b.semesters.some((s) => s.subjects.some((x) => x.code === code))
    const target = (branch && inBranch(branch) ? branch : branches.find(inBranch)) ?? branch
    const semesterOf = [...(target?.semesters ?? []), ...(extras ? [extras] : [])].find((s) => s.subjects.some((x) => x.code === code))
    if (target) setBranchId(target.id)
    setSem(semesterOf?.sem ?? found.semester.sem)
    setSubject(code)
    setUnit(guessedUnit === PAPERS_UNIT ? PAPERS_UNIT : found.subject.units.length ? (guessedUnit ?? undefined) : 0)
  }

  // Nothing chosen yet: take the hint from the file name.
  useEffect(() => {
    if (subject === undefined && guess) moveTo(guess.code, guess.unit)
  }, [guess]) // eslint-disable-line react-hooks/exhaustive-deps
  const pendingLinks = useMemo(() => links.filter((l) => l.stage === 'queued' || l.stage === 'error'), [links])
  const ready = subject !== undefined && unit !== undefined && pending.length + pendingLinks.length > 0 && !running

  async function start() {
    if (!ready || subject === undefined || unit === undefined) return
    setRunning(true)
    try {
      const collectionId = await ensureCollection(userId, subject, unit, description)
      const base = await nextPosition(collectionId)
      const photos = merging ? pendingPhotos : []
      const queue = pending.filter((i) => !photos.includes(i))
      const names = new Map(queue.map((i) => [i.key, nameFor(i)]))
      let offset = 0
      if (photos.length) {
        // All selected photos become one PDF, in the order shown in the list.
        const name = pdfName.trim() || defaultPdfName
        for (const p of photos) patch(p.key, { stage: 'preparing', error: undefined })
        try {
          setConverting(`Making PDF: page 0 of ${photos.length}`)
          const pdf = await photosToPdf(
            photos.map((p) => p.file),
            name,
            (done) => setConverting(`Making PDF: page ${done} of ${photos.length}`),
          )
          setConverting(null)
          if (pdf.size > 50 * 1024 * 1024) throw new Error('The PDF would be over 50 MB. Upload fewer photos at a time.')
          const hashes = photos.map((p) => p.hash)
          const contentHash = hashes.every(Boolean) ? await combineHashes(hashes as string[]) : undefined
          const already = contentHash ? (await findDuplicates([contentHash], userId)).get(contentHash) : undefined
          if (already) {
            throw new Error(`These photos are already on the site as “${already.name}” (${already.subject} · ${sectionLabel(already.unit)}, by ${already.owner}).`)
          }
          await uploadOne(pdf, { userId, collectionId, position: base, name, contentHash }, (stage) => photos.forEach((p) => patch(p.key, { stage })))
        } catch (e) {
          setConverting(null)
          const error = e instanceof Error ? e.message : 'Could not make the PDF'
          for (const p of photos) patch(p.key, { stage: 'error', error })
        }
        offset = 1
      }
      let cursor = 0
      // Three at a time keeps phones responsive on college Wi-Fi.
      await Promise.all(
        Array.from({ length: Math.min(3, queue.length) }, async () => {
          while (cursor < queue.length) {
            const item = queue[cursor]!
            const position = base + offset + queue.indexOf(item)
            cursor++
            try {
              await uploadOne(item.file, { userId, collectionId, position, name: names.get(item.key) ?? item.name, contentHash: item.hash }, (stage) => patch(item.key, { stage }))
            } catch (e) {
              patch(item.key, { stage: 'error', error: e instanceof Error ? e.message : 'Upload failed' })
            }
          }
        }),
      )
      // Drive links go after the files, in the order they were added.
      for (const [i, l] of pendingLinks.entries()) {
        patchLink(l.key, { stage: 'saving', error: undefined })
        try {
          await addDriveLink({ userId, collectionId, position: base + offset + queue.length + i, name: l.name, driveId: l.id, kind: l.kind })
          patchLink(l.key, { stage: 'done' })
        } catch (e) {
          patchLink(l.key, { stage: 'error', error: e instanceof Error ? e.message : 'Could not save this link' })
        }
      }
      await refreshChapter(subject, unit)
      setFinished(true)
      router.refresh()
    } catch (e) {
      setRejected([e instanceof Error ? e.message : 'Something went wrong'])
    } finally {
      setRunning(false)
    }
  }

  const doneCount = items.filter((i) => i.stage === 'done').length + links.filter((l) => l.stage === 'done').length
  const uploadCount = pending.length - (merging ? pendingPhotos.length - 1 : 0)
  const failed = items.filter((i) => i.stage === 'error').length + links.filter((l) => l.stage === 'error').length
  const summary = [
    pending.length ? plural(merging ? uploadCount : pending.length, 'file') : '',
    pendingLinks.length ? plural(pendingLinks.length, 'Drive link') : '',
  ]
    .filter(Boolean)
    .join(' + ')

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      {/* Where */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <Step n={1} title="Where do these notes go?" />
        {branches.length > 1 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium">Branch</p>
            <div className="flex flex-wrap gap-1.5">
              {branches.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  disabled={running}
                  onClick={() => {
                    setBranchId(b.id)
                    setSem(b.semesters[0]?.sem ?? 1)
                    setSubject(undefined)
                    setUnit(undefined)
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${b.id === branch?.id ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2 hover:text-ink'}`}
                >
                  {b.short}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-1.5">
          {allSemesters.map((s) => (
            <button
              key={s.sem}
              type="button"
              disabled={running}
              onClick={() => {
                setSem(s.sem)
                setSubject(undefined)
                setUnit(undefined)
              }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${s.sem === sem ? 'bg-ink text-bg' : 'bg-surface-2 text-ink-2 hover:text-ink'}`}
            >
              {s.sem === 0 ? 'Extras' : `Sem ${s.sem}`}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {semester.subjects.map((s) => (
            <button
              key={s.code}
              type="button"
              disabled={running}
              onClick={() => {
                setSubject(s.code)
                setUnit(s.units.length ? undefined : 0)
              }}
              className={`rounded-xl border px-3 py-2.5 text-left transition ${subject === s.code ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}
            >
              <span className="block text-xs font-semibold tracking-widest text-ink-3 uppercase">{s.short}</span>
              <span className="block truncate text-sm font-medium">{s.name}</span>
            </button>
          ))}
        </div>
        {chosen && (
          <div className="mt-5">
            <p className="mb-2 text-sm font-medium">Chapter</p>
            <div className="space-y-1.5">
              {sectionsOf(chosen.subject).map((u) => {
                const has = existing.find((c) => c.subject === chosen.subject.code && c.unit === u)
                return (
                  <button
                    key={u}
                    type="button"
                    disabled={running}
                    onClick={() => setUnit(u)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${unit === u ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}
                  >
                    <span className="w-16 shrink-0 text-xs font-semibold tracking-wide text-ink-3 uppercase">{sectionLabel(u)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{sectionTitle(chosen.subject, u)}</span>
                    {has && has.files > 0 && <span className="shrink-0 rounded-md bg-ok-soft px-1.5 py-0.5 text-[11px] font-medium text-ok">yours: {has.files}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </section>

      {/* Files */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <Step n={2} title={mode === 'files' ? 'Add photos or PDFs' : 'Paste a Google Drive link'} />
        <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1 text-sm font-medium">
          {(
            [
              ['files', 'Upload files', CloudUpload],
              ['drive', 'Google Drive link', Link2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg ${mode === id ? 'bg-surface text-ink shadow-card' : 'text-ink-3 hover:text-ink'}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </div>

        {mode === 'drive' && (
          <div className="mt-4 rounded-2xl border border-line bg-bg p-4">
            <textarea
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              rows={3}
              disabled={linkBusy || running}
              placeholder="https://drive.google.com/file/d/…  (you can paste several, one per line)"
              className="w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <button
              type="button"
              onClick={addLinks}
              disabled={linkBusy || running || !linkText.trim()}
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-40"
            >
              {linkBusy ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
              {linkBusy ? 'Checking links…' : 'Add link'}
            </button>
            <p className="mt-3 text-xs leading-relaxed text-ink-3">
              Works with files, folders, Google Docs, Sheets and Slides. The link is only saved here, so it uses none of the
              site&rsquo;s storage. In Drive set <strong className="text-ink-2">Share &rarr; Anyone with the link &rarr; Viewer</strong>, then
              copy the link. If you delete the file from your Drive, it disappears from here too.
            </p>
          </div>
        )}

        {linkErrors.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {linkErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {links.length > 0 && (
          <ul className="mt-4 space-y-2">
            {links.map((l) => (
              <li key={l.key} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-2">
                <div className="grid size-14 shrink-0 place-items-center rounded-lg bg-surface-2">
                  <Link2 className="size-6 text-ink-3" />
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={l.name}
                    disabled={running || l.stage === 'done'}
                    onChange={(e) => patchLink(l.key, { name: e.target.value.slice(0, 200) })}
                    aria-label="Link title"
                    className="w-full truncate rounded-md bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus:bg-surface"
                  />
                  <p className={`px-1 text-xs ${l.stage === 'error' ? 'text-danger' : l.stage === 'done' ? 'text-ok' : 'text-ink-3'}`}>
                    {l.stage === 'error' ? l.error : l.stage === 'done' ? 'Saved' : l.stage === 'saving' ? 'Saving…' : 'Ready'} · {DRIVE_KIND_LABEL[l.kind]}
                  </p>
                </div>
                {l.stage === 'done' ? (
                  <Check className="size-5 shrink-0 text-ok" />
                ) : l.stage === 'saving' ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-ink-3" />
                ) : (
                  <IconBtn label="Remove link" disabled={running} onClick={() => setLinks((cur) => cur.filter((x) => x.key !== l.key))}>
                    <X className="size-4" />
                  </IconBtn>
                )}
              </li>
            ))}
          </ul>
        )}

        <div
          hidden={mode !== 'files'}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            add(e.dataTransfer.files)
          }}
          className={`mt-4 rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-accent bg-accent-soft' : 'border-line-strong bg-bg'}`}
        >
          <CloudUpload className="mx-auto size-8 text-ink-3" strokeWidth={1.5} />
          <p className="mt-2 font-medium">Drop files here</p>
          <p className="text-sm text-ink-3">High-quality originals are kept exactly as uploaded. Up to 50 MB each.</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => picker.current?.click()} disabled={running} className="inline-flex h-10 items-center gap-2 rounded-xl bg-ink px-4 text-sm font-medium text-bg hover:opacity-90">
              <FileText className="size-4" /> Choose files
            </button>
            <button
              type="button"
              onClick={() => (cameraSupported() ? setCameraOpen(true) : camera.current?.click())}
              disabled={running}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-medium hover:border-line-strong"
            >
              <Camera className="size-4" /> Take photos
            </button>
          </div>
          <input ref={picker} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
          <input ref={camera} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
          {cameraOpen && <CameraCapture onShot={(file) => add([file])} onClose={() => setCameraOpen(false)} />}
        </div>

        {rejected.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger">
            {rejected.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}

        {guess && subject !== undefined && (guess.code !== subject || (guess.unit !== null && guess.unit !== unit)) && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-accent bg-accent-soft px-4 py-3 text-sm">
            <span className="min-w-0 flex-1">
              “{guess.file}” looks like{' '}
              <strong>
                {findSubject(guess.code)?.subject.short}
                {guess.unit !== null ? ` · ${sectionLabel(guess.unit)}` : ''}
              </strong>
              .
            </span>
            <button type="button" disabled={running} onClick={() => moveTo(guess.code, guess.unit)} className="font-semibold underline underline-offset-4">
              Move there
            </button>
          </div>
        )}

        {items.length > 0 && chosen && unit !== undefined && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg px-4 py-3">
            <input type="checkbox" checked={autoName} disabled={running} onChange={(e) => setAutoName(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span className="text-sm">
              <span className="font-medium">Name files by chapter</span>
              <span className="block text-xs text-ink-3">
                e.g. {autoFileName({ short: chosen.subject.short, unit, n: shelfCount + 1, original: 'IMG_2043.jpg' })}. You can still edit any name.
              </span>
            </span>
          </label>
        )}

        {duplicateCount > 0 && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-gold-soft px-3 py-2 text-sm text-gold">
            <TriangleAlert className="size-4 shrink-0" />
            {plural(duplicateCount, 'duplicate file')} will be skipped, so nothing is stored twice.
          </p>
        )}

        {items.length > 0 && (
          <ul className="mt-4 space-y-2">
            {items.map((item, i) => (
              <li key={item.key} className="flex items-center gap-3 rounded-xl border border-line bg-bg p-2">
                <div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-2">
                  {item.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.url} alt="" className="size-full object-cover" />
                  ) : (
                    <FileText className="size-6 text-ink-3" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <input
                    value={nameFor(item)}
                    disabled={running || item.stage === 'done'}
                    onChange={(e) => patch(item.key, { name: e.target.value, edited: true })}
                    aria-label="File title"
                    className="w-full truncate rounded-md bg-transparent px-1 py-0.5 text-sm font-medium outline-none focus:bg-surface"
                  />
                  <p className={`px-1 text-xs ${item.stage === 'error' ? 'text-danger' : item.stage === 'done' ? 'text-ok' : 'text-ink-3'}`}>
                    {item.stage === 'error' ? item.error : stageLabel[item.stage]} · {formatBytes(item.file.size)}
                  </p>
                  {item.dup && item.stage !== 'done' && (
                    <p className="flex flex-wrap items-center gap-x-2 px-1 text-xs text-gold">
                      <TriangleAlert className="size-3.5 shrink-0" />
                      <span>
                        {item.dup === 'list' ? (
                          'Same file appears twice in this list.'
                        ) : (
                          <>
                            {item.dup.mine ? 'You already uploaded this: ' : `Already on the site, by ${item.dup.owner}: `}
                            <Link href={`/view/u/${item.dup.id}`} target="_blank" className="underline underline-offset-2">
                              {item.dup.name}
                            </Link>{' '}
                            ({findSubject(item.dup.subject)?.subject.short ?? item.dup.subject} · {sectionLabel(item.dup.unit)})
                          </>
                        )}{' '}
                        {item.keep ? 'Will upload anyway.' : 'Skipped.'}
                      </span>
                      <button type="button" disabled={running} onClick={() => patch(item.key, { keep: !item.keep })} className="font-semibold underline underline-offset-2">
                        {item.keep ? 'Skip it' : 'Upload anyway'}
                      </button>
                    </p>
                  )}
                </div>
                {item.stage === 'done' ? (
                  <Check className="size-5 shrink-0 text-ok" />
                ) : ['preparing', 'uploading', 'saving'].includes(item.stage) ? (
                  <Loader2 className="size-5 shrink-0 animate-spin text-ink-3" />
                ) : (
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" disabled={running || i === 0} onClick={() => move(item.key, -1)}>
                      <ArrowUp className="size-4" />
                    </IconBtn>
                    <IconBtn label="Move down" disabled={running || i === items.length - 1} onClick={() => move(item.key, 1)}>
                      <ArrowDown className="size-4" />
                    </IconBtn>
                    <IconBtn label="Remove" disabled={running} onClick={() => setItems((cur) => cur.filter((x) => x.key !== item.key))}>
                      <X className="size-4" />
                    </IconBtn>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {pendingPhotos.length > 0 && (
          <div className={`mt-4 rounded-2xl border p-4 ${combine ? 'border-accent bg-accent-soft' : 'border-line bg-bg'}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={combine} disabled={running} onChange={(e) => setCombine(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FileStack className="size-4" /> Combine {plural(pendingPhotos.length, 'photo')} into one PDF
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">
                  One page per photo, in the order above. Usually takes far less space than the original photos, and is easier to read and download.
                  Untick to upload the original photos separately.
                </span>
              </span>
            </label>
            {combine && (
              <input
                value={pdfName}
                disabled={running}
                onChange={(e) => setPdfName(e.target.value.slice(0, 120))}
                placeholder={defaultPdfName}
                aria-label="PDF name"
                className="mt-3 h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm outline-none focus:border-accent"
              />
            )}
          </div>
        )}

        {!shelf && subject && unit !== undefined && (
          <label className="mt-5 block">
            <span className="text-sm font-medium">Note for classmates <span className="font-normal text-ink-3">(optional)</span></span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 500))}
              rows={2}
              placeholder="e.g. Covers 12–19 Sept lectures, section B"
              className="mt-1.5 w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
        )}

        <div className="mt-5 border-t border-line pt-5">
          {chosen && unit !== undefined && (
            <p className="mb-3 text-sm text-ink-2">
              {shelf
                ? `Adding to your existing shelf (${plural(shelf.files, 'file')}) in `
                : 'Starting your shelf in '}
              <strong>
                {chosen.subject.short} · {sectionLabel(unit)}
              </strong>
              .
            </p>
          )}
          <button
            type="button"
            onClick={start}
            disabled={!ready}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-medium text-accent-ink shadow-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
            {running
              ? (converting ?? 'Saving…')
              : pending.length + pendingLinks.length
                ? `${pending.length ? 'Upload' : 'Add'} ${summary}${merging ? ' (photos as 1 PDF)' : pending.length ? ` (${formatBytes(totalBytes)})` : ''}`
                : subject === undefined || unit === undefined
                  ? 'Choose a chapter first'
                  : mode === 'drive'
                    ? 'Add a Drive link'
                    : 'Add files to upload'}
          </button>
          {finished && subject && unit !== undefined && (
            <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ${failed ? 'bg-gold-soft text-gold' : 'bg-ok-soft text-ok'}`}>
              {failed ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
              <span className="flex-1">
                {failed ? `${plural(doneCount, 'file')} uploaded, ${failed} failed. Press upload again to retry.` : `All ${plural(doneCount, 'file')} uploaded.`}
              </span>
              <Link href={sectionHref(subject, unit)} className="font-semibold underline underline-offset-4">
                View chapter
              </Link>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function Step({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-7 place-items-center rounded-full bg-ink text-xs font-semibold text-bg">{n}</span>
      <h2 className="font-display text-lg font-semibold tracking-tight">{title}</h2>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} disabled={disabled} className="grid size-8 place-items-center rounded-lg text-ink-3 hover:bg-surface-2 hover:text-ink disabled:opacity-30">
      {children}
    </button>
  )
}
