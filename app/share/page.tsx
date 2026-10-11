import type { Metadata } from 'next'
import QRCode from 'qrcode'
import { LogoMark } from '@/components/logo'
import { ShareActions } from '@/components/share-actions'
import { Container } from '@/components/ui'
import { SITE_URL } from '@/lib/site'

export const metadata: Metadata = { title: 'Share VJNOTES' }

export default async function SharePage() {
  const qr = await QRCode.toDataURL(SITE_URL, { margin: 1, width: 640, color: { dark: '#000000', light: '#ffffff' } })
  const message = `VJNOTES: class notes for every B.Tech branch at VNR VJIET, free to read and download, organised by branch, semester, subject and chapter. ${SITE_URL}`

  return (
    <Container className="py-10">
      <h1 className="font-display text-4xl font-semibold tracking-tight print:hidden">Share VJNOTES</h1>
      <p className="mt-2 max-w-xl text-ink-2 print:hidden">
        Send the link to your class group, or print this card and stick it on the notice board. Scanning the code opens the site.
      </p>

      {/* The card: printed as-is, so it keeps its own light colours. */}
      <div className="mt-8 w-full max-w-md rounded-3xl border border-line bg-white p-8 text-center text-black shadow-pop print:border-black print:shadow-none">
        <div className="mx-auto flex items-center justify-center gap-3">
          <LogoMark className="size-12" />
          <span className="font-display text-3xl font-bold tracking-tight">VJNOTES</span>
        </div>
        <p className="mt-3 text-base font-medium">Class notes for every branch</p>
        <p className="text-sm text-neutral-600">VNR VJIET · R25 · free to read and download</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qr} alt={`QR code for ${SITE_URL}`} width={256} height={256} className="mx-auto mt-6 size-64 rounded-xl" />
        <p className="mt-4 font-mono text-sm font-semibold">{SITE_URL.replace('https://', '')}</p>
        <p className="mt-1 text-xs text-neutral-500">Scan to read · sign in to upload your own</p>
      </div>

      <div className="mt-6">
        <ShareActions url={SITE_URL} message={message} />
      </div>
    </Container>
  )
}
