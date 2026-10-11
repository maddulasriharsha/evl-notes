import { ButtonLink, Container } from '@/components/ui'

export default function NotFound() {
  return (
    <Container className="grid min-h-[60dvh] place-items-center py-16 text-center">
      <div>
        <p className="font-display text-7xl font-semibold text-ink-3">404</p>
        <h1 className="mt-4 font-display text-2xl font-semibold">This page isn&rsquo;t in the notebook</h1>
        <p className="mt-2 text-ink-3">The link may be old, or the file was hidden by its owner.</p>
        <div className="mt-6">
          <ButtonLink href="/">Back to home</ButtonLink>
        </div>
      </div>
    </Container>
  )
}
