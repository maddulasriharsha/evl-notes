import { ImageResponse } from 'next/og'

export const SHARE_SIZE = { width: 1200, height: 630 }

/** The picture WhatsApp, Telegram and Instagram show when a subject or chapter link is pasted. */
export function shareCard({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  const size = title.length > 60 ? 54 : title.length > 36 ? 66 : 80
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: '#050505',
          color: '#ffffff',
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: '#ffffff',
              color: '#050505',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            V
          </div>
          <div style={{ fontSize: 40, fontWeight: 800, letterSpacing: 2 }}>VJNOTES</div>
          <div style={{ marginLeft: 12, fontSize: 24, color: '#a1a1aa', border: '2px solid #3f3f46', borderRadius: 999, padding: '4px 18px' }}>
            VNR VJIET
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 28, color: '#a1a1aa', letterSpacing: 4, textTransform: 'uppercase' }}>{kicker}</div>
          <div style={{ fontSize: size, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          {subtitle ? <div style={{ fontSize: 34, color: '#d4d4d8' }}>{subtitle}</div> : null}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 28, color: '#a1a1aa' }}>
          <div>Free class notes, question papers and question banks</div>
          <div style={{ color: '#ffffff', fontWeight: 700 }}>vj-notes.vercel.app</div>
        </div>
      </div>
    ),
    SHARE_SIZE,
  )
}
