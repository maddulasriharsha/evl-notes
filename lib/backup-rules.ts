/** Days a verified Drive copy must exist before the Storage original may be removed. */
export const KEEP_ORIGINAL_DAYS = 7

const DAY = 24 * 60 * 60 * 1000

/** Is a file backed up long enough ago that its original can go? */
export function isDueForRemoval(backedUpAt: string | Date, now: Date = new Date(), days = KEEP_ORIGINAL_DAYS): boolean {
  const t = typeof backedUpAt === 'string' ? Date.parse(backedUpAt) : backedUpAt.getTime()
  return Number.isFinite(t) && now.getTime() - t >= days * DAY
}

/** The moment from which a backed-up file counts as due (for the database query). */
export function removalCutoff(now: Date = new Date(), days = KEEP_ORIGINAL_DAYS): string {
  return new Date(now.getTime() - days * DAY).toISOString()
}

/** A Drive file name that is unique per note and still readable when browsing the backup folder. */
export function backupFileName(id: string, storagePath: string): string {
  const base = storagePath.split('/').pop() || 'file'
  return `${id}-${base}`.slice(0, 180)
}

/**
 * The Drive copy may replace the original only if it is the same size, still in the folder
 * (not in the bin) and still readable by anyone with the link.
 */
export function copyIsSafe(copy: { size: number | null; trashed: boolean; public: boolean }, expectedSize: number | null): boolean {
  if (copy.trashed || !copy.public) return false
  return expectedSize !== null && copy.size === expectedSize
}
