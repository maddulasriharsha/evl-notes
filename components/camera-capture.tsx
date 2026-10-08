'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Loader2, SwitchCamera, X } from 'lucide-react'

type ImageCaptureLike = { takePhoto: () => Promise<Blob> }
declare global {
  interface Window {
    ImageCapture?: new (track: MediaStreamTrack) => ImageCaptureLike
  }
}

export function cameraSupported() {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia
}

/**
 * Full-screen camera for snapping many pages in a row. Each shot is handed to onShot at once,
 * so it appears in the upload list while you keep shooting. Uses the camera's full-resolution
 * photo mode where the browser supports it (Chrome on Android), otherwise the sharpest video frame.
 */
export function CameraCapture({ onShot, onClose }: { onShot: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')
  const [error, setError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [shots, setShots] = useState<string[]>([])
  const [flash, setFlash] = useState(false)

  const stop = useCallback(() => {
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
  }, [])

  useEffect(() => {
    let cancelled = false
    setReady(false)
    setError(null)
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: { facingMode: { ideal: facing }, width: { ideal: 4096 }, height: { ideal: 3072 } },
      })
      .then((s) => {
        if (cancelled) return s.getTracks().forEach((t) => t.stop())
        stream.current = s
        if (video.current) {
          video.current.srcObject = s
          void video.current.play()
        }
        setReady(true)
      })
      .catch((e: unknown) => {
        const name = e instanceof Error ? e.name : ''
        setError(
          name === 'NotAllowedError'
            ? 'Camera permission was blocked. Allow camera access for this site in your browser settings, or use “Choose files”.'
            : 'Could not open the camera on this device. Use “Choose files” instead.',
        )
      })
    return () => {
      cancelled = true
      stop()
    }
  }, [facing, stop])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
      shots.forEach((u) => URL.revokeObjectURL(u))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function capture() {
    const v = video.current
    const track = stream.current?.getVideoTracks()[0]
    if (!v || !track || busy) return
    setBusy(true)
    setFlash(true)
    setTimeout(() => setFlash(false), 120)
    try {
      let blob: Blob | null = null
      if (window.ImageCapture) {
        try {
          blob = await new window.ImageCapture(track).takePhoto()
        } catch {
          blob = null
        }
      }
      if (!blob) {
        const canvas = document.createElement('canvas')
        canvas.width = v.videoWidth
        canvas.height = v.videoHeight
        canvas.getContext('2d')?.drawImage(v, 0, 0)
        blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.92))
      }
      if (!blob) throw new Error('capture failed')
      const n = shots.length + 1
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
      const type = blob.type === 'image/png' ? 'image/png' : 'image/jpeg'
      const file = new File([blob], `page-${String(n).padStart(2, '0')}-${stamp}.${type === 'image/png' ? 'png' : 'jpg'}`, { type })
      onShot(file)
      setShots((s) => [...s, URL.createObjectURL(blob)])
      if ('vibrate' in navigator) navigator.vibrate?.(20)
    } catch {
      setError('That photo did not work. Try again.')
    } finally {
      setBusy(false)
    }
  }

  function done() {
    stop()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label="Camera">
      <div className="flex items-center justify-between px-4 py-3">
        <button type="button" onClick={done} aria-label="Close camera" className="grid size-10 place-items-center rounded-full bg-white/10">
          <X className="size-5" />
        </button>
        <p className="text-sm font-medium">{shots.length ? `${shots.length} page${shots.length === 1 ? '' : 's'} taken` : 'Point at the page'}</p>
        <button
          type="button"
          onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
          aria-label="Switch camera"
          className="grid size-10 place-items-center rounded-full bg-white/10"
        >
          <SwitchCamera className="size-5" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <video ref={video} playsInline muted className="absolute inset-0 size-full object-contain" />
        {!ready && !error && (
          <div className="absolute inset-0 grid place-items-center">
            <Loader2 className="size-8 animate-spin opacity-70" />
          </div>
        )}
        {error && (
          <div className="absolute inset-0 grid place-items-center p-8 text-center text-sm">
            <p className="max-w-xs">{error}</p>
          </div>
        )}
        <div className={`pointer-events-none absolute inset-0 bg-white transition-opacity duration-150 ${flash ? 'opacity-60' : 'opacity-0'}`} />
      </div>

      <div className="flex items-center gap-4 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex h-14 min-w-0 flex-1 items-center gap-1.5 overflow-x-auto">
          {shots.map((u, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={u} src={u} alt={`Page ${i + 1}`} className="h-12 w-9 shrink-0 rounded object-cover ring-1 ring-white/30" />
          ))}
        </div>
        <button
          type="button"
          onClick={capture}
          disabled={!ready || busy}
          aria-label="Take photo"
          className="grid size-18 shrink-0 place-items-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className={`size-14 rounded-full bg-white transition ${busy ? 'scale-90' : ''}`} />
        </button>
        <div className="flex flex-1 justify-end">
          <button type="button" onClick={done} className="inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-black">
            <Check className="size-4" /> Done
          </button>
        </div>
      </div>
    </div>
  )
}
