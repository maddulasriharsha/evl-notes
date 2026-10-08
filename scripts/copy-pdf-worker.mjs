// Copies pdf.js runtime files into public/ so the browser loads them from this site:
// the worker, plus the decoders and data it fetches only when a PDF needs them
// (JPEG 2000 / JBIG2 scans, colour profiles, CJK text, non-embedded standard fonts).
import { cpSync, copyFileSync, mkdirSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'

const require = createRequire(import.meta.url)
const root = dirname(require.resolve('pdfjs-dist/package.json'))
mkdirSync('public', { recursive: true })
copyFileSync(join(root, 'build', 'pdf.worker.min.mjs'), join('public', 'pdf.worker.min.mjs'))
rmSync(join('public', 'pdfjs'), { recursive: true, force: true })
for (const dir of ['wasm', 'cmaps', 'standard_fonts', 'iccs']) {
  cpSync(join(root, dir), join('public', 'pdfjs', dir), { recursive: true })
}
