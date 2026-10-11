import { ImageResponse } from 'next/og'

// App icons for "Add to home screen": the VJNOTES mark on black, drawn at the size asked for.
const SIZES = new Set([180, 192, 512])

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const size = Number((await params).size)
  if (!SIZES.has(size)) return new Response('Not found', { status: 404 })
  const pad = Math.round(size * 0.14)
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={size - pad * 2} height={size - pad * 2} viewBox="0 0 64 64">
          <g fill="#fff">
            <path d="M26 28Q29 43 41 46Q29 49 26 63Q23 49 9 46Q23 43 26 28Z" />
            <path d="M30 42C42 38 51 30 62 12C52 33 41 45 28 52Z" />
            <path d="M5 10C11 24 17 35 25 44L22 48C15 38 8 25 5 10Z" />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size, headers: { 'Cache-Control': 'public, max-age=31536000, immutable' } },
  )
}
