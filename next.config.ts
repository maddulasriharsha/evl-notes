import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
]

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    const week = { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }
    return [
      { source: '/:path*', headers: securityHeaders },
      // pdf.js runtime files only change when pdfjs-dist is upgraded.
      { source: '/pdf.worker.min.mjs', headers: [week] },
      { source: '/pdfjs/:path*', headers: [week] },
    ]
  },
}

export default config
