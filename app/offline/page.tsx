import type { Metadata } from 'next'
import { WifiOff } from 'lucide-react'
import { Container } from '@/components/ui'

export const metadata: Metadata = { title: 'Offline' }

export default function OfflinePage() {
  return (
    <Container className="grid min-h-[60vh] place-items-center py-16 text-center">
      <div>
        <WifiOff className="mx-auto size-10 text-ink-3" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight">You are offline</h1>
        <p className="mx-auto mt-2 max-w-md text-ink-2">
          VJNOTES needs a connection to load notes. Pages you opened recently may still open from the back button. Try again when
          you have signal.
        </p>
      </div>
    </Container>
  )
}
