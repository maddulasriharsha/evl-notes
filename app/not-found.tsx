import { ButtonLink, Container } from '@/components/ui'
import { SearchBox } from '@/components/search-box'

export default function NotFound() {
  return (
    <Container className="grid min-h-[70dvh] place-items-center py-16 text-center">
      <div className="w-full max-w-lg">
        <p className="text-glow font-display text-8xl font-bold tracking-tight text-accent sm:text-9xl" aria-hidden="true">
          404
        </p>
        <h1 className="mt-6 font-display text-2xl font-bold tracking-tight sm:text-3xl">This page isn&rsquo;t in the notebook</h1>
        <p className="mt-3 text-ink-2">The link may be old, or the file was hidden by its owner. Try searching for it instead.</p>
        <div className="relative z-10 mt-8 text-left">
          <SearchBox compact />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Back to home</ButtonLink>
          <ButtonLink href="/#branches" variant="ghost">
            Pick your branch
          </ButtonLink>
        </div>
      </div>
    </Container>
  )
}
