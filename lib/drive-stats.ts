import { driveFiles } from '@/lib/library'

/**
 * Size of the Google Drive library (notes and papers kept on Drive, listed in data/drive-library.json).
 * Pages count PDF pages, slides and Word pages where known, and one per file otherwise; the first
 * 546 files were counted by hand on 9 Oct 2026 (11,234 pages), which stays the floor.
 */
export const DRIVE_LIBRARY = {
  files: driveFiles.length,
  pages: Math.max(
    11234,
    driveFiles.reduce((n, f) => n + (f.pages ?? 1), 0),
  ),
} as const
