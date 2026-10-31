'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from '@/components/link'
import { useRouter } from 'next/navigation'
import { ArrowDown, ArrowUp, Camera, Check, CloudUpload, FileStack, FileText, Link2, Loader2, Sparkles, TriangleAlert, X } from 'lucide-react'
import { inspectDriveLink, refreshChapter } from '@/app/upload/actions'
import { expandDriveFolder } from '@/app/upload/drive-actions'
import { uploadToDrive } from '@/lib/upload-drive'
import { supabaseBrowser } from '@/lib/supabase/browser'
import { goesToDrive, isOffice, mimeOf } from '@/lib/upload-rules'
import { aiSortAvailable } from '@/app/upload/classify-actions'
import { autoSort } from '@/lib/auto-sort'
import { branches, PAPERS_UNIT, sectionHref, sectionLabel, sectionsOf, sectionTitle, findSubject, type Semester } from '@/lib/curriculum'
import { combineHashes, fileHash } from '@/lib/hash'
import { autoFileName } from '@/lib/organise'
import { formatBytes, plural } from '@/lib/format'
import { CameraCapture, cameraSupported } from '@/components/camera-capture'
import { DRIVE_KIND_LABEL, parseDriveLink, type DriveLinkKind } from '@/lib/drive-link'
import { photosToPdf } from '@/lib/photos-to-pdf'
import { addDriveLink, checkFile, ensureCollection, findDriveDuplicate, findDuplicates, MAX_FILES, nextPosition, uploadOne, type DuplicateOf, type Stage } from '@/lib/upload'

type ExamKind = 'mid1' | 'mid2' | 'sem'
const EXAMS: Record<ExamKind, string> = { mid1: 'Mid 1', mid2: 'Mid 2', sem: 'Sem' }

/** Where a file goes. `unit` is null while only the subject is known. */
interface Place {
  code: string
  unit: number | null
}

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
  /** This file's own destination (found by reading it, or picked). Without one it uses the Step 1 choice. */
  place?: Place
  placeBy?: 'name' | 'text' | 'ai' | 'manual'
  /** Being read right now to find its destination. */
  sorting?: boolean
}

interface LinkItem {
  key: string
  id: string
  kind: DriveLinkKind
  name: string
  stage: Stage
  error?: string
}

interface Group {
  key: string
  code: string
  unit: number
  items: Item[]
  photos: Item[]
  separate: Item[]
  shelfCount: number
}

const MAX_LINKS = 100

const stageLabel: Record<Stage, string> = {
  queued: 'Ready',
  preparing: 'Preparing preview…',
  uploading: 'Uploading…',
  saving: 'Saving…',
  done: 'Uploaded',
  error: 'Failed',
}

const BY_LABEL: Record<NonNullable<Item['placeBy']>, string> = {
  name: 'from the file name',
  text: 'from the text inside',
  ai: 'by reading the pages',
  manual: 'chosen by you',
}

