import { driveCardThumb, driveKindFromMime, isDriveMime } from '@/lib/drive-link'
import { publicFileUrl } from '@/lib/env'

interface ThumbSource {
  mime: string
  drive_id: string | null
  storage_path: string | null
  thumb_path: string | null
}

/** Small preview image for a file: our own thumbnail, the photo itself, or Drive's thumbnail. */
export function thumbFor(f: ThumbSource): string | null {
  if (f.drive_id && isDriveMime(f.mime)) return driveCardThumb(driveKindFromMime(f.mime), f.drive_id)
  if (f.thumb_path) return publicFileUrl(f.thumb_path)
  if (f.mime !== 'application/pdf' && f.storage_path) return publicFileUrl(f.storage_path)
  return null
}
