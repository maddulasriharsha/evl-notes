import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Inter, Syne } from 'next/font/google'
import { AnnouncementBar } from '@/components/announcement-bar'
import { HistoryTracker } from '@/components/study-history'
import { CommandPalette } from '@/components/command-palette'
import { FxLayer } from '@/components/fx-layer'
import { ReplyNotice } from '@/components/reply-notice'
import { Intro } from '@/components/intro'
import { StarField } from '@/components/star-field'
import { MobileNav } from '@/components/mobile-nav'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { VisitBeacon } from '@/components/visit-beacon'
import { ServiceWorkerRegister } from '@/components/sw-register'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })
const syne = Syne({ subsets: ['latin'], variable: '--font-syne', display: 'swap', weight: ['500', '600', '700', '800'] })

export const metadata: Metadata = {
  title: { default: 'VJNOTES · VNR VJIET class notes', template: '%s · VJNOTES' },
  description:
    'Class notes for every B.Tech branch (R25) at VNR VJIET, organised by branch, semester, subject and chapter. Free to read and download, no sign-in needed.',
  applicationName: 'VJNOTES',
  appleWebApp: { capable: true, title: 'VJNOTES', statusBarStyle: 'black-translucent' },
  icons: { apple: '/pwa/180' },
}

export const viewport: Viewport = {
  themeColor: '#050506',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${syne.variable}`} suppressHydrationWarning>
      <body className="flex min-h-dvh flex-col font-sans antialiased">
        <Script id="vj-theme" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('vj-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}var d=document.documentElement;d.classList.add('fx');try{if(!sessionStorage.getItem('vj-intro')&&!matchMedia('(prefers-reduced-motion: reduce)').matches){sessionStorage.setItem('vj-intro','1');d.classList.add('intro')}}catch(e){}`}
        </Script>
        <Intro />
        <FxLayer />
        {/* In the layout, so the sky stays put (no restart) when moving between pages. */}
        <StarField />
        <AnnouncementBar />
        <ReplyNotice />
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        {/* Room for the phone bar, so it never covers the end of a page. */}
        <div className="h-16 md:hidden print:hidden" aria-hidden="true" />
        <MobileNav />
        <CommandPalette />
        <ServiceWorkerRegister />
        <VisitBeacon />
        <HistoryTracker />
      </body>
    </html>
  )
}