const isImage = (i: Item) => i.file.type.startsWith('image/')

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
  // Off by default: two photos stay two files unless the person asks for one PDF.
  const [combine, setCombine] = useState(false)
  const [madePdfs, setMadePdfs] = useState(0)
  const [autoName, setAutoName] = useState(true)
  // For papers going to PYQs: which exam it is. The site files a paper under Mid or Sem PYQs by its name.
  const [exam, setExam] = useState<ExamKind | undefined>(undefined)
  const [examYear, setExamYear] = useState(new Date().getFullYear())
  const [pdfName, setPdfName] = useState('')
  const [converting, setConverting] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState<{ code: string; unit: number }[] | null>(null)
  const [rejected, setRejected] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const [aiOn, setAiOn] = useState(false)
  const [picking, setPicking] = useState<Set<string>>(new Set())
  const router = useRouter()
  const picker = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [cameraOpen, setCameraOpen] = useState(false)

  const branch = branches.find((b) => b.id === branchId) ?? branches[0]
  // The shared "Extras" shelf (BEEE) is not offered for new uploads; its existing notes stay readable.
  const allSemesters: Semester[] = [...(branch?.semesters ?? [])]
  const semester = allSemesters.find((s) => s.sem === sem) ?? allSemesters[0]!
  const chosen = subject ? findSubject(subject) : undefined
  const shelf = existing.find((c) => c.subject === subject && c.unit === unit)
  const preferred = useMemo(() => new Set((branch?.semesters ?? []).flatMap((s) => s.subjects.map((x) => x.code))), [branch])

  useEffect(() => () => items.forEach((i) => i.url && URL.revokeObjectURL(i.url)), []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    void aiSortAvailable().then(setAiOn).catch(() => setAiOn(false))
  }, [])

  /** The Step 1 choice, used by every file that has no destination of its own. */
  const defaultPlace: { code: string; unit: number } | undefined = subject !== undefined && unit !== undefined ? { code: subject, unit } : undefined
  const placeOf = (i: Item): { code: string; unit: number } | undefined => {
    const p = i.place ?? defaultPlace
    return p && p.unit !== null ? { code: p.code, unit: p.unit } : undefined
  }

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
        // No chapter chosen in Step 1: the site works out where each file belongs (Office files cannot be read).
        sorting: !defaultPlace && !isOffice(mimeOf(file)),
      })
    }
    setFinished(null)
    setRejected(bad)
    const kept = next.slice(0, MAX_FILES)
    setItems((cur) => [...cur.filter((i) => i.stage !== 'done'), ...next].slice(0, MAX_FILES))
    void checkDuplicates(kept)
    if (!defaultPlace && kept.length > 0) {
      void autoSort(
        kept.filter((i) => !isOffice(mimeOf(i.file))).map((i) => ({ key: i.key, file: i.file })),
        { prefer: preferred, branchId, ai: aiOn },
        (r) =>
          setItems((cur) =>
            cur.map((x) =>
              x.key !== r.key
                ? x
                : x.placeBy === 'manual'
                  ? { ...x, sorting: false }
                  : { ...x, sorting: false, place: r.place, placeBy: r.by },
            ),
          ),
      ).catch(() => setItems((cur) => cur.map((x) => (kept.some((k) => k.key === x.key) ? { ...x, sorting: false } : x))))
    }
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

  /** The person picked a destination for one file. Photos still without one follow it (they are one notebook). */
  function setPlace(key: string, place: Place) {
    setItems((cur) => {
      const target = cur.find((x) => x.key === key)
      return cur.map((x) => {
        if (x.key === key) return { ...x, place, placeBy: 'manual' as const }
        const followsPhoto = target && isImage(target) && isImage(x) && !x.place && !defaultPlace && x.stage !== 'done'
        return followsPhoto ? { ...x, place, placeBy: 'manual' as const } : x
      })
    })
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
    setFinished(null)
    const errors: string[] = []
    const added: LinkItem[] = []
    const seen = new Set(links.filter((l) => l.stage !== 'done').map((l) => l.id))
    for (const part of parts.slice(0, MAX_LINKS)) {
      const parsed = parseDriveLink(part)
      if (!parsed) {
        errors.push(`“${part.slice(0, 60)}” is not a Google Drive link.`)
        continue
      }
      if (parsed.kind === 'folder') {
        // A folder link brings in every file inside it, each as its own note.
        const folder = await expandDriveFolder(part)
        if (!folder.ok) {
          errors.push(folder.message)
          continue
        }
        let skipped = 0
        for (const f of folder.files) {
          if (seen.has(f.id)) continue
          seen.add(f.id)
          if (await findDriveDuplicate(f.id, userId)) {
            skipped++
            continue
          }
          added.push({ key: crypto.randomUUID(), id: f.id, kind: f.kind, name: f.title, stage: 'queued' })
        }
        if (skipped) errors.push(`${skipped} file${skipped === 1 ? '' : 's'} in that folder are already on the site. Skipped.`)
        if (folder.truncated) errors.push('That folder is large: only the first 100 files were added.')
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
    if (errors.length === 0 || added.length > 0) setLinkText('')
    setLinkBusy(false)
  }

  const pending = useMemo(() => items.filter((i) => (i.stage === 'queued' || i.stage === 'error') && !(i.dup && !i.keep)), [items])
  const pendingLinks = useMemo(() => links.filter((l) => l.stage === 'queued' || l.stage === 'error'), [links])
  const duplicateCount = items.filter((i) => i.dup && !i.keep && i.stage !== 'done').length
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  // Files grouped by destination: each group becomes (or joins) one shelf.
  const plan = useMemo<Group[]>(() => {
    const groups = new Map<string, Group>()
    for (const i of pending) {
      const p = i.place ?? (subject !== undefined && unit !== undefined ? { code: subject, unit } : undefined)
      if (!p || p.unit === null) continue
      const key = `${p.code}:${p.unit}`
      const g =
        groups.get(key) ??
        ({ key, code: p.code, unit: p.unit, items: [], photos: [], separate: [], shelfCount: existing.find((c) => c.subject === p.code && c.unit === p.unit)?.files ?? 0 } satisfies Group)
      g.items.push(i)
      groups.set(key, g)
    }
    for (const g of groups.values()) {
      g.photos = combine ? g.items.filter(isImage) : []
      g.separate = g.items.filter((i) => !g.photos.includes(i))
    }
    return [...groups.values()]
  }, [pending, combine, subject, unit, existing])

  const unplaced = pending.filter((i) => !placeOf(i))
  const sortingNow = items.some((i) => i.sorting && i.stage !== 'done')
  const photoGroups = plan.filter((g) => g.photos.length > 0)
  const totalBytes = pending.reduce((n, i) => n + i.file.size, 0)
  const mergedCount = photoGroups.reduce((n, g) => n + g.photos.length, 0)

  const pdfNameFor = (g: Group) => {
    const found = findSubject(g.code)
    const short = found?.subject.short ?? g.code
    if (g.unit === PAPERS_UNIT && exam) return `${short} · ${EXAMS[exam]} ${examYear}`
    return autoName ? `${short} · ${sectionLabel(g.unit)} · Notes ${g.shelfCount + 1}` : `${short} ${sectionLabel(g.unit)} notes ${today}`
  }

  /** The name a file will get: what the person typed, else a chapter-based name, else its file name. */
  function nameFor(item: Item) {
    if (item.edited) return item.name
    const p = placeOf(item)
    const found = p ? findSubject(p.code) : undefined
    const g = p ? plan.find((x) => x.code === p.code && x.unit === p.unit) : undefined
    const at = g ? g.separate.indexOf(item) : -1
    // A paper is named for its exam, so Mid and Sem papers land on the right shelf.
    if (p && found && p.unit === PAPERS_UNIT && exam && g && at >= 0) {
      return `${found.subject.short} · ${EXAMS[exam]} ${examYear}${g.separate.length > 1 ? ` · Set ${at + 1}` : ''}`
    }
    if (!autoName) return item.name
    if (!p || !found) return item.name
    if (!g || at < 0) return item.name
    return autoFileName({ short: found.subject.short, unit: p.unit, n: g.shelfCount + (g.photos.length ? 1 : 0) + at + 1, original: item.file.name })
  }

  const hasPapers = plan.some((g) => g.unit === PAPERS_UNIT && g.items.length > 0)

  const ready =
    !running &&
    !sortingNow &&
    pending.length + pendingLinks.length > 0 &&
    unplaced.length === 0 &&
    (!hasPapers || !!exam) &&
    (pendingLinks.length === 0 || !!defaultPlace)

  async function start() {
    if (!ready) return
    setRunning(true)
    setMadePdfs(plan.filter((g) => g.photos.length > 0).length)
    const touched: { code: string; unit: number }[] = []
    // First upload: remember the uploader's branch, so shared subjects can group notes by branch.
    void supabaseBrowser().rpc('set_my_branch', { p_branch: branchId, p_keep: true }).then(() => undefined, () => undefined)
    try {
      for (const g of plan) {
        const isDefault = defaultPlace?.code === g.code && defaultPlace.unit === g.unit
        const collectionId = await ensureCollection(userId, g.code, g.unit, isDefault ? description : undefined)
        const base = await nextPosition(collectionId)
        const names = new Map(g.separate.map((i) => [i.key, nameFor(i)]))
        let offset = 0
        if (g.photos.length) {
          // The photos of this chapter become one PDF, in the order shown in the list.
          const name = (photoGroups.length === 1 && pdfName.trim()) || pdfNameFor(g)
          for (const p of g.photos) patch(p.key, { stage: 'preparing', error: undefined })
          try {
            setConverting(`Making PDF: page 0 of ${g.photos.length}`)
            const pdf = await photosToPdf(
              g.photos.map((p) => p.file),
              name,
              (done) => setConverting(`Making PDF: page ${done} of ${g.photos.length}`),
            )
            setConverting(null)
            if (pdf.size > 50 * 1024 * 1024) throw new Error('The PDF would be over 50 MB. Upload fewer photos at a time.')
            const hashes = g.photos.map((p) => p.hash)
            const contentHash = hashes.every(Boolean) ? await combineHashes(hashes as string[]) : undefined
            const already = contentHash ? (await findDuplicates([contentHash], userId)).get(contentHash) : undefined
            if (already) {
              throw new Error(`These photos are already on the site as “${already.name}” (${already.subject} · ${sectionLabel(already.unit)}, by ${already.owner}).`)
            }
            await uploadOne(pdf, { userId, collectionId, position: base, name, contentHash }, (stage) => g.photos.forEach((p) => patch(p.key, { stage })))
          } catch (e) {
            setConverting(null)
            const error = e instanceof Error ? e.message : 'Could not make the PDF'
            for (const p of g.photos) patch(p.key, { stage: 'error', error })
          }
          offset = 1
        }
        let cursor = 0
        // Three at a time keeps phones responsive on college Wi-Fi.
        await Promise.all(
          Array.from({ length: Math.min(3, g.separate.length) }, async () => {
            while (cursor < g.separate.length) {
              const item = g.separate[cursor]!
              const position = base + offset + g.separate.indexOf(item)
              cursor++
              try {
                const name = names.get(item.key) ?? item.name
                if (goesToDrive(mimeOf(item.file), item.file.size)) {
                  await uploadToDrive(item.file, { userId, collectionId, position, name }, (stage) => patch(item.key, { stage }))
                } else {
                  await uploadOne(item.file, { userId, collectionId, position, name, contentHash: item.hash }, (stage) => patch(item.key, { stage }))
                }
              } catch (e) {
                patch(item.key, { stage: 'error', error: e instanceof Error ? e.message : 'Upload failed' })
              }
            }
          }),
        )
        await refreshQuietly(g.code, g.unit)
        touched.push({ code: g.code, unit: g.unit })
      }

      // Drive links go to the chapter chosen in Step 1, after its files.
      if (pendingLinks.length > 0 && defaultPlace) {
        const collectionId = await ensureCollection(userId, defaultPlace.code, defaultPlace.unit, shelf ? undefined : description)
        const base = await nextPosition(collectionId)
        for (const [i, l] of pendingLinks.entries()) {
          patchLink(l.key, { stage: 'saving', error: undefined })
          try {
            await addDriveLink({ userId, collectionId, position: base + i, name: l.name, driveId: l.id, kind: l.kind })
            patchLink(l.key, { stage: 'done' })
          } catch (e) {
            patchLink(l.key, { stage: 'error', error: e instanceof Error ? e.message : 'Could not save this link' })
          }
        }
        await refreshQuietly(defaultPlace.code, defaultPlace.unit)
        if (!touched.some((t) => t.code === defaultPlace.code && t.unit === defaultPlace.unit)) touched.push(defaultPlace)
      }
      setFinished(touched)
      router.refresh()
    } catch (e) {
      setRejected([e instanceof Error ? e.message : 'Something went wrong'])
    } finally {
      setRunning(false)
    }
  }

  /**
   * Asks the site to show the new notes sooner. Only a nicety: pages catch up on their own within
   * minutes, so a failure here (for example this tab is older than the latest site update) must
   * never stop the rest of the upload.
   */
  async function refreshQuietly(code: string, unit: number) {
    try {
      await refreshChapter(code, unit)
    } catch {
      /* the notes are saved; the page just refreshes a little later */
    }
  }

  const doneCount = items.filter((i) => i.stage === 'done').length + links.filter((l) => l.stage === 'done').length
  const failed = items.filter((i) => i.stage === 'error').length + links.filter((l) => l.stage === 'error').length
  const fileCount = pending.length - (mergedCount > 0 ? mergedCount - photoGroups.length : 0)
  const summary = [
    pending.length ? plural(fileCount, 'file') : '',
    pendingLinks.length ? plural(pendingLinks.length, 'Drive link') : '',
  ]
    .filter(Boolean)
    .join(' + ')
  const chapterCount = plan.length + (pendingLinks.length > 0 && defaultPlace && !plan.some((g) => g.code === defaultPlace.code && g.unit === defaultPlace.unit) ? 1 : 0)
  const unplacedPhotos = unplaced.filter(isImage).length

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.15fr]">
      {/* Where */}
      <section className="rounded-3xl border border-line bg-surface p-5 shadow-card sm:p-6">
        <Step n={1} title="Where do these notes go?" />
        <p className="mt-3 flex items-start gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink-2">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-accent" />
          <span>
            <strong className="text-ink">You can skip this.</strong> Add your files and the site works out the subject and chapter of each one by reading it.
            Pick a chapter here only if everything you are adding goes to the same place.
          </span>
        </p>
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
        {defaultPlace && (
          <button
            type="button"
            onClick={() => {
              setSubject(undefined)
              setUnit(undefined)
            }}
            className="mt-4 text-sm font-medium text-accent underline underline-offset-4"
          >
            Clear this and let the site sort my files instead
          </button>
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
            {!defaultPlace && (
              <p className="mb-3 rounded-lg bg-gold-soft px-3 py-2 text-xs text-gold">Choose the chapter in Step 1 first. Links can&rsquo;t be sorted automatically.</p>
            )}
            <textarea
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              rows={3}
              disabled={linkBusy || running}
              placeholder="https://drive.google.com/file/d/…  or a folder link  (you can paste several, one per line)"
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
              Works with files, Google Docs, Sheets and Slides. Paste a <strong className="text-ink-2">folder link</strong> to add every file
              inside it at once. The link is only saved here, so it uses none of the
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
          <p className="text-sm text-ink-3">PDFs, photos, Word and PowerPoint files, up to 120 MB each. Originals are kept exactly as uploaded.</p>
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
          <input ref={picker} type="file" multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/gif,.doc,.docx,.ppt,.pptx" className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ''))} />
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

        {sortingNow && (
          <p className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-sm text-ink-2">
            <Loader2 className="size-4 shrink-0 animate-spin text-accent" /> Reading your files to find the subject and chapter…
          </p>
        )}

        {!sortingNow && unplacedPhotos > 0 && !aiOn && (
          <p className="mt-4 rounded-xl bg-gold-soft px-3 py-2 text-xs text-gold">
            Photos of handwriting can&rsquo;t be read automatically yet. Pick the chapter once for any one photo below and the rest of this set follows it.
          </p>
        )}

        {hasPapers && (
          <div className="mt-4 rounded-xl border border-line bg-bg px-4 py-3">
            <p className="text-sm font-medium">Which exam is this paper from?</p>
            <p className="text-xs text-ink-3">So it is filed under Mid PYQs or Sem PYQs, in the right year.</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {(Object.keys(EXAMS) as ExamKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  disabled={running}
                  onClick={() => setExam(k)}
                  aria-pressed={exam === k}
                  className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${exam === k ? 'border-accent bg-accent-soft text-ink' : 'border-line text-ink-2 hover:border-line-strong'}`}
                >
                  {EXAMS[k]}
                </button>
              ))}
              <select
                value={examYear}
                disabled={running}
                onChange={(e) => setExamYear(Number(e.target.value))}
                aria-label="Exam year"
                className="h-9 rounded-lg border border-line bg-surface px-2 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
            {!exam && <p className="mt-2 text-xs text-gold">Pick Mid 1, Mid 2 or Sem to continue.</p>}
          </div>
        )}

        {items.length > 0 && (chosen || plan.length > 0) && (
          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-bg px-4 py-3">
            <input type="checkbox" checked={autoName} disabled={running} onChange={(e) => setAutoName(e.target.checked)} className="mt-0.5 size-4 accent-[var(--accent)]" />
            <span className="text-sm">
              <span className="font-medium">Name files by chapter</span>
              <span className="block text-xs text-ink-3">
                e.g. {autoFileName({ short: 'DMS', unit: 2, n: shelf ? shelf.files + 1 : 1, original: 'IMG_2043.jpg' })}. You can still edit any name.
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
            {items.map((item, i) => {
              const place = placeOf(item)
              const found = place ? findSubject(place.code) : undefined
              const open = picking.has(item.key) || (!place && !item.sorting)
              return (
                <li key={item.key} className="flex items-start gap-3 rounded-xl border border-line bg-bg p-2">
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

                    {item.stage !== 'done' && (
                      <div className="mt-1 px-1">
                        {item.sorting ? (
                          <p className="flex items-center gap-1.5 text-xs text-ink-3">
                            <Loader2 className="size-3.5 animate-spin" /> Finding its chapter…
                          </p>
                        ) : place && found ? (
                          <p className="flex flex-wrap items-center gap-x-2 text-xs">
                            <span className="inline-flex items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 font-semibold text-accent">
                              <Sparkles className="size-3" />
                              {found.subject.short} · {sectionLabel(place.unit)}
                            </span>
                            <span className="text-ink-3">{item.place ? (item.placeBy ? BY_LABEL[item.placeBy] : '') : 'your choice in Step 1'}</span>
                            <button
                              type="button"
                              disabled={running}
                              onClick={() => setPicking((s) => new Set(s).add(item.key))}
                              className="font-semibold text-ink-2 underline underline-offset-2"
                            >
                              Change
                            </button>
                          </p>
                        ) : (
                          <p className="text-xs font-medium text-gold">
                            {item.place?.code ? `Looks like ${findSubject(item.place.code)?.subject.short ?? ''}. Which chapter?` : 'Choose where this goes'}
                          </p>
                        )}
                        {open && !item.sorting && (
                          <PlacePicker
                            value={item.place ?? (place ? { code: place.code, unit: place.unit } : undefined)}
                            semesters={allSemesters}
                            disabled={running}
                            onChange={(p) => {
                              setPlace(item.key, p)
                              if (p.unit !== null) setPicking((s) => (s.delete(item.key), new Set(s)))
                            }}
                          />
                        )}
                      </div>
                    )}

                    {item.dup && item.stage !== 'done' && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 px-1 text-xs text-gold">
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
                    <Check className="mt-1 size-5 shrink-0 text-ok" />
                  ) : ['preparing', 'uploading', 'saving'].includes(item.stage) ? (
                    <Loader2 className="mt-1 size-5 shrink-0 animate-spin text-ink-3" />
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
              )
            })}
          </ul>
        )}

        {pending.some(isImage) && (
          <div className={`mt-4 rounded-2xl border p-4 ${combine ? 'border-accent bg-accent-soft' : 'border-line bg-bg'}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={combine} disabled={running} onChange={(e) => setCombine(e.target.checked)} className="mt-1 size-4 accent-[var(--accent)]" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <FileStack className="size-4" /> Combine {plural(pending.filter(isImage).length, 'photo')} into one PDF per chapter
                </span>
                <span className="mt-0.5 block text-xs text-ink-3">
                  One page per photo, in the order above. Usually takes far less space than the original photos, and is easier to read and download.
                  Untick to upload the original photos separately.
                </span>
              </span>
            </label>
            {combine && photoGroups.length === 1 && (
              <input
                value={pdfName}
                disabled={running}
                onChange={(e) => setPdfName(e.target.value.slice(0, 120))}
                placeholder={pdfNameFor(photoGroups[0]!)}
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
          {plan.length > 0 && (
            <ul className="mb-3 space-y-1 text-sm text-ink-2">
              {plan.map((g) => {
                const f = findSubject(g.code)
                return (
                  <li key={g.key}>
                    {plural(g.items.length, 'file')} → <strong className="text-ink">{f?.subject.short ?? g.code} · {sectionLabel(g.unit)}</strong>
                    {g.shelfCount > 0 && <span className="text-ink-3"> (adds to your {plural(g.shelfCount, 'file')} there)</span>}
                  </li>
                )
              })}
            </ul>
          )}
          <button
            type="button"
            onClick={start}
            disabled={!ready}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent font-medium text-accent-ink shadow-card transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {running || sortingNow ? <Loader2 className="size-4 animate-spin" /> : <CloudUpload className="size-4" />}
            {running
              ? (converting ?? 'Saving…')
              : sortingNow
                ? 'Reading your files…'
                : unplaced.length > 0
                  ? `Choose where ${plural(unplaced.length, 'file')} ${unplaced.length === 1 ? 'goes' : 'go'}`
                  : pending.length + pendingLinks.length
                    ? `${pending.length ? 'Upload' : 'Add'} ${summary}${chapterCount > 1 ? ` to ${chapterCount} chapters` : mergedCount > 0 ? ' (photos as 1 PDF)' : pending.length ? ` (${formatBytes(totalBytes)})` : ''}`
                    : mode === 'drive'
                      ? 'Add a Drive link'
                      : 'Add files to upload'}
          </button>
          {finished && (
            <div className={`mt-4 flex flex-wrap items-center gap-3 rounded-xl px-4 py-3 text-sm ${failed ? 'bg-gold-soft text-gold' : 'bg-ok-soft text-ok'}`}>
              {failed ? <TriangleAlert className="size-4" /> : <Check className="size-4" />}
              <span className="flex-1">
                {failed ? `${plural(doneCount, 'file')} uploaded, ${failed} failed. Press upload again to retry.` : madePdfs > 0
                    ? `${plural(doneCount, 'photo')} saved as ${plural(madePdfs, 'PDF')} (one page per photo).`
                    : `All ${plural(doneCount, 'file')} uploaded.`}
              </span>
              {finished.map((t) => (
                <Link key={`${t.code}:${t.unit}`} href={sectionHref(t.code, t.unit)} className="font-semibold underline underline-offset-4">
                  {finished.length > 1 ? `${findSubject(t.code)?.subject.short ?? t.code} · ${sectionLabel(t.unit)}` : 'View chapter'}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

/** Subject and chapter pickers for one file. */
function PlacePicker({
  value,
  semesters,
  disabled,
  onChange,
}: {
  value?: Place
  semesters: Semester[]
  disabled?: boolean
  onChange: (p: Place) => void
}) {
  const current = value ? findSubject(value.code) : undefined
  const inList = semesters.some((s) => s.subjects.some((x) => x.code === value?.code))
  const select = 'h-9 min-w-0 flex-1 rounded-lg border border-line bg-surface px-2 text-xs'
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <select
        value={value?.code ?? ''}
        disabled={disabled}
        aria-label="Subject"
        onChange={(e) => {
          const f = findSubject(e.target.value)
          if (f) onChange({ code: f.subject.code, unit: f.subject.units.length ? null : 0 })
        }}
        className={select}
      >
        <option value="" disabled>
          Subject…
        </option>
        {value && current && !inList && <option value={current.subject.code}>{current.subject.short} · {current.subject.name}</option>}
        {semesters.map((s) => (
          <optgroup key={s.sem} label={s.sem === 0 ? 'Extras' : `Semester ${s.sem}`}>
            {s.subjects.map((x) => (
              <option key={x.code} value={x.code}>
                {x.short} · {x.name}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <select
        value={value?.unit ?? ''}
        disabled={disabled || !current}
        aria-label="Chapter"
        onChange={(e) => value && onChange({ code: value.code, unit: Number(e.target.value) })}
        className={select}
      >
        <option value="" disabled>
          Chapter…
        </option>
        {current &&
          sectionsOf(current.subject).map((u) => (
            <option key={u} value={u}>
              {sectionLabel(u)} · {sectionTitle(current.subject, u)}
            </option>
          ))}
      </select>
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
