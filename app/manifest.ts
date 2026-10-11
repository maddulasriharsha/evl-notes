import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VJNOTES',
    short_name: 'VJNOTES',
    description: 'Class notes for every B.Tech branch (R25) at VNR VJIET. Free to read and download.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#050506',
    theme_color: '#050506',
    icons: [
      { src: '/pwa/192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/pwa/512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/pwa/512', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
