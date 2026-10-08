import type { Metadata, Viewport } from 'next'
import { Inter, Syne } from 'next/font/google'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap', weight: ['500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: { default: 'EVL Notes · VNR VJIET', template: '%s · EVL Notes' },
  description:
    'Class notes for B.Tech EVL (R25), VNR VJIET, organised by semester, subject and chapter. Free to read and download, no sign-in needed.',
  applicationName: 'EVL Notes',
}

export const viewport: Viewport = {
  themeColor: '#050506',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable}`}>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
